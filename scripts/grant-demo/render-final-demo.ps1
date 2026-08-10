param([switch]$ValidateOnly)
$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "../..")
$art = Join-Path $root "artifacts/grant-demo"
$final = Join-Path $art "final/Settle_Circle_2026_Cohort2_Final_Demo_v2.mp4"
$subs = Join-Path $root "docs/grant/video/FINAL_SUBTITLES.srt"
$overlays = Join-Path $art "intermediate/lower-thirds.ass"
if (-not (Get-Command ffmpeg -ErrorAction SilentlyContinue)) { throw "FFmpeg is required." }
& (Join-Path $PSScriptRoot "build-overlays.ps1")
if ($ValidateOnly) { Write-Host "FFmpeg, subtitles, scene overlays, and render entrypoint available."; exit 0 }
$manifest = Join-Path $art "intermediate/concat.txt"
$voice = Join-Path $art "audio/final-narration.wav"
if (!(Test-Path $manifest) -or !(Test-Path $voice)) { throw "D4D2B inputs missing: create scene clips, concat manifest, and final narration first." }
New-Item -ItemType Directory -Force (Split-Path $final) | Out-Null
& ffmpeg -y -f concat -safe 0 -i $manifest -i $voice -vf "fade=t=in:st=0:d=0.35,fade=t=out:st=284.5:d=0.5,subtitles='$($overlays.Replace('\','/').Replace(':','\:'))',subtitles='$($subs.Replace('\','/').Replace(':','\:'))':force_style='FontName=Segoe UI,FontSize=18,PrimaryColour=&H00FFFFFF,OutlineColour=&HCC071512,BackColour=&HAA071512,BorderStyle=3,Outline=1,Shadow=1,MarginL=220,MarginR=220,MarginV=72,WrapStyle=2,Alignment=2'" -af "loudnorm=I=-16:LRA=7:TP=-1.5" -c:v libx264 -preset medium -crf 18 -pix_fmt yuv420p -r 30 -s 1920x1080 -c:a aac -ar 48000 -b:a 192k -shortest -movflags +faststart $final
if ($LASTEXITCODE -ne 0) { throw "Final render failed." }
$json = & ffprobe -v error -show_entries format=duration:stream=codec_name,width,height,codec_type -of json $final | ConvertFrom-Json
$duration = [double]$json.format.duration
if ($duration -ge 295 -or $json.streams[0].codec_name -ne 'h264' -or $json.streams[0].width -ne 1920 -or $json.streams[0].height -ne 1080 -or $json.streams[1].codec_name -ne 'aac') { throw "Compliance probe failed." }
Write-Host "Render compliant: $duration seconds, 1920x1080 H.264/AAC."
