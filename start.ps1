# ============================================================
# cli_LH 一键启动脚本
# 用法：右键 start.ps1 → "使用 PowerShell 运行"
#      或在终端输入：.\start.ps1
# ============================================================

$ErrorActionPreference = "Stop"
$Host.UI.RawUI.WindowTitle = "cli_LH 启动器"

# ---- 配置区（如果你的环境不同，修改这里即可）----
$ProxyPort = 10808
$ConfigFile = ".\config.yaml"
$ServerExe = ".\bin\server.exe"
$ServerHost = "127.0.0.1"
$ServerPort = 8317
$TestApiKey = "sk-your-secret-key-change-me"
$V2rayNDir = "D:\v2rayN-windows-64\v2rayN-windows-64"
# ------------------------------------------------

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "           cli_LH 一键启动脚本" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# ============================================================
# 第一步：检查代理
# ============================================================
Write-Host "[1/4] 检查代理连接..." -ForegroundColor Yellow
Write-Host "    代理地址：http://127.0.0.1:${ProxyPort}"

$proxyOk = $false
try {
    $testConn = Test-NetConnection -ComputerName "127.0.0.1" -Port $ProxyPort -WarningAction SilentlyContinue -ErrorAction SilentlyContinue
    if ($testConn.TcpTestSucceeded) {
        Write-Host "    [+] 代理端口 ${ProxyPort} 已就绪" -ForegroundColor Green
        $proxyOk = $true
    }
}
catch { }

if (-not $proxyOk) {
    Write-Host "    [-] 代理端口 ${ProxyPort} 未检测到，尝试启动 v2rayN..." -ForegroundColor Red

    $v2rayExe = Join-Path $V2rayNDir "v2rayN.exe"
    if (Test-Path $v2rayExe) {
        Write-Host "    正在启动 v2rayN..."
        Start-Process -FilePath $v2rayExe -WorkingDirectory $V2rayNDir -WindowStyle Minimized
        Write-Host "    等待代理就绪（最多等待 15 秒）..." -ForegroundColor Yellow

        $waited = 0
        while ($waited -lt 15) {
            Start-Sleep -Seconds 2
            $waited += 2
            try {
                $retry = Test-NetConnection -ComputerName "127.0.0.1" -Port $ProxyPort -WarningAction SilentlyContinue -ErrorAction SilentlyContinue
                if ($retry.TcpTestSucceeded) {
                    Write-Host "    [+] 代理已就绪！（等待了 ${waited} 秒）" -ForegroundColor Green
                    $proxyOk = $true
                    break
                }
            }
            catch { }
            Write-Host "    等待中... (${waited}s)" -ForegroundColor Gray
        }

        if (-not $proxyOk) {
            Write-Host "    [!] 代理启动超时，请手动打开 v2rayN 并确保节点已连接" -ForegroundColor Red
            Write-Host "    按任意键继续（不通过代理直连）或 Ctrl+C 退出..."
            $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
        }
    }
    else {
        Write-Host "    [!] 未找到 v2rayN.exe（路径：${v2rayExe}）" -ForegroundColor Red
        Write-Host "    请手动启动代理软件，或修改脚本中的 `V2rayNDir` 变量" -ForegroundColor Red
        Write-Host "    按任意键继续（不通过代理）或 Ctrl+C 退出..."
        $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    }
}

# ============================================================
# 第二步：检查配置文件
# ============================================================
Write-Host ""
Write-Host "[2/4] 检查配置文件..." -ForegroundColor Yellow

if (-not (Test-Path $ConfigFile)) {
    Write-Host "    [-] 错误：找不到 ${ConfigFile}！" -ForegroundColor Red
    Write-Host "    请确保在项目根目录下运行此脚本。"
    Write-Host "    按任意键退出..."
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit 1
}

# 快速检查配置文件关键字段
$config = Get-Content $ConfigFile -Raw -Encoding UTF8
$configChecks = @()

if ($config -match "host:") { $configChecks += "[√] host 已配置" } else { $configChecks += "[×] host 未配置" }
if ($config -match "port:") { $configChecks += "[√] port 已配置" } else { $configChecks += "[×] port 未配置" }
if ($config -match "api-keys:") { $configChecks += "[√] api-keys 已配置" } else { $configChecks += "[×] api-keys 未配置" }
if ($config -match "proxy-url:") { $configChecks += "[√] proxy-url 已配置" } else { $configChecks += "[√] proxy-url 未配置（直连模式）" }

foreach ($check in $configChecks) {
    Write-Host "    ${check}"
}
Write-Host "    [+] 配置文件检查通过" -ForegroundColor Green

# 检查 API Key 是否还是默认值
if ($config -match 'sk-your-secret-key-change-me') {
    Write-Host "    [!] 警告：api-keys 仍为默认值 'sk-your-secret-key-change-me'" -ForegroundColor Yellow
    Write-Host "    建议修改为自定义密钥以提升安全性。" -ForegroundColor Yellow
}

