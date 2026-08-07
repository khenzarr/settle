import assert from "node:assert/strict";
import test from "node:test";
import type { CircleWalletBalanceRecord, CircleWalletReadOnlyGateway, CircleWalletTransactionRecord } from "./wallet-operations.ts";
import { ARC_TESTNET_USDC_TOKEN_ADDRESS, DEFAULT_TRANSACTION_PAGE_SIZE, formatWalletBalances, formatWalletInfo, formatWalletTransactions, getConfiguredWalletBalances, getConfiguredWalletInfo, getConfiguredWalletTransactions, parseSingleValueOption, parseTransactionPageSize } from "./wallet-operations.ts";
import type { CircleWalletRecord } from "./wallets.ts";

const wallet: CircleWalletRecord = {
  id: "configured-wallet-id",
  walletSetId: "configured-wallet-set-id",
  address: "0x1111111111111111111111111111111111111111",
  blockchain: "ARC-TESTNET",
  accountType: "EOA",
  custodyType: "DEVELOPER",
  state: "LIVE",
};

const baseInput = {
  configuredWalletId: wallet.id,
  configuredAddress: wallet.address as `0x${string}`,
};

function gateway(overrides: Partial<CircleWalletReadOnlyGateway> = {}): CircleWalletReadOnlyGateway {
  return {
    async getWallet() { return wallet; },
    async getWalletBalances() { return []; },
    async listWalletTransactions() { return []; },
    ...overrides,
  };
}

test("wallet info accepts matching Arc developer EOA metadata and omits the wallet ID", async () => {
  const info = await getConfiguredWalletInfo({ gateway: gateway(), ...baseInput });
  assert.deepEqual(info, {
    address: wallet.address,
    blockchain: "ARC-TESTNET",
    accountType: "EOA",
    custodyType: "DEVELOPER",
    state: "LIVE",
    arcScanUrl: "https://testnet.arcscan.app/address/0x1111111111111111111111111111111111111111",
  });
  assert.equal(formatWalletInfo(info).join("\n").includes(wallet.id), false);
});

for (const [name, change, message] of [
  ["wrong blockchain", { blockchain: "ETH-SEPOLIA" }, "ARC-TESTNET"],
  ["wrong address", { address: "0x2222222222222222222222222222222222222222" }, "wallet address"],
  ["wrong account type", { accountType: "SCA" }, "EOA"],
  ["non-live state", { state: "FROZEN" }, "LIVE"],
] as const) {
  test(`wallet info rejects ${name}`, async () => {
    await assert.rejects(() => getConfiguredWalletInfo({ gateway: gateway({ async getWallet() { return { ...wallet, ...change }; } }), ...baseInput }), new RegExp(message));
  });
}

test("balances preserve unrelated tokens and do not sum Arc USDC views", async () => {
  const records: CircleWalletBalanceRecord[] = [
    { amount: "12", token: { symbol: "USDC", name: "USD Coin", blockchain: "ARC-TESTNET", decimals: 6, standard: "NATIVE", isNative: true } },
    { amount: "12", token: { symbol: "USDC", name: "USD Coin", blockchain: "ARC-TESTNET", decimals: 6, standard: "ERC-20", isNative: false, tokenAddress: ARC_TESTNET_USDC_TOKEN_ADDRESS } },
    { amount: "7", token: { symbol: "REWARD", name: "Reward Token", blockchain: "ARC-TESTNET", decimals: 18, standard: "ERC-20", isNative: false, tokenAddress: "0x2222222222222222222222222222222222222222" } },
  ];
  const balances = await getConfiguredWalletBalances({ gateway: gateway({ async getWalletBalances() { return records; } }), ...baseInput });
  assert.equal(balances.length, 3);
  assert.deepEqual(balances.map((item) => item.arcUsdcView), ["native view", "canonical ERC-20 view", undefined]);
  assert.match(formatWalletBalances(balances).join("\n"), /alternate views.*not summed/);
  assert.match(formatWalletBalances(balances).join("\n"), /REWARD/);
});

test("token address filter is validated locally and passed as a single address", async () => {
  let received: unknown;
  await assert.rejects(() => getConfiguredWalletBalances({ gateway: gateway({ async getWalletBalances(input) { received = input; return []; } }), ...baseInput, tokenAddress: "not-an-address" }), /20-byte hexadecimal EVM address/);
  await getConfiguredWalletBalances({ gateway: gateway({ async getWalletBalances(input) { received = input; return []; } }), ...baseInput, tokenAddress: "0x2222222222222222222222222222222222222222" });
  assert.deepEqual(received, { walletId: wallet.id, tokenAddress: "0x2222222222222222222222222222222222222222" });
});

test("transaction history is wallet-scoped, bounded by default, and creates ArcScan links", async () => {
  let received: { walletId: string; pageSize: number } | undefined;
  const record: CircleWalletTransactionRecord = { walletId: wallet.id, blockchain: "ARC-TESTNET", transactionType: "TRANSFER", state: "COMPLETE", createDate: "2026-01-01", updateDate: "2026-01-02", txHash: `0x${"a".repeat(64)}` };
  const transactions = await getConfiguredWalletTransactions({ gateway: gateway({ async listWalletTransactions(input) { received = input; return [record]; } }), ...baseInput });
  assert.deepEqual(received, { walletId: wallet.id, pageSize: DEFAULT_TRANSACTION_PAGE_SIZE });
  assert.equal(received?.pageSize, DEFAULT_TRANSACTION_PAGE_SIZE);
  assert.equal(transactions[0]?.arcScanUrl, `https://testnet.arcscan.app/tx/${record.txHash}`);
  assert.doesNotMatch(formatWalletTransactions(transactions).join("\n"), /wallet-id|walletSet|credentials/i);
});

test("transaction history rejects records from another wallet and handles absent optional fields", async () => {
  await assert.rejects(() => getConfiguredWalletTransactions({ gateway: gateway({ async listWalletTransactions() { return [{ walletId: "other", blockchain: "ARC-TESTNET", transactionType: "TRANSFER", state: "PENDING", createDate: "now", updateDate: "now" }]; } }), ...baseInput }), /another wallet/);
  const result = await getConfiguredWalletTransactions({ gateway: gateway({ async listWalletTransactions() { return [{ blockchain: "ARC-TESTNET", transactionType: "TRANSFER", state: "PENDING", createDate: "now", updateDate: "now" }]; } }), ...baseInput });
  assert.equal(result[0]?.transactionHash, undefined);
});

test("page-size and CLI options reject malformed values", () => {
  assert.throws(() => parseTransactionPageSize(0), /1 to 50/);
  assert.throws(() => parseTransactionPageSize(51), /1 to 50/);
  assert.throws(() => parseTransactionPageSize(1.5), /integer/);
  assert.throws(() => parseSingleValueOption(["--unknown", "x"], "--page-size"), /Expected/);
  assert.throws(() => parseSingleValueOption(["--page-size", "1", "--page-size", "2"], "--page-size"), /Expected/);
  assert.equal(parseSingleValueOption(["--token-address", "0x1"], "--token-address"), "0x1");
});
