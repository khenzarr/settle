# Final deck claim audit

**Audit basis:** final evidence package, strict claim matrix, Stage A/B run records, video requirements map, codebase walkthrough, and the user-supplied deck requirements.

| Claim family | Classification | Safe deck wording / audit result |
|---|---|---|
| API-first programmable USDC settlement infrastructure | PROVEN | Product positioning and implemented planning/read/checkout boundary. |
| Production web product | PROVEN | Public reference product is deployed at the verified URL. |
| Arc deployment | PROVEN WITH QUALIFIER | SettlementEscrow is verified and proven on Arc Testnet, chain 5042002. Never “Arc mainnet live”. |
| Buyer funding | PROVEN WITH QUALIFIER | Buyer wallet authorizes Arc Testnet USDC funding; escrow custody begins on fund. |
| Programmable split | PROVEN | Stored recipient arrays and 10,000-BPS terms deterministically produce 90/10 in final evidence. |
| Circle USDC | PROVEN WITH QUALIFIER | Current Circle product shown as the settlement asset/integration context. |
| Circle Developer-Controlled Wallets | PROVEN WITH QUALIFIER | Controlled operator contract execution; does not sign buyer transactions or choose policy. |
| Circle Contract Platform | PROVEN WITH QUALIFIER | Deployment infrastructure shown as documented integration path. |
| “CCTP is currently integrated” | DO NOT CLAIM | CCTP is not currently implemented and must remain outside current-integration lists. |
| “Settle plans CCTP-powered cross-chain Pay with USDC” | PLANNED | Approved roadmap direction; visibly marked planned on slides 6, 9, and 10. |
| “Customers can currently pay from any chain” | DO NOT CLAIM | Current buyer funding is Arc-native. Never use “any network” for the planned direction. |
| “Planned: customers pay native USDC from CCTP-supported source networks while Arc remains the canonical settlement destination” | PLANNED | Preferred strategic thesis and route boundary. Named source networks are illustrative planned test routes, not permanent or universal support claims. |
| Arc Testnet currently supports Settle's proven settlement | PROVEN WITH EXISTING QUALIFIER | Current proof remains Arc Testnet only, chain 5042002; never imply Arc mainnet deployment. |
| Gateway, Paymaster, StableFX, Mint, Agent Stack, EURC, USYC, cirBTC | DO NOT CLAIM | Not shown as current or planned Circle products in the revised deck. |
| Arc App Kit / Bridge Kit and Circle Forwarding Service | PLANNED IMPLEMENTATION DETAIL | May appear only in roadmap source/notes as “where appropriate”; they are not added to current or planned Circle-product application answers. |
| Marketplace integration | PROVEN WITH QUALIFIER | Current planning, canonical-read, Payment Intent and handoff APIs plus hosted reference flow. No existing merchant integration. |
| Authenticated creation, API keys, webhooks, dashboard, SDK/plugins | PLANNED | Roadmap only. |
| QR | PROVEN WITH QUALIFIER | QR encodes the canonical hosted checkout URL; it does not transfer USDC or fund escrow. |
| Public API mutation | PROVEN WITH QUALIFIER | Planning POST is non-mutating; no public server-side execution endpoint is claimed. |
| Automatic settlement | DO NOT CLAIM | Controlled operator action drives release; deadlines are guards only. |
| Refund/dispute | PROVEN WITH QUALIFIER | Contract lifecycle supports explicit arbitrator-selected release/refund; no automatic policy or live case. |
| Completed final order | PROVEN WITH QUALIFIER | Fresh final order completed on Arc Testnet with 0.05 USDC and active escrow 0. |
| Test count | PROVEN | 85 web + 167 Foundry = 252, as supplied by final evidence/video records. |
| Commercial traction | DO NOT CLAIM | No revenue, volume, MAU, TVL, merchant adoption or production transaction metrics. |
| Arc mainnet readiness/usage | PLANNED | Roadmap outcome only; no mainnet deployment claimed. |
| Founder credentials | PROVEN WITH QUALIFIER | Deck uses only “Founder / Product & Engineering”; detailed bio remains application-owned. |
| Grant outcomes | PLANNED | Merchant-ready integration, authenticated API, pilot usage and operations are requested outcomes, not current proof. |

## Explicit red-flag checks

- **Production vs testnet:** every onchain proof is labeled Arc Testnet; production refers to the web reference surface.
- **Public API vs controlled operator:** planning/read endpoints are separated from the controlled Circle operator path.
- **QR semantics:** described as hosted-checkout handoff only.
- **Circle products:** current: USDC, Developer-Controlled Wallets, Contract Platform. Planned: CCTP only.
- **CCTP boundary:** every visible CCTP treatment is marked planned; no current cross-chain capability is claimed.
- **Network scope:** planned wording is “CCTP-supported networks,” never “any network.”
- **Merchant claims:** no live third-party merchant integration is stated.
- **Traction:** only technical/product proof and test counts are stated.
- **Automatic behavior:** no automatic settlement/refund/dispute claim.
- **Secrets/redaction:** no API keys, Entity Secret, recovery material, private keys, idempotency values, or internal Circle resource IDs appear in visible deck copy.