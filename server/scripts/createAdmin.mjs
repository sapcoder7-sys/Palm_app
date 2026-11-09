import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import pg from 'pg';

const io = createInterface({ input, output });
const ask = async label => (await io.question(label)).trim();
function askPassword(label) {
  if (!input.isTTY || typeof input.setRawMode !== 'function') {
    throw new Error('Run this command in an interactive terminal so the password can be hidden.');
  }
  output.write(label);
  input.setRawMode(true);
  input.resume();
  return new Promise((resolve, reject) => {
    let value = '';
    const finish = error => {
      input.off('data', onData);
      input.setRawMode(false);
      output.write('\n');
      if (error) reject(error); else resolve(value);
    };
    const onData = buffer => {
      for (const character of buffer.toString('utf8')) {
        if (character === '\r' || character === '\n') return finish();
        if (character === '\u0003') return finish(new Error('Admin setup cancelled.'));
        if (character === '\u007f' || character === '\b') value = value.slice(0, -1);
        else if (character.charCodeAt(0) >= 32) value += character;
      }
    };
    input.on('data', onData);
  });
}
let pool;
try {
  const name = await ask('Admin name: ');
  const email = (await ask('Admin email: ')).toLowerCase();
  io.close();
  const password = await askPassword('Admin password (minimum 12 characters): ');
  if (!name || !/^\S+@\S+\.\S+$/.test(email) || password.length < 12) throw new Error('Enter a name, valid email, and password with at least 12 characters.');
  pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  await pool.query('INSERT INTO users(id,name,email,password_hash,role) VALUES($1,$2,$3,$4,$5)', [randomUUID(), name, email, await bcrypt.hash(password, 12), 'admin']);
  console.log('Admin account created.');
} finally {
  io.close();
  await pool?.end();
}
