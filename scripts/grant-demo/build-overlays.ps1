$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "../..")
$out = Join-Path $root "artifacts/grant-demo/intermediate/lower-thirds.ass"
New-Item -ItemType Directory -Force (Split-Path $out) | Out-Null
$separator = [char]0x00B7
$ass = @"
[Script Info]
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name,Fontname,Fontsize,PrimaryColour,SecondaryColour,OutlineColour,BackColour,Bold,Italic,Underline,StrikeOut,ScaleX,ScaleY,Spacing,Angle,BorderStyle,Outline,Shadow,Alignment,MarginL,MarginR,MarginV,Encoding
Style: LowerThird,Segoe UI Semibold,26,&H00F2FFF9,&H000000FF,&H00152F27,&HCC071512,-1,0,0,0,100,100,0,0,3,1,0,7,60,60,58,1

[Events]
Format: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text
Dialogue: 0,0:00:00.00,0:00:18.00,LowerThird,,0,0,0,,PAY WITH USDC
Dialogue: 0,0:00:18.00,0:00:34.00,LowerThird,,0,0,0,,MARKETPLACE CHECKOUT
Dialogue: 0,0:00:34.00,0:01:15.00,LowerThird,,0,0,0,,NON-MUTATING PAYMENT PLAN
Dialogue: 0,0:01:15.00,0:01:36.00,LowerThird,,0,0,0,,HOSTED CHECKOUT $separator SECURE HANDOFF
Dialogue: 0,0:01:36.00,0:01:45.00,LowerThird,,0,0,0,,MONOREPO ARCHITECTURE
Dialogue: 0,0:01:45.00,0:02:07.00,LowerThird,,0,0,0,,SERVER-ONLY CIRCLE WALLET BOUNDARY
Dialogue: 0,0:02:07.00,0:02:21.00,LowerThird,,0,0,0,,CONTROLLED OPERATOR EXECUTION
Dialogue: 0,0:02:21.00,0:02:57.00,LowerThird,,0,0,0,,CANONICAL ESCROW
Dialogue: 0,0:02:57.00,0:03:08.00,LowerThird,,0,0,0,,BUYER WALLET AUTHORIZATION
Dialogue: 0,0:03:08.00,0:03:23.00,LowerThird,,0,0,0,,RELEASE HARDENING $separator 252 TESTS PASS
Dialogue: 0,0:03:23.00,0:03:43.00,LowerThird,,0,0,0,,PROGRAMMABLE 90 / 10 SETTLEMENT
Dialogue: 0,0:03:43.00,0:04:12.00,LowerThird,,0,0,0,,ARC TESTNET EVIDENCE
Dialogue: 0,0:04:12.00,0:04:30.00,LowerThird,,0,0,0,,DEVELOPER INTEGRATION READY
Dialogue: 0,0:04:30.00,0:04:45.00,LowerThird,,0,0,0,,SETTLE $separator PROGRAMMABLE USDC SETTLEMENT
"@
$forbiddenCodePoints = @(0x00C2, 0x00C3, 0x00E2, 0xFFFD)
if ($forbiddenCodePoints | Where-Object { $ass.Contains([char]$_) }) { throw "Generated overlay contains mojibake or replacement characters." }
[IO.File]::WriteAllText($out, $ass, [Text.UTF8Encoding]::new($false))
Write-Host "Generated scene-aligned Settle lower thirds."