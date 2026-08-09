# Settle production brand guide

**Phase:** D4D0.6B2B1 · **Authority:** production foundation · **Integration:** deferred to D4D0.7

## 1. Brand core

Settle is programmable USDC settlement infrastructure for modern commerce. Its locked territory, **Convergent Ledger**, expresses independent conditions reconciling into one stable final state. The identity is precise, composed, technical, financially credible, and truthful about state. It is not a coin, chain, wallet, generic blockchain network, Arc/Circle sub-brand, or speculative crypto identity.

## 2. Symbol

- **I-0 master:** `assets/symbol/settle-symbol-master.svg`, sourced exactly from `docs/design/brand-exploration/round-2/candidate-i.svg`.
- **I-3 optical small:** `assets/symbol/settle-symbol-small.svg`, sourced exactly from `docs/design/brand-exploration/finalist/candidate-i3.svg`.
- Both use `viewBox="0 0 24 24"`, hard engineered corners, flat fill, and `currentColor`. Do not edit, normalize, combine, round, stroke, or reconstruct path coordinates.
- One neutral geometry per optical role is authoritative. Apply approved colors through CSS/export mapping instead of creating duplicate geometry.

### Color mappings

| Mode | Value | Typical ground |
|---|---:|---|
| Mono dark | `#244D4A` | white/off-white/light field |
| Mono light | `#F5F2E9` | Mineral Settlement dark field |
| Settlement Light | `#7BD5C4` | controlled symbol-only accent on dark |
| Brand Core | `#295D59` | approved flat use where contrast is verified |

## 3. I-0 / I-3 routing

| Render/context | Required geometry |
|---|---|
| 16px | I-3 |
| 20px | I-3 |
| 24px | I-0 |
| 32px | I-0 |
| 48px | I-0 |
| 64px+ | I-0 |
| favicon / tiny browser or product icon | I-3 where supported/appropriate |
| product header / brand lockup | I-0 |
| deck / social / presentation | I-0 |

Do not silently use I-3 above 20px. If an unsupported size falls between 20px and 24px, change the layout to an approved size rather than inventing a routing exception.

## 4. Wordmark

The word is exactly **Settle**. It is live text in Instrument Sans, the approved production family. The horizontal SVG remains a spec-safe live-text reference until portable outlined-vector export is decided in B2B2. Current production specification:

```css
font-family: "Instrument Sans", "Segoe UI Variable", "Segoe UI", Arial, sans-serif;
font-weight: 600;
letter-spacing: 0;
```

Native spacing is preferred; a future renderer-specific `tt` correction must be reviewed and must not exceed `-0.015em`. No glyph outlines are authorized in B2B1. See `SETTLE_FONT_PRODUCTION_DECISION.md`.

## 5. Horizontal lockup

The default relationship is immutable: complete I-0 at **34px optical size**, then a **14px clear mark-to-word gap**, then live `Settle`. Preserve the complete two-path mark and its aspect ratio. Optical baseline alignment may place the mark's resolved lower mass slightly above the text baseline; do not change the 34/14 relationship ad hoc.

`assets/lockups/settle-lockup-horizontal.svg` is a spec-safe live-text asset. Because live SVG text resolves against installed fonts, it is not a metrically portable outlined wordmark and must not be treated as one.

## 6. Stacked lockup

Compose complete I-0 above live `Settle`, centered on one optical axis. Use a vertical mark-to-word space of **0.5 mark height**. This derives from the approved deck direction and is independent of the horizontal 34/14 token. Keep I-0 at least 48px in presentation use so the stacked word has credible scale. This is a composition specification, not an outlined SVG export.

## 7. Descriptor lockup

The deck signature is:

1. I-0
2. `Settle`
3. `Programmable USDC settlement infrastructure`

Center the descriptor below `Settle` with **0.5 wordmark cap-height** optical separation. Descriptor text uses the primary sans at regular/medium weight, never competes with `Settle`, and may wrap only as an intentionally typeset presentation composition. The descriptor is not part of the immutable legal/product wordmark.

Definitions:

- **Symbol:** I-0 or routed I-3 geometry alone.
- **Wordmark:** live text `Settle`.
- **Brand lockup:** symbol plus wordmark in an approved composition.
- **Descriptor lockup:** approved brand lockup plus the descriptive line.

