/* ============================================================
   ผังดวงอาชีพ — ตัวควบคุมหลัก
   ผูกข้อมูล (data.js) เข้ากับแผ่นผังดวง (chart.js) กล้องนับนิ้ว (hands.js)
   และบันทึกบูธ (stats.js) แล้วคุมลำดับฉากทั้งหมด
   ============================================================ */

import { PATHS, QUESTIONS, AXES, CEILING } from "./data.js";
import { FateChart, renderPathGlyph } from "./chart.js";
import { mountGrid, mountCursor, mountTelemetry, mountParallax, magnetic, revealLines } from "./motion.js";
import { HandCounter, prefetchModel, HAND_BONES } from "./hands.js";
import { appendLog, clearLog, renderPanel, downloadCsv } from "./stats.js";

const $ = id => document.getElementById(id);
const root = document.documentElement;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const reduceMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

const AXIS_LABELS = AXES.map(k => PATHS[k].axis);

/* ---------- สถานะรอบปัจจุบัน ---------- */
const state = {
  qi: 0,
  scores: {},
  answers: [],
  lastGain: {},        // ข้อล่าสุดที่แต่ละแกนได้คะแนน ใช้ตัดสินเมื่อคะแนนเท่ากัน
  startedAt: 0,
  screen: "screen-intro",
  casting: false
};

function resetRun() {
  state.qi = 0;
  state.answers = [];
  state.scores = Object.fromEntries(AXES.map(k => [k, 0]));
  state.lastGain = Object.fromEntries(AXES.map(k => [k, -1]));
  state.startedAt = Date.now();
}
resetRun();

/* ---------- ชั้นบรรยากาศ ---------- */
mountGrid($("grid"));
mountCursor($("cursor"));
mountTelemetry({ clock: $("teleClock"), coords: $("teleCoords") });
mountParallax([...document.querySelectorAll("[data-orb]")]);

/* ---------- แผ่นผังดวงทั้งสี่ที่ ---------- */
const chartIntro  = new FateChart($("plateIntro"),  AXIS_LABELS, { labels: true });
const chartSurvey = new FateChart($("plateSurvey"), AXIS_LABELS, { labels: false, frame: false });
const chartCast   = new FateChart($("plateCast"),   AXIS_LABELS, { labels: true });
const chartResult = new FateChart($("plateResult"), AXIS_LABELS, { labels: true, values: true });

/* หน้าเปิดโชว์รูปทรงสมดุลจาง ๆ เพื่อให้เห็นว่าแผ่นนี้คืออะไรก่อนเริ่มตอบ */
chartIntro.setValues(new Array(AXES.length).fill(0.42), { duration: 1200 });

/* ---------- สลับฉาก ---------- */
function show(id) {
  if (state.screen === id) return;
  const cur = $(state.screen);
  const next = $(id);
  if (cur) {
    cur.classList.remove("is-active");
    cur.classList.add("is-leaving");
    setTimeout(() => cur.classList.remove("is-leaving"), 400);
  }
  /* ถ้าฉากนี้เพิ่งถูกสั่งให้จางออกแล้วถูกเรียกกลับมาทันที ต้องถอด is-leaving ก่อน
     ไม่งั้นจะติดทั้งสองคลาส และกฎ .is-leaving ที่อยู่ท้ายกว่าใน CSS จะชนะ
     ฉากที่เพิ่งเปิดจะจางหายไปเองต่อหน้าผู้เล่น */
  next.classList.remove("is-leaving");
  next.classList.add("is-active");
  state.screen = id;
  window.scrollTo({ top: 0, behavior: reduceMotion() ? "auto" : "smooth" });
  syncCamera();
  const target = next.querySelector("h1, h2");
  if (target) {
    target.setAttribute("tabindex", "-1");
    target.focus({ preventScroll: true });
  }
}

/* ---------- คะแนน ---------- */
/* normalize ด้วยเพดานของแต่ละแกนก่อนเสมอ ทุกแกนจึงแข่งบนสเกลเดียวกัน */
const normalised = () => AXES.map(k => state.scores[k] / CEILING[k]);

