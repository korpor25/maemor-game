/* ตรวจตรรกะการนับนิ้วด้วยพิกัดมือที่สร้างขึ้นเอง
   ส่วนนี้เป็นคณิตศาสตร์ล้วน จึงทดสอบได้โดยไม่ต้องมีกล้องหรือมือจริง
   สิ่งที่เทสต์นี้ยืนยัน: เกณฑ์มุมและเกณฑ์การกางนิ้วโป้งตัดสินถูกต้อง
   สิ่งที่เทสต์นี้ยืนยันไม่ได้: โมเดลหาจุดข้อต่อได้แม่นแค่ไหนกับมือจริงในแสงจริง */
import { readFingers, countFingers } from "../app/public/src/hands.js";
import { makeHand } from "./hand-poses.mjs";

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

console.log(fails ? `\nไม่ผ่าน ${fails} ข้อ` : "\nตรรกะการนับนิ้วถูกต้องทุกท่าที่ทดสอบ");
process.exit(fails ? 1 : 0);
