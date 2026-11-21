// Tạo bảng + dữ liệu mẫu: npm run db:init
const db = require('../src/db');
const { seed } = require('../src/db/seed');
const { getStorage } = require('../src/storage');

(async () => {
  try {
    await db.migrate();
    await getStorage().init();
    const created = await seed();
    console.log(created ? 'Đã khởi tạo CSDL và dữ liệu mẫu.' : 'CSDL đã có dữ liệu – bỏ qua seed.');
  } catch (e) {
    console.error('Lỗi khởi tạo CSDL:', e.message);
    process.exitCode = 1;
  } finally {
    await db.pool.end();
  }
})();