function rankedAxes() {
  return AXES.slice().sort((a, b) => {
    const d = (state.scores[b] / CEILING[b]) - (state.scores[a] / CEILING[a]);
    if (Math.abs(d) > 1e-9) return d;
    /* คะแนนเท่ากัน — ให้แกนที่ได้คะแนนจากข้อท้าย ๆ ชนะ
       คำถามท้ายถามเรื่องคุณค่าและลักษณะงาน ซึ่งบ่งชี้ความตั้งใจมากกว่าข้อต้น
       (ของเดิมใช้ลำดับที่ประกาศไว้ ผลจึงตกเป็นของแกนแรกเสมอ) */
    return state.lastGain[b] - state.lastGain[a];
  });
}

/* ---------- ฉากคำถาม ---------- */
function renderQuestion() {
  const q = QUESTIONS[state.qi];
  $("domain").textContent = q.domain;
  $("count").textContent = `ข้อ ${state.qi + 1} จาก ${QUESTIONS.length}`;

  $("ticks").replaceChildren(...QUESTIONS.map((_, i) => {
    const b = document.createElement("b");
    if (i < state.qi) b.className = "is-done";
    else if (i === state.qi) b.className = "is-here";
    return b;
  }));

  $("stem").textContent = q.stem;

  const box = $("choices");
  box.classList.remove("is-clearing");
  box.replaceChildren(...q.options.map((opt, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "choice";
    b.dataset.index = String(i);
    const key = document.createElement("span");
    key.className = "choice__key";
    key.setAttribute("aria-hidden", "true");
    key.textContent = String(i + 1);
    const text = document.createElement("span");
    text.className = "choice__text";
    text.textContent = opt.text;
    b.append(key, text);
    b.addEventListener("click", () => pick(i));
    return b;
  }));

  $("btnBack").classList.toggle("u-hidden", state.qi === 0);

  hands?.setRange(q.options.length);
  chartSurvey.setValues(normalised(), { duration: 480 });
}

let picking = false;
async function pick(index) {
  if (picking || state.screen !== "screen-survey") return;
  const q = QUESTIONS[state.qi];
  if (index < 0 || index >= q.options.length) return;
  picking = true;

  const chosen = $("choices").querySelector(`[data-index="${index}"]`);
  chosen?.classList.add("is-picked");

  state.answers[state.qi] = index;
  const gained = q.options[index].score;
  for (const k in gained) {
    state.scores[k] += gained[k];
    state.lastGain[k] = state.qi;
  }

  /* แกนที่เพิ่งได้คะแนนมากที่สุดวาบขึ้นมา ผู้ตอบจะเห็นว่าคำตอบมีผลจริง */
  const topGain = Object.keys(gained).sort((a, b) => gained[b] - gained[a])[0];
  if (topGain) chartSurvey.pulse(AXES.indexOf(topGain));
  chartSurvey.setValues(normalised(), { duration: 520 });

  $("choices").classList.add("is-clearing");
  await sleep(reduceMotion() ? 0 : 300);

  state.qi++;
  picking = false;
  if (state.qi < QUESTIONS.length) {
    renderQuestion();
    $("choices").querySelector("button")?.focus({ preventScroll: true });
  } else {
    runCast();
  }
}

function goBack() {
  if (state.qi === 0) return;
  state.qi--;
  const prev = state.answers[state.qi];
  const gained = QUESTIONS[state.qi].options[prev]?.score || {};
  for (const k in gained) state.scores[k] -= gained[k];
  /* คำนวณ lastGain ใหม่จากคำตอบที่ยังเหลืออยู่ ไม่งั้นตัวตัดสินเสมอจะค้างค่าเก่า */
  state.lastGain = Object.fromEntries(AXES.map(k => [k, -1]));
  for (let i = 0; i < state.qi; i++) {
    const s = QUESTIONS[i].options[state.answers[i]]?.score || {};
    for (const k in s) state.lastGain[k] = i;
  }
  state.answers.length = state.qi;
  renderQuestion();
}

