# The Settlement Register — flagship storyboard

**Decision record:** D4D0.8C.1  
**Scene class:** Cinematic explanatory scene; never canonical transaction motion  
**Cadence:** 7.2s narrative + 4.8s meaningful rest = 12.0s cycle

## 1. Narrative summary

One marketplace order forms a bounded Payment Intent. Buyer commitment admits one exact value onto the settlement rail. It crosses a controlled escrow threshold and becomes completely aligned and still. A programmed rule then resolves the held whole into precise recipient shares. The outputs meet an unmoving canonical register, illumination recedes, and the composition rests.

The scene is illustrative. It does not depict a real transaction, an automatic deadline action, a direct QR transfer, or confirmation before canonical state.

## 2. Timeline

| Beat | Time | Duration | Narrative job |
| --- | ---: | ---: | --- |
| 00 — Quiet register | 0.00–0.55s | 0.55s | Establish controlled infrastructure |
| 01 — Order signal | 0.55–1.30s | 0.75s | Introduce commerce intent |
| 02 — Payment Intent forms | 1.30–2.15s | 0.85s | Bind terms into one accountable unit |
| 03 — Buyer commit | 2.15–3.05s | 0.90s | Move one exact payment into the rail |
| 04 — Escrow register | 3.05–4.15s | 1.10s | Communicate controlled hold and assurance |
| 05 — Program resolves | 4.15–5.05s | 0.90s | Make explicit terms the cause of distribution |
| 06 — Deterministic distribution | 5.05–6.30s | 1.25s | Turn one whole into exact recipient portions |
| 07 — Canonical alignment | 6.30–7.20s | 0.90s | Resolve to finality and stillness |
| 08 — Meaningful rest | 7.20–12.00s | 4.80s | Let the proposition and CTA breathe |

## 3. Composition map

### Desktop, 1440 × 900 reference

```text
┌──────────────────────────────────────────────────────────────────────────┐
│  FOREGROUND SAFE ZONE                    CINEMATIC MIDGROUND             │
│  eyebrow                                 order record                    │
│  headline (max ~560px)             ───▶ [intent] ┃ escrow ┃             │
│  supporting copy                              one held rail              │
│  CTA                                                        ╲ 70%       │
│                                                              ═ 20% ─┐   │
│  no bright geometry crosses here                            ╱ 10%  ─┤   │
│  ───────────────── low canonical register ────────────────────────┴──  │
└──────────────────────────────────────────────────────────────────────────┘
```

The copy owns approximately the left 44% and upper-left visual priority. The narrative begins near center and occupies the right 56% plus the lower third. Background register lines may extend behind copy only below the contrast threshold defined in the scene architecture.

### Mobile, 390 × 844 reference

```text
┌────────────────────────────┐
│ eyebrow / headline / copy  │
│ CTA                        │
│                            │
│      order + intent        │
│             │              │
│       ┃ ESCROW ┃           │
│             │              │
│        70 ├──┤ 20 ├─ 10    │
│       canonical register   │
└────────────────────────────┘
```

Mobile is recomposed vertically around the escrow core. It is not a scaled or blindly cropped desktop asset.

## 4. Beat-by-beat storyboard

### Scene 00 — Quiet register

- **What appears:** Mineral background, sparse ledger strata, an unmoving canonical baseline, dim escrow threshold planes, and empty recipient terminals.
- **What moves:** A nearly imperceptible 200ms luminance settle may occur after decode; otherwise nothing.
- **What remains still:** Camera, headline, CTA, baseline, thresholds, and terminals.
- **Visual purpose:** Establish calm control before narrative energy.
- **Product meaning:** Settlement infrastructure exists before any illustrative order; motion does not create authority.
- **Color behavior:** Background `#24231F`; registers use Surface 2/Border Subtle at low opacity. Settlement Light is absent.
- **Depth/layer behavior:** Ledger field at rear, empty settlement structure in midground, hero UI in foreground.
- **Camera/composition:** Fixed. Right/lower-third weight balances left hero copy.
- **Duration:** 0.55s.
- **Transition:** One peripheral order record gains edge contrast and separates from the field.
- **Text labels:** None.
- **Numerical values:** None.
- **Desktop:** Full composition visible; left copy zone remains quiet.
- **Mobile:** Only escrow core, canonical line, and one small order record are shown.
- **Reduced motion:** Use the final resolved poster instead of this empty state.

