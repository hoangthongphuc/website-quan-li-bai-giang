/**
 * Khu vực quản trị (chỉ admin): tổng quan, tài khoản, nhật ký, cấu hình, báo cáo
 */
const express = require('express');
const bcrypt = require('bcryptjs');
const ExcelJS = require('exceljs');
const db = require('../db');
const { getStorage } = require('../storage');
const settings = require('../services/settings');
const { requireRole, ROLE_LABELS } = require('../middleware/auth');
const { logActivity, ACTION_LABELS } = require('../services/logger');
const { isoDate, formatBytes } = require('../utils/helpers');

const router = express.Router();
router.use(requireRole('admin'));

const flash = (req, type, msg) => (req.session.flash = { type, msg });

/* ---------- Tổng quan ---------- */
router.get('/', async (req, res, next) => {
  try {
    const [roles, courses, lectures, logins30, logins7, failed7, recent, topLectures, perDay] = await Promise.all([
      db.query('SELECT role, COUNT(*) AS n FROM users GROUP BY role'),
      db.one('SELECT COUNT(*) AS n FROM courses'),
      db.one('SELECT COUNT(*) AS n, COALESCE(SUM(file_size),0) AS size, COALESCE(SUM(view_count),0) AS views FROM lectures'),
      db.one('SELECT COUNT(*) AS n FROM login_history WHERE success = 1 AND created_at >= NOW() - INTERVAL 30 DAY'),
      db.one('SELECT COUNT(DISTINCT user_id) AS n FROM login_history WHERE success = 1 AND created_at >= NOW() - INTERVAL 7 DAY'),
      db.one('SELECT COUNT(*) AS n FROM login_history WHERE success = 0 AND created_at >= NOW() - INTERVAL 7 DAY'),
      db.query('SELECT * FROM activity_logs ORDER BY id DESC LIMIT 12'),
      db.query(`SELECT l.id, l.title, l.view_count, c.title AS course_title FROM lectures l JOIN courses c ON c.id = l.course_id
                ORDER BY l.view_count DESC LIMIT 5`),
      db.query(`SELECT DATE(created_at) AS d, COUNT(*) AS n FROM login_history WHERE success = 1 AND created_at >= CURDATE() - INTERVAL 13 DAY
                GROUP BY DATE(created_at) ORDER BY d`),
    ]);
    const roleCount = { admin: 0, lecturer: 0, student: 0 };
    roles.forEach((r) => (roleCount[r.role] = r.n));
    // Đủ 14 ngày (kể cả ngày không có lượt đăng nhập)
    const map = Object.fromEntries(perDay.map((r) => [isoDate(r.d), r.n]));
    const chart = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      chart.push({ label: `${d.getDate()}/${d.getMonth() + 1}`, n: map[isoDate(d)] || 0 });
    }
    const storageStatus = await getStorage().status();
    res.render('admin/dashboard', {
      title: 'Bảng quản trị',
      roleCount, courses: courses.n, lectures, logins30: logins30.n, active7: logins7.n, failed7: failed7.n,
      recent, topLectures, chart, storageStatus, ACTION_LABELS,
    });
  } catch (e) {
    next(e);
  }
});

/* ---------- Tài khoản ---------- */
router.get('/users', async (req, res, next) => {
  try {
    const q = String(req.query.q || '').trim();
    const role = ['admin', 'lecturer', 'student'].includes(req.query.role) ? req.query.role : '';
    const params = [];
    let where = '1=1';
    if (role) {
      where += ' AND role = ?';
      params.push(role);
    }
    if (q) {
      where += ' AND (username LIKE ? OR full_name LIKE ? OR email LIKE ? OR student_code LIKE ?)';
      params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
    }
    const users = await db.query(`SELECT * FROM users WHERE ${where} ORDER BY FIELD(role,'admin','lecturer','student'), username`, params);
    const editing = req.query.edit ? users.find((u) => String(u.id) === req.query.edit) || (await db.one('SELECT * FROM users WHERE id = ?', [req.query.edit])) : null;
    res.render('admin/users', { title: 'Quản lí tài khoản', users, q, role, editing });
  } catch (e) {
    next(e);
  }
});

