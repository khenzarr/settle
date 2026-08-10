param([string]$Voice = "en-US-AvaNeural", [string]$Rate = "-6%")
$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "../..")
$out = Join-Path $root "artifacts/grant-demo/audio"
New-Item -ItemType Directory -Force $out | Out-Null
$text = "Settle lets a marketplace add Pay with U S D C while keeping payment planning, wallet handoff, escrow, and programmable settlement inside one consistent flow. On Arc, Circle's developer-controlled wallet executes the prepared operator release through an A P I. The contract distributes basis points exactly."
$audio = Join-Path $out "audition-$Voice.mp3"
& pnpm exec edge-tts synthesize --voice $Voice "--rate=$Rate" "--pitch=-2Hz" --text $text --output (Join-Path $out "audition-$Voice")
if ($LASTEXITCODE -ne 0) { throw "Edge TTS audition failed." }
& ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 $audio | Set-Content (Join-Path $out "audition-duration.txt")
Write-Host "Generated narration-only neural audition with $Voice at $Rate."
