# Khởi động MySQL Server (chạy nền) dùng cấu hình mysql\my.ini của dự án
$root = Split-Path -Parent $PSScriptRoot
$bin  = "C:\Program Files\MySQL\MySQL Server 8.4\bin"
$ini  = Join-Path $root "mysql\my.ini"

if (Get-Process mysqld -ErrorAction SilentlyContinue) {
  Write-Host "MySQL dang chay roi." -ForegroundColor Yellow
  exit 0
}
Start-Process -FilePath "$bin\mysqld.exe" -ArgumentList "--defaults-file=`"$ini`"" -WindowStyle Hidden
Start-Sleep -Seconds 4
if (Get-Process mysqld -ErrorAction SilentlyContinue) {
  Write-Host "MySQL da khoi dong tai 127.0.0.1:3306" -ForegroundColor Green
} else {
  Write-Host "Khong khoi dong duoc MySQL. Xem log trong mysql\data\*.err" -ForegroundColor Red
}
