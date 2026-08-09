# Settle final visual system decision — D4D0.6B2A-R6

## 1. Decision status

**Status:** final human visual-system decision record for D4D0.6B2A.
**Starting HEAD:** `54c40491e19a6227c3831f3b305b7efb11cd2ead` (`HEAD == origin/main` at preflight).
**Production status:** direction is locked; production assets have not yet been generated. No app integration is authorized in this phase.

This record supersedes B2A automated scoring and recommendations wherever they differ from the human selections below. It does not modify the five existing B2A review files and remains uncommitted with them.

## 2. Human-review process

Human review is complete and produced these authoritative selections:

- Blind combined-system review: **System 01 won**.
- Typography review: **Direction A won**.
- Color review: **Mineral Settlement won**.
- Horizontal-lockup review: **Candidate 02 / 34px / 14px won**.

The review considered first-impression trust, infrastructure credibility, numeral confidence, I-0/word balance, category resemblance, and the combined behavior of mark, type, color, surfaces, and product motif. Human selections override automated scores, lead-candidate recommendations, and exploratory rankings.

## 3. Locked mark inputs

The brand territory is **Convergent Ledger**: independent conditions reconcile into a stable final state.

- **Master mark: I-0**.
  - Source: `docs/design/brand-exploration/round-2/candidate-i.svg`.
  - Default use: 24px and above unless a specific lockup or context defines otherwise.
- **Optical-small mark: I-3**.
  - Source: `docs/design/brand-exploration/finalist/candidate-i3.svg`.
  - Use: 16–20px, favicon, and very small UI contexts.

I-3 must not replace master I-0 at normal sizes. I-0 geometry is locked and must not be altered. B2B must establish authoritative production masters and routing rules without reopening the silhouettes.

## 4. Typography direction lock

**Direction A** is locked as the typographic direction: a **calm contemporary grotesk** with high legibility, financial credibility, moderate human warmth, technical neutrality, and a strong commerce-plus-infrastructure balance.

The B2A exploration rendered this direction with:

```css
"Segoe UI Variable", "Segoe UI", Arial, sans-serif
```

This is a direction lock, not approval of an exact production font, binary, distribution method, or platform strategy. The symbol remains the principal proprietary visual element; typography should support it without novelty cuts or forced logo-like behavior.

## 5. Production-font licensing boundary

The exact production font remains pending the **D4D0.6B2B licensing and implementation gate**. Repository evidence does not establish redistribution rights for Segoe UI Variable, Segoe UI, Bahnschrift, Arial, or Consolas. Local installation is not proof of packaging, self-hosting, redistribution, embedding, or conversion rights.

- No proprietary font binary may be committed without verified rights.
- No proprietary wordmark glyph may be converted into a distributable path asset without licensing review.
- No remote, package, system-only, or locally hosted production-font strategy is approved by this record.
- Cross-platform metrics, fallback behavior, tabular-feature support, browser rendering, performance, privacy, CSP, and availability remain implementation concerns for B2B.

## 6. Numeric / technical typography

- Hero and payment amounts use the primary sans, with tabular numerals where supported; they are **not mono by default**.
- Percentages, split rows, and tables use tabular numerals. Numeric columns are right-aligned and decimal-aligned where relevant.
- Preserve contract-defined precision; do not silently remove significant or required trailing zeroes.
- `USDC` is uppercase. In amount lockups, the unit may be 35–45% smaller, baseline-aligned, separated by one space, and rendered in a secondary color.
- IDs, wallet addresses, and transaction hashes use a technical mono companion at normal weight. Preserve protocol syntax such as lowercase hexadecimal and `0x` where applicable.
- Middle truncation must preserve an identifying prefix and suffix. Retain at least the first 6 and last 4 characters in compact contexts; larger evidence surfaces should prefer the first 10 and last 6–8.
- The full technical value must remain available through copy or details and must never exist only in truncated form.

Direction B remains a numeric/technical reference only. Direction C remains the generic control and is not the final brand direction.

## 7. Mineral Settlement palette

**Mineral Settlement** is the locked palette. Its warm mineral graphite avoids generic blue-black tooling, while its controlled sea-glass energy supports settlement flow. The brass accent is deliberately sparse and must not turn the system into luxury styling.

The semantic and structural roles below form the basis for B2B token definition and production validation.

## 8. Exact locked color values

