/* ถ่ายภาพแอปจริงทีละฉากด้วย Chrome ที่ติดตั้งอยู่ในเครื่อง
   ใช้ตอนพัฒนาเพื่อดูผลการจัดหน้า ไม่เกี่ยวกับไฟล์ที่ส่งมอบ
   ใช้: node build/shoot-app.mjs [desktop|mobile] */
import puppeteer from "puppeteer-core";
import { existsSync, mkdirSync } from "node:fs";
import { spawn } from "node:child_process";

const CHROME = [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"
].find(existsSync);
if (!CHROME) { console.error("ไม่พบเบราว์เซอร์"); process.exit(1); }

const MODE = process.argv[2] === "mobile" ? "mobile" : "desktop";
const VIEW = MODE === "mobile"
  ? { width: 414, height: 896, deviceScaleFactor: 2 }
  : { width: 1440, height: 900, deviceScaleFactor: 1 };
const OUT = `dist/shots/${MODE}`;
const PORT = 4188;

mkdirSync(OUT, { recursive: true });

/* เสิร์ฟจากเซิร์ฟเวอร์จริง เพราะ service worker กับ ES module
   ไม่ทำงานเมื่อเปิดผ่าน file:// */
const server = spawn("npx", ["--yes", "serve", "-l", String(PORT), "app/public"],
  { stdio: "ignore", shell: true });
const wait = ms => new Promise(r => setTimeout(r, ms));
for (let i = 0; i < 40; i++) {
  try { await fetch(`http://localhost:${PORT}/`); break; } catch { await wait(500); }
}

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: "new",
  args: ["--no-sandbox", "--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"]
});
const page = await browser.newPage();
await page.setViewport(VIEW);

const shot = async name => {
  await wait(900);                       // ปล่อยให้แอนิเมชันเข้าที่ก่อน
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log(`  ถ่าย ${name}`);
};

await page.evaluateOnNewDocument(() => {
  /* กันแถบชวนติดตั้งไม่ให้บังภาพหน้าจอ ไม่เกี่ยวกับการทำงานจริง */
  Object.defineProperty(window, "onbeforeinstallprompt", { value: null });
});
await page.goto(`http://localhost:${PORT}/`, { waitUntil: "networkidle2" });
await page.evaluate(() => document.fonts.ready);
await shot("1-intro");

/* ปิดกล้องก่อนเข้าหน้าคำถาม กล้องปลอมของ Chrome เป็นภาพทดสอบซึ่งไม่มีมือ
   และการโหลดโมเดลสิบเก้าเมกะไบต์ทำให้ภาพหน้าจอรอนานโดยไม่ได้อะไรเพิ่ม */
await page.click("#btnStart");
await wait(400);
await page.click("#btnCamToggle");
await shot("2-survey");

/* รอให้โจทย์เปลี่ยนจริงก่อนกดข้อถัดไป การเดาเวลาทำให้คลิกตกหล่น
   ตอน pick() ยังทำแอนิเมชันค้างอยู่ */
for (let q = 0; q < 6; q++) {
  const before = await page.$eval("#stem", e => e.textContent);
  await page.evaluate(() => document.querySelector("#choices button")?.click());
  if (q < 5) {
    await page.waitForFunction(
      prev => document.querySelector("#stem").textContent !== prev,
      { timeout: 5000 }, before);
  }
}
await page.waitForFunction(
  () => document.querySelector("#screen-cast")?.classList.contains("is-active"),
  { timeout: 8000 });
await page.evaluate(() => document.querySelector("#screen-cast")?.click());
await page.waitForFunction(
  () => document.querySelector("#screen-result")?.classList.contains("is-active"),
  { timeout: 8000 });
await shot("3-result");

await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
await shot("4-result-bottom");

await page.evaluate(() => document.querySelector("#btnPaths").click());
await shot("5-paths");

await page.evaluate(() => document.querySelector("#btnPanel").click());
await shot("6-panel");

/* ธีมกลางคืน */
await page.evaluate(() => {
  document.querySelector("#btnPanelClose").click();
  document.querySelector("#btnTheme").click();
});
await shot("7-night");

await browser.close();
server.kill();
console.log(`ภาพอยู่ใน ${OUT}`);
process.exit(0);
