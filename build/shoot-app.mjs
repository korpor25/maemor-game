/* ถ่ายภาพแอปทีละฉากด้วย Chrome ที่ติดตั้งอยู่ในเครื่อง
   ใช้ตอนพัฒนาเพื่อดูผลการจัดหน้า ไม่เกี่ยวกับไฟล์ที่ส่งมอบ
   ใช้: node build/shoot-app.mjs [desktop|mobile]

   เสิร์ฟด้วยเซิร์ฟเวอร์ในตัวของ Node ไม่ spawn โปรเซสลูก
   เพราะรอบก่อนใช้ npx serve แล้วฆ่าลูกไม่หมด จนเหลือค้างเต็มเครื่อง */
import puppeteer from "puppeteer-core";
import { createServer } from "node:http";
import { existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { join, extname, normalize } from "node:path";

const CHROME = [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/usr/bin/google-chrome",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
].find(existsSync);
if (!CHROME) { console.error("ไม่พบเบราว์เซอร์"); process.exit(1); }

const ROOT = "out";
if (!existsSync(ROOT)) { console.error("ไม่พบ out/ — ต้องรัน npm run build ก่อน"); process.exit(1); }

const MODE = process.argv[2] === "mobile" ? "mobile" : "desktop";
const VIEW = MODE === "mobile"
  ? { width: 414, height: 896, deviceScaleFactor: 2 }
  : { width: 1440, height: 900, deviceScaleFactor: 1 };
const OUT = `dist/shots/${MODE}`;
mkdirSync(OUT, { recursive: true });

const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".webmanifest": "application/manifest+json",
  ".woff2": "font/woff2", ".png": "image/png", ".svg": "image/svg+xml",
  ".wasm": "application/wasm", ".task": "application/octet-stream"
};

const server = createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (p.endsWith("/")) p += "index.html";
  const file = join(ROOT, normalize(p).replace(/^([/\\])+/, ""));
  if (!existsSync(file) || !statSync(file).isFile()) {
    res.writeHead(404).end("not found");
    return;
  }
  res.writeHead(200, { "Content-Type": TYPES[extname(file)] || "application/octet-stream" });
  res.end(readFileSync(file));
});

const port = await new Promise(resolve =>
  server.listen(0, "127.0.0.1", () => resolve(server.address().port)));
const base = `http://127.0.0.1:${port}`;

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: "new",
  args: ["--no-sandbox", "--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"]
});
const page = await browser.newPage();
page.on("pageerror", e => console.log("  [หน้าเว็บ error]", String(e).slice(0, 300)));
await page.setViewport(VIEW);

const wait = ms => new Promise(r => setTimeout(r, ms));

/* รอจนเงื่อนไขเป็นจริง โดยถามหน้าเว็บเป็นช่วง ๆ จากฝั่ง Node
   waitForFunction ของ puppeteer จับจังหวะด้วย requestAnimationFrame ภายในหน้า
   ซึ่งลูปของแอป (กล้อง โมเดล และฉาก 3D) กินจนตัวตรวจไม่ได้ทำงาน */
async function until(check, label, timeout = 25000, step = 300) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (await check()) return;
    await wait(step);
  }
  throw new Error("หมดเวลารอ: " + label);
}

const text = async sel => page.$eval(sel, e => e.textContent).catch(() => null);
const has = async sel => (await page.$(sel)) !== null;
const shot = async name => {
  await wait(1200);                       // ปล่อยให้แอนิเมชันและฉาก 3D เข้าที่ก่อน
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log(`  ถ่าย ${name}`);
};

await page.goto(base, { waitUntil: "networkidle2" });
await page.evaluate(() => document.fonts.ready);
await wait(1400);                         // รอ WebGL เรนเดอร์เฟรมแรก
await shot("1-intro");

/* ปิดกล้องก่อนเข้าหน้าคำถาม กล้องปลอมของ Chrome เป็นภาพทดสอบซึ่งไม่มีมือ
   และการโหลดโมเดลสิบเก้าเมกะไบต์ทำให้รอนานโดยไม่ได้อะไรเพิ่มในภาพ */
await page.evaluate(() => [...document.querySelectorAll("button")]
  .find(b => b.textContent.includes("เริ่มทำแบบสำรวจ"))?.click());
await wait(500);
/* ปิดกล้องแล้วรอจนม่านขึ้นจริง ไม่ใช่เดาเวลา
   ถ้ากล้องยังเดินอยู่ โมเดลนับนิ้วจะกินเธรดหลักจนการอัปเดตหน้าช้ากว่าที่รอไว้ */
await page.evaluate(() => [...document.querySelectorAll("button")]
  .find(b => b.textContent.startsWith("cam["))?.click());
await until(() => has(".cam__veil"), "ม่านกล้อง");
await shot("2-survey");

/* รอให้เลขข้อเปลี่ยนจริงก่อนกดข้อถัดไป เชื่อถือได้กว่าเทียบข้อความโจทย์
   เพราะโจทย์อาจยาวจนถูกตัดต่างกันระหว่างเฟรม */
for (let q = 0; q < 6; q++) {
  const before = await text(".survey__meta .code");
  const info = await page.evaluate(() => {
    const el = document.querySelector(".choice");
    if (!el) return "ไม่พบตัวเลือก";
    el.click();
    return `มี ${document.querySelectorAll(".choice").length} ตัวเลือก`;
  });
  console.log(`  กด ${before} · ${info}`);
  /* ข้อสุดท้ายมีหกตัวเลือก เป็นกรณีที่แน่นที่สุด ต้องเห็นว่ายังพอดีจอ */
  if (q === 4) { await wait(500); await shot("2b-survey-6"); }
  if (q < 5) {
    await until(async () => (await text(".survey__meta .code")) !== before, `ข้อ ${q + 2}`);
    /* pick() ในแอปมีตัวกันการกดซ้ำ 240 มิลลิวินาที เพื่อไม่ให้ท่ามือเดียวถูกนับสองครั้ง
       ถ้ากดข้อถัดไปเร็วกว่านั้น คลิกจะถูกทิ้งเงียบ ๆ แล้วสคริปต์จะค้างรอตลอดไป */
    await wait(350);
  }
}
await until(() => has(".result"), "หน้าผลลัพธ์");
await shot("3-result");

await page.evaluate(() => scrollTo(0, document.body.scrollHeight));
await shot("4-result-bottom");

await page.evaluate(() => [...document.querySelectorAll("button")]
  .find(b => b.textContent.includes("สายอาชีพทั้ง 6"))?.click());
await shot("5-paths");

await page.evaluate(() => [...document.querySelectorAll("button")]
  .find(b => b.textContent.trim() === "log")?.click());
await shot("6-panel");

await page.evaluate(() => {
  [...document.querySelectorAll("button")].find(b => b.textContent.trim() === "ปิด")?.click();
  [...document.querySelectorAll("button")].find(b => b.textContent.startsWith("theme["))?.click();
});
await shot("7-night");

await browser.close();
server.close();
console.log(`ภาพอยู่ใน ${OUT}`);
process.exit(0);
