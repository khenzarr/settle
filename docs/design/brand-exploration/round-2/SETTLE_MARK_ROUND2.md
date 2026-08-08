# Settle mark exploration — Round 2

**Status:** second-generation design exploration only. No Round-2 candidate has been selected as the final Settle logo.

## Purpose and shared philosophy

Round 1 established useful conceptual DNA—convergence, controlled offset, resolution, negative space, and terminal/finality—but its literal rails, connectors, register bars, and ledger rows repeatedly produced familiar symbols. Round 2 changes the visual interpretation: **unresolved → resolved** is encoded by a static relationship between mass and void, not by a path entering a bar.

All four marks use a compact 24×24 viewBox, flat monochrome fills, no strokes or hairlines, and a refined 2–4 unit mass relationship. G, I, and J use precise polygonal cuts; H uses a controlled engineered perimeter and a structural void. Corners are mostly exact and deliberately faceted rather than generically rounded. The marks are silhouette-first and do not contain a hidden S or any intended Latin letter.

## Why Round 1 was rejected

Human visual review supersedes the previous numeric scoring:

- **A → H** — strong silhouette but reads overwhelmingly as letter H.
- **B → connector/H** — H/connector/routing-like and too mechanically complex.
- **C → pause** — reads overwhelmingly as a pause icon.
- **D → H** — again reads as letter H.
- **E → wallet/container** — reads as wallet/container/battery/briefcase or letterform.
- **F → circuit/developer tool** — reads as circuit/robot/equal/register/developer-tool icon.

None of A–F is accepted as a final direction. The files remain preserved in the parent exploration directory and are not integrated or modified here.

## Candidates

### G — Resolved Offset

Two unequal fields begin with a visibly displaced left facet and resolve through a shared descending shoulder on the right. It is a compact mass, not exposed routing. The small secondary face provides the unresolved offset; the larger field carries the final aligned silhouette.

**First three possible readings**
1. abstract folded resolution mark
2. offset planes becoming one field
3. engineered dimensional symbol

Dominant prohibited-letter test: **pass**; it does not present as H, N, M, S, or another obvious letter. Common-UI-icon test: **pass with medium risk**; the faceting should be reviewed against container/diamond marks at native size.

### H — Controlled Void

A dominant asymmetrical field contains a tapered, vertically displaced void. The interior is a structural change in density, not a letter or a terminal bar. The outer silhouette is intentionally neither circular nor shield-like.

**First three possible readings**
1. abstract resolved field
2. cut stone / engineered aperture
3. two states compressed into one mass

Dominant prohibited-letter test: **pass**; no obvious letter is intended. Common-UI-icon test: **pass with medium risk**; reviewers should specifically check pin, lock, shield, and badge associations.

### I — Interlock / Finality

Two geometrically distinct diagonal fields share a broad offset seam. The forms interlock as a single compact mass without literal rings, chain links, or repeated loops. Stability is expressed by overlap and opposing directional bias.

**First three possible readings**
1. abstract reconciled fields
2. two pieces locked into a stable mass
3. precise folded geometry

Dominant prohibited-letter test: **pass**; it avoids a readable Latin letter. Common-UI-icon test: **pass with medium risk**; it must not be framed as a chain-link or routing icon in blind review.

### J — Resolution Cut

One primary rectangular field is interrupted by a precise concave cut and a smaller internal resolution pocket. The interruption changes the silhouette from complete to resolved without an arrowhead, checkmark, chevron, or play aperture.

**First three possible readings**
1. abstract cut-field mark
2. a stable block with a resolved notch
3. precision infrastructure glyph

Dominant prohibited-letter test: **pass, with letterform risk monitored**; the silhouette is not built from a letter. Common-UI-icon test: **pass with medium risk**; the board exists to test whether the notch becomes play/arrow language at small sizes.

No optional K wildcard was created: no fifth idea was strong and materially different enough to justify adding review noise.

## Size and monochrome review

Native previews are aligned in [`SETTLE_MARK_ROUND2_SMALL.svg`](./SETTLE_MARK_ROUND2_SMALL.svg) at **48, 32, 24, and 16px** on light and dark fields. At 48/32px all four silhouettes retain their main mass relationship. At 24px G and I remain the clearest abstract constructions; H retains the outer/inner contrast; J's cut becomes more categorical and requires external review. At 16px all four technically survive as black/white silhouettes, but technical survival is not treated as brand distinctiveness. The 16px result is therefore: G **pass**, H **pass**, I **pass**, J **marginal brand pass**.

Light/dark monochrome is structurally equivalent: all marks are flat `currentColor` forms and the boards use black on white and white on black. There are no gradients, opacity dependencies, filters, shadows, or color cues.

## Wordmark, product motif, and motion

The exact word `Settle` is shown beside each mark in a neutral Arial/Helvetica system-sans reference. The symbol is scaled below the wordmark's dominant horizontal reading and uses a calm mark-left lockup with a small optical gap. Baselines are aligned by the visual center of the symbol rather than by its raw 24×24 box. No font dependency or converted wordmark is introduced.

The Deterministic Branch product motif remains separate. It may inherit only this round's cut geometry, engineered corner logic, path weight, and alignment behavior; the logo is not a payout diagram.

Future motion is secondary and static-first: a single 600–900ms **CONVERGE / RESOLVE** reveal could offset the G fields, close H's density, seat I's two fields, or introduce J's notch. No loop, bounce, spring, or animation is implemented or required for the mark to work.

## Revised directional scoring

Scores are internal directional judgments, not market validation and do not select a logo. The revised weighting is: specificity 10, distinctiveness 15, first-glance brand quality 15, trust 10, developer infrastructure 10, 16px technical legibility 5, 16px brand distinctiveness 10, monochrome 5, wordmark 5, motion 5, UI 5, deck/video 5.

| Candidate | Specificity | Distinctive | First glance | Trust | Dev infra | 16px tech | 16px brand | Mono | Wordmark | Motion | UI | Deck | Total |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| G | 8 | 12 | 12 | 8 | 8 | 4 | 8 | 5 | 5 | 4 | 4 | 4 | **82** |
| H | 8 | 11 | 11 | 8 | 7 | 4 | 7 | 5 | 4 | 4 | 4 | 4 | **77** |
| I | 9 | 13 | 12 | 8 | 8 | 4 | 8 | 5 | 5 | 5 | 4 | 5 | **86** |
| J | 8 | 10 | 9 | 8 | 8 | 4 | 6 | 5 | 5 | 4 | 5 | 5 | **77** |

Top candidates for **HUMAN review**, not final selection: **I, G, then H/J as category-risk challengers**. The blind board must be judged before reading these names or scores.

## Deliverables

- Labeled board: [`SETTLE_MARK_ROUND2_LABELED.svg`](./SETTLE_MARK_ROUND2_LABELED.svg)
- Blind board: [`SETTLE_MARK_ROUND2_BLIND.svg`](./SETTLE_MARK_ROUND2_BLIND.svg)
- Small-size board: [`SETTLE_MARK_ROUND2_SMALL.svg`](./SETTLE_MARK_ROUND2_SMALL.svg)
- Individual marks: `candidate-g.svg`, `candidate-h.svg`, `candidate-i.svg`, `candidate-j.svg`

**No Round-2 candidate has been selected as the final Settle logo.**