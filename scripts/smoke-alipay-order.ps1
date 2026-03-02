param(
  [string]$BaseUrl = "http://localhost:3000",
  [ValidateSet("day", "month")]
  [string]$PlanType = "day",
  [ValidateSet("web", "h5", "qr")]
  [string]$PayScene = "web",
  [string]$ReturnUrl = "https://example.com/pay-return",
  [switch]$OpenBrowser
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Fail([string]$Message) {
  throw "ALIPAY SMOKE FAILED: $Message"
}

function New-RequestId() {
  try {
    return [Guid]::NewGuid().ToString("N")
  } catch {
    return "req_$([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())"
  }
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
      $res = Invoke-WebRequest -Method $Method -Uri $Url -Headers $Headers -ContentType "application/json" -Body $jsonBody -TimeoutSec 20
    } else {
      $res = Invoke-WebRequest -Method $Method -Uri $Url -Headers $Headers -TimeoutSec 20
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

$anonId = "alipay-smoke-" + (New-RequestId).Substring(0, 8)
$clientRequestId = "alipay-order-" + (New-RequestId)

Write-Host "Alipay order smoke starting..." -ForegroundColor Green
Write-Host "BaseUrl: $BaseUrl"
Write-Host "Plan   : $PlanType"
Write-Host "Scene  : $PayScene"
Write-Host "AnonId : $anonId"

$headers = @{
  "x-anon-id" = $anonId
}

$response = Invoke-JsonRequest -Method "POST" -Url "$BaseUrl/api/billing/order" -Headers $headers -Body @{
  planType = $PlanType
  payChannel = "alipay"
  payScene = $PayScene
  returnUrl = $ReturnUrl
  clientRequestId = $clientRequestId
}

if ($response.StatusCode -ne 200) {
  Fail "status=$($response.StatusCode), body=$($response.Raw)"
}
if (-not $response.Json.success) {
  Fail "success=false, body=$($response.Raw)"
}

$data = $response.Json.data
$payUrl = [string]$data.paymentPayload.payUrl

Write-Host ""
Write-Host "[OK] orderNo=$($data.orderNo) status=$($data.orderStatus) payChannel=$($data.payChannel)" -ForegroundColor Green
Write-Host "providerOrderNo=$($data.providerOrderNo)"

if (-not $payUrl) {
  Fail "paymentPayload.payUrl is empty"
}

Write-Host "payUrl=$payUrl" -ForegroundColor Cyan

if ($OpenBrowser) {
  try {
    Start-Process $payUrl | Out-Null
    Write-Host "Browser opened with payUrl." -ForegroundColor Green
  } catch {
    Fail "failed to open browser: $($_.Exception.Message)"
  }
}

Write-Host ""
Write-Host "ALIPAY ORDER SMOKE PASSED" -ForegroundColor Green
