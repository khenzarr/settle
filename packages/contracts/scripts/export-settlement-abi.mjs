import { mkdir, readFile, writeFile } from "node:fs/promises";

const artifactUrl = new URL("../out/SettlementEscrow.sol/SettlementEscrow.json", import.meta.url);
const outputUrl = new URL("../../shared/src/abi/SettlementEscrow.ts", import.meta.url);
const checkMode = process.argv.slice(2).includes("--check");
const unsupportedArguments = process.argv.slice(2).filter((argument) => argument !== "--check");

if (unsupportedArguments.length > 0) {
  console.error(`Unsupported argument(s): ${unsupportedArguments.join(", ")}`);
  process.exitCode = 1;
} else {
  await exportSettlementEscrowAbi();
}

async function exportSettlementEscrowAbi() {
  const artifact = await readArtifact();

  if (artifact === null || typeof artifact !== "object" || !Array.isArray(artifact.abi) || artifact.abi.length === 0) {
    fail("SettlementEscrow artifact must contain a non-empty abi array.");
  }

  const expectedContent = [
    "// This file is generated from the SettlementEscrow Foundry artifact. Do not edit manually.",
    `export const settlementEscrowAbi = ${JSON.stringify(artifact.abi, null, 2)} as const;`,
    "",
  ].join("\n");

  if (checkMode) {
    await checkOutput(expectedContent);
    console.log("SettlementEscrow ABI is current.");
    return;
  }

  await mkdir(new URL("./", outputUrl), { recursive: true });
  await writeFile(outputUrl, expectedContent, "utf8");
  console.log("Wrote SettlementEscrow ABI to packages/shared/src/abi/SettlementEscrow.ts.");
}

async function readArtifact() {
  let source;

  try {
    source = await readFile(artifactUrl, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") {
      fail("SettlementEscrow Foundry artifact is missing. Run the contracts build first.");
    }
    throw error;
  }

  try {
    return JSON.parse(source);
  } catch {
    fail("SettlementEscrow Foundry artifact is not valid JSON.");
  }
}

async function checkOutput(expectedContent) {
  let actualContent;

  try {
    actualContent = await readFile(outputUrl, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") {
      fail("Generated SettlementEscrow ABI file is missing. Run pnpm contracts:abi.");
    }
    throw error;
  }

  if (actualContent !== expectedContent) {
    fail("Generated SettlementEscrow ABI file is stale. Run pnpm contracts:abi.");
  }
}

function fail(message) {
  console.error(message);
  process.exit(1);
}