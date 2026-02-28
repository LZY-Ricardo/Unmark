param(
  [string]$BaseUrl = "http://localhost:3000",
  [string]$AnonId = ("smoke-" + [Guid]::NewGuid().ToString("N").Substring(0, 10)),
  [ValidateSet("day", "month")]
  [string]$PlanType = "day",
  [string]$ParseUrl = "https://v.douyin.com/4evJ3qVn5HA/",
  [int]$RequestTimeoutSec = 20,
  [switch]$VerifyPaywall,
  [switch]$AllowParseFail
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Write-Step([string]$Message) {
  Write-Host ""
  Write-Host "[STEP] $Message" -ForegroundColor Cyan
}

function Fail([string]$Message) {
  throw "SMOKE FAILED: $Message"
}

function Invoke-JsonRequest(
  [string]$Method,
  [string]$Url,
  [hashtable]$Headers,
  [object]$Body = $null
) {
  try {
    if ($null -ne $Body) {
      $jsonBody = $Body | ConvertTo-Json -Compress -Depth 8
      $res = Invoke-WebRequest -Method $Method -Uri $Url -Headers $Headers -ContentType "application/json" -Body $jsonBody -TimeoutSec $RequestTimeoutSec
    } else {
      $res = Invoke-WebRequest -Method $Method -Uri $Url -Headers $Headers -TimeoutSec $RequestTimeoutSec
    }
    $payload = $null
    if ($res.Content) {
      try { $payload = $res.Content | ConvertFrom-Json } catch { $payload = $null }
    }
    return [PSCustomObject]@{
      StatusCode = [int]$res.StatusCode
      Json = $payload
      Raw = $res.Content
    }
  } catch {
    $resp = $_.Exception.Response
    if ($null -eq $resp) {
      return [PSCustomObject]@{
        StatusCode = -1
        Json = $null
        Raw = $_.Exception.Message
      }
    }
    $status = [int]$resp.StatusCode
    $reader = New-Object System.IO.StreamReader($resp.GetResponseStream())
    $rawBody = $reader.ReadToEnd()
    $payload = $null
    if ($rawBody) {
      try { $payload = $rawBody | ConvertFrom-Json } catch { $payload = $null }
    }
    return [PSCustomObject]@{
      StatusCode = $status
      Json = $payload
      Raw = $rawBody
    }
  }
}

function Assert-Status([int]$Actual, [int]$Expected, [string]$Context) {
  if ($Actual -ne $Expected) {
    if ($Actual -eq -1) {
      Fail "$Context failed to connect. Ensure app is running at $BaseUrl (run: npm run dev)"
    }
    Fail "$Context returned status=$Actual expected=$Expected"
  }
}

Write-Host "Billing smoke test starting..." -ForegroundColor Green
Write-Host "BaseUrl: $BaseUrl"
Write-Host "AnonId : $AnonId"
Write-Host "Plan   : $PlanType"
Write-Host "URL    : $ParseUrl"

$headers = @{
  "x-anon-id" = $AnonId
}

Write-Step "Fetch initial entitlement"
$ent1 = Invoke-JsonRequest -Method "GET" -Url "$BaseUrl/api/billing/entitlement" -Headers $headers
Assert-Status -Actual $ent1.StatusCode -Expected 200 -Context "GET /api/billing/entitlement"
if (-not $ent1.Json.success) {
  Fail "Initial entitlement success=false body=$($ent1.Raw)"
}

$activePlan1 = [string]$ent1.Json.data.activePlan
$freeRemaining1 = [int]$ent1.Json.data.freeRemaining
Write-Host "Initial activePlan=$activePlan1 freeRemaining=$freeRemaining1"

if ($VerifyPaywall -and $activePlan1 -eq "free") {
  Write-Step "Verify paywall path (free user)"
  $parse1 = Invoke-JsonRequest -Method "POST" -Url "$BaseUrl/api/parse" -Headers $headers -Body @{ url = $ParseUrl }
  Write-Host "Parse #1 status=$($parse1.StatusCode)"

  if ($parse1.StatusCode -eq 200 -and $parse1.Json.success -eq $true) {
    $parse2 = Invoke-JsonRequest -Method "POST" -Url "$BaseUrl/api/parse" -Headers $headers -Body @{ url = $ParseUrl }
    if ($parse2.StatusCode -ne 402 -or $parse2.Json.error.code -ne "PAYWALL_REQUIRED") {
      Fail "Expected PAYWALL_REQUIRED on second free parse, got status=$($parse2.StatusCode) body=$($parse2.Raw)"
    }
    Write-Host "Paywall path verified."
  } else {
    Write-Host "Skip strict paywall verification because first parse did not succeed." -ForegroundColor Yellow
    Write-Host "Parse #1 body: $($parse1.Raw)" -ForegroundColor Yellow
  }
}

Write-Step "Create paid order"
$clientRequestId = "smoke-{0}" -f ([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())
$orderRes = Invoke-JsonRequest -Method "POST" -Url "$BaseUrl/api/billing/order" -Headers $headers -Body @{
  planType = $PlanType
  clientRequestId = $clientRequestId
}
Assert-Status -Actual $orderRes.StatusCode -Expected 200 -Context "POST /api/billing/order"
if (-not $orderRes.Json.success) {
  Fail "Order creation success=false body=$($orderRes.Raw)"
}
$orderNo = [string]$orderRes.Json.data.orderNo
$orderStatus = [string]$orderRes.Json.data.orderStatus
Write-Host "Order created: orderNo=$orderNo status=$orderStatus"

if (-not $orderNo) {
  Fail "Order number is empty"
}

if ($orderStatus -ne "fulfilled") {
  Write-Step "Refresh non-fulfilled order"
  $refreshRes = Invoke-JsonRequest -Method "POST" -Url "$BaseUrl/api/billing/refresh" -Headers $headers -Body @{
    orderNo = $orderNo
  }
  Assert-Status -Actual $refreshRes.StatusCode -Expected 200 -Context "POST /api/billing/refresh"
  Write-Host "Refresh status=$($refreshRes.Json.data.orderStatus)"
}

Write-Step "Fetch entitlement after payment"
$ent2 = Invoke-JsonRequest -Method "GET" -Url "$BaseUrl/api/billing/entitlement" -Headers $headers
Assert-Status -Actual $ent2.StatusCode -Expected 200 -Context "GET /api/billing/entitlement (post-pay)"
if (-not $ent2.Json.success) {
  Fail "Post-pay entitlement success=false body=$($ent2.Raw)"
}
$activePlan2 = [string]$ent2.Json.data.activePlan
Write-Host "Post-pay activePlan=$activePlan2"
if ($activePlan2 -eq "free") {
  Fail "Expected non-free activePlan after payment"
}

Write-Step "Parse after payment"
$parsePaid = Invoke-JsonRequest -Method "POST" -Url "$BaseUrl/api/parse" -Headers $headers -Body @{ url = $ParseUrl }
Write-Host "Post-pay parse status=$($parsePaid.StatusCode)"

if ($parsePaid.StatusCode -eq 402) {
  Fail "Post-pay parse is still blocked by paywall: $($parsePaid.Raw)"
}

if ($parsePaid.StatusCode -eq 200 -and $parsePaid.Json.success -eq $true) {
  Write-Host "Post-pay parse succeeded." -ForegroundColor Green
} else {
  $msg = "Post-pay parse did not return success=true. status=$($parsePaid.StatusCode) body=$($parsePaid.Raw)"
  if ($AllowParseFail) {
    Write-Host $msg -ForegroundColor Yellow
    Write-Host "Allowed because -AllowParseFail is set." -ForegroundColor Yellow
  } else {
    Fail $msg
  }
}

Write-Host ""
Write-Host "SMOKE PASSED" -ForegroundColor Green
Write-Host "anonId=$AnonId orderNo=$orderNo plan=$activePlan2"