| Role | Locked value | Role | Locked value |
|---|---|---|---|
| Background | `#24231F` | Brand Core | `#295D59` |
| Brand Accent | `#C7A66A` | Settlement Light / Settlement Flow | `#7BD5C4` |
| Primary Text | `#F5F2E9` | Secondary Text | `#BDC5BF` |
| Success | `#89D8A8` | Warning | `#E5BF75` |
| Danger | `#F2A0A0` | Surface 1 | `#2A2924` |
| Surface 2 | `#302F2A` | Surface 3 | `#393832` |
| Border Subtle | `#46453E` | Border Strong | `#6B6A61` |
| Text Muted | `#969E99` | Ambient Light | `#447D76` |
| Focus Visible | `#7BD5C4` | Light-background mark | `#244D4A` |
| Dark-background mark | `#7BD5C4` | | |

These values are exact B2A locks or retained Mineral Settlement basis values. B2B may formalize token names and usage tests but must not silently substitute the palette.

## 9. Color-usage hierarchy

**Settlement Light `#7BD5C4` is the primary controlled brand energy.** Use it for settlement flow, focused or active brand energy, controlled atmospheric light, selected diagram rails, and product motion accent. Do not apply it to every component, button, heading, border, or status.

**Brand Accent `#C7A66A` is intentionally rare.** Appropriate uses may include a small mineral/editorial detail, a selective diagram annotation, or rare deck emphasis. It is not:

- a universal CTA;
- the default interactive color;
- generic card decoration;
- a replacement for success or warning semantics; or
- a required logo gradient.

Brand Core establishes identity and structural grounding. Semantic success, warning, and danger colors retain their distinct meanings and must not be replaced by brand colors. Status communication always combines color with a label and/or distinct icon.

## 10. Gradient policy

Gradients are optional atmospheric devices only. Use at most 2–3 controlled stops, with broad restrained fields and low opacity. An acceptable basis is `Brand Core → Ambient Light → transparent`, with a maximum 18% opacity on dark backgrounds.

Gradients are never required for logo recognition and must not appear inside or be required behind the mark. Do not use rainbow or neon treatments, animated hue, glass shine, gradient text as identity, or a glow-dependent logo. Flat mark colors remain authoritative.

## 11. Horizontal lockup decision

**Candidate 02** is locked as the default horizontal Settle brand lockup and product-header reference:

- rendered optical master-mark size: **34px I-0**;
- mark-to-word gap: **14px**;
- mark geometry: exact I-0, unaltered; and
- word: live `Settle` typography until the production font and export strategy are legally and technically resolved.

The rendered lockup size is context-specific and does not change standalone I-0 geometry or the general 24px-and-above master-mark rule. Final baseline, metrics, clearspace, and exported construction belong to B2B.

## 12. Rejected lockup candidates

- **30px / 14px** was rejected because the mark reads too much like a small icon beside the wordmark.
- **38px / 16px** was rejected because the mark begins to dominate the wordmark in compact header use.

These candidates are not fallback production lockups.

## 13. Stacked / deck direction

The current stacked composition passes human review:

1. I-0
2. `Settle`
3. `Programmable USDC settlement infrastructure`

This is a compositional direction, not a final exported production asset. B2B must define exact spacing, typography, alignment, clearspace, backgrounds, and stacked/compact asset variants.

## 14. Surface hierarchy

The B2A surface direction is retained:

| Surface | Relationship | Border / depth policy |
|---|---|---|
| Page | Darkest neutral field | No border; optional sparse atmosphere |
| Primary surface | First clear lift | Subtle border; no routine shadow; large radius |
| Secondary surface | One further tonal step | Subtle border; medium radius; no glass blur |
| Inset surface | Darker or denser than parent | Subtle inner boundary; small/medium concentric radius |
| Status surface | Low-saturation semantic tint | Semantic icon + text + restrained border; never hue alone |
| Warning surface | Warm tint distinct from brand accent | Explicit warning label/icon and sufficiently strong border |
| Technical evidence | Highest structural clarity, not brightest | Mono content; strong border/dividers; minimal translucency |

Core commerce surfaces should be opaque enough for stable contrast. Translucency is atmospheric rather than structural. Shadows are exceptional and limited to a low-opacity, short neutral shadow for genuine floating or overlap.

## 15. Radius system

- Small: **6px**.
- Medium: **10px**.
- Large: **16px**.
- Nested surfaces use concentric logic: child radius is approximately the parent radius minus the inset.
- `999px` is reserved for semantic badges/tags and appropriate compact controls.
- Avoid pill cards, pill inputs, and decorative pill proliferation.
- Hard technical diagram junctions may use 0–4px.

