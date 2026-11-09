import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import fileUpload from 'express-fileupload';
import { v2 as cloudinary } from 'cloudinary';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import pg from 'pg';
import ExcelJS from 'exceljs';
import { createHash, randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z, ZodError } from 'zod';

const { Pool } = pg;
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.');
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) throw new Error('JWT_SECRET must contain at least 32 characters.');
if (process.env.CLOUDINARY_URL) cloudinary.config({ secure: true });
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: Number(process.env.DB_POOL_SIZE || 10) });
const app = express();
const dummyPasswordHash = await bcrypt.hash('Palm-app-invalid-password', 12);
app.disable('x-powered-by');
app.use(helmet());
const allowedOrigins = (process.env.CORS_ORIGINS || '').split(',').map(x => x.trim()).filter(Boolean);
app.use(cors({ origin(origin, callback) { if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) return callback(null, true); callback(new Error('Origin is not allowed by CORS.')); } }));
app.use(express.json({ limit: '64kb' }));
app.use(fileUpload({ limits: { fileSize: 5 * 1024 * 1024 }, abortOnLimit: true, useTempFiles: false, safeFileNames: true }));

const schemas = {
  login: z.object({ email: z.string().trim().email().max(320), password: z.string().min(1).max(256) }),
  employee: z.object({ name: z.string().trim().min(1).max(200), email: z.string().trim().email().max(320), password: z.string().min(12).max(256), role: z.enum(['employee','admin']).default('employee'), phone: z.string().trim().max(30).default(''), avatar_url: z.union([z.string().url().max(1000),z.literal('')]).default('') }),
  payment: z.object({ customer: z.string().trim().min(1).max(200), amount: z.union([z.string(),z.number()]), method: z.enum(['Cash','UPI','Bank','Card']), status: z.enum(['paid','pending']), reference: z.string().trim().max(200).default(''), notes: z.string().trim().max(1000).default(''), idempotency_key: z.string().uuid() }),
  go: z.object({ go_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), tons: z.union([z.string(),z.number()]), price_per_ton: z.union([z.string(),z.number()]), amount_received: z.union([z.string(),z.number()]).default('0'), received_date: z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/),z.literal('')]).default(''), idempotency_key: z.string().uuid() }),
  refund: z.object({ payment_id: z.string().uuid(), amount: z.union([z.string(),z.number()]), reason: z.string().trim().min(1).max(1000), idempotency_key: z.string().uuid() }),
};
const hash = value => createHash('sha256').update(value).digest('hex');
const paise = value => {
  const amount = String(value);
  if (!/^\d+(\.\d{1,2})?$/.test(amount)) throw new Error('Use a valid amount with no more than two decimal places.');
  const cents = Math.round(Number(amount) * 100);
  if (!Number.isSafeInteger(cents) || cents < 1 || cents > 10000000000) throw new Error('Amount must be between 0.01 and 100,000,000.');
  return cents;
};
const nonnegativePaise = value => {
  const amount = String(value);
  if (!/^\d+(\.\d{1,2})?$/.test(amount)) throw new Error('Enter a valid amount with no more than two decimal places.');
  const cents = Math.round(Number(amount) * 100);
  if (!Number.isSafeInteger(cents) || cents > 10000000000) throw new Error('Amount must not exceed 100,000,000.');
  return cents;
};
const validDate = value => {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
};
const jsonRows = rows => rows.map(row => Object.fromEntries(Object.entries(row).map(([k,v]) => [k, typeof v === 'bigint' ? Number(v) : (['amount_paise','refunded_paise','paid_paise','pending_paise','net_paise','count','id','price_per_ton_paise','sales_paise','amount_received_paise','outstanding_paise'].includes(k) && typeof v === 'string' && /^\d+$/.test(v) ? Number(v) : v)])));
const fail = (res, message, status = 400) => res.status(status).json({ error: message });
function transaction(fn) {
  return async (req, res, next) => {
    const client = await pool.connect();
    try { await client.query('BEGIN'); const result = await fn(req, res, client); await client.query('COMMIT'); return result; }
    catch (error) { await client.query('ROLLBACK').catch(() => {}); next(error); }
    finally { client.release(); }
  };
}
function authenticate(admin = false) {
  return async (req, res, next) => {
    try {
      const token = (req.get('authorization') || '').replace(/^Bearer\s+/i, '');
      if (!token) return fail(res, 'Please sign in again.', 401);
      const claims = jwt.verify(token, process.env.JWT_SECRET);
      const { rows } = await pool.query(`SELECT u.id,u.name,u.email,u.role,u.phone,u.active,u.avatar_url
        FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now() AND u.active`, [hash(token)]);
      if (!rows[0]) return fail(res, 'Please sign in again.', 401);
      req.user = rows[0]; req.token = token;
      if (admin && req.user.role !== 'admin') return fail(res, 'Admin access required.', 403);
      if (claims.sub !== req.user.id) return fail(res, 'Please sign in again.', 401);
      return next();
    } catch { return fail(res, 'Please sign in again.', 401); }
  };
}
const scopeId = user => user.role === 'admin' ? null : user.id;
async function audit(client, user, action, entity) { await client.query('INSERT INTO audit_log(actor_id,action,entity_id) VALUES($1,$2,$3)', [user.id, action, entity]); }
async function paymentFor(client, user, id, lock = false) {
  const { rows } = await client.query(`SELECT * FROM payments WHERE id=$1${lock ? ' FOR UPDATE' : ''}`, [id]);
  return rows[0] && (user.role === 'admin' || rows[0].employee_id === user.id) ? rows[0] : null;
}
async function paymentRows(user) {
  const { rows } = await pool.query(`SELECT p.*,u.name AS employee_name,
    COALESCE((SELECT SUM(r.amount_paise) FROM refunds r WHERE r.payment_id=p.id AND r.status='approved'),0)::bigint AS refunded_paise
    FROM payments p JOIN users u ON u.id=p.employee_id WHERE ($1::uuid IS NULL OR p.employee_id=$1) ORDER BY p.created_at DESC`, [scopeId(user)]);
  return jsonRows(rows);
}
async function goRows(user) {
  const { rows } = await pool.query(`SELECT g.id,g.go_date,g.tons,g.price_per_ton_paise,
    round(g.tons*g.price_per_ton_paise)::bigint AS sales_paise,g.amount_received_paise,
    (round(g.tons*g.price_per_ton_paise)-g.amount_received_paise)::bigint AS outstanding_paise,
    g.received_date,g.created_at,u.name AS employee_name
    FROM go_records g JOIN users u ON u.id=g.employee_id
    WHERE ($1::uuid IS NULL OR g.employee_id=$1) ORDER BY g.go_date DESC,g.created_at DESC`, [scopeId(user)]);
  return jsonRows(rows).map(row => ({ ...row, tons: Number(row.tons) }));
}

