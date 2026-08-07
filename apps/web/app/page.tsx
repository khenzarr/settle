"use client";

import { useState } from "react";
import { ARC_TESTNET, getExplorerTransactionUrl, type BuyerTransactionIntent } from "@settle/shared";
import { connectWallet, submitBuyerTransaction, switchToArcTestnet, type BuyerSubmissionResult, type Eip1193Provider, type WalletState } from "../lib/buyer-wallet-adapter";

declare global { interface Window { ethereum?: Eip1193Provider } }

function parsePreparedIntent(source: string): BuyerTransactionIntent {
  const value = JSON.parse(source) as Record<string, unknown>;
  if (value.operation !== "approve-usdc" && value.operation !== "fund-order") throw new Error("Operation must be approve-usdc or fund-order");
  if (value.chainId !== ARC_TESTNET.chainId || typeof value.from !== "string" || typeof value.to !== "string" || typeof value.data !== "string") throw new Error("Prepared intent fields are invalid");
  const signer = value.expectedSigner as Record<string, unknown> | undefined;
  if (signer?.kind !== "buyer" || signer.address !== value.from || value.value !== "0") throw new Error("Prepared intent signer or value is invalid");
  return { ...value, value: 0n } as unknown as BuyerTransactionIntent;
}

export default function Home() {
  const [wallet, setWallet] = useState<WalletState>({ account: null, chainId: null });
  const [source, setSource] = useState("");
  const [result, setResult] = useState<BuyerSubmissionResult | null>(null);
  const [error, setError] = useState("");
  const prepared = (() => { try { return source ? parsePreparedIntent(source) : null; } catch { return null; } })();
  const provider = () => { if (!window.ethereum) throw new Error("No injected EVM wallet found"); return window.ethereum; };
  async function run(action: () => Promise<void>) { setError(""); try { await action(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Wallet request failed"); } }

  return <main>
    <p className="eyebrow">D4B buyer execution proof</p><h1>Settle wallet adapter</h1>
    <p>This harness submits only externally prepared Shared buyer intents. It does not create orders or calldata.</p>
    <section><h2>Wallet</h2>
      <button onClick={() => run(async () => setWallet(await connectWallet(provider())))}>Connect wallet</button>
      <dl><dt>Address</dt><dd>{wallet.account ?? "Not connected"}</dd><dt>Chain</dt><dd>{wallet.chainId ?? "Unknown"}{wallet.chainId === ARC_TESTNET.chainId ? " — Arc Testnet" : ""}</dd></dl>
      {wallet.chainId !== null && wallet.chainId !== ARC_TESTNET.chainId && <button className="secondary" onClick={() => run(async () => { await switchToArcTestnet(provider()); setWallet(await connectWallet(provider())); })}>Switch to Arc Testnet</button>}
    </section>
    <section><h2>Prepared BuyerTransactionIntent</h2>
      <label htmlFor="intent">Paste serialized intent (use the string <code>&quot;0&quot;</code> for bigint value)</label>
      <textarea id="intent" value={source} onChange={(event) => { setSource(event.target.value); setResult(null); }} placeholder='{"operation":"approve-usdc","chainId":5042002,...,"value":"0"}' />
      {source && !prepared && <p className="error">Intent input is not a supported prepared buyer intent.</p>}
      {prepared && <div className="preview"><strong>{prepared.operation}</strong><span>{prepared.summary}</span><code>from {prepared.from}</code><code>to {prepared.to}</code><code>data {prepared.data}</code></div>}
      {prepared && <button disabled={!wallet.account} onClick={() => run(async () => setResult(await submitBuyerTransaction(prepared, provider())))}>{prepared.operation === "approve-usdc" ? "Approve" : "Fund"}</button>}
    </section>
    {result && <section><h2>Submitted (not finalized)</h2><a href={getExplorerTransactionUrl(result.hash as `0x${string}`)} target="_blank" rel="noreferrer">{result.hash}</a></section>}
    {error && <p className="error" role="alert">{error}</p>}
  </main>;
}