# Settle — Final Demo Video Shotlist

**Target duration:** approximately **3:20–3:45** (acceptable range 2.5–4 minutes). Prioritize evaluator comprehension. Use one fresh order; Demo 002 may appear only as a brief read-only fallback/reference.

| # | Screen | Action | Narration purpose | Evidence shown | Est. | Wallet / Explorer / API visible | Sensitive-data precautions |
|---:|---|---|---|---|---:|---|---|
| 1 | Title + generic marketplace checkout | Show a fictional order and **Pay with USDC** option, then open `settle-web-coral.vercel.app` | Say: “Add Pay with USDC to a marketplace through Settle.” Define the product before contract internals appear | Marketplace integration story and public reference deployment | 20s | None | Do not name or imply integration with a real company; hide browser profile, bookmarks, notifications |
| 2 | Settle product flow | Trace marketplace checkout → API / Payment Intent → hosted checkout → wallet funding → escrow → settlement → finality | Establish Settle as API-first payment and settlement infrastructure, not merely an escrow/QR app | Reference product surface | 18s | None | Do not imply animation is canonical evidence or future merchant tooling is live |
| 3 | Sanitized API client/terminal | Show `POST /api/v1/orders/plan` request and response | Demonstrate API-first planning and exact integration boundary | Buyer, amount, deadlines, termsHash, 90/10, orderId, `executionAvailable=false` | 25s | API | No headers, cookies, RPC URL, IDs, env, history; request body only |
| 4 | Brief sanitized controlled CLI + ArcScan | Execute reviewed create once, then move promptly to receipt | Separate planning from controlled operator creation and finality without dwelling on CLI output | Circle-controlled create, Arc tx, canonical `Created` | 18s | Explorer; controlled terminal | Crop all Circle IDs/idempotency/credentials; publication-safe output only |
| 5 | Production hosted checkout desktop | Open fresh `/pay/<orderId>` | Show canonical checkout as reference surface | `Created`, 0.05 USDC, correct buyer/network/split | 20s | None | Verify fresh orderId; never use Demo 002 for writes |
| 6 | API response + QR + phone | Show handoff equality, scan QR, and open the same hosted checkout | Explain that the QR encodes the checkout URL; the wallet—not the QR—later authorizes Arc USDC funding | `checkout.url == qr.payload == deeplink.url`; production origin | 25s | API and phone | Phone notification/privacy mode; QR contains only URL and performs no blockchain transaction |
| 7 | Buyer wallet + checkout | Connect exact buyer and verify Arc Testnet | Establish customer signing/custody boundary | Correct EIP-1193 address and chain | 18s | Wallet | Hide balances if unnecessary; no seed/private data |
| 8 | Buyer wallet | Show allowance; exact approve only if required | Prove precise approval, not unlimited authorization | Canonical spender, `50000` base units, successful receipt | 25s | Wallet, optionally explorer | Expand only target/amount/network; hide unrelated assets/accounts |
| 9 | Buyer wallet + checkout | Submit `fundOrder` once and wait for canonical refresh | Prove buyer-funded escrow | Fund tx, `Funded`, escrow active/50000 | 35s | Wallet and optionally explorer | Verify selector/target/orderId before confirm; no retry on ambiguity |
| 10 | Canonical API/checkout | Hold on Funded state | Make custody/state clear before operator action | Canonical Funded, buyer actions unavailable, escrow held | 16s | API optional | If evidence panel is limited, state it is optional and use direct reads |
| 11 | Brief sanitized operator CLI | Show reviewed release summary and execute once | Demonstrate the existing controlled Circle-backed operator path without implying autonomous execution | Exact fresh order, `Funded`, release submission | 18s | Controlled terminal | Crop Circle IDs, idempotency, env, command history, RPC URLs; show only what proves the controlled action |
| 12 | Production checkout/API | Refresh to Completed | Demonstrate canonical finality | `Completed`, no buyer action, escrow inactive | 18s | API optional | Do not claim Circle submission alone was finality |
| 13 | ArcScan release tx/logs | Show release receipt and transfer/event rows | Prove deterministic gross payout split | Merchant `45000`, platform `5000`, total `50000`; contract address/chain | 32s | Explorer | Use public hashes/addresses only; explain fee-affected net wallet delta |
| 14 | Marketplace architecture/end card | Return to marketplace checkout → Settle → buyer wallet → escrow → recipients | Say: “Settle turns Arc USDC payment into programmable marketplace settlement.” Reinforce that the marketplace did not have to build the settlement system itself | API-first boundary; buyer wallet signing; Circle-controlled operator; contract custody; Arc finality | 24s | None | State “Arc Testnet”; no live-merchant, mainnet, or automation claims |

**Estimated total:** ~321 seconds if every maximum beat is used; edit pauses and wallet confirmation latency to **200–225 seconds**. Transaction mining waits should be jump-cut only after showing that finality is being awaited; never fake an instant state transition.

## Narration anchors

- “Add Pay with USDC to a marketplace through Settle.”
- “The API plans the Payment Intent; controlled operator execution creates the canonical order.”
- “The QR encodes and opens this canonical hosted-checkout URL. The customer wallet authorizes payment; the QR itself performs no blockchain transaction.”
- “The buyer wallet signs approval and funding. Settle does not sign for the customer.”
- “USDC is now held by SettlementEscrow on Arc Testnet.”
- “The controlled Circle wallet submits the operator release; Arc receipt and canonical state—not submission alone—establish finality.”
- “The contract pays the frozen 90/10 split deterministically.”
- “Settle turns Arc USDC payment into programmable marketplace settlement.”

## Recording fallback and evidence degradation

If the production lifecycle panel shows **Evidence limited**, leave it visible briefly and say: “Optional lifecycle evidence is currently degraded; canonical order state remains authoritative.” Then use the direct API read and ArcScan transaction/log evidence. Do not reopen a fix phase during recording.

If a transaction outcome is ambiguous, stop recording the execution narrative. Do not retry. Reconcile Circle status, Arc receipt, nonce, and canonical state off-camera, then decide whether the same recording can truthfully continue.

## Never show or say

Never show API key, Entity Secret, recovery file, private key, `.env`, idempotency key, credential-bearing RPC URL, wallet ID, wallet set ID, private dashboard, or shell history. Never claim mainnet readiness, automatic deadline settlement/refunds, existing merchants, a public server-side execution endpoint, direct QR transfer, or any write against Demo 002.
