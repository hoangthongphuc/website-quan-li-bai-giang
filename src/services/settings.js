const db = require('../db');

// Giá trị mặc định cho trang "Cấu hình"
const DEFAULTS = {
  site_name: 'Hệ thống Quản lí Bài giảng',
  site_tagline: 'Kho bài giảng trực tuyến dành cho sinh viên và học viên',
  organization: 'Khoa Công nghệ Thông tin',
  contact_email: 'daotao@example.edu.vn',
  allow_student_download: '0',
  max_upload_mb: '50',
  session_timeout_minutes: '120',
  login_notice: 'Sử dụng tài khoản do nhà trường cấp để đăng nhập.',
  maintenance_mode: '0',
};

let cache = null;

async function load() {
  const rows = await db.query('SELECT setting_key, setting_value FROM settings');
  const s = { ...DEFAULTS };
  for (const r of rows) s[r.setting_key] = r.setting_value;
  cache = s;
  return s;
}

async function all() {
  return cache || load();
}

async function save(values) {
  for (const key of Object.keys(DEFAULTS)) {
    if (values[key] === undefined) continue;
    await db.query(
      'INSERT INTO settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)',
      [key, String(values[key])]
    );
  }
  return load();
}

module.exports = { DEFAULTS, all, save, load };
