# C3 production decision

The authoring master is a dependency-free browser/SVG composition in `production/master/`. A deterministic JavaScript `renderAt(time)` function is the sole timeline authority for playback, pause/resume, poster state, and frame-accurate capture. It is explicitly **not** a homepage DOM animation.

The runtime recommendation remains **pre-rendered muted video plus resolved desktop/mobile poster fallback**. SVG filters, grain, masks, blur, and bloom are source-only effects for the rendered master and must not be transferred as filter-heavy animated homepage DOM. Local preview uses Node's built-in HTTP server; no package or install is required.
# The Settlement Register — technology decision

**Decision record:** D4D0.8C.1  
**Decision:** Authored opaque video is primary; responsive resolved SVG/poster is fallback  
**Constraint:** No technology is installed or implemented in this phase

## 1. Decision criteria

The flagship is a non-interactive atmospheric hero scene with exact authored timing, restrained depth, rich compositing, a fixed camera, and a known 12s cadence. It does not need pointer interaction, live transaction data, runtime branching, physics, scroll progress, or state-driven interruption. Technology should therefore maximize visual fidelity and playback stability while minimizing application runtime and main-thread work.

Scores are 1–5, where 5 is best. Weighted total is out of 500.

## 2. Decision matrix

| Criterion | Weight | CSS + SVG | Authored video | Rive | Lottie | Canvas / WebGL |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Visual ceiling/compositing | 14 | 3 | **5** | 4 | 3 | **5** |
| Implementation simplicity | 10 | 3 | **5** | 3 | 3 | 1 |
| Bundle/runtime cost | 10 | **5** | **5** | 3 | 3 | 1 |
| Mobile playback efficiency | 12 | 3 | **4** | 4 | 3 | 2 |
| Responsive control | 9 | **5** | 3 | **5** | 4 | **5** |
| Reduced-motion/fallback | 8 | **5** | **5** | 4 | 4 | 3 |
| Accessibility simplicity | 8 | **5** | **5** | 4 | 4 | 3 |
| Deterministic playback | 9 | 4 | **5** | **5** | 4 | 3 |
| Authoring workflow | 8 | 3 | **5** | 3 | 4 | 2 |
| Maintainability | 8 | 4 | **4** | 3 | 3 | 2 |
| Source-control friendliness | 5 | **5** | 2 | 3 | 3 | 4 |
| Future editability | 6 | **5** | 3 | 4 | 4 | 3 |
| Asset-size potential | 7 | **5** | 3 | 4 | 4 | 2 |
| Browser/Vercel fit | 5 | **5** | **5** | 4 | 4 | 3 |
| Autoplay reliability | 5 | n/a (5) | 4 | 5 | 5 | 5 |
| **Weighted score / 500** | **100** | **413** | **441** | **381** | **361** | **281** |

The scores assess this specific flagship, not each technology’s general capability.

## 3. Option evaluation

### 3.1 CSS + SVG

**Visual ceiling:** Excellent for crisp rails, masks, values, and responsive diagrams; less efficient for authored atmospheric compositing and a long multi-beat timeline.  
**Complexity:** Moderate. The scene would require many coordinated elements, keyframes, delays, masks, and responsive states.  
**Bundle/runtime:** No third-party runtime; small text-based assets.  
**Mobile:** Crisp and scalable, but many concurrent SVG/CSS layers can create main-thread/style/compositing work.  
**Responsiveness:** Best-in-class if the composition needs fluid geometry.  
**Reduced motion:** Straightforward resolved SVG state.  
**Accessibility:** Straightforward when decorative and hidden; embedded labels still require equivalent text.  
**Determinism:** Good, but browser scheduling, tab suspension, and late style application can complicate a 12s exact timeline.  
**Authoring:** Engineer-heavy; creative iteration risks becoming code iteration.  
**Maintainability:** Good for small diagrams, weaker for dozens of cinematic timing decisions.  
**Vercel/browser:** Native and excellent.  
**Source control/editability:** Excellent diffs and parameter editing.  
**Expected size:** approximately 40–180KB SVG/CSS depending on complexity.  
**Autoplay:** Not subject to media autoplay policy, but iteration and visibility must be managed.

