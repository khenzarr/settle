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

**Speaker note:** Circle does not sign buyer transactions and does not choose settlement policy. The buyer wallet signs funding; the controlled operator path executes permitted release.

**Claims/qualifiers:** Current Circle products shown: USDC, Developer-Controlled Wallets, Contract Platform/deployment infrastructure. No planned Circle products shown.

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

**Headline:** Three milestones from reference proof to merchant readiness.

**Purpose:** Connect evidence to a focused productization plan.

**M1 — Merchant integration foundation:** merchant authentication; API keys/scoped access; idempotent authenticated activation; webhooks/events; sandbox and developer tooling.

**M2 — Settlement operations:** reconciliation dashboard; monitoring; refund/dispute tooling; settlement policy/risk controls; production reliability.

**M3 — Production expansion:** Arc mainnet readiness/deployment; controlled merchant pilots; SDK/plugin layer where demand is proven; ecosystem integrations; measurable usage.

**Evidence/source:** Evidence package lines 103–118, 146–148; claim matrix rows 14, 21–23.

**Speaker note:** These are planned milestones with no invented dates or metrics. Mainnet and merchant pilots are outcomes to earn, not current claims.

**Claims/qualifiers:** All milestone language is PLANNED; no unsupported Circle product expansion is included.

## Slide 10 — Grant use & outcomes

**Headline:** From proven testnet infrastructure to merchant-ready settlement.

**Purpose:** Explain how grant support advances the next layer.

**Grant use:** production security/reliability · merchant authentication/execution controls · webhook/reconciliation infrastructure · SDK/tooling/docs · Arc mainnet readiness · controlled pilots · monitoring/testing/audit readiness.

**Expected outcomes:** merchant-ready Pay with USDC integration · authenticated settlement API · measurable pilot usage · stronger Circle/Arc developer reference implementation · production-grade reconciliation and operations.

**Footer links:** Product · Docs · GitHub · Verified contract · Release evidence. No Drive video URL until uploaded.

**Evidence/source:** Evidence package lines 114–118, 146–174; application requirements supplied by user.

**Speaker note:** The grant converts a proven reference lifecycle into a controlled, observable merchant integration surface.

**Claims/qualifiers:** No requested grant amount or budget percentages invented; outcomes are forward-looking.