app.get('/health', async (_req,res,next) => { try { await pool.query('SELECT 1'); res.json({status:'ok'}); } catch(e) { next(e); } });
app.post('/auth/login', transaction(async (req,res,db) => {
  const { email, password } = schemas.login.parse(req.body); const normalized=email.toLowerCase(); const identity=hash(normalized);
  const { rows: attempts } = await db.query(`INSERT INTO login_attempts(identity,attempts) VALUES($1,1) ON CONFLICT(identity) DO UPDATE SET
    attempts=CASE WHEN login_attempts.window_start<now()-interval '15 minutes' THEN 1 ELSE login_attempts.attempts+1 END,
    window_start=CASE WHEN login_attempts.window_start<now()-interval '15 minutes' THEN now() ELSE login_attempts.window_start END RETURNING attempts`, [identity]);
  if (attempts[0].attempts>10) return fail(res,'Too many sign-in attempts. Try again in 15 minutes.',429);
  const { rows } = await db.query('SELECT * FROM users WHERE email=$1 AND active', [normalized]); const user=rows[0];
  const valid=await bcrypt.compare(password,user?.password_hash || dummyPasswordHash);
  if (!user || !valid) return fail(res,'Incorrect email or password.',401);
  const token=jwt.sign({},process.env.JWT_SECRET,{subject:user.id,expiresIn:'12h'});
  await db.query('DELETE FROM sessions WHERE expires_at<=now()');
  await db.query('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval \'12 hours\')',[hash(token),user.id]);
  await db.query('DELETE FROM login_attempts WHERE identity=$1',[identity]);
  res.json({ token, user: { id:user.id,name:user.name,email:user.email,role:user.role,phone:user.phone,active:user.active,avatar_url:user.avatar_url } });
}));
app.post('/auth/logout', authenticate(), transaction(async (req,res,db) => { await db.query('DELETE FROM sessions WHERE token_hash=$1',[hash(req.token)]); res.json({ok:true}); }));

