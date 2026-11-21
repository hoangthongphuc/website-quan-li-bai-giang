# Dừng MySQL Server an toàn (root local không mật khẩu, chỉ nghe 127.0.0.1)
$bin = "C:\Program Files\MySQL\MySQL Server 8.4\bin"
& "$bin\mysqladmin.exe" -u root -h 127.0.0.1 shutdown
Write-Host "Da gui lenh dung MySQL."
