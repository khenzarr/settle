import { createMarketplaceLifecyclePreflightDependencies, parseMarketplaceLifecyclePreflightArguments, parseMarketplaceLifecyclePreflightEnvironment, preflightMarketplaceLifecycle } from "../src/marketplace-lifecycle-preflight.ts";
import { redactString } from "../src/redaction.ts";

try {
  const arguments_ = parseMarketplaceLifecyclePreflightArguments(process.argv.slice(2));
  const environment = parseMarketplaceLifecyclePreflightEnvironment(process.env);
  const manifest = await preflightMarketplaceLifecycle({
    arguments: arguments_,
    operatorAddress: environment.operatorAddress,
    circleWalletAddress: environment.circleWalletAddress,
    dependencies: createMarketplaceLifecyclePreflightDependencies({ rpcUrl: environment.rpcUrl }),
  });
  console.log(JSON.stringify(manifest, null, 2));
  if (manifest.readiness.status === "NOT READY") process.exitCode = 2;
} catch (error) {
  console.error(redactString(error instanceof Error ? error.message : String(error)));
  process.exitCode = 1;
}