### Scene 01 — Marketplace order signal

- **What appears:** A neutral order envelope made of two offset register planes, with one identifier line and three short condition rows.
- **What moves:** The rear plane advances 8–12px into exact alignment with the front plane; a short condition rule draws once.
- **What remains still:** Escrow, recipient rails, canonical baseline, typography, and camera.
- **Visual purpose:** Root the abstract mechanism in marketplace commerce.
- **Product meaning:** A marketplace order establishes terms; it does not itself transfer money.
- **Color behavior:** Secondary text tone and Surface 3 edges; one muted Brand Accent condition tick may appear.
- **Depth/layer behavior:** Order planes begin slightly behind the intent frame’s future position and flatten into the primary midground.
- **Camera/composition:** No camera move. Order enters from within the existing ledger field, not from off-screen space.
- **Duration:** 0.75s.
- **Transition:** An intentional gap around the aligned order expands into a bounded intent frame.
- **Text labels:** Optional small `ORDER` tag; omit in the cleanest hero version.
- **Numerical values:** A fixed illustrative amount line may appear as `120.00 USDC`; it does not count.
- **Desktop:** Order sits just right of the copy safe zone.
- **Mobile:** Simplify to one plane with two condition rules; amount omitted below 360px.
- **Reduced motion:** Final poster includes a small `ORDER` source record connected to the resolved system.

### Scene 02 — Payment Intent forms

- **What appears:** A precise rectangular intent boundary consolidates the order record, exact amount, and neutral participant/term marks.
- **What moves:** Four boundary segments close in sequence over a short distance; internal rows align to a shared baseline.
- **What remains still:** The exact amount, once visible, never changes; escrow and final register remain still.
- **Visual purpose:** Show that the payment is defined by explicit order-backed terms before buyer funding.
- **Product meaning:** Settle forms a Payment Intent; it is not yet escrow funding or finality.
- **Color behavior:** Intent boundary moves from Border Subtle to Ambient `#447D76`; amount uses Primary Text at restrained opacity.
- **Depth/layer behavior:** The order record visually nests into the intent frame; no 3D flip.
- **Camera/composition:** Fixed; intent occupies a compact central-right module.
- **Duration:** 0.85s.
- **Transition:** A single Settlement Light rail becomes visible at the frame’s buyer-side gate.
- **Text labels:** `PAYMENT INTENT` is allowed for 0.6s, then remains as a quiet tag.
- **Numerical values:** `120.00 USDC` remains stable if used.
- **Desktop:** Full boundary and label visible.
- **Mobile:** Boundary becomes taller/narrower; label shortens to `INTENT` only if needed.
- **Reduced motion:** Poster shows the formed intent and exact amount; no boundary drawing.

### Scene 03 — Buyer commit

- **What appears:** One coherent Settlement Light value band at the intent gate.
- **What moves:** The band advances once from intent toward escrow. A narrow gate opens by separating two small perpendicular rules; it closes behind the band.
- **What remains still:** Amount typography, intent terms, escrow threshold, canonical line, recipient terminals, hero UI.
- **Visual purpose:** Create the scene’s sole decisive transfer event.
- **Product meaning:** Buyer payment follows the canonical approve/fund flow. The visual compresses those required actions into an illustrative commit; it does not claim QR-to-escrow transfer or browser custody.
- **Color behavior:** Settlement Light becomes the highest-contrast narrative element; no bloom beyond a tight 2–4px authored softness.
- **Depth/layer behavior:** The rail remains on one plane and passes under a masking gate, not through a portal.
- **Camera/composition:** Fixed. Travel is horizontal desktop, vertical mobile.
- **Duration:** 0.90s.
- **Transition:** The leading edge reaches the first escrow threshold and decelerates sharply without overshoot.
- **Text labels:** Optional `BUYER COMMIT`; preferably communicated in adjacent accessible/page copy rather than embedded text.
- **Numerical values:** The amount remains attached to the whole rail; no ticker or duplication.
- **Desktop:** 140–220px rail travel within the visual zone.
- **Mobile:** 72–110px vertical travel; frame rate/complexity reduced, not speed increased.
- **Reduced motion:** Poster shows the value already held in escrow; descriptive text explains buyer commitment.

