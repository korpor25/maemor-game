/* สร้างคู่มือ PDF จากข้อมูลจริงใน data.js
   คำถาม สายอาชีพ และเกณฑ์คะแนนในคู่มือถูกดึงมาจากไฟล์เดียวกับที่แอปใช้
   แก้คำถามแล้วรัน npm run manual ใหม่ คู่มือจะตรงกับแอปเสมอ ไม่มีทางหลุดจากกัน

   เรนเดอร์ด้วย Chrome ที่ติดตั้งอยู่แล้วผ่าน --print-to-pdf จึงไม่ต้องลง puppeteer
   ฟอนต์ถูกฝังเป็น data URI เพราะ Chrome ปฏิเสธการโหลดฟอนต์ข้ามไฟล์เมื่อเปิดผ่าน file:// */
import { PATHS, QUESTIONS, AXES, CEILING } from "../src/lib/data.js";
import { pointAt, polygonOf, PLATE } from "../src/lib/plate.js";
import { HAND_BONES, readFingers } from "../src/lib/hands.js";
import { makeHand, POSES } from "./hand-poses.mjs";
import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const OUT_DIR = "dist/manual";
const N = AXES.length;

/* ---------- สีสำหรับงานพิมพ์ ----------
   ใช้ชุดโหมดกลางวันของแอป แต่พื้นเป็นขาวจริง
   คู่มือนี้จะถูกพิมพ์ด้วยเครื่องพิมพ์สำนักงาน พื้นเข้มเต็มหน้าจะกินหมึกมหาศาล
   และเครื่องพิมพ์ส่วนใหญ่พิมพ์ไม่ถึงขอบกระดาษอยู่แล้ว */
const INK = "#0A0B0D";
const INK_SOFT = "#4C535C";
const BRASS = "#1B4FB0";      // สีเน้นของระบบ คงชื่อเดิมไว้เพื่อไม่ต้องแก้ทุกจุดที่อ้างถึง
const VERMEIL = "#2E6FDF";
const RULE = "#CBD8E4";

/* ---------- ฝังฟอนต์ ---------- */
const FONTS = [
  ["Display", 700, ["ibm-plex-sans-thai-700-thai", "ibm-plex-sans-thai-700-latin"]],
  ["Plex Thai", 400, ["ibm-plex-sans-thai-400-thai", "ibm-plex-sans-thai-400-latin"]],
  ["Plex Thai", 500, ["ibm-plex-sans-thai-500-thai", "ibm-plex-sans-thai-500-latin"]],
  ["Plex Mono", 400, ["ibm-plex-mono-400-latin"]]
];
const fontFaces = FONTS.flatMap(([family, weight, files]) =>
  files.map(f => {
    const b64 = readFileSync(`public/fonts/${f}.woff2`).toString("base64");
    return `@font-face{font-family:"${family}";font-weight:${weight};font-style:normal;` +
           `font-display:block;src:url(data:font/woff2;base64,${b64}) format("woff2")}`;
  })).join("\n");

/* ---------- ตัวช่วยวาดผังดวง ----------
   ใช้ pointAt / polygonOf ตัวเดียวกับที่แอปใช้วาดบนหน้าจอ */
const { SIZE, C, R, R_LABEL, PAD } = PLATE;

function plateSvg(values, { labels = false, lead = -1, frame = true } = {}) {
  const parts = [];
  if (frame) {
    parts.push(`<rect x="${PAD}" y="${PAD}" width="${SIZE - PAD * 2}" height="${SIZE - PAD * 2}" fill="none" stroke="${RULE}"/>`);
  }
  for (const step of [0.25, 0.5, 0.75, 1]) {
    parts.push(`<polygon points="${polygonOf(new Array(N).fill(step), N)}" fill="none" stroke="${RULE}" stroke-width="0.8"/>`);
  }
  for (let i = 0; i < N; i++) {
    const [x, y] = pointAt(i, N, R);
    parts.push(`<line x1="${C}" y1="${C}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="${RULE}" stroke-width="0.8"/>`);
  }
  parts.push(`<polygon points="${polygonOf(values, N)}" fill="${BRASS}" fill-opacity="0.14" stroke="${BRASS}" stroke-width="2" stroke-linejoin="round"/>`);
  for (let i = 0; i < N; i++) {
    const [x, y] = pointAt(i, N, Math.max(0.04, values[i]) * R);
    const isLead = i === lead;
    parts.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${isLead ? 5 : 3}" fill="${isLead ? VERMEIL : "#fff"}" stroke="${isLead ? VERMEIL : BRASS}" stroke-width="1.5"/>`);
  }
  if (labels) {
    for (let i = 0; i < N; i++) {
      const [x, y] = pointAt(i, N, R_LABEL);
      parts.push(`<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" font-family="Plex Thai" font-size="10" font-weight="500" fill="${i === lead ? VERMEIL : INK_SOFT}" text-anchor="middle" dominant-baseline="middle">${PATHS[AXES[i]].axis}</text>`);
    }
  }
  return `<svg viewBox="0 0 ${SIZE} ${SIZE}" xmlns="http://www.w3.org/2000/svg">${parts.join("")}</svg>`;
}

