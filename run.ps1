# =====================================================================
#  CHAY WEBSITE TREN LOCAL: khoi dong MySQL + website, mo trinh duyet
#  Chay: nhap dup run.bat  hoac  .\run.ps1     (dung: Ctrl + C)
# =====================================================================
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
$env:Path = "C:\Program Files\nodejs;" + $env:Path
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8   # hien thi dung tieng Viet

if (-not (Test-Path "$PSScriptRoot\mysql\my.ini") -or -not (Test-Path "$PSScriptRoot\.env") -or -not (Test-Path "$PSScriptRoot\node_modules")) {
  Write-Host "May chua duoc cai dat. Hay chay setup.bat truoc." -ForegroundColor Yellow
  exit 1
}

& "$PSScriptRoot\scripts\start-mysql.ps1"

$port = 3000
$m = Select-String -Path "$PSScriptRoot\.env" -Pattern '^PORT=(\d+)' | Select-Object -First 1
if ($m) { $port = $m.Matches[0].Groups[1].Value }

# Neu cong dang bi chiem: tat server cu cua chinh du an nay (node.exe), con chuong trinh khac thi bao loi
$busy = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
foreach ($c in $busy) {
  $p = Get-Process -Id $c.OwningProcess -ErrorAction SilentlyContinue
  if ($p -and $p.ProcessName -eq 'node') {
    Write-Host "Cong $port dang bi server cu chiem (PID $($p.Id)) - dang tat de chay lai..." -ForegroundColor Yellow
    Stop-Process -Id $p.Id -Force
    Start-Sleep -Seconds 1
  } elseif ($p) {
    Write-Host "Cong $port dang bi chuong trinh '$($p.ProcessName)' (PID $($p.Id)) su dung." -ForegroundColor Red
    Write-Host "Hay tat chuong trinh do, hoac doi PORT trong file .env (vd: PORT=3001)." -ForegroundColor Red
    exit 1
  }
}

Start-Job { Start-Sleep 3; Start-Process "http://localhost:$using:port" } | Out-Null
node src/server.js
