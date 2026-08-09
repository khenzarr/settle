# C3 production accessibility and degradation decisions

The source remains a greater-than-five-second explanatory cinematic. Carry forward Model A for future integration: autoplay cinematic with an understated persistent Pause Motion / Resume Motion capability. The authoring master supports pausing at any frame and exposes a resolved poster state. Reduced motion is poster-only immediately, with no travel or active cinematic initialization. At `<=360px`, use poster-first / possibly poster-only rather than forcing the active mobile composition.

The desktop source preserves a low-detail left safe zone; mobile is a separate 780 × 1688 source composition presented at 390 × 844 with secondary ledger detail reduced by at least half. Background life during rest is limited to imperceptible non-semantic ledger drift; the settlement mechanism, recipient rails, and canonical register remain still.
# Cinematic performance and accessibility contract

**Decision record:** D4D0.8C.1  
**Applies to:** Future production of The Settlement Register  
**Priority:** Core product usability and truthful content always outrank cinematic playback

## 1. Performance principle

The cinematic layer is progressive enhancement. The page must render its product positioning, CTA, navigation, and resolved visual meaning without waiting for video, JavaScript, wallet state, API data, or animation. Media may spend only the budget remaining after core content is stable.

## 2. Concrete budget

### Desktop

| Metric | Target | Hard limit / failure action |
| --- | ---: | --- |
| Poster transfer | ≤90KB | 130KB; optimize or simplify |
| Primary video transfer | ≤1.35MB | 1.60MB; lower complexity/raster/bitrate |
| Fallback MP4 | ≤1.75MB | 2.10MB; must not download with primary normally |
| Added JS runtime | **0KB target** | ≤5KB app lifecycle code only; no animation library |
| Video decode/display | stable 30fps | no visible sustained drops on reference laptop |
| Main-thread scripting from scene | <10ms total startup | no long task >50ms attributable to media integration |
| CPU while resting | near idle; <3% reference median | pause/offload if rest still consumes materially |
| CPU during narrative | <12% reference median | simplify layers/codec/raster |
| GPU utilization | <20% reference median | no sustained saturation or fan ramp |
| Incremental memory | <35MB | 50MB; use smaller raster/buffer strategy |
| LCP regression | ≤100ms p75 | 200ms; poster/video loading must be deferred/reworked |
| CLS from scene | **0.00** | >0.01 fails |

Reference desktop for production QA should include a current midrange integrated-GPU laptop, not only a high-end workstation.

### Mobile

| Metric | Target | Hard limit / failure action |
| --- | ---: | --- |
| Poster transfer | ≤55KB | 85KB; optimize or simplify |
| Primary video transfer | ≤650KB | 850KB; poster-only for constrained tier |
| Fallback MP4 | ≤850KB | 1.10MB; must not download with primary normally |
| Added JS runtime | **0KB target** | ≤5KB lifecycle code only |
| Video decode/display | stable 24fps | sustained visible drops → poster-only for class/variant |
| Main-thread startup | <10ms | no long task >50ms attributable to scene |
| CPU during narrative | <15% reference median | simplify or disable motion |
| CPU during rest | near idle; <4% reference median | pause if encoded rest still costs materially |
| Incremental memory | <22MB | 32MB; reduce raster/decoder buffer |
| LCP regression | ≤100ms p75 | 200ms; prioritize copy/poster and defer video |
| CLS from scene | **0.00** | >0.01 fails |
| Thermal behavior | no perceptible heat/frequency decline over 5 cycles | use one-shot or poster on affected tier |

Reference mobile QA must include at least one recent iPhone Safari, one midrange Android Chrome device, and one lower-memory/older supported device.

## 3. Initial-load contract

- Live headline and supporting copy must render independently of media.
- Reserve exact media dimensions with `aspect-ratio` or intrinsic size before poster decode.
- Opaque Background is the immediate fallback.
- Poster may be eager if it is an LCP candidate; video should not compete with critical font, CSS, or hero-copy loading.
- Start with `preload="metadata"` or `none`; measure before choosing.
- Never preload multiple desktop/mobile or codec variants simultaneously.
- Media requests must not delay checkout, wallet adapter, API, or route resources.
- The homepage cinematic must not be included on checkout routes.

