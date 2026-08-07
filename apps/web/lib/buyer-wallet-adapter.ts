import { ARC_TESTNET, type BuyerTransactionIntent, type EvmAddress } from "@settle/shared";

export interface Eip1193Provider {
  request(args: { method: string; params?: readonly unknown[] }): Promise<unknown>;
}

export interface WalletState {
  readonly account: EvmAddress | null;
  readonly chainId: number | null;
}

export interface BuyerSubmissionResult {
  readonly hash: string;
  readonly from: EvmAddress;
  readonly target: EvmAddress;
  readonly operation: BuyerTransactionIntent["operation"];
}

export const ARC_TESTNET_CHAIN_ID_HEX = `0x${ARC_TESTNET.chainId.toString(16)}` as const;

function parseChainId(value: unknown): number {
  if (typeof value !== "string") throw new Error("Wallet returned an invalid chain ID");
  const chainId = Number.parseInt(value, 16);
  if (!Number.isSafeInteger(chainId)) throw new Error("Wallet returned an invalid chain ID");
  return chainId;
}

function address(value: unknown): EvmAddress {
  if (typeof value !== "string" || !/^0x[0-9a-fA-F]{40}$/.test(value)) {
    throw new Error("Wallet returned an invalid account");
  }
  return value.toLowerCase() as EvmAddress;
}

export async function getWalletState(provider: Eip1193Provider): Promise<WalletState> {
  const [chain, accounts] = await Promise.all([
    provider.request({ method: "eth_chainId" }),
    provider.request({ method: "eth_accounts" }),
  ]);
  return {
    chainId: parseChainId(chain),
    account: Array.isArray(accounts) && accounts.length > 0 ? address(accounts[0]) : null,
  };
}

export async function connectWallet(provider: Eip1193Provider): Promise<WalletState> {
  await provider.request({ method: "eth_requestAccounts" });
  return getWalletState(provider);
}

export async function switchToArcTestnet(provider: Eip1193Provider): Promise<void> {
  try {
    await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: ARC_TESTNET_CHAIN_ID_HEX }] });
  } catch (error) {
    if ((error as { code?: number } | null)?.code !== 4902) throw error;
    await provider.request({
      method: "wallet_addEthereumChain",
      params: [{
        chainId: ARC_TESTNET_CHAIN_ID_HEX,
        chainName: ARC_TESTNET.name,
        nativeCurrency: ARC_TESTNET.nativeCurrency,
        rpcUrls: [ARC_TESTNET.rpcUrl],
        blockExplorerUrls: [ARC_TESTNET.explorerBaseUrl],
      }],
    });
    await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: ARC_TESTNET_CHAIN_ID_HEX }] });
  }
  const state = await getWalletState(provider);
  if (state.chainId !== ARC_TESTNET.chainId) throw new Error("Wallet did not switch to Arc Testnet");
}

function validateIntent(intent: BuyerTransactionIntent, state: WalletState): void {
  if (intent.expectedSigner.kind !== "buyer") throw new Error("Only buyer intents can be submitted");
  if (intent.chainId !== ARC_TESTNET.chainId) throw new Error("Intent chain is not Arc Testnet");
  if (intent.value !== 0n) throw new Error("Buyer intent value must be zero");
  if (state.chainId !== ARC_TESTNET.chainId) throw new Error("Switch wallet to Arc Testnet before submitting");
  if (!state.account || state.account.toLowerCase() !== intent.from.toLowerCase()) throw new Error("Connected account does not match buyer intent");
  if (intent.expectedSigner.address.toLowerCase() !== intent.from.toLowerCase()) throw new Error("Buyer intent signer does not match sender");
}

export async function submitBuyerTransaction(
  intent: BuyerTransactionIntent,
  provider: Eip1193Provider,
): Promise<BuyerSubmissionResult> {
  const state = await getWalletState(provider);
  validateIntent(intent, state);
  const hash = await provider.request({
    method: "eth_sendTransaction",
    params: [{ chainId: ARC_TESTNET_CHAIN_ID_HEX, from: intent.from, to: intent.to, data: intent.data, value: "0x0" }],
  });
  if (typeof hash !== "string") throw new Error("Wallet returned an invalid transaction hash");
  return { hash, from: intent.from, target: intent.to, operation: intent.operation };
}