const glyphSvg = axisIndex => {
  const values = new Array(N).fill(0.26);
  values[axisIndex] = 1;
  return plateSvg(values, { lead: axisIndex, frame: false });
};

/* วาดโครงมือจากพิกัดชุดเดียวกับที่ build/test-fingers.mjs ใช้ตรวจ
   รูปในคู่มือจึงเป็นท่าที่ระบบนับได้จริง ไม่ใช่รูปที่วาดขึ้นเองแล้วหวังว่าจะตรง */
function handSvg(up) {
  const lm = makeHand(up);
  const fingers = readFingers(lm);
  const X = p => (p.x * 100).toFixed(1);
  const Y = p => (p.y * 100).toFixed(1);
  const bones = HAND_BONES
    .map(([a, b]) => `<line x1="${X(lm[a])}" y1="${Y(lm[a])}" x2="${X(lm[b])}" y2="${Y(lm[b])}"/>`)
    .join("");
  const tips = [4, 8, 12, 16, 20]
    .map((t, i) => `<circle cx="${X(lm[t])}" cy="${Y(lm[t])}" r="${fingers[i] ? 3.4 : 2}" fill="${fingers[i] ? VERMEIL : RULE}"/>`)
    .join("");
  /* ระบายฝ่ามือไว้ข้างหลัง ลำพังเส้นข้อต่ออย่างเดียวอ่านเป็นคราดมากกว่ามือ
     ใช้จุดข้อมือกับโคนนิ้วทั้งสี่ที่มีอยู่แล้ว จึงไม่ต้องเดารูปทรงเพิ่ม */
  const palm = [0, 1, 5, 9, 13, 17].map(i => `${X(lm[i])},${Y(lm[i])}`).join(" ");
  return `<svg viewBox="10 30 80 72" xmlns="http://www.w3.org/2000/svg">
    <polygon points="${palm}" fill="${BRASS}" fill-opacity="0.3" stroke="${BRASS}" stroke-width="2.4" stroke-linejoin="round"/>
    <g stroke="${BRASS}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" fill="none">${bones}</g>${tips}</svg>`;
}

/* ---------- ตัวอย่างผลลัพธ์บนหน้าอธิบาย ----------
   คำนวณจากการตอบจริงชุดหนึ่ง ไม่ได้ตั้งตัวเลขขึ้นมาเอง
   ตัวเลขในคู่มือจึงเป็นตัวเลขที่ผู้ตอบมีโอกาสเห็นจริง */
const sampleAnswers = [1, 2, 2, 4, 4, 5];
const sampleScores = Object.fromEntries(AXES.map(k => [k, 0]));
QUESTIONS.forEach((q, i) => {
  const opt = q.options[Math.min(sampleAnswers[i], q.options.length - 1)];
  for (const k in opt.score) sampleScores[k] += opt.score[k];
});
const sampleValues = AXES.map(k => sampleScores[k] / CEILING[k]);
const sampleLead = sampleValues.indexOf(Math.max(...sampleValues));

/* ---------- ส่วนประกอบของเอกสาร ---------- */
const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const page = (n, title, body) => `
<section class="page">
  <header class="ph">
    <span class="ph__mark">${sealSvg}</span>
    <span class="ph__title">${esc(title)}</span>
    <span class="ph__num">${n}</span>
  </header>
  ${body}
  <footer class="pf">ผังดวงอาชีพ · แม่หมอ VR · หลักสูตรเทคโนโลยีสารสนเทศ มทร.ล้านนา ลำปาง</footer>
</section>`;

const sealSvg = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
<rect x="2" y="2" width="20" height="20" fill="none" stroke="${BRASS}" stroke-width="1"/>
<polygon points="12,5 17.1,8 17.1,14 12,17 6.9,14 6.9,8" fill="none" stroke="${BRASS}" stroke-width="1.2"/>
<circle cx="12" cy="11" r="1.8" fill="${VERMEIL}"/></svg>`;

const step = (n, title, text) => `
<li class="step">
  <span class="step__n">${n}</span>
  <div><b class="step__t">${esc(title)}</b><p class="step__d">${esc(text)}</p></div>
</li>`;

const kv = rows => `<table class="kv">${rows.map(([a, b]) =>
  `<tr><th>${a}</th><td>${esc(b)}</td></tr>`).join("")}</table>`;

/* ---------- หน้า 1: ปก + วิธีเล่น ---------- */
const p1 = `
<div class="cover">
  <p class="eyebrow">คู่มือกิจกรรม · ชุดคำถามที่ 3</p>
  <h1 class="cover__title">ผังดวง<em>อาชีพ</em></h1>
  <p class="cover__sub">แบบสำรวจความสนใจด้านเทคโนโลยีและอาชีพดิจิทัล</p>
  <div class="cover__plate">${plateSvg(sampleValues, { labels: true, lead: sampleLead })}</div>
