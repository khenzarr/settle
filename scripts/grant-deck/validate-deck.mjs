import { readFile, readdir, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import sharp from "sharp";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

const root = resolve(fileURLToPath(new URL("../../", import.meta.url)));
const finalDir = join(root, "artifacts/grant-deck/final");
const qaDir = join(root, "artifacts/grant-deck/qa");
const pptxPath = join(finalDir, "Settle_Circle_2026_Cohort2_Investor_Deck.pptx");
const pdfPath = join(finalDir, "Settle_Circle_2026_Cohort2_Investor_Deck.pdf");
const expectedLinks = [
  "https://settle-web-coral.vercel.app",
  "https://settle-web-coral.vercel.app/demo",
  "https://settle-web-coral.vercel.app/docs",
  "https://github.com/khenzarr/settle",
  "https://testnet.arcscan.app/address/0x3e438ae878a8dc02c83f5545047cbde33a4f795f",
  "https://testnet.arcscan.app/tx/0x168edb8bdcf44c1df583648d96d684764a923907ae4f1d7c90516864179463ef",
];
const secretPatterns = [
  /entity[_ -]?secret/i,
  /private[_ -]?key/i,
  /recovery[_ -]?file/i,
  /api[_ -]?key\s*[:=]/i,
  /bearer\s+[a-z0-9._-]{16,}/i,
];

function fail(message) {
  throw new Error(message);
}

await Promise.all([stat(pptxPath), stat(pdfPath)]);
const pdfData = new Uint8Array(await readFile(pdfPath));
const pdf = await getDocument({ data: pdfData }).promise;
if (pdf.numPages !== 10) fail(`Expected 10 PDF pages; found ${pdf.numPages}`);

const pdfTextByPage = [];
for (let number = 1; number <= pdf.numPages; number++) {
  const page = await pdf.getPage(number);
  const content = await page.getTextContent();
  const text = content.items.map((item) => item.str).join(" ").replace(/\s+/g, " ").trim();
  if (text.length < 100) fail(`PDF page ${number} has too little extractable text`);
  pdfTextByPage.push(text);
}
const pdfText = pdfTextByPage.join("\n");
for (const pattern of secretPatterns) {
  if (pattern.test(pdfText)) fail(`Potential secret pattern found in PDF text: ${pattern}`);
}

const renderFiles = (await readdir(qaDir))
  .filter((name) => /^Slide\d+\.PNG$/i.test(name))
  .sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]));
if (renderFiles.length !== 10) fail(`Expected 10 rendered slides; found ${renderFiles.length}`);
for (const file of renderFiles) {
  const metadata = await sharp(join(qaDir, file)).metadata();
  const stats = await sharp(join(qaDir, file)).stats();
  if (metadata.width !== 1920 || metadata.height !== 1080) {
    fail(`${file} is ${metadata.width}x${metadata.height}; expected 1920x1080`);
  }
  if (stats.entropy < 0.3) fail(`${file} appears blank or near-blank (entropy ${stats.entropy})`);
}
await stat(join(qaDir, "Settle_Investor_Deck_Contact_Sheet.png"));

let pptxListing = "";
try {
  pptxListing = execFileSync("tar", ["-tf", pptxPath], { encoding: "utf8" });
} catch {
  fail("Unable to inspect PPTX package with tar");
}
const slideXmlFiles = pptxListing.match(/ppt\/slides\/slide\d+\.xml/g) ?? [];
if (slideXmlFiles.length !== 10) fail(`Expected 10 PPTX slide XML files; found ${slideXmlFiles.length}`);

const temp = join(root, "artifacts/grant-deck/qa/pptx-inspect");
execFileSync("powershell", [
  "-NoProfile",
  "-Command",
  `Remove-Item -Recurse -Force '${temp}' -ErrorAction SilentlyContinue; New-Item -ItemType Directory -Force '${temp}' | Out-Null; tar -xf '${pptxPath}' -C '${temp}'`,
]);
const slideDir = join(temp, "ppt/slides");
const relDir = join(temp, "ppt/slides/_rels");
const slideXml = await Promise.all(
  (await readdir(slideDir)).filter((name) => /^slide\d+\.xml$/.test(name)).map((name) => readFile(join(slideDir, name), "utf8")),
);
for (const [index, xml] of slideXml.entries()) {
  const shapeCount = (xml.match(/<p:sp>/g) ?? []).length;
  const textCount = (xml.match(/<a:t>/g) ?? []).length;
  if (shapeCount < 5 || textCount < 5) fail(`PPTX slide ${index + 1} lacks editable shape/text content`);
}
const relationships = await Promise.all(
  (await readdir(relDir)).filter((name) => /^slide\d+\.xml\.rels$/.test(name)).map((name) => readFile(join(relDir, name), "utf8")),
);
const relationText = relationships.join("\n").replaceAll("&amp;", "&");
for (const link of expectedLinks) {
  if (!relationText.includes(link)) fail(`Expected hyperlink is missing from PPTX: ${link}`);
}

console.log(`Validated ${slideXmlFiles.length} editable PPTX slides and ${pdf.numPages} PDF pages.`);
console.log(`Validated ${renderFiles.length} 1920x1080 renders, contact sheet, links, and secret patterns.`);