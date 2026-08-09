# Settle Motion System

**Decision record:** D4D0.8A foundation; D4D0.8B homepage narrative implementation; D4D0.8B-R1 branch visibility activation  
**Status:** D4D0.8B-R1 implemented for review  
**Scope:** Motion architecture and tokens; homepage Converge / Resolve explanatory narrative

## Direction

Settle's motion DNA is **Converge / Resolve**: independent elements move toward a deterministic result, then decelerate into stillness. Motion is premium, financial, technical, modern, restrained, and precise. It is never gamified, springy, playful, neon, a HUD, or a continuously moving showcase.

The system is CSS-first. The current product has no animation dependency, and 8A does not need presence orchestration, shared-layout transitions, or interruptible JS sequences. No motion library is approved or installed.

## Motion classes

| Class | Role | 8A policy |
| --- | --- | --- |
| Ambient | Background/context depth | Optional in theory; not implemented. If added later, slow, low contrast, and removed under reduced motion. |
| Interaction | Controls and small state feedback | Allowed for hover, active, focus-visible, disabled, and loading. Explicit properties only; focus never depends on motion. |
| Narrative | Product-flow progression and resolution | Signature class. Planned for 8B/8C only; must explain sequence or finality. |

## Tokens

Tokens live in `apps/web/app/globals.css` and intentionally remain compact.

| Token | Value | Intended use |
| --- | ---: | --- |
| `--motion-duration-instant` | `120ms` | Immediate feedback |
| `--motion-duration-fast` | `180ms` | Control transitions |
| `--motion-duration-standard` | `240ms` | Normal UI state changes |
| `--motion-duration-deliberate` | `360ms` | Small content transitions |
| `--motion-duration-resolve` | `680ms` | Signature resolution, only when justified |
| `--motion-ease-standard` | `cubic-bezier(.22, .61, .36, 1)` | Normal UI |
| `--motion-ease-enter` | `cubic-bezier(.16, 1, .3, 1)` | Controlled entry |
| `--motion-ease-exit` | `cubic-bezier(.4, 0, 1, 1)` | Clean exit |
| `--motion-ease-resolve` | `cubic-bezier(.2, .8, .2, 1)` | Deceleration into final alignment |
| `--motion-distance-micro` | `2px` | Optical control feedback |
| `--motion-distance-small` | `6px` | Small UI/content travel |
| `--motion-distance-medium` | `12px` | Maximum default narrative travel |
| `--motion-stagger-fast` | `60ms` | Subtle sequential reveal |
| `--motion-stagger-standard` | `100ms` | Deliberate sequence, sparingly |

No spring, bounce, elastic, overshoot, pulse, or speculative amount scaling is permitted. Stagger is allowed only when it communicates sequence; no item should add a theatrical 200ms+ delay.

### Narrative sequence elapsed budget

The maximum perceived elapsed duration of a narrative sequence is `680ms`. This is an end-to-end sequence budget, not an animation duration to which stagger delays may be added:

> last stagger delay + last element animation duration must be less than or equal to `680ms`

For five stages, the last stage starts after four stagger intervals:

- `100ms` standard stagger: last start `400ms` + `240ms` standard duration = `640ms` total elapsed — **PASS**.
- `60ms` fast stagger: last start `240ms` + `360ms` deliberate duration = `600ms` total elapsed — **PASS**.
- `100ms` standard stagger: last start `400ms` + `680ms` resolve duration = `1080ms` total elapsed — **FAIL**.

`--motion-duration-resolve` remains `680ms`. It is intended for a single signature resolve movement, a coordinated whole-system resolution, a final non-staggered convergence, or another motion whose total elapsed duration itself is no more than `680ms`. Do not automatically assign `resolve` to every child in a staggered sequence. Staggered narrative sequences should normally compose `standard` or `deliberate` duration with `fast` or `standard` stagger while remaining inside the global `680ms` elapsed budget.

## Implementation definition: Converge / Resolve

Future signature motion should use compositor-friendly `transform` and `opacity` to show branches, rails, or independent elements converging toward a known alignment. The final frame must be stable and readable. Use small controlled distances, one resolve easing, and no fade-only signature. Motion follows rendered canonical state; it never predicts it.

The current implementation only tokenizes the existing button transition. No homepage rail, checkout state, QR, payout split, or ambient animation is implemented in 8A.

## Deterministic Branch rules

The visual companion may use the approved diagonal family, gap logic, engineered junctions, resolved alignment, and one Settlement Light rail. Future motion may reveal rail segments, advance controlled junctions, converge branches, and resolve into final alignment. It must not reconstruct I-0, turn the logo into arrows or transaction nodes, repeat the mark as a pattern, use moving coins/tokens, or create fake blockchain graphs. The logo remains mostly still; no spinner, breathing, or rotation.

## Policies and contracts

### Interaction

Hover may change explicit color properties; active/pressed may use only restrained optical feedback; focus-visible remains a persistent 2px outline; disabled remains visibly disabled; loading must preserve the control's meaning and never block truthful state. Do not use `transition: all`.

### State safety and interruptibility

