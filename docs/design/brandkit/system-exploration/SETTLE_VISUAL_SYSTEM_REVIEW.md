# Settle visual system review — D4D0.6B2A

**Status:** human review package; uncommitted; no production assets.
**Starting HEAD:** `54c40491e19a6227c3831f3b305b7efb11cd2ead` (`HEAD == origin/main` at preflight).
**Decision boundary:** **No typography/color system has been selected as final.**

## 1. Locked inputs

- Territory: **Convergent Ledger**.
- Master mark: **I-0**, `round-2/candidate-i.svg`, default at 24px and larger.
- Optical-small mark: **I-3**, `finalist/candidate-i3.svg`, 16–20px, favicon and very small UI.
- Word: **Settle**. Corner language: **hard engineered**. Motion: **Converge / Resolve**.
- Product companion: **Deterministic Branch**.
- I-0 and I-3 silhouettes are not reopened. Board lockups reuse I-0's exact two paths; scaling affects the lockup instance only.

## 2. Existing UI audit

Inspected `apps/web/app/globals.css`, `layout.tsx`, `page.tsx`, `pay/[orderId]/page.tsx`, root and web manifests without modification.

- Sans: `Arial, Helvetica, sans-serif`; mono: `Consolas, "SFMono-Regular", monospace`.
- Weight language: 700 headings, labels, actions and amounts; normal body/inherited defaults. Key amounts and split figures use tabular numerals.
- Current cyan `#75D8F8`; page graphite `#080B12`; surface `#111824`; soft surface `#151E2D`; text `#F2F6FB`; secondary `#B5C1D1`; muted `#718096`; success `#68D5A0`; warning `#F2C66D`; danger `#F49AA7`.
- Existing strengths: dark-first coherence, readable primary text, status semantics, clear focus treatment, numeric hierarchy, restrained evidence mono.
- Genericity risks: Arial has little proprietary character; bright cyan plus blue-black and ambient radial glow resembles developer tooling/Web3; translucent cards and broad gradients can imply AI-template UI; surface, radius and icon rules are not yet systematic.
- Dependencies: no font package, icon package, CSS framework, embedded font binary, or `@font-face` inventory. Next 16 and plain global CSS are the relevant implementation platform.

## 3. Typography candidates

### Direction A — Instrument Sans

**Primary:** `"Segoe UI Variable", "Segoe UI", Arial, sans-serif`
**Technical:** `Consolas, "SFMono-Regular", monospace`

Calm humanist construction, excellent lowercase rhythm and Windows rendering. Numerals are clear and contemporary; tabular behavior must be enabled explicitly. Zero/O and 1/l/I are acceptable in UI, while evidence remains mono. `Settle` is trustworthy and neutral rather than logo-like. Strongest for body, checkout, deck/video and Windows; weak brand ownership and non-Windows equivalence are the risks.

### Direction B — Technical Register

**Primary:** `Bahnschrift, "Arial Narrow", Arial, sans-serif`
**Technical:** `Consolas, "SFMono-Regular", monospace`

Engineered DIN-derived bearing suits I-0, compact lockups, numerals and infrastructure labels. Lowercase is competent but narrower/cooler; long commerce copy needs generous line height. Zero/O and 1/l/I improve in technical contexts but still do not replace mono evidence. Strong amount presence and deck rendering on Windows. High web-availability/fallback mismatch risk outside Windows; overuse can feel transport/industrial or cold.

### Direction C — Durable System Grotesk

**Primary:** `Arial, Helvetica, sans-serif`
**Technical:** `Consolas, "SFMono-Regular", monospace`

The control direction: broad availability, stable rendering, familiar lowercase and predictable UI. Numerals are serviceable; distinctions are weaker than mono and require tabular settings. `Settle` reads durable but generic. Best implementation cost and broad fallback; lowest distinctiveness and highest developer-dashboard risk. It tests whether color/mark alone can carry ownership.

## 4. Font evidence and licensing status

Local Windows registry/file evidence confirms Segoe UI Variable/Segoe UI, Bahnschrift, Arial, Consolas and Cascadia are installed. The repository contains no tracked font binaries and no local license text proving redistribution rights.

| Direction | Local evidence | Redistribution/licensing | Availability risk |
|---|---|---|---|
| A | Segoe UI Variable and Segoe UI installed | **REQUIRES VERIFICATION** | Windows strong; other OS fallback changes metrics |
| B | Bahnschrift installed | **REQUIRES VERIFICATION** | Windows strong; web/cross-platform high risk |
| C | Arial installed | **REQUIRES VERIFICATION** | Broad but not metrically identical everywhere |
| Mono | Consolas installed | **REQUIRES VERIFICATION** | Windows strong; SFMono is platform-local fallback |

