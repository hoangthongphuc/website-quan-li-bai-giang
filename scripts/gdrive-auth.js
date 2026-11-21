/**
 * Lấy GDRIVE_REFRESH_TOKEN cho tài khoản Google sở hữu kho bài giảng.
 * Yêu cầu: đã điền GDRIVE_CLIENT_ID và GDRIVE_CLIENT_SECRET trong .env
 * (OAuth Client loại "Desktop app" tạo trong Google Cloud Console).
 * Chạy: npm run gdrive:auth  → mở link → đăng nhập Google → token được ghi vào .env
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const { google } = require('googleapis');
const config = require('../src/config');

const PORT = 5678;
const REDIRECT = `http://127.0.0.1:${PORT}/oauth2callback`;
const { clientId, clientSecret } = config.storage.gdrive;

if (!clientId || !clientSecret) {
  console.error('Chưa có GDRIVE_CLIENT_ID / GDRIVE_CLIENT_SECRET trong .env. Xem README mục "Kết nối Google Drive".');
  process.exit(1);
}

const oauth2 = new google.auth.OAuth2(clientId, clientSecret, REDIRECT);
const url = oauth2.generateAuthUrl({ access_type: 'offline', prompt: 'consent', scope: ['https://www.googleapis.com/auth/drive'] });

const server = http.createServer(async (req, res) => {
  if (!req.url.startsWith('/oauth2callback')) return res.end();
  const code = new URL(req.url, REDIRECT).searchParams.get('code');
  try {
    const { tokens } = await oauth2.getToken(code);
    if (!tokens.refresh_token) throw new Error('Google không trả về refresh token. Hãy thu hồi quyền ứng dụng tại myaccount.google.com/permissions rồi chạy lại.');
    const envPath = path.join(config.root, '.env');
    let env = fs.readFileSync(envPath, 'utf8');
    env = /^GDRIVE_REFRESH_TOKEN=.*$/m.test(env)
      ? env.replace(/^GDRIVE_REFRESH_TOKEN=.*$/m, `GDRIVE_REFRESH_TOKEN=${tokens.refresh_token}`)
      : env + `\nGDRIVE_REFRESH_TOKEN=${tokens.refresh_token}\n`;
    fs.writeFileSync(envPath, env);
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end('<h2>✅ Đã kết nối Google Drive. Bạn có thể đóng tab này.</h2>');
    console.log('\n✅ Đã lưu GDRIVE_REFRESH_TOKEN vào .env. Đặt STORAGE_DRIVER=gdrive rồi khởi động lại server.');
  } catch (e) {
    res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end('Lỗi: ' + e.message);
    console.error('Lỗi:', e.message);
  } finally {
    server.close();
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log('\nMở đường dẫn sau trong trình duyệt và đăng nhập tài khoản Google chứa kho bài giảng:\n');
  console.log(url + '\n');
});
