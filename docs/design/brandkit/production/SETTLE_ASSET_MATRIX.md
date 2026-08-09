# Settle production asset matrix

Source geometry is owned by the locked exploration files; production masters below are clean copies with identical path data. Color is a mapping, not duplicated geometry: neutral SVGs use `currentColor`. Instrument Sans is the production wordmark family; no font binary is packaged in B2B2.

| Asset | Source geometry | Optical version | Color mode | Format | Size | Purpose | Status | Production phase |
|---|---|---|---|---|---|---|---|---|
| `settle-symbol-master.svg` | `round-2/candidate-i.svg` | I-0 | `currentColor` | SVG | 24 viewBox | canonical, portable/font-independent symbol, 24px+ | READY — review | B2B1 |
| `settle-symbol-small.svg` | `finalist/candidate-i3.svg` | I-3 | `currentColor` | SVG | 24 viewBox | portable/font-independent symbol, 16–20px, favicon | READY — review | B2B1 |
| `settle-lockup-horizontal.svg` | I-0 + live `Settle` | I-0 | mapped foreground | SVG/live text | 34px mark / 14px gap | header/default reference; Instrument Sans required for exact intended rendering | SPEC-SAFE — live text | B2B1 |
| stacked lockup | I-0 + live text | I-0 | mapped foreground | composition spec | optical | deck/brand composition | SPECIFIED, no final export | B2B1 |
| descriptor lockup | stacked + descriptor | I-0 | mapped foreground | composition spec | optical | deck signature only | SPECIFIED, no final export | B2B1 |
| outlined lockups | I-0 + Instrument Sans export | I-0 | mapped foreground | vector | generated | portable wordmark/lockup | APPROVED — B2B2 | B2B2 |
| `favicon.svg` | I-3 | I-3 | flat | SVG | 64 viewBox | browser tab | APPROVED — B2B2 | B2B2 |
| `favicon.ico` | I-3/I-0 routed | routed | flat | ICO | 16/32/48 | legacy browser | APPROVED — B2B2 | B2B2 |
| icon PNGs | I-3/I-0 by size | routed | flat | PNG | 16/32/48 | browser/platform | APPROVED — B2B2 | B2B2 |
| `apple-touch-icon-180.png` | I-0 | I-0 | flat | PNG | 180 | iOS home screen | APPROVED — B2B2 | B2B2 |
| PWA icons | I-0 | I-0 | flat | PNG | 192/512 | Android/PWA | APPROVED — B2B2 | B2B2 |
| maskable icon | I-0 | I-0 | flat | PNG | 512 | adaptive icon | APPROVED — B2B2 | B2B2 |
| social avatar | I-0 | I-0 | mono/color | PNG | 1024 | profile/avatar | APPROVED — B2B2 | B2B2 |
| OG/social card | I-0 + outlined Instrument Sans | I-0 | Mineral Settlement | raster | 1200x630 / 1200x675 | share card | APPROVED — B2B2 | B2B2 |
| app typography | Instrument Sans + system fallbacks | n/a | application tokens | Next.js integration | future | product UI typography | PLANNED — D4D0.7 | D4D0.7 |

All requested B2B2 portable vectors and raster exports are generated and remain pending human visual review. No font binary or application/public asset is created. App typography remains planned for D4D0.7.