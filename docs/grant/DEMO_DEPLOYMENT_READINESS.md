# Settle Demo Deployment Readiness

## Purpose

This document records the D4D0 deployment and operational checks for the
Circle grant demo. It covers whether the current frozen product can run from
a public HTTPS Next.js deployment. It does not add product capability.

## Feature-freeze boundary

The current product remains the verified SettlementEscrow on Arc Testnet,
Circle Developer-Controlled Wallet integration, real Circle transaction
proofs, marketplace planning/read boundaries, Payment Intent and hosted
checkout, buyer wallet approval/funding, confirmation/recovery, onchain
evidence, and QR/external payment handoff.

D4D0 does not add a database, authentication, webhook delivery, live order
creation, operator execution, new Circle mutation path, new payment method,
new contract, contract upgrade, indexer, or mainnet deployment.

## Current architecture

The deployable application is `apps/web`, a Next.js application in the pnpm
workspace. Public web server code reads the canonical Arc Testnet state through
the shared read-only RPC transport. Circle mutation code is isolated in
`packages/circle` and its CLI scripts. The public web follows Path B: buyer
browser wallet actions are possible, but the web deployment does not execute
Circle wallet mutations.

No Vercel configuration is committed. A Vercel deployment is therefore a
standard Next.js deployment choice, not a repository-proven deployment.

## Deployment requirements

For a standard Next-compatible platform:

- Repository root: the repository root, so pnpm can resolve workspace packages.
- Install command: `pnpm install --frozen-lockfile`.
- Build command: `pnpm --filter @settle/web build`.
- Application package: `apps/web`.
- Node: use Node 22 or newer, matching the Circle package runtime and current
  workspace toolchain.
- Start command, where required by the platform: `pnpm --filter @settle/web
  start` after the Next build. The package currently defines no custom `start`
  script; a platform with native Next output handling should use its standard
  Next runtime behavior.

The repository has no committed `next.config.*`, `vercel.json`, middleware, or
platform adapter. Deployment success must be proven by the platform’s own
build and runtime checks; this repository does not claim that a platform
deployment has already succeeded.

## Environment inventory

Only names and behavior are recorded here. Values must be supplied through the
deployment secret/configuration manager.

### Public or non-secret configuration

| Name | Build | Runtime | Used by | Classification and absence behavior |
| --- | --- | --- | --- | --- |
| `SETTLE_PUBLIC_APP_ORIGIN` | No | Handoff/QR | Payment handoff and hosted checkout links | Non-secret absolute origin. Missing or invalid disables QR/handoff only; core canonical reads remain available. Production requires HTTPS. |
| `NEXT_PUBLIC_ARC_TESTNET_RPC_URL` | No | RPC reads | Shared RPC parser as the second-priority override | Public/non-secret only when the endpoint itself is public and credential-free. Empty means absent. Prefer the server-only override below. Invalid HTTP(S) configuration fails RPC setup. |
| `NEXT_PUBLIC_SETTLEMENT_CONTRACT_ADDRESS` | No | None in current web read path | Shared parser/export surface | Optional non-secret compatibility configuration. Current Arc Testnet reads use the canonical chain address unless a consumer explicitly uses this parser. |

### Server configuration

| Name | Build | Runtime | Used by | Classification and absence behavior |
| --- | --- | --- | --- | --- |
| `ARC_TESTNET_RPC_URL` | No | RPC reads | Web read services and Circle/integrity tooling | Server configuration. Takes precedence over the public RPC override. Missing uses the canonical fallback `https://rpc.testnet.arc.network`. Never include a credential-bearing value in responses or readiness output. |
| `SETTLEMENT_CONTRACT_ADDRESS` | No | Circle/integrity scripts | Circle and Foundry verification/deployment tooling | Non-public server/operator configuration, not needed by the public Path B web routes. Missing blocks those tooling commands only. |
| `SETTLE_ADMIN_ADDRESS` | No | Circle/Foundry tooling | Deployment and integrity checks | Server/operator configuration. Not required by public web. |
| `SETTLE_OPERATOR_ADDRESS` | No | Operator dry-run route and Circle tooling | `/api/operator/order/action/plan` and operator checks | Server/operator configuration. Missing makes the operator planning route unavailable; it does not block public buyer checkout. |
| `SETTLE_ARBITRATOR_ADDRESS` | No | Circle/Foundry tooling | Deployment and integrity checks | Server/operator configuration. Not required by public web. |
| `SETTLE_PAUSER_ADDRESS` | No | Circle/Foundry tooling | Deployment and integrity checks | Server/operator configuration. Not required by public web. |
| `CIRCLE_DEPLOYER_ADDRESS` | No | Operator dry-run/Circle tooling | Operator planning and Circle tooling | Server/operator configuration. Not required by public buyer web under Path B. |

