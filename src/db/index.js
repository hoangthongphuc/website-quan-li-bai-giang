const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const config = require('../config');

const pool = mysql.createPool({
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
  database: config.db.database,
  connectionLimit: config.db.poolSize,
  waitForConnections: true,
  charset: 'utf8mb4',
  timezone: 'local',
});

async function query(sql, params = []) {
  const [rows] = await pool.query(sql, params);
  return rows;
}

async function one(sql, params = []) {
  const rows = await query(sql, params);
  return rows[0] || null;
}

/** Tạo bảng nếu chưa có */
async function migrate() {
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  const conn = await mysql.createConnection({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    database: config.db.database,
    multipleStatements: true,
    charset: 'utf8mb4',
  });
  try {
    await conn.query(sql);
  } finally {
    await conn.end();
  }
}

module.exports = { pool, query, one, migrate };
