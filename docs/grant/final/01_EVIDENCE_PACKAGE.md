# Settle — Final Grant Evidence Package

**Audit basis:** canonical repository HEAD `f718b94ec90108b1ee20c55fb4040bf9c5615a74`; read-only repository review and read-only HTTP checks on 2026-08-10. This package records evidence; it does not add product capability.

## Product summary

Settle is **API-first programmable USDC payment and settlement infrastructure for marketplaces, payment platforms, and commerce applications**. Its primary integration story is that a marketplace or payment platform connects through the Settle API and adds **Pay with USDC** to its existing checkout.

`marketplace checkout → Settle API → Settle Payment Intent / order → hosted checkout → QR / deeplink → customer wallet → Arc Network → USDC approve if required → fundOrder(orderId) → canonical Funded → escrow → fulfillment / resolution → programmable settlement → recipient payouts → canonical finality / reconciliation`.

The web app is a reference/demo surface. Settle should not be described merely as an escrow dApp, wallet payment app, or QR payment app.

Without Settle, a marketplace adding an onchain USDC payment option may need to build and maintain payment-intent/order mapping, wallet payment handoff, Arc/USDC transaction preparation, escrow, canonical payment-state reconciliation, programmable payout splits, refund/dispute lifecycle, and settlement evidence. Settle packages these concerns into an API-first settlement boundary and hosted payment surface. This describes the implemented reference boundary; it does not claim that future merchant-platform features are already complete.

## Public deployment

- Production: <https://settle-web-coral.vercel.app>
- Repository: <https://github.com/khenzarr/settle>
- Audited starting HEAD: `f718b94ec90108b1ee20c55fb4040bf9c5615a74`
- Read-only HTTP observations: homepage and Demo 002 checkout returned HTTP 200; production order, Payment Intent, and handoff APIs returned readable JSON.
- The production URL is externally verified in this audit. The repository’s older readiness note correctly says the deployment is not proven by committed Vercel configuration; no Vercel config is added here.

## Deployed Contracts

Grant-application-ready public deployment evidence:

| Field | Value |
|---|---|
| Contract | `SettlementEscrow` |
| Network | Arc Testnet |
| Chain ID | `5042002` |
| Address | `0x3e438ae878a8dc02c83f5545047cbde33a4f795f` |
| USDC | `0x3600000000000000000000000000000000000000` |
| Deployment transaction | `0xfb7fc30e73157fa7cb52ffbdfafd6e9d8e24a777d402d7be88633510edc1e91d` |
| Explorer | <https://testnet.arcscan.app/address/0x3e438ae878a8dc02c83f5545047cbde33a4f795f> |
| Source verification | Verified |

`SettlementEscrow` is the canonical application contract currently deployed by Settle. The exact Settle application-contract count in this evidence package is **one**; Circle resource identifiers below are supporting infrastructure evidence, not additional smart-contract addresses.

The deployment address, chain, USDC binding, verification, roles, pause state, and integrity procedure are documented in `docs/deployment/CIRCLE_CONTRACT_DEPLOYMENT.md`, `docs/deployment/ARC_TESTNET_DEPLOYMENT.md`, and `docs/architecture/ARC_TESTNET_CONFIG.md`. No deployment is rerun in this phase.

## Contract evidence

`packages/contracts/src/SettlementEscrow.sol` is verified source. It binds an immutable six-decimal USDC-compatible token, uses `AccessControl`, `Pausable`, and `ReentrancyGuard`, and defines `Created → Funded → Disputed/Completed/Refunded/Cancelled` lifecycle states. `createOrder` validates unique IDs, deadlines, nonzero terms hash, recipient count, duplicate recipients, and shares totaling 10,000 BPS.

`fundOrder` is callable only by the declared buyer, pulls the exact amount with `transferFrom`, and increments `totalActiveEscrow`. Release decrements active escrow and pays configured recipients; integer remainder goes to the final recipient. Refund returns the full amount to the buyer. Dispute resolution is arbitrator-controlled and explicitly chooses release or refund. Deadlines are guards and do **not** automatically settle or refund. The contract’s paused state is documented as unpaused for the canonical deployment/integrity check; do not imply pause is impossible.

Contract tests include unit, fuzz, invariant, and Arc deployment/integrity-oriented tests under `packages/contracts/test/`. Repository validation includes build, ABI freshness, formatting, and Foundry tests; this audit does not rerun potentially environment-dependent validation.

## Circle infrastructure evidence

Repository evidence documents Circle Developer-Controlled Wallet infrastructure and Circle Contract Platform integration. The controlled lifecycle record `docs/integrations/D4B2_LIVE_MARKETPLACE_LIFECYCLE.md` records Circle-backed `createOrder` and operator `releaseOrder`, followed by Arc receipt and canonical state verification. Circle submission is not treated as finality. Contract payout transfers are made by `SettlementEscrow`, not Circle token-transfer operations.

