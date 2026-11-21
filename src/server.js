const path = require('path');
const express = require('express');
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');

const config = require('./config');
const db = require('./db');
const { seed } = require('./db/seed');
const { getStorage } = require('./storage');
const settings = require('./services/settings');
const { csrf, ROLE_LABELS } = require('./middleware/auth');
const helpers = require('./utils/helpers');

async function main() {
  await db.migrate();
  const storage = getStorage();
  await storage.init();
  await seed();
  const s = await settings.all();

  const app = express();
  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, 'views'));
  app.set('trust proxy', 1);

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          'default-src': ["'self'"],
          'img-src': ["'self'", 'data:'],
          'style-src': ["'self'", "'unsafe-inline'"],
          'frame-src': ["'self'"],
          'object-src': ["'none'"],
        },
      },
    })
  );
  app.use(compression());
  app.use(morgan(config.env === 'production' ? 'combined' : 'dev'));
  app.get('/favicon.ico', (req, res) => res.status(204).end());
  app.use('/static',express.static(path.join(__dirname, '..', 'public'), { maxAge: '7d' }));
  app.use(express.urlencoded({ extended: true, limit: '2mb' }));

  // Session lưu trong MySQL → khởi động lại server không mất phiên đăng nhập
  const store = new MySQLStore({ clearExpired: true, checkExpirationInterval: 15 * 60 * 1000, createDatabaseTable: true }, db.pool);
  app.use(
    session({
      name: 'qlbg.sid',
      secret: config.sessionSecret,
      store,
      resave: false,
      saveUninitialized: false,
      rolling: true,
      cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: config.env === 'production' && process.env.COOKIE_SECURE === '1',
        maxAge: parseInt(s.session_timeout_minutes || '120', 10) * 60 * 1000,
      },
    })
  );

  // Biến dùng chung cho mọi view
  app.use(async (req, res, next) => {
    try {
      res.locals.settings = await settings.all();
      res.locals.currentUser = req.session.user || null;
      res.locals.ROLE_LABELS = ROLE_LABELS;
      res.locals.storageLabel = storage.label;
      res.locals.path = req.path;
      res.locals.h = helpers;
      res.locals.flash = req.session.flash || null;
      delete req.session.flash;
      next();
    } catch (e) {
      next(e);
    }
  });

  // Chế độ bảo trì: chỉ admin dùng được
  app.use((req, res, next) => {
    const u = req.session.user;
    if (res.locals.settings.maintenance_mode === '1' && u && u.role !== 'admin' && !req.path.startsWith('/logout')) {
      return res.status(503).render('error', { title: 'Đang bảo trì', message: 'Hệ thống đang bảo trì, vui lòng quay lại sau.' });
    }
    next();
  });

  app.use(csrf);

  app.use(require('./routes/auth'));
  app.use(require('./routes/courses'));
  app.use('/manage', require('./routes/manage'));
  app.use('/admin', require('./routes/admin'));

  app.use((req, res) => res.status(404).render('error', { title: 'Không tìm thấy', message: 'Trang bạn tìm không tồn tại.' }));
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    console.error(err);
    const msg = err.code === 'LIMIT_FILE_SIZE' ? 'File vượt quá dung lượng cho phép.' : 'Đã xảy ra lỗi: ' + err.message;
    res.status(err.status || 500).render('error', { title: 'Lỗi', message: msg });
  });

  app.listen(config.port, () => {
    console.log(`\n  Website Quản lí Bài giảng đang chạy: http://localhost:${config.port}`);
    console.log(`  Lưu trữ: ${storage.label} | MySQL: ${config.db.host}:${config.db.port}/${config.db.database}\n`);
  });
}

main().catch((e) => {
  console.error('Không khởi động được server:', e.message);
  if (e.code === 'ECONNREFUSED') console.error('→ MySQL chưa chạy. Hãy chạy: .\\scripts\\start-mysql.ps1');
  process.exit(1);
});
