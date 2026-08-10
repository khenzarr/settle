# Final Narration Script

**Locked runtime:** 04:45 (285 seconds)  
**Voice:** `en-US-AvaNeural` via `@andresaya/edge-tts`; rate `-6%`, pitch `-2Hz`  
**Delivery:** calm, technically confident, conversational US English. Acronyms are spaced in speech-helper text where required.

| Timestamp | Scene | Spoken text |
|---|---|---|
| 00:00–00:18 | S01 | A marketplace adding Pay with U S D C needs more than a wallet button. Settle coordinates payment planning, secure wallet handoff, Arc U S D C funding, escrow, programmable settlement, and canonical reconciliation. |
| 00:18–00:34 | S02 | Here’s the marketplace view. The order total is exactly zero point zero five USDC. Choosing Pay with USDC moves the integration to Settle’s planning surface, without creating an onchain order. |
| 00:34–00:55 | S03 | The marketplace backend sends buyer, amount, deadlines, and a ninety-ten split to POST slash A P I slash V one slash orders slash plan. This is the demo’s only live action. It is non-mutating: no chain write, Circle mutation, or database mutation. |
| 00:55–01:15 | S04 | Settle returns an order ID, terms hash, exact amount, and normalized settlement terms. Execution available is false. This is a Payment Intent and settlement plan, not an onchain order. Controlled activation remains a separate server-side boundary. |
| 01:15–01:36 | S05 | Hosted checkout carries canonical context: zero point zero five U S D C on Arc Testnet, split ninety-ten. The QR contains only the checkout URL. Scanning opens Settle; the wallet authorizes payment. The QR transfers nothing and contains no credentials. |
| 01:36–01:45 | C01 | The monorepo separates web, domain code, server-side Circle integration, contracts, and documentation. |
| 01:45–02:07 | C02 | This is actual Circle S D K code. Clients and validated configuration live server-side in packages slash circle. Developer-Controlled Wallet calls use configured wallet identities. Credentials never enter browser code. Circle Contract Platform code performed the canonical SettlementEscrow deployment. |
| 02:07–02:21 | C03 | Settle validates the funded order and prepares releaseOrder. Settle decides the action. Circle Developer-Controlled Wallets submit the operator transaction; Circle does not decide settlement. |
| 02:21–02:39 | C04A | In SettlementEscrow, fundOrder accepts only the stored buyer before the deadline, then transfers the exact Arc USDC amount. A balance check rejects fee-on-transfer behavior. The contract is the canonical escrow and lifecycle boundary. |
| 02:39–02:57 | C04B | releaseOrder requires a funded order. Stored basis-point terms distribute the full amount deterministically, then close active escrow. Refund and dispute paths preserve explicit marketplace lifecycle semantics. |
| 02:57–03:08 | C05 | Buyer safety gates account, Arc chain, allowance, canonical state, and readiness. Approve and fund remain customer-wallet actions. |
| 03:08–03:16 | C06 | Testing exposed an idle-operation gating edge case, now protected by focused regression coverage. |
| 03:16–03:23 | C07 | Eighty-five web and one hundred sixty-seven Foundry tests pass. Two hundred fifty-two total. |
| 03:23–03:43 | S06 | Back in the product, the immutable order is Completed. The original zero point zero five USDC is no longer active escrow. Its programmed split produced zero point zero four five USDC for the merchant and zero point zero zero five for the platform. |
| 03:43–04:02 | S07 | ArcScan shows the real release against verified SettlementEscrow on Arc Testnet. Transfer logs match both recipients and the full order amount. Settle executed this final release through its server-side Circle-controlled operator path. This is existing read-only evidence. |
| 04:02–04:12 | S08 | The verified contract record confirms its address and Arc context. This demonstration needs no new transaction or wallet interaction. |
| 04:12–04:30 | S09 | Docs cover quickstart, API, checkout, QR lifecycle, settlement, Arc configuration, and boundaries. Current integrations are USDC, Circle Developer-Controlled Wallets, and Circle Contract Platform. Other Circle products are planned. |
| 04:30–04:45 | S10 | Settle connects Payment Intent, Arc U S D C, escrow, programmable settlement, and reconciliation through a controlled Circle server boundary. Payment infrastructure, not just an escrow interface. |

**Final generated narration:** 513 words across 18 isolated scene clips.  
**Timing:** each clip is padded to its assigned scene duration; final narration and video are 285 seconds.