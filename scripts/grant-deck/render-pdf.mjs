import { createCanvas, DOMMatrix, ImageData, Path2D } from "@napi-rs/canvas";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { readFile, mkdir, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

globalThis.DOMMatrix = DOMMatrix;
globalThis.ImageData = ImageData;
globalThis.Path2D = Path2D;

const root = resolve(fileURLToPath(new URL("../../", import.meta.url)));
const pdfPath = join(root, "artifacts/grant-deck/final/Settle_Circle_2026_Cohort2_Investor_Deck_v2.pdf");
const qa = join(root, "artifacts/grant-deck/qa");
await mkdir(qa, { recursive: true });
for (let i = 1; i <= 20; i++) await rm(join(qa, `Slide${i}.PNG`), { force: true });

const data = new Uint8Array(await readFile(pdfPath));
const doc = await getDocument({ data, disableFontFace: false }).promise;
for (let number = 1; number <= doc.numPages; number++) {
  const page = await doc.getPage(number);
  const base = page.getViewport({ scale: 1 });
  const viewport = page.getViewport({ scale: 1920 / base.width });
  const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
  const context = canvas.getContext("2d");
  await page.render({ canvasContext: context, viewport }).promise;
  await canvas.encode("png").then((buffer) => import("node:fs/promises").then(({ writeFile }) => writeFile(join(qa, `Slide${number}.PNG`), buffer)));
}
console.log(`Rendered ${doc.numPages} PDF pages to ${qa}`);