### Secrets and CLI-only credentials

| Name | Build | Runtime | Used by | Classification and absence behavior |
| --- | --- | --- | --- | --- |
| `CIRCLE_API_KEY` | No | Circle CLI/server mutations | `packages/circle` client creation | Secret. Not required by public web routes. Missing blocks Circle API operations only. |
| `CIRCLE_ENTITY_SECRET` | No | Circle CLI/server mutations | `packages/circle` client creation | Secret. Not required by public web routes. Missing blocks Circle API operations only. |
| `CIRCLE_WALLET_SET_ID` | No | Circle wallet operations | Wallet planning/creation references | Internal configuration. Not required by public web. |
| `CIRCLE_DEPLOYER_WALLET_ID` | No | Circle wallet operations | Circle wallet reads/mutations | Internal identifier. Keep out of public configuration and responses. Not required by public web. |
| `CIRCLE_SETTLEMENT_CONTRACT_ID` | No | Circle deployment status | Contract deployment status tooling | Internal deployment reference. Not required by public web. |
| `CIRCLE_DEPLOYMENT_TRANSACTION_ID` | No | Circle deployment status | Contract deployment status tooling | Internal deployment reference. Not required by public web. |
| `DEPLOYER_PRIVATE_KEY` | No | Foundry deployment only | Contract deployment script | Secret. Never configure in the public web deployment. Not used by Path B. |

The repository `.env.example` contains blank entries for these actual source
names. Blank Circle and deployment entries are intentional for a public web
deployment. Do not add `NEXT_PUBLIC_CIRCLE_API_KEY` or
`NEXT_PUBLIC_CIRCLE_ENTITY_SECRET`; the Circle package explicitly treats
public Circle credentials as forbidden.

## What the public web actually requires

The public web does not import Circle client or mutation code for the current
marketplace, Payment Intent, handoff, hosted checkout, or buyer browser-wallet
flows. It needs no Circle API key, Entity Secret, wallet ID, recovery file, or
private key.

For core public read and checkout behavior, the only RPC requirement is a
working Arc Testnet endpoint, supplied by `ARC_TESTNET_RPC_URL` or the
credential-free `NEXT_PUBLIC_ARC_TESTNET_RPC_URL`, or the canonical fallback.
`SETTLE_PUBLIC_APP_ORIGIN` is additionally required for absolute hosted
checkout/handoff/QR links in production.

## Public origin policy

`SETTLE_PUBLIC_APP_ORIGIN` is parsed directly from configuration. Request
`Host`, `Forwarded`, and `X-Forwarded-Host` values are not used as fallbacks.
The parser requires a root origin with no credentials, path, query, or
fragment. Production requires `https:`. Local development may use the current
configured development port as `http://localhost:<port>`; the port is not
assumed by this document.

The final deployment must set the exact deployed origin, conceptually:

```text
SETTLE_PUBLIC_APP_ORIGIN=https://<actual-settle-domain>
```

Do not leave a placeholder configured for the live demo.

## RPC architecture and product surfaces

`ARC_TESTNET_RPC_URL` has precedence, then
`NEXT_PUBLIC_ARC_TESTNET_RPC_URL`, then the canonical Arc Testnet fallback.
The URL is used internally by the server transport and is never part of a
publication-safe response.

RPC-dependent surfaces are:

- canonical marketplace order reads and `/api/v1/orders/[orderId]`;
- marketplace plan/read boundary and `/api/v1/orders/plan`;
- Payment Intent reads and `/api/v1/payment-intents/[orderId]`;
- hosted checkout `/pay/[orderId]`;
- handoff `/api/v1/payment-intents/[orderId]/handoff`;
- buyer allowance reads and transaction confirmation/receipt reads;
- optional lifecycle evidence and `/api/buyer/order/evidence`;
- operator dry-run planning;
- Circle and deployment integrity tooling.

Evidence uses `eth_getLogs`, which is optional for core checkout. A provider
can therefore leave canonical checkout healthy while evidence is degraded.

## Readiness probe

Run locally or in a controlled CI/operator environment:

```text
pnpm demo:readiness
```

The command is bounded, deterministic, safe to rerun, and read-only. It uses
only these RPC methods:

1. `eth_chainId`
2. `eth_getCode`
3. `eth_call` through the canonical order reader for demo-002
4. `eth_blockNumber`
5. one bounded `eth_getLogs` query for demo-002 lifecycle evidence

