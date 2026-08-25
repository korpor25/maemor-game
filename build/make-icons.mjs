/* สร้างไอคอนแอปเป็น PNG โดยไม่พึ่งไลบรารีภายนอก
   ตรานี้คือแผ่นผังดวงแบบย่อ: กรอบสี่เหลี่ยม + หกเหลี่ยม + จุดกลาง
   รูปทรงเรียบง่ายพอที่จะแรสเตอร์เองได้ จึงไม่ต้องติดตั้ง sharp หรือ resvg */
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";

const INK = [0x0b, 0x10, 0x26];
const BRASS = [0xc9, 0xa2, 0x27];
const VERMEIL = [0xf0, 0x70, 0x8a];

const crcTable = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();
const crc32 = buf => {
  let c = -1;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
};
function encodePng(size, rgb) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;  // 8-bit truecolour
  const raw = Buffer.alloc(size * (size * 3 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0;                                        // filter: none
    rgb.copy(raw, y * (size * 3 + 1) + 1, y * size * 3, (y + 1) * size * 3);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0))
  ]);
}

/* ระยะจากจุดถึงส่วนของเส้นตรง ใช้วาดเส้นที่มีความหนาโดยไม่ต้องมีเอนจินกราฟิก */
function distToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  const t = len2 ? Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / len2)) : 0;
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

function render(size, { inset = 0.5 } = {}) {
  const buf = Buffer.alloc(size * size * 3);
  const c = size / 2;
  const scale = size * inset;                 // inset เล็กลง = เว้นขอบมากขึ้นสำหรับ maskable
  const frameHalf = scale * 0.78;
  const hexR = scale * 0.60;
  const dotR = scale * 0.13;
  const stroke = Math.max(1.4, size * 0.026);

  const hex = Array.from({ length: 6 }, (_, i) => {
    const a = (-90 + 60 * i) * Math.PI / 180;
    return [c + Math.cos(a) * hexR, c + Math.sin(a) * hexR];
  });

  const SS = 3;                                // ลบรอยหยักด้วยการสุ่มตัวอย่าง 3x3 ต่อพิกเซล
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let acc = [0, 0, 0];
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const px = x + (sx + 0.5) / SS, py = y + (sy + 0.5) / SS;
          acc = addSample(acc, colourAt(px, py));
        }
      }
      const i = (y * size + x) * 3;
      buf[i] = acc[0] / (SS * SS); buf[i + 1] = acc[1] / (SS * SS); buf[i + 2] = acc[2] / (SS * SS);
    }
  }
  return buf;

  function addSample(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }

  function colourAt(px, py) {
    if (Math.hypot(px - c, py - c) <= dotR) return VERMEIL;
    for (let i = 0; i < 6; i++) {
      const [x1, y1] = hex[i], [x2, y2] = hex[(i + 1) % 6];
      if (distToSegment(px, py, x1, y1, x2, y2) <= stroke * 0.75) return BRASS;
    }
    const dx = Math.abs(px - c), dy = Math.abs(py - c);
    const onFrame = (Math.abs(Math.max(dx, dy) - frameHalf) <= stroke * 0.55)
                 && dx <= frameHalf + stroke && dy <= frameHalf + stroke;
    if (onFrame) return BRASS;
    return INK;
  }
}

mkdirSync("app/public/assets/icons", { recursive: true });

const targets = [
  ["icon-192.png", 192, { inset: 0.5 }],
  ["icon-512.png", 512, { inset: 0.5 }],
  ["icon-maskable-512.png", 512, { inset: 0.36 }]   // เว้นขอบให้ระบบครอบเป็นวงกลมได้
];
for (const [name, size, opts] of targets) {
  writeFileSync(`app/public/assets/icons/${name}`, encodePng(size, render(size, opts)));
  console.log("wrote", name, size + "px");
}

/* ไอคอนเวกเตอร์สำหรับแท็บเบราว์เซอร์ — คมทุกความละเอียด */
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
<rect width="24" height="24" fill="#0B1026"/>
<rect x="4.2" y="4.2" width="15.6" height="15.6" fill="none" stroke="#C9A227" stroke-width="1.1"/>
<polygon points="12,6 17.2,9 17.2,15 12,18 6.8,15 6.8,9" fill="none" stroke="#C9A227" stroke-width="1.3"/>
<circle cx="12" cy="12" r="1.9" fill="#F0708A"/>
</svg>`;
writeFileSync("app/public/assets/icons/icon.svg", svg);
console.log("wrote icon.svg");