router.post('/users', async (req, res, next) => {
  try {
    const b = req.body;
    if (!b.username || !b.password || !b.full_name) {
      flash(req, 'error', 'Cần nhập tên đăng nhập, họ tên và mật khẩu.');
      return res.redirect('/admin/users');
    }
    const exists = await db.one('SELECT id FROM users WHERE username = ?', [b.username.trim()]);
    if (exists) {
      flash(req, 'error', 'Tên đăng nhập đã tồn tại.');
      return res.redirect('/admin/users');
    }
    const role = ['admin', 'lecturer', 'student'].includes(b.role) ? b.role : 'student';
    const r = await db.query(
      'INSERT INTO users (username, password_hash, full_name, email, role, student_code) VALUES (?, ?, ?, ?, ?, ?)',
      [b.username.trim(), await bcrypt.hash(b.password, 10), b.full_name, b.email || null, role, b.student_code || null]
    );
    await logActivity(req, 'create_user', 'user', r.insertId, `${b.username} (${role})`);
    flash(req, 'success', `Đã tạo tài khoản ${b.username}.`);
    res.redirect('/admin/users');
  } catch (e) {
    next(e);
  }
});

// Nhập hàng loạt: mỗi dòng "username,họ tên,email,mật khẩu,mã SV"
router.post('/users/import', async (req, res, next) => {
  try {
    const role = ['lecturer', 'student'].includes(req.body.role) ? req.body.role : 'student';
    const lines = String(req.body.csv || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    let ok = 0;
    const skipped = [];
    for (const line of lines) {
      const [username, full_name, email, password, code] = line.split(',').map((x) => (x || '').trim());
      if (!username || !full_name || !password) {
        skipped.push(line);
        continue;
      }
      const ex = await db.one('SELECT id FROM users WHERE username = ?', [username]);
      if (ex) {
        skipped.push(username);
        continue;
      }
      await db.query('INSERT INTO users (username, password_hash, full_name, email, role, student_code) VALUES (?, ?, ?, ?, ?, ?)', [
        username, await bcrypt.hash(password, 10), full_name, email || null, role, code || null,
      ]);
      ok++;
    }
    await logActivity(req, 'import_users', 'user', null, `${ok} tài khoản ${role}`);
    flash(req, skipped.length ? 'error' : 'success', `Đã nhập ${ok} tài khoản.` + (skipped.length ? ` Bỏ qua: ${skipped.slice(0, 10).join(' | ')}` : ''));
    res.redirect('/admin/users');
  } catch (e) {
    next(e);
  }
});

router.post('/users/:id', async (req, res, next) => {
  try {
    const u = await db.one('SELECT * FROM users WHERE id = ?', [req.params.id]);
    if (!u) return res.redirect('/admin/users');
    const b = req.body;
    const role = ['admin', 'lecturer', 'student'].includes(b.role) ? b.role : u.role;
    const self = u.id === req.session.user.id;
    await db.query('UPDATE users SET full_name=?, email=?, role=?, student_code=?, is_active=? WHERE id=?', [
      b.full_name || u.full_name, b.email || null, self ? u.role : role, b.student_code || null, self ? 1 : b.is_active ? 1 : 0, u.id,
    ]);
    if (b.password) await db.query('UPDATE users SET password_hash = ? WHERE id = ?', [await bcrypt.hash(b.password, 10), u.id]);
    await logActivity(req, 'update_user', 'user', u.id, `${u.username}${b.password ? ' (đặt lại mật khẩu)' : ''}`);
    flash(req, 'success', `Đã cập nhật tài khoản ${u.username}.`);
    res.redirect('/admin/users');
  } catch (e) {
    next(e);
  }
});

router.post('/users/:id/delete', async (req, res, next) => {
  try {
    const u = await db.one('SELECT * FROM users WHERE id = ?', [req.params.id]);
    if (!u || u.id === req.session.user.id) {
      flash(req, 'error', 'Không thể xóa tài khoản đang đăng nhập.');
      return res.redirect('/admin/users');
    }
    await db.query('DELETE FROM users WHERE id = ?', [u.id]);
    await logActivity(req, 'delete_user', 'user', u.id, u.username);
    flash(req, 'success', `Đã xóa tài khoản ${u.username}.`);
    res.redirect('/admin/users');
  } catch (e) {
    next(e);
  }
});

/* ---------- Nhật ký đăng nhập / thao tác ---------- */
router.get('/logs', async (req, res, next) => {
  try {
    const type = req.query.type === 'login' ? 'login' : 'activity';
    const q = String(req.query.q || '').trim();
    const from = req.query.from || '';
    const to = req.query.to || '';
    const action = req.query.action || '';
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const size = 50;
    const params = [];
    let where = '1=1';
    if (q) {
      where += ' AND username LIKE ?';
      params.push(`%${q}%`);
    }
    if (from) {
      where += ' AND created_at >= ?';
      params.push(from);
    }
    if (to) {
      where += ' AND created_at < ? + INTERVAL 1 DAY';
      params.push(to);
    }
    if (type === 'activity' && action) {
      where += ' AND action = ?';
      params.push(action);
    }
    const table = type === 'login' ? 'login_history' : 'activity_logs';
    const total = (await db.one(`SELECT COUNT(*) AS n FROM ${table} WHERE ${where}`, params)).n;
    const rows = await db.query(`SELECT * FROM ${table} WHERE ${where} ORDER BY id DESC LIMIT ? OFFSET ?`, [...params, size, (page - 1) * size]);
    res.render('admin/logs', {
      title: 'Nhật ký hệ thống', type, rows, q, from, to, action, page, pages: Math.max(1, Math.ceil(total / size)), total, ACTION_LABELS,
    });
  } catch (e) {
    next(e);
  }
});

/* ---------- Cấu hình ---------- */
router.get('/settings', async (req, res, next) => {
  try {
    const storageStatus = await getStorage().status();
    res.render('admin/settings', { title: 'Cấu hình hệ thống', s: await settings.all(), storageStatus, driver: getStorage().name });
  } catch (e) {
    next(e);
  }
});

router.post('/settings', async (req, res, next) => {
  try {
    const b = { ...req.body };
    b.allow_student_download = b.allow_student_download ? '1' : '0';
    b.maintenance_mode = b.maintenance_mode ? '1' : '0';
    b.max_upload_mb = String(Math.min(500, Math.max(1, parseInt(b.max_upload_mb, 10) || 50)));
    b.session_timeout_minutes = String(Math.min(1440, Math.max(10, parseInt(b.session_timeout_minutes, 10) || 120)));
    await settings.save(b);
    await logActivity(req, 'update_settings', 'settings', null, Object.keys(settings.DEFAULTS).filter((k) => b[k] !== undefined).join(','));
    flash(req, 'success', 'Đã lưu cấu hình.');
    res.redirect('/admin/settings');
  } catch (e) {
    next(e);
  }
});

/* ---------- Báo cáo quản trị ---------- */
function reportRange(req) {
  const today = new Date();
  const first = new Date(today.getFullYear(), today.getMonth(), 1);
  return { from: req.query.from || isoDate(first), to: req.query.to || isoDate(today) };
}

async function buildReport(from, to) {
  const range = [from, to];
  const [summary, uniqueUsers, byRole, byDay, topLectures, topCourses, byAction, topUsers, failed, inventory] = await Promise.all([
    db.one(`SELECT SUM(success=1) AS ok, SUM(success=0) AS fail FROM login_history WHERE created_at >= ? AND created_at < ? + INTERVAL 1 DAY`, range),
    db.one(`SELECT COUNT(DISTINCT user_id) AS n FROM login_history WHERE success=1 AND created_at >= ? AND created_at < ? + INTERVAL 1 DAY`, range),
    db.query(`SELECT u.role, COUNT(*) AS logins, COUNT(DISTINCT h.user_id) AS users FROM login_history h JOIN users u ON u.id = h.user_id
              WHERE h.success=1 AND h.created_at >= ? AND h.created_at < ? + INTERVAL 1 DAY GROUP BY u.role`, range),
    db.query(`SELECT DATE(created_at) AS d, COUNT(*) AS n FROM login_history WHERE success=1 AND created_at >= ? AND created_at < ? + INTERVAL 1 DAY
              GROUP BY DATE(created_at) ORDER BY d`, range),
    db.query(`SELECT a.target_id, a.detail, COUNT(*) AS views, COUNT(DISTINCT a.user_id) AS readers FROM activity_logs a
              WHERE a.action='view_lecture' AND a.created_at >= ? AND a.created_at < ? + INTERVAL 1 DAY
              GROUP BY a.target_id, a.detail ORDER BY views DESC LIMIT 10`, range),
    db.query(`SELECT a.target_id, a.detail, COUNT(*) AS views, COUNT(DISTINCT a.user_id) AS visitors FROM activity_logs a
              WHERE a.action='view_course' AND a.created_at >= ? AND a.created_at < ? + INTERVAL 1 DAY
              GROUP BY a.target_id, a.detail ORDER BY views DESC LIMIT 10`, range),
    db.query(`SELECT action, COUNT(*) AS n FROM activity_logs WHERE created_at >= ? AND created_at < ? + INTERVAL 1 DAY GROUP BY action ORDER BY n DESC`, range),
    db.query(`SELECT username, role, COUNT(*) AS n FROM activity_logs WHERE user_id IS NOT NULL AND created_at >= ? AND created_at < ? + INTERVAL 1 DAY
              GROUP BY username, role ORDER BY n DESC LIMIT 10`, range),
    db.query(`SELECT username, ip, COUNT(*) AS n, MAX(created_at) AS last FROM login_history WHERE success=0 AND created_at >= ? AND created_at < ? + INTERVAL 1 DAY
              GROUP BY username, ip ORDER BY n DESC LIMIT 10`, range),
    db.query(`SELECT c.code, c.title, c.visibility, u.full_name AS owner, COUNT(l.id) AS lectures, COALESCE(SUM(l.file_size),0) AS size, COALESCE(SUM(l.view_count),0) AS views
              FROM courses c LEFT JOIN users u ON u.id=c.owner_id LEFT JOIN lectures l ON l.course_id=c.id GROUP BY c.id ORDER BY c.code`),
  ]);
  return {
    from, to,
    logins: Number(summary.ok || 0), failedLogins: Number(summary.fail || 0), uniqueUsers: uniqueUsers.n,
    byRole, byDay, topLectures, topCourses, byAction, topUsers, failed, inventory,
  };
}

router.get('/reports', async (req, res, next) => {
  try {
    const { from, to } = reportRange(req);
    const report = await buildReport(from, to);
    if (req.query.generate) await logActivity(req, 'generate_report', 'report', null, `${from} → ${to}`);
    res.render('admin/report', { title: 'Báo cáo quản trị', report, ACTION_LABELS, ROLE_LABELS, generatedAt: new Date() });
  } catch (e) {
    next(e);
  }
});

router.get('/reports/export.xlsx', async (req, res, next) => {
  try {
    const { from, to } = reportRange(req);
    const r = await buildReport(from, to);
    const s = await settings.all();
    const wb = new ExcelJS.Workbook();
    wb.creator = s.site_name;
    const head = (ws, cols) => {
      ws.columns = cols;
      ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E40AF' } };
    };

    const ws1 = wb.addWorksheet('Tổng quan');
    head(ws1, [{ header: 'Chỉ số', key: 'k', width: 40 }, { header: 'Giá trị', key: 'v', width: 25 }]);
    ws1.addRows([
      { k: 'Đơn vị', v: s.organization },
      { k: 'Kỳ báo cáo', v: `${from} → ${to}` },
      { k: 'Lượt đăng nhập thành công', v: r.logins },
      { k: 'Lượt đăng nhập thất bại', v: r.failedLogins },
      { k: 'Số tài khoản truy cập', v: r.uniqueUsers },
      ...r.byRole.map((x) => ({ k: `Đăng nhập – ${ROLE_LABELS[x.role]}`, v: `${x.logins} lượt / ${x.users} người` })),
    ]);

    const ws2 = wb.addWorksheet('Theo ngày');
    head(ws2, [{ header: 'Ngày', key: 'd', width: 15 }, { header: 'Lượt đăng nhập', key: 'n', width: 18 }]);
    r.byDay.forEach((x) => ws2.addRow({ d: isoDate(x.d), n: x.n }));

    const ws3 = wb.addWorksheet('Bài giảng xem nhiều');
    head(ws3, [{ header: 'Bài giảng', key: 'detail', width: 60 }, { header: 'Lượt xem', key: 'views', width: 12 }, { header: 'Người đọc', key: 'readers', width: 12 }]);
    r.topLectures.forEach((x) => ws3.addRow(x));

    const ws4 = wb.addWorksheet('Thao tác');
    head(ws4, [{ header: 'Hành động', key: 'a', width: 30 }, { header: 'Số lần', key: 'n', width: 12 }]);
    r.byAction.forEach((x) => ws4.addRow({ a: ACTION_LABELS[x.action] || x.action, n: x.n }));

    const ws5 = wb.addWorksheet('Kho bài giảng');
    head(ws5, [
      { header: 'Mã', key: 'code', width: 10 }, { header: 'Học phần', key: 'title', width: 40 }, { header: 'Giảng viên', key: 'owner', width: 25 },
      { header: 'Phạm vi', key: 'vis', width: 14 }, { header: 'Số bài', key: 'lectures', width: 10 }, { header: 'Dung lượng', key: 'size', width: 14 },
      { header: 'Tổng lượt xem', key: 'views', width: 14 },
    ]);
    r.inventory.forEach((x) => ws5.addRow({ ...x, vis: x.visibility === 'all' ? 'Mọi SV' : 'Giới hạn', size: formatBytes(x.size) }));

    const ws6 = wb.addWorksheet('Đăng nhập lỗi');
    head(ws6, [{ header: 'Tài khoản', key: 'username', width: 20 }, { header: 'IP', key: 'ip', width: 20 }, { header: 'Số lần', key: 'n', width: 10 }]);
    r.failed.forEach((x) => ws6.addRow(x));

    await logActivity(req, 'export_report', 'report', null, `${from} → ${to}`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="bao-cao-quan-tri_${from}_${to}.xlsx"`);
    await wb.xlsx.write(res);
    res.end();
  } catch (e) {
    next(e);
  }
});

module.exports = router;
