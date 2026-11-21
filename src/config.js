const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const root = path.join(__dirname, '..');

module.exports = {
  root,
  port: parseInt(process.env.PORT || '3000', 10),
  env: process.env.NODE_ENV || 'development',
  sessionSecret: process.env.SESSION_SECRET || 'dev-secret-change-me',
  db: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'qlbg',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'qlbg',
    poolSize: parseInt(process.env.DB_POOL_SIZE || '10', 10),
  },
  storage: {
    driver: (process.env.STORAGE_DRIVER || 'local').toLowerCase(),
    localDir: path.resolve(root, process.env.LOCAL_STORAGE_DIR || './storage'),
    gdrive: {
      rootFolderId: process.env.GDRIVE_ROOT_FOLDER_ID || '',
      clientId: process.env.GDRIVE_CLIENT_ID || '',
      clientSecret: process.env.GDRIVE_CLIENT_SECRET || '',
      refreshToken: process.env.GDRIVE_REFRESH_TOKEN || '',
      serviceAccountKey: process.env.GDRIVE_SERVICE_ACCOUNT_KEY
        ? path.resolve(root, process.env.GDRIVE_SERVICE_ACCOUNT_KEY)
        : '',
    },
  },
};