The diagnostic does not use `eth_sendTransaction` or
`eth_sendRawTransaction`, does not sign, and does not call Circle. It prints
only chain ID, configured/fallback source, and PASS/DEGRADED/BLOCKER results;
it never prints the RPC URL or environment values. It exits nonzero only for a
core blocker, so optional evidence or QR configuration degradation is visible
without masking core readiness.

### Immutable demo reference

The diagnostic reads, but never mutates, this completed historical order:

```text
0x221c314b3d80445868b1aeec7f5ebdbaf50fd48c320245659b689b7a4fca1765
```

Expected canonical status: `Completed`. The bounded evidence window is
isolated in `apps/web/lib/demo-readiness.ts`; it is not product runtime state.

## Readiness classification

| Condition | Classification |
| --- | --- |
| Wrong chain | BLOCKER for core payment reads |
| Missing SettlementEscrow runtime code | BLOCKER for core payment reads |
| Canonical demo-002 read unavailable or not Completed | BLOCKER for core payment reads |
| Latest block unavailable | DEGRADED lifecycle evidence |
| One bounded evidence log query unavailable | DEGRADED lifecycle evidence; checkout remains available |
| Missing/invalid production public origin | DEGRADED QR/handoff only |
| Circle mutation credentials unavailable | Not a public web blocker under Path B |

## Hosted checkout, QR, and APIs

Hosted checkout requires a reachable public Next runtime, the canonical RPC
read path, and a valid `SETTLE_PUBLIC_APP_ORIGIN` for absolute links. QR and
external handoff payloads are exactly the configured origin plus
`/pay/<orderId>`; they do not encode a USDC transfer, calldata, contract target,
or recipient. Public HTTPS is required so an external scan reaches the actual
deployment.

Marketplace plan/read, Payment Intent read, and handoff APIs are public-read
boundaries backed by canonical onchain reads. They do not require Circle
credentials. Evidence may be partial/degraded without making the checkout
path unavailable.

The current public route inventory includes:

- `/api/v1/orders/plan`
- `/api/v1/orders/[orderId]`
- `/api/v1/payment-intents/[orderId]`
- `/api/v1/payment-intents/[orderId]/handoff`
- `/pay/[orderId]`

Additional existing buyer and operator planning routes remain unchanged. No
execute route is introduced by D4D0.

## Controlled smoke test

Use a non-secret local environment and a configured origin. Run the readiness
command, then request the demo Payment Intent and handoff through the local
web server. Confirm that the absolute URL is exactly:

```text
<configured-origin>/pay/0x221c314b3d80445868b1aeec7f5ebdbaf50fd48c320245659b689b7a4fca1765
```

Confirm the QR payload, displayed host, and order ID match, and that the
payload contains no transfer syntax or calldata. Do not supply arbitrary Host
headers and do not submit any transaction. A public deployment smoke test
must remain read-only and must not create a new order or alter demo-002.

## Pre-demo checklist

- [ ] Deploy from the repository root with the frozen lockfile.
- [ ] Confirm the production build succeeds on the chosen platform.
- [ ] Set the exact deployed HTTPS `SETTLE_PUBLIC_APP_ORIGIN`.
- [ ] Set a reliable `ARC_TESTNET_RPC_URL` override if the canonical fallback
      is not suitable; keep any credential-bearing URL server-side.
- [ ] Run `pnpm demo:readiness` once and retain its publication-safe output.
- [ ] Confirm chain ID 5042002 and SettlementEscrow code are present.
- [ ] Confirm demo-002 canonical status is `Completed`.
- [ ] Confirm whether lifecycle evidence is PASS or accepted as DEGRADED.
- [ ] Open the hosted checkout and verify the QR/handoff URL from the public
      HTTPS origin.
- [ ] Verify buyer wallet network and balances before recording.
- [ ] Keep Circle credentials only in the separate operator/CLI environment
      if an operator-only workflow is demonstrated.

## Known limitations

There is no committed platform adapter or completed public platform deploy in
this repository. Public RPC reliability remains provider-dependent. Evidence
can degrade independently because `eth_getLogs` availability is not required
for canonical payment reads. The operator route is planning-only and is not a
public execution capability. The readiness script is an operator/CI command,
not a public diagnostic API.

## D4D1 boundary

D4D1 should address only follow-up operational work that is demonstrated as
necessary after deployment, such as platform-specific runtime observations or
provider operations. It must preserve the feature freeze and must not reopen
closed lifecycle, contract, payment, QR, or Circle architecture decisions.