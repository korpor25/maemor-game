/* เทสต์ว่าแอปบูตขึ้นได้และเล่นจนจบรอบได้ โดยไม่ต้องเปิดเบราว์เซอร์
   jsdom ไม่มีเอนจินวาดภาพ จึงต้องเติม getBBox / getTotalLength / canvas ให้เอง
   สิ่งที่เทสต์นี้จับได้คือข้อผิดพลาดตอนรันที่ทำให้หน้าจอว่างเปล่า
   ซึ่งเป็นอาการที่แย่ที่สุดที่จะไปเกิดหน้าบูธ */
import { JSDOM } from "jsdom";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const html = readFileSync("app/public/index.html", "utf8");

const dom = new JSDOM(html, {
  url: "https://example.test/",
  pretendToBeVisual: true,
  runScripts: "outside-only"
});
const { window } = dom;

/* ---- เติมสิ่งที่ jsdom ไม่มี ---- */
const g = window;
g.matchMedia = () => ({ matches: false, addEventListener() { }, removeEventListener() { } });
g.SVGElement.prototype.getBBox = () => ({ x: 0, y: 0, width: 100, height: 100 });
g.SVGElement.prototype.getTotalLength = () => 420;
g.HTMLCanvasElement.prototype.getContext = () => ({
  drawImage() { }, clearRect() { }, beginPath() { }, moveTo() { }, lineTo() { },
  stroke() { }, fill() { }, arc() { },
  getImageData: (x, y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4) })
});
g.navigator.mediaDevices = { getUserMedia: async () => { throw new Error("no camera in test"); } };
g.HTMLMediaElement.prototype.play = async () => { };
g.document.fonts = { ready: Promise.resolve() };      // jsdom ไม่มี Font Loading API
g.Element.prototype.animate = () => ({ finished: Promise.resolve(), cancel() { } });
g.URL.createObjectURL = () => "blob:test";
g.URL.revokeObjectURL = () => { };
g.confirm = () => true;
g.scrollTo = () => { };

/* เก็บทุก error ที่หลุดออกมา แล้วสรุปทีเดียวตอนจบ */
const errors = [];
g.addEventListener("error", e => errors.push("window.error: " + (e.error?.stack || e.message)));
g.addEventListener("unhandledrejection", e => errors.push("unhandledrejection: " + e.reason));
const origError = console.error;
console.error = (...a) => { errors.push("console.error: " + a.join(" ")); origError(...a); };

/* ---- ให้โมดูลของแอปมองเห็น DOM ของ jsdom ----
   Node 24 ทำ globalThis.navigator เป็น getter อย่างเดียว จึงกำหนดค่าตรง ๆ ไม่ได้
   ต้องใช้ defineProperty ทับทุกตัวเพื่อความสม่ำเสมอ */
const define = (key, value) =>
  Object.defineProperty(globalThis, key, { value, writable: true, configurable: true });

define("window", g);
define("document", g.document);
define("navigator", g.navigator);
define("location", g.location);
define("localStorage", g.localStorage);
define("matchMedia", g.matchMedia);
define("confirm", g.confirm);
define("scrollTo", g.scrollTo);
define("getComputedStyle", g.getComputedStyle.bind(g));
define("Blob", g.Blob);
define("URL", g.URL);
define("Element", g.Element);
define("Node", g.Node);
define("SVGElement", g.SVGElement);
define("HTMLCanvasElement", g.HTMLCanvasElement);
define("addEventListener", g.addEventListener.bind(g));
define("removeEventListener", g.removeEventListener.bind(g));
define("requestAnimationFrame", cb => setTimeout(() => cb(performance.now()), 16));
define("cancelAnimationFrame", id => clearTimeout(id));
/* ไม่แตะ performance ของ Node — performance ของ jsdom จะเรียกกลับหาตัวเองจนสแตกล้น */

const step = (label, fn) => {
  try { fn(); console.log("  ✓ " + label); }
  catch (err) { errors.push(`${label}: ${err.stack}`); console.log("  ✗ " + label); }
};
const wait = ms => new Promise(r => setTimeout(r, ms));

console.log("โหลดโมดูลหลัก");
await import(pathToFileURL("app/public/src/app.js").href);
await wait(120);

const $ = id => g.document.getElementById(id);
const active = () => g.document.querySelector(".screen.is-active")?.id;

