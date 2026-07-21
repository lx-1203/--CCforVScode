@echo off
REM ═══════════════════════════════════════════════════════════
REM 星迹的CC 构建脚本 - 打包 + 安装到 VS Code 扩展目录
REM 用法: build.bat
REM ═══════════════════════════════════════════════════════════
setlocal

set EXT_DIR=%~dp0extension
set VSIX_NAME=xingjiclaudecode-2.1.95
set INSTALL_DIR=%USERPROFILE%\.vscode\extensions\xingji.xingjiclaudecode-2.1.95

echo [1/4] Syntax check...
node -c "%EXT_DIR%\extension.js"
if errorlevel 1 (echo ERROR: extension.js syntax failed & exit /b 1)
node -c "%EXT_DIR%\webview\index.js"
if errorlevel 1 (echo ERROR: webview/index.js syntax failed & exit /b 1)
echo   OK

echo [2/4] Packaging VSIX...
cd /d "%EXT_DIR%"
call npx @vscode/vsce package --allow-missing-repository 2>nul
if errorlevel 1 (echo ERROR: vsce package failed & exit /b 1)
echo   OK: %VSIX_NAME%.vsix

echo [3/4] Installing to VS Code extensions...
REM Try code CLI first (proper VSIX registration, suppresses marketplace warning)
where code >nul 2>&1
if %errorlevel% equ 0 (
    echo   Using code --install-extension...
    code --install-extension "%EXT_DIR%\%VSIX_NAME%.vsix" --force
    if %errorlevel% equ 0 (
        echo   OK
        goto :install_done
    )
    echo   code CLI failed, falling back to manual install...
)
REM Manual fallback
if not exist "%INSTALL_DIR%" mkdir "%INSTALL_DIR%"
powershell -Command "Expand-Archive -Path '%EXT_DIR%\%VSIX_NAME%.vsix' -DestinationPath '%TEMP%\xingji-build' -Force"
copy /Y "%TEMP%\xingji-build\extension\extension.js" "%INSTALL_DIR%\" >nul
copy /Y "%TEMP%\xingji-build\extension\webview\index.js" "%INSTALL_DIR%\webview\" >nul
copy /Y "%TEMP%\xingji-build\extension\package.json" "%INSTALL_DIR%\" >nul
rd /s /q "%TEMP%\xingji-build" 2>nul
echo   OK (manual)
:install_done

echo [4/4] Verify installed components...
findstr /c:"XJ_EdgeTTS" "%INSTALL_DIR%\extension.js" >nul && echo   [OK] Edge TTS engine
findstr /c:"synthesizeGemini" "%INSTALL_DIR%\extension.js" >nul && echo   [OK] Gemini provider
findstr /c:"synthesizeQwen" "%INSTALL_DIR%\extension.js" >nul && echo   [OK] Qwen provider
findstr /c:"synthesizeMiMo" "%INSTALL_DIR%\extension.js" >nul && echo   [OK] MiMo provider
findstr /c:"XingjiVoiceBridge" "%INSTALL_DIR%\extension.js" >nul && echo   [OK] VoiceBridge server
findstr /c:"xingji-settings-btn" "%INSTALL_DIR%\webview\index.js" >nul && echo   [OK] Settings button
findstr /c:"__xingjiVscodeShim" "%INSTALL_DIR%\webview\index.js" >nul && echo   [OK] VSCode API shim
findstr /c:"CodeKey Bridge Manager" "%INSTALL_DIR%\extension.js" >nul && echo   [OK] CodeKey Bridge Manager
findstr /c:"xj-codekey-card" "%INSTALL_DIR%\webview\index.js" >nul && echo   [OK] CodeKey webview UI
findstr /c:"xj-codekey" "%INSTALL_DIR%\webview\index.css" >nul && echo   [OK] CodeKey CSS styles
findstr /c:"codekey_pair" "%INSTALL_DIR%\extension.js" >nul && echo   [OK] CodeKey N5 route
if exist "%INSTALL_DIR%\codekey\hooks\codekey_hook_permission.js" (echo   [OK] CodeKey hook scripts) else (echo   [WARN] CodeKey hooks missing)
if exist "%INSTALL_DIR%\codekey\node_modules\ws\index.js" (echo   [OK] CodeKey ws module) else (echo   [WARN] CodeKey ws missing)

echo.
echo ═══ Build complete! Restart VS Code to activate. ═══
endlocal
