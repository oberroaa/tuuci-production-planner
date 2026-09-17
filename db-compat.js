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
                const res = await client.query(s, params);
                return {
                  lastInsertRowid: (res.rows && res.rows[0] && ('id' in res.rows[0])) ? res.rows[0].id : null,
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
