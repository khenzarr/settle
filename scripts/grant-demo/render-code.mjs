import { join } from "node:path";
import { createHighlighter } from "shiki";
import { artifacts, assertPublic, browser, context, ensure, save, text } from "./lib.mjs";

const shots = [
  ["C01-architecture", "pnpm-workspace.yaml", 1, 20, "Monorepo boundaries"],
  ["C02-circle-client", "packages/circle/src/client.ts", 1, 19, "Server-only Circle SDK client"],
  ["C02-circle-config", "packages/circle/src/config.ts", 72, 100, "Validated server-only Circle configuration"],
  ["C02-contract-platform", "packages/circle/src/contract-deployment.ts", 220, 250, "Circle Contract Platform deployment"],
  ["C03-release-plan", "packages/circle/src/operator-settlement-plan.ts", 61, 97, "Validated releaseOrder preparation"],
  ["C03-release-canonical", "packages/circle/src/operator-settlement-plan.ts", 158, 176, "Canonical releaseOrder validation"],
  ["C03-circle-submission", "packages/circle/src/wallet-contract-execution.ts", 102, 132, "Circle controlled-wallet submission"],
  ["C04-usdc-fund", "packages/contracts/src/SettlementEscrow.sol", 227, 250, "Exact Arc USDC funding"],
  ["C04-usdc-release", "packages/contracts/src/SettlementEscrow.sol", 284, 329, "Programmable release and lifecycle"],
  ["C05-buyer-safety", "apps/web/components/buyer-payment-flow.tsx", 20, 42, "Buyer and Arc readiness"],
  ["C05-wallet-boundary", "apps/web/lib/buyer-wallet-adapter.ts", 20, 48, "Wallet-controlled authorization"],
  ["C06-regression", "apps/web/lib/order-action-state.test.ts", 38, 61, "Release-hardening regression coverage"],
];
const out = await ensure(join(artifacts, "code"));
const highlighter = await createHighlighter({ themes: ["github-dark-default"], langs: ["typescript", "tsx", "solidity", "yaml"] });
const instance = await browser(); const ctx = await context(instance); const page = await ctx.newPage();
for (const [id, file, start, end, title] of shots) {
  const source = await text(file);
  const lines = source.split(/\r?\n/).slice(start - 1, end);
  const numbered = lines.map((line, index) => `${String(start + index).padStart(4)}  ${line}`).join("\n");
  assertPublic(numbered, `${file} displayed excerpt`);
  const lang = file.endsWith(".sol") ? "solidity" : file.endsWith(".yaml") ? "yaml" : file.endsWith(".tsx") ? "tsx" : "typescript";
  const code = highlighter.codeToHtml(numbered, { lang, theme: "github-dark-default" });
  const fontSize = lines.length > 42 ? 16 : lines.length > 30 ? 18 : 22;
  const lineHeight = lines.length > 42 ? 1.35 : 1.48;
  const html = `<!doctype html><meta charset=utf-8><style>html,body{margin:0;width:1920px;height:1080px;overflow:hidden;background:#071512;color:#edf7f2;font-family:Inter,Segoe UI,sans-serif}.bar{height:118px;padding:30px 58px;box-sizing:border-box;border-bottom:1px solid #295046;background:#0b1d19}.bar b{font-size:30px}.bar span{display:block;color:#73d5b2;font:20px ui-monospace,monospace;margin-top:8px}.code{height:962px;padding:32px 52px;box-sizing:border-box}.shiki{margin:0!important;padding:30px 34px!important;border:1px solid #24483f;border-radius:18px;height:850px;box-sizing:border-box;overflow:hidden;font-size:${fontSize}px;line-height:${lineHeight};box-shadow:0 28px 80px #0008}.shiki code{font-family:Cascadia Code,Consolas,monospace}</style><div class=bar><b>${title}</b><span>${file} · lines ${start}–${Math.min(end, source.split(/\r?\n/).length)}</span></div><div class=code>${code}</div>`;
  const htmlPath = join(out, `${id}.html`); await save(htmlPath, html);
  await page.goto(`file:///${htmlPath.replaceAll("\\", "/")}`); await page.screenshot({ path: join(out, `${id}.png`) });
  console.log(`rendered ${id}`);
}
await ctx.close(); await instance.close();
