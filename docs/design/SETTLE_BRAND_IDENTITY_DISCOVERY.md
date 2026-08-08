# Settle Brand Identity & Design System Discovery

**Milestone:** D4D0.6A
**Status:** Discovery direction only — no final logo, assets, UI redesign, motion library, or dependency changes
**Starting checkpoint:** `28af9950e8f09aab25f14051fb53ed2d62dd10b2`
**Scope:** Brand identity, visual language, and future design-system decisions for Settle

## 1. Executive summary

Settle is API-first programmable USDC settlement infrastructure for marketplaces and real-world commerce. Its identity should make a difficult financial lifecycle feel legible: a marketplace creates a payment intent, a buyer pays, USDC enters escrow, deterministic rules resolve the order, and split payouts, refunds, or disputes follow the canonical state.

The recommended direction is **Convergent Ledger**: a restrained system of independent paths, measured spacing, and a precise resolved axis. It gives Settle a product-specific idea—obligations becoming one settled state—without drawing a literal coin, shield, chain, or generic “S”. The mark should be an abstract open convergence geometry: two or more offset paths enter a controlled alignment and terminate in a short, unmistakable resolved bar. It must be recognizable without text and survive at 16px.

The visual system should retain the current dark graphite foundation and pale cyan utility accent, but make it ownable through blue-green bias, a quiet mineral secondary accent, warmer neutral surfaces, and a consistent settlement-path highlight. Typography should move away from Arial toward one practical system/installed sans stack, with monospace reserved for addresses, hashes, and code. Motion should communicate state and causality—not perpetual decoration. CSS is sufficient for the current product; a future Motion dependency is justified only for coordinated state choreography or shared-layout continuity.

This document chooses a direction for D4D0.6B. It does not produce a logo or any image asset.

## 2. Existing identity audit

### Sources inspected

- `apps/web/app/layout.tsx`
- `apps/web/app/globals.css`
- `apps/web/app/page.tsx`
- `apps/web/app/pay/[orderId]/page.tsx`
- `apps/web/components/buyer-payment-flow.tsx`
- `apps/web/components/payment-handoff.tsx`
- `README.md`, root and web package metadata
- existing `docs/` positioning, integration, grant, and deployment material
- public asset inventory (no public asset directory or brand asset set is currently present)

### Current visual strengths

- The product story is unusually clear for an infrastructure prototype: “payment intent”, “escrow”, “programmable settlement”, “canonical onchain state”, payout splits, evidence, and buyer-controlled execution are visible concepts.
- The existing graphite background, restrained blue-cyan accent, soft surfaces, and limited status colors already support calm confidence better than a bright crypto palette would.
- Financial values use tabular numerals; addresses, hashes, chain IDs, and transaction data use a consistent monospace treatment.
- Status badges, evidence timelines, warnings, explicit confirmation language, focus-visible outlines, 44px controls, responsive layouts, and `prefers-reduced-motion` handling establish a useful accessibility baseline.
- Checkout contains a genuine product-specific surface: exact expected payout splits and a QR/payment handoff that does not pretend scanning submits a transaction.
- Documentation consistently distinguishes canonical state from receipt visibility, buyer custody from server planning, and Arc/Circle infrastructure from Settle product behavior. That truthfulness is a brand asset.

### Identity weaknesses and risks

- The only explicit brand expression is text such as `Settle · payment infrastructure` and `Settle · hosted checkout`; there is no mark, wordmark lockup, favicon, app icon, social image, or metadata image system.
- The root metadata is minimal (`title: Settle`, plus a functional description) and does not establish a scalable brand vocabulary or share-card strategy.
- `Arial, Helvetica, sans-serif` is serviceable but generic. It does not distinguish a premium financial infrastructure product from a project template.
- The cyan-on-graphite direction is coherent but close to generic developer tools and dark Web3 surfaces. Its use of glows and ambient radial gradients needs stronger rules and a distinctive hue/neutral bias.
- There is no homepage app shell: no brand lockup, credible navigation boundary, network context placement, or footer. The current page reads as a demo workspace rather than a platform with a durable identity.
- Hosted checkout inherits the same broad page treatment. It needs a simpler trust boundary and a payment-first header, not a marketing navigation layer.
- Rounded cards, soft gradients, shadows, QR framing, and flow arrows are useful primitives but currently have no explicit hierarchy; future screens could easily become nested-card-heavy or visually inconsistent.
- No common icon language is established. Text, symbols, native bullets, arrows, QR geometry, and status dots currently coexist without a declared family.
- README, docs, grant evidence, demo video, and future investor material have no shared visual primitives, creating a high risk of a separate “presentation brand”.

