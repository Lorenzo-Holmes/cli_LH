@echo off
chcp 65001 >nul
:: ============================================================
:: cli_LH one-click startup
:: ============================================================
cd /d "%~dp0"

if exist ".\bin\cliproxy-switch.exe" (
	".\bin\cliproxy-switch.exe" start --auto
) else (
	echo [!] Missing .\bin\cliproxy-switch.exe
	echo [!] Build it with: go build -o bin\cliproxy-switch.exe .\cmd\cliproxy-switch
)

pause
