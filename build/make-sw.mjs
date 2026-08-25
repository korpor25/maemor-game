/* สร้าง service worker พร้อมรายการไฟล์และเลขรุ่นที่คำนวณจากเนื้อไฟล์จริง
   เขียนรายการเองด้วยมือมักลืมอัปเดตเวลาเพิ่มไฟล์ แล้วเครื่องที่ติดตั้งไว้
   จะค้างอยู่กับรุ่นเก่าโดยไม่มีใครรู้ตัว จึงให้สคริปต์สร้างให้ทุกครั้งที่ build */
import { readdirSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, posix } from "node:path";

const ROOT = "app/public";
const SKIP = new Set(["sw.js"]);

function walk(dir, base = "") {
  const out = [];
  for (const name of readdirSync(join(ROOT, dir))) {
    const rel = base ? posix.join(base, name) : name;
    if (SKIP.has(rel)) continue;
    const full = join(ROOT, dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(join(dir, name), rel));
    else out.push(rel);
  }
  return out;
}

const files = walk(".").sort();
const hash = createHash("sha256");
for (const f of files) hash.update(f).update(readFileSync(join(ROOT, f)));
const version = hash.digest("hex").slice(0, 10);

/* ไม่ precache "./index.html" ตรง ๆ เพราะโฮสต์หลายเจ้า (Vercel และ serve) ตอบ
   /index.html ด้วย redirect ไป / — และ Cache.put ปฏิเสธ response ที่ถูก redirect
   ถ้าใส่ไว้ cache.addAll จะ throw ทั้งชุด แล้ว service worker ติดตั้งไม่สำเร็จเลย
   ออฟไลน์จะพังเงียบ ๆ โดยไม่มีอะไรฟ้อง จึงเก็บเอกสารผ่าน "./" อย่างเดียว */
const assets = ["./", ...files.filter(f => f !== "index.html").map(f => "./" + f)];

const sw = `/* สร้างอัตโนมัติโดย build/make-sw.mjs — อย่าแก้ไฟล์นี้ด้วยมือ
   กลยุทธ์: precache ทุกไฟล์ตอนติดตั้ง แล้วเสิร์ฟจากแคชก่อนเสมอ
   แอปนี้ไม่มีข้อมูลจากเซิร์ฟเวอร์เลย แคชจึงเป็นแหล่งความจริงได้เต็มตัว
   เลขรุ่นคำนวณจากเนื้อไฟล์ พอมีไฟล์ไหนเปลี่ยน แคชเก่าจะถูกลบทั้งชุด */

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
      } catch (err) {
        failed.push(url);
      }
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
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  /* การเปิดหน้าเว็บ: เสิร์ฟ index.html จากแคชเสมอ
     ลิงก์ที่มี ?mode=kiosk จึงยังเปิดได้ตอนออฟไลน์ แม้ URL ไม่ตรงกับที่แคชไว้ */
  if (req.mode === "navigate") {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      return (await cache.match("./index.html"))
          || (await cache.match("./"))
          || fetch(req);
    })());
    return;
  }

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(req, { ignoreSearch: true });
    if (hit) return hit;
    try {
      const res = await fetch(req);
      if (res.ok && res.type === "basic") cache.put(req, res.clone());
      return res;
    } catch (err) {
      /* ออฟไลน์และไม่มีในแคช — ปล่อยให้ผู้เรียกจัดการเอง ดีกว่าคืนหน้าผิดชนิด */
      throw err;
    }
  })());
});
`;

writeFileSync(join(ROOT, "sw.js"), sw);
const bytes = files.reduce((s, f) => s + statSync(join(ROOT, f)).size, 0);
console.log(`sw.js: ${files.length} ไฟล์ · ${(bytes / 1024).toFixed(0)} KB · รุ่น ${version}`);
