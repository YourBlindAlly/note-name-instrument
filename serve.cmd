@echo off
rem Local test server. The app needs http (not file://) so the browser will
rem load the samples and allow MIDI. Open http://localhost:8090 afterwards.
cd /d "%~dp0"
python -m http.server 8090
