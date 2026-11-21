# 📚 Website Quản lí Bài giảng

Website quản lí bài giảng cho sinh viên / học viên, viết bằng **Node.js (Express)**.

- **Bài giảng** (file PDF, Markdown, ảnh, video, Google Docs/Slides…) lưu trên **Google Drive**. Bản demo dùng thư mục `storage/` trên máy.
- **Tài khoản, phân quyền, lịch sử đăng nhập, nhật ký thao tác, cấu hình** lưu trong **MySQL**.
- **Sinh viên** chỉ được đọc. **Giảng viên** được thêm, sửa, xóa bài giảng và cấp quyền truy cập. **Admin** quản lí toàn bộ hệ thống, cấu hình và báo cáo.

---

## 1. Chạy trên máy local

| Script | Khi nào dùng | Tác dụng |
|---|---|---|
| **`setup.bat`** | Lần đầu, trên máy mới hoặc sau khi clone từ GitHub | Cài Node.js, MySQL và LibreOffice (qua winget), khởi tạo MySQL, tạo database và user, tạo `.env`, cài thư viện, tạo dữ liệu mẫu |
| **`run.bat`** | Mỗi lần muốn chạy | Khởi động MySQL và website, mở trình duyệt |

```powershell
git clone https://github.com/hoangthongphuc/website-quan-li-bai-giang.git
cd website-quan-li-bai-giang
.\setup.bat
.\run.bat
```

Website chạy tại **http://localhost:3000**.
Để dừng website: bấm `Ctrl + C`. Để dừng MySQL: chạy `.\scripts\stop-mysql.ps1`.

### Tài khoản demo

| Vai trò | Tài khoản | Mật khẩu | Ghi chú |
|---|---|---|---|
| Quản trị viên | `admin` | `admin123` | Vào thẳng Bảng quản trị |
| Giảng viên | `gv01` | `giangvien123` | Chủ của 3 học phần mẫu |
| Giảng viên | `gv02` | `giangvien123` | Chưa có học phần (dùng để thử cấp quyền "Quản lí") |
| Sinh viên | `sv01` | `sinhvien123` | Thấy 2 học phần công khai |
| Học viên cao học | `hv01` | `hocvien123` | Được cấp quyền thêm học phần giới hạn AI501 |

> ⚠️ Khi đưa vào sử dụng thật, hãy đổi hết mật khẩu demo, hoặc xóa các tài khoản này trong *Quản trị → Tài khoản*.

---

## 2. Các giao diện

| Giao diện | Đường dẫn | Ai dùng |
|---|---|---|
| Đăng nhập | `/login` | Tất cả |
| Chọn bài giảng (danh sách học phần) | `/` | Tất cả |
| Giới thiệu học phần và danh sách bài | `/courses/:id` | Tất cả (theo quyền) |
| Đọc bài giảng: mục lục, toàn màn hình, bài trước/sau | `/lectures/:id` | Tất cả (theo quyền) |
| Kho lưu trữ: quản lí học phần, bài giảng, cấp quyền | `/manage` | Giảng viên, Admin |
| Bảng quản trị | `/admin` | Admin |
| Quản lí tài khoản (thêm/sửa/khóa, nhập hàng loạt) | `/admin/users` | Admin |
| Nhật ký đăng nhập và thao tác | `/admin/logs` | Admin |
| ⚙️ **Cấu hình** (nút trên thanh menu) | `/admin/settings` | Admin |
| 📊 **Tạo báo cáo quản trị** (nút trên thanh menu): in ra PDF, xuất Excel | `/admin/reports` | Admin |

### Phân quyền
- **Học phần "Mọi sinh viên"**: mọi tài khoản đã đăng nhập đều xem được.
- **Học phần "Giới hạn"**: chỉ tài khoản được cấp quyền trong *Kho lưu trữ → học phần → Cấp quyền truy cập* mới xem được. Có thể nhập tên đăng nhập, mã SV hoặc email; nhiều tài khoản cách nhau bởi dấu phẩy.
- Quyền **"Quản lí"** cho giảng viên khác cùng dạy (sửa được học phần). Sinh viên luôn chỉ có quyền đọc.
- Người học **không bao giờ truy cập trực tiếp Google Drive**. Server đọc file rồi hiển thị, nên không lộ link Drive và không ai sửa được file gốc.
- Cho phép hoặc chặn sinh viên tải file về: *Cấu hình → "Cho phép sinh viên tải bài giảng"*.

### Xem trực tuyến mọi định dạng và bảo vệ nội dung
| Định dạng | Cách hiển thị |
|---|---|
| PDF, Word (doc/docx), PowerPoint (ppt/pptx), OpenDocument (odt/odp), RTF | Chuyển sang PDF bằng **LibreOffice**, hiển thị bằng **PDF.js** trên canvas: không có nút tải hay in |
| Excel (xls/xlsx), ODS, CSV | Hiển thị thành bảng tính HTML, chuyển được giữa các sheet |
| Ảnh, video, âm thanh, Markdown, TXT | Hiển thị trực tiếp |

