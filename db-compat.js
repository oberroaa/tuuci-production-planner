import { pool, query, initDb } from './db.js';

export { pool, query, initDb };

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
    const res = await pool.query(this.sql, params);
    return res.rows[0] || null;
  }

  async all(...params) {
    const res = await pool.query(this.sql, params);
    return res.rows;
  }

  async run(...params) {
    // If it's an insert without returning, add RETURNING id if applicable
    let querySql = this.sql;
    const isInsert = /^\s*INSERT\s+INTO/i.test(querySql);
    if (isInsert && !/RETURNING/i.test(querySql)) {
      querySql += ' RETURNING id';
    }
    const res = await pool.query(querySql, params);
    const lastId = (res.rows && res.rows[0] && res.rows[0].id) ? res.rows[0].id : null;
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
    return await pool.query(sql);
  },

  transaction(fn) {
    return async (...args) => {
      const client = await pool.connect();
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
                if (/^\s*INSERT\s+INTO/i.test(s) && !/RETURNING/i.test(s)) {
                  s += ' RETURNING id';
                }
                const res = await client.query(s, params);
                return {
                  lastInsertRowid: (res.rows && res.rows[0] && res.rows[0].id) || null,
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
