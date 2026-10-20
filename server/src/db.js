import { PGlite } from '@electric-sql/pglite';
import pg from 'pg';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let dbClient = null;
let isNativePg = false;

export async function getDb() {
  if (dbClient) return dbClient;

  const dbUrl = process.env.DATABASE_URL;

  if (dbUrl) {
    console.log('[Database] Connecting to native PostgreSQL via DATABASE_URL...');
    const pool = new pg.Pool({
      connectionString: dbUrl,
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined
    });
    dbClient = {
      query: async (sql, params = []) => {
        const start = Date.now();
        const res = await pool.query(sql, params);
        const duration = Date.now() - start;
        return { rows: res.rows, rowCount: res.rowCount, duration };
      },
      exec: async (sql) => {
        return await pool.query(sql);
      },
      transaction: async (callback) => {
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          const res = await callback({
            query: (sql, params = []) => client.query(sql, params)
          });
          await client.query('COMMIT');
          return res;
        } catch (err) {
          await client.query('ROLLBACK');
          throw err;
        } finally {
          client.release();
        }
      },
      close: async () => pool.end()
    };
    isNativePg = true;
  } else {
    const dataDir = path.resolve(__dirname, '../../database/data_pglite');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    console.log(`[Database] Initializing embedded PostgreSQL (PGlite) at ${dataDir}...`);
    const pglite = new PGlite(dataDir);
    await pglite.waitReady;

    dbClient = {
      query: async (sql, params = []) => {
        const start = Date.now();
        const res = await pglite.query(sql, params);
        const duration = Date.now() - start;
        return { rows: res.rows, rowCount: res.rows ? res.rows.length : 0, duration };
      },
      exec: async (sql) => {
        return await pglite.exec(sql);
      },
      transaction: async (callback) => {
        return await pglite.transaction(async (tx) => {
          return await callback({
            query: async (sql, params = []) => {
              const res = await tx.query(sql, params);
              return { rows: res.rows, rowCount: res.rows ? res.rows.length : 0 };
            }
          });
        });
      },
      close: async () => pglite.close()
    };
    isNativePg = false;
  }

  return dbClient;
}

export async function initSchema() {
  const db = await getDb();
  const schemaPath = path.resolve(__dirname, '../../database/schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');

  console.log('[Database] Executing relational schema DDL and views...');
  await db.exec(schemaSql);
  console.log('[Database] Schema, constraints, indexes, and views successfully initialized.');
}
