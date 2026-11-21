/**
 * Quản lí kho bài giảng (giảng viên + admin):
 * thêm / sửa / xóa học phần, bài giảng và cấp quyền truy cập.
 */
const express = require('express');
const multer = require('multer');
const db = require('../db');
const { getStorage } = require('../storage');
const { requireRole, canEditCourse } = require('../middleware/auth');
const { logActivity } = require('../services/logger');
const settings = require('../services/settings');

const router = express.Router();
router.use(requireRole('admin', 'lecturer'));

function flash(req, type, msg) {
  req.session.flash = { type, msg };
}

/** Multer giới hạn dung lượng theo cấu hình */
async function uploadSingle(req, res) {
  const s = await settings.all();
  const limit = parseInt(s.max_upload_mb || '50', 10) * 1024 * 1024;
  const up = multer({ storage: multer.memoryStorage(), limits: { fileSize: limit } }).single('file');
  return new Promise((resolve, reject) => up(req, res, (err) => (err ? reject(err) : resolve())));
}

// Tên file từ multer bị mã hóa latin1 → đổi về UTF-8 cho tiếng Việt
function fixName(name) {
  return Buffer.from(name, 'latin1').toString('utf8');
}

async function loadEditable(req, res, courseId) {
  const course = await db.one('SELECT * FROM courses WHERE id = ?', [courseId]);
  if (!course || !(await canEditCourse(req.session.user, course))) {
    res.status(403).render('error', { title: 'Không có quyền', message: 'Bạn không có quyền quản lí học phần này.' });
    return null;
  }
  return course;
}

/* ---------- Kho lưu trữ ---------- */
router.get('/', async (req, res, next) => {
  try {
    const u = req.session.user;
    const q = String(req.query.q || '').trim();
    const params = [];
    let where = '1=1';
    if (u.role !== 'admin') {
      where = `(c.owner_id = ? OR EXISTS (SELECT 1 FROM course_access a WHERE a.course_id = c.id AND a.user_id = ? AND a.permission = 'edit'))`;
      params.push(u.id, u.id);
    }
    if (q) {
      where += ' AND (c.title LIKE ? OR c.code LIKE ?)';
      params.push(`%${q}%`, `%${q}%`);
    }
    const courses = await db.query(
      `SELECT c.*, u.full_name AS owner_name,
              COUNT(l.id) AS lecture_count, COALESCE(SUM(l.file_size),0) AS total_size, COALESCE(SUM(l.view_count),0) AS total_views
       FROM courses c LEFT JOIN users u ON u.id = c.owner_id LEFT JOIN lectures l ON l.course_id = c.id
       WHERE ${where} GROUP BY c.id ORDER BY c.updated_at DESC`,
      params
    );
    const totals = courses.reduce(
      (t, c) => ({ lectures: t.lectures + Number(c.lecture_count), size: t.size + Number(c.total_size), views: t.views + Number(c.total_views) }),
      { lectures: 0, size: 0, views: 0 }
    );
    const st = await getStorage().status();
    res.render('manage/index', { title: 'Kho lưu trữ bài giảng', courses, totals, q, storageStatus: st });
  } catch (e) {
    next(e);
  }
});

/* ---------- Học phần ---------- */
router.get('/courses/new', (req, res) => {
  res.render('manage/course-form', { title: 'Tạo học phần mới', course: { color: '#2563eb', visibility: 'all', is_published: 1 } });
});