## 4. LCP and CLS strategy

### LCP

- Prefer the live headline as LCP where browser behavior and layout support it.
- If the poster becomes LCP, optimize it as a first-class responsive image and keep video deferred.
- Do not mark video sources high priority.
- Instrument p75 field data after integration; local Lighthouse alone is insufficient.
- Aesthetic gain does not justify >200ms p75 LCP regression.

### CLS

- Poster and video occupy the same pre-sized box.
- Swapping poster to video must not alter intrinsic size, crop mode, borders, or spacing.
- Embedded labels never alter DOM layout.
- Failed autoplay or source selection must not remove the box.
- Target cinematic CLS contribution: exactly `0.00`.

## 5. CPU/GPU and memory behavior

- Prefer hardware-decoded VP9/H.264 paths validated per browser.
- Use 30fps desktop and 24fps mobile; 60fps is prohibited unless human review proves indispensable and budgets still pass.
- Avoid 4K sources, alpha video, live filters, canvas copies, and CSS blur over moving media.
- Do not stack duplicate videos for crossfades.
- Encoded still frames during rest may still consume decode; prototype whether pausing at the resolved frame for part of the rest reduces cost without visible cadence issues.
- Pause when `document.visibilityState !== "visible"`.
- Pause or avoid starting when hero is substantially offscreen; do not create scroll-progress choreography.
- Release/unload source only if measurements show memory benefit without reload churn.

## 6. Reduced-motion contract

When `prefers-reduced-motion: reduce` matches:

1. Do not request or initialize the cinematic video.
2. Show the separately exported resolved poster immediately.
3. No rail travel, path drawing, looping, pulsing, camera movement, or animated luminance.
4. Preserve all conceptual information: order/intent, escrow threshold, programmed shares, recipients, canonical register.
5. Keep live product copy unchanged.
6. The preference is honored before playback starts; do not briefly autoplay and then stop.
7. If the preference changes during the session, stop video and replace it with the resolved still without moving layout.

This cinema contract is separate from canonical product-motion behavior. It does not modify D4D0.8D state semantics.

## 7. Save-Data and low-data contract

Use feature/policy signals, not device fingerprinting.

- When `navigator.connection?.saveData === true`, do not request video; show poster.
- If Client Hints such as `Save-Data` are available at delivery/CDN layers in future, they may select poster-first responses, but the client fallback remains.
- Do not infer user intent solely from network type.
- On slow network, keep poster visible; do not show a loader or block content.
- If video has not become playable within the integration’s conservative timeout window, abandon autoplay for that view and retain poster. Exact timeout should be measured, with 2–3s after request as a prototype starting point.
- Never retry video repeatedly in the background.

## 8. Low-power and lower-end device strategy

Avoid fragile fingerprinting, benchmark scripts, or user-agent device taxonomies. Use simple progressive enhancement:

1. Stable static poster is the base experience.
2. Motion requires no reduced-motion or Save-Data preference, supported codec, successful media load, successful muted playback, visible document, and meaningful hero visibility.
3. Mobile uses its own 24fps, lower-raster asset.
4. ≤360px defaults to poster unless production QA approves motion.
5. Decode/playback failure permanently falls back to poster for that page view.
6. Future field telemetry may justify serving poster by default to broad, explicit capability classes, but no invasive fingerprint is authorized.

The browser’s native autoplay and decode behavior is treated as a capability gate rather than an error to defeat.

## 9. Autoplay-failure behavior

- Set `muted` as a property before invoking play; include `playsInline`.
- No audio track exists.
- Catch/reconcile a rejected `play()` promise without console noise or user-facing error.
- Poster remains visible until the first usable moving frame.
- Failure does not reveal controls or a play button by default; the cinema is optional, not content the user must operate.
- Do not repeatedly request user interaction to start decorative motion.
- If a manual “Play visual explanation” control is considered later, it must be a separate accessibility/product decision and not required for understanding.

