# ============================================================
# cli_LH 环境检测脚本
# 用法：.\check.ps1
# 检查：代理 / 配置文件 / 服务端口 / DeepSeek / Codex 是否正常
# ============================================================

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "           cli_LH 环境检测" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

$allOk = $true

# ---- 1. 代理检测 ----
Write-Host ">>> 代理检测 (127.0.0.1:10808)" -ForegroundColor Yellow
try {
    $r = Test-NetConnection -ComputerName "127.0.0.1" -Port 10808 -WarningAction SilentlyContinue -ErrorAction SilentlyContinue
    if ($r.TcpTestSucceeded) {
        Write-Host "    [+] 代理在线" -ForegroundColor Green
    } else {
        Write-Host "    [-] 代理离线" -ForegroundColor Red
        $allOk = $false
    }
} catch {
    Write-Host "    [-] 代理离线" -ForegroundColor Red
    $allOk = $false
}

# ---- 2. 配置文件检测 ----
Write-Host ""
Write-Host ">>> 配置文件检测 (config.yaml)" -ForegroundColor Yellow
if (Test-Path ".\config.yaml") {
    Write-Host "    [+] 配置文件存在" -ForegroundColor Green
} else {
    Write-Host "    [-] 配置文件不存在！" -ForegroundColor Red
    $allOk = $false
}

# ---- 3. 服务二进制 ----
Write-Host ""
Write-Host ">>> 服务程序检测 (bin\server.exe)" -ForegroundColor Yellow
if (Test-Path ".\bin\server.exe") {
    Write-Host "    [+] 服务程序存在" -ForegroundColor Green
} else {
    Write-Host "    [-] 服务程序不存在！请编译：go build -o bin/server.exe ./cmd/server" -ForegroundColor Red
    $allOk = $false
}

# ---- 4. 服务连通性 ----
Write-Host ""
Write-Host ">>> 服务连通性检测 (127.0.0.1:8317)" -ForegroundColor Yellow
try {
    $headers = @{ "Authorization" = "Bearer sk-your-secret-key-change-me" }
    $models = Invoke-RestMethod -Uri "http://127.0.0.1:8317/v1/models" -Headers $headers -TimeoutSec 5 -ErrorAction Stop
    $modelNames = ($models.data | ForEach-Object { $_.id }) -join ", "
    Write-Host "    [+] 服务在线，模型：${modelNames}" -ForegroundColor Green
} catch {
    Write-Host "    [!] 服务未运行或无响应" -ForegroundColor Yellow
}

# ---- 5. Codex 认证 ----
Write-Host ""
Write-Host ">>> Codex 认证检测" -ForegroundColor Yellow
$codexFiles = Get-ChildItem ".\auths\codex-*.json" -ErrorAction SilentlyContinue
if ($codexFiles) {
    Write-Host "    [+] 找到 Codex 认证文件：$($codexFiles[0].Name)" -ForegroundColor Green
} else {
    Write-Host "    [!] 未找到 Codex 认证文件" -ForegroundColor Yellow
}

# ---- 总结 ----
Write-Host ""
if ($allOk) {
    Write-Host "============================================================" -ForegroundColor Green
    Write-Host "  所有基础检查通过，可以启动服务！" -ForegroundColor Green
    Write-Host "  双击 "启动服务.bat" 或运行 .\start.ps1" -ForegroundColor Green
    Write-Host "============================================================" -ForegroundColor Green
} else {
    Write-Host "============================================================" -ForegroundColor Red
    Write-Host "  存在未通过项，请根据上方提示修复后重试。" -ForegroundColor Red
    Write-Host "============================================================" -ForegroundColor Red
}
Write-Host ""
pause