Installed-system use is not evidence of redistribution permission. No font is claimed safe to package, self-host or redistribute.

## 5. Wordmark studies

Use native live text `Settle`; no outlines or novelty cuts. Start at weight 600 for A/C and a restrained medium/semibold axis for B. Native spacing is the default. Test only `letter-spacing: -0.01em` to `0`; if the selected renderer leaves the `tt` open, apply a local optical pair correction no larger than `-0.015em`. A tiny terminal relationship may align the final `e` exit with I-0's resolved horizontal, but must not reshape the glyph.

A is calmest and most durable; B couples most visibly to hard engineered geometry but may overpower; C is credible yet anonymous. The symbol remains the distinctive element.

## 6. Mark scale and spacing study

Tests: 100%/16px gap, 95%/16px gap, 90%/18px gap relative to a nominal 24px header symbol. **95% with a 16px gap is the lead optical review candidate**: it reduces the heavy-symbol effect without making I-0 timid. **90%/18px** is the fallback for the narrower Bahnschrift lockup. Preserve baseline optically: align the symbol's resolved lower mass slightly above the word baseline rather than its geometric box. Standalone I-0 remains 100% and unchanged.

## 7. Palette A — Mineral Settlement

| Role | Value | Role | Value |
|---|---|---|---|
| Brand Core | `#295D59` | Brand Accent | `#C7A66A` |
| Background | `#24231F` | Surface 1 | `#2A2924` |
| Surface 2 | `#302F2A` | Surface 3 | `#393832` |
| Border Subtle | `#46453E` | Border Strong | `#6B6A61` |
| Text Primary | `#F5F2E9` | Text Secondary | `#BDC5BF` |
| Text Muted | `#969E99` | Settlement Flow | `#7BD5C4` |
| Ambient Light | `#447D76` | Focus Visible | `#7BD5C4` |
| Success | `#89D8A8` | Warning | `#E5BF75` |
| Danger | `#F2A0A0` | Light-background mark | `#244D4A` |
| Dark-background mark | `#7BD5C4` | | |

Warm mineral graphite prevents generic blue-black tooling. Brass is secondary and sparse, not a luxury gradient.

## 8. Palette B — Deep Signal

| Role | Value | Role | Value |
|---|---|---|---|
| Brand Core | `#176E72` | Brand Accent | `#E0A66F` |
| Background | `#0C1724` | Surface 1 | `#101F2E` |
| Surface 2 | `#13283A` | Surface 3 | `#193247` |
| Border Subtle | `#284257` | Border Strong | `#49677B` |
| Text Primary | `#F4F8FA` | Text Secondary | `#B8C9D1` |
| Text Muted | `#879BA6` | Settlement Flow | `#63D9D1` |
| Ambient Light | `#276B75` | Focus Visible | `#63D9D1` |
| Success | `#8FE0AD` | Warning | `#EDB77B` |
| Danger | `#F2A1A1` | Light-background mark | `#12575C` |
| Dark-background mark | `#63D9D1` | | |

Highest infrastructure signal and contrast. Warm state contrast prevents an all-cool system; guard against Arc/Circle adjacency.

## 9. Palette C — Resolved Light

| Role | Value | Role | Value |
|---|---|---|---|
| Brand Core | `#14645F` | Brand Accent | `#8FAE9C` |
| Background | `#111315` | Surface 1 | `#181D1F` |
| Surface 2 | `#20272A` | Surface 3 | `#293235` |
| Border Subtle | `#364144` | Border Strong | `#59676A` |
| Text Primary | `#F7FAF7` | Text Secondary | `#B7C1BF` |
| Text Muted | `#8B9794` | Settlement Flow | `#52C7BD` |
| Ambient Light | `#2E746F` | Focus Visible | `#52C7BD` |
| Success | `#8CDDA9` | Warning | `#D9B86E` |
| Danger | `#EF9B9B` | Light-background mark | `#155B57` |
| Dark-background mark | `#52C7BD` | | |

Most neutral foundation and most restrained proprietary blue-green. The desaturated mineral-green secondary is tonal, not decorative.

## 10. Contrast calculations

WCAG 2 relative luminance: linearize each sRGB channel (`c/12.92` when `c ≤ .04045`, otherwise `((c+.055)/1.055)^2.4`), `L=.2126R+.7152G+.0722B`, ratio `(Llighter+.05)/(Ldarker+.05)`. Values were calculated, not eyeballed.

