import { initiateDeveloperControlledWalletsClient } from "@circle-fin/developer-controlled-wallets";
import type { CircleDeveloperControlledWalletsClient } from "@circle-fin/developer-controlled-wallets";
import { initiateSmartContractPlatformClient } from "@circle-fin/smart-contract-platform";
import type { CircleSmartContractPlatformClient } from "@circle-fin/smart-contract-platform";
import type { CircleClientConfig } from "./config.ts";

export function createDeveloperControlledWalletsClient(config: CircleClientConfig): CircleDeveloperControlledWalletsClient {
  return initiateDeveloperControlledWalletsClient({
    apiKey: config.apiKey,
    entitySecret: config.entitySecret,
  });
}

export function createCircleContractsClient(config: CircleClientConfig): CircleSmartContractPlatformClient {
  return initiateSmartContractPlatformClient({
    apiKey: config.apiKey,
    entitySecret: config.entitySecret,
  });
}