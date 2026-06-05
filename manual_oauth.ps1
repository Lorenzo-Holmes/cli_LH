# ChatGPT OAuth Manual Login Script for cli_LH
# Two-step process:
#   Step 1: .\manual_oauth.ps1          -> prints auth URL, saves PKCE state
#   Step 2: Paste callback URL into callback_url.txt
#   Step 3: .\manual_oauth.ps1 -Step2   -> reads URL, exchanges for token, saves auth file

param([switch]$Step2)

$ErrorActionPreference = "Stop"

$AuthDir = Join-Path $PSScriptRoot "auths"
$TokenURL = "https://auth.openai.com/oauth/token"
$ClientID = "app_EMoamEEZ73f0CkXaXp7hrann"
$RedirectURI = "http://localhost:1455/auth/callback"
$StateFile = Join-Path $PSScriptRoot "oauth_state.json"

if (-not $Step2) {
    # ===== STEP 1: Generate PKCE and print auth URL =====
    Write-Host "===== STEP 1: Generate Auth URL =====" -ForegroundColor Cyan

    # Generate random code_verifier
    $rng = [System.Security.Cryptography.RNGCryptoServiceProvider]::new()
    $randomBytes = New-Object byte[] 96
    $rng.GetBytes($randomBytes)
    $code_verifier = [Convert]::ToBase64String($randomBytes) -replace '\+','-' -replace '/','_' -replace '=',''

    # Generate code_challenge = BASE64URL(SHA256(code_verifier))
    $sha256 = [System.Security.Cryptography.SHA256]::Create()
    $verifierBytes = [System.Text.Encoding]::UTF8.GetBytes($code_verifier)
    $hashBytes = $sha256.ComputeHash($verifierBytes)
    $code_challenge = [Convert]::ToBase64String($hashBytes) -replace '\+','-' -replace '/','_' -replace '=',''

    # Generate random state
    $stateBytes = New-Object byte[] 24
    $rng.GetBytes($stateBytes)
    $state = [Convert]::ToBase64String($stateBytes) -replace '\+','-' -replace '/','_' -replace '=',''

    # Save state to file
    @{
        code_verifier = $code_verifier
        state = $state
    } | ConvertTo-Json | Out-File -FilePath $StateFile -Encoding UTF8

    # Build auth URL
    $encodedParams = [System.Web.HttpUtility]::ParseQueryString("")
    $encodedParams["client_id"] = $ClientID
    $encodedParams["response_type"] = "code"
    $encodedParams["redirect_uri"] = $RedirectURI
    $encodedParams["scope"] = "openid email profile offline_access"
    $encodedParams["state"] = $state
    $encodedParams["code_challenge"] = $code_challenge
    $encodedParams["code_challenge_method"] = "S256"
    $encodedParams["prompt"] = "login"
    $encodedParams["id_token_add_organizations"] = "true"
    $encodedParams["codex_cli_simplified_flow"] = "true"

    $AuthURL = "https://auth.openai.com/oauth/authorize"
    $authUrl = "$AuthURL`?$($encodedParams.ToString())"

    Write-Host ""
    Write-Host "============================================================" -ForegroundColor Yellow
    Write-Host "  COPY THIS URL AND OPEN IT IN YOUR BROWSER:" -ForegroundColor Yellow
    Write-Host "============================================================" -ForegroundColor Yellow
    Write-Host ""
    Write-Host $authUrl -ForegroundColor Green
    Write-Host ""
    Write-Host "============================================================" -ForegroundColor Yellow
    Write-Host "  After login, browser will redirect to:" -ForegroundColor Gray
    Write-Host "  http://localhost:1455/auth/callback?code=...&state=..." -ForegroundColor Gray
    Write-Host ""
    Write-Host "  The page will show 'Connection Refused' - THAT'S OK!" -ForegroundColor Yellow
    Write-Host "  Just copy the FULL URL from the address bar." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "  Then paste that URL into a NEW file:" -ForegroundColor Yellow
    Write-Host "  callback_url.txt" -ForegroundColor White
    Write-Host "  (in the same directory as this script)" -ForegroundColor Gray
    Write-Host ""
    Write-Host "  Then run: .\manual_oauth.ps1 -Step2" -ForegroundColor Cyan
    Write-Host "============================================================" -ForegroundColor Yellow

} else {
    # ===== STEP 2: Exchange code for tokens =====
    Write-Host "===== STEP 2: Token Exchange =====" -ForegroundColor Cyan

    # Load state
    if (-not (Test-Path $StateFile)) {
        Write-Host "ERROR: State file not found. Run without -Step2 first." -ForegroundColor Red
        exit 1
    }
    $stateData = Get-Content $StateFile -Raw | ConvertFrom-Json
    $code_verifier = $stateData.code_verifier
    $state = $stateData.state

    # Read callback URL
    $callbackFile = Join-Path $PSScriptRoot "callback_url.txt"
    if (-not (Test-Path $callbackFile)) {
        Write-Host "ERROR: callback_url.txt not found at $callbackFile" -ForegroundColor Red
        Write-Host "Create this file and paste the full callback URL from your browser address bar." -ForegroundColor Red
        exit 1
    }
    $callbackUrl = (Get-Content $callbackFile -Raw).Trim()

    if ([string]::IsNullOrWhiteSpace($callbackUrl)) {
        Write-Host "ERROR: callback_url.txt is empty!" -ForegroundColor Red
        exit 1
    }

    Write-Host "  Callback URL read ($($callbackUrl.Length) chars)" -ForegroundColor Gray

    # Parse the callback URL
    $uri = [System.Uri]$callbackUrl
    $queryParams = [System.Web.HttpUtility]::ParseQueryString($uri.Query)
    $code = $queryParams["code"]
    $oauthError = $queryParams["error"]
    $errorDescription = $queryParams["error_description"]

    if ($oauthError) {
        Write-Host "ERROR: OAuth error - $oauthError : $errorDescription" -ForegroundColor Red
        exit 1
    }

    if (-not $code) {
        Write-Host "ERROR: No 'code' parameter found in the URL." -ForegroundColor Red
        Write-Host "URL was: $callbackUrl" -ForegroundColor Gray
        exit 1
    }

    Write-Host "  Authorization code extracted (length: $($code.Length))" -ForegroundColor Gray

    # Exchange code for tokens
    Write-Host "  Calling token endpoint..." -ForegroundColor Gray

    $body = @{
        grant_type    = "authorization_code"
        client_id     = $ClientID
        code          = $code
        redirect_uri  = $RedirectURI
        code_verifier = $code_verifier
    }

    try {
        $tokenResponse = Invoke-RestMethod -Uri $TokenURL -Method Post -Body $body -ContentType "application/x-www-form-urlencoded"
    } catch {
        Write-Host "ERROR: Token exchange failed:" -ForegroundColor Red
        Write-Host $_.Exception.Message -ForegroundColor Red
        if ($_.Exception.Response) {
            $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
            $responseBody = $reader.ReadToEnd()
            Write-Host "Server response: $responseBody" -ForegroundColor Red
        }
        exit 1
    }

    Write-Host "  Tokens received!" -ForegroundColor Green

    # Parse JWT ID token to get email
    $jwtParts = $tokenResponse.id_token.Split('.')
    if ($jwtParts.Length -ne 3) {
        Write-Host "ERROR: Invalid ID token (not 3 parts)" -ForegroundColor Red
        exit 1
    }

    $payloadBase64 = $jwtParts[1] -replace '-','+' -replace '_','/'
    while ($payloadBase64.Length % 4 -ne 0) { $payloadBase64 += '=' }
    $payloadJson = [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($payloadBase64))
    $payload = $payloadJson | ConvertFrom-Json
    $email = $payload.email
    $accountId = $payload.sub

    Write-Host "  Email: $email" -ForegroundColor Gray
    Write-Host "  Account ID: $accountId" -ForegroundColor Gray

    # Calculate expire time
    $expiresIn = $tokenResponse.expires_in
    if (-not $expiresIn) { $expiresIn = 3600 }
    $expireTime = (Get-Date).AddSeconds($expiresIn).ToString("yyyy-MM-ddTHH:mm:ss.fff") + "Z"

    # Create auth data
    $authData = @{
        id_token      = $tokenResponse.id_token
        access_token  = $tokenResponse.access_token
        refresh_token = $tokenResponse.refresh_token
        account_id    = $accountId
        last_refresh  = (Get-Date).ToString("yyyy-MM-ddTHH:mm:ss.fff") + "Z"
        email         = $email
        type          = "codex"
        expired       = $expireTime
    }

    # Save auth file
    if (-not (Test-Path $AuthDir)) {
        New-Item -ItemType Directory -Path $AuthDir | Out-Null
    }

    $safeEmail = $email -replace '[^a-zA-Z0-9._-]','_'
    $authFile = Join-Path $AuthDir "codex-$safeEmail.json"
    $authData | ConvertTo-Json -Depth 10 | Out-File -FilePath $authFile -Encoding UTF8

    # Cleanup
    Remove-Item $StateFile -ErrorAction SilentlyContinue
    Remove-Item $callbackFile -ErrorAction SilentlyContinue

    Write-Host ""
    Write-Host "============================================================" -ForegroundColor Green
    Write-Host "  SUCCESS! Credentials saved to:" -ForegroundColor Green
    Write-Host "  $authFile" -ForegroundColor Green
    Write-Host "============================================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "  Next steps:" -ForegroundColor Cyan
    Write-Host "  1. Start server:  .\bin\server.exe" -ForegroundColor White
    Write-Host "  2. Test it:       curl http://127.0.0.1:8317/healthz" -ForegroundColor White
    Write-Host "  3. Test API:      curl http://127.0.0.1:8317/v1/models -H 'Authorization: Bearer sk-your-secret-key-change-me'" -ForegroundColor White
}
