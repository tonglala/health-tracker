@echo off
REM 版本更新輔助腳本
REM 使用方式: 執行此檔案會自動在瀏覽器中開啟網站並強制重新整理

echo 正在開啟健康管理網站...
echo.
echo 請在瀏覽器中按 Ctrl+Shift+R 強制重新整理
echo 或按 Ctrl+F5 清除快取並重新載入
echo.

start http://localhost:8000/index.html

echo.
echo 提示: 如果樣式還是沒變,請檢查 index.html 中的版本號是否已更新
pause
