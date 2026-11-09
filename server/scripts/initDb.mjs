import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import pg from 'pg';

if (!process.env.DATABASE_URL) throw new Error('Set DATABASE_URL in server/.env before initializing the database.');
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 2 });
try {
  await pool.query(await readFile(new URL('../schema.sql', import.meta.url), 'utf8'));
  console.log('Palm PostgreSQL schema is ready.');
} finally {
  await pool.end();
}
