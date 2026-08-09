# C3 production hierarchy

The production master uses three authored depths rather than a flat schematic:

- **Background:** a dark mineral Convergent Ledger field with low-contrast register strips, intervals, diagonal hard-corner geometry, etched fragments, and a persistent canonical baseline. It is masked down on the left 42–44% desktop copy-safe zone.
- **Midground:** the Settlement Register hero object, built from two substantial inset threshold planes, a recessed chamber, one coherent ingress/value path, a calibrated program plane, and at most three derived recipient rails.
- **Foreground/falloff:** localized edge light, shadow, grain, and a quiet copy veil. No high-contrast semantic detail sits behind future homepage copy.

The escrow register is tactile graphite/mineral construction, not a lock, vault, shield, or card. Settlement Light `#7BD5C4` is localized inside the register and rails; Brand Accent `#C7A66A` is restricted to calibration marks and rule indicators. Source-only grain, masked soft light, localized blur, and restrained bloom are permitted because the eventual runtime is pre-rendered video.
# The Settlement Register — scene architecture

**Decision record:** D4D0.8C.1  
**Purpose:** Define composition, hierarchy, responsive crops, masks, and relationship to approved homepage systems before production

## 1. Architectural principle

The hero is a stable product message with a cinematic settlement mechanism composed around it—not copy placed on top of a video indiscriminately. Live HTML typography and CTA remain the foreground authority. The cinematic asset owns explanatory geometry only and must remain replaceable by a complete poster without changing layout or meaning.

## 2. Layer stack

```text
z4  Live hero UI: eyebrow, headline, copy, CTA, trust/network context
z3  Readability veil and hard safe-zone mask
z2  Narrative mechanism: intent, value rail, escrow, program, recipients
z1  Ledger field: registers, canonical baseline, quiet commerce records
z0  Opaque Mineral background fallback
```

### Layer 0 — Opaque ground

- Exact base: Background `#24231F`.
- Exists in CSS/layout even if media never loads.
- Video uses an opaque matching background; alpha is neither required nor recommended.
- No gradient is required for recognition or legibility.

### Layer 1 — Background ledger field

Contains:

- 3–5 partial ledger strata;
- one persistent canonical baseline;
- low-contrast order/condition rules;
- rare Surface 2/3 planes;
- optional Ambient illumination below 8% perceived contrast.

Rules:

- It may enter the copy zone only at low contrast.
- No continuous parallax, noise, particle drift, blur field, or animated gradient.
- The canonical baseline does not animate into existence; it is present from rest.
- Background detail is first to be removed at narrower breakpoints.

### Layer 2 — Narrative mechanism

Contains:

1. order envelope;
2. Payment Intent frame;
3. unified value rail;
4. escrow threshold planes and masks;
5. decision plane and share ticks;
6. two or three recipient rails;
7. recipient terminals.

Rules:

- Active Settlement Light geometry must remain outside the live-copy exclusion zone.
- No narrative element receives pointer events or focus.
- Exact-value typography embedded in media is supplemental; live page copy owns the claim.
- All movement is authored inside a fixed composition. No DOM layout values are animated.

### Layer 3 — Readability system

Use two safeguards rather than relying on asset discipline alone:

1. **Asset-authored safe area:** no high-contrast narrative geometry in the left 44% desktop safe zone or upper mobile copy zone.
2. **Page-level readability veil:** an opaque-to-transparent Mineral ramp localized behind copy, using only enough opacity to guarantee contrast. It must not read as a trendy gradient effect.

The veil belongs to layout, not the video. This keeps text readable across poster, video failure, crop variance, and future copy changes.

### Layer 4 — Foreground/UI

- Live Instrument Sans only.
- Headline, supporting message, CTA, and network/trust context remain still.
- The hero must remain fully understandable before video decode.
- No loading spinner or “animation loading” state.
- CTA hit area and focus outline sit above all media.

