const crypto = require('crypto');
const db = require('../db');

const ROLE_LABELS = { admin: 'Quản trị viên', lecturer: 'Giảng viên', student: 'Sinh viên' };

function requireLogin(req, res, next) {
  if (req.session.user) return next();
  req.session.returnTo = req.originalUrl;
  return res.redirect('/login');
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.session.user) return res.redirect('/login');
    if (roles.includes(req.session.user.role)) return next();
    return res.status(403).render('error', { title: 'Không có quyền', message: 'Tài khoản của bạn không có quyền truy cập trang này.' });
  };
}

/** CSRF đơn giản: token lưu trong session, kiểm tra ở mọi request POST */
function csrf(req, res, next) {
  if (!req.session.csrf) req.session.csrf = crypto.randomBytes(24).toString('hex');
  res.locals.csrfToken = req.session.csrf;
  if (req.method === 'POST') {
    const token = (req.body && req.body._csrf) || req.query._csrf || req.get('x-csrf-token');
    if (token !== req.session.csrf) {
      return res.status(403).render('error', { title: 'Phiên làm việc hết hạn', message: 'Biểu mẫu đã hết hạn, vui lòng tải lại trang và thử lại.' });
    }
  }
  next();
}

/* ---------- Quyền theo học phần ---------- */

async function getAccess(courseId, userId) {
  return db.one('SELECT permission FROM course_access WHERE course_id = ? AND user_id = ?', [courseId, userId]);
}

async function canViewCourse(user, course) {
  if (!user || !course) return false;
  if (user.role === 'admin' || user.role === 'lecturer') return true;
  if (!course.is_published) return false;
  if (course.visibility === 'all') return true;
  return !!(await getAccess(course.id, user.id));
}

async function canEditCourse(user, course) {
  if (!user || !course) return false;
  if (user.role === 'admin') return true;
  if (user.role !== 'lecturer') return false;
  if (course.owner_id === user.id) return true;
  const a = await getAccess(course.id, user.id);
  return !!(a && a.permission === 'edit');
}

module.exports = { requireLogin, requireRole, csrf, canViewCourse, canEditCourse, ROLE_LABELS };
