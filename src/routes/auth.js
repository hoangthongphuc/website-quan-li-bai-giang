const express = require('express');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const db = require('../db');
const { logActivity, logLogin } = require('../services/logger');

const router = express.Router();

// Chống dò mật khẩu: tối đa 20 lần thử / 15 phút / IP
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) =>
    res.status(429).render('login', { title: 'Đăng nhập', error: 'Bạn thử đăng nhập quá nhiều lần. Vui lòng đợi 15 phút.', username: '' }),
});

router.get('/login', (req, res) => {
  if (req.session.user) return res.redirect('/');
  res.render('login', { title: 'Đăng nhập', error: null, username: '' });
});

router.post('/login', loginLimiter, async (req, res, next) => {
  try {
    const username = String(req.body.username || '').trim();
    const password = String(req.body.password || '');
    const fail = async (reason, userId = null) => {
      await logLogin(req, { userId, username, success: false, reason });
      res.status(401).render('login', { title: 'Đăng nhập', error: 'Tên đăng nhập hoặc mật khẩu không đúng.', username });
    };
    if (!username || !password) return fail('missing_fields');

    const user = await db.one('SELECT * FROM users WHERE username = ?', [username]);
    if (!user) return fail('user_not_found');
    if (!(await bcrypt.compare(password, user.password_hash))) return fail('wrong_password', user.id);
    if (!user.is_active) {
      await logLogin(req, { userId: user.id, username, success: false, reason: 'account_locked' });
      return res.status(403).render('login', { title: 'Đăng nhập', error: 'Tài khoản đã bị khóa. Liên hệ quản trị viên.', username });
    }

    const returnTo = req.session.returnTo || '/';
    req.session.regenerate(async (err) => {
      if (err) return next(err);
      req.session.user = { id: user.id, username: user.username, full_name: user.full_name, role: user.role };
      await db.query('UPDATE users SET last_login_at = NOW() WHERE id = ?', [user.id]);
      await logLogin(req, { userId: user.id, username, success: true });
      await logActivity(req, 'login', 'user', user.id);
      const dest = user.role === 'admin' && returnTo === '/' ? '/admin' : returnTo;
      req.session.save(() => res.redirect(dest));
    });
  } catch (e) {
    next(e);
  }
});

router.post('/logout', async (req, res) => {
  if (req.session.user) await logActivity(req, 'logout', 'user', req.session.user.id);
  req.session.destroy(() => {
    res.clearCookie('qlbg.sid');
    res.redirect('/login');
  });
});

module.exports = router;
