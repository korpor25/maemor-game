/* การให้คะแนนทั้งหมดของแบบสำรวจ แยกออกมาเป็นฟังก์ชันบริสุทธิ์
   จึงทดสอบได้โดยไม่ต้องมี React หรือเบราว์เซอร์ */

import { AXES, BAR, QUESTIONS } from "./data.js";

export const emptyScores = () => Object.fromEntries(AXES.map(k => [k, 0]));

/* normalize ด้วยเกณฑ์ของแต่ละแกนก่อนเสมอ ทุกแกนจึงแข่งบนสเกลเดียวกัน
   ถ้าไม่ทำ แกนที่ปรากฏในตัวเลือกบ่อยกว่าจะได้เปรียบโดยอัตโนมัติ
   เกณฑ์คือคะแนนเต็มคูณตัวถ่วงที่คาลิเบรตไว้ ดูคำอธิบายใน data.js */
export const normalise = scores => AXES.map(k => Math.min(1, scores[k] / BAR[k]));

/** รวมคะแนนจากคำตอบที่เลือกไว้ พร้อมจำว่าแต่ละแกนได้คะแนนครั้งล่าสุดที่ข้อไหน */
export function tally(answers) {
  const scores = emptyScores();
  const lastGain = Object.fromEntries(AXES.map(k => [k, -1]));
  answers.forEach((choice, qi) => {
    const gained = QUESTIONS[qi]?.options[choice]?.score;
    if (!gained) return;
    for (const k in gained) {
      scores[k] += gained[k];
      lastGain[k] = qi;
    }
  });
  return { scores, lastGain };
}

/** เรียงแกนจากเด่นสุดไปน้อยสุด */
export function rank({ scores, lastGain }) {
  return AXES.slice().sort((a, b) => {
    const d = scores[b] / BAR[b] - scores[a] / BAR[a];
    if (Math.abs(d) > 1e-9) return d;
    /* คะแนนเท่ากัน — ให้แกนที่ได้คะแนนจากข้อท้าย ๆ ชนะ
       คำถามท้ายถามเรื่องคุณค่าและลักษณะงาน ซึ่งบ่งชี้ความตั้งใจมากกว่าข้อต้น
       ถ้าตัดสินด้วยลำดับที่ประกาศไว้ ผลจะตกเป็นของแกนแรกเสมอ */
    return lastGain[b] - lastGain[a];
  });
}

export const percent = (scores, key) => Math.min(100, Math.round((scores[key] / BAR[key]) * 100));