## 10. Accessibility contract

### Semantics

- When equivalent adjacent hero copy exists, the media is decorative: hide it from the accessibility tree and prevent focus.
- If used without equivalent text, provide a concise accessible description outside the video element.
- Recommended equivalent sentence: “One marketplace payment enters controlled escrow, then resolves by programmed terms into exact recipient payouts and canonical finality.”
- Embedded labels/numbers are supplemental and never the sole explanation.

### Motion and timing

- No user action is timed to the 7.2s narrative.
- Content and CTA are available immediately.
- No information disappears permanently after a beat; the poster/rest state contains the complete model.
- No flash exceeds WCAG thresholds; the design has no flashes by intent.
- No camera motion is preferred; any prototype push must be rejected if it induces discomfort or weakens clarity.

### Contrast and readability

- Live normal text meets at least 4.5:1 and large text at least 3:1 against every frame behind it; target higher where practical.
- CTA and focus indication remain above media and meet existing brand accessibility rules.
- Active rail never passes under copy.
- Color is not the only indication of hold, split, or finality; geometry and alignment carry meaning.
- Embedded illustrative values use tabular figures and remain stable long enough to inspect.

### Audio/captions

- Website media has no audio track and never autoplays sound.
- Captions are not required for silent decorative/explanatory geometry when equivalent adjacent text exists.
- Any later demo video with narration or sound is a separate deliverable and requires captions/transcript; it is not the website asset.

### Controls

- Decorative looping media has no keyboard-focusable native controls.
- Users control motion through system reduced-motion preference; future explicit pause control may be evaluated if playback is judged distracting despite the long rest.
- If WCAG review concludes the 12s loop constitutes moving content requiring a pause mechanism in the final context, integration must either provide a clear pause control or switch to one-shot-then-poster. This is a production gate, not deferred ambiguity.

## 11. Canonical truth contract

- Label the scene in adjacent copy/specification as illustrative or explanatory when needed.
- Do not source live order data into the hero film.
- Do not present a transaction hash, wallet address, live status, named marketplace, or timestamp.
- Do not show settlement automatically following a deadline.
- Do not show refunds/cancellations.
- Do not depict QR as payment movement.
- Canonical baseline is a metaphor for final authority, not visual proof of a real confirmation.
- Checkout/product motion remains governed by observed canonical state in D4D0.8D.

## 12. Asset delivery and caching

- Final filenames should be content-hashed by the application build or include a version identifier.
- Serve correct `Content-Type`, byte-range support, and long immutable caching for versioned media.
- Store only approved web derivatives in the application repository; keep mezzanine/source masters in the approved design-production location defined later.
- Do not commit temporary renders or every codec experiment.
- Vercel deployment must be tested for range requests, cache behavior, and actual transfer size.

## 13. Measurement plan

Before approval, collect:

- encoded size for every source/poster;
- LCP/CLS before and after on desktop/mobile profiles;
- main-thread long tasks;
- frame-drop/playback quality observations;
- memory before load and during repeated cycles;
- CPU/GPU/thermal observation over five cycles;
- data requests under normal, reduced motion, Save-Data, autoplay failure, and offscreen cases;
- browser matrix results for Safari, Chrome, Firefox, and Edge;
- contrast checks against representative active frames, not only poster.

## 14. Pass/fail gates

The cinema fails production approval if any of these occur:

- page meaning or CTA depends on playback;
- reduced-motion or Save-Data still downloads video;
- mobile is merely a crop that removes required meaning;
- desktop primary exceeds 1.60MB or mobile primary exceeds 850KB without explicit human exception;
- scene contributes >0.01 CLS or >200ms p75 LCP regression;
- active geometry compromises text/focus contrast;
- sustained playback causes visible jank, heat, or battery-heavy behavior on reference devices;
- autoplay failure leaves an empty hero;
- checkout/API/wallet resources compete with cinematic media;
- any frame makes a prohibited product claim.
