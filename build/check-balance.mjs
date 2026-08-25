/* พิสูจน์ว่าไม่มีสายอาชีพไหนถูกกันออกจากผลลัพธ์
   ไล่คำตอบครบทุกเส้นทางแล้วนับว่าแต่ละสายออกเป็นผลลัพธ์กี่ครั้ง

   ใช้ BAR ซึ่งเป็นเกณฑ์จริงที่แอปใช้ตัดสิน (คะแนนเต็ม × ตัวถ่วงที่คาลิเบรตไว้)
   ถ้าตัวเลขกระจายกว้าง แปลว่าต้องรัน npm run calibrate ใหม่ */

import { PATHS, QUESTIONS, AXES, CEILING, TUNE, BAR } from "../src/lib/data.js";

console.log("แกน      :", AXES.join(" "));
console.log("คำถาม    :", QUESTIONS.length, "ข้อ · ตัวเลือกต่อข้อ:", QUESTIONS.map(q => q.options.length).join(","));
console.log("เกณฑ์    :", AXES.map(k => `${k}=${CEILING[k]}×${TUNE[k].toFixed(2)}`).join("  "));

const over = QUESTIONS.filter(q => q.options.length > 5);
if (over.length) {
  console.error(`\nผิดกติกา: มี ${over.length} ข้อที่มีเกินห้าตัวเลือก ตอบด้วยมือเดียวไม่ได้`);
  process.exitCode = 1;
}

/* คะแนนเป็นจำนวนเต็มน้อย ๆ จึงเสมอกันได้บ่อย
   หารคะแนนเสมอให้ทุกแกนที่เสมอเท่า ๆ กัน จะได้ไม่เอนไปทางแกนที่ประกาศไว้ก่อน
   (ในเกมจริงตัดสินด้วยว่าแกนไหนได้คะแนนจากข้อท้ายกว่า ซึ่งกระจายพอ ๆ กัน) */
const win = Object.fromEntries(AXES.map(k => [k, 0]));
let total = 0;

const walk = (qi, sc) => {
  if (qi === QUESTIONS.length) {
    total++;
    let bv = -1;
    let tied = [];
    for (const k of AXES) {
      const v = sc[k] / BAR[k];
      if (v > bv + 1e-9) { bv = v; tied = [k]; }
      else if (v > bv - 1e-9) tied.push(k);
    }
    for (const k of tied) win[k] += 1 / tied.length;
    return;
  }
  for (const o of QUESTIONS[qi].options) {
    const next = { ...sc };
    for (const k in o.score) next[k] += o.score[k];
    walk(qi + 1, next);
  }
};
walk(0, Object.fromEntries(AXES.map(k => [k, 0])));

console.log("\nเส้นทางคำตอบทั้งหมด:", total.toLocaleString("th-TH"));
console.log("สัดส่วนที่แต่ละสายได้เป็นผลลัพธ์:");
for (const k of AXES) {
  const pct = win[k] / total * 100;
  const bar = "#".repeat(Math.round(pct * 1.6)).padEnd(22, ".");
  console.log(`  ${PATHS[k].axis.padEnd(10)} ${bar} ${pct.toFixed(1)}%`);
}

const pcts = AXES.map(k => win[k] / total * 100);
const ideal = 100 / AXES.length;
const lo = Math.min(...pcts), hi = Math.max(...pcts);
console.log(`\nอุดมคติ ${ideal.toFixed(1)}%  ·  ต่ำสุด ${lo.toFixed(1)}%  สูงสุด ${hi.toFixed(1)}%`);

/* เผื่อไว้กว้างพอสมควร ตัวเลขขยับได้เล็กน้อยตามการแก้ถ้อยคำ
   แต่ถ้าหลุดกรอบนี้แปลว่ามีสายที่แทบไม่มีวันออก ต้องคาลิเบรตใหม่ */
if (lo < ideal * 0.7 || hi > ideal * 1.4) {
  console.error("\nคะแนนเอนเกินไป — รัน npm run calibrate แล้วตรวจใหม่");
  process.exitCode = 1;
}
