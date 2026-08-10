# Settle — Circle 2026 Cohort 2 Investor Deck

**Format:** 16:9 widescreen · **Target:** 10 slides · **Status:** final content source of truth

## Slide 1 — Settle

**Headline:** Programmable USDC settlement for modern commerce.

**Purpose:** Establish Settle as API-first infrastructure, not a wallet or escrow dApp.

**Final copy:** API-first payment and settlement infrastructure for marketplaces, built on Arc with Circle.

**Visual plan:** Dark Mineral Settlement field; I-0 master mark and Settle lockup; restrained Convergent Ledger rail; small links for Product, GitHub, Circle 2026 Cohort 2.

**Evidence/source:** `docs/grant/final/01_EVIDENCE_PACKAGE.md` lines 6–13; production URL and repository links.

**Speaker note:** Marketplaces keep their commerce experience. Settle makes the payment-to-settlement lifecycle programmable and inspectable.

**Claims/qualifiers:** Arc/Circle are ecosystem context. No endorsement or Arc mainnet claim.

## Slide 2 — The problem

**Headline:** A payment button is not settlement infrastructure.

**Purpose:** Explain why marketplace stablecoin payments remain difficult.

**Final copy:** A wallet transfer answers “did value move?” Marketplace settlement must also answer: which order, under which terms, to whom, when, and with what canonical evidence?

**Visual plan:** Left: simple wallet transfer. Right: payment intent → buyer handoff → escrow → canonical state → split payouts → refund/dispute lifecycle → reconciliation. A single resolving rail connects the right side.

**Evidence/source:** Evidence package lines 11–13, 66–75; claim matrix rows 12–18.

**Speaker note:** The hard part is the state machine and operational boundary around the transfer, not adding another token button.

**Claims/qualifiers:** Describes the implemented reference boundary; does not claim every future merchant operation is complete.

## Slide 3 — The solution

**Headline:** Add Pay with USDC through one settlement layer.

**Purpose:** Make the product integration story immediately legible.

**Final copy:** Marketplace checkout → Settle API → hosted checkout → buyer wallet → Arc USDC → programmable recipients. The marketplace keeps its own checkout and product experience.

**Support labels:** Plan · handoff · escrow · settlement logic · canonical reconciliation.

**Visual plan:** Large editable system rail with Marketplace and programmable recipients as endpoints; Settle is the central layer, not the chain or wallet.

**Evidence/source:** Evidence package lines 6–13, 120–128; claim matrix row 13.

**Speaker note:** Today’s public release proves the planning/read boundary and hosted reference flow. Merchant authentication and creation are next productization.

**Claims/qualifiers:** “Can integrate” means consume current planning, canonical-read, Payment Intent, and handoff APIs; no live merchant integration claimed.

## Slide 4 — How it works

**Headline:** From payment context to canonical finality.

**Purpose:** Show the full lifecycle and key trust boundaries.

**Final copy:** 1 Marketplace creates payment context · 2 Settle prepares Payment Intent · 3 Customer opens hosted checkout / QR · 4 Wallet authorizes Arc USDC · 5 SettlementEscrow secures funds · 6 Controlled settlement distributes by terms · 7 Canonical final state supports reconciliation.

**Callouts:** QR opens the hosted checkout; it does not transfer USDC. Public planning is non-mutating in the current release. Buyer signs approval/funding; controlled operator actions are separate.

**Evidence/source:** Evidence package lines 68–83; claim matrix rows 15–17, 23, 25–26.

**Speaker note:** The contract is authoritative. A receipt or UI panel is supporting evidence, not finality by itself.

**Claims/qualifiers:** Deadlines are guards; no automatic settlement, refund, or dispute resolution is claimed.

## Slide 5 — Proven settlement

**Headline:** A real Arc Testnet settlement completed.

**Purpose:** Provide concrete, standalone evidence.

**Final copy:** Production hosted checkout · 0.05 USDC · Completed · active escrow 0.

**Evidence panel:** Merchant 90% / 0.045 USDC · Platform 10% / 0.005 USDC. Order `0xf3b093dc…dbcfed`; release `0x168edb8b…9463ef`; verified `SettlementEscrow 0x3e438a…f795f`.