The brand mark remains hard engineered. Product surfaces use controlled softened financial-interface geometry.

## 16. Iconography direction

- 24px base grid.
- Nominal stroke around 1.75px.
- 2px optical treatment where necessary at 16px.
- Mostly straight segments with restrained rounding.
- Controlled endpoints; butt or square endpoints for flow, with rounded caps only where continuous motion or connection warrants them.
- Optical alignment to adjacent text rather than mechanical bounding-box alignment.
- Distinct status silhouettes.

Icons must not imitate I-0, use logo-like chevrons, or reconstruct the mark. No icon package decision is made in B2A.

## 17. Deterministic Branch relationship

**Deterministic Branch** remains the product visual companion. It may inherit:

- the diagonal family;
- controlled gap logic;
- an engineered junction;
- resolved alignment; and
- one Settlement Light rail.

It must not repeat the logo as payout nodes, reconstruct I-0, turn I-0 into arrows, or become a logo pattern. It remains product information and motion language rather than a secondary mark.

## 18. Motion identity

The primary brand motion is **Converge / Resolve**. Production behavior belongs to D4D0.8 and is not implemented now.

The intended behavior is one-shot, controlled, approximately 650–800ms, without bounce, spring, or loop, and ending in complete stillness. Converge should reduce uncertainty; Resolve should finish aligned and stable.

## 19. Accessibility boundary

B2A calculations found the specified primary, secondary, focus, success, warning, and danger combinations compliant for the tested Mineral Settlement surfaces; production accessibility still requires contextual verification.

- Recheck every text and UI role against its exact production surface, size, weight, and state.
- Essential normal-size text must meet at least 4.5:1; muted metadata requires special scrutiny.
- Focus uses `#7BD5C4` and should have a visible outline of at least 2px with adequate area and separation.
- Never communicate status, warning, success, danger, selection, or settlement progress by color alone.
- Preserve full IDs and addresses through accessible copy/details behavior.
- Motion implementation must respect reduced-motion preferences and must not rely on looping or glow for comprehension.
- Asset, favicon, monochrome, and light/dark contrast must be validated during production export QA.

This record locks direction; it is not a blanket accessibility certification for future implementations.

## 20. Legal / originality boundary

This is a visual-direction and resemblance decision, not legal clearance. This record does **not** claim:

- trademark clearance;
- worldwide uniqueness;
- registered trademark status; or
- font redistribution, embedding, outlining, or packaging rights without evidence.

No proprietary font files are authorized. Any trademark search, jurisdictional clearance, registration, font-license interpretation, or distributable wordmark-outline decision requires qualified review and documented evidence. Category-resemblance observations in the B2A review are design-risk analysis only.

## 21. What remains for D4D0.6B2B

B2B must still resolve:

- production font strategy and licensing;
- authoritative production SVG masters;
- wordmark/export strategy;
- monochrome variants;
- color variants;
- horizontal lockup asset;
- stacked/compact variants;
- optical-small routing;
- favicon;
- ICO;
- app icons;
- Apple touch;
- PWA 192/512;
- maskable asset;
- social/OG assets;
- clearspace;
- minimum-size rules;
- background rules;
- misuse rules;
- asset matrix;
- production brand guideline;
- SVG safety; and
- export QA.

No app integration occurs in B2A. Production font metric/fallback testing, tabular-feature verification, exact token naming, lockup construction, and platform/browser validation are part of the B2B implementation gate where applicable.

## 22. Immutable summary

| Decision | Immutable lock |
|---|---|
| MASTER MARK | **I-0** |
| OPTICAL SMALL | **I-3** |
| TYPE DIRECTION | **Direction A / calm contemporary grotesk** |
| EXACT PRODUCTION FONT | **pending B2B licensing/implementation gate** |
| PALETTE | **Mineral Settlement** |
| BACKGROUND | **`#24231F`** |
| BRAND CORE | **`#295D59`** |
| SETTLEMENT LIGHT | **`#7BD5C4`** |
| BRAND ACCENT | **`#C7A66A`** |
| PRIMARY TEXT | **`#F5F2E9`** |
| SECONDARY TEXT | **`#BDC5BF`** |
| HORIZONTAL LOCKUP | **34px I-0 / 14px gap** |
| MOTION | **Converge / Resolve** |
| PRODUCT MOTIF | **Deterministic Branch** |

**D4D0.6B2A visual-system design decisions are locked; production assets have not yet been generated.**