/* ดึงฟอนต์จาก Google Fonts มาเก็บไว้ในโปรเจกต์
   ต้อง self-host เพราะแอปต้องเล่นออฟไลน์ได้ และการเรียกไฟล์ข้ามโดเมน
   ก็เป็นสิ่งที่หน้าเว็บนี้อ้างว่าไม่ทำ

   เก็บเฉพาะชุดอักษรไทยกับละติน ทิ้งซีริลลิกและเวียดนามที่ไม่ได้ใช้
   ใช้: node build/fetch-fonts.mjs "Anuphan:wght@400;500;700&family=IBM+Plex+Mono:wght@400;500" */
import { writeFileSync, mkdirSync, statSync, createWriteStream } from "node:fs";
import { get } from "node:https";
import { join } from "node:path";

const families = process.argv[2];
if (!families) {
  console.error('ต้องระบุตระกูลฟอนต์ เช่น: node build/fetch-fonts.mjs "Anuphan:wght@400;700"');
  process.exit(1);
}

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
           "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const OUT = "app/public/assets/fonts";
const KEEP = new Set(["thai", "latin"]);

const fetchText = url => new Promise((res, rej) => {
  get(url, { headers: { "User-Agent": UA } }, r => {
    let body = "";
    r.on("data", c => body += c);
    r.on("end", () => r.statusCode === 200 ? res(body) : rej(new Error(url + " -> " + r.statusCode)));
  }).on("error", rej);
});

const fetchFile = (url, dest) => new Promise((res, rej) => {
  get(url, { headers: { "User-Agent": UA } }, r => {
    if (r.statusCode !== 200) return rej(new Error(url + " -> " + r.statusCode));
    const f = createWriteStream(dest);
    r.pipe(f);
    f.on("finish", () => f.close(() => res()));
  }).on("error", rej);
});

const css = await fetchText(`https://fonts.googleapis.com/css2?family=${families}&display=swap`);

const out = [], jobs = [];
for (const block of css.split(/(?=\/\* [a-z-]+ \*\/)/).filter(Boolean)) {
  const subset = (block.match(/^\/\* ([a-z-]+) \*\//) || [])[1];
  if (!KEEP.has(subset)) continue;
  const family = (block.match(/font-family: '([^']+)'/) || [])[1];
  const weight = (block.match(/font-weight: (\d+)/) || [])[1];
  const url = (block.match(/url\((https:[^)]+)\)/) || [])[1];
  if (!family || !url) continue;
  const file = `${family.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${weight}-${subset}.woff2`;
  jobs.push({ url, file });
  out.push(block
    .replace(/url\(https:[^)]+\)/, `url(../assets/fonts/${file})`)
    .replace(/^\/\* [a-z-]+ \*\/\n/, ""));
}

mkdirSync(OUT, { recursive: true });
for (const j of jobs) await fetchFile(j.url, join(OUT, j.file));
writeFileSync("app/public/src/fonts.css", out.join("\n"));

const total = jobs.reduce((s, j) => s + statSync(join(OUT, j.file)).size, 0);
console.log(`ดาวน์โหลด ${jobs.length} ไฟล์ · รวม ${(total / 1024).toFixed(0)} KB`);
for (const j of jobs) {
  console.log(`  ${j.file.padEnd(34)} ${(statSync(join(OUT, j.file)).size / 1024).toFixed(1)} KB`);
}
