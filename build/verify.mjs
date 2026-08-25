/* ตรวจความสอดคล้องระหว่าง HTML / CSS / JS โดยไม่ต้องเปิดเบราว์เซอร์
   จับข้อผิดพลาดที่เงียบที่สุดสามแบบ:
     1. JS อ้าง id ที่ไม่มีใน HTML  → $("...") คืน null แล้วพังตอนรันเท่านั้น
     2. JS สลับคลาสที่ไม่มีใน CSS   → โค้ดไม่พัง แต่แอนิเมชันเงียบหายไปเฉย ๆ
     3. HTML อ้างไฟล์ที่ไม่มีจริง   → 404 ที่เห็นก็ต่อเมื่อเปิดหน้าเว็บ */
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, posix, dirname } from "node:path";

const ROOT = "app/public";
const read = p => readFileSync(join(ROOT, p), "utf8");

const html = read("index.html");
const css = read("src/styles.css");
const srcFiles = readdirSync(join(ROOT, "src")).filter(f => f.endsWith(".js"));
const js = Object.fromEntries(srcFiles.map(f => [f, read(join("src", f))]));

let problems = 0;
const fail = (kind, detail) => { problems++; console.log(`  ✗ [${kind}] ${detail}`); };

/* ---- 1. id ที่ JS เรียก ต้องมีใน HTML ---- */
const htmlIds = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]));
/* บาง element ถูกสร้างตอนรัน (เช่น แถบชวนติดตั้ง) จึงไม่มีใน HTML ต้นฉบับโดยตั้งใจ
   เก็บ id เหล่านั้นจากที่ JS กำหนดเอง แทนการเขียนรายชื่อยกเว้นไว้ตายตัว */
for (const code of srcFiles.map(f => read(join("src", f)))) {
  for (const m of code.matchAll(/\.id\s*=\s*"([^"]+)"/g)) htmlIds.add(m[1]);
  for (const m of code.matchAll(/\bid="([^"]+)"/g)) htmlIds.add(m[1]);
}
const jsIds = new Map();
for (const [file, code] of Object.entries(js)) {
  for (const m of code.matchAll(/\$\("([^"]+)"\)|getElementById\("([^"]+)"\)|querySelector\(`#\$\{([^}]+)\}`\)/g)) {
    const id = m[1] || m[2];
    if (id) jsIds.set(id, file);
  }
}
console.log(`id ที่ JS เรียกใช้: ${jsIds.size} รายการ`);
for (const [id, file] of jsIds) {
  if (!htmlIds.has(id)) fail("id หาย", `${file} เรียก #${id} แต่ไม่มีใน index.html`);
}

/* stats.js เข้าถึง id ผ่านตัวแปร จึงตรวจรายชื่อที่ใช้จริงแยกต่างหาก */
for (const id of ["statToday", "statAll", "statAvg", "statTop", "dist", "logRows"]) {
  if (!htmlIds.has(id)) fail("id หาย", `stats.js ต้องการ #${id}`);
}

/* ---- 2. คลาสที่ JS สลับ ต้องมีใน CSS ---- */
const cssClasses = new Set([...css.matchAll(/\.([a-zA-Z][\w-]*)/g)].map(m => m[1]));
const toggled = new Set();
for (const code of Object.values(js)) {
  for (const m of code.matchAll(/classList\.(?:add|remove|toggle)\(\s*"([^"]+)"/g)) toggled.add(m[1]);
  for (const m of code.matchAll(/className\s*=\s*"([^"]+)"/g)) m[1].split(/\s+/).forEach(c => c && toggled.add(c));
}
console.log(`คลาสที่ JS จัดการ: ${toggled.size} รายการ`);
for (const c of toggled) {
  if (!cssClasses.has(c)) fail("คลาสไม่มีใน CSS", `JS ใช้ .${c} แต่ styles.css ไม่ได้นิยามไว้`);
}

/* ---- 3. ไฟล์ที่ HTML อ้างถึง ต้องมีอยู่จริง ---- */
const refs = [...html.matchAll(/(?:href|src)="(\.\/[^"]+)"/g)].map(m => m[1]);
console.log(`ไฟล์ที่ index.html อ้างถึง: ${refs.length} รายการ`);
for (const r of refs) {
  if (!existsSync(join(ROOT, r))) fail("ไฟล์หาย", `index.html อ้าง ${r}`);
}

/* ---- 4. ฟอนต์ที่ fonts.css อ้าง ต้องมีอยู่จริง ---- */
const fontCss = read("src/fonts.css");
const fontRefs = [...fontCss.matchAll(/url\(([^)]+)\)/g)].map(m => m[1]);
for (const r of fontRefs) {
  const resolved = posix.normalize(posix.join("src", r));
  if (!existsSync(join(ROOT, resolved))) fail("ฟอนต์หาย", `fonts.css อ้าง ${r}`);
}
console.log(`ไฟล์ฟอนต์ที่อ้างถึง: ${fontRefs.length} รายการ`);

/* ---- 5. ไฟล์ที่ import กันเอง ต้องมีอยู่จริง ---- */
for (const [file, code] of Object.entries(js)) {
  for (const m of code.matchAll(/from\s+"(\.\/[^"]+)"/g)) {
    if (!existsSync(join(ROOT, "src", m[1]))) fail("import หาย", `${file} import ${m[1]}`);
  }
}

/* ---- 6. sw.js ต้องครอบคลุมทุกไฟล์ที่มีอยู่ ---- */
const sw = read("sw.js");
const cached = new Set([...sw.matchAll(/"\.\/([^"]+)"/g)].map(m => m[1]));
const walk = (d, b = "") => readdirSync(join(ROOT, d)).flatMap(n => {
  const rel = b ? posix.join(b, n) : n;
  return statSync(join(ROOT, d, n)).isDirectory() ? walk(join(d, n), rel) : [rel];
});
const onDisk = walk(".").filter(f => f !== "sw.js");
for (const f of onDisk) {
  if (!cached.has(f)) fail("ไม่ได้แคช", `${f} ไม่อยู่ในรายการ precache ของ sw.js`);
}
console.log(`ไฟล์ที่ sw.js แคชไว้: ครบ ${onDisk.length} ไฟล์บนดิสก์`);

console.log(problems ? `\nพบปัญหา ${problems} จุด` : "\nผ่านทั้งหมด ไม่พบการอ้างอิงที่ขาดหาย");
process.exit(problems ? 1 : 0);
