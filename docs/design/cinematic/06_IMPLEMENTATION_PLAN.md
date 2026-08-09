# D4D0.8C cinematic implementation plan

**Planning authority:** D4D0.8C.1  
**Current state:** Creative direction and storyboard ready for human review  
**Implementation status:** D4D0.8C.2 prototype ready for human creative review; production application and binary asset work remain out of scope

## 1. Delivery strategy

Validate the story as inexpensive stills and an animatic before producing final media or integrating the homepage. Each phase has a human approval gate. This prevents visual polish, codec work, or application integration from masking a weak product narrative and minimizes future micro-fix loops.

## 2. D4D0.8C.2 — Visual prototype and animatic

### Goal

Prove The Settlement Register’s composition, escrow moment, programmed split, finality, mobile re-composition, and loop cadence without production application changes.

### Deliverables

- Desktop style frames for Scenes 00, 02, 04, 06, and 07/rest.
- Mobile style frames for escrow and resolved poster.
- Low-fidelity 12s animatic using the exact storyboard timing.
- Proposed exact amount/share example and label density tests.
- Copy-safe overlays at target breakpoints.
- Originality/contact sheet comparing the work only against prohibited pattern categories—not imported third-party assets.
- Initial codec feasibility encode kept outside the repository unless explicitly approved.

### Prototype findings

- **Location:** `docs/design/cinematic/prototype/index.html` with adjacent CSS and presentation-only JavaScript. It is intentionally not a Next route and has no package dependency.
- **Cadence:** The 12.0s starting cadence remains legible in the vector animatic: 7.2s narrative followed by 4.8s meaningful rest. The rest is not too long for a hero review because the resolved frame carries the complete model; test a 4.0–4.8s authored rest again during C3 once compositing texture is present.
- **Escrow hold:** A visibly quiet controlled hold is represented from approximately 3.05–4.15s, with a selected conceptual hold of **~700ms** inside that beat. This communicates HOLD → RESOLVE more clearly than 550ms without the stuck feeling of 900ms.
- **Poster frame:** Select the resolved state at **7.45s semantic time**: calibrated recipient rails, `SETTLED`, and the persistent canonical baseline are all visible, while the escrow chamber remains readable. This is stronger than a generic network frame and is the reduced-motion preview state.
- **Program rule:** The prototype uses small `70 / 20 / 10` calibration ticks and restrained values as illustrative grammar only, never as a Settle default, live order, or pricing claim. C3 should retain proportional rule geometry if larger numbers reduce cinematic quality.
- **Composition:** Desktop reserves a low-contrast left copy-safe foreground and places the mechanism in the right midground over a sparse ledger field. Mobile is a separate 390px vertical plate: ORDER → INTENT → central ESCROW → PROGRAM → three short recipient rails → REGISTER, with materially reduced field geometry and flatter depth.
- **Accessibility:** The prototype exposes an understated functional Pause/Resume control, Play/Replay, keyboard Space pause/resume, and a static Reduced motion preview. Because this is a >5s autoplay concept, the production recommendation is **Model A** (autoplay with a quiet persistent pause/resume control), subject to WCAG review; Model B remains the fallback if the control compromises the hero.
- **Reset:** The animatic returns through a low-attention editorial dissolve window rather than reversing rails or implying a refund. The CSS cycle re-enters the quiet register state without a black flash.
- **Technology reassessment:** Authored opaque video remains primary for C3 because this prototype validates the fixed-camera story but cannot reproduce production compositing, texture, and exact light economically. A responsive resolved SVG/poster remains the fallback. No production technology decision changes in C2.
- **Review note:** At widths `≤360px`, use poster-only in production rather than further compressing the active mobile rail composition.

### Review questions

1. Can viewers identify order, escrow, programmed split, recipients, and finality without narration?
2. Is the escrow hold the most ownable moment?
3. Does the split feel exact rather than explosive?
4. Does stillness feel intentional for the full rest?
5. Is the visual recognizably Settle and free from Web3/HUD clichés?
6. Does mobile feel authored rather than cropped?

### Gate

Human creative approval of one desktop composition, one mobile composition, one resolved poster, and the 7.2s + 4.8s cadence. The local prototype provides all three review modes without a video dependency. If comprehension fails, return to storyboard; do not compensate with more labels or a complex runtime.

## 3. D4D0.8C.3 — Production master and web derivatives

### Goal

Produce the approved scene as Settle's authored cinematic settlement world in an editable browser/SVG source master. Web derivatives remain a later C4/C5 concern; no binary media is committed in C3.

### Selected production decisions