# 检查 DeepSeek key
if ($config -match 'sk-cff4d63f791f415a8d980f5fc0845a28') {
    Write-Host "    [+] 检测到 DeepSeek API Key" -ForegroundColor Green
}

# ============================================================
# 第三步：启动服务
# ============================================================
Write-Host ""
Write-Host "[3/4] 启动 cli_LH 服务..." -ForegroundColor Yellow

if (-not (Test-Path $ServerExe)) {
    Write-Host "    [-] 错误：找不到 ${ServerExe}" -ForegroundColor Red
    Write-Host "    请先编译：go build -o bin/server.exe ./cmd/server"
    Write-Host "    按任意键退出..."
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit 1
}

# 停掉可能残留的旧进程
$oldProcess = Get-Process -Name "server" -ErrorAction SilentlyContinue
if ($oldProcess) {
    Write-Host "    停止旧的 server 进程..."
    $oldProcess | Stop-Process -Force
    Start-Sleep -Seconds 1
}

Write-Host "    正在启动服务..."

# 启动服务进程
$proc = Start-Process -FilePath $ServerExe `
    -WorkingDirectory (Get-Location) `
    -PassThru `
    -WindowStyle Minimized

Write-Host "    [+] 服务进程已启动（PID: $($proc.Id)），等待就绪..." -ForegroundColor Green
Write-Host "    等待服务就绪（最多等待 10 秒）..." -ForegroundColor Yellow

# ============================================================
# 第四步：验证服务
# ============================================================
Write-Host ""
Write-Host "[4/4] 验证服务..." -ForegroundColor Yellow

$serviceOk = $false
$waited = 0

while ($waited -lt 10) {
    Start-Sleep -Seconds 2
    $waited += 2
    try {
        $testUrl = "http://${ServerHost}:${ServerPort}/v1/models"
        $headers = @{ "Authorization" = "Bearer ${TestApiKey}" }
        $result = Invoke-RestMethod -Uri $testUrl -Headers $headers -TimeoutSec 5 -ErrorAction SilentlyContinue
        if ($result) {
            Write-Host "    [+] 服务已就绪！（${ServerHost}:${ServerPort}）" -ForegroundColor Green
            $serviceOk = $true
            break
        }
    }
    catch {
        # 检查是不是服务返回了响应（即使非 200）
        if ($_.Exception.Response) {
            Write-Host "    [+] 服务已响应（${ServerHost}:${ServerPort}）" -ForegroundColor Green
            $serviceOk = $true
            break
        }
    }
    Write-Host "    等待中... (${waited}s)" -ForegroundColor Gray
}

if (-not $serviceOk) {
    Write-Host "    [-] 服务启动失败，请检查日志。按任意键退出..." -ForegroundColor Red
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit 1
}

# 快速列出可用模型
Write-Host ""
try {
    $headers = @{ "Authorization" = "Bearer ${TestApiKey}" }
    $models = Invoke-RestMethod -Uri "http://${ServerHost}:${ServerPort}/v1/models" -Headers $headers -TimeoutSec 5
    $modelList = ($models.data | ForEach-Object { $_.id }) -join ", "
    Write-Host "    可用模型：${modelList}" -ForegroundColor Cyan
}
catch {
    Write-Host "    [!] 无法获取模型列表（不影响使用）" -ForegroundColor Yellow
}

# ============================================================
# 完成！
# ============================================================
Write-Host ""
Write-Host "============================================================" -ForegroundColor Green
Write-Host "              🎉  启动成功！" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green
Write-Host ""
Write-Host "  服务地址：  http://${ServerHost}:${ServerPort}" -ForegroundColor White
Write-Host "  API Key ：  ${TestApiKey}" -ForegroundColor White
Write-Host ""
Write-Host "  快速测试（在终端中运行）：" -ForegroundColor Gray
Write-Host '    $headers = @{"Authorization"="Bearer sk-your-secret-key-change-me"}' -ForegroundColor Gray
Write-Host '    $body = @{model="deepseek-v4-pro"; messages=@(@{role="user";content="你好"})} | ConvertTo-Json -Depth 4' -ForegroundColor Gray
Write-Host '    Invoke-RestMethod -Uri "http://127.0.0.1:8317/v1/chat/completions" -Method Post -Headers $headers -Body $body -ContentType "application/json"' -ForegroundColor Gray
Write-Host ""
Write-Host "  按 Ctrl+C 停止服务，或直接关闭此窗口" -ForegroundColor Yellow
Write-Host ""

# 保持脚本运行，显示实时日志（按 Ctrl+C 退出）
try {
    while ($true) {
        if ($proc.HasExited) {
            Write-Host "[!] 服务进程已退出（退出码: $($proc.ExitCode)）" -ForegroundColor Red
            Write-Host "按任意键退出..."
            $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
            break
        }
        Start-Sleep -Seconds 5
    }
}
finally {
    # 清理：退出时停掉服务
    Write-Host "正在停止服务..."
    if (-not $proc.HasExited) {
        $proc | Stop-Process -Force -ErrorAction SilentlyContinue
    }
    Write-Host "已停止。再见！" -ForegroundColor Cyan
}
