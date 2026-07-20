@echo off
rem Video Claw Web 一键启动：新开两个窗口分别跑后端和前端
start "VideoClaw-Backend  :8000" cmd /k "cd /d E:\py pbjects\video_claw\web\backend && python -m uvicorn main:app --host 127.0.0.1 --port 8000"
start "VideoClaw-Frontend :5173" cmd /k "cd /d E:\py pbjects\video_claw\web\frontend && npm run dev"
echo.
echo 后端: http://127.0.0.1:8000/docs
echo 前端: http://localhost:5173
echo.
echo 关闭服务 = 直接关掉弹出的两个命令行窗口
pause