Public-safe wording: “Settle uses Circle Developer-Controlled Wallet infrastructure for controlled operator contract execution and uses Circle Contract Platform deployment tooling.” Public-safe evidence may include the Circle-controlled wallet public address, ArcScan links, and public transaction/deployment proof.

Supporting/internal grant references (keep separate from the public deployed-contract table; do not publish automatically):

- Circle contract ID: `019fdc43-d356-76e8-a413-ca6f8311cc07`
- Circle deployment transaction ID: `164b9a2a-4e4f-599a-b53d-18861181aac7`
- wallet set ID: `eb294e60-b82e-540b-b5ac-66be2274407d`
- wallet ID: `928ff756-5414-58f8-942b-1ec537677976`
- Circle wallet public address: `0x4ac8d35f1795531f1e0bef3826db5aab730fcd34`

Never expose API keys, Entity Secret, recovery files, private keys, `.env` values, or idempotency keys.

## API evidence and boundary

| Endpoint | Purpose | Mutation classification | Marketplace problem solved | Claim-safe description |
|---|---|---|---|---|
| `POST /api/v1/orders/plan` | Validate/project order parameters and deterministic order plan | Non-mutating; no chain write | Lets a marketplace preview a canonical Payment Intent shape, amount, deadlines, terms hash, and split before execution infrastructure exists | “Settle provides a deterministic order-planning API.” Do not call it order creation. |
| `GET /api/v1/orders/[orderId]` | Read canonical order projection and evidence | Read-only | Gives marketplace systems a stable state/accounting view | “Settle exposes canonical order state.” |
| `GET /api/v1/payment-intents/[orderId]` | Project payment state, checkout availability, network, split, and lifecycle | Read-only | Separates payment intent/status consumption from UI implementation | “A marketplace can consume a Payment Intent read model.” |
| `GET /api/v1/payment-intents/[orderId]/handoff` | Return canonical hosted checkout, deeplink, and QR payload | Read-only | Enables desktop-to-mobile and external checkout handoff | “A marketplace can retrieve a QR-ready hosted checkout handoff.” |

The boundary is explicitly: planning → checkout → payment handoff → canonical state → operator execution. Public web buyer actions are browser-wallet actions. The operator route is planning-only; there is no public server-side execution endpoint in this release.

## QR / handoff evidence

Production read confirmed:

`checkout.url == qr.payload == deeplink.url == https://settle-web-coral.vercel.app/pay/<orderId>`.

The QR encodes the canonical Settle hosted-checkout URL. Scanning it opens the Settle checkout on the customer's device. The customer's wallet then authorizes the Arc USDC payment flow: `approve` if needed, then `fundOrder(orderId)`. The QR itself performs no blockchain transaction: it does not directly transfer USDC, pay or fund escrow, submit payment, encode calldata, or create a wallet session.

## Demo 002 — immutable evidence

Demo 002 is permanently read-only:

- Order: `0x221c314b3d80445868b1aeec7f5ebdbaf50fd48c320245659b689b7a4fca1765`
- Buyer: `0x0b943fe9f1f8135e0751ba8b43dc0cd688ad209d`
- Merchant: `0xb2f6cfd0960a1fcc532de1bf2aafcc3077b4c396`
- Platform/operator: `0x4ac8d35f1795531f1e0bef3826db5aab730fcd34`
- Amount: `0.05 USDC`; split `0.045` merchant / `0.005` platform
- Lifecycle: create → approve → fund → release → `Completed`
- Checkout: <https://settle-web-coral.vercel.app/pay/0x221c314b3d80445868b1aeec7f5ebdbaf50fd48c320245659b689b7a4fca1765>

The controlled lifecycle evidence and ArcScan transaction links are in `docs/integrations/D4B2_LIVE_MARKETPLACE_LIFECYCLE.md`. Production read confirmed canonical `Completed`, amount, split, no buyer action, and inactive escrow. Production currently reports `Evidence limited`; this is non-blocking evidence-layer degradation, not a contradictory canonical state. Use ArcScan lifecycle/payout transactions for final proof. Never create, approve, fund, release, refund, dispute, resolve, or cancel Demo 002 again.

## Readiness, mobile, and deployment evidence

The readiness record specifies a bounded read-only check (`eth_chainId`, `eth_getCode`, canonical order `eth_call`, block number, bounded logs), with optional lifecycle evidence allowed to degrade independently. Existing deployment evidence states the mobile layout passed real-device inspection and Demo 002 smoke checks passed canonical rendering, 0.05 USDC, no buyer action, 90/10 split, production-origin QR, and mobile layout. These are evidence records, not a claim of a new test run in this phase.

## Known limitations