### Scene 04 — Escrow register

- **What appears:** Two parallel threshold planes frame the entire coherent value band. Internal measurement marks align at both ends.
- **What moves:** The band compresses optically by no more than 3% along travel, then returns to exact geometry as illumination evens from leading edge to trailing edge. The threshold planes move inward 4–6px and stop.
- **What remains still:** Once aligned, the value is completely still for at least 0.55s. The amount remains unchanged. No recipient path moves yet.
- **Visual purpose:** Make control, hold, threshold, and assurance recognizable without a lock/vault icon.
- **Product meaning:** One unified payment is held in escrow; a later explicit fulfillment/settlement decision is required. Time passing does not automatically settle or refund it.
- **Color behavior:** Settlement Light intensity becomes uniform; Brand Core/Ambient fill the chamber at low opacity. A single Brand Accent threshold tick may confirm alignment, not success.
- **Depth/layer behavior:** A subtle foreground mask passes over the rail at the two planes, creating enclosure without glass or a box.
- **Camera/composition:** Fixed preferred. Prototype may test a maximum 1% authored push, but default is no camera motion.
- **Duration:** 1.10s, including at least 0.55s full hold.
- **Transition:** Only after the hold, a decision rule appears beyond the second threshold.
- **Text labels:** Small `ESCROW` label may remain visible. No `secure`, `complete`, or success claim inside the asset.
- **Numerical values:** Whole amount remains `120.00 USDC` if enabled.
- **Desktop:** Escrow is the visual center of gravity, right of headline.
- **Mobile:** Escrow is enlarged to roughly 70% of scene width and occupies the center; background layers are reduced.
- **Reduced motion:** Recommended poster moment is the later resolved frame, but an editorial escrow still can be used for sections specifically explaining hold behavior.

### Scene 05 — Program resolves

- **What appears:** A decision plane, three proportion ticks, and a concise rule bracket between escrow and recipient rails.
- **What moves:** The ticks align from whole to shares in one coordinated 0.5s resolve. No value leaves escrow during the first part of this beat.
- **What remains still:** Held value, amount total, thresholds, canonical line, hero UI.
- **Visual purpose:** Make programmed terms visibly causal; the branch is not arbitrary.
- **Product meaning:** A fulfillment/settlement decision resolves the intended payout path. The scene does not prescribe who triggers it or imply deadline automation.
- **Color behavior:** Brand Accent briefly emphasizes the rule ticks, then recedes to muted. Settlement Light remains held and steady.
- **Depth/layer behavior:** Rule plane sits above the rail by a small overlap; no floating HUD panel.
- **Camera/composition:** Fixed; composition widens toward recipient side.
- **Duration:** 0.90s.
- **Transition:** Division ticks connect exactly to the starting widths/positions of recipient rails.
- **Text labels:** Optional `PROGRAM` or `TERMS`; no conditional claim such as “deadline reached.”
- **Numerical values:** `70% / 20% / 10%` or corresponding `84.00 / 24.00 / 12.00`. Total remains visibly conserved.
- **Desktop:** Three ticks and values can be shown.
- **Mobile:** Three compact tick labels are allowed; role names are omitted.
- **Reduced motion:** Poster shows the rule bracket between held source and resolved outputs.

### Scene 06 — Deterministic distribution