- Desktop plate: 1440 × 900, mechanism center-right, approximately 42–44% left copy-safe falloff.
- Mobile plate: separate 780 × 1688 source presented at 390 × 844; not a desktop crop; secondary field geometry reduced by at least 50%.
- Cycle: 10.2s total — 6.7s narrative, 3.1s finality/rest, 0.4s authored editorial reset.
- Hold: approximately 700ms inside the escrow beat.
- Labels: `ORDER`, `INTENT`, `ESCROW`, `PROGRAM`, `REGISTER` only; literal `70 / 20 / 10` and dominant amounts removed.
- Background: low-contrast mineral ledger field with only subtle non-semantic life during rest.
- Source/runtime boundary: richer masks, grain, localized blur, and restrained bloom are source-only; pre-rendered video + resolved poster remains the runtime recommendation.
- Reset: active luminance recedes, the resolved register integrates into the field, and a clean new editorial state emerges; no rail reversal or rewind.

### Deliverables

- Desktop and mobile source masters retained in an approved design-production location.
- Visually lossless mezzanine renders retained outside the web repository.
- Desktop standard VP9 WebM and H.264 MP4.
- Mobile VP9 WebM and H.264 MP4.
- Optional AV1 test only if it yields ≥20% measured saving at equal quality.
- Desktop and mobile resolved posters; SVG preferred when export quality/source cleanliness passes.
- Render/export manifest recording tool versions, frame rate, duration, color space, codec settings, dimensions, sizes, hashes, and source ownership.
- Compression QA notes for banding, edge ringing, color drift, and loop continuity.

### Gate

Creative fidelity and hard size caps pass:

- desktop primary ≤1.60MB;
- mobile primary ≤850KB;
- desktop/mobile poster ≤130KB/85KB hard limits;
- no alpha and no audio track;
- seamless authored reset and at least 4.0s true resolved stillness.

If budgets fail, simplify background strata, glow, raster, or frame rate before raising caps.

## 4. D4D0.8C.4 — Homepage integration

### Goal

Integrate poster-first progressive enhancement into the approved homepage while preserving live copy, CTA, legibility, and layout stability.

### Intended scope

- Add a dedicated decorative cinematic component or equally narrow integration boundary.
- Reserve aspect ratio and render fallback ground/poster first.
- Select one desktop or mobile source set without duplicate downloads.
- Use native muted inline video; no animation dependency.
- Apply copy exclusion mask/readability veil.
- Handle `play()` rejection and media errors silently by retaining poster.
- Pause on hidden document and, if justified, when sufficiently offscreen.
- Keep current hero settlement model available behind a reversible feature/integration decision until QA approves replacement.

### Non-goals

- No checkout changes.
- No canonical product-state animation.
- No live order data in the film.
- No generalized animation framework.
- No autoplay audio, user tracking, device fingerprinting, or WebGL.

### Gate

Code review confirms narrow ownership, no dependency, no product-state coupling, no duplicate source requests, and no regression to current hero content or actions.

## 5. D4D0.8C.5 — Responsive, reduced-motion, and degradation hardening

### Goal

Make the complete experience truthful and useful across sizes, preferences, network policy, and playback failure.

### Deliverables

- Validated breakpoints at 320, 360, 390, 430, 768, 1024, 1280, 1440, and 1920px.
- Distinct mobile source selection and crop QA.
- `prefers-reduced-motion` poster-only path with no video request.
- Save-Data poster-only path.
- Autoplay rejection, source error, timeout, hidden-tab, and offscreen behavior.
- No-JavaScript and media-blocked fallback verification.
- Assistive-technology semantics and equivalent text review.
- WCAG moving-content decision: either approve long-rest loop with pause control as needed or adopt one-shot-then-poster.

### Gate

Every fallback displays the resolved system and complete live product message with zero layout shift. No preference path briefly starts or downloads forbidden motion.

## 6. D4D0.8C.6 — Performance and browser QA

### Goal

Demonstrate that cinema remains subordinate to page and product performance.

### Matrix

- Chrome, Edge, Firefox on Windows/macOS as available.
- Safari on current macOS/iOS.
- Chrome on midrange and lower-end Android.
- Normal, throttled, Save-Data, reduced motion, autoplay blocked, background tab, and return-to-viewport cases.
- 100%, 200%, and relevant text zoom/reflow checks for foreground UI.

### Measurements

- actual transfer requests and sizes;
- LCP/CLS p75 target modeling and lab comparison;
- long tasks and startup scripting;
- frame stability;
- CPU/GPU/memory over five cycles;
- thermal/battery observation on mobile;
- color/contrast against active frames;
- checkout and wallet/API resource isolation.

### Gate

All hard limits in `05_PERFORMANCE_AND_ACCESSIBILITY.md` pass. A failed lower-end class receives poster or one-shot fallback rather than runtime complexity.

## 7. D4D0.8C.7 — Human creative and product QA

### Goal

Approve the final experience as a truthful, distinctive Settle narrative—not merely a technically valid asset.

### Review panel tasks

