@echo off
echo ========================================
echo  Unmark 项目启动脚本
echo ========================================
echo.

echo [1/3] 清理旧的Node进程...
taskkill /F /IM node.exe >nul 2>&1
timeout /t 1 >nul
echo     已清理所有旧进程
echo.

echo [2/3] 启动开发服务器...
echo     访问地址: http://localhost:3001
echo.
pnpm dev

pause