- Việc chuyển đổi chạy ngay khi giảng viên tải bài lên. Kết quả được lưu cache trong `storage/.preview`, nên học viên mở là xem được ngay.
- Khi học viên **không có quyền tải**, chế độ bảo vệ được bật:
  - Link file gốc bị chặn. Link PDF xem trước cũng không mở trực tiếp được.
  - **Watermark** hiện họ tên, tài khoản, IP và thời gian của học viên trên toàn bộ trang.
  - Nội dung bị **che mờ** khi cửa sổ mất tiêu điểm (mở Snipping Tool, chuyển sang phần mềm quay), khi bấm **PrintScreen** hoặc Win+Shift+S. Clipboard bị xóa sau khi bấm PrintScreen.
  - Chặn chuột phải, bôi đen, Ctrl+C/S/P, lệnh in và F12.
  - Mọi hành vi trên được ghi vào *Nhật ký* với hành động **"⚠ Nghi chụp/sao chép"**, để admin biết ai đã cố tình làm.

> ⚠️ **Giới hạn kỹ thuật:** không website nào chặn được **100%** việc chụp hoặc quay màn hình. Đây là chức năng của hệ điều hành (phần mềm quay chạy nền, điện thoại chụp màn hình…). Các biện pháp trên ngăn phần lớn thao tác thông thường. Watermark là lớp bảo vệ cuối: ảnh hoặc video lọt ra ngoài vẫn truy được người làm lộ.

---

## 3. Cài đặt môi trường từ đầu (máy mới)

`setup.bat` tự làm tất cả các bước dưới đây. Phần này chỉ để tham khảo, hoặc dùng khi muốn cài thủ công.

1. **Node.js LTS**:
   ```powershell
   winget install OpenJS.NodeJS.LTS
   ```
2. **MySQL Server 8.4**:
   ```powershell
   winget install Oracle.MySQL
   ```
3. **Khởi tạo dữ liệu MySQL** (chỉ làm một lần). Dữ liệu nằm trong `mysql\data`:
   ```powershell
   & "C:\Program Files\MySQL\MySQL Server 8.4\bin\mysqld.exe" --defaults-file="G:\CODE-CLAUDE\WebQuanLiBaiGiang\mysql\my.ini" --initialize-insecure --console
   .\scripts\start-mysql.ps1
   & "C:\Program Files\MySQL\MySQL Server 8.4\bin\mysql.exe" -u root -h 127.0.0.1 -e "CREATE DATABASE qlbg CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci; CREATE USER 'qlbg'@'localhost' IDENTIFIED BY 'qlbg_dev_2026'; CREATE USER 'qlbg'@'127.0.0.1' IDENTIFIED BY 'qlbg_dev_2026'; GRANT ALL ON qlbg.* TO 'qlbg'@'localhost'; GRANT ALL ON qlbg.* TO 'qlbg'@'127.0.0.1';"
   ```
   File `mysql\my.ini` do `setup.ps1` tạo ra theo vị trí thư mục hiện tại.
4. **Thư viện và cấu hình**:
   ```powershell
   npm install
   copy .env.example .env      # rồi sửa SESSION_SECRET, DB_PASSWORD
   ```
5. **Chạy**: `npm start`. Lần chạy đầu, server tự tạo bảng và dữ liệu mẫu.

### Lệnh hữu ích
| Lệnh | Tác dụng |
|---|---|
| `npm start` | Chạy website |
| `npm run dev` | Chạy và tự khởi động lại khi sửa code |
| `npm run db:init` | Tạo bảng và dữ liệu mẫu (nếu CSDL đang trống) |
| `npm run gdrive:auth` | Lấy mã kết nối Google Drive |

### Xem dữ liệu MySQL
Cài **MySQL Workbench** (`winget install Oracle.MySQLWorkbench`), rồi kết nối `127.0.0.1:3306` với user `qlbg` / `qlbg_dev_2026`, database `qlbg`.

| Bảng | Nội dung |
|---|---|
| `users` | Tài khoản, vai trò, trạng thái khóa, lần đăng nhập gần nhất |
| `courses`, `lectures` | Học phần, bài giảng (lưu ID file trên Drive) |
| `course_access` | Ai được xem hoặc quản lí học phần nào |
| `login_history` | Mọi lần đăng nhập, thành công và thất bại (IP, trình duyệt, lí do) |
| `activity_logs` | Mọi thao tác: xem, tải, thêm, sửa, xóa, cấp quyền, đổi cấu hình, báo cáo… |
| `settings` | Cấu hình hệ thống |
| `sessions` | Phiên đăng nhập |

---

## 4. Kết nối Google Drive

Mỗi học phần là một **thư mục con** trong một thư mục gốc trên Drive. Mỗi bài giảng là một file trong thư mục đó.
File Google Docs, Slides và Sheets được tự chuyển sang PDF để đọc trên web.