console.log("\nตรวจสถานะหลังบูต");
step("ฉากเปิดแสดงอยู่", () => {
  if (active() !== "screen-intro") throw new Error("ฉากที่แสดงคือ " + active());
});
step("แผ่นผังดวงหน้าเปิดถูกวาด", () => {
  const n = $("plateIntro").querySelectorAll("polygon").length;
  if (n < 5) throw new Error("มี polygon แค่ " + n);
});
step("กริดเชิงเทคนิคถูกวาด", () => {
  /* jsdom ไม่จัดหน้าจริง clientWidth จึงเป็นศูนย์และกริดจะข้ามการวาด
     สิ่งที่ตรวจได้คือโครง svg ถูกสร้างไว้แล้ว ไม่ได้ตายตอน mount */
  const svg = $("grid").querySelector("svg");
  if (!svg) throw new Error("ไม่มี svg ในชั้นกริด");
});
step("แถบสถานะล่างเดินจริง", () => {
  if (!/^GMT[+−]\d+ · \d\d:\d\d:\d\d$/.test($("teleClock").textContent))
    throw new Error("นาฬิกาไม่ถูกรูปแบบ: " + $("teleClock").textContent);
  if (!$("teleCoords").textContent.includes("X")) throw new Error("ไม่มีพิกัดเมาส์");
});

console.log("\nเล่นจนจบรอบ");
step("กดเริ่ม", () => $("btnStart").click());
await wait(60);
step("เข้าสู่ฉากคำถาม", () => {
  if (active() !== "screen-survey") throw new Error("ฉากที่แสดงคือ " + active());
});

for (let q = 1; q <= 6; q++) {
  const choices = $("choices").querySelectorAll("button");
  step(`ข้อ ${q} มี ${choices.length} ตัวเลือก`, () => {
    if (!choices.length) throw new Error("ไม่มีตัวเลือก");
    choices[q % choices.length].click();
  });
  await wait(420);
}

/* ฉากประมวลผลมีแอนิเมชันยาว กดข้ามเพื่อไม่ให้เทสต์รอเปล่า */
await wait(100);
if (active() === "screen-cast") { $("screen-cast").click(); await wait(120); }

console.log("\nตรวจหน้าผลลัพธ์");
step("เข้าสู่ฉากผลลัพธ์", () => {
  if (active() !== "screen-result") throw new Error("ฉากที่แสดงคือ " + active());
});
step("มีชื่อสายอาชีพ", () => {
  const t = $("resultName").textContent.trim();
  if (!t) throw new Error("ชื่อว่าง");
  console.log("      ผลที่ได้: " + t);
});
step("มีคำอธิบายครบทุกช่อง", () => {
  for (const id of ["resultTagline", "resultReading", "resultFit", "resultStudy"]) {
    if (!$(id).textContent.trim()) throw new Error(id + " ว่าง");
  }
});
step("แถบคะแนนครบ 6 แกน", () => {
  const rows = $("resultAxes").querySelectorAll(".axis-row");
  if (rows.length !== 6) throw new Error("มี " + rows.length + " แถว");
  const pcts = [...rows].map(r => +r.dataset.pct);
  if (pcts.some(p => Number.isNaN(p) || p < 0 || p > 100)) throw new Error("เปอร์เซ็นต์ผิดช่วง: " + pcts);
  if (pcts.some((p, i) => i && p > pcts[i - 1])) throw new Error("ไม่ได้เรียงจากมากไปน้อย: " + pcts);
  console.log("      คะแนนรายแกน: " + pcts.join(" / "));
});
step("มีอาชีพและจุดแข็ง", () => {
  if (!$("resultJobs").children.length) throw new Error("ไม่มีอาชีพ");
  if (!$("resultStrengths").children.length) throw new Error("ไม่มีจุดแข็ง");
});
step("บันทึกลงประวัติแล้ว", () => {
  const log = JSON.parse(g.localStorage.getItem("phangduang.log.v1") || "[]");
  if (log.length !== 1) throw new Error("มี " + log.length + " รายการ");
  if (!log[0].sid || !log[0].path) throw new Error("รายการไม่ครบถ้วน");
});