- Arc Testnet only; no mainnet deployment and no production-mainnet readiness proof.
- No authenticated marketplace order-creation endpoint; `/api/v1/orders/plan` is planning-only.
- No public server-side automated settlement execution endpoint; controlled operator CLI/Circle process is separate.
- No automatic deadline settlement, automatic dispute refund, or automatic dispute resolution.
- Dispute/refund lifecycle is contract capability, not proof of an automated policy or live dispute case.
- No existing merchant integration is evidenced in this repository package.
- Production optional lifecycle evidence is currently degraded while canonical state remains authoritative.
- Testnet USDC has no real-world value; Circle/Arc operational availability is provider-dependent.

## Current proof vs. future productization

**Currently proven:** API-first marketplace planning/read boundary; Payment Intent projection; hosted checkout; QR/deeplink checkout handoff; buyer-controlled Arc USDC funding; escrow; programmable deterministic split settlement; refund/dispute contract lifecycle; canonical state reads; controlled Circle-backed operator actions; and a public deployed reference product.

**Not yet proven / future productization:** real third-party merchant integration; merchant authentication/API keys; a production merchant account system; merchant webhooks; an SDK/plugin ecosystem; automated settlement orchestration; a merchant dashboard/reconciliation suite; and Arc mainnet production usage. These are future work, not current product claims.

## Grant form copy helpers

### One-line product description

Settle is API-first programmable USDC payment and settlement infrastructure for marketplaces, payment platforms, and commerce applications.

### What Settle enables

Settle gives a marketplace an API-first integration boundary and hosted checkout for adding **Pay with USDC**, then maps buyer-authorized Arc USDC funding into escrow, canonical payment state, programmable payout splits, refund/dispute lifecycle, and settlement evidence.

### Deployed contract(s)

Settle currently has **one canonical application contract** deployed on Arc Testnet: verified `SettlementEscrow` at `0x3e438ae878a8dc02c83f5545047cbde33a4f795f` (chain ID `5042002`), bound to Arc Testnet USDC at `0x3600000000000000000000000000000000000000`. Explorer: <https://testnet.arcscan.app/address/0x3e438ae878a8dc02c83f5545047cbde33a4f795f>.

### Circle integrations

Settle uses Circle Developer-Controlled Wallet infrastructure for controlled operator contract execution and Circle Contract Platform deployment tooling. Circle resource IDs are supporting/internal grant evidence, not additional deployed smart-contract addresses.

### Arc integrations

Settle uses Arc Testnet for buyer-authorized USDC funding, contract escrow, deterministic split payouts, canonical state, transaction receipts, and finality evidence through ArcScan.

### Current production URL

Public reference product: <https://settle-web-coral.vercel.app>.

### Current limitations

The current proof is an Arc Testnet reference product and controlled lifecycle, not Arc mainnet usage or a live third-party merchant integration. Merchant authentication/API keys, production merchant accounts, webhooks, SDKs/plugins, automated settlement orchestration, and a merchant reconciliation dashboard remain future productization.

## Reviewer answers

**Why Arc?** Arc Testnet provides the demonstrated settlement network and finality surface for the contract proof; this package claims testnet, not mainnet.

**Why USDC?** USDC gives marketplaces a six-decimal, dollar-denominated settlement unit suitable for deterministic split accounting; the contract binds the canonical Arc USDC address.

**Why Circle?** Circle supplies Developer-Controlled Wallet and Contract Platform primitives for controlled operator execution without exposing a raw private key in the application.

**Why Settle instead of implementing settlement?** Settle packages canonical order state, escrow accounting, deterministic recipient splits, buyer-wallet funding, read APIs, hosted checkout, handoff, and evidence boundaries into a reusable settlement protocol surface rather than forcing each marketplace to rebuild them.

**What is API-first?** The planning, canonical order, Payment Intent, and handoff endpoints are explicit integration boundaries; the web UI is a reference surface over them.

**Where is custody?** During funding, USDC is held by the deployed `SettlementEscrow` contract. The buyer wallet initiates funding; the operator wallet controls the permitted operator actions.

**Who signs customer transactions?** The buyer’s connected EIP-1193 wallet signs approval and `fundOrder`.

**Who controls operator settlement?** The configured operator role, exercised through the controlled Circle wallet/CLI process; no public execution route is claimed.

**How are payouts determined?** Immutable per-order recipient arrays and 10,000-BPS shares; release computes deterministic amounts and assigns integer remainder to the final recipient.

**How are disputes/refunds represented?** `Disputed` and arbitrator-selected `Release`/`Refund` states are represented in the contract; no automatic policy is claimed.

**What is live today?** The production reference surface, Arc Testnet contract, hosted checkout/handoff, buyer browser-wallet flow, canonical reads, and controlled Circle-backed lifecycle proof.

**What remains future work?** Authenticated marketplace creation, durable/idempotent server execution, operational automation, broader integrations, and mainnet readiness.

## Evidence handling rule

Publish only public addresses, public ArcScan links, verified source, product/API behavior, and the production URL. Keep Circle resource IDs in controlled grant evidence. Never publish secrets or imply evidence that was not observed.