**Verdict:** Strong fallback and likely best technology for Deterministic Branch or a prototype animatic. Not primary for the high-fidelity flagship because code complexity would constrain art direction and make a non-interactive film expensive to maintain.

### 3.2 Authored opaque video (WebM + MP4; selective AV1)

**Visual ceiling:** Highest practical ceiling for exact light, masks, depth, texture, timing, and editorial dissolves.  
**Complexity:** Low application complexity; production complexity moves into a deliberate motion-design workflow.  
**Bundle/runtime:** No JavaScript animation runtime. Browser hardware decode is typically efficient.  
**Mobile:** Strong when a dedicated lower-resolution 24fps asset is authored; poor only if desktop media is reused carelessly.  
**Responsiveness:** Requires distinct desktop/mobile compositions and validated crops rather than fully fluid geometry.  
**Reduced motion:** Excellent via separate resolved poster and no video load/play.  
**Accessibility:** Decorative media is simple to hide; adjacent text carries meaning. No audio/captions required because there is no audio and no unique spoken content.  
**Determinism:** Exact authored timeline. Decode and playback can vary under resource pressure, but frames do not structurally diverge.  
**Authoring:** Best for motion designers; the scene can be judged as a film before integration.  
**Maintainability:** Strong if masters, export settings, and ownership are documented. Small content changes require re-rendering.  
**Vercel/browser:** Static media deployment is straightforward; caching headers and CDN delivery fit standard deployment.  
**Source control:** Binary output is opaque to diffs; masters should not be committed unless policy later approves them. Final web assets require explicit size/ownership review.  
**Future editability:** Moderate; depends on retained source masters and render manifest.  
**Expected size:** desktop 0.9–1.6MB primary; mobile 0.45–0.85MB primary; MP4 fallbacks slightly larger.  
**Autoplay:** `muted`, `playsInline`, and no audio track maximize autoplay eligibility, but poster fallback remains mandatory.

**Verdict:** **Primary recommendation.** It best matches a fixed, non-interactive hero narrative and avoids burdening the product application with an animation runtime.

### 3.3 Rive

**Visual ceiling:** Strong for vector/raster hybrids, state machines, responsive artboards, and interactive control.  
**Complexity:** Moderate integration plus a new runtime and authoring format.  
**Bundle/runtime:** Runtime cost is material relative to a native video element.  
**Mobile:** Generally strong but requires device testing and careful artboard complexity.  
**Responsiveness:** Excellent through artboards/layout and runtime control.  
**Reduced motion:** Requires explicit static artboard/state and logic not to initialize motion.  
**Accessibility:** Canvas output needs equivalent DOM semantics; scene remains decorative.  
**Determinism:** Strong state-machine control.  
**Authoring:** Specialized tool and team skill required.  
**Maintainability/source control:** Binary `.riv` files are not human-diffable; runtime version compatibility becomes part of maintenance.  
**Expected size:** runtime commonly adds a meaningful compressed payload, plus approximately 100–500KB scene depending on assets/complexity.  
**Autoplay:** Not constrained like video, but initialization still consumes runtime resources.

**Verdict:** Not justified because this scene has no interaction or live state. Reconsider only if future prototypes prove that responsive runtime layout or user-controlled exploration materially improves understanding.

### 3.4 Lottie

**Visual ceiling:** Good for conventional vector motion; masks, effects, typography, gradients, and renderer parity impose constraints.  
**Complexity:** Moderate; exporter compatibility and renderer differences create QA work.  
**Bundle/runtime:** Requires a player/runtime unless using browser-specific alternatives. JSON can become unexpectedly large.  
**Mobile:** Acceptable for restrained scenes; complex masks and many paths can be CPU-heavy.  
**Responsiveness:** Good scaling, weaker semantic recomposition than separate artboards.  
**Reduced motion/accessibility:** Explicit static fallback and DOM text remain required.  
**Determinism:** Generally good, with renderer discrepancies possible.  
**Authoring:** Familiar motion-design pipeline but effect support must be policed.  
**Maintainability:** JSON is theoretically text but generated files are not meaningfully reviewable.  
**Expected size:** approximately 150KB–1MB+ JSON/assets for a scene of this ambition, plus player runtime.  
**Autoplay:** Not media-policy constrained.