</div>

<h2 class="h2">วิธีเล่น</h2>
<ol class="steps">
  ${step(1, "สแกน QR แล้วอนุญาตให้ใช้กล้อง", "เปิดกล้องมือถือส่องที่ป้าย QR แตะลิงก์ที่ขึ้นมา แล้วกดอนุญาตเมื่อเบราว์เซอร์ถามหากล้อง ไม่ต้องติดตั้งแอปและไม่ต้องสมัครอะไร")}
  ${step(2, "ชูนิ้วให้ตรงกับหมายเลขคำตอบ", "ยกมือขึ้นหน้ากล้อง ชูนิ้วเท่ากับหมายเลขของคำตอบที่ต้องการ ตัวเลขที่ระบบอ่านได้จะขึ้นกลางจอทันที")}
  ${step(3, "ค้างไว้จนวงแหวนเต็ม", "ถือท่าเดิมนิ่งไว้ราวหนึ่งวินาที วงแหวนรอบตัวเลขจะไล่จนครบรอบแล้วจึงนับว่าเลือก ถ้าเลขยังไม่ตรงก็เปลี่ยนท่าได้ทันที ยังไม่ถือว่าตอบ")}
  ${step(4, "อ่านผล", "ตอบครบหกข้อแล้วระบบจะสรุปว่าคุณเอนไปทางสายงานใดมากที่สุด พร้อมคะแนนรายแกน อาชีพตัวอย่าง และวิชาที่จะได้เรียนจริงในหลักสูตร")}
</ol>

<h2 class="h2">ท่ามือของแต่ละหมายเลข</h2>
<div class="poses">
${POSES.map(pose => `
  <figure class="pose">
    <div class="pose__art">${handSvg(pose.up)}</div>
    <figcaption><b>${pose.count}</b><span>${esc(pose.label)}</span></figcaption>
  </figure>`).join("")}
  <figure class="pose">
    <div class="pose__art pose__art--pair">${handSvg([true, true, true, true, true])}${handSvg([false, true, false, false, false])}</div>
    <figcaption><b>6</b><span>สองมือรวมกัน</span></figcaption>
  </figure>
</div>
<p class="fine">ระบบนับนิ้วที่เหยียดทั้งหมด ไม่สนใจว่าเป็นนิ้วไหนหรือมือข้างใด ชู 3 นิ้วแบบใดก็ได้ผลเท่ากัน
มีเพียงข้อสุดท้ายที่มีหกตัวเลือก จึงต้องใช้สองมือ</p>

<ul class="facts">
  <li>เลือกคำตอบด้วยการชูนิ้ว</li>
  <li>แตะหน้าจอก็ได้</li>
  <li>ไม่เก็บชื่อหรือข้อมูลส่วนตัว</li>
  <li>ภาพจากกล้องไม่ถูกบันทึก</li>
</ul>`;

/* ---------- หน้า 2: อ่านผลอย่างไร ---------- */
const p2 = `
<h2 class="h2">อ่านผังดวงอย่างไร</h2>
<div class="split">
  <div class="split__fig">${plateSvg(sampleValues, { labels: true, lead: sampleLead })}
    <p class="cap">ตัวอย่างผังดวงจากการตอบจริงชุดหนึ่ง</p>
  </div>
  <div class="split__body">
    <p>ผังดวงมีหกแกน แต่ละแกนคือความสนใจด้านหนึ่งของงานไอที ยิ่งจุดบนแกนใดอยู่ห่างจากศูนย์กลาง แปลว่าคำตอบของคุณเอนไปทางนั้นมาก</p>
    <p><b>จุดสีแดงคือแกนที่เด่นที่สุด</b> และเป็นตัวกำหนดชื่อผลลัพธ์ที่ได้</p>
    <p>รูปที่กว้างเท่ากันเกือบทุกด้านไม่ใช่เรื่องผิด แปลว่าคุณสนใจหลายด้านใกล้เคียงกัน ซึ่งพบได้บ่อยในผู้ที่ยังไม่เคยลองงานสายนี้มาก่อน</p>
  </div>
</div>

<h2 class="h2">หกแกนคืออะไร</h2>
<table class="axes">
${AXES.map(k => `<tr><th>${esc(PATHS[k].axis)}</th><td>${esc(PATHS[k].tagline)}</td></tr>`).join("")}
</table>

<h2 class="h2">ตัวเลขเปอร์เซ็นต์มาจากไหน</h2>
<p class="body">แต่ละแกนมีคะแนนเต็มไม่เท่ากัน เพราะบางแกนถูกกล่าวถึงในตัวเลือกมากกว่าแกนอื่นโดยธรรมชาติของคำถาม
ระบบจึงหารคะแนนที่ได้ด้วยคะแนนเต็มของแกนนั้นก่อนเปรียบเทียบเสมอ ตัวเลขที่เห็นจึงเทียบกันได้ตรง ๆ
และไม่มีสายใดได้เปรียบเพียงเพราะปรากฏในตัวเลือกบ่อยกว่า</p>

