# PowerShell script to clean up Node processes and restart
Write-Host "========================================" -ForegroundColor Cyan
Write-Host " Unmark 项目重启脚本" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "[1/3] 清理旧的Node进程..." -ForegroundColor Yellow
$nodeProcesses = Get-Process -Name node -ErrorAction SilentlyContinue
if ($nodeProcesses) {
    $nodeProcesses | ForEach-Object {
        Write-Host "     终止进程 PID: $($_.Id)" -ForegroundColor Gray
        Stop-Process -Id $_.Id -Force
    }
    Write-Host "     已清理 $($nodeProcesses.Count) 个进程" -ForegroundColor Green
} else {
    Write-Host "     没有发现运行中的Node进程" -ForegroundColor Gray
}
Write-Host ""

Start-Sleep -Seconds 2

Write-Host "[2/3] 检查端口状态..." -ForegroundColor Yellow
$ports = @(3000, 3001, 3002, 3003, 3004)
$occupied = $false
foreach ($port in $ports) {
    $connection = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
    if ($connection) {
        Write-Host "     端口 $port 仍被占用" -ForegroundColor Red
        $occupied = $true
    }
}

if ($occupied) {
    Write-Host ""
    Write-Host "⚠️  部分端口仍被占用，可能需要手动重启" -ForegroundColor Yellow
} else {
    Write-Host "     所有端口已释放" -ForegroundColor Green
}
Write-Host ""

Write-Host "[3/3] 启动开发服务器..." -ForegroundColor Yellow
Write-Host "     访问地址: http://localhost:3000" -ForegroundColor Cyan
Write-Host ""

pnpm dev
