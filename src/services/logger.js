const db = require('../db');

function clientIp(req) {
  return (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || '';
}

/** Ghi nhật ký thao tác vào MySQL (không làm hỏng request nếu lỗi) */
async function logActivity(req, action, targetType = null, targetId = null, detail = null) {
  try {
    const u = req.session && req.session.user;
    await db.query(
      `INSERT INTO activity_logs (user_id, username, role, action, target_type, target_id, detail, ip)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        u ? u.id : null,
        u ? u.username : null,
        u ? u.role : null,
        action,
        targetType,
        targetId != null ? String(targetId) : null,
        detail ? String(detail).slice(0, 1000) : null,
        clientIp(req),
      ]
    );
  } catch (e) {
    console.error('[logActivity]', e.message);
  }
}

async function logLogin(req, { userId = null, username, success, reason = null }) {
  try {
    await db.query(
      'INSERT INTO login_history (user_id, username, success, reason, ip, user_agent) VALUES (?, ?, ?, ?, ?, ?)',
      [userId, String(username || '').slice(0, 64), success ? 1 : 0, reason, clientIp(req), String(req.headers['user-agent'] || '').slice(0, 255)]
    );
  } catch (e) {
    console.error('[logLogin]', e.message);
  }
}

// Nhãn tiếng Việt cho các hành động
const ACTION_LABELS = {
  login: 'Đăng nhập',
  logout: 'Đăng xuất',
  view_course: 'Xem học phần',
  view_lecture: 'Đọc bài giảng',
  download_lecture: 'Tải bài giảng',
  create_course: 'Tạo học phần',
  update_course: 'Sửa học phần',
  delete_course: 'Xóa học phần',
  create_lecture: 'Thêm bài giảng',
  update_lecture: 'Sửa bài giảng',
  delete_lecture: 'Xóa bài giảng',
  grant_access: 'Cấp quyền',
  revoke_access: 'Thu hồi quyền',
  create_user: 'Tạo tài khoản',
  update_user: 'Sửa tài khoản',
  delete_user: 'Xóa tài khoản',
  import_users: 'Nhập tài khoản hàng loạt',
  update_settings: 'Cập nhật cấu hình',
  generate_report: 'Tạo báo cáo',
  export_report: 'Xuất báo cáo Excel',
};

module.exports = { logActivity, logLogin, clientIp, ACTION_LABELS };