### Bước 1: Tạo thư mục gốc trên Drive
Tạo thư mục, ví dụ `KhoBaiGiang`, rồi mở nó. URL có dạng `drive.google.com/drive/folders/`**`1AbC...xyz`**. Phần in đậm là `GDRIVE_ROOT_FOLDER_ID`.

### Bước 2: Tạo OAuth Client (dùng với Gmail cá nhân)
1. Vào https://console.cloud.google.com, tạo Project mới.
2. *APIs & Services → Library* → bật **Google Drive API**.
3. *OAuth consent screen* → chọn External → điền tên ứng dụng → thêm email của bạn vào **Test users**.
4. *Credentials → Create credentials → OAuth client ID* → loại **Desktop app** → lấy **Client ID** và **Client secret**.

### Bước 3: Điền `.env` và lấy refresh token
```
STORAGE_DRIVER=gdrive
GDRIVE_ROOT_FOLDER_ID=1AbC...xyz
GDRIVE_CLIENT_ID=xxxx.apps.googleusercontent.com
GDRIVE_CLIENT_SECRET=xxxx
```
```powershell
npm run gdrive:auth
```
Mở link hiện ra và đăng nhập tài khoản Google chứa thư mục. Token sẽ được tự ghi vào `.env`. Sau đó khởi động lại server.
Kiểm tra kết nối ở *Cấu hình → Kho lưu trữ* (hiện "Đã kết nối thư mục Drive").

> **Cách khác (Google Workspace của trường):** dùng **Service Account** và **Shared Drive**. Tải file JSON key, đặt vào `credentials/`, điền `GDRIVE_SERVICE_ACCOUNT_KEY=./credentials/key.json`, rồi thêm email service account vào Shared Drive với quyền *Content manager*.
> Lưu ý: Service Account **không** tải file lên được "My Drive" của Gmail cá nhân, vì không có dung lượng. Với Gmail cá nhân, hãy dùng OAuth như trên.

> Dữ liệu demo đang nằm ở `storage/`. Khi chuyển sang Drive, nên xóa dữ liệu demo trước (xóa các học phần mẫu trong Kho lưu trữ), sau đó tạo học phần mới để thư mục được tạo trên Drive.

---

## 5. Đáp ứng ≥ 500 lượt truy cập/tháng

500 lượt/tháng là khoảng 17 lượt/ngày, mức tải rất nhẹ. Kiến trúc hiện tại có thể chịu hàng chục nghìn lượt/tháng trên một máy chủ nhỏ (1 vCPU, 1–2 GB RAM):
- Kết nối MySQL dùng **connection pool** (`DB_POOL_SIZE`). Các bảng log có **index** theo thời gian và người dùng.
- Phiên đăng nhập lưu trong MySQL, nên khởi động lại server không làm người dùng bị đăng xuất.
- Bật **nén gzip**, file tĩnh được cache 7 ngày, file bài giảng được cache phía trình duyệt 5 phút.
- File được **stream** thẳng từ Drive, không nạp cả file vào RAM khi đọc.
- Bảo mật: mật khẩu mã hóa bcrypt, chống CSRF, giới hạn 20 lần đăng nhập/15 phút/IP, header bảo mật (helmet), lọc HTML khi hiển thị Markdown.

### Khi triển khai thật (Internet)
- Đặt `NODE_ENV=production` và đổi `SESSION_SECRET` thành chuỗi ngẫu nhiên dài.
- Đặt mật khẩu cho tài khoản root của MySQL.
- Chạy sau **Nginx/IIS + HTTPS**. Khi có HTTPS, đặt `COOKIE_SECURE=1` trong `.env`.
- Dùng **PM2** để giữ server luôn chạy: `npm i -g pm2 && pm2 start src/server.js --name qlbg`.
- Sao lưu CSDL định kỳ: `mysqldump -u qlbg -p qlbg > backup.sql`.

---

## 6. Cấu trúc mã nguồn
```
WebQuanLiBaiGiang/
├─ setup.bat / setup.ps1      # Cài đặt lần đầu
├─ run.bat / run.ps1          # Chạy website trên local
├─ .env / .env.example        # Cấu hình
├─ mysql/my.ini               # Cấu hình MySQL (dữ liệu ở mysql/data)
├─ scripts/                   # start/stop MySQL, init-db, gdrive-auth
├─ public/                    # CSS, JS giao diện
├─ storage/                   # Kho file khi chạy chế độ local (demo)
└─ src/
   ├─ server.js               # Khởi tạo Express, session, bảo mật
   ├─ config.js
   ├─ db/                     # schema.sql, kết nối MySQL, dữ liệu mẫu
   ├─ storage/                # local.js, gdrive.js (cùng một giao diện lưu trữ)
   ├─ middleware/auth.js      # Đăng nhập, phân quyền, CSRF
   ├─ services/               # Ghi log, cấu hình
   ├─ routes/                 # auth, courses (người học), manage (kho), admin
   └─ views/                  # Giao diện EJS
```