**Verdict:** No material advantage over video for this atmospheric, non-interactive scene; lower visual ceiling and additional runtime make it a weaker choice.

### 3.5 Canvas / WebGL

**Visual ceiling:** Extremely high; procedural depth, shaders, and responsive rendering are possible.  
**Complexity:** Highest engineering, QA, fallback, and lifecycle burden.  
**Bundle/runtime:** Significant JavaScript and GPU cost; context loss and initialization must be managed.  
**Mobile:** Risky for heat, battery, low-end GPUs, memory, and browser variability.  
**Responsiveness:** Excellent programmatically.  
**Reduced motion:** Requires a separate non-canvas still and must avoid initialization.  
**Accessibility:** Canvas is non-semantic and needs complete equivalent DOM content.  
**Determinism:** Can vary by frame pacing, GPU, shader precision, and resource contention.  
**Authoring:** Engineering-led unless a dedicated pipeline exists.  
**Maintainability:** Poor relative to the scene’s simple interaction needs.  
**Expected size:** runtime/code/assets likely 250KB–1MB+ before visual textures; memory/GPU budgets are higher.  
**Autoplay:** Not media-policy constrained, but rendering starts only through script and lifecycle management.

**Verdict:** Rejected. It adds spectacle and technical risk without improving product comprehension.

## 4. Primary recommendation

### Authored opaque cinematic video

Produce the flagship as a fixed-camera, opaque, pre-rendered scene. Use native browser media delivery with no autoplay audio and no JavaScript animation library.

#### Master/source production approach

- Create resolution-independent source geometry in a professional vector/motion compositing tool.
- Work in a color-managed Rec.709/sRGB pipeline and test against exact brand hex values after compression.
- Master at 1920 × 1080, 30fps desktop; author a distinct 1080 × 1350 or 1080 × 1920 mobile composition at 24fps.
- Keep all typography either live in the page or converted to approved source outlines for supplemental embedded labels only; retain an editable source manifest.
- Render a visually lossless mezzanine master outside the web repository.
- Export web derivatives through reproducible, documented encoder settings.
- No audio track in masters or derivatives.

#### Codec/fallback strategy

1. **WebM VP9** primary baseline for strong compression and broad modern support.
2. **H.264 MP4** fallback for maximum compatibility, encoded with web-optimized fast start.
3. **AV1 WebM/MP4** optional enhancement only if measured savings are at least 20% at equivalent quality and browser/source selection is validated. AV1 must not be the sole source.

Do not treat codec order alone as capability detection. Use `<source type>` declarations and validate actual browsers. Keep poster visible until the selected source can render.

#### Alpha

**No alpha.** Opaque video is smaller, more interoperable, easier to hardware decode, and free from alpha-codec compatibility issues. Match the video ground exactly to `#24231F`; use page-level masks/veils for integration.

#### Resolution targets

| Variant | Raster | FPS | Intended display |
| --- | --- | ---: | --- |
| Desktop high | 1920 × 1080 | 30 | ≥1280px / high-density displays |
| Desktop standard | 1440 × 810 | 30 | laptops/tablets landscape |
| Mobile | 720 × 900 or 720 × 1280 | 24 | 361–767px portrait |
| Narrow/low-data | poster only | — | ≤360px, Save-Data, reduced motion, constrained load |

Start with standard and mobile assets. Add high desktop only if visual QA proves a material benefit within budget.

#### Bitrate and quality strategy

- Use constrained quality targeting rather than a fixed high bitrate.
- Desktop VP9 target average: approximately 0.75–1.05Mbps for 12s, adjusted after visual quality inspection.
- Mobile VP9 target average: approximately 0.30–0.55Mbps for 12s at 24fps.
- H.264 fallbacks may target approximately 15–30% higher bitrate.
- Avoid banding in mineral darks; use subtle authored texture only if it improves compression rather than creating noise.
- Test exact brand color drift, edge ringing, rail legibility, and dark-scene macroblocking.