<div class="note">
  <b class="note__t">ผลนี้บอกอะไรไม่ได้บ้าง</b>
  <p>นี่คือแบบสำรวจ<b>ความสนใจ</b> ไม่ใช่การวัดความสามารถหรือการทดสอบทางจิตวิทยา
  ผลที่ได้บอกว่าคำตอบวันนี้เอนไปทางใด ไม่ได้บอกว่าคุณเหมาะหรือไม่เหมาะกับสายงานใด
  ความสนใจเปลี่ยนได้เมื่อได้ลองทำจริง และทุกสายในผังดวงนี้เรียนได้ในหลักสูตรเดียวกัน</p>
</div>`;

/* ---------- หน้า 3: หกสายอาชีพ ---------- */
const p3 = `
<h2 class="h2">สายอาชีพทั้ง 6 แกน</h2>
<p class="body">แต่ละตราคือผังดวงอันเดียวกัน ที่ยื่นออกเพียงแกนเดียว</p>
<div class="cards">
${AXES.map((k, i) => {
  const p = PATHS[k];
  return `<div class="card">
    <div class="card__glyph">${glyphSvg(i)}</div>
    <div class="card__body">
      <b class="card__name">${esc(p.name)}</b>
      <p class="card__tag">${esc(p.tagline)}</p>
      <p class="card__meta"><span class="lbl">อาชีพ</span> ${esc(p.jobs.join(" · "))}</p>
      <p class="card__meta"><span class="lbl">วิชาที่เรียน</span> ${esc(p.study)}</p>
    </div>
  </div>`;
}).join("")}
</div>`;

/* ---------- หน้า 4: สำหรับเจ้าหน้าที่บูธ ---------- */
const p4 = `
<h2 class="h2">สำหรับเจ้าหน้าที่บูธ</h2>

<h3 class="h3">เตรียมก่อนเปิดงาน</h3>
<ol class="checks">
  <li>เปิดลิงก์บนเครื่องบูธหนึ่งครั้งขณะที่ยังมีอินเทอร์เน็ต เพื่อให้ระบบเก็บไฟล์ทั้งหมดไว้ในเครื่อง</li>
  <li>กดปุ่ม <b>โหมดบูธ</b> มุมขวาบน เริ่มทำแบบสำรวจหนึ่งข้อ แล้วกดอนุญาตให้ใช้กล้องเมื่อเบราว์เซอร์ถาม รอจนโมเดลโหลดครบ — ทำครั้งเดียวจบ</li>
  <li>เปิดแผง <b>บันทึกผู้เข้าร่วม</b> แล้วกด <b>ล้างข้อมูล</b> เพื่อไม่ให้ยอดทดสอบปนกับยอดจริง</li>
  <li>ลองเล่นหนึ่งรอบให้ครบทุกขั้น ชูนิ้วทีละจำนวนตั้งแต่หนึ่งถึงห้า ตรวจว่าตัวเลขกลางจอตรงกับที่ชูจริงในแสงของห้องนั้น</li>
  <li>ถ้ากล้องเครื่องบูธหันเข้าหาทางเดิน ให้หมุนกล้องหรือตั้งฉากกั้น ไม่ให้คนที่เดินผ่านยื่นมือเข้ามาในกรอบภาพ</li>
  <li>วางป้าย QR ให้สูงระดับสายตา หลีกเลี่ยงจุดที่มีแสงสะท้อนลงบนป้าย</li>
</ol>

<h3 class="h3">การนับนิ้วทำงานอย่างไร</h3>
<p class="body">ระบบใช้โมเดลตรวจจับข้อต่อมือ 21 จุดต่อมือหนึ่งข้าง แล้ววัดมุมที่ข้อกลางนิ้วเพื่อตัดสินว่านิ้วใดเหยียดอยู่
การวัดด้วยมุมทำให้ไม่ต้องยกมือตั้งฉากกับกล้อง เอียงมือหรือหมุนข้อมือก็ยังนับได้</p>
<p class="body">โครงมือที่วาดทับภาพไม่ได้มีไว้ให้ดูสวยอย่างเดียว
<b>ปลายนิ้วที่ระบบนับว่าเหยียดจะเป็นจุดสีแดง</b> ถ้านับผิดจะเห็นทันทีว่าเป็นเพราะนิ้วไหน
แนะนำให้บอกผู้เล่นชูมือให้เห็นเต็มฝ่ามือ กางนิ้วออกจากกัน และอย่าให้มืออยู่ใกล้กล้องจนล้นกรอบ</p>
<p class="body">โมเดลทำงานในเครื่องผู้เล่นทั้งหมด ไม่มีภาพถูกส่งออกไปที่ใด
ไฟล์โมเดลราวแปดเมกะไบต์จะถูกดาวน์โหลดครั้งแรกครั้งเดียวแล้วเก็บไว้ในเครื่อง</p>
<p class="body"><b>แตะหน้าจอเลือกคำตอบได้เสมอ</b> ระหว่างที่โมเดลกำลังโหลด หรือเมื่อแสงไม่เอื้อ
ให้บอกผู้เล่นแตะเลือกได้เลย ไม่ต้องรอ</p>