router.post('/courses', async (req, res, next) => {
  try {
    const b = req.body;
    if (!b.title) {
      flash(req, 'error', 'Vui lòng nhập tên học phần.');
      return res.redirect('/manage/courses/new');
    }
    const folderId = await getStorage().createFolder(`${b.code || ''} - ${b.title}`.trim());
    const r = await db.query(
      `INSERT INTO courses (code, title, summary, description, color, visibility, is_published, storage_folder_id, owner_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [b.code || null, b.title, b.summary || null, b.description || null, b.color || '#2563eb',
        b.visibility === 'restricted' ? 'restricted' : 'all', b.is_published ? 1 : 0, folderId, req.session.user.id]
    );
    await logActivity(req, 'create_course', 'course', r.insertId, b.title);
    flash(req, 'success', 'Đã tạo học phần. Hãy thêm bài giảng.');
    res.redirect(`/manage/courses/${r.insertId}`);
  } catch (e) {
    next(e);
  }
});

router.get('/courses/:id', async (req, res, next) => {
  try {
    const course = await loadEditable(req, res, req.params.id);
    if (!course) return;
    const lectures = await db.query('SELECT * FROM lectures WHERE course_id = ? ORDER BY sort_order, id', [course.id]);
    const access = await db.query(
      `SELECT a.*, u.username, u.full_name, u.role, u.student_code FROM course_access a JOIN users u ON u.id = a.user_id
       WHERE a.course_id = ? ORDER BY u.role, u.username`,
      [course.id]
    );
    const owner = await db.one('SELECT full_name FROM users WHERE id = ?', [course.owner_id]);
    res.render('manage/course', { title: `Quản lí: ${course.title}`, course, lectures, access, owner });
  } catch (e) {
    next(e);
  }
});

router.get('/courses/:id/edit', async (req, res, next) => {
  try {
    const course = await loadEditable(req, res, req.params.id);
    if (!course) return;
    res.render('manage/course-form', { title: 'Sửa học phần', course });
  } catch (e) {
    next(e);
  }
});

router.post('/courses/:id', async (req, res, next) => {
  try {
    const course = await loadEditable(req, res, req.params.id);
    if (!course) return;
    const b = req.body;
    await db.query(
      'UPDATE courses SET code=?, title=?, summary=?, description=?, color=?, visibility=?, is_published=? WHERE id=?',
      [b.code || null, b.title || course.title, b.summary || null, b.description || null, b.color || course.color,
        b.visibility === 'restricted' ? 'restricted' : 'all', b.is_published ? 1 : 0, course.id]
    );
    if (b.title && b.title !== course.title && course.storage_folder_id) {
      await getStorage().renameFolder(course.storage_folder_id, `${b.code || ''} - ${b.title}`.trim()).catch(() => {});
    }
    await logActivity(req, 'update_course', 'course', course.id, b.title);
    flash(req, 'success', 'Đã lưu thay đổi học phần.');
    res.redirect(`/manage/courses/${course.id}`);
  } catch (e) {
    next(e);
  }
});

router.post('/courses/:id/delete', async (req, res, next) => {
  try {
    const course = await loadEditable(req, res, req.params.id);
    if (!course) return;
    if (course.storage_folder_id) await getStorage().deleteFolder(course.storage_folder_id).catch((e) => console.error(e.message));
    await db.query('DELETE FROM courses WHERE id = ?', [course.id]);
    await logActivity(req, 'delete_course', 'course', course.id, course.title);
    flash(req, 'success', `Đã xóa học phần "${course.title}".`);
    res.redirect('/manage');
  } catch (e) {
    next(e);
  }
});

/* ---------- Bài giảng ---------- */
router.post('/courses/:id/lectures', async (req, res, next) => {
  try {
    await uploadSingle(req, res);
    const course = await loadEditable(req, res, req.params.id);
    if (!course) return;
    const b = req.body;
    if (!b.title) {
      flash(req, 'error', 'Vui lòng nhập tiêu đề bài giảng.');
      return res.redirect(`/manage/courses/${course.id}`);
    }
    let f = null;
    let fileName = null;
    let mime = null;
    if (req.file) {
      fileName = fixName(req.file.originalname);
      mime = req.file.mimetype;
      if (/\.md$/i.test(fileName)) mime = 'text/markdown';
      f = await getStorage().uploadFile({ folderId: course.storage_folder_id, name: fileName, mimeType: mime, buffer: req.file.buffer });
    } else if (b.content) {
      // Soạn trực tiếp bằng Markdown
      fileName = `${b.title.replace(/[^\p{L}\p{N}]+/gu, '-').slice(0, 60)}.md`;
      mime = 'text/markdown';
      f = await getStorage().uploadFile({ folderId: course.storage_folder_id, name: fileName, mimeType: mime, buffer: Buffer.from(b.content, 'utf8') });
    }
    const max = await db.one('SELECT COALESCE(MAX(sort_order),0) AS m FROM lectures WHERE course_id = ?', [course.id]);
    const r = await db.query(
      `INSERT INTO lectures (course_id, title, description, sort_order, file_id, file_name, mime_type, file_size, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [course.id, b.title, b.description || null, parseInt(b.sort_order, 10) || max.m + 1, f ? f.id : null, fileName, mime, f ? f.size : 0, req.session.user.id]
    );
    await logActivity(req, 'create_lecture', 'lecture', r.insertId, `${course.title} › ${b.title}`);
    flash(req, 'success', 'Đã thêm bài giảng.');
    res.redirect(`/manage/courses/${course.id}`);
  } catch (e) {
    next(e);
  }
});

async function loadLectureEditable(req, res) {
  const lecture = await db.one('SELECT * FROM lectures WHERE id = ?', [req.params.id]);
  if (!lecture) {
    res.status(404).render('error', { title: 'Không tìm thấy', message: 'Bài giảng không tồn tại.' });
    return null;
  }
  const course = await loadEditable(req, res, lecture.course_id);
  return course ? { lecture, course } : null;
}

router.get('/lectures/:id', async (req, res, next) => {
  try {
    const r = await loadLectureEditable(req, res);
    if (!r) return;
    let content = '';
    if (r.lecture.mime_type === 'text/markdown' && r.lecture.file_id) content = await getStorage().readText(r.lecture.file_id);
    res.render('manage/lecture-form', { title: 'Sửa bài giảng', ...r, content });
  } catch (e) {
    next(e);
  }
});

router.post('/lectures/:id', async (req, res, next) => {
  try {
    await uploadSingle(req, res);
    const r = await loadLectureEditable(req, res);
    if (!r) return;
    const { lecture, course } = r;
    const b = req.body;
    const st = getStorage();
    let { file_id, file_name, mime_type, file_size } = lecture;
    let newFile = null;
    if (req.file) {
      file_name = fixName(req.file.originalname);
      mime_type = /\.md$/i.test(file_name) ? 'text/markdown' : req.file.mimetype;
      newFile = await st.uploadFile({ folderId: course.storage_folder_id, name: file_name, mimeType: mime_type, buffer: req.file.buffer });
    } else if (b.content !== undefined && mime_type === 'text/markdown') {
      newFile = await st.uploadFile({ folderId: course.storage_folder_id, name: file_name, mimeType: mime_type, buffer: Buffer.from(b.content, 'utf8') });
    }
    if (newFile) {
      if (file_id) await st.deleteFile(file_id).catch(() => {});
      file_id = newFile.id;
      file_size = newFile.size;
    }
    await db.query(
      'UPDATE lectures SET title=?, description=?, sort_order=?, file_id=?, file_name=?, mime_type=?, file_size=? WHERE id=?',
      [b.title || lecture.title, b.description || null, parseInt(b.sort_order, 10) || lecture.sort_order, file_id, file_name, mime_type, file_size, lecture.id]
    );
    await logActivity(req, 'update_lecture', 'lecture', lecture.id, `${course.title} › ${b.title || lecture.title}`);
    flash(req, 'success', 'Đã cập nhật bài giảng.');
    res.redirect(`/manage/courses/${course.id}`);
  } catch (e) {
    next(e);
  }
});

router.post('/lectures/:id/delete', async (req, res, next) => {
  try {
    const r = await loadLectureEditable(req, res);
    if (!r) return;
    if (r.lecture.file_id) await getStorage().deleteFile(r.lecture.file_id).catch(() => {});
    await db.query('DELETE FROM lectures WHERE id = ?', [r.lecture.id]);
    await logActivity(req, 'delete_lecture', 'lecture', r.lecture.id, `${r.course.title} › ${r.lecture.title}`);
    flash(req, 'success', 'Đã xóa bài giảng.');
    res.redirect(`/manage/courses/${r.course.id}`);
  } catch (e) {
    next(e);
  }
});

/* ---------- Cấp quyền truy cập ---------- */
router.post('/courses/:id/access', async (req, res, next) => {
  try {
    const course = await loadEditable(req, res, req.params.id);
    if (!course) return;
    const permission = req.body.permission === 'edit' ? 'edit' : 'view';
    const names = String(req.body.usernames || '').split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean);
    const added = [];
    const missing = [];
    for (const n of names) {
      const u = await db.one('SELECT id, role FROM users WHERE username = ? OR student_code = ? OR email = ?', [n, n, n]);
      if (!u) {
        missing.push(n);
        continue;
      }
      const perm = permission === 'edit' && u.role === 'student' ? 'view' : permission; // sinh viên chỉ được đọc
      await db.query(
        'INSERT INTO course_access (course_id, user_id, permission, granted_by) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE permission = VALUES(permission), granted_by = VALUES(granted_by)',
        [course.id, u.id, perm, req.session.user.id]
      );
      added.push(n);
    }
    if (added.length) await logActivity(req, 'grant_access', 'course', course.id, `${permission}: ${added.join(', ')}`);
    flash(req, missing.length ? 'error' : 'success',
      `Đã cấp quyền cho ${added.length} tài khoản.` + (missing.length ? ` Không tìm thấy: ${missing.join(', ')}` : ''));
    res.redirect(`/manage/courses/${course.id}#access`);
  } catch (e) {
    next(e);
  }
});

router.post('/courses/:id/access/:userId/delete', async (req, res, next) => {
  try {
    const course = await loadEditable(req, res, req.params.id);
    if (!course) return;
    await db.query('DELETE FROM course_access WHERE course_id = ? AND user_id = ?', [course.id, req.params.userId]);
    await logActivity(req, 'revoke_access', 'course', course.id, `user_id=${req.params.userId}`);
    flash(req, 'success', 'Đã thu hồi quyền truy cập.');
    res.redirect(`/manage/courses/${course.id}#access`);
  } catch (e) {
    next(e);
  }
});

module.exports = router;