## 8. Clearspace

Define `x` as one canonical mark viewBox unit: **1/24 of the rendered mark height**. This is reproducible directly from the geometry coordinate system.

- Symbol: at least **4x** on every side (one-sixth of mark height).
- Horizontal lockup: at least **6x** around the complete lockup; the internal 14px mark-to-word gap remains fixed and is not clearspace.
- Stacked and descriptor lockups: at least **6x** based on the rendered I-0 mark around the complete composition.

More space is encouraged; less is not. Neighboring crop edges, UI chrome, ecosystem marks, and text all count as intrusions.

## 9. Minimum sizes

- Symbol only: **16px minimum** using I-3; use I-3 only through 20px. I-0 minimum is **24px**.
- Horizontal lockup: **34px mark height minimum**, retaining the 14px gap; if space is smaller, use the routed symbol rather than microscopic text.
- Stacked lockup: **48px I-0 mark height minimum**.
- Descriptor lockup: **64px I-0 mark height minimum** and descriptor text at least **12px** in screen output.

These are production floors, not encouragement to use the identity as small as possible.

## 10. Color system

### Canonical Mineral Settlement tokens

| Token | Exact value |
|---|---:|
| Background | `#24231F` |
| Surface 1 | `#2A2924` |
| Surface 2 | `#302F2A` |
| Surface 3 | `#393832` |
| Border Subtle | `#46453E` |
| Border Strong | `#6B6A61` |
| Primary Text | `#F5F2E9` |
| Secondary Text | `#BDC5BF` |
| Muted Text | `#969E99` |
| Brand Core | `#295D59` |
| Settlement Light | `#7BD5C4` |
| Brand Accent | `#C7A66A` |
| Focus | `#7BD5C4` |
| Success | `#89D8A8` |
| Warning | `#E5BF75` |
| Danger | `#F2A0A0` |
| Ambient Light | `#447D76` |
| Light-background mark | `#244D4A` |
| Dark-background mark | `#7BD5C4` |

### Hierarchy

Primary brand presentation prefers Primary Text symbol/wordmark on the Mineral background, or an approved flat monochrome treatment. Settlement Light is controlled energy for a symbol-only accent, product rail, focus/active state, and restrained highlight—not every lockup. Brand Accent is rare editorial/mineral emphasis and never a universal CTA, status substitute, or universal identity color.

Gradients are optional atmosphere only: 2–3 broad low-opacity stops based on Brand Core → Ambient Light → transparent, maximum 18% opacity on dark. They never enter or become required behind the logo.

## 11. Background use

- **Mineral background `#24231F`:** Primary Text is the preferred complete lockup; Settlement Light may accent the symbol only in controlled use.
- **White / off-white:** use Mono Dark `#244D4A` or a contrast-verified Brand Core treatment.
- **Transparent:** the embedding context owns a single approved `color`; verify contrast before delivery.
- **Photographic/complex:** use the flat logo only where a quiet area provides reliable contrast. Otherwise place it on an opaque Mineral or light safe field with full clearspace. A glass panel, glow, gradient, or shadow is not a recognition requirement.
- Never split the two mark pieces into arbitrary colors. Essential identity must survive one-color reproduction.

## 12. Typography

Direction A remains calm contemporary grotesk. B2B1 locks Instrument Sans as the production primary under the externally verified SIL Open Font License 1.1, with appropriate system sans fallbacks. Display 650–750, headings 600–700, body 400–500, and UI 550–650 are directional ranges; use sentence case and restrained tracking. Reserve `Consolas, "SFMono-Regular", monospace` for protocol/technical evidence. No font binary is packaged in B2B1; app integration is pending D4D0.7.

## 13. Numeric typography

- Amounts, percentages, split rows, and aligned tables use tabular numerals where supported; hero/payment amounts stay in the primary sans.
- Preserve contract-defined precision and significant/trailing zeroes. Right-align numeric columns and decimal-align where relevant.
- `USDC` is uppercase; in amount lockups it may be 35–45% smaller, baseline-aligned, one space after the amount, and Secondary Text.
- IDs, addresses, and hashes use normal-weight technical mono. Preserve lowercase hexadecimal and `0x`.
- Middle truncation retains at least first 6/last 4; larger evidence prefers first 10/last 6–8. The full value remains available to users and assistive technology.