Canonical state wins immediately. A hash is not success; a receipt is not canonical success; pending remains pending. Completed may resolve only after canonical proof. Refunded, cancelled, disputed, and payment-window-expired states must not be represented as completion, automatic refund, generic failure shake, or automatic cancellation.

#### Initial canonical state versus observed transition

Canonical resolution motion must not replay on initial render. If the first authoritative state available to a mounted checkout is already Completed, Refunded, Cancelled, Funded, or Disputed, render that truthful current state immediately. Do not celebrate Completed, depict funds entering escrow for Funded, depict refund flow for Refunded, or depict dispute activation for Disputed as though the user witnessed that transition.

State-transition narrative motion may run only when all of the following are true:

1. A previous canonical state is already known during the mounted experience.
2. A newly observed canonical state differs from that previous state.
3. The transition is semantically appropriate for motion.

For example, if Funded is known during the active session and the canonical state then becomes Completed, a one-shot Resolve treatment may run only after Completed is already authoritative in the UI. Animation decorates the truthful observed transition; it never delays publication of the new state.

The same gate applies to pending transaction UX progressing to canonical confirmation. A one-shot resolution may run only when that canonical progression is observed during the active session. Transaction hash alone is not sufficient. Receipt inclusion alone is not sufficient. Canonical state remains the authority, and a page loaded directly into an already confirmed canonical state must not replay pending-to-confirmed progression.

Refresh and initial hydration must not replay historical state resolution. Deep-link navigation does not imply that the user witnessed a transition. A revisit must not replay success choreography by default. D4D0.8A requires no persisted animation-history system; this is a semantic implementation rule for D4D0.8C.

Future state-driven animation must be interruptible. If another canonical state arrives while motion is running, publish the new truthful UI immediately, interrupt or replace stale visual choreography, and do not queue historical animations.

#### Explanatory narrative motion versus canonical state-transition motion

The checkout restriction does not prohibit the homepage's future one-shot narrative explanation. Homepage 8B may use controlled **explanatory narrative motion** to explain the settlement model; it does not assert that a real transaction just occurred. Checkout 8C **canonical state-transition motion** decorates only a semantically appropriate canonical transition observed during the active session. These are separate motion concepts and triggers.

### Accessibility

`aria-live` announcements and screen-reader-visible state update immediately; visual motion must not delay them. Keyboard focus remains visible with reduced motion. No information or access depends on animation completion.

Audit findings: buyer operation status and copied-link feedback already use polite live regions; errors use alert semantics; focus-visible is a persistent outline; disabled transaction controls remain semantically disabled; loading/checking controls retain text labels and disabled state. Inputs and links have no motion dependency. No `aria-live` or canonical-state update is deferred for visual presentation.

### Reduced motion

Under `prefers-reduced-motion: reduce`, ambient motion is disabled, narrative motion resolves immediately or near-immediately, and interaction travel is removed while color/opacity state feedback and focus visibility remain. Content is present and usable immediately. The global contract in CSS caps transitions/animations at `1ms` and prevents animation iteration.

### Performance

Prefer `transform` and `opacity`. Do not animate layout, large blur/filter, box-shadow, or continuous backdrop-filter. Do not use broad `will-change`, layout thrashing, or requestAnimationFrame loops. Any future `will-change` must be narrow and temporary.

### Load, scroll, and budget

There is no generic route/page entrance animation and no default IntersectionObserver choreography. Header and footer stay stable. Content is immediately usable. Motion never delays reading, wallet connection, order loading, authorization, link copying, QR scanning, or canonical state. The maximum perceived elapsed motion budget for any future narrative sequence is `680ms`, including all stagger delay before the final element completes; interaction is never blocked.

#### Narrow Deterministic Branch visibility exception

Generic section, card, and text scroll reveals remain prohibited. The homepage Deterministic Branch is the sole narrow exception: because this signature explanatory product visual is below the fold on important viewports, a presentation-only `IntersectionObserver` uses visibility only as a one-time start signal so its sequence is not consumed offscreen. The observer targets only the `.flow--deterministic` diagram, with `threshold: 0.35` and `rootMargin: 0px 0px -10% 0px`. This requires a meaningful portion of the diagram to enter a viewport whose bottom 10% is excluded; it does not require 100% visibility and starts promptly on first observation when desktop already exposes enough of the diagram.

In normal motion, a layout effect arms only decorative rail, marker, and junction geometry before paint; all five node cards and their labels remain present. Meaningful visibility atomically replaces the armed class with the active class, CSS runs the accepted independent `600ms` sequence, and the observer disconnects immediately. A mounted wrapper retains an activation ref, so scroll-away/back, hover, focus, resize, and orientation changes cannot replay the sequence. There is no scroll progress, reversal, pausing, listener, timer choreography, or generalized observer framework.

The base CSS state is the final resolved diagram. If JavaScript fails or `IntersectionObserver` is unavailable, the wrapper never arms and all content and decorative geometry remain understandable in that valid final state rather than hidden. Under the current `prefers-reduced-motion: reduce` preference, the wrapper neither arms nor observes: the branch renders directly in its approved final resolved state with no structural travel.

