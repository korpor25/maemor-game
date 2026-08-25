/* พิกัดข้อต่อมือแบบสังเคราะห์ ใช้ร่วมกันสองที่:
     · build/test-fingers.mjs  ตรวจว่าตรรกะการนับนิ้วตัดสินถูก
     · build/make-manual.mjs   วาดรูปท่ามือลงคู่มือ
   ใช้ชุดเดียวกันเพื่อให้รูปในคู่มือเป็นท่าที่ระบบนับได้จริง ไม่ใช่รูปที่วาดขึ้นลอย ๆ */

/** @param {boolean[]} up สถานะเหยียดของนิ้ว เรียงจากโป้งไปก้อย */
export function makeHand(up) {
  const lm = new Array(21);
  lm[0] = { x: 0.50, y: 0.95, z: 0 };                      // ข้อมือ

  /* นิ้วโป้ง — เหยียดคือกางออกด้านข้าง งอคือพับทับฝ่ามือ */
  if (up[0]) {
    lm[1] = { x: 0.42, y: 0.85, z: 0 };
    lm[2] = { x: 0.34, y: 0.78, z: 0 };
    lm[3] = { x: 0.27, y: 0.72, z: 0 };
    lm[4] = { x: 0.20, y: 0.66, z: 0 };
  } else {
    lm[1] = { x: 0.44, y: 0.86, z: 0 };
    lm[2] = { x: 0.42, y: 0.80, z: 0 };
    lm[3] = { x: 0.45, y: 0.75, z: 0 };
    lm[4] = { x: 0.50, y: 0.72, z: 0 };
  }

  /* สี่นิ้วที่เหลือ — เหยียดคือชี้ขึ้น งอคือปลายนิ้วม้วนกลับลงมาหาฝ่ามือ */
  const baseX = [0.44, 0.50, 0.56, 0.62];
  baseX.forEach((x, f) => {
    const [mcp, pip, dip, tip] = [5 + f * 4, 6 + f * 4, 7 + f * 4, 8 + f * 4];
    lm[mcp] = { x, y: 0.65, z: 0 };
    if (up[f + 1]) {
      lm[pip] = { x, y: 0.50, z: 0 };
      lm[dip] = { x, y: 0.42, z: 0 };
      lm[tip] = { x, y: 0.35, z: 0 };
    } else {
      lm[pip] = { x, y: 0.55, z: 0 };
      lm[dip] = { x, y: 0.60, z: 0 };
      lm[tip] = { x, y: 0.63, z: 0 };
    }
  });
  return lm;
}

/* ท่าที่แนะนำให้ผู้เล่นใช้สำหรับแต่ละจำนวน
   เลือกท่าที่คนไทยทำโดยสัญชาตญาณ และที่โมเดลอ่านได้ชัดที่สุด */
export const POSES = [
  { count: 1, up: [false, true, false, false, false], label: "ชี้" },
  { count: 2, up: [false, true, true, false, false], label: "ชี้ กลาง" },
  { count: 3, up: [false, true, true, true, false], label: "ชี้ กลาง นาง" },
  { count: 4, up: [false, true, true, true, true], label: "สี่นิ้ว ไม่ใช้โป้ง" },
  { count: 5, up: [true, true, true, true, true], label: "แบมือ" }
];
