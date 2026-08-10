$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "../..")
Push-Location $root
try {
  node scripts/grant-demo/capture-browser.mjs
  node scripts/grant-demo/render-code.mjs
  & scripts/grant-demo/capture-tests.ps1
  & scripts/grant-demo/voice-audition.ps1
  & scripts/grant-demo/build-overlays.ps1
  & scripts/grant-demo/render-final-demo.ps1 -ValidateOnly
  git diff --check
  if ($LASTEXITCODE -ne 0) { throw "git diff --check failed." }
  Write-Host "D4D2A pipeline validation passed; no final MP4 was rendered."
} finally { Pop-Location }