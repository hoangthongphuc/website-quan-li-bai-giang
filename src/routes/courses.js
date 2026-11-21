/**
 * Phía người học: chọn học phần (giới thiệu) → đọc bài giảng (chỉ đọc)
 */
const express = require('express');
const db = require('../db');
const { getStorage } = require('../storage');
const { requireLogin, canViewCourse, canEditCourse } = require('../middleware/auth');
const { logActivity } = require('../services/logger');
const { renderMarkdown, viewerType } = require('../utils/helpers');

const router = express.Router();

/** Danh sách học phần mà người dùng được xem */
async function visibleCourses(user, q) {
  const params = [];
  let where = '1=1';
  if (user.role === 'student') {
    where = `c.is_published = 1 AND (c.visibility = 'all' OR EXISTS (SELECT 1 FROM course_access a WHERE a.course_id = c.id AND a.user_id = ?))`;
    params.push(user.id);
  }
  if (q) {
    where += ' AND (c.title LIKE ? OR c.code LIKE ? OR c.summary LIKE ?)';
    params.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }
  return db.query(
    `SELECT c.*, u.full_name AS owner_name,
            (SELECT COUNT(*) FROM lectures l WHERE l.course_id = c.id) AS lecture_count
     FROM courses c LEFT JOIN users u ON u.id = c.owner_id
     WHERE ${where} ORDER BY c.code, c.title`,
    params
  );
}

router.get('/', requireLogin, async (req, res, next) => {
  try {
    const q = String(req.query.q || '').trim();
    const courses = await visibleCourses(req.session.user, q);
    res.render('catalog', { title: 'Chọn bài giảng', courses, q });
  } catch (e) {
    next(e);
  }
});

router.get('/courses/:id', requireLogin, async (req, res, next) => {
  try {
    const course = await db.one(
      'SELECT c.*, u.full_name AS owner_name, u.email AS owner_email FROM courses c LEFT JOIN users u ON u.id = c.owner_id WHERE c.id = ?',
      [req.params.id]
    );
    if (!course || !(await canViewCourse(req.session.user, course))) {
      return res.status(404).render('error', { title: 'Không tìm thấy', message: 'Học phần không tồn tại hoặc bạn chưa được cấp quyền truy cập.' });
    }
    const lectures = await db.query('SELECT * FROM lectures WHERE course_id = ? ORDER BY sort_order, id', [course.id]);
    const canEdit = await canEditCourse(req.session.user, course);
    await logActivity(req, 'view_course', 'course', course.id, course.title);
    res.render('course', { title: course.title, course, lectures, canEdit, descriptionHtml: renderMarkdown(course.description) });
  } catch (e) {
    next(e);
  }
});

async function loadLecture(req, res) {
  const lecture = await db.one('SELECT * FROM lectures WHERE id = ?', [req.params.id]);
  const course = lecture && (await db.one('SELECT * FROM courses WHERE id = ?', [lecture.course_id]));
  if (!lecture || !(await canViewCourse(req.session.user, course))) {
    res.status(404).render('error', { title: 'Không tìm thấy', message: 'Bài giảng không tồn tại hoặc bạn chưa được cấp quyền.' });
    return null;
  }
  return { lecture, course };
}

router.get('/lectures/:id', requireLogin, async (req, res, next) => {
  try {
    const r = await loadLecture(req, res);
    if (!r) return;
    const { lecture, course } = r;
    const lectures = await db.query('SELECT id, title, sort_order FROM lectures WHERE course_id = ? ORDER BY sort_order, id', [course.id]);
    const idx = lectures.findIndex((l) => l.id === lecture.id);
    const type = viewerType(lecture.mime_type, lecture.file_name);
    let contentHtml = null;
    if (lecture.file_id && (type === 'markdown' || type === 'text')) {
      const text = await getStorage().readText(lecture.file_id);
      contentHtml = type === 'markdown' ? renderMarkdown(text) : null;
      if (type === 'text') lecture.text = text;
    }
    await db.query('UPDATE lectures SET view_count = view_count + 1 WHERE id = ?', [lecture.id]);
    await logActivity(req, 'view_lecture', 'lecture', lecture.id, `${course.title} › ${lecture.title}`);
    const u = req.session.user;
    const canDownload = u.role !== 'student' || res.locals.settings.allow_student_download === '1';
    res.render('lecture', {
      title: lecture.title,
      lecture,
      course,
      lectures,
      prev: lectures[idx - 1] || null,
      next: lectures[idx + 1] || null,
      type,
      contentHtml,
      canDownload,
    });
  } catch (e) {
    next(e);
  }
});

/** Trả nội dung file (server đọc từ Drive/local – người dùng không truy cập trực tiếp kho) */
router.get('/files/:id', requireLogin, async (req, res, next) => {
  try {
    const r = await loadLecture(req, res);
    if (!r) return;
    const { lecture } = r;
    if (!lecture.file_id) return res.status(404).end();
    const u = req.session.user;
    const wantDownload = req.query.download === '1';
    if (wantDownload && u.role === 'student' && res.locals.settings.allow_student_download !== '1') {
      return res.status(403).render('error', { title: 'Không được phép', message: 'Quản trị viên chưa cho phép sinh viên tải bài giảng.' });
    }
    const file = await getStorage().getFile(lecture.file_id);
    res.setHeader('Content-Type', file.mimeType || lecture.mime_type || 'application/octet-stream');
    if (file.size) res.setHeader('Content-Length', file.size);
    res.setHeader('Cache-Control', 'private, max-age=300');
    const fname = encodeURIComponent(lecture.file_name || 'bai-giang');
    res.setHeader('Content-Disposition', `${wantDownload ? 'attachment' : 'inline'}; filename*=UTF-8''${fname}`);
    if (wantDownload) await logActivity(req, 'download_lecture', 'lecture', lecture.id, lecture.title);
    file.stream.on('error', next).pipe(res);
  } catch (e) {
    next(e);
  }
});

module.exports = router;
