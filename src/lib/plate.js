/* เรขาคณิตของแผ่นผังดวง — คณิตศาสตร์ล้วน ไม่แตะ DOM
   ใช้ร่วมกันสามที่: คอมโพเนนต์บนหน้าจอ · ฉาก 3D · สคริปต์สร้างคู่มือ
   เก็บไว้ที่เดียวเพื่อไม่ให้สูตรแตกออกเป็นหลายชุดแล้วเพี้ยนจากกัน */

export const SIZE = 220;
export const C = SIZE / 2;
export const R = 70;          // รัศมีของยอดแกนเมื่อคะแนนเต็ม
export const R_LABEL = 94;    // รัศมีของป้ายชื่อแกน วางนอกกรอบข้อมูล
export const PAD = 12;

export const angleOf = (i, n) => (-90 + (360 / n) * i) * Math.PI / 180;

export const pointAt = (i, n, radius) => {
  const a = angleOf(i, n);
  return [C + Math.cos(a) * radius, C + Math.sin(a) * radius];
};

/* ค่าต่ำสุด 0.04 กันไม่ให้รูปยุบเป็นจุดเดียวจนมองไม่เห็นว่าเป็นหกเหลี่ยม */
export const polygonOf = (values, n, radius = R) =>
  values
    .map((v, i) => pointAt(i, n, Math.max(0.04, v) * radius).map(x => x.toFixed(2)).join(","))
    .join(" ");

/* จุดบนวงกลมหน่วยในระบบพิกัดสามมิติ ใช้กับฉาก 3D
   แกน y ของ SVG ชี้ลง แต่ของ three.js ชี้ขึ้น จึงต้องกลับเครื่องหมาย */
export const point3 = (i, n, radius = 1) => {
  const a = angleOf(i, n);
  return [Math.cos(a) * radius, -Math.sin(a) * radius, 0];
};

/* รวมค่าคงที่ไว้เป็นก้อนเดียว สำหรับสคริปต์ตอน build ที่ต้องการทั้งชุด */
export const PLATE = { SIZE, C, R, R_LABEL, PAD };
