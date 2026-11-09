import csv
import hashlib
import io
import os
import secrets
from datetime import datetime, timedelta, timezone
from functools import wraps
from pathlib import Path
from uuid import UUID, uuid4

import click
import psycopg
from psycopg.rows import dict_row
from flask import Flask, g, jsonify, request, Response
from werkzeug.security import check_password_hash, generate_password_hash
from werkzeug.exceptions import HTTPException

from domain import money_to_paise, validate_refund

app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 64 * 1024


def db():
    if 'db' not in g:
        g.db = psycopg.connect(os.environ['DATABASE_URL'], row_factory=dict_row)
    return g.db


@app.teardown_appcontext
def close_db(error):
    connection = g.pop('db', None)
    if connection:
        connection.close()


def fail(message, status=400):
    return jsonify(error=message), status


def auth(admin=False):
    def decorate(fn):
        @wraps(fn)
        def wrapped(*args, **kwargs):
            token = request.headers.get('Authorization', '').removeprefix('Bearer ')
            g.token_hash = hashlib.sha256(token.encode()).hexdigest()
            g.user = db().execute('''SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id
                WHERE s.token_hash=%s AND s.expires_at>now() AND u.active''', (g.token_hash,)).fetchone()
            if not g.user:
                return fail('Please sign in again.', 401)
            if admin and g.user['role'] != 'admin':
                return fail('Admin access required.', 403)
            return fn(*args, **kwargs)
        return wrapped
    return decorate


def body():
    value = request.get_json()
    if not isinstance(value, dict):
        raise ValueError('Expected a JSON object.')
    return value


def field(data, key, maximum=200, optional=False, preserve=False):
    value = data.get(key, '')
    if not isinstance(value, str) or len(value.strip()) > maximum or (not optional and not value.strip()):
        raise ValueError(f'Enter a valid {key} (maximum {maximum} characters).')
    return value if preserve else value.strip()


def identifier(value):
    try:
        return UUID(str(value))
    except (ValueError, TypeError):
        raise ValueError('Invalid record identifier.') from None


def public_user(user):
    return {key: user[key] for key in ('id', 'name', 'email', 'role', 'phone', 'active')}


def audit(action, entity):
    db().execute('INSERT INTO audit_log(actor_id,action,entity_id) VALUES (%s,%s,%s)',
                 (g.user['id'], action, entity))


def scope():
    return (None if g.user['role'] == 'admin' else g.user['id'])


def payment_for_user(payment_id, lock=False):
    row = db().execute('SELECT * FROM payments WHERE id=%s' + (' FOR UPDATE' if lock else ''),
                       (identifier(payment_id),)).fetchone()
    if not row or (scope() and row['employee_id'] != scope()):
        return None
    return row


@app.errorhandler(ValueError)
def invalid(error):
    return fail(str(error))


@app.errorhandler(psycopg.IntegrityError)
def conflict(error):
    db().rollback()
    return fail('This record conflicts with existing data.', 409)


@app.errorhandler(Exception)
def unexpected(error):
    if isinstance(error, HTTPException):
        return fail(error.description, error.code)
    app.logger.exception('Request failed')
    return fail('The server could not complete the request. Please try again.', 500)


@app.get('/health')
def health():
    db().execute('SELECT 1')
    return jsonify(status='ok')


@app.post('/auth/login')
def login():
    data = body()
    email = field(data, 'email').lower()
    password = field(data, 'password', 256, preserve=True)
    identity = hashlib.sha256(email.encode()).hexdigest()
    attempt = db().execute('''INSERT INTO login_attempts(identity,attempts) VALUES(%s,1)
        ON CONFLICT(identity) DO UPDATE SET
        attempts=CASE WHEN login_attempts.window_start < now()-interval '15 minutes' THEN 1 ELSE login_attempts.attempts+1 END,
        window_start=CASE WHEN login_attempts.window_start < now()-interval '15 minutes' THEN now() ELSE login_attempts.window_start END
        RETURNING attempts''', (identity,)).fetchone()
    db().commit()
    if attempt['attempts'] > 10:
        return fail('Too many sign-in attempts. Try again in 15 minutes.', 429)
    user = db().execute('SELECT * FROM users WHERE email=%s AND active', (email,)).fetchone()
    # Keep password hashing work for unknown accounts too.
    valid = check_password_hash(user['password_hash'] if user else DUMMY_HASH, password)
    if not user or not valid:
        return fail('Incorrect email or password.', 401)
    token = secrets.token_urlsafe(48)
    db().execute('DELETE FROM sessions WHERE expires_at <= now()')
    db().execute('INSERT INTO sessions VALUES(%s,%s,%s)',
                 (hashlib.sha256(token.encode()).hexdigest(), user['id'], datetime.now(timezone.utc) + timedelta(hours=12)))
    db().execute('DELETE FROM login_attempts WHERE identity=%s', (identity,))
    db().commit()
    return jsonify(token=token, user=public_user(user))