**Visual plan:** Clean production checkout capture plus editable evidence panel and ArcScan links. Label “Arc Testnet · chain 5042002”.

**Evidence/source:** `05_FINAL_STAGE_A_RUN.md` lines 9–12, 63–97; `06_FINAL_STAGE_B_RUN.md` lines 59–77; linked contract/release.

**Speaker note:** This is a fresh final-demo order, not commercial volume. Approve/fund hashes were not uniquely recovered and are intentionally omitted; canonical state and release receipt prove the result.

**Claims/qualifiers:** Testnet evidence only; no mainnet or commercial-traction claim.

## Slide 6 — Arc + Circle

**Headline:** Arc, Circle, and Settle each do a different job.

**Purpose:** Clarify integration value without implying endorsement.

**Final copy:** Circle supplies programmable money and controlled wallet/contract infrastructure. Arc supplies the settlement environment and canonical onchain state. Settle turns those primitives into marketplace settlement infrastructure.

**Columns:** ARC — Arc Testnet execution, USDC-native settlement path, receipts/finality evidence. CIRCLE — USDC, Developer-Controlled Wallets for controlled operator execution, Contract Platform/deployment infrastructure. SETTLE — planning, hosted checkout, wallet handoff, escrow, splits, reconciliation boundary.

**Evidence/source:** Evidence package lines 42–64, 134–140, 152–158; video requirements map lines 8–12.

**Planned-next callout:** PLANNED NEXT — CCTP-powered cross-chain checkout.

**Speaker note:** Current Circle products are USDC, Developer-Controlled Wallets, and Contract Platform/deployment infrastructure. Planned next is CCTP-powered cross-chain checkout. CCTP is not currently implemented and is deliberately separated from the current Circle integrations list. Circle does not sign buyer transactions and does not choose settlement policy. The buyer wallet signs funding; the controlled operator path executes permitted release.

**Claims/qualifiers:** Current Circle products shown: USDC, Developer-Controlled Wallets, Contract Platform/deployment infrastructure. Planned Circle products shown: CCTP only.

## Slide 7 — Architecture & codebase

**Headline:** The implementation is separated by trust boundary.

**Purpose:** Make technical credibility inspectable.

**Visual plan:** Editable architecture: Marketplace/backend → public planning/read API → Payment Intent → hosted checkout → buyer wallet → SettlementEscrow → server-only Circle operator boundary → recipients. Repository boundary strip: `apps/web` · `packages/shared` · `packages/circle` · `packages/contracts`.

**Code callouts:** `packages/circle/src/client.ts` — server-only clients; `operator-settlement-plan.ts` — validates target/role/ABI; `SettlementEscrow.sol` — `fundOrder` / `releaseOrder`.

**Evidence/source:** `docs/grant/video/CODEBASE_WALKTHROUGH.md` rows C01–C04; `docs/grant/final/01_EVIDENCE_PACKAGE.md` lines 66–75.

**Speaker note:** Circle is isolated from browser custody. The contract enforces buyer, amount, lifecycle, and stored BPS terms; the operator boundary is controlled and not a public automated execution endpoint.

**Claims/qualifiers:** Source callouts are exact repository references; no secrets, IDs, or private request construction shown.

## Slide 8 — Current status

**Headline:** Proven technical traction; merchant productization next.

**Purpose:** State what exists today without fabricated commercial traction.

**Final copy:** Public product deployed · developer demo/docs · verified SettlementEscrow on Arc Testnet · buyer-funded settlement completed · deterministic 90/10 release · controlled Circle-backed operator release · 252 tests (85 web + 167 Foundry).

**Truth line:** Third-party production merchant integration is the next productization layer.

**Founder block:** Founder / Product & Engineering. Detailed founder biography remains in the application form.

**Evidence/source:** Evidence package lines 15–21, 23–48, 114–118; Stage B lines 43–77; video walkthrough C07.

**Speaker note:** These are technical/product achievements, not transaction volume, revenue, TVL, MAU, or merchant adoption.

**Claims/qualifiers:** Arc Testnet only; public APIs are planning/read; controlled operator execution is separate.

