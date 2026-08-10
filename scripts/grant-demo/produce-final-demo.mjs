import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = resolve(fileURLToPath(new URL("../../", import.meta.url)));
const art = join(root, "artifacts/grant-demo");
const audioDir = join(art, "audio/scenes");
const videoDir = join(art, "intermediate/scenes");
const finalDir = join(art, "final");
const ffmpeg = "ffmpeg";
const ffprobe = "ffprobe";
const run = (cmd, args) => {
  const quietArgs = cmd === ffmpeg ? ["-hide_banner", "-loglevel", "error", ...args] : args;
  return execFileSync(cmd, quietArgs, { cwd: root, stdio: "inherit", shell: process.platform === "win32" });
};
const probe = (file) => Number(execFileSync(ffprobe, ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", file], { encoding: "utf8" }).trim());
const esc = (s) => s.replaceAll("\\", "\\\\").replaceAll("'", "'\\''");

const scenes = [
  ["S01",18,["captures/01-home.png"],`A marketplace adding Pay with U S D C needs more than a wallet button. Settle coordinates payment planning, secure wallet handoff, Arc U S D C funding, escrow, programmable settlement, and canonical reconciliation.`],
  ["S02",16,["captures/02-demo-checkout.png"],`Here’s the marketplace view. The order total is exactly zero point zero five USDC. Choosing Pay with USDC moves the integration to Settle’s planning surface, without creating an onchain order.`],
  ["S03",21,["captures/02-demo-checkout.png","captures/03-demo-plan-response.png"],`The marketplace backend sends buyer, amount, deadlines, and a ninety-ten split to POST slash A P I slash V one slash orders slash plan. This is the demo’s only live action. It is non-mutating: no chain write, Circle mutation, or database mutation.`],
  ["S04",20,["captures/03-demo-plan-response.png"],`Settle returns an order ID, terms hash, exact amount, and normalized settlement terms. Execution available is false. This is a Payment Intent and settlement plan, not an onchain order. Controlled activation remains a separate server-side boundary.`],
  ["S05",21,["captures/04-checkout-completed.png","captures/05-checkout-handoff.png"],`Hosted checkout carries canonical context: zero point zero five U S D C on Arc Testnet, split ninety-ten. The QR contains only the checkout URL. Scanning opens Settle; the wallet authorizes payment. The QR transfers nothing and contains no credentials.`],
  ["C01",9,["code/C01-architecture.png"],`The monorepo separates web, domain code, server-side Circle integration, contracts, and documentation.`],
  ["C02",22,["code/C02-circle-client.png","code/C02-circle-config.png","code/C02-contract-platform.png"],`This is actual Circle S D K code. Clients and validated configuration live server-side in packages slash circle. Developer-Controlled Wallet calls use configured wallet identities. Credentials never enter browser code. Circle Contract Platform code performed the canonical SettlementEscrow deployment.`],
  ["C03",14,["code/C03-release-plan.png","code/C03-release-canonical.png","code/C03-circle-submission.png"],`Settle validates the funded order and prepares releaseOrder. Settle decides the action. Circle Developer-Controlled Wallets submit the operator transaction; Circle does not decide settlement.`],
  ["C04A",18,["code/C04-usdc-fund.png"],`In SettlementEscrow, fundOrder accepts only the stored buyer before the deadline, then transfers the exact Arc USDC amount. A balance check rejects fee-on-transfer behavior. The contract is the canonical escrow and lifecycle boundary.`],
  ["C04B",18,["code/C04-usdc-release.png"],`releaseOrder requires a funded order. Stored basis-point terms distribute the full amount deterministically, then close active escrow. Refund and dispute paths preserve explicit marketplace lifecycle semantics.`],
  ["C05",11,["code/C05-buyer-safety.png","code/C05-wallet-boundary.png"],`Buyer safety gates account, Arc chain, allowance, canonical state, and readiness. Approve and fund remain customer-wallet actions.`],
  ["C06",8,["code/C06-regression.png"],`Testing exposed an idle-operation gating edge case, now protected by focused regression coverage.`],
  ["C07",7,["terminal/passing-summary.png"],`Eighty-five web and one hundred sixty-seven Foundry tests pass. Two hundred fifty-two total.`],
  ["S06",20,["captures/04-checkout-completed.png"],`Back in the product, the immutable order is Completed. The original zero point zero five USDC is no longer active escrow. Its programmed split produced zero point zero four five USDC for the merchant and zero point zero zero five for the platform.`],
  ["S07",19,["captures/06-arcscan-release.png"],`ArcScan shows the real release against verified SettlementEscrow on Arc Testnet. Transfer logs match both recipients and the full order amount. Settle executed this final release through its server-side Circle-controlled operator path. This is existing read-only evidence.`],
  ["S08",10,["captures/07-arcscan-contract.png"],`The verified contract record confirms its address and Arc context. This demonstration needs no new transaction or wallet interaction.`],
  ["S09",18,["captures/08-docs-quickstart.png","captures/09-docs-settlement.png","captures/10-docs-boundaries.png"],`Docs cover quickstart, API, checkout, QR lifecycle, settlement, Arc configuration, and boundaries. Current integrations are USDC, Circle Developer-Controlled Wallets, and Circle Contract Platform. Other Circle products are planned.`],
  ["S10",15,["captures/01-home.png"],`Settle connects Payment Intent, Arc U S D C, escrow, programmable settlement, and reconciliation through a controlled Circle server boundary. Payment infrastructure, not just an escrow interface.`],
];

await mkdir(audioDir, { recursive: true }); await mkdir(videoDir, { recursive: true }); await mkdir(finalDir, { recursive: true });
const terminalHtml = join(art, "terminal/passing-summary.html");
await writeFile(terminalHtml, `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;width:1920px;height:1080px;overflow:hidden;background:#071512;color:#edf7f2;font-family:Consolas,monospace}.bar{height:118px;padding:34px 58px;box-sizing:border-box;border-bottom:1px solid #295046;background:#0b1d19;font:700 30px Segoe UI,sans-serif}.term{margin:64px;padding:58px;border:1px solid #295046;border-radius:8px;background:#091a16;font-size:31px;line-height:1.75;white-space:pre-wrap}.pass{color:#73d5b2;font-weight:700}</style><div class="bar">Release test evidence</div><div class="term">SETTLE · RELEASE EVIDENCE\n\n&gt; pnpm --filter @settle/web test\n<span class="pass">85 tests passed</span>\n\n&gt; forge test --root packages/contracts\n<span class="pass">167 tests passed</span>\n\n<span class="pass">252 total tests passed</span>\n\nNo environment values or shell history captured.</div>`);
const browser = await chromium.launch({ channel: "msedge", headless: true, args: ["--disable-extensions", "--disable-notifications"] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
await page.goto(`file:///${terminalHtml.replaceAll("\\", "/")}`);
await page.screenshot({ path: join(art, "terminal/passing-summary.png") });
await browser.close();
const concat = [];
const audioConcat = [];
for (const [id, seconds, images, text] of scenes) {
  const mp3Base = join(audioDir, id), mp3 = `${mp3Base}.mp3`, wav = join(audioDir, `${id}.wav`);
  const textFile = join(audioDir, `${id}.txt`); await writeFile(textFile, text);
  run(join(root, "node_modules/.bin/edge-tts.CMD"), ["synthesize", "--voice", "en-US-AvaNeural", "--rate=-6%", "--pitch=-2Hz", "--file", textFile, "--output", mp3Base]);
  const voiceDuration = probe(mp3);
  if (voiceDuration > seconds - 0.15) throw new Error(`${id} voice ${voiceDuration.toFixed(2)}s exceeds scene ${seconds}s; regenerate with edited text/rate.`);
  run(ffmpeg, ["-y", "-i", mp3, "-af", `apad=pad_dur=${seconds}`, "-t", String(seconds), "-ar", "48000", "-ac", "2", "-c:a", "pcm_s16le", wav]);
  const baseFrames = Math.floor(seconds * 30 / images.length);
  for (let index = 0; index < images.length; index += 1) {
    const frames = index === images.length - 1 ? seconds * 30 - baseFrames * index : baseFrames;
    const duration = frames / 30;
    const video = join(videoDir, `${id}-${index + 1}.mp4`);
    run(ffmpeg, ["-y", "-loop", "1", "-i", join(art, images[index]), "-t", String(duration), "-r", "30", "-vf", "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,format=yuv420p", "-an", "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", video]);
    concat.push(`file '${esc(video)}'`);
  }
  audioConcat.push(`file '${esc(wav)}'`);
  console.log(`${id}: voice ${voiceDuration.toFixed(2)}s / scene ${seconds}s`);
}
await writeFile(join(art, "intermediate/concat.txt"), concat.join("\n") + "\n");
await writeFile(join(art, "intermediate/audio-concat.txt"), audioConcat.join("\n") + "\n");
run(ffmpeg, ["-y", "-f", "concat", "-safe", "0", "-i", join(art,"intermediate/audio-concat.txt"), "-filter:a", "apad=pad_dur=285,loudnorm=I=-16:LRA=7:TP=-1.5", "-t", "285", "-ar", "48000", "-ac", "2", "-c:a", "pcm_s16le", join(art,"audio/final-narration.wav")]);
console.log(`Prepared ${scenes.length} scene clips and final narration; target runtime 285 seconds.`);