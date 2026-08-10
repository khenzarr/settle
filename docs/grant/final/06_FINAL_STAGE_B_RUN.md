# Settle — Final Grant Demo — Stage B Run Evidence

This record covers the controlled release of the exact fresh final-demo order
after direct canonical SettlementEscrow authorization. It records one logical
release only. Demo 002 was not written.

## Order identity and authorization

- Order ID: `0xf3b093dc8b2eb3fa595f8d30cf18871fb03eb408e4be5168586c50c788dbcfed`
- Terms hash: `0x286c505202b9eef53880eedbf11b7f074b83162413de7d17f71dca349bb1b359`
- Buyer: `0x0b943fe9f1f8135e0751ba8b43dc0cd688ad209d`
- Merchant: `0xb2f6cfd0960a1fcc532de1bf2aafcc3077b4c396`
- Platform/operator: `0x4ac8d35f1795531f1e0bef3826db5aab730fcd34`
- SettlementEscrow: `0x3e438ae878a8dc02c83f5545047cbde33a4f795f`
- USDC: `0x3600000000000000000000000000000000000000`
- Network: Arc Testnet, chain ID `5042002`
- Amount: `50000` base units (`0.05 USDC`)
- Splits: merchant `9000` BPS / `45000`; platform `1000` BPS / `5000`

Before mutation, direct reads of the exact order returned `Funded` (enum
`2`), the exact buyer, amount, terms hash, and split arrays. `fundedAt` was
`1786319877`. `totalActiveEscrow` and escrow USDC custody were both `50000`.
The contract was unpaused, the operator held the required role, and the
operator had sufficient native balance.

The historical approve and fund transaction hashes were not uniquely
recovered. They were not guessed, and no replacement transaction was sent.
Canonical funded state—not optional historical indexing evidence—authorized
the release.

## Pre-release snapshot

All values are USDC base units with 6 decimals:

| Account | Balance before release |
|---|---:|
| Merchant | `15003571` (`15.003571 USDC`) |
| Platform/operator | `19874813` (`19.874813 USDC`) |
| SettlementEscrow | `50000` (`0.05 USDC`) |

- Active escrow/accounting before release: `50000`.

## Controlled Circle release

The existing controlled Circle operator contract-execution path was used.
The dry-run matched exactly:

```text
releaseOrder(
  0xf3b093dc8b2eb3fa595f8d30cf18871fb03eb408e4be5168586c50c788dbcfed
)
```

Target contract was exactly the SettlementEscrow address above. Circle
submission returned `COMPLETE`; the logical release mutation count was
**exactly one**. No refund, dispute, resolve, cancel, create, or fund
mutation was submitted. Secrets and the idempotency key are not recorded.

## Exact release receipt and settlement logs

- Release transaction: `0x168edb8bdcf44c1df583648d96d684764a923907ae4f1d7c90516864179463ef`
- Release block: `56193979`
- Receipt status: `1` (success)
- ArcScan: <https://testnet.arcscan.app/tx/0x168edb8bdcf44c1df583648d96d684764a923907ae4f1d7c90516864179463ef>

The exact USDC `Transfer` logs in this receipt prove deterministic attribution:

| Token | From | To | Amount |
|---|---|---|---:|
| USDC | SettlementEscrow | `0xb2f6cfd0960a1fcc532de1bf2aafcc3077b4c396` | `45000` (`0.045 USDC`) |
| USDC | SettlementEscrow | `0x4ac8d35f1795531f1e0bef3826db5aab730fcd34` | `5000` (`0.005 USDC`) |

## Canonical post-release proof

Direct reads returned order status `Completed` (enum `4`), `settledAt`
`1786321542`, `totalActiveEscrow=0`, and SettlementEscrow USDC balance `0`.
The contract custody was fully cleared and no buyer payment action remained.

Supporting post-release balances were merchant `15048571` and platform
`19876892` base units. Exact receipt logs above are the primary payout proof;
balance deltas are supporting evidence and may include unrelated activity.

## Production and evidence links

- Checkout: <https://settle-web-coral.vercel.app/pay/0xf3b093dc8b2eb3fa595f8d30cf18871fb03eb408e4be5168586c50c788dbcfed>
- Production result: canonical status `Completed`; `0.05 USDC`; “Settlement
  completed”; no buyer transaction available; `90% / 10%`; `0.045 / 0.005
  USDC`; Arc Testnet.
- Evidence-limited qualifier remains visible and is non-blocking.
- SettlementEscrow contract: <https://testnet.arcscan.app/address/0x3e438ae878a8dc02c83f5545047cbde33a4f795f>
- Stage A create transaction: <https://testnet.arcscan.app/tx/0x303060bf140bda8a35efcc5990b21bdfed86980de1b2d67c32b3b9509ba73c0a>
- Approve transaction: not proven; link omitted.
- Fund transaction: not proven; link omitted.

## Attestations

- Demo 002 (`0x221c314b3d80445868b1aeec7f5ebdbaf50fd48c320245659b689b7a4fca1765`): untouched.
- Exactly one logical release mutation was performed.
- Application code, contracts, dependencies, and configuration were not changed.
- Remaining evidence limitation: approve/fund historical hashes were not
  uniquely recovered; this does not affect canonical release or receipt proof.