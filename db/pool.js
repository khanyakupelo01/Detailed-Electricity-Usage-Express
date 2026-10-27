const { Pool } = require('pg');
const config = require('../config');

let pool;

const getPool = () => {
  if (!config.DATABASE_URL) {
    const error = new Error('Database is not configured');
    error.code = 'DB_CONFIG_MISSING';
    throw error;
  }

  if (!pool) {
    pool = new Pool({
      connectionString: config.DATABASE_URL,
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 30000,
      max: 10,
    });
  }

  return pool;
};

const query = (text, values) => getPool().query(text, values);

const close = async () => {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
};

module.exports = {
  query,
  close,
};
