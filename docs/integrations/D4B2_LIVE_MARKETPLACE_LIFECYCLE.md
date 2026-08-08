# D4B2 Controlled Live Marketplace Lifecycle Proof

## Completion scope

This document records the already-completed controlled Arc Testnet demonstration for
`settle-d4b-demo-002`. It is evidence only. No transaction, Circle mutation, retry,
idempotency key, credential, entity-secret material, or recovery record is included
here.

The proof covers one complete marketplace order lifecycle:

```text
None -> Created -> Funded -> Completed
```

The evidence is based on public Arc transaction receipts/state reads and the supplied
Circle operation records. Submission acceptance was never treated as finality: Circle
submission records were followed by transaction receipt and canonical contract/token
state confirmation.

## Canonical deployment and participants

| Field | Value |
| --- | --- |
| Run ID | `settle-d4b-demo-002` |
| Network | Arc Testnet |
| Chain ID | `5042002` |
| SettlementEscrow | `0x3e438ae878a8dc02c83f5545047cbde33a4f795f` |
| Canonical USDC | `0x3600000000000000000000000000000000000000` |
| Order ID | `0x221c314b3d80445868b1aeec7f5ebdbaf50fd48c320245659b689b7a4fca1765` |
| Buyer | `0x0b943fe9f1f8135e0751ba8b43dc0cd688ad209d` |
| Merchant | `0xb2f6cfd0960a1fcc532de1bf2aafcc3077b4c396` |
| Platform/operator | `0x4ac8d35f1795531f1e0bef3826db5aab730fcd34` |

## Amount and split

The order amount was `50000` USDC base units, equal to `0.05 USDC` at six
decimals. The stored split was `9000/1000` BPS:

| Recipient | Split | Exact payout |
| --- | ---: | ---: |
| Merchant | 9000 BPS | `45000` base units = `0.045 USDC` |
| Platform | 1000 BPS | `5000` base units = `0.005 USDC` |

## Lifecycle evidence

| Step | Execution and public evidence | Observed result |
| --- | --- | --- |
| Create order | Circle transaction ID `b66f37ec-50da-54b6-9b95-83581c4de2c4`; Arc tx [`0x5ab9615fd45fa19db101d5621fa5ed7ae2f591f3f401d7d37fbd4213009fecaa`](https://testnet.arcscan.app/tx/0x5ab9615fd45fa19db101d5621fa5ed7ae2f591f3f401d7d37fbd4213009fecaa), block `55852736` | `None -> Created`; `orderExists=true`; stored split `9000/1000`; `totalActiveEscrow=0` |
| Buyer approve | Browser EIP-1193 transaction: [`0x0d66ac2b22e9586b2e190664bc2983b9c64d98c6e90ecf9f1d565b50baf76f30`](https://testnet.arcscan.app/tx/0x0d66ac2b22e9586b2e190664bc2983b9c64d98c6e90ecf9f1d565b50baf76f30) | Exact approval of `50000` base units to SettlementEscrow; receipt/state confirmation passed; allowance became `50000`; order remained `Created`; `fundReady=true` |
| Buyer fund order | Browser EIP-1193 transaction: [`0x814ebaa59e002c2599fb963bfedc0b1a9e41074da14e1a91509d0c6683047781`](https://testnet.arcscan.app/tx/0x814ebaa59e002c2599fb963bfedc0b1a9e41074da14e1a91509d0c6683047781), block `55854442` | `Created -> Funded`; canonical state confirmation passed; `totalActiveEscrow=50000`; escrow USDC custody `50000`; buyer allowance consumed to `0` |
| Operator release order | Circle transaction ID `23076b60-0e04-5ce1-aad4-ff3c6633dc01`; Arc tx [`0x93a7eadb3a118460b25f0169822aa244cb860a24a6e6e0398646f1c36717c2e7`](https://testnet.arcscan.app/tx/0x93a7eadb3a118460b25f0169822aa244cb860a24a6e6e0398646f1c36717c2e7), block `55856911` | `Funded -> Completed`; `status=4`; `settledAt=1786147831`; `totalActiveEscrow=0`; escrow USDC custody `0` |

The release reported a Circle network fee of `0.00366719090867985`.

## Payout and accounting proof

The canonical ERC-20 `Transfer` events emitted by `SettlementEscrow` prove the gross
payouts exactly:

- Merchant transfer: `45000` USDC base units (`0.045 USDC`).
- Platform transfer: `5000` USDC base units (`0.005 USDC`).

The frozen pre-release and post-release balance observations were:

| Address | Pre-release | Post-release | Observed delta |
| --- | ---: | ---: | ---: |
| Merchant | `14958571` | `15003571` | `+45000` |
| Platform/operator | `19881376` | `19882709` | NET `+1333` |

The platform address is also the Circle operator. Arc network gas for `releaseOrder`
is paid from the same underlying USDC balance representation. Consequently, the
platform wallet NET delta (`+1333`) is fee-affected and must not be used as the gross
payout proof. The exact gross platform payout is the canonical ERC-20 `Transfer`
event for `5000` base units; the merchant balance delta independently matches its
exact `45000`-unit transfer.

The buyer funded escrow through the contract lifecycle. No direct USDC transfer was
used to fund escrow.

## Trust-boundary and operational notes

- Buyer `approve` and `fundOrder` used browser EIP-1193 wallet execution.
- Circle credentials remained server-only.
- `createOrder` and `releaseOrder` used Circle Developer-Controlled Wallet contract
  execution.
- The payout transfers were executed by `SettlementEscrow` itself, not by Circle
  wallet transfer operations.
- No automatic retry occurred for live writes. A submitted operation was not treated
  as final until the corresponding finality/state evidence was confirmed.
- Recovery records remained outside the repository; none are reproduced here.
- `settlementDeadline` is not an automatic timeout or refund mechanism. It does not
  by itself transition an order or release/refund funds.

## D4B2 completion statement

The controlled live marketplace lifecycle proof for `settle-d4b-demo-002` is complete:
the order was created with the recorded split, approved by the buyer, funded into
`SettlementEscrow`, and released to `Completed` with zero active escrow and exact
merchant/platform payout transfers proven by canonical ERC-20 events.