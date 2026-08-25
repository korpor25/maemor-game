/* สร้างป้าย QR สำหรับพิมพ์ติดบูธ
   ใช้: npm run qr -- https://ที่อยู่ของแอป
   ได้ไฟล์ dist/qr/ ทั้งแบบ SVG (พิมพ์ใหญ่แค่ไหนก็คม) และหน้า A4 พร้อมพิมพ์

   ระดับแก้ไขความผิดพลาดตั้งไว้ที่ H (สูงสุด) เพราะป้ายที่บูธมักโดนแสงสะท้อน
   ถูกจับ ถูกพับ และถูกสแกนจากมุมเอียง H ทนความเสียหายได้ถึงราวสามสิบเปอร์เซ็นต์ */
import QRCode from "qrcode";
import { mkdirSync, writeFileSync } from "node:fs";

const url = process.argv[2];
if (!url) {
  console.error("ต้องระบุที่อยู่ เช่น:  npm run qr -- https://example.vercel.app");
  process.exit(1);
}
try { new URL(url); } catch {
  console.error(`ที่อยู่ไม่ถูกต้อง: ${url}`);
  process.exit(1);
}

const INK = "#0B1026";
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
<link rel="stylesheet" href="../../app/public/src/fonts.css">
<style>
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; margin: 0; }
  body {
    font-family: "IBM Plex Sans Thai", sans-serif;
    background: #6B7280; display: grid; place-items: center; padding: 20px;
  }
  .sheet {
    width: 210mm; height: 297mm; background: #0B1026; color: #F0E9DA;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: 12mm; padding: 20mm; text-align: center;
  }
  .eyebrow {
    font-size: 5mm; letter-spacing: .1em; color: #C9A227;
  }
  h1 {
    font-family: "Trirong", serif; font-weight: 600;
    font-size: 20mm; line-height: 1.1;
  }
  h1 em { font-style: normal; color: #C9A227; }
  .lede { font-size: 5.4mm; line-height: 1.7; color: #A7A6B8; max-width: 130mm; }
  .card { background: #fff; padding: 7mm; border-radius: 4mm; }
  .qr { display: block; width: 88mm; height: 88mm; }
  .cta { font-size: 6mm; font-weight: 600; color: #C9A227; }
  .url {
    font-family: "IBM Plex Mono", monospace; font-size: 4.2mm;
    color: #A7A6B8; word-break: break-all; max-width: 150mm;
  }
  .facts { display: flex; gap: 4mm; flex-wrap: wrap; justify-content: center; list-style: none; padding: 0; }
  .facts li {
    font-size: 4mm; color: #A7A6B8;
    border: .3mm solid rgba(201,162,39,.35); border-radius: 99mm; padding: 1.6mm 5mm;
  }
  .foot { font-size: 4mm; color: #A7A6B8; margin-top: auto; }
  @media print { body { background: none; padding: 0; } .sheet { box-shadow: none; } }
</style>
</head>
<body>
<div class="sheet">
  <p class="eyebrow">หลักสูตรเทคโนโลยีสารสนเทศ · มทร.ล้านนา ลำปาง</p>
  <h1>ผังดวง<em>อาชีพ</em></h1>
  <p class="lede">แบบสำรวจความสนใจด้านเทคโนโลยีและอาชีพดิจิทัล<br>ตอบ 6 ข้อ รู้ผลใน 3 นาที</p>
  <div class="card">${qrInner}</div>
  <p class="cta">สแกนเพื่อเริ่มทำแบบสำรวจ</p>
  <p class="url">${url}</p>
  <ul class="facts">
    <li>ไม่ต้องติดตั้งแอป</li>
    <li>ไม่เก็บข้อมูลส่วนตัว</li>
    <li>เล่นต่อได้แม้สัญญาณหลุด</li>
  </ul>
  <p class="foot">แม่หมอ VR · ชุดคำถามที่ 3</p>
</div>
</body>
</html>
`;
writeFileSync("dist/qr/poster.html", poster);

console.log(`สร้างป้าย QR สำหรับ ${url}`);
console.log("  dist/qr/qr.svg      — เวกเตอร์ ใช้กับงานพิมพ์ทุกขนาด");
console.log("  dist/qr/qr.png      — 2048px สำหรับป้ายไวนิลหรือสไลด์");
console.log("  dist/qr/poster.html — หน้า A4 เปิดในเบราว์เซอร์แล้วสั่งพิมพ์ได้เลย");
