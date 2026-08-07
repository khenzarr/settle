import { getExplorerAddressUrl, getExplorerTransactionUrl, nonZeroEvmAddressSchema, normalizeAddress, parseArcTestnetRpcUrl, transactionHashSchema } from "@settle/shared";

export const TERMINAL_FAILURE_TRANSACTION_STATES = new Set(["CANCELLED", "DENIED", "FAILED", "STUCK"]);
export const SUCCESS_TRANSACTION_STATE = "COMPLETE";

export interface DeploymentStatusArguments {
  readonly contractId?: string;
  readonly transactionId?: string;
  readonly wait: boolean;
  readonly intervalSeconds: number;
  readonly timeoutSeconds: number;
}

export function parseDeploymentStatusArguments(values: readonly string[]): DeploymentStatusArguments {
  let contractId: string | undefined;
  let transactionId: string | undefined;
  const waitArgs: string[] = [];
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (value === "--contract-id" || value === "--transaction-id") {
      const next = values[++index];
      if (next === undefined || next.startsWith("--")) throw new TypeError(`${value} requires a value`);
      if (value === "--contract-id") {
        if (contractId !== undefined) throw new TypeError("--contract-id may only be provided once");
        contractId = next;
      } else {
        if (transactionId !== undefined) throw new TypeError("--transaction-id may only be provided once");
        transactionId = next;
      }
    } else {
      waitArgs.push(value);
      if (value === "--interval-seconds" || value === "--timeout-seconds") waitArgs.push(values[++index] ?? "");
    }
  }
  return { ...parseWaitOptions(waitArgs), ...(contractId === undefined ? {} : { contractId }), ...(transactionId === undefined ? {} : { transactionId }) };
}

export function parseWaitOptions(args: readonly string[]): Readonly<{ wait: boolean; intervalSeconds: number; timeoutSeconds: number }> {
  let wait = false, intervalSeconds = 5, timeoutSeconds = 600;
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--wait") wait = true;
    else if (argument === "--interval-seconds") intervalSeconds = readNumber(args[++index], argument);
    else if (argument === "--timeout-seconds") timeoutSeconds = readNumber(args[++index], argument);
    else throw new TypeError(`Unsupported argument: ${argument}`);
  }
  if (intervalSeconds < 2) throw new TypeError("--interval-seconds must be at least 2");
  if (timeoutSeconds < intervalSeconds || timeoutSeconds > 3600) throw new TypeError("--timeout-seconds must be between the interval and 3600");
  return { wait, intervalSeconds, timeoutSeconds };
}

export async function waitForDeployment<T extends Readonly<{ state: string }>>(input: Readonly<{
  retrieve: () => Promise<T>;
  intervalSeconds: number;
  timeoutSeconds: number;
  onChange: (status: T) => void;
  sleep?: (milliseconds: number) => Promise<void>;
  now?: () => number;
}>): Promise<T> {
  const sleep = input.sleep ?? ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
  const now = input.now ?? Date.now;
  const deadline = now() + input.timeoutSeconds * 1000;
  let previous = "";
  while (true) {
    const status = await input.retrieve();
    const serialized = JSON.stringify(status, (key, value) => key === "requestId" ? undefined : value);
    if (serialized !== previous) input.onChange(status);
    previous = serialized;
    if (status.state === SUCCESS_TRANSACTION_STATE) return status;
    if (TERMINAL_FAILURE_TRANSACTION_STATES.has(status.state)) throw new TypeError(`Circle deployment transaction reached terminal failure state ${status.state}`);
    if (now() >= deadline) throw new TypeError(`Timed out waiting ${input.timeoutSeconds} seconds for Circle deployment transaction`);
    await sleep(input.intervalSeconds * 1000);
  }
}

export async function verifyArcDeploymentBytecode(input: Readonly<{
  address: string;
  transactionHash?: string;
  environment: Readonly<Record<string, string | undefined>>;
  fetch?: typeof globalThis.fetch;
}>): Promise<Readonly<{ address: string; transactionUrl?: string; contractUrl: string }>> {
  const address = normalizeAddress(nonZeroEvmAddressSchema.parse(input.address));
  const transactionHash = input.transactionHash === undefined ? undefined : transactionHashSchema.parse(input.transactionHash);
  const fetcher = input.fetch ?? globalThis.fetch;
  const rpcUrl = parseArcTestnetRpcUrl(input.environment);
  const chainId = await rpc(fetcher, rpcUrl, "eth_chainId", []);
  if (chainId !== "0x4cef52") throw new TypeError(`Expected Arc Testnet chain ID 5042002, received ${String(chainId)}`);
  const code = await rpc(fetcher, rpcUrl, "eth_getCode", [address, "latest"]);
  if (typeof code !== "string" || !/^0x[0-9a-fA-F]+$/.test(code) || /^0x0*$/.test(code)) throw new TypeError("Arc Testnet contract address has empty deployed bytecode");
  return {
    address,
    contractUrl: getExplorerAddressUrl(address),
    ...(transactionHash === undefined ? {} : { transactionUrl: getExplorerTransactionUrl(transactionHash) }),
  };
}

async function rpc(fetcher: typeof globalThis.fetch, url: string, method: string, params: readonly unknown[]): Promise<unknown> {
  const response = await fetcher(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
  if (!response.ok) throw new TypeError(`Arc Testnet RPC ${method} failed with HTTP ${response.status}`);
  const body = await response.json() as { result?: unknown; error?: unknown };
  if (body.error !== undefined) throw new TypeError(`Arc Testnet RPC ${method} returned an error`);
  return body.result;
}

function readNumber(value: string | undefined, name: string): number {
  if (value === undefined || !/^\d+$/.test(value)) throw new TypeError(`${name} requires an integer value`);
  return Number(value);
}