### What is missing

- Primary mark and exact `Settle` wordmark lockup.
- Favicon and app-icon family, including small-size optical variant rules.
- Social/OG templates and a monochrome mark.
- Logo usage, clear space, minimum sizes, contrast, and misuse guidance.
- Semantic color tokens beyond the current CSS variables.
- Type scale and typography roles.
- Surface, border, radius, depth, and evidence-panel rules.
- Iconography and motion principles.
- Header/footer architecture for homepage and checkout.
- A shared programmable-settlement diagram language for UI, docs, deck, and video.

## 3. Brand positioning

**Settle makes marketplace money programmable from payment intent to final settlement.** It is the controlled infrastructure layer that turns a buyer payment into a verifiable escrow lifecycle and deterministic payouts.

Settle is not a generic wallet, token, NFT/Web3 brand, AI product, consumer bank, card-processor clone, Arc-branded product, or Circle-branded product. “Built on Arc” and Circle infrastructure may be shown as ecosystem context, never as the primary identity.

The brand should make these qualities perceptible: **precision, trust, flow, settlement, finality, programmability, modern commerce, infrastructure, and calm confidence.**

## 4. Brand principles

1. **Make state visible.** Show where value is in the lifecycle and what is authoritative.
2. **Make complexity resolve.** The visual system can begin with multiple parts, but should end with measured alignment and quiet certainty.
3. **Prefer controlled energy.** Light, motion, and contrast should direct attention rather than create hype.
4. **Show the mechanism, not a crypto cliché.** Use paths, thresholds, relationships, and evidence; do not use coins, chains, shields, or token iconography as the identity.
5. **Be exact with money.** Numerals, percentages, units, and confirmation language must remain unambiguous.
6. **Separate ecosystem from product.** Arc and Circle references are provenance/context labels, not brand co-signatures.
7. **Design for translation.** Every important primitive should work in browser UI, monochrome documentation diagrams, a deck, and a video frame.

## 5. Brand personality

| Attribute | We are | We are not |
| --- | --- | --- |
| Precise | measured, explicit, exact | sterile or bureaucratic |
| Technical | understandable infrastructure | cryptic protocol theater |
| Composed | calm under financial uncertainty | passive or vague |
| Deterministic | rules are inspectable and repeatable | rigid without explanation |
| Modern | designed for programmable commerce | trend-chasing or sci-fi |
| Trustworthy | transparent about state and limits | claiming certainty from a pending receipt |
| Luminous | focused points of clarity | neon, noisy, or speculative |

### Voice and microcopy

Settle explains financial state in short, declarative language. It names the asset, state, and consequence; it does not celebrate routine operations or conceal uncertainty.

- **Success:** state what is canonically true: “USDC secured in escrow.” or “Settlement completed.” Avoid exclamation marks, confetti language, and “success” without the completed object.
- **Warning:** name the condition and effect: “Lifecycle evidence is temporarily unavailable. Payment state remains available.” Distinguish degradation from a blocker.
- **Error:** state what failed, what did not happen, and the safe next action. Never expose raw provider errors, credentials, or imply funds moved when confirmation is absent.
- **Pending:** identify the stage—wallet confirmation, submitted transaction, receipt confirmation, or canonical state confirmation. “Transaction submitted” is not “Payment complete.”
- **Recovery:** preserve continuity and reduce duplicate action: “Confirmation is still pending. Check the existing transaction before trying again.”
- **Technical evidence:** use exact hashes, blocks, addresses, units, timestamps, and explorer provenance with plain-language labels. Keep evidence secondary to the current financial state but always inspectable.

Prefer sentence case, active voice, one idea per sentence, and neutral punctuation. Avoid “Funds successfully locked!!!”, “something went wrong”, “instant”, “guaranteed”, and unexplained protocol jargon.

## 6. Four identity territories

Scores use 1–10, where 10 is strongest for the criterion. Scores are directional design judgment, not market or trademark clearance.

### Territory A — Convergent Ledger

**Concept:** Multiple obligations and paths enter a measured field, converge, and become one resolved settlement state.