## 3. Desktop composition

### Reference plate

- Artboard: 1920 × 1080 master, composed for a 16:10/16:9 responsive hero window.
- Browser display target: approximately 1100–1600px wide and 620–900px high.
- Copy safe zone: x `6–44%`, y `12–68%`.
- CTA exclusion zone: copy zone plus 32px in every direction.
- Narrative core: x `46–94%`, y `20–80%`.
- Active rail maximum: x `48–92%`, y `30–77%`.
- Canonical register: y `74–82%`; it may extend left at ≤8% contrast.
- Outer crop safety: keep required meaning inside x `43–94%`, y `16–84%`.

### Hero model

**Chosen composition:** side/lower-third cinematic field with limited low-contrast background continuation behind text.

This is neither a conventional boxed side illustration nor a full-bleed moving wallpaper. It allows the mechanism to feel spatially integrated while protecting product positioning.

### Visual hierarchy

1. Headline.
2. One coherent active value/escrow core.
3. Supporting copy and CTA.
4. Programmed split and recipient register.
5. Order/intent record.
6. Background ledger field.

At no frame may embedded labels outrank supporting copy or CTA.

## 4. Mobile composition

### Independent mobile plate

- Master: 1080 × 1350 (4:5) for in-page placement, with 1080 × 1920 (9:16) production source if needed for flexible crops.
- Display region: lower 42–48% of hero after live copy and CTA.
- Axis: top-to-bottom.
- Copy safe zone: top `0–47%` of hero; no active media behind it.
- Narrative core: x `10–90%`, y `50–94%`.
- Escrow width: approximately 64–72% of viewport visual region.
- Recipient register: bottom `82–94%` with safe padding for browser UI/crop.

### Simplification order

When space or performance is constrained, remove in this order:

1. rear ledger strata;
2. duplicate order plane;
3. long embedded labels;
4. exact output amounts (retain ratios or structural widths);
5. minor illumination and overlap masks;
6. motion entirely, replacing with poster.

Never remove the escrow threshold, programmed division cue, or evidence that one whole becomes multiple exact outputs.

### Breakpoint behavior

| Width/condition | Composition |
| --- | --- |
| ≥1200px | Desktop master, full background, three recipients, optional amounts |
| 768–1199px | Desktop/tablet crop, shorter rails, fewer ledger strata, three recipients |
| 480–767px | Mobile master, vertical axis, three compact recipients, no role labels |
| 361–479px | Mobile master, simplified intent and background, compact ratios |
| ≤360px | Resolved mobile poster preferred unless motion prototype proves clear and performant |

## 5. Masking and compositing

### Required masks

- **Copy exclusion mask:** prevents high-energy pixels from entering text/CTA area.
- **Escrow ingress/egress masks:** make the value rail pass under threshold planes and communicate enclosure.
- **Scene-edge mask:** softly integrates the visual plate with page ground; no obvious video rectangle.
- **Loop dissolve mask:** low-contrast ledger planes cover the transition from resolved rest to initial rest.

### Prohibited compositing

- Large blurred glows or drop shadows.
- `mix-blend-mode` dependence for legibility.
- Transparent video as a requirement.
- Live backdrop filters.
- Additive neon bloom.
- CSS overlays that recolor media unpredictably.

## 6. Responsive crop contract

1. Desktop and mobile are separately authored compositions.
2. Required geometry must remain within each plate’s crop-safe region.
3. `object-fit: cover` may crop only expendable ledger field, never escrow or recipient terminals.
4. Integration must test at 320, 360, 390, 430, 768, 1024, 1280, 1440, and 1920 CSS pixels.
5. If a layout falls outside validated aspect ratios, switch to `contain` with matching ground or use the poster; do not accept semantic cropping.
6. Poster and moving media use identical intrinsic aspect-ratio boxes to guarantee zero layout shift.

## 7. Safe text-zone contract