/* ---------- ฉากประมวลผล ---------- */
const CAST_STEPS = ["รวมคะแนนรายแกน", "เทียบกับเพดานของแต่ละสาย", "จัดอันดับผลลัพธ์"];

async function runCast() {
  show("screen-cast");
  state.casting = true;
  chartCast.setLead(-1);
  chartCast.setValues(normalised(), { duration: 0 });

  if (reduceMotion()) {
    $("castStatus").textContent = CAST_STEPS.at(-1);
    finishCast();
    return;
  }

  for (let i = 0; i < CAST_STEPS.length && state.casting; i++) {
    $("castStatus").textContent = CAST_STEPS[i];
    await chartCast.sweep(1, 110);
    if (!state.casting) return;
  }
  if (!state.casting) return;
  await chartCast.setValues(normalised(), { duration: 700 });
  if (!state.casting) return;
  finishCast();
}

function finishCast() {
  if (!state.casting) return;
  state.casting = false;
  showResult();
}

/* ---------- ฉากผลลัพธ์ ---------- */
function showResult() {
  const ranked = rankedAxes();
  const winner = ranked[0];
  const path = PATHS[winner];
  const values = normalised();

  $("resultName").textContent = path.name;
  $("resultTagline").textContent = path.tagline;
  $("resultReading").textContent = path.reading;
  $("resultFit").textContent = path.fit;
  $("resultStudy").textContent = path.study;

  $("resultStrengths").replaceChildren(...path.strengths.map(s => {
    const li = document.createElement("li");
    li.textContent = s;
    return li;
  }));

  $("resultJobs").replaceChildren(...path.jobs.map(j => {
    const span = document.createElement("span");
    span.className = "chip";
    span.textContent = j;
    return span;
  }));

  $("resultAxes").replaceChildren(...ranked.map(k => {
    const pct = Math.round(state.scores[k] / CEILING[k] * 100);
    const row = document.createElement("div");
    row.className = "axis-row" + (k === winner ? " is-lead" : "");
    row.innerHTML =
      `<span class="axis-row__name"></span>` +
      `<span class="axis-row__track"><span class="axis-row__fill"></span></span>` +
      `<span class="axis-row__pct"></span>`;
    row.querySelector(".axis-row__name").textContent = PATHS[k].axis;
    row.querySelector(".axis-row__pct").textContent = pct + "%";
    row.dataset.pct = String(pct);
    return row;
  }));

  chartResult.setValues(values, { duration: 0 });
  chartResult.setLead(AXES.indexOf(winner));
  show("screen-result");
  chartResult.drawIn();

  /* แถบรายแกนไล่ขึ้นทีละเส้นหลังแผ่นผังดวงวาดเสร็จ */
  requestAnimationFrame(() => {
    $("resultAxes").querySelectorAll(".axis-row").forEach((row, i) => {
      setTimeout(() => {
        row.querySelector(".axis-row__fill").style.width = row.dataset.pct + "%";
      }, reduceMotion() ? 0 : 420 + i * 90);
    });
  });

  appendLog({ pathKey: winner, seconds: Math.round((Date.now() - state.startedAt) / 1000) });
  scheduleIdleReset();
}

/* ---------- หน้ารวมหกสาย ---------- */
function renderPaths() {
  $("pathsList").replaceChildren(...AXES.map((k, i) => {
    const p = PATHS[k];
    const row = document.createElement("div");
    row.className = "path-row";
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "path-row__glyph");
    svg.setAttribute("aria-hidden", "true");
    renderPathGlyph(svg, i, AXES.length);
    const body = document.createElement("div");
    const name = document.createElement("p");
    name.className = "path-row__name";
    name.textContent = p.name;
    const jobs = document.createElement("p");
    jobs.className = "path-row__jobs";
    jobs.textContent = p.jobs.join(" · ");
    const study = document.createElement("p");
    study.className = "path-row__study";
    study.textContent = "วิชาที่เกี่ยวข้อง: " + p.study;
    body.append(name, jobs, study);
    row.append(svg, body);
    return row;
  }));
}

