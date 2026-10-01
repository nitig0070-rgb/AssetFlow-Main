import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const { Pool } = pg;

// Parse INT8 (PostgreSQL bigint) as numbers in JS instead of strings
pg.types.setTypeParser(pg.types.builtins.INT8, (val) => parseInt(val, 10));

// Return TIMESTAMP (without timezone) as string to prevent local timezone offset conversion
pg.types.setTypeParser(pg.types.builtins.TIMESTAMP, (val) => val);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let pool = null;

export const db = {
  // Translate SQLite query placeholder '?' to PostgreSQL '$1', '$2', etc.
  convertQuery(sql) {
    let index = 1;
    return sql.replace(/\?/g, () => `$${index++}`);
  },

  async all(sql, ...params) {
    if (sql.trim().toUpperCase().startsWith('PRAGMA')) return [];
    const convertedSql = this.convertQuery(sql);
    const result = await pool.query(convertedSql, params);
    return result.rows;
  },

  async get(sql, ...params) {
    if (sql.trim().toUpperCase().startsWith('PRAGMA')) return null;
    const convertedSql = this.convertQuery(sql);
    const result = await pool.query(convertedSql, params);
    return result.rows[0];
  },

  async run(sql, ...params) {
    if (sql.trim().toUpperCase().startsWith('PRAGMA')) return { lastID: null, changes: 0 };
    
    let convertedSql = this.convertQuery(sql);
    
    // Automatically append RETURNING id on INSERT if not already present
    const trimmed = convertedSql.trim().toUpperCase();
    if (trimmed.startsWith('INSERT') && !trimmed.includes('RETURNING')) {
      convertedSql = convertedSql.trim() + ' RETURNING id';
    }

    const result = await pool.query(convertedSql, params);
    
    return {
      lastID: result.rows[0] ? result.rows[0].id : null,
      changes: result.rowCount
    };
  },

  async exec(sql) {
    // Split SQL by semicolon, but clean up and ignore empty lines or SQLite commands
    const commands = sql
      .split(';')
      .map(cmd => cmd.trim())
      .filter(cmd => cmd.length > 0 && !cmd.toUpperCase().startsWith('PRAGMA'));

    for (const cmd of commands) {
      await pool.query(cmd);
    }
  }
};

export async function initDb() {
  if (pool) return db;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is missing!');
  }

  pool = new Pool({
    connectionString,
    ssl: {
      rejectUnauthorized: false // Neon requires SSL, this allows secure pooling
    }
  });

  // Read schema
  const schemaPath = path.join(__dirname, '../db/schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf8');

  // Execute schema
  await db.exec(schema);
  console.log('PostgreSQL database schema verified/created successfully.');

  return db;
}

export function getDb() {
  if (!pool) {
    throw new Error('Database not initialized! Call initDb() first.');
  }
  return db;
}
