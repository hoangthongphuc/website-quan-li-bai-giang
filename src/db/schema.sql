-- Lược đồ CSDL MySQL cho Website Quản lí Bài giảng
-- Chạy tự động khi khởi động server (CREATE TABLE IF NOT EXISTS)

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(64) NOT NULL UNIQUE,
  password_hash VARCHAR(100) NOT NULL,
  full_name VARCHAR(150) NOT NULL,
  email VARCHAR(150) NULL,
  role ENUM('admin','lecturer','student') NOT NULL DEFAULT 'student',
  student_code VARCHAR(32) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  last_login_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_users_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS courses (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(32) NULL,
  title VARCHAR(200) NOT NULL,
  summary VARCHAR(500) NULL,
  description TEXT NULL,
  color VARCHAR(16) NOT NULL DEFAULT '#2563eb',
  visibility ENUM('all','restricted') NOT NULL DEFAULT 'all',
  is_published TINYINT(1) NOT NULL DEFAULT 1,
  storage_folder_id VARCHAR(200) NULL,
  owner_id INT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_courses_owner FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS lectures (
  id INT AUTO_INCREMENT PRIMARY KEY,
  course_id INT NOT NULL,
  title VARCHAR(200) NOT NULL,
  description TEXT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  file_id VARCHAR(300) NULL,
  file_name VARCHAR(255) NULL,
  mime_type VARCHAR(150) NULL,
  file_size BIGINT NOT NULL DEFAULT 0,
  view_count INT NOT NULL DEFAULT 0,
  created_by INT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_lectures_course (course_id, sort_order),
  CONSTRAINT fk_lectures_course FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
  CONSTRAINT fk_lectures_user FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Cấp quyền truy cập theo từng học phần: view = chỉ đọc, edit = được quản lí
CREATE TABLE IF NOT EXISTS course_access (
  course_id INT NOT NULL,
  user_id INT NOT NULL,
  permission ENUM('view','edit') NOT NULL DEFAULT 'view',
  granted_by INT NULL,
  granted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (course_id, user_id),
  CONSTRAINT fk_access_course FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
  CONSTRAINT fk_access_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Lịch sử đăng nhập (cả thành công và thất bại)
CREATE TABLE IF NOT EXISTS login_history (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NULL,
  username VARCHAR(64) NOT NULL,
  success TINYINT(1) NOT NULL,
  reason VARCHAR(100) NULL,
  ip VARCHAR(64) NULL,
  user_agent VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_login_created (created_at),
  INDEX idx_login_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Nhật ký thao tác của mọi tài khoản
CREATE TABLE IF NOT EXISTS activity_logs (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NULL,
  username VARCHAR(64) NULL,
  role VARCHAR(16) NULL,
  action VARCHAR(50) NOT NULL,
  target_type VARCHAR(30) NULL,
  target_id VARCHAR(64) NULL,
  detail VARCHAR(1000) NULL,
  ip VARCHAR(64) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_act_created (created_at),
  INDEX idx_act_action (action),
  INDEX idx_act_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Cấu hình hệ thống (key/value)
CREATE TABLE IF NOT EXISTS settings (
  setting_key VARCHAR(64) PRIMARY KEY,
  setting_value TEXT NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
