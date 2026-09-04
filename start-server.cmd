@echo off
title TeacherSwap Server
cd /d "%~dp0"
echo Starting TeacherSwap server...
call npm.cmd start
pause