- **Emotional character:** composed, inevitable, premium, quietly reassuring.
- **Geometric grammar:** parallel or gently curved strokes; deliberate gaps; one shared axis; terminal bars or planes; asymmetric entry resolving into balanced output.
- **Possible mark construction:** an abstract pair/trio of open paths that cross or approach without knotting, then align to one short terminal plane. The negative space is as important as the strokes. No literal arrowhead, currency symbol, or enclosing badge.
- **Wordmark relationship:** stable horizontal lockup; mark provides directional tension while `Settle` remains calm and legible. Avoid forcing the mark into the “S”.
- **Color direction:** deep ink/graphite, pale blue-green core, and a restrained mineral-lime or warm brass trace only for resolved highlights. No permanent gradient dependence.
- **Typography direction:** refined neo-grotesk or technical grotesk with open counters; generous display scale and compact evidence labels.
- **Motion behavior:** independent paths drift minimally, then align with a soft snap and settle; no bounce or celebration burst.
- **UI relationship:** ideal for lifecycle timelines, evidence, status rails, and a one-to-one mapping from obligations to finality.
- **Favicon / 16px:** strong if reduced to two paths plus one terminal; the terminal must be thick enough to survive rasterization.
- **Monochrome:** strong; relies on silhouette and negative space rather than hue.
- **Demo/deck:** excellent; a convergence line can become a diagram rule, title underline, or video transition.
- **Strengths:** most specific to “settlement”; links mark, product story, motion, and evidence naturally; avoids literal finance imagery.
- **Risks:** careless execution could become generic flow lines or a logistics logo.
- **Originality risk:** medium-low if the terminal alignment and negative-space construction are distinctive; avoid generic arrows.
- **Genericity defense:** the resolved terminal and obligation-to-axis idea avoid fintech-blue badges, Stripe-like ribbons, Linear-style luminous loops, Vercel triangles, Arc/Circle circular geometry, and generic Web3 networks. Color cannot be the only differentiator.
- **Implementation complexity:** medium.

### Territory B — Deterministic Branch

**Concept:** One payment enters a controlled routing logic and divides into exact, predeclared payout paths.

- **Emotional character:** capable, programmable, intelligent, operational.
- **Geometric grammar:** one strong input spine; orthogonal branch points; unequal but intentional outputs; basis-point-like increments; no tree icon literalism.
- **Possible mark construction:** a single inset stroke enters a compact routing chamber and exits as two or three calibrated terminal cuts. The chamber is implied by negative space, not a box.
- **Wordmark relationship:** compact symbol to the left of a wider wordmark; symbol can sit beside API diagrams without competing with data.
- **Color direction:** ink with blue-green input and a muted amber/green output distinction; color should never be required to understand the split.
- **Typography direction:** technical grotesk, with tabular numerals and clear percentage alignment.
- **Motion behavior:** one light pulse travels in, pauses at a decision point, then branches on deterministic timing into outputs.
- **UI relationship:** strongest for payout split visualization and developer/API surfaces; less naturally expressive for disputes and refunds.
- **Favicon / 16px:** viable if branch count is reduced to one input and two outputs; fine detail must be removed.
- **Monochrome:** good when branch angles and terminal weights are clear.
- **Demo/deck:** excellent for architecture diagrams and product explanation.
- **Strengths:** directly explains programmable settlement and has high narrative motion potential.
- **Risks:** can read as workflow automation, data routing, or a generic branching API mark rather than settlement.
- **Originality risk:** medium; branching diagrams are common. The mark must not be a literal tree or flowchart.
- **Genericity defense:** calibrated payout terminals and an implied routing chamber distinguish it from generic SaaS workflows. Avoid Stripe-like payment arrows, node-network Web3 diagrams, and Circle/Arc radial constructions.
- **Implementation complexity:** medium-high for rich diagrams, low for static primitives.

### Territory C — Threshold Relay

**Concept:** Value moves through a protected intermediate threshold before its final state is released.

- **Emotional character:** secure, deliberate, architectural, controlled.
- **Geometric grammar:** two planes with a narrow passage; interrupted contours; contained middle state; entry and exit aligned but visually separated.
- **Possible mark construction:** a minimal open passage between offset surfaces, with a central gap that is neither a shield nor a lock. The mark should suggest transition without depicting a gate.
- **Wordmark relationship:** vertical or stacked lockup could work for an app icon, but the default should remain a horizontal wordmark for infrastructure credibility.
- **Color direction:** nearly black/blue graphite, cool cyan at the threshold, and a warm neutral surface to keep it from becoming “security SaaS”.
- **Typography direction:** neo-grotesk with robust small text and a slightly wider tracking system for labels.
- **Motion behavior:** a value pulse enters the passage, holds in escrow, then exits only when the state transition is authorized.
- **UI relationship:** particularly strong for escrow, pending, dispute, warning, and recovery surfaces.
- **Favicon / 16px:** good if the passage is a single solid notch; two-plane detail will otherwise collapse.
- **Monochrome:** very strong as a simple silhouette.
- **Demo/deck:** strong for trust-boundary diagrams; less distinctive as a broad brand story.
- **Strengths:** clearly communicates protected transition and gives checkout a reassuring visual metaphor.
- **Risks:** can become a lock, shield, bridge, or generic security mark; may overemphasize custody rather than programmability.
- **Originality risk:** medium-high because threshold/security symbols are crowded.
- **Genericity defense:** use an open intermediate passage rather than a badge, shield, lock, or bank vault. Warm neutral structure prevents generic cyber-security cyan and avoids Arc/Circle ecosystem geometry.
- **Implementation complexity:** low-medium.