<h3 class="h3">คีย์ลัด</h3>
${kv([
  ["1 – 6", "เลือกคำตอบข้อที่ระบุ"],
  ["Backspace", "ย้อนกลับหนึ่งข้อ"],
  ["Space", "ข้ามฉากประมวลผลไปดูผลเลย"],
  ["L", "เปิดแผงบันทึกผู้เข้าร่วม"],
  ["Esc", "เริ่มรอบใหม่ หรือปิดแผงบันทึก"]
])}
<p class="fine">คีย์ลัดอ่านจากตำแหน่งปุ่มจริง จึงยังใช้ได้แม้เครื่องค้างอยู่โหมดภาษาไทย</p>

<h3 class="h3">แผงบันทึกผู้เข้าร่วม</h3>
<p class="body">กดปุ่ม <b>บันทึกผู้เข้าร่วม</b> ด้านล่างสุดของหน้า หรือกดปุ่ม <b>L</b>
แผงจะแสดงยอดวันนี้ ยอดรวม เวลาเฉลี่ยต่อคน ผลที่พบบ่อยที่สุด และการกระจายของผลลัพธ์ทั้งหกสาย
กด <b>ดาวน์โหลด CSV</b> เพื่อเอาไปทำรายงานต่อ ไฟล์เปิดใน Excel ได้โดยภาษาไทยไม่เพี้ยน</p>
<div class="note">
  <b class="note__t">ข้อมูลผูกกับเครื่องและเบราว์เซอร์นั้น</b>
  <p>บันทึกเก็บอยู่ในเครื่องที่เล่นเท่านั้น ไม่มีการส่งขึ้นเซิร์ฟเวอร์และไม่รวมข้ามเครื่อง
  ยอดจากมือถือของนักเรียนที่สแกน QR จะไม่ปรากฏบนเครื่องบูธ
  ถ้าต้องการยอดรวมของงาน ให้ดาวน์โหลด CSV จากทุกเครื่องบูธแล้วนำมารวมกันเอง
  และอย่าล้างข้อมูลจนกว่าจะดาวน์โหลดเรียบร้อย</p>
</div>`;

/* ---------- หน้า 5: แก้ปัญหาเฉพาะหน้า ---------- */
const trouble = [
  ["กล้องไม่ขึ้นภาพ หรือขึ้นว่าไม่ได้รับอนุญาต",
   "เบราว์เซอร์อนุญาตให้ใช้กล้องเฉพาะเว็บที่เปิดผ่าน https หรือ localhost เท่านั้น และสิทธิ์อาจเคยถูกปฏิเสธไว้",
   "ตรวจว่าที่อยู่ขึ้นต้นด้วย https แล้วกดไอคอนรูปกุญแจข้างช่องที่อยู่ เลือกอนุญาตกล้อง จากนั้นกดปุ่มลองเปิดกล้องอีกครั้ง"],
  ["แถบกำลังเตรียมกล้องค้างอยู่นาน",
   "กำลังดาวน์โหลดไฟล์โมเดลราวแปดเมกะไบต์ ครั้งแรกครั้งเดียว ถ้าสัญญาณในงานช้าจะใช้เวลาสักครู่",
   "ให้ผู้เล่นแตะเลือกคำตอบไปก่อนได้เลย ไม่ต้องรอ กล้องจะพร้อมใช้เองเมื่อโหลดเสร็จ ส่วนเครื่องบูธควรโหลดให้เสร็จตั้งแต่ก่อนเปิดงาน"],
  ["ตัวเลขกลางจอไม่ตรงกับจำนวนนิ้วที่ชู",
   "นิ้วบางนิ้วงอไม่พอหรือเหยียดไม่สุด หรือนิ้วติดกันจนโมเดลแยกไม่ออก",
   "ดูจุดสีแดงที่ปลายนิ้วในภาพ จะเห็นทันทีว่านิ้วไหนถูกนับผิด บอกผู้เล่นกางนิ้วออกจากกันและเหยียดให้สุด ถ้ายังไม่ตรงให้กำมือแล้วเริ่มชูใหม่"],
  ["ตัวเลขกระพริบไปมา เลือกไม่ติดสักที",
   "มืออยู่ใกล้ขอบภาพหรือใกล้กล้องเกินไป ทำให้โมเดลจับ ๆ หลุด ๆ",
   "ถอยห่างจากกล้องให้เห็นทั้งฝ่ามือและข้อมือในกรอบ แล้วถือนิ่ง ระบบจะรอจนท่าเดิมค้างครบจึงนับ"],
  ["ระบบนับนิ้วของคนที่เดินผ่านด้วย",
   "มีมือมากกว่าหนึ่งคู่อยู่ในกรอบภาพ ระบบรับได้สองมือและนับรวมกันเพื่อรองรับข้อที่มีหกตัวเลือก",
   "ตั้งฉากกั้นหรือหมุนกล้องไม่ให้ทางเดินอยู่ในกรอบ และบอกผู้เล่นให้ยืนตรงกลางหน้าจอ"],
  ["อินเทอร์เน็ตหลุดกลางงาน",
   "แอปเก็บไฟล์ไว้ในเครื่องตั้งแต่เปิดครั้งแรกอยู่แล้ว รวมถึงไฟล์โมเดลหลังใช้กล้องไปแล้วหนึ่งครั้ง",
   "เครื่องที่เคยเล่นจบรอบแล้วยังใช้กล้องได้ตามปกติ ส่วนมือถือที่เพิ่งสแกน QR ครั้งแรกจะเปิดไม่ได้จนกว่าสัญญาณจะกลับมา"],
  ["ตัวหนังสือเล็กเกินไปสำหรับจอบูธ",
   "เครื่องอยู่ในโหมดมือถือ ซึ่งตั้งขนาดไว้สำหรับระยะมือถือ",
   "กดปุ่มโหมดบูธมุมขวาบน ตัวอักษรจะใหญ่ขึ้นและตัวเลือกจะเรียงสองคอลัมน์บนจอกว้าง"],
  ["หน้าจอสว่างจ้าเกินไปในห้องมืด หรือมืดเกินไปในที่แจ้ง",
   "ธีมเริ่มต้นเป็นโทนกลางคืน",
   "กดปุ่มกลางวัน หรือกลางคืน มุมขวาบนเพื่อสลับ ระบบจะจำค่าไว้ให้ในเครื่องนั้น"],
  ["แก้ไขคำถามแล้วแต่หน้าเว็บยังเป็นของเดิม",
   "เครื่องยังใช้ไฟล์ชุดเก่าที่เก็บไว้ตอนเปิดครั้งก่อน",
   "โหลดหน้าใหม่สองครั้ง หรือปิดแท็บแล้วเปิดใหม่ ระบบจะสลับไปใช้ชุดล่าสุดให้เอง"]
];

const p5 = `
<h2 class="h2">แก้ปัญหาเฉพาะหน้า</h2>
<div class="trouble">
${trouble.map(([sym, why, fix]) => `
  <div class="tr">
    <b class="tr__sym">${esc(sym)}</b>
    <p class="tr__why"><span class="lbl">สาเหตุ</span> ${esc(why)}</p>
    <p class="tr__fix"><span class="lbl lbl--fix">วิธีแก้</span> ${esc(fix)}</p>
  </div>`).join("")}
