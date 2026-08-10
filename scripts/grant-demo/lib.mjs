import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { ARTIFACTS, ROOT, VIEWPORT } from "./config.mjs";

export const root = fileURLToPath(ROOT);
export const artifacts = fileURLToPath(ARTIFACTS);
export async function ensure(path) { await mkdir(path, { recursive: true }); return path; }
export async function text(path) { return readFile(resolve(root, path), "utf8"); }
export async function save(path, value) { await ensure(dirname(path)); await writeFile(path, value); }
export async function browser() {
  return chromium.launch({ channel: "msedge", headless: true, args: ["--disable-notifications", "--disable-extensions", "--hide-scrollbars", "--force-color-profile=srgb"] });
}
export async function context(instance) {
  return instance.newContext({ viewport: VIEWPORT, screen: VIEWPORT, deviceScaleFactor: 1, colorScheme: "dark", locale: "en-US", timezoneId: "UTC", reducedMotion: "reduce", serviceWorkers: "block" });
}
export async function settle(page) {
  await page.addStyleTag({ content: "*{scroll-behavior:auto!important;caret-color:transparent!important} video{animation-play-state:paused!important}" });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(800);
}
export function assertPublic(value, label) {
  const forbidden = /(sk_live_[a-z0-9]+|sk_test_[a-z0-9]+|0x[a-f0-9]{64}\s*(?:#|\/\/)?.*private|bearer\s+[a-z0-9._-]{16,}|(?:api.?key|entity.?secret|private.?key|recovery(?:phrase|material|secret)).{0,20}[=:]\s*["'][^"']{8,}|\.env(?:\.|\/|\\))/i;
  if (forbidden.test(value)) throw new Error(`${label} failed redaction scan`);
}