### Territory D — Resolved Register

**Concept:** Complex commerce terms are reconciled through measured offsets until every part snaps into a clean final register.

- **Emotional character:** exacting, editorial, final, premium.
- **Geometric grammar:** offset planes, registration marks, ruled baselines, modular rectangles, one final alignment; intentionally no check mark.
- **Possible mark construction:** two or three incomplete planes with a shared registration notch that creates a unique central void when aligned. It should feel like a resolved instrument, not a document or barcode.
- **Wordmark relationship:** wordmark is primary; a compact mark can sit above or beside it. Custom spacing between `t` and `l` may echo the registration idea without harming readability.
- **Color direction:** ink, bone/cool-white surfaces, blue-green precision line, and muted copper as an editorial confirmation accent.
- **Typography direction:** neo-grotesk with strong numerals and disciplined editorial hierarchy.
- **Motion behavior:** offset layers move on a grid, lock into place, and reduce luminosity when final.
- **UI relationship:** excellent for evidence, completed state, screenshots, and investor material; less direct for payment input.
- **Favicon / 16px:** moderate; registration detail needs an optical simplified variant.
- **Monochrome:** strong at medium sizes, moderate at 16px.
- **Demo/deck:** excellent and highly cinematic in a restrained way.
- **Strengths:** premium, ownable surface language; avoids common crypto geometry; translates exceptionally well to decks.
- **Risks:** may feel like editorial/data tooling rather than commerce infrastructure; finality could become a checkmark substitute.
- **Originality risk:** low-medium if the notch/void is proprietary; high if it uses generic crop marks.
- **Genericity defense:** proprietary registration voids and settlement evidence—not black-and-white minimalism alone—separate it from Vercel/Linear imitation. Avoid crop marks, glowing grids, and Stripe-like layered cards.
- **Implementation complexity:** medium.

## 7. Territory scoring matrix

| Territory | Specificity | Distinctiveness | Trust | Developer fit | Favicon | Motion | UI | Deck/video | Extensibility | Total / 90 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Convergent Ledger | 9 | 8 | 9 | 8 | 8 | 9 | 9 | 9 | 9 | **78** |
| Deterministic Branch | 8 | 8 | 8 | 10 | 8 | 10 | 8 | 9 | 8 | **77** |
| Threshold Relay | 8 | 7 | 10 | 8 | 8 | 8 | 9 | 8 | 8 | **74** |
| Resolved Register | 8 | 9 | 9 | 8 | 6 | 8 | 8 | 10 | 9 | **75** |

## 8. Recommended and fallback territories

### Primary: Convergent Ledger

It best captures Settle rather than only one mechanism. It can express payment, escrow, split resolution, evidence, and finality in one visual vocabulary while remaining calm and non-literal. It also gives the word “Settle” a visual action: disparate terms become aligned.

### Secondary/fallback: Deterministic Branch

Use this if testing shows Convergent Ledger is too abstract at favicon size or too similar to logistics/settlement-flow marks. Deterministic Branch has the clearest explanation of programmable distribution and should remain a product-diagram companion even if it is not the primary logo territory.

Threshold Relay is a useful supporting geometry for escrow and checkout states. Resolved Register is a strong presentation and finality language. They should inform the system, not become four competing identities.

## 9. Logo/mark geometry principles

- Build from 2–3 solid strokes or planes and one controlled negative-space relationship; do not rely on gradients, glow, micro-lines, or text.
- The concept is **paths becoming aligned**, not an “S”, coin, dollar sign, shield, hexagon, cube, chain link, check mark, card, or copied USDC/Circle geometry.
- Use a distinctive terminal condition: an aligned short plane/bar or resolved notch that is specific to Settle. Do not use a generic arrowhead.
- Establish an optical safe area and test at 16, 24, 32, 48, 180, 192, and 512px. The 16px version may simplify to a single convergence plus terminal; this is an optical small-icon variant, not a second identity.
- Require black-on-white, white-on-black, single-color, no-gradient, no-glow, and no-text tests before approval.
- Minimum target: recognizable silhouette at 16px, clear negative space at 24px, and visible path logic at 48px.
- Keep stroke weights optically consistent after rasterization. Avoid internal gaps narrower than one device pixel at the target size.
- The mark and programmable-settlement diagram may share alignment geometry, but must not be the same asset. The brand mark must stay abstract and portable; the diagram must explain the product.