/* ---------- กล้องนับนิ้ว — วิธีเลือกคำตอบหลักของกิจกรรมนี้ ---------- */
let hands = null;
let camWanted = true;
let camPhase = "idle";              // idle → loading → live | denied | failed | off
const skel = $("camSkeleton");
const skelCtx = skel.getContext("2d");

const VEIL = {
  loading: ["กำลังเตรียมกล้อง", "แตะเลือกคำตอบด้านล่างได้เลยระหว่างรอ"],
  denied:  ["ยังไม่ได้อนุญาตให้ใช้กล้อง", "แตะเลือกคำตอบด้านล่างได้ตามปกติ"],
  failed:  ["เครื่องนี้ใช้กล้องนับนิ้วไม่ได้", "แตะเลือกคำตอบด้านล่างได้ตามปกติ"],
  off:     ["ปิดกล้องอยู่", "แตะเลือกคำตอบด้านล่างได้ตามปกติ"]
};

function setVeil(phase, progress = null) {
  camPhase = phase;
  const veil = $("camVeil");
  if (phase === "live") { veil.classList.add("is-gone"); return; }
  veil.classList.remove("is-gone");
  const [title, note] = VEIL[phase] || VEIL.loading;
  $("camVeilTitle").textContent = title;
  $("camVeilNote").textContent = note;
  $("camBar").style.width = progress === null ? "0%" : Math.round(progress * 100) + "%";
  $("camBar").parentElement.classList.toggle("u-hidden", phase !== "loading");
  $("btnCamRetry").classList.toggle("u-hidden", phase !== "denied" && phase !== "failed");
}

/* วาดโครงมือทับภาพ ให้ผู้เล่นเห็นว่าระบบมองเห็นมืออยู่จริง
   ปลายนิ้วที่นับว่าเหยียดเป็นสีสัญญาณ นิ้วที่งอเป็นจุดจาง
   ถ้าไม่วาดส่วนนี้ เวลานับผิดผู้เล่นจะไม่รู้เลยว่าปัญหาอยู่ที่นิ้วไหน */
function drawSkeleton(frame) {
  const w = skel.width, h = skel.height;
  if (!w || !h) return;
  skelCtx.clearRect(0, 0, w, h);
  if (!frame?.hands?.length) return;

  const css = getComputedStyle(root);
  const brass = css.getPropertyValue("--brass").trim() || "#C9A227";
  const vermeil = css.getPropertyValue("--vermeil").trim() || "#F0708A";

  for (const hand of frame.hands) {
    const lm = hand.landmarks;
    skelCtx.strokeStyle = brass;
    skelCtx.lineWidth = Math.max(2, w / 220);
    skelCtx.lineCap = "round";
    for (const [a, b] of HAND_BONES) {
      skelCtx.beginPath();
      skelCtx.moveTo(lm[a].x * w, lm[a].y * h);
      skelCtx.lineTo(lm[b].x * w, lm[b].y * h);
      skelCtx.stroke();
    }
    [4, 8, 12, 16, 20].forEach((tip, i) => {
      const up = hand.fingers[i];
      skelCtx.fillStyle = up ? vermeil : "rgba(240,233,218,.45)";
      skelCtx.beginPath();
      skelCtx.arc(lm[tip].x * w, lm[tip].y * h, up ? w / 62 : w / 110, 0, Math.PI * 2);
      skelCtx.fill();
    });
  }
}

function sizeSkeleton() {
  const rect = $("camVideo").getBoundingClientRect();
  if (!rect.width) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  skel.width = Math.round(rect.width * dpr);
  skel.height = Math.round(rect.height * dpr);
}