console.log("\nตรวจหน้าอื่น");
step("หน้ารวมหกสายเปิดได้", () => {
  $("btnPaths").click();
  if ($("pathsList").children.length !== 6) throw new Error("มี " + $("pathsList").children.length + " รายการ");
});
await wait(60);
step("แผงสถิติเปิดได้และมีตัวเลข", () => {
  $("btnPanel").click();
  if ($("panel").classList.contains("u-hidden")) throw new Error("แผงไม่เปิด");
  if ($("statAll").textContent !== "1") throw new Error("ยอดรวมเป็น " + $("statAll").textContent);
  if ($("dist").children.length !== 6) throw new Error("แถบกระจายไม่ครบ 6");
  if (!g.document.querySelector(".app").inert) throw new Error("พื้นหลังไม่ถูกตั้งเป็น inert");
});
step("แผงสถิติปิดได้", () => {
  $("btnPanelClose").click();
  if (!$("panel").classList.contains("u-hidden")) throw new Error("แผงไม่ปิด");
  if (g.document.querySelector(".app").inert) throw new Error("inert ไม่ถูกถอดออก");
});
step("สลับธีมได้", () => {
  const before = g.document.documentElement.dataset.theme;
  $("btnTheme").click();
  if (g.document.documentElement.dataset.theme === before) throw new Error("ธีมไม่เปลี่ยน");
});
step("สลับโหมดบูธได้", () => {
  $("btnKiosk").click();
  if (g.document.documentElement.dataset.mode !== "kiosk") throw new Error("โหมดไม่เปลี่ยน");
  if ($("cam").classList.contains("u-hidden")) throw new Error("กล่องกล้องไม่แสดงในโหมดบูธ");
});
/* เล่นจนจบอีกรอบขณะอยู่โหมดบูธ
   เคยมีบั๊กตรงนี้: syncCamera อ่าน QUESTIONS[state.qi] โดยไม่ตรวจขอบเขต
   พอตอบครบ state.qi เท่ากับจำนวนข้อพอดี แอปจึงพังตอนเข้าฉากประมวลผล
   ซึ่งเป็นเส้นทางที่นักเรียนทุกคนที่บูธต้องเดินผ่าน */
console.log("\nเล่นจนจบอีกรอบในโหมดบูธ");
await wait(80);
step("เริ่มรอบใหม่ได้", () => {
  $("btnAgain").click();
  if (active() !== "screen-survey") throw new Error("ฉากที่แสดงคือ " + active());
});
await wait(80);
const errorsBeforeKiosk = errors.length;
for (let q = 1; q <= 6; q++) {
  const choices = $("choices").querySelectorAll("button");
  step(`โหมดบูธ ข้อ ${q}`, () => {
    if (!choices.length) throw new Error("ไม่มีตัวเลือก");
    choices[0].click();
  });
  await wait(420);
}
await wait(120);
if (active() === "screen-cast") { $("screen-cast").click(); await wait(150); }
step("จบรอบในโหมดบูธได้โดยไม่มี error", () => {
  if (active() !== "screen-result") throw new Error("ฉากที่แสดงคือ " + active());
  if (errors.length > errorsBeforeKiosk) throw new Error("มี error เกิดขึ้นระหว่างรอบนี้");
});
step("เวทีกล้องแสดงอยู่ทั้งสองโหมด", () => {
  $("btnAgain").click();
  if ($("cam").classList.contains("u-hidden")) throw new Error("เวทีกล้องถูกซ่อนในโหมดบูธ");
  $("btnKiosk").click();                       // กลับเป็นโหมดมือถือ
  if ($("cam").classList.contains("u-hidden")) throw new Error("เวทีกล้องถูกซ่อนในโหมดมือถือ");
});
step("กล้องถูกปฏิเสธแล้วยังเล่นต่อได้", () => {
  /* เทสต์นี้ไม่มีกล้อง getUserMedia จึงโยน error ตั้งแต่ต้น
     ม่านต้องบอกผู้เล่นว่าเกิดอะไรขึ้น และตัวเลือกที่แตะได้ต้องยังใช้งานได้ */
  if ($("camVeil").classList.contains("is-gone")) throw new Error("ม่านถูกซ่อนทั้งที่กล้องใช้ไม่ได้");
  if (!$("camVeilTitle").textContent.trim()) throw new Error("ม่านไม่มีข้อความอธิบาย");
  if (!$("choices").children.length) throw new Error("ไม่มีตัวเลือกให้แตะ");
});
step("ปิดและเปิดกล้องได้", () => {
  $("btnCamToggle").click();
  if (!$("cam").classList.contains("u-hidden")) throw new Error("ปิดกล้องแล้วเวทียังแสดงอยู่");
  $("btnCamToggle").click();
  if ($("cam").classList.contains("u-hidden")) throw new Error("เปิดกล้องแล้วเวทีไม่กลับมา");
});

console.log();
if (errors.length) {
  console.log(`พบข้อผิดพลาด ${errors.length} รายการ:`);
  errors.forEach(e => console.log("  · " + e.split("\n").slice(0, 3).join("\n    ")));
  process.exit(1);
}
console.log("แอปบูตและเล่นจนจบรอบได้ ไม่มีข้อผิดพลาดตอนรัน");
process.exit(0);
