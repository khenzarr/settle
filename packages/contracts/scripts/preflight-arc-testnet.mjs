const FALLBACK_RPC_URL = "https://rpc.testnet.arc.network";
const EXPECTED_CHAIN_ID = 5_042_002n;
const USDC_ADDRESS = "0x3600000000000000000000000000000000000000";
const DECIMALS_SELECTOR = "0x313ce567";
const REQUEST_TIMEOUT_MS = 10_000;

const override = process.env.ARC_TESTNET_RPC_URL?.trim();
const rpcUrl = override || FALLBACK_RPC_URL;

function safeRpcOrigin(value) {
  const parsed = new URL(value);
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("RPC URL must use HTTP or HTTPS");
  }
  return parsed.origin;
}

async function rpc(method, params) {
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`${method} returned HTTP ${response.status}`);
  }

  const payload = await response.json();
  if (payload.error) {
    throw new Error(`${method} RPC error ${payload.error.code}: ${payload.error.message}`);
  }
  if (typeof payload.result !== "string") {
    throw new Error(`${method} returned an invalid result`);
  }
  return payload.result;
}

function decodeHexQuantity(value, label) {
  if (!/^0x[0-9a-fA-F]+$/.test(value)) {
    throw new Error(`${label} is not a valid hex quantity`);
  }
  return BigInt(value);
}

try {
  const rpcOrigin = safeRpcOrigin(rpcUrl);
  const chainId = decodeHexQuantity(await rpc("eth_chainId", []), "chain ID");
  if (chainId !== EXPECTED_CHAIN_ID) {
    throw new Error(`chain ID mismatch: expected ${EXPECTED_CHAIN_ID}, received ${chainId}`);
  }

  const code = await rpc("eth_getCode", [USDC_ADDRESS, "latest"]);
  if (!/^0x[0-9a-fA-F]*$/.test(code) || code === "0x" || /^0x0+$/.test(code)) {
    throw new Error("official Arc Testnet USDC has no deployed code");
  }

  const decimalsResult = await rpc("eth_call", [
    { to: USDC_ADDRESS, data: DECIMALS_SELECTOR },
    "latest",
  ]);
  const decimals = decodeHexQuantity(decimalsResult, "USDC decimals");
  if (decimals !== 6n) {
    throw new Error(`USDC decimals mismatch: expected 6, received ${decimals}`);
  }

  console.log(`RPC origin: ${rpcOrigin}`);
  console.log(`Chain ID: ${chainId}`);
  console.log(`USDC address: ${USDC_ADDRESS}`);
  console.log(`USDC decimals: ${decimals}`);
  console.log("Arc Testnet preflight succeeded.");
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Arc Testnet preflight failed: ${message}`);
  process.exitCode = 1;
}