# =====================================================================
#  CAI DAT LAN DAU (may moi / sau khi clone tu GitHub)
#  Chay: nhap dup setup.bat  hoac  powershell -ExecutionPolicy Bypass -File setup.ps1
#  - Cai Node.js LTS + MySQL 8.4 + LibreOffice (qua winget) neu chua co
#  - Tao mysql\my.ini theo vi tri thu muc hien tai, khoi tao du lieu MySQL
#  - Tao database qlbg + user qlbg, file .env, cai thu vien npm, tao du lieu mau
# =====================================================================
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
$root     = $PSScriptRoot
$mysqlBin = "C:\Program Files\MySQL\MySQL Server 8.4\bin"
$nodeDir  = "C:\Program Files\nodejs"

function Step($m) { Write-Host "`n==> $m" -ForegroundColor Cyan }

# 1. Node.js
Step "Kiem tra Node.js"
if (-not (Test-Path "$nodeDir\node.exe")) {
  winget install --id OpenJS.NodeJS.LTS -e --silent --accept-package-agreements --accept-source-agreements
}
$env:Path = "$nodeDir;" + $env:Path
node -v

# 2. MySQL
Step "Kiem tra MySQL Server 8.4"
if (-not (Test-Path "$mysqlBin\mysqld.exe")) {
  winget install --id Oracle.MySQL -e --silent --accept-package-agreements --accept-source-agreements
}

# 2b. LibreOffice - dung de chuyen Word/PowerPoint/Excel sang ban xem truc tuyen
Step "Kiem tra LibreOffice (xem truc tiep Word/PowerPoint/Excel)"
if (-not (Test-Path "C:\Program Files\LibreOffice\program\soffice.exe")) {
  winget install --id TheDocumentFoundation.LibreOffice -e --silent --accept-package-agreements --accept-source-agreements
}

# 3. my.ini theo duong dan thu muc hien tai
Step "Tao cau hinh mysql\my.ini"
$dataDir = (Join-Path $root "mysql\data") -replace '\\', '/'
$baseDir = (Split-Path $mysqlBin -Parent) -replace '\\', '/'
New-Item -ItemType Directory -Force (Join-Path $root "mysql") | Out-Null
@"
[mysqld]
basedir="$baseDir"
datadir="$dataDir"
port=3306
bind-address=127.0.0.1
character-set-server=utf8mb4
collation-server=utf8mb4_unicode_ci
max_connections=200

[client]
port=3306
default-character-set=utf8mb4
"@ | Out-File -Encoding ascii (Join-Path $root "mysql\my.ini")

# 4. Khoi tao du lieu MySQL (chi lan dau)
if (-not (Test-Path (Join-Path $root "mysql\data\mysql"))) {
  Step "Khoi tao thu muc du lieu MySQL"
  & "$mysqlBin\mysqld.exe" --defaults-file="$root\mysql\my.ini" --initialize-insecure --console
}

# 5. Khoi dong MySQL + tao database/user
& "$root\scripts\start-mysql.ps1"
Step "Tao database qlbg va user qlbg"
$sql = "CREATE DATABASE IF NOT EXISTS qlbg CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci; " +
       "CREATE USER IF NOT EXISTS 'qlbg'@'localhost' IDENTIFIED BY 'qlbg_dev_2026'; " +
       "CREATE USER IF NOT EXISTS 'qlbg'@'127.0.0.1' IDENTIFIED BY 'qlbg_dev_2026'; " +
       "GRANT ALL ON qlbg.* TO 'qlbg'@'localhost'; GRANT ALL ON qlbg.* TO 'qlbg'@'127.0.0.1'; FLUSH PRIVILEGES;"
& "$mysqlBin\mysql.exe" -u root -h 127.0.0.1 -e $sql

# 6. File .env
if (-not (Test-Path "$root\.env")) {
  Step "Tao file .env"
  $secret = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 48 | ForEach-Object { [char]$_ })
  (Get-Content "$root\.env.example" -Raw) -replace 'SESSION_SECRET=.*', "SESSION_SECRET=$secret" |
    Out-File -Encoding ascii "$root\.env"
}

# 7. Thu vien + du lieu mau
Step "Cai thu vien npm"
npm install --no-audit --no-fund
Step "Tao bang + du lieu mau"
npm run db:init

Write-Host "`nHOAN TAT! Chay website bang: run.bat  (hoac .\run.ps1)" -ForegroundColor Green
