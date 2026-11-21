/**
 * Dữ liệu mẫu cho bản demo – chỉ chạy khi bảng users đang trống.
 */
const bcrypt = require('bcryptjs');
const db = require('./index');
const { getStorage } = require('../storage');

const SAMPLE_COURSES = [
  {
    code: 'IT101',
    title: 'Nhập môn Lập trình',
    summary: 'Làm quen tư duy lập trình, biến, điều kiện, vòng lặp và hàm.',
    description:
      'Học phần cung cấp kiến thức nền tảng về lập trình cho sinh viên năm nhất. Sau học phần, sinh viên có thể viết các chương trình nhỏ, hiểu cấu trúc điều khiển và tổ chức mã nguồn bằng hàm.\n\n**Hình thức đánh giá:** Chuyên cần 10% – Bài tập 30% – Thi cuối kì 60%.',
    color: '#2563eb',
    visibility: 'all',
    lectures: [
      ['Bài 1. Tổng quan về lập trình', 'Khái niệm chương trình, ngôn ngữ lập trình và môi trường phát triển.',
        '# Bài 1. Tổng quan về lập trình\n\n## 1. Chương trình là gì?\nChương trình là **tập hợp các chỉ thị** mà máy tính thực hiện để giải quyết một bài toán.\n\n## 2. Ngôn ngữ lập trình\n- Ngôn ngữ máy\n- Hợp ngữ (Assembly)\n- Ngôn ngữ bậc cao: C, Java, Python, JavaScript…\n\n## 3. Quy trình viết chương trình\n1. Phân tích bài toán\n2. Thiết kế thuật toán\n3. Viết mã\n4. Kiểm thử và sửa lỗi\n\n```js\nconsole.log("Xin chào, sinh viên!");\n```\n\n> **Câu hỏi ôn tập:** Hãy kể tên 3 ngôn ngữ lập trình bậc cao và lĩnh vực ứng dụng của chúng.\n'],
      ['Bài 2. Biến và kiểu dữ liệu', 'Biến, hằng, các kiểu dữ liệu cơ bản và phép toán.',
        '# Bài 2. Biến và kiểu dữ liệu\n\n## 1. Biến\nBiến là vùng nhớ có tên dùng để lưu giá trị.\n\n```js\nlet tuoi = 19;\nconst ten = "Nguyễn Văn A";\n```\n\n## 2. Kiểu dữ liệu cơ bản\n| Kiểu | Ví dụ |\n|---|---|\n| Số nguyên | `42` |\n| Số thực | `3.14` |\n| Chuỗi | `"Hello"` |\n| Logic | `true / false` |\n\n## 3. Bài tập\nViết chương trình tính chỉ số BMI từ chiều cao và cân nặng.\n'],
      ['Bài 3. Cấu trúc điều khiển', 'Câu lệnh if/else, switch và vòng lặp for/while.',
        '# Bài 3. Cấu trúc điều khiển\n\n## 1. Rẽ nhánh\n```js\nif (diem >= 5) {\n  console.log("Đạt");\n} else {\n  console.log("Không đạt");\n}\n```\n\n## 2. Vòng lặp\n```js\nfor (let i = 1; i <= 10; i++) {\n  console.log(i);\n}\n```\n\n## 3. Bài tập\n1. In bảng cửu chương.\n2. Kiểm tra một số có phải số nguyên tố.\n'],
    ],
  },
  {
    code: 'IT205',
    title: 'Cơ sở dữ liệu',
    summary: 'Mô hình quan hệ, SQL, thiết kế và chuẩn hóa cơ sở dữ liệu.',
    description:
      'Học phần trình bày mô hình dữ liệu quan hệ, ngôn ngữ truy vấn SQL và phương pháp thiết kế cơ sở dữ liệu. Sinh viên thực hành trên hệ quản trị **MySQL**.',
    color: '#059669',
    visibility: 'all',
    lectures: [
      ['Chương 1. Giới thiệu hệ cơ sở dữ liệu', 'Khái niệm CSDL, hệ quản trị CSDL, kiến trúc 3 mức.',
        '# Chương 1. Giới thiệu hệ cơ sở dữ liệu\n\n- **Cơ sở dữ liệu** là tập hợp dữ liệu có cấu trúc, liên quan với nhau.\n- **Hệ quản trị CSDL (DBMS)**: MySQL, PostgreSQL, SQL Server, Oracle…\n\n## Kiến trúc 3 mức ANSI/SPARC\n1. Mức ngoài (view)\n2. Mức khái niệm\n3. Mức trong (vật lí)\n'],
      ['Chương 2. Ngôn ngữ SQL', 'SELECT, INSERT, UPDATE, DELETE, JOIN và GROUP BY.',
        '# Chương 2. Ngôn ngữ SQL\n\n```sql\nSELECT ho_ten, diem\nFROM sinh_vien\nWHERE diem >= 8\nORDER BY diem DESC;\n```\n\n## JOIN\n```sql\nSELECT sv.ho_ten, l.ten_lop\nFROM sinh_vien sv\nJOIN lop l ON l.id = sv.lop_id;\n```\n'],
    ],
  },
  {
    code: 'AI501',
    title: 'Học máy nâng cao (Cao học)',
    summary: 'Học phần dành riêng cho học viên cao học – cần được cấp quyền truy cập.',
    description:
      'Học phần **giới hạn truy cập**: chỉ học viên được giảng viên cấp quyền mới xem được. Nội dung gồm học sâu, mô hình sinh và đánh giá mô hình.',
    color: '#9333ea',
    visibility: 'restricted',
    lectures: [
      ['Chủ đề 1. Mạng nơ-ron sâu', 'Kiến trúc MLP, hàm kích hoạt, lan truyền ngược.',
        '# Chủ đề 1. Mạng nơ-ron sâu\n\n## Lan truyền ngược\nCập nhật trọng số theo gradient của hàm mất mát:\n\n`w ← w − η · ∂L/∂w`\n\n## Đọc thêm\n- Goodfellow et al., *Deep Learning*, chương 6.\n'],
    ],
  },
];

