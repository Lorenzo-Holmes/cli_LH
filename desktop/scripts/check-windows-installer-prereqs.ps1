$ErrorActionPreference = "Stop"

Write-Host "Checking Windows installer prerequisites..." -ForegroundColor Cyan

$checks = New-Object System.Collections.Generic.List[object]

function Add-Check {
    param(
        [string]$Name,
        [bool]$Ok,
        [string]$Detail,
        [string]$Suggestion = ""
    )
    $checks.Add([pscustomobject]@{
        Name = $Name
        Ok = $Ok
        Detail = $Detail
        Suggestion = $Suggestion
    }) | Out-Null
}

$makensis = Get-Command makensis.exe -ErrorAction SilentlyContinue
Add-Check -Name "NSIS makensis.exe" -Ok ([bool]$makensis) -Detail ($(if ($makensis) { $makensis.Source } else { "not found" })) -Suggestion "Install NSIS 3.x or ensure Tauri can download the NSIS toolchain."

$light = Get-Command light.exe -ErrorAction SilentlyContinue
$candle = Get-Command candle.exe -ErrorAction SilentlyContinue
$wixOk = [bool]$light -and [bool]$candle
Add-Check -Name "WiX toolset" -Ok $wixOk -Detail ($(if ($wixOk) { "light=$($light.Source); candle=$($candle.Source)" } else { "not found" })) -Suggestion "Only required for MSI targets. This project currently targets NSIS."

$webView2Paths = @(
    "$env:ProgramFiles(x86)\Microsoft\EdgeWebView\Application",
    "$env:ProgramFiles\Microsoft\EdgeWebView\Application"
)
$webView2Path = $webView2Paths | Where-Object { Test-Path $_ } | Select-Object -First 1
$webView2Registry = Get-ItemProperty -Path @(
    "HKLM:\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}",
    "HKLM:\SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}"
) -ErrorAction SilentlyContinue | Select-Object -First 1
$webView2Ok = [bool]$webView2Path -or [bool]$webView2Registry
$webView2Detail = if ($webView2Path) { $webView2Path } elseif ($webView2Registry) { "registry: $($webView2Registry.pv)" } else { "not found" }
Add-Check -Name "WebView2 Runtime" -Ok $webView2Ok -Detail $webView2Detail -Suggestion "Install Microsoft Edge WebView2 Runtime."

$rustc = Get-Command rustc.exe -ErrorAction SilentlyContinue
$cargo = Get-Command cargo.exe -ErrorAction SilentlyContinue
Add-Check -Name "Rust/Cargo" -Ok ([bool]$rustc -and [bool]$cargo) -Detail ($(if ($rustc -and $cargo) { "rustc=$($rustc.Source); cargo=$($cargo.Source)" } else { "missing rustc or cargo" })) -Suggestion "Install Rust stable MSVC toolchain with rustup."

$node = Get-Command node.exe -ErrorAction SilentlyContinue
$npm = Get-Command npm.cmd -ErrorAction SilentlyContinue
Add-Check -Name "Node/npm" -Ok ([bool]$node -and [bool]$npm) -Detail ($(if ($node -and $npm) { "node=$($node.Source); npm=$($npm.Source)" } else { "missing node or npm" })) -Suggestion "Install Node.js 22 LTS or newer."

$checks | Format-Table Name, Ok, Detail -AutoSize

$failedBlocking = $checks | Where-Object { -not $_.Ok -and $_.Name -in @("NSIS makensis.exe", "WebView2 Runtime", "Rust/Cargo", "Node/npm") }
if ($failedBlocking) {
    Write-Host ""
    Write-Host "Installer prerequisites are incomplete:" -ForegroundColor Yellow
    foreach ($check in $failedBlocking) {
        Write-Host "- $($check.Name): $($check.Suggestion)" -ForegroundColor Yellow
    }
    exit 1
}

Write-Host "Installer prerequisites passed for the current NSIS target." -ForegroundColor Green