</div>`;

/* ---------- หน้า 6+: ภาคผนวก ---------- */
const p6 = `
<h2 class="h2">ภาคผนวก · ชุดคำถามและเกณฑ์คะแนน</h2>
<p class="body">สำหรับอาจารย์และผู้ดูแลกิจกรรม ตัวเลขท้ายแต่ละตัวเลือกคือคะแนนที่เพิ่มให้แกนนั้น</p>

<table class="ceil">
  <tr><th>แกน</th>${AXES.map(k => `<td>${esc(PATHS[k].axis)}</td>`).join("")}</tr>
  <tr><th>คะแนนเต็ม</th>${AXES.map(k => `<td class="mono">${CEILING[k]}</td>`).join("")}</tr>
</table>
<p class="fine">คะแนนเต็มไม่เท่ากันโดยธรรมชาติของคำถาม ระบบจึงหารด้วยคะแนนเต็มของแกนนั้นก่อนจัดอันดับเสมอ</p>

<div class="qs">
${QUESTIONS.map((q, qi) => `
  <div class="q">
    <p class="q__domain">ข้อ ${qi + 1} · ${esc(q.domain)}</p>
    <p class="q__stem">${esc(q.stem)}</p>
    <ol class="q__opts">
      ${q.options.map((o, oi) => `
        <li><span class="q__n">${oi + 1}</span>
          <span class="q__text">${esc(o.text)}</span>
          <span class="q__score">${Object.entries(o.score)
            .map(([k, v]) => `${esc(PATHS[k].axis)}&nbsp;+${v}`).join(" · ")}</span>
        </li>`).join("")}
    </ol>
  </div>`).join("")}