## 10. Wordmark direction

Use the exact product name **Settle**. It should be a restrained custom treatment of a trustworthy sans, not a novelty font or custom font dependency.

- Start with a neo-grotesk or technical grotesk with open `e` counter, stable `S`, and robust lowercase at UI sizes.
- Evaluate a subtle custom `S` curve only if it echoes the selected convergence geometry without turning into a logo. The `S` must remain an ordinary readable letter.
- The most promising letter treatment is controlled spacing/terminal refinement around the **`t` and `l`**: their ascender rhythm can create a quiet resolved-axis cue. Do not connect them or distort the crossbar.
- Keep the two `t` forms identical. Avoid slanted cuts, exaggerated ligatures, or a modified `e` that harms legibility.
- Use a horizontal lockup as the default; a mark-only asset is for favicon/app icon and compact surfaces.
- No custom font file is necessary for discovery or likely implementation. A system stack can carry the wordmark until a final vector wordmark is produced.

## 11. Typography system

Use one primary sans plus the existing/system monospace family. Candidate implementation stacks should be evaluated in D4D0.6B; do not add a font dependency in this phase.

- **Display:** contemporary grotesk, high x-height, restrained geometric construction, tight but not compressed tracking (`-0.04em` to `-0.02em`), weight 650–750. Display should feel engineered, not futuristic.
- **Heading:** same sans, weights 600–700, tight line-height around 1.1–1.2; avoid all-caps headings.
- **Body:** same sans, 400–500, line-height 1.5–1.65, with a maximum measure that supports financial explanation.
- **UI:** 550–650 for actions and labels; sentence case by default. Eyebrows may use uppercase at 0.12–0.16em tracking, never as the only state signal.
- **Financial numerals:** tabular numerals (`font-variant-numeric: tabular-nums`), aligned decimal/unit treatment, no decorative alternate figures. Amount and unit should have an intentional hierarchy.
- **Addresses, hashes, code:** existing/system monospace; use reduced size and wrapping/ellipsis rules without hiding the full value from assistive technology.
- **Tracking:** tighten large display text, use neutral body tracking, and open small uppercase labels. Never use tracking to compensate for a weak font.
- **Line-height philosophy:** dense for labels and data, generous for explanations, with vertical rhythm based on state transitions rather than arbitrary card padding.
- **Weight policy:** reserve the heaviest weight for the primary action, amount, or confirmed state; do not make every label bold.

## 12. Color system

The current cyan/graphite baseline works, but Settle should own it through a slightly blue-green “settlement light”, warmer ink surfaces, and one quiet secondary accent. Values below are proposed semantic roles, not a final token implementation.

| Role | Proposed direction | Use |
| --- | --- | --- |
| Brand core | deep ink `#091117` | mark, strongest dark field |
| Accent | blue-green `#79D8D0` | primary action, active path, links |
| Background | warm graphite `#0A0F14` | page canvas |
| Surface 1 | `#111A20` | primary product surface |
| Surface 2 | `#172329` | elevated/secondary surface |
| Surface 3 | `#1D2A2F` | inset/evidence surface |
| Border | cool mineral white at 14–18% | structural separation |
| Primary text | soft white `#F1F5F2` | high-emphasis text |
| Secondary text | `#B8C8C5` | readable explanation |
| Muted text | `#78908D` | metadata only, never essential meaning |
| Success | settled green `#72D0A2` | confirmed/completed |
| Warning | warm amber `#EBC56F` | deadline/degraded/review |
| Danger | muted coral `#E9929D` | reverted/refunded/error |

Additional semantic roles:

- **Ambient light:** desaturated blue-green `rgba(91, 190, 188, 0.12)`; slow, broad, low opacity only.
- **Settlement-flow highlight:** a controlled blue-green-to-soft-white path gradient may be used in diagrams/video, but the mark and essential UI meaning must work flat.
- **Focus-visible:** bright mint-white `#B8FFF2` with a dark offset or outline that remains visible against every surface.

