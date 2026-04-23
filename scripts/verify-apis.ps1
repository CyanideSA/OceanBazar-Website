$tok = ((Invoke-WebRequest "http://127.0.0.1:8000/api/admin/auth/login" -Method POST -Body '{"username":"rjsuvosa","password":"rjsuvosa420"}' -ContentType "application/json" -UseBasicParsing).Content | ConvertFrom-Json).token

Write-Host "--- Admin endpoints via BFF (4000) ---"
$endpoints = @(
  "/api/admin/overview",
  "/api/admin/orders",
  "/api/admin/tickets",
  "/api/admin/applications/wholesale",
  "/api/admin/applications/business-inquiries",
  "/api/admin/customers",
  "/api/admin/payments",
  "/api/admin/chat/conversations",
  "/api/admin/coupons",
  "/api/admin/returns",
  "/api/admin/inventory",
  "/api/admin/fulfillment/shipments",
  "/api/admin/team/members",
  "/api/admin/notifications",
  "/api/admin/global-settings",
  "/api/admin/analytics/sales"
)

foreach ($ep in $endpoints) {
  try {
    $r = Invoke-WebRequest "http://127.0.0.1:4000$ep" -Headers @{Authorization="Bearer $tok"} -UseBasicParsing -TimeoutSec 8
    Write-Host "OK  $ep"
  } catch {
    $msg = $_.Exception.Message
    if ($msg -match "Response status code does not indicate success: (\d+)") { $code = $Matches[1] } else { $code = "ERR" }
    Write-Host "FAIL $code $ep"
  }
}

Write-Host ""
Write-Host "--- BFF storefront endpoints ---"
$bffEndpoints = @(
  "/api/products",
  "/api/categories",
  "/api/auth/me",
  "/api/tickets",
  "/api/orders"
)
foreach ($ep in $bffEndpoints) {
  try {
    $r = Invoke-WebRequest "http://127.0.0.1:4000$ep" -UseBasicParsing -TimeoutSec 8
    Write-Host "OK  $ep"
  } catch {
    $msg = $_.Exception.Message
    if ($msg -match "Response status code does not indicate success: (\d+)") { $code = $Matches[1] } else { $code = "ERR" }
    Write-Host "FAIL $code $ep"
  }
}
