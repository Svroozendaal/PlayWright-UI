param(
  [string]$BaseUrl = "http://localhost:8012/local.html",
  [string]$RawOutput = "tests/recordings/session.raw.spec.ts",
  [string]$PortableOutput = "tests/portable/session.spec.ts",
  [string]$MapPath = "..\mendix-portable-workflow\config\mendix-map.example.json",
  [string]$HelperImport = "../support/mendix-pointers"
)

$ErrorActionPreference = "Stop"

Write-Host "[workflow] Recording test with Playwright codegen..."
npx playwright codegen $BaseUrl --output $RawOutput

Write-Host "[workflow] Normalizing generated test..."
node ..\mendix-portable-workflow\scripts\normalize-codegen.js `
  --input $RawOutput `
  --output $PortableOutput `
  --map $MapPath `
  --helperImport $HelperImport

Write-Host "[workflow] Done. Portable spec created at $PortableOutput"