Use color redundantly with labels, icons, position, or text. Success green is not a substitute for “Completed”. Avoid pure neon, token-blue, large gradient fields, and Arc/Circle-like brand treatment. A gradient is an event/path effect, never the brand’s required identity.

## 13. Iconography direction

Adopt one lightweight, stroke-based icon family with rounded-but-controlled joins and a shared 1.5–1.75px optical stroke. Until a final mini-system exists, use typography and primitive geometry sparingly rather than mixing emoji, arbitrary Unicode, and multiple icon libraries.

Conceptual vocabulary: payment = contained value line; escrow = threshold/pause; settlement = resolved axis; split = measured branch; buyer = person-plus-boundary; marketplace = connected endpoints; dispute = offset warning plane; refund = returning path; completed = resolved terminal state (not a checkmark); QR/handoff = framed matrix with outbound cue; external link = diagonal exit; evidence = document plus event trace.

Icons should clarify state, never decorate every card. Use labels for payment, escrow, settlement, split, buyer, marketplace, dispute, refund, completed, QR/handoff, external link, and evidence. Do not draw custom icons in D4D0.6A.

## 14. Favicon/app-icon strategy

Required future asset matrix:

| Asset | Purpose | Direction |
| --- | --- | --- |
| `favicon.svg` | modern browser tab | mark-only, flat, viewBox with safe area |
| `favicon.ico` | legacy tab support | 16/32 multi-resolution export |
| `icon-16.png`, `icon-32.png`, `icon-48.png` | raster browser/platform surfaces | optically simplified mark |
| `apple-touch-icon.png` | iOS home screen | 180px, generous field and mark |
| `icon-192.png`, `icon-512.png` | Android/PWA | full primary mark, flat and high contrast |
| maskable PWA icon | adaptive crop | safe-zone variant with no critical terminal near edge |
| social mark | avatar/profile | mark-only, monochrome fallback |
| OG icon | social/deck composition | mark plus optional settlement-path motif, not a favicon stretched up |

The primary mark should be suitable in principle, but a small-size optical variant is expected: fewer paths, heavier terminal, larger negative space, no wordmark. D4D0.6B must test all sizes on light and dark backgrounds before exporting. No assets are generated here.

## 15. App-shell strategy

### Homepage

Use a quiet, non-sticky or lightly sticky header with `[mark] Settle` at the visual anchor. Near-term honest navigation may include **Product**, **Developers / API**, and **GitHub** only where those destinations exist or are explicitly represented by current surfaces. Do not invent documentation, dashboard, or merchant routes. Network status can appear as a compact contextual indicator near the product surface or footer, not as logo copy.

### Hosted checkout

Use a simpler header: mark + `Settle` on the left and a short trust/context label on the right, such as “Hosted checkout” or “Secure payment handoff”. The payment amount, network, buyer assignment, escrow state, and action must outrank brand navigation. Do not carry homepage marketing links into checkout.

### Mobile

Keep mark and wordmark together when space permits; collapse to mark-only only below a tested breakpoint. Never make the network badge or a hamburger menu compete with the payment action. Preserve the 44px target and a clear reading order.

### Scroll/background behavior

Prefer a non-sticky homepage header if the page remains a focused demo; use a subtle sticky header only once real multi-section navigation exists. Checkout header may remain visible but should not obscure state. Background ambient fields remain fixed or gently anchored, never scroll-triggered spectacle.

## 16. Footer strategy

Use a minimal credibility footer rather than marketing columns. Future content categories are: **source** (GitHub), **network** (Arc Testnet / ArcScan), **technical references** (real docs/API only), and **ecosystem context** (“Built on Arc” and Circle infrastructure where accurate). Include license/repository attribution where appropriate. Do not add fake company, careers, status, legal, docs, or social links. The footer should repeat the mark/wordmark at low visual priority and never compete with checkout completion.

## 17. Motion identity

Settle motion is **state-driven choreography**: independent elements preserve spatial relationships while value moves through a lifecycle, then pause or align when canonical state is confirmed.

- **Ambient:** slow environmental depth and low-opacity light fields; 18–40 second movement, low amplitude, no attention capture, and disabled/reduced under user preference or constrained devices.
- **Interaction:** buttons compress and return; surfaces elevate by one measured step; copy/status changes crossfade or replace without layout jumps; focus is immediate and visible; wallet actions show preparation, submission, receipt, and canonical confirmation as distinct states.
- **Narrative:** payment enters escrow, waits at a controlled threshold, follows rules, branches to recipients, and resolves. Never imply finality from a wallet click, hash, spinner, or explorer visibility alone.

