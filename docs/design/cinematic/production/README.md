# The Settlement Register — D4D0.8C.3 production master

This directory contains the clean, browser-authored production source for Settle's explanatory cinematic. It is an authoring master, not a homepage route and not a runtime SVG component.

## Preview

From the repository root, run:

```powershell
node docs/design/cinematic/production/master/serve.js
```

Open `http://localhost:4173/` for authoring mode. Useful capture URLs are:

- `http://localhost:4173/?plate=desktop&capture=1`
- `http://localhost:4173/?plate=mobile&capture=1`
- `http://localhost:4173/?plate=desktop&poster=1&capture=1`
- `http://localhost:4173/?plate=mobile&poster=1&capture=1`

Capture mode removes controls, debug readouts, and safe-zone guides. The master is deterministic: playback is driven by a single `renderAt(seconds)` timeline and can be paused at any frame.

## Source / runtime boundary

SVG filters, layered masks, grain, localized blur, and restrained bloom are intentional source-only compositing effects. The eventual homepage recommendation remains pre-rendered muted video plus resolved poster fallback; this source is not to be integrated directly into `apps/**`.

## Review dimensions

- Desktop source: 1440 × 900
- Mobile source: 780 × 1688 (presented at 390 × 844)
- Selected cycle: 10.2s (6.7s narrative, 3.1s finality/rest, 0.4s editorial reset)
- Escrow hold: 0.7s, inside the narrative
- Reduced motion: resolved poster, no travel or initialization
- ≤360px: poster-first / poster-only recommendation

Rendered media belongs outside the repository, for example `C:\Users\mertb\Desktop\Settle_Cinematic_Render_Work`.