- **What appears:** Two or three engineered output rails with precise offsets and recipient register slots.
- **What moves:** The unified band releases from escrow and resolves through the decision plane. The outputs extend together with lengths completing in proportionally coordinated time, not sequential reward choreography.
- **What remains still:** Rule ticks, total amount, threshold planes, canonical baseline, copy, CTA, and camera.
- **Visual purpose:** Deliver the core “one payment becomes exact programmable split” proposition.
- **Product meaning:** Settle distributes according to programmed settlement terms to neutral marketplace participants.
- **Color behavior:** All outputs derive from Settlement Light. Minor opacity differences may establish hierarchy, but recipients are not rainbow-coded. Brand Accent is no longer active.
- **Depth/layer behavior:** Branch offsets use shallow diagonal shoulders and then parallel rails. No rails fly toward the viewer.
- **Camera/composition:** Fixed. Outputs remain inside the right/lower safe boundary.
- **Duration:** 1.25s.
- **Transition:** Rail terminals reach the canonical register at the same perceived resolve moment.
- **Text labels:** Desktop may show neutral `RECIPIENT 01–03`; a section variant may use illustrative `MERCHANT / PLATFORM / PROVIDER`. Hero prefers no role labels.
- **Numerical values:** Shares remain fixed and sum exactly to the source. No counting animation.
- **Desktop:** Three outputs are preferred to prove programmability beyond a simple fee split.
- **Mobile:** Preserve three outputs as compact parallel lanes when width permits; at ≤360px use two visible rails plus a third slim register slot, or a static three-share resolved poster—never change the underlying meaning silently.
- **Reduced motion:** Show all rails already resolved and labeled by exact shares.

### Scene 07 — Canonical alignment

- **What appears:** Recipient terminals meet one persistent canonical register; a short finality index line becomes legible.
- **What moves:** Terminal edges make a final 2–4px alignment and their luminance equalizes. Narrative illumination decays into the normal resolved palette.
- **What remains still:** The canonical baseline itself, exact values, all text, camera, and every resolved rail after alignment.
- **Visual purpose:** Conclude with quiet confidence and make stillness part of the brand.
- **Product meaning:** The illustrative settlement is shown in its final resolved configuration. Actual product finality remains governed by canonical onchain state, not this explanatory animation.
- **Color behavior:** Settlement Light drops from active to restrained. Primary Text may briefly clarify the final index; no green flash or check mark.
- **Depth/layer behavior:** Midground planes visually flatten toward the canonical baseline; depth decreases rather than expands.
- **Camera/composition:** Fixed. The composition reaches its cleanest and most legible poster arrangement.
- **Duration:** 0.90s.
- **Transition:** All movement ceases; no immediate reset.
- **Text labels:** Optional `CANONICAL STATE` in a small static register label. Avoid “confirmed” in the illustrative hero asset.
- **Numerical values:** Stable output values remain readable long enough to verify the total.
- **Desktop:** Full source → escrow → shares remains visible as one resolved system.
- **Mobile:** Focus is escrow → shares → register; order record remains as a small upstream cue.
- **Reduced motion:** **This is the recommended reduced-motion and poster frame.**

### Scene 08 — Meaningful rest

- **What appears:** The complete resolved Settlement Register.
- **What moves:** Nothing for the first 4.0s. During the final 0.8s, only low-contrast background planes may cross-dissolve toward Scene 00; no rail reverses.
- **What remains still:** Foreground copy/CTA always; resolved system for most of the rest; canonical baseline throughout.
- **Visual purpose:** Prevent constant busyness, support reading, and make finality credible.
- **Product meaning:** Resolution persists; it is not a transient celebration.
- **Color behavior:** Stable resolved palette. Final cross-dissolve stays below text-interference contrast.
- **Depth/layer behavior:** Depth is minimized; composition feels registered onto one plane.
- **Camera/composition:** Fixed.
- **Duration:** 4.80s.
- **Transition:** A masked 0.8s editorial dissolve removes order/value/output accents behind stationary ledger strata, returning to Scene 00. Never reverse the money path or snap terminals away.
- **Text labels:** Resolved labels can remain through rest, then dissolve with their geometry.
- **Numerical values:** Remain fixed through at least 4.0s of rest.
- **Desktop:** Provides substantial uninterrupted headline/CTA reading time.
- **Mobile:** Rest may extend to 5.8s if mobile prototype shows the scene otherwise feels busy; narrative duration remains no longer than desktop.
- **Reduced motion:** No loop; poster remains indefinitely.