Ambient motion is not implemented. If later approved, it must be slow, low contrast, pause into the background, and disappear under reduced motion. No particles, canvas, WebGL, shaders, floating blobs, cursor glow, broad parallax, noise, or continuous rail loops.

## Later narrative QA matrix

`MOTION REQUIRED` means motion has a concrete semantic job, not that every state must animate.

| Surface / target | Class | Trigger | Purpose | Duration token | Easing token | Distance | Interruptible | Reduced motion | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Homepage hero settlement model | Narrative | Initial homepage render | Show payment → escrow → distribution convergence | `standard`; `standard` stagger | `resolve` | `small` decorative marker travel | One-shot CSS | Animation disabled; immediate resolved frame | IMPLEMENTED 8B — 3 stages, 440ms elapsed |
| Homepage infrastructure story | Narrative | First meaningful visibility (`35%`, bottom `10%` excluded) | Communicate Marketplace → Payment Intent → Buyer → Escrow → Settlement order | `deliberate`; `fast` stagger | `resolve` | `small` decorative marker travel | One-shot visibility signal; CSS sequence | All stages immediately present; no observer or animation | IMPLEMENTED 8B-R1 — 5 stages, 600ms elapsed |
| Homepage Deterministic Branch rail | Narrative | First meaningful visibility (`35%`, bottom `10%` excluded) | Resolve the directional rail and engineered junctions into Settlement | `deliberate`; `fast` stagger | `resolve` | `small` junction travel | One-shot visibility signal; CSS sequence | Static resolved rail; no observer | IMPLEMENTED 8B-R1 — included in 600ms infrastructure sequence |
| Homepage trust boundary | Narrative | State/context reveal | Clarify read → prepare → wallet submit boundary | `standard` | `enter` | `small` | Yes | Static full content | PLANNED 8B — MOTION OPTIONAL |
| Checkout canonical state conclusion | Narrative | Semantically appropriate canonical state change observed after a previous canonical state is known in the mounted experience | Make final state transition legible without fabrication; never replay on initial render | `deliberate` | `resolve` | `small` | Yes | Immediate state | PLANNED 8C — MOTION REQUIRED |
| Checkout buyer action availability | Interaction | Canonical action projection | Reveal only the truthful available action | `fast` | `enter` | `micro` | Yes | No travel; immediate availability | PLANNED 8C — MOTION OPTIONAL |
| Checkout pending → canonical confirmation | Narrative | Canonical confirmation observed during the active session | Distinguish pending from confirmed resolution; never infer confirmation from hash or receipt alone | `resolve` | `resolve` | `medium` | Yes | Immediate confirmed state | PLANNED 8C — MOTION REQUIRED |
| Funded / disputed / resolved transition | Narrative | Canonical status change observed during the active session | Give each state distinct, truthful treatment; never replay its arrival on initial render | `deliberate` | `resolve` | `small` | Yes | Static state presentation | PLANNED 8C — MOTION OPTIONAL |
| Payout split resolution | Narrative | Canonical transition to Completed observed during the active session | Align verified distribution branches; never replay on an initially Completed render | `resolve` | `resolve` | `medium` | Yes | Static split | PLANNED 8C — MOTION OPTIONAL |
| Evidence availability | Interaction | Evidence read completes | Context reveal, never proof creation | `standard` | `enter` | `small` | Yes | Immediate evidence | PLANNED 8C — MOTION OPTIONAL |
| QR / payment handoff reveal | Interaction | Handoff is available | Focus attention only when usable | `standard` | `enter` | `small` | Yes | Immediate QR | PLANNED 8C — MOTION OPTIONAL |

## Static / rejected targets

| Target | Decision |
| --- | --- |
| Generic page-load animation, whole-page fade, card cascade | STATIC PREFERRED / NOT APPROVED |
| Default scroll reveal across sections | STATIC PREFERRED / NOT APPROVED |
| Ambient background animation in 8A | STATIC PREFERRED / NOT APPROVED |
| Animated QR payload or payout amounts | STATIC PREFERRED; values must remain stable |
| Logo spinner, breathing mark, rotating I-0, moving coins/tokens | MOTION REJECTED |
| Generic failure shake for disputed, cancelled, or expired states | MOTION REJECTED |

## Existing audit disposition

| Existing rule | Disposition |
| --- | --- |
| Button explicit color/opacity transition at 160ms | KEEP; normalized to fast token/easing and explicit color property |
| Persistent `:focus-visible` outline | KEEP; not animation-dependent |
| Mobile flow connector `rotate(90deg)` | KEEP; static responsive layout transform |
| Reduced-motion `scroll-behavior` and transition collapse | REPLACE with explicit Settle reduced-motion contract |
| No keyframes, animation declarations, `transition: all`, or `will-change` | ALREADY ACCEPTABLE |

## Dependency decision

CSS custom properties and CSS transitions are sufficient for the current surface. A library would only be reconsidered if later work proves that coordinated React state animation, shared-layout transitions, or interruptible multi-element sequences cannot be expressed safely with CSS. No dependency is installed or changed in D4D0.8A.
