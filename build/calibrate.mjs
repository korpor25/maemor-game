/* คาลิเบรตตัวถ่วงเพดานให้ทุกสายอาชีพมีโอกาสออกใกล้เคียงกัน

   ปัญหา: หารคะแนนด้วยคะแนนเต็มดิบ ๆ แล้วยังไม่ยุติธรรม
   แกนที่ได้คะแนนเป็นก้อนใหญ่ในไม่กี่ข้อจะแกว่งแรงและขึ้นนำได้บ่อย
   ส่วนแกนที่ได้ทีละนิดเกือบทุกข้อจะเกาะกลุ่มอยู่กลาง ๆ แทบไม่มีวันชนะ

   วิธี: ไล่คำตอบครบทุกเส้นทาง นับว่าแต่ละแกนออกเป็นผลลัพธ์กี่ครั้ง
   แล้วยกเกณฑ์ของแกนที่ออกบ่อยเกินไปให้สูงขึ้นทีละรอบจนสัดส่วนเข้าที่
   ตัวถ่วงต่ำสุดถูกดึงกลับมาเป็น 1 เสมอ เปอร์เซ็นต์ที่แสดงจึงไม่มีทางเกิน 100

   เขียนผลกลับเข้า src/lib/data.js เอง ไม่ต้องคัดลอกมือ
   ต้องรันใหม่ทุกครั้งที่แก้คำถามหรือคะแนน */

import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const DATA = resolve(import.meta.dirname, "../src/lib/data.js");
const ROUNDS = 400;
const ALPHA = 0.12;    /* ก้าวเล็ก ๆ — สัดส่วนที่ออกเป็นฟังก์ชันขั้นบันไดของตัวถ่วง
                          ก้าวใหญ่จะกระโดดข้ามจุดสมดุลแล้วแกว่งไปมาไม่เข้าที่ */

const { AXES, QUESTIONS, CEILING, PATHS } = await import(
  pathToFileURL(DATA).href + `?t=${process.hrtime.bigint()}`
);

/* คะแนนดิบของทุกเส้นทางคำตอบ คำนวณครั้งเดียวแล้วใช้ซ้ำทุกรอบ
   รอบหนึ่งจึงเหลือแค่การหารกับหาค่ามากสุด ไม่ต้องไล่คำถามใหม่ */
const paths = [];
(function walk(qi, scores) {
  if (qi === QUESTIONS.length) { paths.push(scores.slice()); return; }
  for (const opt of QUESTIONS[qi].options) {
    const next = scores.slice();
    for (const k in opt.score) next[AXES.indexOf(k)] += opt.score[k];
    walk(qi + 1, next);
  }
})(0, AXES.map(() => 0));

console.log(`เส้นทางคำตอบ ${paths.length.toLocaleString("th-TH")} แบบ · ${AXES.length} สาย`);

const ceil = AXES.map(k => CEILING[k]);
const target = 1 / AXES.length;
let tune = AXES.map(() => 1);
let best = tune.slice();
let bestSpread = Infinity;

/* คะแนนเป็นจำนวนเต็มน้อย ๆ จึงเสมอกันบ่อยมาก
   เกมจริงตัดสินเสมอด้วยว่าแกนไหนได้คะแนนจากข้อท้ายกว่า ซึ่งกระจายพอ ๆ กัน
   ที่นี่จึงหารคะแนนเสมอให้ทุกแกนที่เสมอเท่า ๆ กัน
   เคยให้แกนสุดท้ายชนะขาดทุกครั้งที่เสมอ แล้วได้ผลเพี้ยนไปทางแกนท้ายสุด */
const share = t => {
  const win = AXES.map(() => 0);
  const tied = [];
  for (const sc of paths) {
    let bestV = -1;
    tied.length = 0;
    for (let i = 0; i < AXES.length; i++) {
      const v = sc[i] / (ceil[i] * t[i]);
      if (v > bestV + 1e-9) { bestV = v; tied.length = 0; tied.push(i); }
      else if (v > bestV - 1e-9) tied.push(i);
    }
    for (const i of tied) win[i] += 1 / tied.length;
  }
  return win.map(w => w / paths.length);
};

/* ห้าม normalize ระหว่างทาง — เคยหารด้วยค่าต่ำสุดทุกรอบแล้วค่าระเบิด
   เพราะแกนที่ยังไม่เคยชนะจะถูกกดลงเรื่อย ๆ แล้วไปดันตัวหารให้เล็กตาม
   เก็บไว้ทำครั้งเดียวตอนจบพอ */
for (let r = 0; r < ROUNDS; r++) {
  const s = share(tune);
  const floor = 0.5 / paths.length;      /* แกนที่ยังไม่เคยชนะ ไม่ให้อัตราส่วนกลายเป็นศูนย์ */
  /* ออกบ่อยเกินเป้า → ยกเกณฑ์ให้สูงขึ้น ออกน้อยเกินไป → ลดเกณฑ์ลง
     จำกัดการขยับต่อรอบไว้ ไม่งั้นค่าจะแกว่งข้ามเป้าไปมาไม่เข้าที่ */
  const spread = Math.max(...s) - Math.min(...s);
  if (spread < bestSpread) { bestSpread = spread; best = tune.slice(); }
  tune = tune.map((t, i) => {
    const step = Math.pow(Math.max(s[i], floor) / target, ALPHA);
    return t * Math.min(1.06, Math.max(0.94, step));
  });
  if (process.env.TRACE && r % 50 === 0)
    console.log(r, "spread", (spread * 100).toFixed(1) + "%", s.map(x => (x * 100).toFixed(1)).join(" "));
}
/* เก็บชุดที่กระจายแคบที่สุดที่เคยเจอ ไม่ใช่ชุดของรอบสุดท้าย
   ปลายทางยังขยับเล็กน้อยไปเรื่อย ๆ เพราะสัดส่วนเป็นขั้นบันได ไม่ลู่เข้าจุดเดียวเป๊ะ */
tune = best;
const lo = Math.min(...tune);
tune = tune.map(t => t / lo);            /* ต่ำสุดเป็น 1 เปอร์เซ็นต์จึงไม่เกิน 100 */

const final = share(tune);
const pct = x => (x * 100).toFixed(1) + "%";
console.log("\nแกน        ตัวถ่วง  เกณฑ์   สัดส่วนที่ออก");
AXES.forEach((k, i) => {
  const bar = "#".repeat(Math.round(final[i] * 120)).padEnd(18, ".");
  console.log(
    PATHS[k].axis.padEnd(10),
    tune[i].toFixed(3).padStart(7),
    (ceil[i] * tune[i]).toFixed(1).padStart(6),
    " " + bar, pct(final[i])
  );
});
console.log(`\nเป้าหมาย ${pct(target)} · ต่ำสุด ${pct(Math.min(...final))} · สูงสุด ${pct(Math.max(...final))}`);

/* เขียนกลับเข้าไฟล์ต้นทาง */
const src = await readFile(DATA, "utf8");
const body = AXES.map((k, i) => `${k}: ${tune[i].toFixed(3)}`).join(", ");
const next = src.replace(
  /export const TUNE = \{[\s\S]*?\};/,
  `export const TUNE = {\n  ${body}\n};`
);
if (next === src) throw new Error("ไม่พบบล็อก TUNE ใน data.js");
await writeFile(DATA, next, "utf8");
console.log("\nเขียนค่าใหม่ลง src/lib/data.js แล้ว");
