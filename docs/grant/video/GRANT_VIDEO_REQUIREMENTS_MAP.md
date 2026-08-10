# Grant Video Requirements Map

This is the mandatory pre-render QA gate. Every row must remain true after D4D2B capture and before upload.

| Grant requirement | Video chapter | Timestamp | Evidence shown | Current / planned | Claim qualifier |
|---|---|---:|---|---|---|
| Codebase Walkthrough required | Actual implementation | 01:36–02:53 | Exact HEAD source with paths, line numbers, symbols | Current | Mandatory section; 77 seconds actual code |
| Actual Circle implementation code | Circle server boundary | 01:45–02:21 | Circle SDK client/config, wallet execution, Contract Platform deployment/integrity | Current | Only capabilities evidenced by repository source |
| Circle architecture explanation | Circle server boundary | 01:45–02:21 | `packages/circle` isolation and controlled execution path | Current | Secrets/custody never enter browser; Circle executes, Settle decides |
| Current USDC usage | Checkout + contract + final evidence | 00:18–00:34, 01:15–01:36, 02:21–02:57, 03:23–04:02 | 0.05 USDC UI, exact `safeTransferFrom`, payouts/logs | Current | Arc Testnet USDC at public configured address |
| Circle Developer-Controlled Wallets | Circle code + release evidence | 01:45–02:21, 03:43–04:02 | actual wallet client/execution source and immutable release tx | Current | Server-side operator boundary; no autonomous policy decision |
| Circle Contract Platform | Circle code + contract evidence | 01:45–02:07, 04:02–04:12 | deployment/integrity source and verified deployed contract | Current | Deployment infrastructure only as repository evidence supports |
| Integration Demonstration required | Marketplace plan | 00:18–01:15 | real production flow and one real `POST /api/v1/orders/plan` | Current | Planning is non-mutating and creates no onchain order |
| User flow powered by Circle infrastructure | Checkout to controlled release | 01:15–01:36, 03:23–04:02 | wallet handoff, completed order, ArcScan transaction and transfers | Current | Buyer wallet authorizes funding; controlled operator release uses Circle path |
| QR truth boundary | Hosted checkout | 01:15–01:36 | QR beside canonical hosted URL | Current | QR opens Settle only; no transfer, transaction, credentials, or funding |
| Programmable settlement | Contract + immutable evidence | 02:39–02:57, 03:23–04:02 | BPS code and 90/10 payouts | Current | Stored terms determine deterministic distribution |
| Refund/dispute lifecycle | Contract walkthrough | 02:39–02:57 | adjacent explicit contract paths | Current | Mentioned briefly; not demonstrated with mutation |
| Developer integration readiness | Developer docs | 04:12–04:30 | Quickstart, API reference, checkout, lifecycle, settlement, Arc config, boundaries | Current | Public grant release boundaries stated honestly |
| Planned integrations if discussed | Docs boundary | 04:12–04:30 | No unsupported product shown as current | Planned / not claimed | CCTP, Gateway, Paymaster, StableFX, Mint, App Kits, Agent Stack, EURC, USYC, cirBTC are not claimed |
| No external mutation | Entire video | 00:00–04:45 | read-only pages and immutable evidence | Current | Only allowed POST is non-mutating planning endpoint |
| Security / no secrets | Code, browser, terminal | 01:36–04:30 | exact-source crops, clean browser, sanitized test card | Current | No API key, Entity Secret, `.env`, private key, recovery data, idempotency value, profile data |
| Less than five minutes | Final compliance | 00:00–04:45 | FFprobe report from render script | Current plan | Locked 285s; hard script gate `<295s`, form gate `<300s` |

**QA status for D4D2A:** mapped.  
**D4D2B approval condition:** all rows visually rechecked against final encoded MP4 and `ffprobe`; any mismatch blocks upload.
