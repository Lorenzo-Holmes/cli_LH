param(
    [string]$BinaryPath = "",
    [string]$ConfigPath = "",
    [int]$Port = 8318,
    [string]$HostName = "127.0.0.1",
    [int]$TimeoutSeconds = 20
)

$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
if ([string]::IsNullOrWhiteSpace($BinaryPath)) {
    $BinaryPath = Join-Path $repoRoot "desktop\src-tauri\binaries\cli_LH-x86_64-pc-windows-msvc.exe"
}
if ([string]::IsNullOrWhiteSpace($ConfigPath)) {
    $ConfigPath = Join-Path $repoRoot "config.yaml"
}

if (-not (Test-Path $BinaryPath)) {
    throw "Sidecar binary not found: $BinaryPath. Run npm --prefix desktop run prepare:sidecar first."
}
if (-not (Test-Path $ConfigPath)) {
    throw "Config file not found: $ConfigPath"
}

$existing = Get-NetTCPConnection -LocalAddress $HostName -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
if ($existing) {
    $owner = ($existing | Select-Object -First 1).OwningProcess
    throw "Smoke port ${HostName}:${Port} is already in use by PID ${owner}. Choose another -Port."
}

$tempConfig = Join-Path ([System.IO.Path]::GetTempPath()) "cli-lh-smoke-$Port.yaml"
$raw = Get-Content -Raw -Encoding UTF8 $ConfigPath
$raw = $raw -replace '(?m)^host:\s*.*$', "host: `"$HostName`""
$raw = $raw -replace '(?m)^port:\s*\d+\s*$', "port: $Port"
[System.IO.File]::WriteAllText($tempConfig, $raw, [System.Text.UTF8Encoding]::new($false))

$process = $null
try {
    Write-Host "Starting sidecar smoke test on http://${HostName}:${Port}" -ForegroundColor Cyan
    $process = Start-Process -FilePath $BinaryPath -ArgumentList @("--config", $tempConfig, "--no-browser") -WorkingDirectory $repoRoot -PassThru -WindowStyle Hidden

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    $healthOk = $false
    $statusOk = $false
    $statusPayload = $null

    while ((Get-Date) -lt $deadline) {
        if ($process.HasExited) {
            throw "Sidecar exited early with code $($process.ExitCode)"
        }

        try {
            $health = Invoke-WebRequest -UseBasicParsing -Uri "http://${HostName}:${Port}/healthz" -TimeoutSec 3 -ErrorAction Stop
            $healthOk = $health.StatusCode -eq 200
        } catch { }

        try {
            $status = Invoke-WebRequest -UseBasicParsing -Uri "http://${HostName}:${Port}/statusz" -TimeoutSec 3 -ErrorAction Stop
            $statusOk = $status.StatusCode -eq 200
            $statusPayload = $status.Content | ConvertFrom-Json
        } catch { }

        if ($healthOk -and $statusOk) {
            break
        }

        Start-Sleep -Milliseconds 500
    }

    if (-not $healthOk) {
        throw "/healthz did not return 200 within ${TimeoutSeconds}s"
    }
    if (-not $statusOk) {
        throw "/statusz did not return 200 within ${TimeoutSeconds}s"
    }
    if ($statusPayload.service -ne "cli_LH" -or $statusPayload.status -ne "ready") {
        throw "/statusz returned unexpected payload: $($status.Content)"
    }

    Write-Host "Smoke test passed: /healthz and /statusz returned 200 OK" -ForegroundColor Green
    Write-Host "Service: $($statusPayload.service), status: $($statusPayload.status), port: $($statusPayload.server.port)" -ForegroundColor Green
}
finally {
    if ($process -and -not $process.HasExited) {
        Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
        Wait-Process -Id $process.Id -Timeout 5 -ErrorAction SilentlyContinue
    }
    Remove-Item $tempConfig -Force -ErrorAction SilentlyContinue
}
