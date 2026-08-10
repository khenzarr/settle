param(
  [string]$Root = (Resolve-Path (Join-Path $PSScriptRoot "../..")),
  [switch]$Render
)
$ErrorActionPreference = "Stop"
$final = Join-Path $Root "artifacts/grant-deck/final"
$qa = Join-Path $Root "artifacts/grant-deck/qa"
$pptx = Join-Path $final "Settle_Circle_2026_Cohort2_Investor_Deck.pptx"
$pdf = Join-Path $final "Settle_Circle_2026_Cohort2_Investor_Deck.pdf"
New-Item -ItemType Directory -Force -Path $final,$qa | Out-Null
$soffice = "C:\Program Files\LibreOffice\program\soffice.exe"
if (-not (Test-Path $soffice)) { throw "LibreOffice not found at $soffice" }
& $soffice --headless --convert-to pdf --outdir $final $pptx | Out-Null
if (-not (Test-Path $pdf)) { throw "PDF export did not produce $pdf" }
if ($Render) { node (Join-Path $PSScriptRoot "render-pdf.mjs") }
Write-Output "Exported PDF: $pdf"
if ($Render) { Write-Output "Rendered PNG slides: $qa" }