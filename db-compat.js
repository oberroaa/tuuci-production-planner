import { pool, getPool, query, initDb, updatePoolConfig } from './db.js';

export { pool, getPool, query, initDb, updatePoolConfig };

/**
 * SQLite-like compatibility adapter for PostgreSQL Pool.
 * Allows synchronous-like fluent syntax or simple async execution across endpoints.
 */

function convertPlaceholders(sql) {
  let count = 0;
  return sql.replace(/\?/g, () => `$${++count}`);
}

function shouldAppendReturningId(sql) {
  const cleanSql = sql.replace(/\/\*[\s\S]*?\*\/|--.*$/gm, '').trim();
  const match = cleanSql.match(/^INSERT\s+INTO\s+([a-zA-Z0-9_".]+)/i);
  if (!match) return false;
  const rawTable = match[1].replace(/["`]/g, '').toLowerCase();
  const table = rawTable.includes('.') ? rawTable.split('.').pop() : rawTable;
  if (table === 'configuraciones') return false;
  if (/\breturning\b/i.test(cleanSql)) return false;
  return true;
}

class StatementWrapper {
  constructor(sql) {
    this.sql = convertPlaceholders(sql);
  }

  async get(...params) {
    const res = await getPool().query(this.sql, params);
    return res.rows[0] || null;
  }

  async all(...params) {
    const res = await getPool().query(this.sql, params);
    return res.rows;
  }

  async run(...params) {
    let querySql = this.sql;
    if (shouldAppendReturningId(querySql)) {
      querySql = querySql.trim().replace(/;+\s*$/, '') + ' RETURNING id';
    }
    const res = await getPool().query(querySql, params);
    const lastId = (res.rows && res.rows[0] && ('id' in res.rows[0])) ? res.rows[0].id : null;
    return {
      lastInsertRowid: lastId,
      rowCount: res.rowCount,
      changes: res.rowCount
    };
  }
}

export const dbCompat = {
  prepare(sql) {
    return new StatementWrapper(sql);
  },

  async exec(sql) {
    return await getPool().query(sql);
  },

  transaction(fn) {
    return async (...args) => {
      const client = await getPool().connect();
      try {
        await client.query('BEGIN');
        const txDb = {
          prepare(sql) {
            const pgSql = convertPlaceholders(sql);
            return {
              async get(...params) {
                const res = await client.query(pgSql, params);
                return res.rows[0] || null;
              },
              async all(...params) {
                const res = await client.query(pgSql, params);
                return res.rows;
              },
              async run(...params) {
                let s = pgSql;
                if (shouldAppendReturningId(s)) {
                  s = s.trim().replace(/;+\s*$/, '') + ' RETURNING id';
                }
                const res = await client.query(s, params);
                const lastId = (res.rows && res.rows[0] && ('id' in res.rows[0])) ? res.rows[0].id : null;
                return {
                  lastInsertRowid: lastId,
                  rowCount: res.rowCount,
                  changes: res.rowCount
                };
              }
            };
          }
        };
        const result = await fn(txDb, ...args);
        await client.query('COMMIT');
        return result;
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    };
  }
};

export default dbCompat;