## 5. Loop strategy

**Decision:** **One-shot + long rest + loop while meaningfully visible.**

- The first cycle may autoplay only when the hero is meaningfully visible, motion is allowed, autoplay succeeds, and data policy permits.
- Narrative: 7.2s. Rest: 4.8s. Total: 12.0s.
- The asset itself contains the rest and editorial dissolve, preventing a browser-level hard loop jump.
- Playback pauses when the document is hidden and should pause when the hero is substantially outside the viewport.
- Returning to visibility resumes or restarts only according to the future integration specification; it never represents transaction history.
- Repeated motion is acceptable because this is explicitly explanatory cinema, not observed canonical product motion.
- If the loop competes with reading in prototype QA, use **one cycle per page view followed by the permanent poster** as the first fallback cadence.

## 6. Poster-frame recommendation

Use the resolved frame approximately **7.45s** into the authored master:

- one order/intent source remains visible;
- the complete escrow threshold is legible;
- the decision rule and exact 70/20/10 relationship are visible;
- three recipient rails align to the canonical register;
- active glow has already receded;
- there is no ambiguous in-progress state.

The poster must be separately exported as a crisp still (preferably responsive SVG if geometry fidelity is practical, otherwise AVIF/WebP plus PNG only if required). It must not be a browser-extracted first frame because first-frame decode behavior is unreliable and Scene 00 lacks the complete meaning.

## 7. Desktop behavior

- Master composition target: 16:10 or 16:9 visual plate with protected left 44% safe zone.
- Fixed camera and opaque background; visual may overflow right/bottom under a controlled mask.
- Full three-recipient split and optional exact values.
- Scene contrast behind live text remains low; active value never crosses headline or CTA.
- At wide screens, extend background registers rather than scaling the mechanism excessively.
- At laptop widths, reduce peripheral ledger strata first, then shorten input/output rails; preserve escrow dimensions and share legibility.

## 8. Mobile adaptation

- Produce a distinct 9:16 or 4:5 authored composition centered on escrow.
- Narrative axis becomes vertical: order/intent above, escrow center, programmed split below.
- Reduce background planes by at least 50% and eliminate any camera push.
- Keep a maximum of three recipient lanes; shorten labels before removing structural meaning.
- Target 24fps and fewer composited layers.
- Place the visual below hero copy/CTA or in the lower 42–48% of the hero; do not run active geometry behind small text.
- For narrow/low-power conditions, use the resolved static poster rather than a compromised animation.

## 9. Reduced-motion frame

Under `prefers-reduced-motion: reduce`:

- Do not autoplay or loop video.
- Render the 7.45s resolved poster immediately.
- No meaningful travel, progress, pulsing, or repeated luminance animation.
- Preserve order, intent, escrow threshold, programmed shares, recipient terminals, and canonical register.
- Provide the same textual product proposition outside the image.
- An optional one-time opacity crossfade of no more than 120ms may be used only if the global motion contract permits it; the still must not depend on that fade.

## 10. Accessibility narrative

The cinematic asset is decorative when adjacent hero copy already states the proposition. It should be hidden from assistive technology and accompanied by live text such as:

> One marketplace payment enters controlled escrow, then resolves by programmed terms into exact recipient payouts and canonical finality.

If the visual appears in a context without equivalent adjacent copy, provide that sentence as its accessible description. Embedded labels and numbers must never be the only source of information. No interaction, focus target, timing requirement, or audio is attached to the scene.

## 11. Grant-demo framing

The 7.2s narrative maps cleanly to a spoken line:

> “A marketplace creates the payment intent; the buyer commits one exact payment; Settle holds it in escrow; settlement terms resolve the whole into exact participant payouts; canonical state is the final authority.”

The strongest grant-review frames are:

1. **3.55s:** coherent value visibly held at escrow.
2. **5.65s:** programmed whole becoming exact shares.
3. **7.45s:** complete resolved register and final stillness.
