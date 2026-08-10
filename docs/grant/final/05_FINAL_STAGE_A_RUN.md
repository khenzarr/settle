# Settle — Final Grant Demo — Stage A Run Evidence

This record covers one fresh final-demo order-creation run and the subsequent
buyer payment needed to reach canonical `Funded`. Operator settlement is
recorded separately in `06_FINAL_STAGE_B_RUN.md`.

## Run identity

- Run label: `settle-final-grant-demo-20260810-0051-26z`
- External order reference: `settle-final-grant-demo-20260810-0051-26z`
- Order ID: `0xf3b093dc8b2eb3fa595f8d30cf18871fb03eb408e4be5168586c50c788dbcfed`
- Terms hash: `0x286c505202b9eef53880eedbf11b7f074b83162413de7d17f71dca349bb1b359`
- Demo 002 order ID was not used or written: `0x221c314b3d80445868b1aeec7f5ebdbaf50fd48c320245659b689b7a4fca1765`

## Preflight

Preflight: **PASS**. Checks were read-only and passed before the create
mutation: repository checkpoint/clean tree, Arc Testnet chain ID `5042002`,
SettlementEscrow code and canonical address, canonical USDC binding, unpaused
contract, operator role, exact buyer and unique recipients, 10,000 total BPS,
exact `50000` base-unit amount, and fresh order identity with pre-create status
`None`. No wallet was topped up.

- Buyer: `0x0b943fe9f1f8135e0751ba8b43dc0cd688ad209d`
- Merchant: `0xb2f6cfd0960a1fcc532de1bf2aafcc3077b4c396`
- Platform/operator recipient: `0x4ac8d35f1795531f1e0bef3826db5aab730fcd34`
- Amount: `50000` base units = `0.05 USDC`
- SettlementEscrow: `0x3e438ae878a8dc02c83f5545047cbde33a4f795f`
- USDC: `0x3600000000000000000000000000000000000000`

Observed readiness balances before the stop point:

- Buyer USDC: `1042797852` base units (`1042.797852 USDC`); buyer native:
  `1042797852418480882428` base units.
- Operator native: `19874813718168335150` base units.
- Buyer allowance before payment: `0`; this is expected and does not trigger
  any buyer action in Stage A.

## Planned order

- Funding deadline: Unix `1786323086`; **2026-08-10T00:51:26Z**
- Settlement deadline: Unix `1786402286`; **2026-08-10T22:51:26Z**
- Deadline semantics: future guards only; neither deadline triggers automatic
  funding, settlement, refund, or cancellation.
- Recipients and shares: merchant `9000` BPS; platform `1000` BPS.
- Expected payout: merchant `45000` (`0.045 USDC`); platform `5000`
  (`0.005 USDC`).
- Non-mutating preparation/dry-run matched all values above.

## Controlled create result

- Mutation path: existing controlled Circle operator contract-call path.
- Logical create mutations: **exactly one**.
- Circle create status: `COMPLETE`.
- Circle transaction ID: intentionally omitted from this evidence record.
- Arc transaction hash: `0x303060bf140bda8a35efcc5990b21bdfed86980de1b2d67c32b3b9509ba73c0a`
- Arc block: `56183675`
- ArcScan: <https://testnet.arcscan.app/tx/0x303060bf140bda8a35efcc5990b21bdfed86980de1b2d67c32b3b9509ba73c0a>

Circle completion was followed by canonical Arc RPC reads; Circle submission
or receipt alone was not treated as proof.

## Buyer payment result

The exact buyer-side payment was completed in the production hosted checkout.
The approve and fund transaction hashes were not uniquely recovered from the
available historical evidence and are intentionally not guessed or recorded.
This limitation does not weaken the direct canonical contract proof below.

- Production checkout reached: **Funds secured in escrow**.
- Buyer: `0x0b943fe9f1f8135e0751ba8b43dc0cd688ad209d`
- Funded at: Unix `1786319877`
- Active escrow/accounting: `50000` base units (`0.05 USDC`)

## Canonical Funded proof

Direct `SettlementEscrow.getOrder(orderId)` returned:

| Field | Observed value | Required |
|---|---|---|
| status | `Funded` (enum `2`) | `Funded` |
| buyer | `0x0b943fe9f1f8135e0751ba8b43dc0cd688ad209d` | exact buyer |
| totalAmount | `50000` | `50000` |
| fundingDeadline | `1786323086` | planned deadline |
| settlementDeadline | `1786402286` | planned deadline |
| termsHash | `0x286c505202b9eef53880eedbf11b7f074b83162413de7d17f71dca349bb1b359` | generated hash |

Direct `SettlementEscrow.getSettlementSplits(orderId)` returned:

| Recipient | Share | Expected amount |
|---|---:|---:|
| `0xb2f6cfd0960a1fcc532de1bf2aafcc3077b4c396` | `9000` BPS | `45000` |
| `0x4ac8d35f1795531f1e0bef3826db5aab730fcd34` | `1000` BPS | `5000` |

Canonical proof: **PASS — fresh order is Funded**. SettlementEscrow canonical
state is authoritative; missing unique historical approve/fund hashes are
supporting-evidence limitations only and are not release authorization gates.

## Production checkout and handoff

- Checkout URL: <https://settle-web-coral.vercel.app/pay/0xf3b093dc8b2eb3fa595f8d30cf18871fb03eb408e4be5168586c50c788dbcfed>
- Payment Intent state: completed; canonical status `Funded`.
- Payment action: no buyer transaction remains; buyer is exact and amount is
  `0.05 USDC` on Arc Testnet (`5042002`).
- Handoff/QR readiness: **READY**. Production QR payload and deeplink both
  use the exact production checkout URL; no wallet was connected or used.

## Explicit stop-point attestations

- Demo 002: untouched and historical read-only.
- Buyer approve/fund: completed; hashes not uniquely recovered.
- Release: performed once; detailed proof is in `06_FINAL_STAGE_B_RUN.md`.
- Refund, dispute, resolve, and cancel: not performed.
- Stage A evidence ends with canonical `Funded` proof after the manual,
  user-controlled buyer payment.
