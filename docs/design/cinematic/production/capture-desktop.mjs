import { spawn } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const chrome = process.env.CHROME_PATH ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const workRoot = process.env.SETTLE_CINEMATIC_WORK ?? "C:\\Users\\mertb\\Desktop\\Settle_Cinematic_Render_Work";
const frames = path.join(workRoot, "desktop-frames");
const profile = path.join(workRoot, "chrome-profile");
const port = 9223;
const fps = 24;
const duration = 10.2;
const frameCount = Math.ceil(duration * fps);

await rm(frames, { recursive: true, force: true });
await rm(profile, { recursive: true, force: true });
await mkdir(frames, { recursive: true });
await mkdir(profile, { recursive: true });

const server = spawn(process.execPath, [path.join(import.meta.dirname, "master", "serve.js")], {
  stdio: ["ignore", "pipe", "inherit"],
});
const browser = spawn(chrome, [
  "--headless=new",
  "--disable-gpu",
  "--hide-scrollbars",
  "--force-device-scale-factor=1",
  `--remote-debugging-port=${port}`,
  `--user-data-dir=${profile}`,
  "--no-first-run",
  "--no-default-browser-check",
  "about:blank",
], { stdio: "ignore" });

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
async function json(url) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return response.json();
    } catch {}
    await sleep(100);
  }
  throw new Error(`Timed out waiting for ${url}`);
}

let socket;
try {
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Preview server did not start")), 5_000);
    server.stdout.once("data", () => { clearTimeout(timer); resolve(); });
  });
  const version = await json(`http://127.0.0.1:${port}/json/version`);
  socket = new WebSocket(version.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });

  let sequence = 0;
  const pending = new Map();
  socket.addEventListener("message", ({ data }) => {
    const message = JSON.parse(data);
    if (!message.id || !pending.has(message.id)) return;
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(message.error.message));
    else resolve(message.result);
  });
  function send(method, params = {}, sessionId) {
    const id = ++sequence;
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    });
  }

  const { targetId } = await send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
  await send("Page.enable", {}, sessionId);
  await send("Runtime.enable", {}, sessionId);
  await send("Emulation.setDeviceMetricsOverride", {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
    screenWidth: 1440,
    screenHeight: 900,
  }, sessionId);
  await send("Page.navigate", { url: "http://127.0.0.1:4173/?plate=desktop&capture=1" }, sessionId);

  for (let attempt = 0; attempt < 100; attempt += 1) {
    const ready = await send("Runtime.evaluate", {
      expression: "document.readyState === 'complete' && typeof window.renderAt === 'function'",
      returnByValue: true,
    }, sessionId);
    if (ready.result.value) break;
    if (attempt === 99) throw new Error("Cinematic master did not become ready");
    await sleep(50);
  }

  await send("Runtime.evaluate", { expression: "window.pauseCinematic()" }, sessionId);
  for (let frame = 0; frame < frameCount; frame += 1) {
    const time = frame / fps;
    await send("Runtime.evaluate", { expression: `window.renderAt(${time})` }, sessionId);
    const capture = await send("Page.captureScreenshot", {
      format: "png",
      fromSurface: true,
      captureBeyondViewport: false,
    }, sessionId);
    await writeFile(path.join(frames, `frame-${String(frame).padStart(4, "0")}.png`), Buffer.from(capture.data, "base64"));
    if (frame % fps === 0) process.stdout.write(`Captured ${time.toFixed(1)}s / ${duration.toFixed(1)}s\n`);
  }

  await send("Runtime.evaluate", { expression: "window.renderAt(6.95)" }, sessionId);
  const poster = await send("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
    captureBeyondViewport: false,
  }, sessionId);
  await writeFile(path.join(workRoot, "settlement-register-desktop-poster.png"), Buffer.from(poster.data, "base64"));
  console.log(`Captured ${frameCount} deterministic frames at ${fps}fps to ${frames}`);
} finally {
  socket?.close();
  browser.kill();
  server.kill();
}