</div>`;

/* ---------- ประกอบเอกสาร ---------- */
const css = `
${fontFaces}
*{box-sizing:border-box;margin:0;padding:0}
@page{size:A4;margin:0}
html{-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{font-family:"Plex Thai",sans-serif;color:${INK};font-size:10.2pt;line-height:1.68;background:#fff}
ul,ol{list-style:none}

.page{width:210mm;height:297mm;padding:15mm 17mm 12mm;display:flex;flex-direction:column;
  break-after:page;position:relative;overflow:hidden}
.page:last-child{break-after:auto}
.page--flow{height:auto;min-height:297mm}

.ph{display:flex;align-items:center;gap:7px;padding-bottom:3mm;margin-bottom:6mm;
  border-bottom:.5pt solid ${RULE}}
.ph__mark svg{width:15px;height:15px;display:block}
.ph__title{flex:1;font-size:8pt;letter-spacing:.06em;color:${INK_SOFT}}
.ph__num{font-family:"Plex Mono",monospace;font-size:8pt;color:${BRASS}}
.pf{margin-top:auto;padding-top:4mm;border-top:.5pt solid ${RULE};
  font-size:7.4pt;color:${INK_SOFT};text-align:center}

.eyebrow{font-size:8.4pt;letter-spacing:.09em;color:${BRASS};margin-bottom:2mm}
.cover{text-align:center;padding-bottom:5mm;margin-bottom:5mm;border-bottom:.5pt solid ${RULE}}
.cover__title{font-family:"Display",sans-serif;font-weight:700;letter-spacing:-.02em;font-size:34pt;line-height:1.1}
.cover__title em{font-style:normal;color:${BRASS}}
.cover__sub{font-size:11pt;color:${INK_SOFT};margin-top:1.5mm}
.cover__plate{width:52mm;margin:4mm auto 0}
.cover__plate svg{width:100%;height:auto;display:block}

.h2{font-family:"Display",sans-serif;font-weight:700;letter-spacing:-.02em;font-size:15pt;color:${BRASS};
  margin-bottom:3mm;line-height:1.3}
.h3{font-family:"Display",sans-serif;font-weight:700;letter-spacing:-.02em;font-size:11.5pt;
  margin:6mm 0 2.5mm;line-height:1.35}
.body{margin-bottom:2.5mm}
.fine{font-size:8.6pt;color:${INK_SOFT};margin-top:1.5mm}
.lbl{display:inline-block;font-size:7.8pt;font-weight:600;letter-spacing:.05em;
  color:${BRASS};margin-right:3px}
.lbl--fix{color:${VERMEIL}}
.mono{font-family:"Plex Mono",monospace}

.steps{display:grid;gap:3.4mm;margin-bottom:6mm}
.step{display:flex;gap:4mm;align-items:flex-start}
.step__n{flex:0 0 7mm;height:7mm;border-radius:50%;background:${BRASS};color:#fff;
  display:grid;place-items:center;font-family:"Plex Mono",monospace;font-size:9pt}
.step__t{display:block;font-size:11pt;font-weight:600;line-height:1.4}
.step__d{color:${INK_SOFT};font-size:9.8pt}

.poses{display:grid;grid-template-columns:repeat(6,1fr);gap:2.5mm;margin-bottom:2mm}
.pose{border:.5pt solid ${RULE};border-radius:2mm;padding:2mm 1mm;text-align:center}
.pose__art{height:19mm;display:flex;align-items:center;justify-content:center;gap:.5mm}
.pose__art svg{height:100%;width:auto}
.pose__art--pair svg{height:78%}
.pose figcaption{margin-top:1mm;line-height:1.3}
.pose figcaption b{display:block;font-family:"Plex Mono",monospace;font-size:11pt;color:${BRASS}}
.pose figcaption span{font-size:6.8pt;color:${INK_SOFT}}

.facts{display:flex;flex-wrap:wrap;gap:2mm;margin-top:auto}
.facts li{font-size:8.6pt;color:${INK_SOFT};border:.5pt solid ${RULE};
  border-radius:99mm;padding:1mm 4mm}

.split{display:grid;grid-template-columns:54mm 1fr;gap:7mm;align-items:start;margin-bottom:6mm}
.split__fig svg{width:100%;height:auto;display:block}
.split__body p{margin-bottom:2.2mm}
.cap{font-size:8pt;color:${INK_SOFT};text-align:center;margin-top:2mm}

.axes{width:100%;border-collapse:collapse;margin-bottom:6mm}
.axes th{text-align:left;font-weight:600;color:${BRASS};width:24mm;vertical-align:top;
  padding:1.6mm 0;font-size:9.8pt}
.axes td{padding:1.6mm 0;color:${INK_SOFT};font-size:9.8pt;border-bottom:.5pt solid ${RULE}}
.axes tr:last-child td{border-bottom:0}

.note{border-left:2pt solid ${VERMEIL};padding:2.5mm 0 2.5mm 4mm;margin-top:auto}
.note__t{display:block;font-size:10.4pt;font-weight:600;margin-bottom:1mm}
.note p{font-size:9.6pt;color:${INK_SOFT}}

.cards{display:grid;gap:3.2mm}
.card{display:grid;grid-template-columns:16mm 1fr;gap:4mm;align-items:start;
  border:.5pt solid ${RULE};border-radius:2mm;padding:3.4mm}
.card__glyph svg{width:100%;height:auto;display:block}
.card__name{font-family:"Display",sans-serif;font-weight:700;letter-spacing:-.02em;font-size:12pt;color:${BRASS};
  display:block;line-height:1.35}
.card__tag{font-size:9.4pt;margin:.6mm 0 1.6mm}
.card__meta{font-size:8.8pt;color:${INK_SOFT};line-height:1.55}

.checks{display:grid;gap:2mm;counter-reset:c;margin-bottom:2mm}
.checks li{position:relative;padding-left:7mm;counter-increment:c;font-size:9.8pt}
.checks li::before{content:counter(c);position:absolute;left:0;top:.3mm;
  width:5mm;height:5mm;border:.5pt solid ${BRASS};border-radius:50%;color:${BRASS};
  display:grid;place-items:center;font-family:"Plex Mono",monospace;font-size:7.6pt}

.kv{width:100%;border-collapse:collapse}
.kv th{text-align:left;width:26mm;padding:1.4mm 0;font-family:"Plex Mono",monospace;
  font-size:9pt;color:${BRASS};font-weight:400;vertical-align:top}
.kv td{padding:1.4mm 0;font-size:9.6pt;border-bottom:.5pt solid ${RULE}}
.kv tr:last-child td{border-bottom:0}

.trouble{display:grid;gap:3mm}
.tr{border:.5pt solid ${RULE};border-radius:2mm;padding:3mm 3.5mm;break-inside:avoid}
.tr__sym{display:block;font-size:10.4pt;font-weight:600;margin-bottom:1.2mm;line-height:1.4}
.tr__why,.tr__fix{font-size:9.2pt;color:${INK_SOFT};line-height:1.6}

.ceil{width:100%;border-collapse:collapse;margin-bottom:1mm}
.ceil th{text-align:left;font-size:9pt;color:${BRASS};padding:1.4mm 2mm 1.4mm 0;width:22mm}
.ceil td{text-align:center;font-size:9pt;padding:1.4mm 1mm;border:.5pt solid ${RULE}}

.qs{display:grid;gap:4mm;margin-top:5mm}
.q{break-inside:avoid}
.q__domain{font-size:8.4pt;letter-spacing:.05em;color:${BRASS};font-weight:600}
.q__stem{font-family:"Display",sans-serif;font-weight:700;letter-spacing:-.02em;font-size:11pt;line-height:1.4;
  margin:.6mm 0 1.8mm}
.q__opts{display:grid;gap:1.4mm}
.q__opts li{display:grid;grid-template-columns:5mm 1fr;gap:2mm;align-items:start;font-size:9.2pt}
.q__n{font-family:"Plex Mono",monospace;font-size:8pt;color:${INK_SOFT};padding-top:.4mm}
.q__text{line-height:1.55}
.q__score{grid-column:2;font-family:"Plex Mono",monospace;font-size:7.8pt;color:${BRASS}}
`;

const html = `<!DOCTYPE html>
<html lang="th"><head><meta charset="utf-8">
<title>คู่มือกิจกรรม ผังดวงอาชีพ</title>
<style>${css}</style></head><body>
${page(1, "วิธีเล่น", p1)}
${page(2, "อ่านผลอย่างไร", p2)}
${page(3, "สายอาชีพทั้ง 6", p3)}
${page(4, "สำหรับเจ้าหน้าที่บูธ", p4)}
${page(5, "แก้ปัญหาเฉพาะหน้า", p5)}
<section class="page page--flow">
  <header class="ph"><span class="ph__mark">${sealSvg}</span>
    <span class="ph__title">ภาคผนวก</span><span class="ph__num">6</span></header>
  ${p6}
  <footer class="pf">ผังดวงอาชีพ · แม่หมอ VR · หลักสูตรเทคโนโลยีสารสนเทศ มทร.ล้านนา ลำปาง</footer>
</section>
</body></html>`;

mkdirSync(OUT_DIR, { recursive: true });
const htmlPath = resolve(OUT_DIR, "manual.html");
writeFileSync(htmlPath, html);

/* ---------- เรนเดอร์เป็น PDF ด้วย Chrome ที่มีอยู่ในเครื่อง ---------- */
const CANDIDATES = [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "/usr/bin/google-chrome", "/usr/bin/chromium", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
];
const browser = CANDIDATES.find(p => existsSync(p));
const pdfPath = resolve(OUT_DIR, "คู่มือผังดวงอาชีพ.pdf");

if (!browser) {
  console.log(`สร้าง ${htmlPath} แล้ว`);
  console.log("ไม่พบ Chrome หรือ Edge ในเครื่อง — เปิดไฟล์ HTML แล้วสั่งพิมพ์เป็น PDF เองได้เลย");
  process.exit(0);
}

execFileSync(browser, [
  "--headless",
  "--disable-gpu",
  "--no-sandbox",
  "--no-pdf-header-footer",
  "--virtual-time-budget=15000",     // รอให้ฟอนต์และ SVG เรนเดอร์เสร็จก่อนพิมพ์
  `--print-to-pdf=${pdfPath}`,
  pathToFileURL(htmlPath).href
], { stdio: "pipe" });

const kb = (statSync(pdfPath).size / 1024).toFixed(0);
console.log(`สร้างคู่มือแล้ว: ${pdfPath} (${kb} KB)`);
console.log(`ต้นฉบับ HTML: ${htmlPath}`);
