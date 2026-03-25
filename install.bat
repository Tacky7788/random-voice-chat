@echo off
echo Random Voice Chat プラグインをインストールします...
set DEST=%APPDATA%\onecomme\plugins\random-voice-chat
if not exist "%DEST%" mkdir "%DEST%"
copy /Y "%~dp0public\plugin.js" "%DEST%\" >nul
copy /Y "%~dp0src\settings.html" "%DEST%\" >nul
echo.
echo インストール完了！
echo 場所: %DEST%
echo.
echo わんコメを再起動してください。
pause
