/* สร้างป้าย QR สำหรับพิมพ์ติดบูธ
   ใช้: npm run qr -- https://ที่อยู่ของแอป
   ได้ไฟล์ dist/qr/ ทั้งแบบ SVG (พิมพ์ใหญ่แค่ไหนก็คม) และหน้า A4 พร้อมพิมพ์

   ระดับแก้ไขความผิดพลาดตั้งไว้ที่ H (สูงสุด) เพราะป้ายที่บูธมักโดนแสงสะท้อน
   ถูกจับ ถูกพับ และถูกสแกนจากมุมเอียง H ทนความเสียหายได้ถึงราวสามสิบเปอร์เซ็นต์ */
import QRCode from "qrcode";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";

const url = process.argv[2];
if (!url) {
  console.error("ต้องระบุที่อยู่ เช่น:  npm run qr -- https://example.vercel.app");
  process.exit(1);
}
try { new URL(url); } catch {
  console.error(`ที่อยู่ไม่ถูกต้อง: ${url}`);
  process.exit(1);
}

const INK = "#0A0B0D";
const PAPER = "#FFFFFF";

mkdirSync("dist/qr", { recursive: true });

/* โมดูล QR เป็นสี่เหลี่ยมล้วนเพื่อความเข้ากันได้สูงสุดกับแอปสแกนทุกตัว
   ลูกเล่นทางสายตาไปอยู่ที่กรอบและตัวอักษรรอบ ๆ แทน */
const svg = await QRCode.toString(url, {
  type: "svg",
  errorCorrectionLevel: "H",
  margin: 2,
  color: { dark: INK, light: PAPER }
});
writeFileSync("dist/qr/qr.svg", svg);

await QRCode.toFile("dist/qr/qr.png", url, {
  errorCorrectionLevel: "H",
  margin: 2,
  width: 2048,                       // ใหญ่พอสำหรับป้ายไวนิลขนาดยืนอ่าน
  color: { dark: INK, light: PAPER }
});

/* หน้า A4 พร้อมพิมพ์ — ใช้ระบบดีไซน์เดียวกับตัวแอป
   ฝัง SVG ลงไปตรง ๆ จึงเปิดพิมพ์ได้โดยไม่ต้องต่อเน็ตและไม่มีไฟล์แนบให้หลุด */
const qrInner = svg.replace(/^<\?xml[^>]*\?>\s*/, "").replace(/<svg /, '<svg class="qr" ');

const poster = `<!DOCTYPE html>
<html lang="th">
<head>
<meta charset="utf-8">
<title>ป้าย QR — ผังดวงอาชีพ</title>
<style>
${["400", "700"].map(w => `
  @font-face{font-family:"Sans";font-weight:${w};font-display:block;
    src:url(data:font/woff2;base64,${readFileSync(`public/fonts/ibm-plex-sans-thai-${w}-thai.woff2`).toString("base64")}) format("woff2");
    unicode-range:U+0E01-0E5B,U+200C-200D,U+25CC}
  @font-face{font-family:"Sans";font-weight:${w};font-display:block;
    src:url(data:font/woff2;base64,${readFileSync(`public/fonts/ibm-plex-sans-thai-${w}-latin.woff2`).toString("base64")}) format("woff2")}`).join("")}
  @font-face{font-family:"Mono";font-weight:400;font-display:block;
    src:url(data:font/woff2;base64,${readFileSync("public/fonts/ibm-plex-mono-400-latin.woff2").toString("base64")}) format("woff2")}
</style>
<style>
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; margin: 0; }
  body {
    font-family: "Sans", sans-serif;
    background: #6B7280; display: grid; place-items: center; padding: 20px;
  }
  .sheet {
    width: 210mm; height: 297mm; background: #0A0B0D; color: #EEF3F9;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: 12mm; padding: 20mm; text-align: center;
  }
  .eyebrow {
    font-size: 5mm; letter-spacing: .1em; color: #5E95F7;
  }
  h1 {
    font-family: "Sans", sans-serif; font-weight: 700; letter-spacing: -.02em;
    font-size: 20mm; line-height: 1.1;
  }
  h1 em { font-style: normal; color: #5E95F7; }
  .lede { font-size: 5.4mm; line-height: 1.7; color: #8C97A6; max-width: 130mm; }
  .lede .hi { color: #EEF3F9; font-weight: 700; }
  .card { background: #fff; padding: 7mm; border-radius: 4mm; }
  .qr { display: block; width: 88mm; height: 88mm; }
  .cta { font-size: 6mm; font-weight: 600; color: #5E95F7; }
  .url {
    font-family: "Mono", monospace; font-size: 4.2mm;
    color: #8C97A6; word-break: break-all; max-width: 150mm;
  }
  .facts { display: flex; gap: 4mm; flex-wrap: wrap; justify-content: center; list-style: none; padding: 0; }
  .facts li {
    font-size: 4mm; color: #8C97A6;
    border: .3mm solid rgba(94,149,247,.4); border-radius: 99mm; padding: 1.6mm 5mm;
  }
  .foot { font-size: 4mm; color: #8C97A6; margin-top: auto; }
  @media print { body { background: none; padding: 0; } .sheet { box-shadow: none; } }
</style>
</head>
<body>
<div class="sheet">
  <p class="eyebrow">หลักสูตรเทคโนโลยีสารสนเทศ · มทร.ล้านนา ลำปาง</p>
  <h1>ผังดวง<em>อาชีพ</em></h1>
  <p class="lede">แบบสำรวจความสนใจด้านเทคโนโลยีและอาชีพดิจิทัล<br><b class="hi">ชูนิ้วหน้ากล้องเพื่อตอบ</b> 6 ข้อ รู้ผลใน 3 นาที</p>
  <div class="card">${qrInner}</div>
  <p class="cta">สแกนเพื่อเริ่มทำแบบสำรวจ</p>
  <p class="url">${url}</p>
  <ul class="facts">
    <li>ไม่ต้องติดตั้งแอป</li>
    <li>กดอนุญาตให้ใช้กล้อง</li>
    <li>ภาพไม่ถูกบันทึก</li>
  </ul>
  <p class="foot">แม่หมอ VR · ชุดคำถามที่ 3</p>
</div>
</body>
</html>
`;
writeFileSync("dist/qr/poster.html", poster);

/* ถอดรหัสกลับมาตรวจทันที ด้วยไลบรารีคนละตัวกับที่ใช้เข้ารหัส
   QR ที่พิมพ์ลงป้ายแล้วสแกนไม่ติดคือความผิดพลาดที่แก้ไม่ได้หน้างาน */
const { PNG } = await import("pngjs");
const jsQR = (await import("jsqr")).default;
const png = PNG.sync.read(readFileSync("dist/qr/qr.png"));
const decoded = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
if (!decoded || decoded.data !== url) {
  console.error(`ตรวจไม่ผ่าน: ถอดรหัสได้ "${decoded?.data ?? "ไม่ได้เลย"}" แต่ต้องการ "${url}"`);
  process.exit(1);
}

console.log(`สร้างป้าย QR สำหรับ ${url}`);
console.log("  ถอดรหัสกลับมาตรวจแล้ว ตรงกัน");
console.log("  dist/qr/qr.svg      — เวกเตอร์ ใช้กับงานพิมพ์ทุกขนาด");
console.log("  dist/qr/qr.png      — 2048px สำหรับป้ายไวนิลหรือสไลด์");
console.log("  dist/qr/poster.html — หน้า A4 เปิดในเบราว์เซอร์แล้วสั่งพิมพ์ได้เลย");
