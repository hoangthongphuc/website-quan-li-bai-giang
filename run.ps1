# =====================================================================
#  CHAY WEBSITE TREN LOCAL: khoi dong MySQL + website, mo trinh duyet
#  Chay: nhap dup run.bat  hoac  .\run.ps1     (dung: Ctrl + C)
# =====================================================================
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
$env:Path = "C:\Program Files\nodejs;" + $env:Path

if (-not (Test-Path "$PSScriptRoot\mysql\my.ini") -or -not (Test-Path "$PSScriptRoot\.env") -or -not (Test-Path "$PSScriptRoot\node_modules")) {
  Write-Host "May chua duoc cai dat. Hay chay setup.bat truoc." -ForegroundColor Yellow
  exit 1
}

& "$PSScriptRoot\scripts\start-mysql.ps1"

$port = 3000
$m = Select-String -Path "$PSScriptRoot\.env" -Pattern '^PORT=(\d+)' | Select-Object -First 1
if ($m) { $port = $m.Matches[0].Groups[1].Value }

Start-Job { Start-Sleep 3; Start-Process "http://localhost:$using:port" } | Out-Null
node src/server.js