Motion should communicate **causality, containment, progression, and finality**. It should not imply yield, speculation, speed guarantees, or autonomous custody.

## 18. Three signature motion concepts

1. **Converge / Resolve:** independent thin paths move with gentle ease toward one measured axis; the final terminal brightens briefly and then rests. Works for logo reveal, homepage hero, checkout completion, evidence timeline, video opener, and deck transition.
2. **Route / Distribute:** one restrained value pulse crosses an escrow threshold, pauses, then branches into calibrated payout paths whose lengths/weights correspond to shares. Works for split visualization and architecture diagrams. It must be deterministic and not particle-like.
3. **Register / Finalize:** offset planes or labels move to a shared grid, with a short lock pause and reduced glow after alignment. Works for status transitions, finality, evidence cards, and deck chapter transitions.

**Preferred signature:** Converge / Resolve. Use Route / Distribute as the product-specific split narrative and Register / Finalize as a supporting finality behavior. All three can scale across logo animation, homepage, checkout, settlement visualization, demo video, and deck transitions without making them identical animations.

## 19. Cinematic boundary

“Cinematic” means choreography, depth, intentional timing, restrained luminosity, spatial continuity, and state-driven movement. It means the audience understands what changed and why. It does not require WebGL, particles, shader backgrounds, cursor-follow glows, scroll gimmicks, constant loops, or 3D cards. A still frame must remain credible; motion adds comprehension and emotional pacing rather than rescuing weak content.

## 20. Motion technology decision framework

### CSS is enough when

- the animation is local to one element or state;
- hover, focus, press, opacity, transform, border, and small progress changes are involved;
- keyframes can express a finite reveal or ambient field;
- the DOM structure does not change between states;
- reduced-motion behavior can be expressed with media queries;
- server-rendered checkout should remain light and resilient.

### A Motion dependency materially improves the system when

- payment states require coordinated presence/exit choreography across multiple surfaces;
- a split visualization changes layout and needs shared-layout continuity;
- route/page transitions preserve a settlement path between homepage and checkout;
- several independent elements need one declarative timeline tied to canonical state;
- interruption, cancellation, or recovery must reverse choreography without fragile CSS classes.

### Recommendation

Remain CSS-first in D4D0.6A and D4D0.6B. Do not install a motion library until one concrete cross-surface choreography cannot be implemented readably with CSS and small React state boundaries. If that proof appears, evaluate the smallest maintained Motion option against bundle cost, SSR behavior, reduced-motion support, and testability. Do not add a dependency merely to make a prototype feel animated.

## 21. Programmable-settlement visual motif

Create a reusable **single-axis settlement rail**: one payment node enters from the left, passes through a visually distinct escrow chamber/threshold, then resolves into two or more deterministic payout terminals on a shared baseline. Use line weight, spacing, and labels to show sequence; use color only to highlight active state or confirmed flow.

This motif should connect:

- the abstract mark’s convergence/alignment geometry;
- a homepage diagram explaining one payment → escrow → distribution;
- checkout’s expected split visualization;
- docs/API architecture diagrams;
- deck and demo-video transitions.

It must not require text to communicate direction, but labels and exact percentages remain necessary for financial comprehension. The mark is the compressed identity of resolution; the rail is the explanatory product diagram.

## 22. UI surface system

Define a shallow hierarchy:

1. **Page:** warm graphite canvas and ambient field.
2. **Primary product surface:** one dominant working surface with a clear border and restrained depth.
3. **Secondary surface:** supporting context such as wallet/network or payout summary.
4. **Inset surface:** technical evidence and transaction intent, visually quieter and denser.
5. **Status surface:** lifecycle state with semantic border/accent and plain-language message.
6. **Warning/degraded notice:** amber/coral edge, explicit consequence and recovery path.
7. **Technical evidence:** monospace values, explorer links, timestamps/blocks, and provenance.

Use a radius ladder: large page/product surfaces around 20–24px, secondary surfaces around 12–16px, and controls/insets around 8–10px. Keep nested radius visibly smaller than its parent. Borders carry more hierarchy than shadows; use one broad soft shadow only for a primary surface or handoff/QR focus. Internal highlights should be single-pixel or low-opacity path edges. Use translucency only when a surface overlays a stable background and text contrast remains guaranteed. Do not nest cards by default; if a block contains one state or one action, use spacing and a divider instead.

## 23. Accessibility implications