@app.post('/auth/logout')
@auth()
def logout():
    db().execute('DELETE FROM sessions WHERE token_hash=%s', (g.token_hash,))
    db().commit()
    return jsonify(ok=True)


@app.get('/employees')
@auth(admin=True)
def employees():
    return jsonify([public_user(u) for u in db().execute('SELECT * FROM users ORDER BY name').fetchall()])


@app.post('/employees')
@auth(admin=True)
def add_employee():
    data = body()
    password = field(data, 'password', 256, preserve=True)
    if len(password) < 12:
        raise ValueError('Password must have at least 12 characters.')
    email = field(data, 'email').lower()
    if '@' not in email or '.' not in email.split('@')[-1]:
        raise ValueError('Enter a valid email address.')
    role = data.get('role', 'employee')
    if role not in ('employee', 'admin'):
        raise ValueError('Invalid role.')
    uid = uuid4()
    db().execute('INSERT INTO users(id,name,email,password_hash,role,phone) VALUES(%s,%s,%s,%s,%s,%s)',
                 (uid, field(data, 'name'), email, generate_password_hash(password), role, field(data, 'phone', 30, True)))
    audit('user.created', uid)
    db().commit()
    return jsonify(id=uid), 201


@app.patch('/employees/<uid>')
@auth(admin=True)
def update_employee(uid):
    uid = identifier(uid)
    data = body()
    if uid == g.user['id']:
        raise ValueError('You cannot deactivate your own account.')
    if not isinstance(data.get('active'), bool):
        raise ValueError('An active status is required.')
    row = db().execute('UPDATE users SET active=%s WHERE id=%s RETURNING id', (data['active'], uid)).fetchone()
    if not row:
        return fail('Employee not found.', 404)
    db().execute('DELETE FROM sessions WHERE user_id=%s', (uid,))
    audit('user.activated' if data['active'] else 'user.deactivated', uid)
    db().commit()
    return jsonify(ok=True)


def payment_rows():
    return db().execute('''SELECT p.*,u.name AS employee_name,
        COALESCE((SELECT SUM(r.amount_paise) FROM refunds r WHERE r.payment_id=p.id AND r.status='approved'),0)::bigint AS refunded_paise
        FROM payments p JOIN users u ON u.id=p.employee_id
        WHERE (%s::uuid IS NULL OR p.employee_id=%s) ORDER BY p.created_at DESC''', (scope(), scope())).fetchall()


@app.get('/payments')
@auth()
def payments():
    return jsonify(payment_rows())


@app.post('/payments')
@auth()
def create_payment():
    data = body()
    key = identifier(data.get('idempotency_key'))
    # Transaction advisory lock makes simultaneous retries safe.
    db().execute('SELECT pg_advisory_xact_lock(hashtextextended(%s,0))', (str(key),))
    existing = db().execute('SELECT * FROM payments WHERE idempotency_key=%s', (key,)).fetchone()
    if existing:
        if existing['employee_id'] != g.user['id']:
            return fail('Request key already used.', 409)
        return jsonify(id=existing['id'])
    method, status = data.get('method'), data.get('status')
    if method not in ('Cash', 'UPI', 'Bank', 'Card') or status not in ('paid', 'pending'):
        raise ValueError('Invalid payment method or status.')
    pid = uuid4()
    db().execute('''INSERT INTO payments(id,customer,amount_paise,method,status,reference,notes,employee_id,paid_at,idempotency_key)
        VALUES(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)''',
        (pid, field(data, 'customer'), money_to_paise(data.get('amount')), method, status,
         field(data, 'reference', 200, True), field(data, 'notes', 1000, True), g.user['id'],
         datetime.now(timezone.utc) if status == 'paid' else None, key))
    audit('payment.created', pid)
    db().commit()
    return jsonify(id=pid), 201


@app.post('/payments/<pid>/paid')
@auth()
def mark_paid(pid):
    payment = payment_for_user(pid, lock=True)
    if not payment:
        return fail('Payment not found.', 404)
    if payment['status'] == 'pending':
        db().execute("UPDATE payments SET status='paid',paid_at=now() WHERE id=%s", (payment['id'],))
        audit('payment.paid', payment['id'])
    db().commit()
    return jsonify(ok=True)