app.get('/employees', authenticate(true), async (_req,res,next) => { try { const {rows}=await pool.query('SELECT id,name,email,role,phone,active,avatar_url,created_at FROM users ORDER BY name'); res.json(rows); } catch(e){next(e);} });
app.post('/employees', authenticate(true), transaction(async (req,res,db) => {
  const data=schemas.employee.parse(req.body); const id=randomUUID();
  await db.query('INSERT INTO users(id,name,email,password_hash,role,phone,avatar_url) VALUES($1,$2,$3,$4,$5,$6,$7)',[id,data.name,data.email.toLowerCase(),await bcrypt.hash(data.password,12),data.role,data.phone,data.avatar_url]);
  await audit(db,req.user,'user.created',id); res.status(201).json({id});
}));
app.patch('/employees/:id', authenticate(true), transaction(async (req,res,db) => {
  const id=z.string().uuid().parse(req.params.id); const data=z.object({active:z.boolean()}).parse(req.body);
  if(id===req.user.id) return fail(res,'You cannot deactivate your own account.');
  const {rows}=await db.query('UPDATE users SET active=$1 WHERE id=$2 RETURNING id',[data.active,id]);
  if(!rows[0]) return fail(res,'Employee not found.',404);
  await db.query('DELETE FROM sessions WHERE user_id=$1',[id]); await audit(db,req.user,data.active?'user.activated':'user.deactivated',id); res.json({ok:true});
}));
app.get('/payments', authenticate(), async (req,res,next)=>{try{res.json(await paymentRows(req.user));}catch(e){next(e);}});
app.post('/payments', authenticate(), transaction(async (req,res,db)=>{
  const data=schemas.payment.parse(req.body); const key=data.idempotency_key; await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[key]);
  const existing=(await db.query('SELECT id,employee_id FROM payments WHERE idempotency_key=$1',[key])).rows[0];
  if(existing) return existing.employee_id===req.user.id?res.json({id:existing.id}):fail(res,'Request key already used.',409);
  const id=randomUUID(),amount=paise(data.amount);
  await db.query(`INSERT INTO payments(id,customer,amount_paise,method,status,reference,notes,employee_id,paid_at,idempotency_key)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,CASE WHEN $5='paid' THEN now() ELSE NULL END,$9)`,[id,data.customer,amount,data.method,data.status,data.reference,data.notes,req.user.id,key]);
  await audit(db,req.user,'payment.created',id); res.status(201).json({id});
}));
app.get('/gos', authenticate(), async (req,res,next)=>{ try { res.json(await goRows(req.user)); } catch(e) { next(e); } });
app.post('/gos', authenticate(), transaction(async (req,res,db)=>{
  const data=schemas.go.parse(req.body);
  if (!validDate(data.go_date) || (data.received_date && !validDate(data.received_date))) throw new Error('Enter valid GO and received dates.');
  const tonsText=String(data.tons);
  if (!/^\d+(\.\d{1,3})?$/.test(tonsText)) throw new Error('Enter quantity in tons with up to three decimal places.');
  const tons=Number(tonsText);
  if (!Number.isFinite(tons) || tons <= 0 || tons > 1000000) throw new Error('Quantity must be greater than zero and at most 1,000,000 tons.');
  const pricePerTon=paise(data.price_per_ton), amountReceived=nonnegativePaise(data.amount_received);
  const sales=Math.round(tons*pricePerTon);
  if (!Number.isSafeInteger(sales) || sales < 1) throw new Error('Calculated sales amount is outside the supported range.');
  if (amountReceived > sales) throw new Error('Amount received cannot exceed the GO sales amount.');
  if (amountReceived > 0 && !data.received_date) throw new Error('Enter the received date when an amount has been received.');
  await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[data.idempotency_key]);
  const existing=(await db.query('SELECT id,employee_id FROM go_records WHERE idempotency_key=$1',[data.idempotency_key])).rows[0];
  if(existing) return existing.employee_id===req.user.id?res.json({id:existing.id}):fail(res,'Request key already used.',409);
  const id=randomUUID();
  await db.query(`INSERT INTO go_records(id,go_date,tons,price_per_ton_paise,amount_received_paise,received_date,employee_id,idempotency_key)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,[id,data.go_date,tons.toFixed(3),pricePerTon,amountReceived,data.received_date||null,req.user.id,data.idempotency_key]);
  await audit(db,req.user,'go.created',id); res.status(201).json({id});
}));
app.post('/payments/:id/paid', authenticate(), transaction(async(req,res,db)=>{
  const id=z.string().uuid().parse(req.params.id); const payment=await paymentFor(db,req.user,id,true); if(!payment)return fail(res,'Payment not found.',404);
  if(payment.status==='pending'){await db.query("UPDATE payments SET status='paid',paid_at=now() WHERE id=$1",[id]);await audit(db,req.user,'payment.paid',id);} res.json({ok:true});
}));
app.get('/refunds', authenticate(), async(req,res,next)=>{try{const {rows}=await pool.query(`SELECT r.*,p.customer,u.name AS employee_name FROM refunds r JOIN payments p ON p.id=r.payment_id JOIN users u ON u.id=r.requested_by WHERE ($1::uuid IS NULL OR p.employee_id=$1) ORDER BY r.created_at DESC`,[scopeId(req.user)]);res.json(jsonRows(rows));}catch(e){next(e);}});
app.post('/refunds', authenticate(), transaction(async(req,res,db)=>{
  const data=schemas.refund.parse(req.body); await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[data.idempotency_key]);
  const existing=(await db.query('SELECT id,requested_by FROM refunds WHERE idempotency_key=$1',[data.idempotency_key])).rows[0];
  if(existing)return existing.requested_by===req.user.id?res.json({id:existing.id}):fail(res,'Request key already used.',409);
  const payment=await paymentFor(db,req.user,data.payment_id,true);if(!payment)return fail(res,'Payment not found.',404);
  const amount=paise(data.amount); const reserved=Number((await db.query("SELECT COALESCE(SUM(amount_paise),0)::bigint AS total FROM refunds WHERE payment_id=$1 AND status IN ('pending','approved')",[payment.id])).rows[0].total);
  if(payment.status!=='paid')return fail(res,'Only paid transactions can be refunded.');
  if(amount+reserved>Number(payment.amount_paise))return fail(res,'Refund exceeds the available payment balance.');
  const id=randomUUID();await db.query('INSERT INTO refunds(id,payment_id,amount_paise,reason,requested_by,idempotency_key) VALUES($1,$2,$3,$4,$5,$6)',[id,payment.id,amount,data.reason,req.user.id,data.idempotency_key]);
  await audit(db,req.user,'refund.requested',id);res.status(201).json({id});
}));
app.post('/refunds/:id/review', authenticate(true), transaction(async(req,res,db)=>{
  const id=z.string().uuid().parse(req.params.id);const {status}=z.object({status:z.enum(['approved','rejected'])}).parse(req.body);
  const {rows}=await db.query('SELECT * FROM refunds WHERE id=$1 FOR UPDATE',[id]);const row=rows[0];if(!row)return fail(res,'Refund not found.',404);if(row.status!=='pending')return fail(res,'This refund has already been reviewed.',409);
  await db.query('UPDATE refunds SET status=$1,reviewed_by=$2,reviewed_at=now() WHERE id=$3',[status,req.user.id,id]);await audit(db,req.user,`refund.${status}`,id);res.json({ok:true});
}));
app.get('/dashboard', authenticate(), async(req,res,next)=>{try{const {rows}=await pool.query(`SELECT COALESCE(SUM(amount_paise) FILTER(WHERE status='paid'),0)::bigint paid_paise,COALESCE(SUM(amount_paise) FILTER(WHERE status='pending'),0)::bigint pending_paise,COUNT(*)::int count FROM payments WHERE ($1::uuid IS NULL OR employee_id=$1)`,[scopeId(req.user)]);const r=rows[0];const {rows:refunds}=await pool.query(`SELECT COALESCE(SUM(r.amount_paise),0)::bigint total FROM refunds r JOIN payments p ON p.id=r.payment_id WHERE r.status='approved' AND ($1::uuid IS NULL OR p.employee_id=$1)`,[scopeId(req.user)]);const returned=Number(refunds[0].total),paid=Number(r.paid_paise);res.json({paid_paise:paid,pending_paise:Number(r.pending_paise),refunded_paise:returned,net_paise:paid-returned,count:r.count});}catch(e){next(e);}});
app.get('/reports/payments.csv',authenticate(true),async(_req,res,next)=>{
  try {
    const rows=await paymentRows({role:'admin'});
    const quote=value=>{
      let text=String(value??'');
      if(['=','+','-','@'].includes(text[0]) || [9,10,13].includes(text.charCodeAt(0))) text="'"+text;
      return '"'+text.replaceAll('"','""')+'"';
    };
    const lines=[['ID','Customer','Amount INR','Refunded INR','Status','Method','Employee','Reference','Created UTC'],...rows.map(p=>[p.id,p.customer,(p.amount_paise/100).toFixed(2),(p.refunded_paise/100).toFixed(2),p.status,p.method,p.employee_name,p.reference,new Date(p.created_at).toISOString()])];
    res.type('text/csv').attachment('palm-payments.csv').send(lines.map(row=>row.map(quote).join(',')).join('\r\n'));
  } catch(error) { next(error); }
});
app.get('/reports/go.xlsx', authenticate(), async(req,res,next)=>{
  try {
    const records=await goRows(req.user);
    const workbook=new ExcelJS.Workbook();
    workbook.creator='Palm'; workbook.created=new Date();
    const sheet=workbook.addWorksheet('GO Sales');
    sheet.columns=[
      {header:'GO Date',key:'go_date',width:14},
      {header:'Quantity (Ton)',key:'tons',width:18},
      {header:'Price / Ton (INR)',key:'price',width:20},
      {header:'Sales (INR)',key:'sales',width:18},
      {header:'Amount Received (INR)',key:'received',width:24},
      {header:'Received Date',key:'received_date',width:16},
      {header:'Outstanding (INR)',key:'outstanding',width:22},
      {header:'Employee',key:'employee',width:24},
    ];
    sheet.getRow(1).font={bold:true,color:{argb:'FFFFFFFF'}};
    sheet.getRow(1).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF176B53'}};
    for(const row of records) sheet.addRow({
      go_date:row.go_date,tons:row.tons,price:(row.price_per_ton_paise||0)/100,
      sales:row.sales_paise/100,received:row.amount_received_paise/100,
      received_date:row.received_date||'',outstanding:row.outstanding_paise/100,employee:row.employee_name,
    });
    sheet.getColumn('tons').numFmt='#,##0.000';
    for(const key of ['price','sales','received','outstanding']) sheet.getColumn(key).numFmt='#,##0.00';
    sheet.autoFilter={from:'A1',to:'H1'}; sheet.views=[{state:'frozen',ySplit:1}];
    const file=await workbook.xlsx.writeBuffer();
    res.type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      .attachment('palm-go-sales.xlsx').send(Buffer.from(file));
  } catch(error) { next(error); }
});
app.get('/audit',authenticate(true),async(_req,res,next)=>{try{const {rows}=await pool.query('SELECT a.*,u.name AS actor_name FROM audit_log a JOIN users u ON u.id=a.actor_id ORDER BY a.created_at DESC LIMIT 500');res.json(jsonRows(rows));}catch(e){next(e);}});
app.post('/uploads/image',authenticate(true),async(req,res,next)=>{try{if(!process.env.CLOUDINARY_URL)return fail(res,'Image uploads are not configured on this server.',503);const file=req.files?.image;if(!file)return fail(res,'Choose an image to upload.');if(!/^image\/(png|jpeg|webp)$/.test(file.mimetype))return fail(res,'Upload a PNG, JPEG, or WebP image.');const result=await new Promise((resolve,reject)=>cloudinary.uploader.upload_stream({folder:'palm-app',resource_type:'image'},(error,value)=>error?reject(error):resolve(value)).end(file.data));res.status(201).json({url:result.secure_url});}catch(e){next(e);}});

const frontend = resolve(dirname(fileURLToPath(import.meta.url)), '../client/dist');
if (existsSync(frontend)) app.use(express.static(frontend, { fallthrough: true }));
app.use((req,res)=>fail(res,'Route not found.',404));
app.use((error,_req,res,_next)=>{if(error instanceof ZodError)return fail(res,error.issues[0]?.message||'Invalid request data.');if(error.code==='23505')return fail(res,'This record conflicts with existing data.',409);if(error.type==='entity.too.large')return fail(res,'Request is too large.',413);console.error('Request failed:',error);return fail(res,'The server could not complete the request. Please try again.',500);});
const port=Number(process.env.PORT||8000);
const server=app.listen(port,'0.0.0.0',()=>console.log(`Palm API listening on port ${port}`));
async function shutdown(){server.close(async()=>{await pool.end();process.exit(0);});setTimeout(()=>process.exit(1),10000).unref();}
process.on('SIGTERM',shutdown);process.on('SIGINT',shutdown);
