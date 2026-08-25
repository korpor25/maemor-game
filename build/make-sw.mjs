/* สร้าง service worker หลัง next build โดยอ่านชื่อไฟล์จริงจาก out/
   Next ใส่แฮชไว้ในชื่อไฟล์ JS และ CSS การเขียนรายการเองด้วยมือจึงเป็นไปไม่ได้
   ต้องให้สคริปต์อ่านผลลัพธ์จริงทุกครั้งที่ build

   กลยุทธ์สองชั้น
     · ตัวแอป (ไม่ถึงหนึ่งเมกะไบต์) เก็บเข้าแคชตั้งแต่ตอนติดตั้ง เปิดปุ๊บเล่นได้ปั๊บ
     · โมเดลนับนิ้ว (สิบเก้าเมกะไบต์) เก็บตอนถูกเรียกใช้ครั้งแรก
       ถ้าใส่ไว้ตอนติดตั้ง ผู้ที่สแกน QR จะต้องรอโหลดจนครบก่อนจึงเริ่มเล่นได้ */
import { readdirSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, posix } from "node:path";

const OUT = "out";

function walk(dir = ".", base = "") {
  const found = [];
  for (const name of readdirSync(join(OUT, dir))) {
    const rel = base ? posix.join(base, name) : name;
    const full = join(OUT, dir, name);
    if (statSync(full).isDirectory()) found.push(...walk(join(dir, name), rel));
    else found.push(rel);
  }
  return found;
}

const files = walk().sort();
if (!files.length) {
  console.error("ไม่พบไฟล์ใน out/ — ต้องรัน next build ก่อน");
  process.exit(1);
}

const hash = createHash("sha256");
for (const f of files) hash.update(f).update(readFileSync(join(OUT, f)));
const version = hash.digest("hex").slice(0, 10);

/* index.html เข้าถึงผ่าน "/" อยู่แล้ว และโฮสต์บางเจ้าตอบ /index.html ด้วย redirect
   ซึ่ง Cache.put ปฏิเสธ ถ้าใส่ไว้จะทำให้ติดตั้งไม่สำเร็จทั้งชุดโดยไม่มีอะไรฟ้อง */
const isLazy = f => f.startsWith("mp/");
const skip = f => f === "sw.js" || f === "index.html" || f.endsWith(".map");

const core = files.filter(f => !isLazy(f) && !skip(f));
const assets = ["/", ...core.map(f => "/" + f)];

const sw = `/* สร้างอัตโนมัติโดย build/make-sw.mjs หลัง next build — อย่าแก้ไฟล์นี้ด้วยมือ
   เลขรุ่นคำนวณจากเนื้อไฟล์จริงทุกไฟล์ พอมีอะไรเปลี่ยน แคชเก่าจะถูกลบทั้งชุด
   เครื่องที่ติดตั้งไว้แล้วจึงไม่ค้างอยู่กับรุ่นเก่าโดยไม่มีใครรู้ตัว */

const VERSION = ${JSON.stringify(version)};
const CACHE = "phangduang-" + VERSION;
const ASSETS = ${JSON.stringify(assets, null, 2)};

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    /* เก็บทีละไฟล์แทน addAll เพราะ addAll ล้มทั้งชุดถ้ามีไฟล์เดียวพลาด
       ไฟล์ที่พลาดจะถูกดึงและแคชตอนใช้งานจริงแทน ดีกว่าไม่ติดตั้งเลย */
    const failed = [];
    await Promise.all(ASSETS.map(async url => {
      try {
        const res = await fetch(url, { cache: "reload" });
        if (!res.ok) throw new Error(res.status);
        await cache.put(url, res);
      } catch { failed.push(url); }
    }));
    if (failed.length) console.warn("[sw] แคชไม่สำเร็จ", failed);
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== "GET") return;
  if (new URL(req.url).origin !== self.location.origin) return;

  /* การเปิดหน้าเว็บ: เสิร์ฟหน้าแรกจากแคชเสมอ
     ลิงก์ที่มี ?mode=kiosk จึงยังเปิดได้ตอนออฟไลน์ แม้ URL ไม่ตรงกับที่แคชไว้ */
  if (req.mode === "navigate") {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      return (await cache.match("/")) || (await cache.match("/index.html")) || fetch(req);
    })());
    return;
  }

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(req, { ignoreSearch: true });
    if (hit) return hit;
    const res = await fetch(req);
    /* ไฟล์โมเดลก้อนใหญ่ถูกเก็บตรงนี้เอง หลังใช้ครั้งแรกก็ใช้ออฟไลน์ได้ */
    if (res.ok && res.type === "basic") cache.put(req, res.clone());
    return res;
  })());
});
`;

writeFileSync(join(OUT, "sw.js"), sw);

const size = list => list.reduce((s, f) => s + statSync(join(OUT, f)).size, 0);
const lazy = files.filter(isLazy);
console.log(`sw.js รุ่น ${version}`);
console.log(`  แคชตอนติดตั้ง : ${core.length} ไฟล์ · ${(size(core) / 1024).toFixed(0)} KB`);
console.log(`  แคชตอนใช้จริง : ${lazy.length} ไฟล์ · ${(size(lazy) / 1048576).toFixed(1)} MB (โมเดลนับนิ้ว)`);
