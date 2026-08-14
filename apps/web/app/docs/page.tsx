import type { Metadata } from "next";
import { CopyButton } from "../../components/copy-button";

export const metadata: Metadata = { title: "Developer Documentation · Settle", description: "Integrate Pay with USDC, hosted checkout, wallet handoff, and programmable settlement through Settle." };
const base = "https://settle-web-coral.vercel.app";
const endpoints = [
  { method: "POST", path: "/api/v1/orders/plan", purpose: "Prepare a deterministic, non-mutating marketplace order plan.", request: `{
  "externalOrderId": "order-123",
  "buyer": "0x1111111111111111111111111111111111111111",
  "amountUsdc": "0.05",
  "fundingDeadline": "2000000000",
  "settlementDeadline": "2000003600",
  "settlement": [
    {
      "recipient": "0x2222222222222222222222222222222222222222",
      "shareBps": 10000
    }
  ]
}`, response: `{
  "message": "Order plan prepared",
  "plan": {
    "mode": "plan",
    "executionAvailable": false,
    "order": {
      "orderId": "0x...",
      "termsHash": "0x..."
    },
    "next": {
      "action": "marketplace-create-required",
      "checkoutAvailable": false
    }
  }
}`, failures: "400 invalid-request or unsupported-input. Unknown fields are rejected." },
  { method: "GET", path: "/api/v1/orders/{orderId}", purpose: "Read canonical order state, terms, actions, and evidence.", response: `{
  "orderId": "0x...",
  "status": "created",
  "statusLabel": "Created",
  "buyer": "0x...",
  "amount": {
    "baseUnits": "50000",
    "usdc": "0.050000"
  },
  "deadlines": {
    "funding": "...",
    "settlement": "..."
  },
  "settlement": [],
  "actions": {},
  "evidence": {}
}`, failures: "400 invalid-order-id, 404 unknown-order, or 502 rpc-unavailable." },
  { method: "GET", path: "/api/v1/payment-intents/{orderId}", purpose: "Project the canonical order into a Payment Intent.", response: `{
  "orderId": "0x...",
  "source": "onchain",
  "canonicalStatus": "Created",
  "paymentState": "awaiting-payment",
  "amount": {
    "baseUnits": "50000",
    "usdc": "0.050000",
    "currency": "USDC"
  },
  "checkout": {
    "pageAvailable": true,
    "paymentActionAvailable": true,
    "path": "/pay/0x..."
  }
}`, failures: "400 invalid-order-id, 404 unknown-order, or 502 rpc-unavailable." },
  { method: "GET", path: "/api/v1/payment-intents/{orderId}/handoff", purpose: "Return hosted checkout, QR payload, and deeplink handoff values.", response: `{
  "orderId": "0x...",
  "checkout": {
    "url": "https://settle-web-coral.vercel.app/pay/0x..."
  },
  "qr": {
    "payload": "https://settle-web-coral.vercel.app/pay/0x..."
  },
  "deeplink": {
    "url": "https://settle-web-coral.vercel.app/pay/0x..."
  }
}`, failures: "400 invalid-order-id, 404 unknown-order, 502 rpc-unavailable, or 503 when the public app origin is unavailable." },
];
export default function DocsPage() { return <div className="content-container content-container--wide page-frame docs-page">
  <header className="dx-hero"><p className="eyebrow">Settle · developer documentation</p><h1>Add Pay with USDC to your marketplace.</h1><p className="lede">Integrate payment planning, hosted checkout, wallet handoff, and programmable settlement through Settle.</p><div className="action-row"><a className="button-link" href="/demo">Try demo</a><a className="button-link button-link--secondary" href="https://github.com/khenzarr/settle" target="_blank" rel="noreferrer">View GitHub ↗</a></div></header>
  <nav className="docs-index" aria-label="Documentation sections">{["Quickstart", "Architecture", "API reference", "Checkout", "Lifecycle", "Settlement", "Configuration", "Boundaries"].map((item) => <a href={`#${item.toLowerCase().replaceAll(" ", "-")}`} key={item}>{item}</a>)}</nav>
  <section id="quickstart"><p className="eyebrow">01 · Quickstart</p><h2>Marketplace backend → canonical settlement</h2><p>Use the public API to prepare a deterministic plan, then use the resulting order context to hand a buyer to hosted checkout. The current grant release separates public planning/read/handoff from controlled onchain activation.</p><pre><code>{`const response = await fetch("${base}/api/v1/orders/plan", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(planRequest)
});
const { plan } = await response.json();`}</code></pre></section>
  <section id="architecture"><p className="eyebrow">02 · Integration architecture</p><h2>One order-backed source of truth</h2><p>Marketplace checkout → Payment Intent → hosted checkout → customer wallet → Arc USDC → escrow → programmable settlement → canonical finality/reconciliation.</p><p className="trust-note">A durable worker scans confirmation-delayed SettlementEscrow logs, verifies complete order state at an explicit Arc block, and projects only canonical results. Transaction submission or a receipt alone is not payment finality.</p></section>
  <section id="api-reference"><p className="eyebrow">03 · API reference</p><h2>Public integration endpoints</h2><div className="endpoint-list">{endpoints.map((endpoint) => <article className="endpoint-card" key={endpoint.path}><header className="endpoint-card__top"><div className="endpoint-card__route"><span className="method">{endpoint.method}</span><code>{endpoint.path}</code></div><CopyButton text={`${base}${endpoint.path}`} label={`Copy ${endpoint.method} ${endpoint.path} endpoint URL`} /></header><p className="endpoint-card__purpose">{endpoint.purpose}</p>{endpoint.request && <div className="endpoint-card__example"><div className="endpoint-card__label"><h3>Request</h3><CopyButton text={endpoint.request} label={`Copy ${endpoint.method} ${endpoint.path} request example`} /></div><pre><code>{endpoint.request}</code></pre></div>}<div className="endpoint-card__example"><div className="endpoint-card__label"><h3>Response</h3><CopyButton text={endpoint.response} label={`Copy ${endpoint.method} ${endpoint.path} response example`} /></div><pre><code>{endpoint.response}</code></pre></div><div className="endpoint-card__errors"><h3>Errors</h3><p>Errors use <code>{`{ error: { code, message } }`}</code>. {endpoint.failures} Planning has no authentication in this grant release; merchant authentication is future productization.</p></div></article>)}</div></section>
  <section id="checkout"><p className="eyebrow">04 · Hosted checkout</p><h2><code>/pay/{`{orderId}`}</code></h2><p>Hosted checkout displays the canonical order, exact assigned buyer, exact amount, Arc Testnet context, and wallet-controlled transaction authorization. When allowance is insufficient, approval precedes <code>fundOrder(orderId)</code>. Canonical chain state—not a receipt or hash alone—is authority.</p></section>
  <section id="lifecycle"><p className="eyebrow">05 · QR & lifecycle</p><h2>QR encodes the hosted checkout URL</h2><p><code>checkout.url == qr.payload == deeplink.url</code>. Scanning opens Settle on the customer&apos;s device; the wallet authorizes Arc USDC. The QR does not transfer USDC, fund escrow, contain a private key, or submit a transaction.</p><p className="trust-note">Created → approval if needed → fund → Funded. Controlled settlement may resolve to terminal states according to contract/API semantics; settlement deadlines do not automatically transition state.</p></section>
  <section id="settlement"><p className="eyebrow">06 · Settlement</p><h2>Programmable BPS distribution</h2><p>A 0.05 USDC order with a 90 / 10 split resolves to 0.045 USDC for the merchant and 0.005 USDC for the platform.</p></section>
  <section id="configuration"><p className="eyebrow">07 · Arc Testnet configuration</p><h2>Network and deployed contracts</h2><dl><dt>Network</dt><dd>Arc Testnet · chain ID 5042002</dd><dt>USDC</dt><dd>0x3600000000000000000000000000000000000000</dd><dt>SettlementEscrow</dt><dd>0x3e438ae878a8dc02c83f5545047cbde33a4f795f</dd><dt>Explorer</dt><dd>https://testnet.arcscan.app</dd></dl><p className="read-only-note">Source verified. Native-USDC display precision is distinct from application ERC20 accounting.</p></section>
  <section id="boundaries"><p className="eyebrow">08 · Security and current release boundaries</p><h2>Honest capabilities, clear trust boundaries</h2><p><strong>Implemented:</strong> planning, canonical reads, Payment Intent projection, hosted checkout, QR/deeplink handoff, buyer-controlled Arc USDC funding, escrow, programmable settlement, durable finalized reconciliation with reorg invalidation, controlled Circle-backed operator execution, contract-level refund/dispute lifecycle, test merchant identity and API keys, persistent Payment Intent APIs, and signed at-least-once webhook infrastructure.</p><p><strong>Not public product features:</strong> a complete merchant management dashboard, production worker scheduling, public operator execution, an SDK/plugin package, automatic settlement orchestration, CCTP routing, or Arc mainnet deployment. These remain explicit later productization slices—not hidden assumptions in the current grant release.</p></section>
</div>; }
