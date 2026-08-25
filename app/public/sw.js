/* สร้างอัตโนมัติโดย build/make-sw.mjs — อย่าแก้ไฟล์นี้ด้วยมือ
   กลยุทธ์: precache ทุกไฟล์ตอนติดตั้ง แล้วเสิร์ฟจากแคชก่อนเสมอ
   แอปนี้ไม่มีข้อมูลจากเซิร์ฟเวอร์เลย แคชจึงเป็นแหล่งความจริงได้เต็มตัว
   เลขรุ่นคำนวณจากเนื้อไฟล์ พอมีไฟล์ไหนเปลี่ยน แคชเก่าจะถูกลบทั้งชุด */

const VERSION = "59ca991d90";
const CACHE = "phangduang-" + VERSION;
const ASSETS = [
  "./",
  "./app.webmanifest",
  "./assets/fonts/ibm-plex-mono-400-latin.woff2",
  "./assets/fonts/ibm-plex-mono-500-latin.woff2",
  "./assets/fonts/ibm-plex-sans-thai-400-latin.woff2",
  "./assets/fonts/ibm-plex-sans-thai-400-thai.woff2",
  "./assets/fonts/ibm-plex-sans-thai-500-latin.woff2",
  "./assets/fonts/ibm-plex-sans-thai-500-thai.woff2",
  "./assets/fonts/ibm-plex-sans-thai-600-latin.woff2",
  "./assets/fonts/ibm-plex-sans-thai-600-thai.woff2",
  "./assets/fonts/trirong-400-latin.woff2",
  "./assets/fonts/trirong-400-thai.woff2",
  "./assets/fonts/trirong-600-latin.woff2",
  "./assets/fonts/trirong-600-thai.woff2",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png",
  "./assets/icons/icon-maskable-512.png",
  "./assets/icons/icon.svg",
  "./src/app.js",
  "./src/chart.js",
  "./src/data.js",
  "./src/fonts.css",
  "./src/stats.js",
  "./src/styles.css",
  "./src/vision.js"
];

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