| Combination | A | B | C | Normal text result |
|---|---:|---:|---:|---|
| Body primary / Background | 14.05 | 16.89 | 17.71 | Pass AAA |
| Secondary / Background | 8.91 | 10.58 | 10.10 | Pass AAA |
| Primary / Surface 2 | 11.98 | 14.12 | 14.42 | Pass AAA |
| Focus / Surface 2 | 7.76 | 8.89 | 7.41 | Pass AAA contrast; use ≥2px outline |
| Success / Surface 2 | 7.95 | 9.65 | 9.41 | Pass AAA |
| Warning / Surface 2 | 7.69 | 8.37 | 7.96 | Pass AAA |
| Danger / Surface 2 | 6.59 | 7.46 | 7.10 | Pass AA; B/C AAA |

No listed combination fails 4.5:1. These values qualify text contrast only; focus also requires visible area/thickness, and status always needs icon + label, never color alone. Muted colors are metadata candidates and must be rechecked against their exact production surface before normal-size use.

## 11. Settlement Light comparison

- A `#7BD5C4`: mineral sea-glass; warmest and most differentiated from generic electric cyan.
- B `#63D9D1`: clearest active signal; most energetic and most likely to resemble ecosystem aqua.
- C `#52C7BD`: quiet resolved teal; most restrained and least glow-dependent.

Use for payment-flow highlight, selected/focus energy, one diagram rail, and limited atmosphere. Do not apply to every button, heading, border or status.

## 12. Gradient policy

Permit one optional atmospheric gradient per palette, never inside or required behind the logo: `Brand Core → Ambient Light → transparent`, 2–3 stops, low opacity (maximum 18% on dark), broad field or linear flow only. No rainbow, neon bloom, animated hue, glass shine, or gradient text. Flat mark colors remain authoritative.

## 13. Financial numeral policy

- Apply tabular numerals to amounts, percentages, split rows and aligned tables; proportional numerals may remain in prose.
- `0.05 USDC`: amount in primary sans semibold; unit at 35–45% smaller, baseline-aligned, one space, uppercase `USDC`, secondary color. Never mono the hero amount.
- `90.00%` and `0.045 USDC`: retain contract-defined precision; do not silently strip zeroes. Decimal-align in tables; right-align numeric columns.
- Order IDs, wallet addresses and transaction hashes: mono at normal weight; lowercase hexadecimal; preserve `0x`; copy action exposes full value.
- Truncation: middle ellipsis only, retaining at least first 6/last 4 characters; larger evidence surfaces prefer first 10/last 6–8. Never truncate the only accessible/copy value.
- Metadata is smaller and muted but remains ≥4.5:1 when essential. Labels use sentence case unless protocol/unit syntax requires uppercase.

## 14. Surface grammar

| Surface | Relationship | Border / depth policy |
|---|---|---|
| PAGE | darkest neutral field | no border; atmospheric gradient optional and sparse |
| PRIMARY SURFACE | first clear lift | subtle border; no routine shadow; large radius |
| SECONDARY SURFACE | one further tonal step | subtle border; medium radius; no glass blur |
| INSET SURFACE | darker or denser than parent | subtle inner boundary; small/medium concentric radius |
| STATUS SURFACE | semantic tint at low saturation | semantic icon + text + restrained border; never hue alone |
| WARNING SURFACE | warm tint separated from brand accent | strong enough border and explicit warning label/icon |
| TECHNICAL EVIDENCE | highest structural clarity, not brightest | mono content; strong border/dividers; minimal translucency |

Shadows are exceptional: one low-opacity, short neutral shadow for floating/overlap only. Translucency is atmospheric, not structural; core commerce surfaces should be opaque enough for stable contrast.

## 15. Radius policy

Mark remains hard engineered. Product UI uses softened financial geometry: **small 6px, medium 10px, large 16px**. Nested surfaces follow concentric logic: child radius ≈ parent radius minus inset. Use 999px only for true status badges/tags and compact segmented controls; no pill cards, pill inputs or decorative pill proliferation. Hard technical diagrams may use 0–4px junctions.

## 16. Iconography relationship

No package selected. Use a 24px base grid, 1.75px nominal stroke (2px at 16px optical size), mostly straight segments with restrained 2px corner rounding, square-to-soft-square joins, and butt/square endpoints for flow; rounded caps only for continuous motion/connection. Icons align optically to text, not merely bounding boxes. Status icons require distinct silhouettes; avoid logo-like chevrons or reproducing I-0.

## 17. Deterministic Branch relationship

May inherit I-0's diagonal family (approximately the dominant converging angle), controlled gap logic, hard engineered junctions, resolved terminal alignment and one Settlement Light rail. It must remain a product diagram: no repeated logo texture, no I-0 payout nodes, no logo-as-arrow, and no reconstruction of the symbol from branches. Converge motion should reduce uncertainty; Resolve motion should finish aligned and still.