function paintTally({ count, progress, seen, locked }) {
  const tally = $("tally");
  const armed = seen && count >= 1 && !locked;
  $("tallyNum").textContent = armed ? String(count) : "—";
  tally.classList.toggle("is-armed", armed && progress > 0);
  tally.classList.toggle("is-idle", !armed);
  $("tallyFill").style.strokeDashoffset = String(283 - 283 * (armed ? progress : 0));

  /* ตัวเลือกที่ตรงกับจำนวนนิ้วสว่างขึ้นทันที ผู้เล่นจึงรู้ว่าเลือกถูกก่อนค้างจนครบ */
  const kids = $("choices").children;
  for (let i = 0; i < kids.length; i++) {
    kids[i].classList.toggle("is-aimed", armed && i === count - 1);
  }
}

function ensureHands() {
  if (hands) return hands;
  hands = new HandCounter({
    onFrame: drawSkeleton,
    onProgress: paintTally,
    onPick(count) { pick(count - 1); },     // ชู n นิ้ว = ตัวเลือกที่ n
    onStatus(kind) {
      if (kind === "denied") setVeil("denied");
      if (kind === "failed") setVeil("failed");
    }
  });
  return hands;
}

/* เปิดกล้องและโหลดโมเดลไปพร้อมกัน แล้วเริ่มตรวจเมื่อทั้งสองอย่างพร้อม
   ระหว่างนี้ตัวเลือกที่แตะได้ยังใช้งานได้ตลอด ไม่มีใครถูกบังคับให้รอโมเดลแปดเมกะไบต์ */
let camBooting = null;
function bootCamera() {
  if (camBooting) return camBooting;
  const h = ensureHands();
  setVeil("loading", 0);
  camBooting = (async () => {
    if (!await h.openCamera($("camVideo"))) { setVeil("denied"); return false; }
    if (!await prefetchModel(p => { if (camPhase === "loading") setVeil("loading", p); })) {
      setVeil("failed");
      return false;
    }
    try { await h.load(); } catch { setVeil("failed"); return false; }
    sizeSkeleton();
    setVeil("live");
    return true;
  })().finally(() => { camBooting = null; });
  return camBooting;
}

function syncCamera() {
  const onSurvey = state.screen === "screen-survey";
  $("cam").classList.toggle("u-hidden", !camWanted);

  if (!camWanted || !onSurvey) { hands?.stop(); return; }

  sizeSkeleton();
  const arm = () => {
    hands.setRange(QUESTIONS[state.qi].options.length);
    hands.start();
  };
  if (hands?.ready) { arm(); setVeil("live"); return; }
  bootCamera().then(ok => { if (ok && state.screen === "screen-survey") arm(); });
}
/* ---------- โหมดและธีม ---------- */
const PREFS = "phangduang.prefs.v1";
const prefs = (() => {
  try { return JSON.parse(localStorage.getItem(PREFS)) || {}; } catch { return {}; }
})();
const savePrefs = () => {
  try { localStorage.setItem(PREFS, JSON.stringify(prefs)); } catch { /* ไม่สำคัญพอจะขวางผู้เล่น */ }
};

function applyTheme(theme) {
  root.dataset.theme = theme;
  prefs.theme = theme;
  savePrefs();
  /* ป้ายปุ่มบอกสถานะปัจจุบัน ไม่ใช่สิ่งที่จะเกิดขึ้นเมื่อกด
     อ่านได้เหมือนแถบสถานะของเครื่องมือ ไม่ใช่ปุ่มคำสั่ง */
  $("btnTheme").textContent = theme === "night" ? "THEME[NIGHT]" : "THEME[DAY]";
  document.querySelector('meta[name="theme-color"]')
    .setAttribute("content", theme === "night" ? "#0A0E16" : "#BED8EE");
}

function applyMode(mode) {
  root.dataset.mode = mode;
  prefs.mode = mode;
  savePrefs();
  $("btnKiosk").textContent = mode === "kiosk" ? "BOOTH[ON]" : "BOOTH[OFF]";
  syncCamera();
}