- Every semantic state needs text and not only color, position, animation, or icon.
- Test accent, muted text, borders, focus rings, and status colors against every surface in light/dark and monochrome modes.
- Preserve 44px minimum controls, keyboard order, visible focus, clear labels, and full-value access for truncated hashes/addresses.
- Keep financial amounts and percentages tabular and screen-reader sensible; do not use visual alignment to alter reading order.
- `prefers-reduced-motion` should remove ambient loops and convert narrative motion into instant, state-labeled transitions.
- Avoid flashing, continuous high-frequency movement, decorative QR animation, and motion that suggests an irreversible transaction has completed.
- Icons need accessible names when informative and `aria-hidden` when redundant.

## 24. Performance implications

Favor CSS transforms/opacity, static SVG geometry, system fonts, and server-rendered stable surfaces. Avoid WebGL, particle systems, large raster backgrounds, font proliferation, and continuous layout animation. Keep the mark as a small vector source and export raster icons only at required sizes. Any future Motion dependency must justify bundle cost with a real shared transition. Respect low-power devices and reduced motion; checkout reliability and wallet interaction outrank visual effects.

## 25. Grant/video/deck implications

The same primitives should travel across formats: mark, convergence rail, blue-green settlement light, warm graphite surfaces, title/eyebrow hierarchy, tabular numerals, evidence timeline, and the single icon family. Video should use state choreography and captured canonical proof rather than speculative UI. Deck diagrams should remain flat, high-contrast, and legible when printed or exported to PDF/PPT. Screenshots should be recognizable as Settle without relying on a browser chrome or a live glow. Arc/Circle attribution can be a small ecosystem caption, never a co-branded title card.

## 26. Asset matrix for D4D0.6B

| Deliverable | Variants/tests | Acceptance criteria |
| --- | --- | --- |
| Primary mark SVG | full, mark-only, light/dark, monochrome | no gradients required; clear at 24px |
| Wordmark lockup | horizontal, dark/light, mark-only fallback | exact “Settle”; readable at UI scale |
| Small mark | 16/24/32/48px optical simplification | recognizable in browser tab |
| Favicon set | `favicon.svg`, `favicon.ico`, `icon-16.png`, `icon-32.png` | correct metadata wiring, high contrast |
| App/PWA icons | `apple-touch-icon.png`, `icon-192.png`, `icon-512.png`, maskable | safe-zone compliant, flat fallback |
| Social/OG system | mark avatar, OG mark, title-safe template | works in dark/light and 1:1/1.91:1 |
| Color/type tokens | semantic reference and contrast table | no arbitrary token sprawl |
| Icon mini-system | required lifecycle/evidence icons | one family, accessible labels |
| Settlement rail | static diagram primitives and split example | exact percentages remain legible |
| Motion storyboards | converge, route, register | reduced-motion and state semantics specified |
| Shell specification | homepage, checkout, mobile, footer | only honest existing/near-term links |

## 27. What MUST NOT be introduced

- No generic “S” in a circle, two-arrow S, dollar sign, coin, shield, hexagon, cube, chain link, check mark, payment card, or copied USDC/Circle geometry.
- No neon-heavy crypto palette, speculative gradients, token logos, meme language, AI-template visuals, or generic consumer-bank blue.
- No Arc or Circle wordmark/shape imitation and no claim of trademark clearance.
- No fake docs, product, dashboard, merchant, company, legal, or social routes.
- No final logo, SVG/PNG/favicon/OG asset, font file, or brand icon in D4D0.6A.
- No redesign of application code, product semantics, checkout behavior, or information architecture in this phase.
- No motion library, WebGL, particles, scroll gimmicks, cursor-follow lighting, or always-on looping narrative.
- No color-only success/error communication, hidden technical evidence, or animation that treats submission as finality.
- No proliferation of fonts, icon families, radii, shadows, or arbitrary colors.

## 28. Recommendation for D4D0.6B

Approve **Convergent Ledger** as the primary direction and **Deterministic Branch** as the fallback/supporting product-diagram direction. D4D0.6B should produce three to five black-and-white mark sketches per direction, test them blind at 16/24/32/48px, and reject any construction that reads as a generic S, arrow, security badge, or chain. Select one mark only after silhouette, monochrome, accessibility, and deck-frame reviews.

Then define the final `Settle` wordmark treatment, semantic token table, icon family, and shell wireframes using the chosen mark. Build a static settlement rail before any animation. Prototype one CSS-only narrative from payment to escrow to split, measure performance, and only then decide whether coordinated state transitions justify Motion. Export the required asset matrix only after the geometry is approved. Keep all current product semantics and canonical-state language unchanged.

The review checkpoint should be the proposed future commit:

```text
docs(design): define Settle brand identity direction
```

No commit or push is part of D4D0.6A.