## 14. Surface system

Page uses Background with no border and optional sparse atmosphere. Primary uses Surface 1 plus Border Subtle; secondary uses Surface 2; inset/technical evidence uses Surface 3 or a contextually denser parent relationship. Technical evidence prioritizes strong dividers/Border Strong rather than brightness. Status and warning surfaces use low-saturation semantic treatment plus explicit icon and text. Core commerce surfaces remain opaque enough for stable contrast. Glass blur and routine shadows are prohibited; one short neutral shadow is reserved for genuine overlap/floating.

## 15. Radius

- Small **6px**; medium **10px**; large **16px**.
- Child radii follow concentric geometry: approximately parent radius minus inset.
- `999px` is semantic pills/tags and appropriate compact controls only—not cards or inputs.
- Technical diagram junctions may be 0–4px. The logo remains hard-cornered.

## 16. Iconography

Use a 24px grid, nominal ~1.75px stroke, and 2px optical weight at 16px where needed. Prefer straight segments, restrained rounding, controlled joins, and butt/square flow endpoints; round caps only when continuous connection warrants them. Align optically to text. No library is selected and no icons are drawn in B2B1. Icons must not reconstruct or imitate I-0.

## 17. Deterministic Branch

Product visuals may inherit the diagonal angle family, intentional gaps, engineered junctions, resolved alignment, hard cut logic, and one Settlement Light rail. They must not copy/reconstruct I-0, use it as a payout node, repeat logos as diagram grammar, or turn I-0 into arrows. The motif explains state/routing; it is not a second mark.

## 18. Motion handoff

D4D0.8 owns implementation of **Converge / Resolve**: 650–800ms target, one-shot, controlled, no spring, no bounce, no loop, and complete final stillness. The final frame must equal approved static geometry. Reduced motion resolves immediately with explicit state; motion never implies confirmation before canonical truth.

## 19. Accessibility

Verify each exact token/surface/size/weight combination. Essential normal text meets at least 4.5:1. Focus uses Settlement Light with at least a 2px visible outline and separation. Color never communicates status alone. Informative symbols/icons need accessible names; redundant ones are hidden. Preserve reading order, full technical values, text alternatives, and reduced-motion behavior. Direction lock is not blanket certification.

## 20. Do / don't

**Do:** preserve exact paths, route by size, use complete I-0 in lockups, keep flat contrast, retain clearspace, and separate ecosystem attribution.

**Do not:** stretch, rotate, skew, outline, add drop shadow, neon glow, arbitrary gradient, random piece colors, reconstruct I-0, enlarge I-3, put I-0 in a circle by default, add blockchain/coin motifs, add Arc/Circle marks to a Settle lockup, use the symbol as payout-node pattern, alter the 34px/14px relationship, or use Brand Accent universally.

## 21. Production asset architecture

```text
production/
  assets/
    symbol/   # authoritative currentColor I-0 and I-3 masters
    lockups/  # approved compositions; live-text boundary documented
  spec/       # reserved for later machine-readable/export specs
  qa/         # production QA gates
  SETTLE_PRODUCTION_BRAND_GUIDE.md
  SETTLE_ASSET_MATRIX.md
  SETTLE_FONT_PRODUCTION_DECISION.md
```

Production sources remain in docs until D4D0.7. Consumers must not copy/edit geometry into parallel masters.

## 22. B2B2 export handoff

B2B2 may create favicon SVG/ICO and 16/32/48 raster checks, Apple 180, PWA 192/512, maskable safe-zone export, social avatar, and OG/social card only after human approval. It must route I-3 for favicon/tiny sizes, I-0 otherwise; verify transparency, color profile, naming, maskable safe zone, favicon legibility, and OG safe areas; and record the export tool/version. No raster export exists in B2B1.

## 23. D4D0.7 application handoff

After B2B completion, D4D0.7 may copy approved deliverables into application/public locations, establish Instrument Sans typography and color tokens, evaluate the installed-version-compatible built-in `next/font` path, wire metadata/icons, and test responsive header/checkout contexts. It must verify `tnum`, fallback rendering, loading/layout shift, and cross-platform screenshots. It must not import exploration assets, resolve licensing by assumption, change geometry, or bypass I-0/I-3 routing. No application integration occurs in this phase.