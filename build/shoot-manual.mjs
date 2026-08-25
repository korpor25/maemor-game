/* ถ่ายภาพคู่มือทีละหน้าเป็น PNG เพื่อตรวจการจัดวางและการเรนเดอร์ภาษาไทย
   ใช้ตอนพัฒนาเท่านั้น ไม่เกี่ยวกับไฟล์ที่ส่งมอบ */
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const SRC = "dist/manual/manual.html";
const OUT = "dist/manual/shots";
const A4 = { w: 794, h: 1123 };            // A4 ที่ 96 จุดต่อนิ้ว

const CANDIDATES = [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"
];
const browser = CANDIDATES.find(p => existsSync(p));
if (!browser) { console.error("ไม่พบเบราว์เซอร์"); process.exit(1); }

const html = readFileSync(SRC, "utf8");
const pageCount = (html.match(/<section class="page/g) || []).length;
mkdirSync(OUT, { recursive: true });

for (let i = 1; i <= pageCount; i++) {
  /* แสดงทีละหน้า แล้วถ่ายภาพในกรอบขนาด A4 พอดี */
  const only = `<style>
    body>section.page{display:none!important}
    body>section.page:nth-of-type(${i}){display:flex!important}
    body{margin:0}
    .page{width:${A4.w}px!important;height:${A4.h}px!important;
      padding:57px 64px 45px!important}
  </style>`;
  const tmp = resolve(OUT, `_page${i}.html`);
  writeFileSync(tmp, html.replace("</head>", only + "</head>"));

  execFileSync(browser, [
    "--headless", "--disable-gpu", "--no-sandbox", "--hide-scrollbars",
    `--window-size=${A4.w},${A4.h}`,
    "--virtual-time-budget=8000",
    `--screenshot=${resolve(OUT, `page-${i}.png`)}`,
    pathToFileURL(tmp).href
  ], { stdio: "pipe" });
  rmSync(tmp);
  console.log(`ถ่ายหน้า ${i}/${pageCount}`);
}
