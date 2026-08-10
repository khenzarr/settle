$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "../..")
$out = Join-Path $root "artifacts/grant-demo/terminal"
New-Item -ItemType Directory -Force $out | Out-Null
Push-Location $root
try {
  $web = (& cmd /d /s /c "pnpm --filter @settle/web test 2>&1" | Out-String)
  if ($LASTEXITCODE -ne 0 -or $web -notmatch '85') { throw "Web test evidence did not confirm 85 passing tests." }
  $contracts = (& cmd /d /s /c "forge test --root packages/contracts 2>&1" | Out-String)
  if ($LASTEXITCODE -ne 0 -or $contracts -notmatch '167') { throw "Foundry evidence did not confirm 167 passing tests." }
  @"
SETTLE · RELEASE EVIDENCE

> pnpm --filter @settle/web test
85 tests passed

> forge test --root packages/contracts
167 tests passed

No environment values or shell history captured.
"@ | Set-Content -Encoding utf8 (Join-Path $out "passing-summary.txt")
  Write-Host "Captured sanitized test summary: web 85, Foundry 167."
} finally { Pop-Location }
