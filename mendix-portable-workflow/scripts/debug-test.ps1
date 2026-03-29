param(
  [Parameter(Mandatory = $true)]
  [string]$TestFile,
  [string]$Project = "portable-chromium"
)

$ErrorActionPreference = "Stop"

Write-Host "[debug] Test file : $TestFile"
Write-Host "[debug] Project   : $Project"
Write-Host ""

$env:PWDEBUG = "1"
npx playwright test $TestFile --project $Project --headed
$env:PWDEBUG = ""