## Slide 9 — Roadmap

**Headline:** From proven Arc settlement to cross-chain USDC and production pilots.

**Purpose:** Communicate the evolution from the proven Arc-native foundation through merchant API productization, planned CCTP-powered cross-chain checkout, and production settlement pilots.

**Today — proven foundation:** Arc Testnet · Pay with USDC · Payment Intent · Hosted Checkout / QR · SettlementEscrow · Circle-controlled release · Canonical Completed settlement.

**M1 — Merchant integration foundation / Merchant-ready API:** merchant authentication; scoped API keys; authenticated order activation; idempotency; webhook/lifecycle event delivery; integration sandbox; merchant-ready API boundary.

**M2 — Cross-chain Pay with USDC — CCTP:** CCTP V2 integration; Arc App Kit / Bridge Kit where appropriate; source-network selection in checkout; route/fee quoting; Circle Forwarding Service where appropriate; Payment Intent ↔ CCTP transfer binding; Arc as canonical settlement destination; cross-chain payment reconciliation; replay/duplicate-payment protection; failure/recovery handling.

**M2 visual route:** CCTP-supported networks (Ethereum / Base / Arbitrum / Solana / …) → CCTP → Arc (canonical destination) → Settle. Named networks illustrate planned supported test routes and do not claim permanent or universal support.

**M3 — Production settlement & merchant pilots:** merchant reconciliation tooling; refund/dispute operations; monitoring and reliability; settlement policy/operational controls; Arc mainnet readiness; controlled merchant pilots; SDK/plugin layer where demand proves it; measurable payment/settlement usage.

**Evidence/source:** Evidence package lines 103–118, 146–148; claim matrix rows 14, 21–23.

**Speaker note / M1 acceptance concept:** A test merchant can authenticate, prepare/activate an order through the intended controlled boundary, retrieve canonical payment state and receive lifecycle events without exposing Settle operator credentials.

**Speaker note / M2 acceptance concept:** Demonstrate native USDC payment from supported source-network test routes into Arc, bind the transfer to the exact Settle Payment Intent, reconcile the expected amount, prevent duplicate funding and advance the payment into Settle's canonical settlement lifecycle. A planned test target may include one supported EVM source route → Arc and one supported Solana route → Arc.

**Speaker note / M3 acceptance concept:** Production-grade operational controls, Arc mainnet readiness and a controlled merchant pilot path with measurable settlement evidence.

**Claims/qualifiers:** The foundation is proven on Arc Testnet. M1, M2, and M3 are planned with no invented dates, partners, or metrics. CCTP is not currently implemented. CCTP is the only planned Circle product shown.

## Slide 10 — Grant use & outcomes

**Headline:** Fund the path from proven Arc settlement to cross-chain merchant pilots.

**Purpose:** Explain how grant support advances the next layer.

**Grant use:** merchant authentication/execution controls · webhook/reconciliation infrastructure · CCTP cross-chain checkout integration · Payment Intent ↔ CCTP reconciliation · cross-chain recovery/replay protections · monitoring/reliability · Arc mainnet readiness · controlled merchant pilots · developer tooling/SDK where justified.

**Planned expected outcomes:** merchant-ready controlled API · Cross-chain Pay with USDC from CCTP-supported networks, settled canonically on Arc. · observable, reliable pilot operations.

**Footer links:** Product · Docs · GitHub · Verified contract · Release evidence. No Drive video URL until uploaded.

**Evidence/source:** Evidence package lines 114–118, 146–174; application requirements supplied by user.

**Speaker note:** Grant use advances merchant authentication and execution controls, webhook and reconciliation infrastructure, CCTP cross-chain checkout integration, Payment Intent to CCTP reconciliation, cross-chain recovery and replay protections, monitoring and reliability, Arc mainnet readiness, controlled merchant pilots, and developer tooling or SDK work where justified. The cross-chain outcome is planned; CCTP is not currently implemented.

**Claims/qualifiers:** No requested grant amount, budget percentages, timeline dates, merchant partners, or commercial metrics invented; all CCTP outcomes are forward-looking.