@app.get('/refunds')
@auth()
def refunds():
    return jsonify(db().execute('''SELECT r.*,p.customer,u.name AS employee_name FROM refunds r
        JOIN payments p ON p.id=r.payment_id JOIN users u ON u.id=r.requested_by
        WHERE (%s::uuid IS NULL OR p.employee_id=%s) ORDER BY r.created_at DESC''', (scope(), scope())).fetchall())


@app.post('/refunds')
@auth()
def request_refund():
    data = body()
    key = identifier(data.get('idempotency_key'))
    db().execute('SELECT pg_advisory_xact_lock(hashtextextended(%s,0))', (str(key),))
    existing = db().execute('SELECT * FROM refunds WHERE idempotency_key=%s', (key,)).fetchone()
    if existing:
        if existing['requested_by'] != g.user['id']:
            return fail('Request key already used.', 409)
        return jsonify(id=existing['id'])
    payment = payment_for_user(data.get('payment_id'), lock=True)
    if not payment:
        return fail('Payment not found.', 404)
    amount = money_to_paise(data.get('amount'))
    reserved = db().execute("SELECT COALESCE(SUM(amount_paise),0) AS total FROM refunds WHERE payment_id=%s AND status IN ('pending','approved')", (payment['id'],)).fetchone()['total']
    validate_refund(payment['status'], payment['amount_paise'], reserved, amount)
    rid = uuid4()
    db().execute('INSERT INTO refunds(id,payment_id,amount_paise,reason,requested_by,idempotency_key) VALUES(%s,%s,%s,%s,%s,%s)',
                 (rid, payment['id'], amount, field(data, 'reason', 1000), g.user['id'], key))
    audit('refund.requested', rid)
    db().commit()
    return jsonify(id=rid), 201


@app.post('/refunds/<rid>/review')
@auth(admin=True)
def review_refund(rid):
    decision = body().get('status')
    if decision not in ('approved', 'rejected'):
        raise ValueError('Choose approved or rejected.')
    row = db().execute('SELECT * FROM refunds WHERE id=%s FOR UPDATE', (identifier(rid),)).fetchone()
    if not row:
        return fail('Refund not found.', 404)
    if row['status'] != 'pending':
        return fail('This refund has already been reviewed.', 409)
    db().execute('UPDATE refunds SET status=%s,reviewed_by=%s,reviewed_at=now() WHERE id=%s', (decision, g.user['id'], row['id']))
    audit('refund.' + decision, row['id'])
    db().commit()
    return jsonify(ok=True)


@app.get('/dashboard')
@auth()
def dashboard():
    rows = payment_rows()
    paid = sum(p['amount_paise'] for p in rows if p['status'] == 'paid')
    returned = sum(p['refunded_paise'] for p in rows)
    return jsonify(paid_paise=paid, pending_paise=sum(p['amount_paise'] for p in rows if p['status'] == 'pending'),
                   refunded_paise=returned, net_paise=paid-returned, count=len(rows))


@app.get('/reports/payments.csv')
@auth(admin=True)
def report():
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(['ID', 'Customer', 'Amount INR', 'Refunded INR', 'Status', 'Method', 'Employee', 'Reference', 'Created UTC'])
    def safe(value):
        value = str(value)
        return "'" + value if value.lstrip().startswith(('=', '+', '-', '@')) or value.startswith(('\t', '\r', '\n')) else value
    for p in payment_rows():
        writer.writerow([p['id'], safe(p['customer']), f"{p['amount_paise']/100:.2f}", f"{p['refunded_paise']/100:.2f}", p['status'], p['method'], safe(p['employee_name']), safe(p['reference']), p['created_at'].isoformat()])
    return Response(output.getvalue(), mimetype='text/csv', headers={'Content-Disposition': 'attachment; filename=palm-payments.csv'})


@app.get('/audit')
@auth(admin=True)
def audit_history():
    return jsonify(db().execute('''SELECT a.*,u.name AS actor_name FROM audit_log a JOIN users u ON u.id=a.actor_id
        ORDER BY a.created_at DESC LIMIT 500''').fetchall())


@app.cli.command('init-db')
def init_db():
    db().execute(Path(__file__).with_name('schema.sql').read_text())
    db().commit()
    click.echo('Database schema ready.')


@app.cli.command('create-admin')
@click.option('--email', prompt=True)
@click.option('--name', prompt=True)
@click.password_option(confirmation_prompt=True)
def create_admin(email, name, password):
    if len(password) < 12:
        raise click.ClickException('Use at least 12 characters.')
    db().execute('INSERT INTO users(id,name,email,password_hash,role) VALUES(%s,%s,%s,%s,%s)',
                 (uuid4(), name, email.strip().lower(), generate_password_hash(password), 'admin'))
    db().commit()
    click.echo('Admin created.')


DUMMY_HASH = generate_password_hash(secrets.token_urlsafe(32))
