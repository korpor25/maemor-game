/* ตรวจตรรกะการนับนิ้วด้วยพิกัดมือที่สร้างขึ้นเอง
   ส่วนนี้เป็นคณิตศาสตร์ล้วน จึงทดสอบได้โดยไม่ต้องมีกล้องหรือมือจริง
   สิ่งที่เทสต์นี้ยืนยัน: เกณฑ์มุมและเกณฑ์การกางนิ้วโป้งตัดสินถูกต้อง
   สิ่งที่เทสต์นี้ยืนยันไม่ได้: โมเดลหาจุดข้อต่อได้แม่นแค่ไหนกับมือจริงในแสงจริง */
import { readFingers, countFingers } from "../src/lib/hands.js";
import { makeHand } from "../src/lib/handPoses.js";

const NAMES = ["โป้ง", "ชี้", "กลาง", "นาง", "ก้อย"];

let fails = 0;
const check = (label, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) fails++;
  console.log(`  ${ok ? "✓" : "✗"} ${label}` + (ok ? "" : `  ได้ ${JSON.stringify(actual)} คาดว่า ${JSON.stringify(expected)}`));
};

console.log("อ่านสถานะนิ้วทีละนิ้ว");
for (let f = 0; f < 5; f++) {
  const up = [false, false, false, false, false];
  up[f] = true;
  check(`ชูเฉพาะนิ้ว${NAMES[f]}`, readFingers(makeHand(up)), up);
}

console.log("\nนับจำนวนนิ้วตามท่าที่ผู้เล่นน่าจะทำจริง");
const poses = [
  ["กำมือ", [false, false, false, false, false], 0],
  ["ชู 1 นิ้ว (ชี้)", [false, true, false, false, false], 1],
  ["ชู 2 นิ้ว (ชี้ กลาง)", [false, true, true, false, false], 2],
  ["ชู 3 นิ้ว (ชี้ กลาง นาง)", [false, true, true, true, false], 3],
  ["ชู 3 นิ้ว แบบโป้งด้วย", [true, true, true, false, false], 3],
  ["ชู 4 นิ้ว (ไม่ใช้โป้ง)", [false, true, true, true, true], 4],
  ["แบมือ 5 นิ้ว", [true, true, true, true, true], 5],
  ["ชูโป้งอย่างเดียว", [true, false, false, false, false], 1]
];
for (const [label, up, expect] of poses) {
  check(label, countFingers(makeHand(up)), expect);
}

console.log("\nรวมสองมือสำหรับข้อที่มีหกตัวเลือก");
const six = countFingers(makeHand([true, true, true, true, true]))
          + countFingers(makeHand([false, true, false, false, false]));
check("แบมือข้างหนึ่ง บวกชี้อีกข้าง = 6", six, 6);

/* ---------- ช่วงหน่วงของเกณฑ์ ----------
   นิ้วที่งอค้างอยู่แถวเส้นแบ่งพอดีต้องไม่สลับสถานะไปมา
   นี่คือสาเหตุที่จำนวนนิ้วเคยกระพริบจนวงแหวนไม่มีวันเต็ม */
console.log("\nช่วงหน่วงกันจำนวนนิ้วกระพริบ");
{
  /* งอนิ้วชี้ทีละน้อยจากเหยียดสุดไปงอสุด แล้วย้อนกลับ
     นับว่าสถานะพลิกกี่ครั้ง ถ้าเกณฑ์เป็นเส้นเดียวจะพลิกทุกก้าวที่คร่อมเส้น */
  const sweep = [];
  for (let k = 0; k <= 20; k++) sweep.push(k / 20);
  const seq = [...sweep, ...sweep.slice(0, -1).reverse()];

  let prev = null, flips = 0, last = null;
  for (const t of seq) {
    /* ยิ่ง t มาก นิ้วชี้ยิ่งงอ — ขยับปลายนิ้วเข้าหาฝ่ามือทีละขั้น */
    const lm = makeHand([false, true, false, false, false]);
    lm[7] = { x: lm[6].x + (lm[7].x - lm[6].x) * (1 - t * 0.9), y: lm[6].y + (lm[7].y - lm[6].y) * (1 - t * 0.9) + t * 0.06, z: 0 };
    lm[8] = { x: lm[7].x, y: lm[7].y + 0.04 - t * 0.08, z: 0 };
    const now = readFingers(lm, prev);
    if (last !== null && now[1] !== last) flips++;
    last = now[1];
    prev = now;
  }
  const ok = flips <= 2;
  console.log(`  ${ok ? "✓" : "✗"} กวาดนิ้วชี้ขึ้นลงหนึ่งรอบ สถานะพลิก ${flips} ครั้ง (ต้องไม่เกิน 2)`);
  if (!ok) process.exitCode = 1;
}

console.log(fails ? `\nไม่ผ่าน ${fails} ข้อ` : "\nตรรกะการนับนิ้วถูกต้องทุกท่าที่ทดสอบ");
process.exit(fails || process.exitCode ? 1 : 0);