- Five-second comprehension test.
- Silent full-cycle viewing.
- Reduced-motion/poster-only viewing.
- Desktop and mobile side-by-side review.
- Product-truth audit by someone familiar with canonical approve/fund, escrow, settlement decision, split, and finality semantics.
- Originality audit against token bridge, swap, node network, wallet particles, stablecoin coin, bank dashboard, gradient orb, HUD, and logo-as-diagram patterns.
- Grant-demo screen-recording test with the proposed narration.

### Approval statement required

Reviewers should be able to agree:

> The scene clearly explains one payment entering controlled escrow and resolving through programmed terms into exact marketplace settlement, without claiming that an illustrative animation is a real or automatically finalized transaction.

## 8. D4D0.8C.8 — Release and documentation reconciliation

### Goal

Ship only approved optimized derivatives and reconcile the motion/brand records.

### Deliverables

- Approved application media assets only; no masters, tests, or temporary renders.
- Final asset manifest and ownership/source record.
- Updated homepage/media documentation.
- Updated Settle motion-system record explicitly separating 8C cinema from D4D0.8D canonical product motion.
- Cache/deployment verification on Vercel.
- Before/after performance evidence and human sign-off.
- Cleanup of superseded hero model only after final acceptance; no premature deletion.

### Gate

Repository contains no unapproved binary experiments, dependency changes, or duplicated superseded assets. Rollback to poster/current hero remains straightforward.

## 9. Relationship to D4D0.8D

D4D0.8C creates explanatory cinema. D4D0.8D owns canonical product motion.

| D4D0.8C cinema | D4D0.8D product motion |
| --- | --- |
| May loop with long rest | Must not replay historical transaction events |
| Uses illustrative neutral values | Uses truthful rendered canonical state |
| Fixed authored narrative | Interruptible when state changes |
| Decorative/progressive enhancement | May support state comprehension but never delay state |
| Homepage-focused | Checkout/order/evidence focused |
| Does not assert a transaction occurred | Runs only around semantically valid observed transitions |

No shared timeline, playback state, or component abstraction is required merely because both use Converge / Resolve grammar.

## 10. Change-control strategy

To minimize micro-fix loops:

1. Lock story and frame hierarchy before polished motion.
2. Lock desktop and mobile stills before animation.
3. Lock animatic timing before production compositing.
4. Lock production master before codec tuning.
5. Lock asset quality/size before application integration.
6. Integrate behind a narrow reversible boundary.
7. Batch responsive/accessibility fixes from a complete matrix rather than viewport-by-viewport patches.
8. Require one consolidated human QA round with prioritized findings.
9. Reopen technology only against explicit conditions in the decision record.

## 11. Future production acceptance checklist

### Creative

- [ ] Settlement Register approved in desktop and mobile.
- [ ] Escrow hold is clear and distinctive.
- [ ] Split is exact, calm, and visibly rule-driven.
- [ ] Finality resolves into stillness.
- [ ] No logo reconstruction or prohibited cliché.

### Product truth

- [ ] Order and Payment Intent are distinct from funded escrow.
- [ ] Buyer commit does not imply QR transfer or browser custody.
- [ ] No automatic deadline settlement/refund/cancellation.
- [ ] No finality before canonical authority.
- [ ] Recipients remain marketplace-neutral.

### Delivery

- [ ] Desktop/mobile are separate compositions.
- [ ] WebM + MP4 and resolved poster pass budgets.
- [ ] No audio or alpha.
- [ ] No animation dependency.
- [ ] Media failure leaves a complete hero.

### Accessibility/performance

- [ ] Reduced motion and Save-Data request no video.
- [ ] Equivalent live text exists.
- [ ] Text/focus contrast passes every active frame.
- [ ] CLS is 0.00 and LCP regression ≤100ms target / 200ms hard limit.
- [ ] CPU/GPU/memory and thermal tests pass.
- [ ] Loop/pause behavior passes WCAG review.

## 12. Exact remaining D4D0.8C steps

After human approval of D4D0.8C.1, the remaining cinematic work is:

1. **D4D0.8C.2 — Visual prototype and animatic.**
2. **D4D0.8C.3 — Production master and optimized web derivatives.**
3. **D4D0.8C.4 — Homepage poster-first integration.**
4. **D4D0.8C.5 — Responsive, reduced-motion, Save-Data, and failure hardening.**
5. **D4D0.8C.6 — Performance and cross-browser/device QA.**
6. **D4D0.8C.7 — Human creative/product/grant-demo QA.**
7. **D4D0.8C.8 — Release, asset hygiene, and documentation reconciliation.**

D4D0.8D remains a separate subsequent canonical product-motion phase and is not part of cinematic implementation.

## 13. D4D0.8C.1 completion boundary

This phase creates Markdown planning documents only. It does not:

- modify `apps/**`, `packages/**`, `contracts/**`, `package.json`, or `pnpm-lock.yaml`;
- install a dependency;
- create a video, image, font, render, reference screenshot, or other binary asset;
- implement animation;
- commit or push.