async function seed() {
  const row = await db.one('SELECT COUNT(*) AS n FROM users');
  if (row.n > 0) return false;

  console.log('[seed] Tạo dữ liệu mẫu...');
  const hash = (p) => bcrypt.hashSync(p, 10);
  const users = [
    ['admin', hash('admin123'), 'Quản trị hệ thống', 'admin@example.edu.vn', 'admin', null],
    ['gv01', hash('giangvien123'), 'TS. Trần Minh Giảng', 'gv01@example.edu.vn', 'lecturer', null],
    ['gv02', hash('giangvien123'), 'ThS. Lê Thu Hà', 'gv02@example.edu.vn', 'lecturer', null],
    ['sv01', hash('sinhvien123'), 'Nguyễn Văn An', 'sv01@example.edu.vn', 'student', 'SV2026001'],
    ['sv02', hash('sinhvien123'), 'Phạm Thị Bình', 'sv02@example.edu.vn', 'student', 'SV2026002'],
    ['hv01', hash('hocvien123'), 'Hoàng Quốc Cường', 'hv01@example.edu.vn', 'student', 'HV2026001'],
  ];
  for (const u of users) {
    await db.query(
      'INSERT INTO users (username, password_hash, full_name, email, role, student_code) VALUES (?, ?, ?, ?, ?, ?)',
      u
    );
  }
  const gv01 = await db.one("SELECT id FROM users WHERE username='gv01'");
  const hv01 = await db.one("SELECT id FROM users WHERE username='hv01'");

  const storage = getStorage();
  for (const c of SAMPLE_COURSES) {
    const folderId = await storage.createFolder(`${c.code} - ${c.title}`);
    const r = await db.query(
      `INSERT INTO courses (code, title, summary, description, color, visibility, storage_folder_id, owner_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [c.code, c.title, c.summary, c.description, c.color, c.visibility, folderId, gv01.id]
    );
    let order = 1;
    for (const [title, desc, md] of c.lectures) {
      const buffer = Buffer.from(md, 'utf8');
      const name = `bai-${order}.md`;
      const f = await storage.uploadFile({ folderId, name, mimeType: 'text/markdown', buffer });
      await db.query(
        `INSERT INTO lectures (course_id, title, description, sort_order, file_id, file_name, mime_type, file_size, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [r.insertId, title, desc, order, f.id, name, 'text/markdown', f.size, gv01.id]
      );
      order++;
    }
    if (c.visibility === 'restricted') {
      await db.query('INSERT INTO course_access (course_id, user_id, permission, granted_by) VALUES (?, ?, ?, ?)', [
        r.insertId, hv01.id, 'view', gv01.id,
      ]);
    }
  }
  console.log('[seed] Xong. Tài khoản: admin/admin123, gv01/giangvien123, sv01/sinhvien123, hv01/hocvien123');
  return true;
}

module.exports = { seed };