#### Native playback contract

Future markup should conceptually use:

- `autoplay`
- `muted`
- `playsInline`
- `loop` only because the authored asset includes its own rest/reset dissolve
- no `controls`
- no audio track
- `poster` pointing to the resolved frame

Playback must not depend on a successful `play()` promise. Failure leaves the poster intact.

#### Loading

- Hero poster: eager and potentially high priority if it is the LCP visual; exact integration must be measured against headline LCP.
- Video: `preload="metadata"` or `none` initially; select only after critical hero content is available and user preferences permit.
- Do not preload every codec or both desktop and mobile variants.
- Load/play the appropriate video only; do not download desktop and mobile assets together.
- If media is below the initial viewport because mobile copy pushes it down, lazy-load until near visibility.

#### Loop behavior

- 7.2s narrative, 4.8s rest, 12s encoded cycle.
- The last 0.8s uses an authored ledger-field dissolve to match the first rest frame.
- No browser crossfade, reversed money path, or hard reset.
- Pause when document is hidden and when sufficiently offscreen if future lifecycle code can do so without creating a generalized scroll-animation system.

#### File-size budget

- Desktop VP9 standard: **≤1.35MB target, 1.60MB hard cap**.
- Desktop H.264 fallback: **≤1.75MB target, 2.10MB hard cap**.
- Mobile VP9: **≤650KB target, 850KB hard cap**.
- Mobile H.264 fallback: **≤850KB target, 1.10MB hard cap**.
- Poster: **≤90KB desktop, ≤55KB mobile** for AVIF/WebP; SVG resolved poster target **≤80KB gzip/brotli** if used.
- No user should download both primary and fallback video sources during normal playback.

## 5. Fallback recommendation

### Responsive resolved SVG/poster

Create a clean vector still of the frame at approximately 7.45s. It is the required fallback for:

- reduced motion;
- Save-Data;
- autoplay rejection;
- unsupported codecs;
- video errors/timeouts;
- constrained network/device strategy;
- social/deck framing where motion is unavailable.

Why SVG is the fallback rather than a runtime animation:

- The scene’s meaning survives fully in a resolved state.
- Geometry and labels remain crisp across responsive sizes.
- It can be reviewed in source control if hand-authored/export-cleaned.
- It introduces no runtime or playback lifecycle.
- Desktop and mobile stills can be separately composed.

If SVG export is too complex or produces inaccessible/unstable output, use separate AVIF/WebP posters. The semantic and size contract matters more than format ideology.

## 6. Why primary video wins

1. The scene is authored, atmospheric, fixed, and non-interactive.
2. Its visual value comes from exact editorial timing, overlap, light, and a seamless rest/reset—not runtime state.
3. Native media decode avoids a new animation dependency and long main-thread timeline.
4. Separate mobile authoring solves composition more honestly than responsive runtime gymnastics.
5. Reduced motion and failures are completely served by the same strong resolved poster.
6. Video can be evaluated as a self-contained film before touching production UI, minimizing integration micro-fixes.

## 7. Conditions that would reopen the decision

Reconsider CSS/SVG or Rive only if the 8C.2 prototype proves one of these is necessary:

- values or participant count must be live and user-specific;
- the scene must respond materially to product state or user input;
- a single fluid artboard must recompose across highly variable containers that separate videos cannot cover;
- video quality cannot meet dark-field banding and asset-size budgets;
- native playback materially harms LCP, battery, or memory despite poster-first loading.

Even then, WebGL remains disfavored unless a unique procedural requirement emerges.

## 8. Decision summary

| Role | Choice |
| --- | --- |
| Primary flagship delivery | Authored opaque video via native `<video>` |
| Primary codec | WebM VP9 |
| Compatibility fallback | H.264 MP4 |
| Optional enhancement | AV1 only after measured value |
| Reduced motion / Save-Data / failure | Responsive resolved SVG or optimized poster |
| Alpha | None |
| Audio | None |
| Animation dependency | None recommended |
| Interactive runtime | Not justified |