/* ?mode=kiosk ใน URL ชนะค่าที่จำไว้ ใช้ทำลิงก์แยกสำหรับเครื่องบูธได้ */
const params = new URLSearchParams(location.search);
applyTheme(params.get("theme") || prefs.theme || "day");
applyMode(params.get("mode") || prefs.mode || "phone");

/* ---------- คืนหน้าจอเองเมื่อไม่มีคนเล่นต่อ (เฉพาะโหมดบูธ) ---------- */
let idleTimer = 0;
function scheduleIdleReset() {
  clearTimeout(idleTimer);
  if (root.dataset.mode !== "kiosk") return;
  idleTimer = setTimeout(() => {
    if (state.screen === "screen-result" || state.screen === "screen-paths") restart();
  }, 60000);
}
["pointerdown", "keydown"].forEach(evt =>
  addEventListener(evt, () => { if (idleTimer) scheduleIdleReset(); }, { passive: true }));

/* ---------- ปุ่มทั้งหมด ---------- */
function startRun() {
  resetRun();
  renderQuestion();
  show("screen-survey");
  $("choices").querySelector("button")?.focus({ preventScroll: true });
}
function restart() {
  state.casting = false;
  clearTimeout(idleTimer);
  idleTimer = 0;
  resetRun();
  chartSurvey.setValues(normalised(), { duration: 0 });
  show("screen-intro");
}

$("btnStart").addEventListener("click", startRun);
$("btnAgain").addEventListener("click", startRun);
$("btnBack").addEventListener("click", goBack);
$("btnTheme").addEventListener("click", () => applyTheme(root.dataset.theme === "night" ? "day" : "night"));
[$("btnStart"), $("btnAgain")].forEach(b => magnetic(b));
$("btnKiosk").addEventListener("click", () => applyMode(root.dataset.mode === "kiosk" ? "phone" : "kiosk"));
$("btnPaths").addEventListener("click", () => { renderPaths(); show("screen-paths"); });
$("btnPathsFromIntro").addEventListener("click", () => { renderPaths(); show("screen-paths"); });
$("btnPathsBack").addEventListener("click", () => show(state.answers.length ? "screen-result" : "screen-intro"));

$("btnCamToggle").addEventListener("click", () => {
  camWanted = !camWanted;
  $("btnCamToggle").textContent = camWanted ? "CAM[ON]" : "CAM[OFF]";
  if (!camWanted) hands?.closeCamera();
  syncCamera();
});
$("btnCamRetry").addEventListener("click", () => { camBooting = null; syncCamera(); });

/* แตะที่ฉากประมวลผลเพื่อข้ามไปดูผลเลย — คิวที่บูธจะได้เดินเร็วขึ้น */
$("screen-cast").addEventListener("click", finishCast);

/* ---------- แผงสถิติ ---------- */
function openPanel() {
  renderPanel($("panel"));
  $("panel").classList.remove("u-hidden");
  /* inert กันไม่ให้แท็บหลุดไปโดนปุ่มที่อยู่ข้างหลังแผง
     aria-modal อย่างเดียวบอกแค่โปรแกรมอ่านหน้าจอ ไม่ได้ล็อกโฟกัสจริง */
  document.querySelector(".app").inert = true;
  $("btnPanelClose").focus({ preventScroll: true });
}
function closePanel() {
  $("panel").classList.add("u-hidden");
  document.querySelector(".app").inert = false;
  $("btnPanel").focus({ preventScroll: true });
}
const panelOpen = () => !$("panel").classList.contains("u-hidden");

$("btnPanel").addEventListener("click", openPanel);
$("btnPanelClose").addEventListener("click", closePanel);
$("btnCsv").addEventListener("click", downloadCsv);
$("btnClear").addEventListener("click", () => {
  if (confirm("ล้างบันทึกผู้เข้าร่วมทั้งหมดในเครื่องนี้?")) {
    clearLog();
    renderPanel($("panel"));
  }
});