- Active Settlement Light pixels: prohibited behind headline, supporting copy, CTA, and focus ring.
- Background contrast behind text: must preserve WCAG contrast for every live text token; target a conservative local luminance variance no greater than 6% during playback.
- No embedded text behind live text.
- Headline line breaks are controlled by layout, not baked into media.
- The media is not a substitute for an opaque content surface where contrast cannot be guaranteed.

## 8. Relationship to existing hero

The current hero settlement model (`One payment → Secure escrow → Deterministic distribution`) remains the approved fallback until cinematic integration passes human QA.

Future disposition:

- **ABSORB** its three-stage semantic story into The Settlement Register.
- Preserve its accessible label as adjacent live copy or a visually hidden description.
- Do not display the old model over the cinematic mechanism; that would duplicate the same story and create UI clutter.
- Keep headline and lede positioning substantially stable unless prototype testing proves a different hierarchy is materially stronger.
- Add CTA treatment only through the application-design phase; this planning phase does not invent unsupported destinations.

## 9. Relationship to Deterministic Branch

Deterministic Branch remains a distinct **section narrative**:

- It explains the readable five-stage sequence and supports deliberate inspection.
- Its current meaningful-visibility, one-shot behavior remains valid.
- It may inherit the escrow-register threshold and canonical terminal grammar in a later visual refinement.
- It must not replay the complete 7.2s hero film, become ambient, or mimic the same composition.
- Its rail geometry stays crisp and DOM/vector-oriented; the cinematic hero can use richer authored compositing.
- Neither system reconstructs I-0.

The relationship is: **hero provides immediate intuition; Deterministic Branch provides inspectable sequence.**

## 10. Relationship to infrastructure section

The infrastructure section should eventually carry information the hero intentionally omits:

- Marketplace creates intent.
- Buyer approves and funds.
- Escrow holds one unified value.
- Explicit settlement/fulfillment decision resolves terms.
- Canonical state remains authority.

After hero integration, reduce redundant marketing language around the diagram, not the diagram’s truthful stages. The section may include illustrative participant roles, API context, and a static split example. It should not add another continuous cinematic loop.

## 11. Other page surfaces

### Marketplace/API integration

May use a future one-shot/static Commerce Signal Register variant. Keep it event/contract oriented, not a logo cloud or named-integration wall.

### Hosted checkout

No hero cinema. Payment amount, order state, approve/fund action, QR-hosted-checkout handoff, wallet state, and canonical status must dominate. Only D4D0.8D truthful product motion is eligible.

### Payment Intent explanation

May reuse a static intent frame or a compact one-shot boundary formation. It must distinguish defined terms from funded escrow.

### Settlement split explanation

May use the resolved recipient register as a static diagram. If tied to actual order data, it becomes product UI and must follow canonical-state rules rather than cinematic timing.

### Evidence/canonical state

Static. The canonical baseline can organize evidence rows, but visual resolution cannot manufacture proof or replay historical events.

## 12. Media/layout failure contract

If video is unsupported, blocked, late, errored, paused, or absent:

- the reserved aspect-ratio box remains;
- the resolved poster remains visible;
- live headline, message, CTA, and navigation remain complete;
- no empty black rectangle, broken-media icon, layout jump, spinner, or retry prompt appears;
- no core action waits for media readiness.

## 13. Architecture approval checklist

- [ ] Foreground text is live HTML and never part of the video.
- [ ] Active geometry stays outside desktop/mobile copy exclusion zones.
- [ ] Desktop and mobile use separately authored compositions.
- [ ] Escrow and all required split semantics survive every approved crop.
- [ ] Poster, video, and fallback ground share dimensions and color.
- [ ] Existing hero remains available until replacement passes QA.
- [ ] Deterministic Branch remains inspectable and non-looping.
- [ ] Checkout and evidence receive no cinematic explanatory layer.
- [ ] Media failure leaves a complete, stable, usable hero.
