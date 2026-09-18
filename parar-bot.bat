@echo off
title Parar Bot Guincho
cd /d "%~dp0"
node src/stop.js
ping 127.0.0.1 -n 4 >nul