/* ---------- แป้นพิมพ์ ----------
   ใช้ e.code ไม่ใช่ e.key เพราะ e.key จะให้อักษรไทยเมื่อเครื่องบูธค้างโหมดภาษาไทย
   แล้วคีย์ลัดทั้งหมดจะใช้ไม่ได้เลย */
addEventListener("keydown", e => {
  if (e.ctrlKey || e.altKey || e.metaKey) return;

  if (panelOpen()) {
    if (e.code === "Escape") closePanel();
    return;                                  // แผงเปิดอยู่ ห้ามคีย์ทะลุไปตอบคำถามข้างหลัง
  }
  if (e.code === "KeyL") { openPanel(); return; }
  if (e.code === "Escape" && state.screen !== "screen-intro") { restart(); return; }

  if (state.screen === "screen-survey") {
    const m = /^(?:Digit|Numpad)([1-6])$/.exec(e.code);
    if (m) { pick(+m[1] - 1); return; }
    if (e.code === "Backspace") { e.preventDefault(); goBack(); }
  }
  if (state.screen === "screen-cast" && (e.code === "Space" || e.code === "Enter")) finishCast();
});

/* ---------- สถานะออนไลน์ ---------- */
function syncNet() {
  $("netState").textContent = navigator.onLine ? "OFFLINE READY" : "OFFLINE";
}
addEventListener("online", syncNet);
addEventListener("offline", syncNet);
syncNet();

/* ---------- ติดตั้งเป็นแอป ---------- */
let installEvent = null;
addEventListener("beforeinstallprompt", e => {
  e.preventDefault();
  if (root.dataset.mode === "kiosk") return;      // เครื่องบูธไม่ต้องชวนติดตั้ง
  installEvent = e;
  showInstallBanner();
});

function showInstallBanner() {
  if (document.getElementById("install")) return;
  const bar = document.createElement("div");
  bar.className = "install";
  bar.id = "install";
  bar.innerHTML =
    `<span class="install__text">ติดตั้งไว้เล่นแบบออฟไลน์ได้</span>` +
    `<button class="btn btn--chip" id="btnInstallNo">ไม่ใช่ตอนนี้</button>` +
    `<button class="btn btn--chip" id="btnInstallYes">ติดตั้ง</button>`;
  document.body.append(bar);
  bar.querySelector("#btnInstallNo").addEventListener("click", () => bar.remove());
  bar.querySelector("#btnInstallYes").addEventListener("click", async () => {
    bar.remove();
    installEvent?.prompt();
    installEvent = null;
  });
}

/* ---------- service worker ---------- */
if ("serviceWorker" in navigator) {
  addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => { }));
}

/* กรอบภาพเปลี่ยนขนาด ต้องปรับความละเอียดของชั้นวาดโครงมือให้ตรงกัน */
addEventListener("resize", sizeSkeleton);

/* เตรียมโครงหน้าคำถามไว้ล่วงหน้า ตอนกดเริ่มจะได้ขึ้นทันทีโดยไม่กระพริบ
   ฉากเปิดถูกทำเป็น is-active ไว้ใน HTML แล้ว จึงไม่ต้องเรียก show() ซ้ำ */
renderQuestion();
syncCamera();
/* พาดหัวหน้าเปิดเผยตัวทีละบรรทัด ต้องรอให้ฟอนต์โหลดเสร็จก่อน
   ไม่งั้นการตัดบรรทัดจะคำนวณจากฟอนต์สำรองแล้วกลุ่มบรรทัดจะผิด
   document.fonts ไม่มีในเบราว์เซอร์เก่าบางตัว จึงต้องมีทางถอย
   ถ้าพลาดก็แค่ไม่มีแอนิเมชัน พาดหัวยังอ่านได้ตามปกติ */
const revealTitle = () => { try { revealLines($("introTitle")); } catch { /* ปล่อยเป็นข้อความนิ่ง */ } };
if (document.fonts?.ready) document.fonts.ready.then(revealTitle);
else addEventListener("load", revealTitle);