## 18. Three combined systems

- **System 01:** Direction A Instrument Sans + Palette A Mineral Settlement. Most humane and materially differentiated; suited to commerce, grant screens and durable institutional trust.
- **System 02:** Direction B Technical Register + Palette B Deep Signal. Strongest engineered/infrastructure statement and compact lockup; carries the highest coldness, availability and ecosystem-aqua risk.
- **System 03:** Direction C Durable System Grotesk + Palette C Resolved Light. Lowest engineering risk and quietest dark product experience; asks I-0 and disciplined color to overcome generic type.

Blind board labels 01/02/03 map to these systems only in this document. Review the blind board before reading scores.

## 19. Genericity risks

This is resemblance analysis, **not trademark clearance**.

- System 01: low generic Web3/AI/crypto-exchange risk; moderate fintech/editorial-mineral risk; low Arc/Circle/Linear/Vercel resemblance. Warm graphite and brass must not become luxury styling.
- System 02: moderate-to-high Arc/Circle/developer-platform and generic Web3 aqua risk; moderate Linear-like precision; low consumer-neobank/playful risk. Avoid blue glow, orbit motifs and over-condensed all-caps.
- System 03: moderate Vercel/Linear/AI-SaaS neutral-interface risk and high generic developer-platform type risk; low Circle/royal-blue/consumer-bank risk. Proprietary spacing and Settlement Light discipline are essential.
- Stripe resemblance remains low if purple/blurred gradients are excluded. None is trademark clearance.

## 20. Engineering and performance implications

- A/B/C as system stacks add zero network request, package or font binary, but platform metrics differ. A and B are Windows-specific at the first choice; deterministic screenshot parity is not guaranteed.
- Arial control is cheapest and most stable but least ownable. System mono remains zero-cost and should not proliferate beyond technical evidence.
- A future local font requires proven license, WOFF2 subsets, preload discipline and `next/font/local`; package font requires dependency/security review; remote web font requires reliability, privacy, CSP and outage/fallback review. None is authorized here.
- Production tokens can map directly to a small CSS-variable set. No remote `@import` decision is made. No package, CSS or app file changed in B2A.

## 21. Scoring

Scores support discussion; they do not make the decision.

| Criterion | Weight | 01 | 02 | 03 |
|---|---:|---:|---:|---:|
| Brand distinctiveness | 15 | 13 | 12 | 9 |
| Financial trust | 15 | 14 | 12 | 13 |
| Infrastructure credibility | 10 | 8 | 10 | 8 |
| Settle mark compatibility | 10 | 9 | 9 | 8 |
| Wordmark quality | 10 | 9 | 8 | 7 |
| Payment numeral quality | 10 | 9 | 10 | 8 |
| Dark UI compatibility | 10 | 9 | 10 | 9 |
| Accessibility | 10 | 9 | 10 | 10 |
| Deck/video compatibility | 5 | 5 | 4 | 4 |
| Long-term extensibility | 5 | 5 | 3 | 4 |
| **Total** | **100** | **90** | **88** | **80** |

## 22. Human-review requirement

Review `SETTLE_VISUAL_SYSTEM_BLIND.svg` first at 100%, then the type, wordmark and color boards. Judge first-impression trust, infrastructure credibility, numeral confidence, I-0/word balance and unwanted category resemblance. Then test board rendering on Windows and one non-Windows environment because live system fonts can substitute. Scores and the lead 95% lockup are recommendations for review, not locks.

**No typography/color system has been selected as final.**

## 23. What remains for B2B

- Human selection of one typography/color system and confirmation of the production font licensing/availability strategy.
- Production-safe font metric and fallback testing across browsers/OS; final tabular feature verification.
- Microscopic mark normalization only if technically necessary; no silhouette reopening.
- Final token naming, exact lockup construction rules, I-0/I-3 export QA, flat monochrome/light-dark masters and production asset generation.
- Later phases own favicon, PNG/PWA/Apple assets, OG image, public assets, app header/footer/integration, final product diagrams and motion implementation.

## Review files

- `SETTLE_TYPE_COMPARISON.svg`
- `SETTLE_WORDMARK_LOCKUP.svg`
- `SETTLE_COLOR_COMPARISON.svg`
- `SETTLE_VISUAL_SYSTEM_BLIND.svg`
- `SETTLE_VISUAL_SYSTEM_REVIEW.md`

The optional dark/light board was not created: the exact flat light/dark behavior is sufficiently specified here, while another board would dilute the required blind review.