/* ============================================================
   บันทึกผู้เข้าร่วมแบบไม่ระบุตัวตน + แผงสถิติสำหรับเจ้าหน้าที่บูธ
   เก็บใน localStorage ของเครื่องนั้นเท่านั้น ไม่มีการส่งออก
   เก็บเฉพาะ: วันที่ เวลา หมายเลขรอบที่ระบบสร้าง ผลลัพธ์ และเวลาที่ใช้
   ============================================================ */

import { PATHS, AXES } from "./data.js";

const KEY = "phangduang.log.v1";

const two = n => String(n).padStart(2, "0");
const dateKey = d => `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`;

export const readLog = () => {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY));
    return Array.isArray(raw) ? raw : [];
  } catch { return []; }
};

/** บันทึกหนึ่งรอบ คืนค่ารายการที่เพิ่ง push เพื่อให้ผู้เรียกใช้ต่อได้ */
export function appendLog({ pathKey, seconds }) {
  const log = readLog();
  const now = new Date();
  const date = dateKey(now);
  const seq = log.filter(r => r.date === date).length + 1;
  const row = {
    sid: `S-${date.replace(/-/g, "")}-${two(seq)}`,
    date,
    time: `${two(now.getHours())}:${two(now.getMinutes())}:${two(now.getSeconds())}`,
    path: pathKey,
    seconds
  };
  log.push(row);
  try { localStorage.setItem(KEY, JSON.stringify(log)); } catch { /* โควตาเต็ม — ข้ามไป ไม่ขวางผู้เล่น */ }
  return row;
}

export function clearLog() {
  try { localStorage.removeItem(KEY); } catch { /* ไม่มีอะไรต้องทำต่อ */ }
}

/** สรุปตัวเลขทั้งหมดที่แผงสถิติต้องใช้ ในรอบเดียว */
export function summarise(log = readLog()) {
  const today = dateKey(new Date());
  const counts = Object.fromEntries(AXES.map(k => [k, 0]));
  let totalSeconds = 0;
  for (const r of log) {
    if (r.path in counts) counts[r.path]++;
    totalSeconds += r.seconds || 0;
  }
  const ranked = AXES.slice().sort((a, b) => counts[b] - counts[a]);
  const maxCount = counts[ranked[0]] || 0;
  return {
    today: log.filter(r => r.date === today).length,
    all: log.length,
    days: new Set(log.map(r => r.date)).size,
    avgSeconds: log.length ? Math.round(totalSeconds / log.length) : 0,
    top: maxCount > 0 ? ranked[0] : null,
    counts, ranked, maxCount
  };
}

const fmtDuration = s => s >= 60 ? `${Math.floor(s / 60)} นาที ${s % 60} วินาที` : `${s} วินาที`;

/** วาดแผงสถิติทั้งหน้าจากข้อมูลปัจจุบัน */
export function renderPanel(root) {
  const log = readLog();
  const s = summarise(log);
  const $ = id => root.querySelector(`#${id}`);

  $("statToday").textContent = s.today;
  $("statAll").textContent = s.all;
  $("statAvg").textContent = s.avgSeconds ? `${s.avgSeconds}s` : "—";
  $("statTop").textContent = s.top ? PATHS[s.top].name : "—";

  /* การกระจายผลลัพธ์ — บอกเจ้าหน้าที่ได้ทันทีว่าชุดคำถามให้ผลเอียงไปทางใดไหม */
  $("dist").replaceChildren(...AXES.map(k => {
    const n = s.counts[k];
    const pct = s.all ? (n / s.all * 100) : 0;
    const row = document.createElement("div");
    row.className = "dist__row";
    row.innerHTML =
      `<span class="dist__name"></span>` +
      `<span class="dist__track"><span class="dist__fill"></span></span>` +
      `<span class="dist__n"></span>`;
    row.querySelector(".dist__name").textContent = PATHS[k].axis;
    row.querySelector(".dist__fill").style.width =
      (s.maxCount ? n / s.maxCount * 100 : 0).toFixed(1) + "%";
    row.querySelector(".dist__n").textContent = s.all ? `${n} · ${pct.toFixed(0)}%` : "0";
    return row;
  }));

  const body = $("logRows");
  if (!log.length) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 5;
    td.textContent = "ยังไม่มีผู้เข้าร่วมในเครื่องนี้";
    tr.append(td);
    body.replaceChildren(tr);
    return;
  }
  body.replaceChildren(...log.slice().reverse().slice(0, 200).map(r => {
    const tr = document.createElement("tr");
    for (const [text, mono] of [
      [r.date, true], [r.time, true], [r.sid, true],
      [PATHS[r.path]?.name || r.path, false], [fmtDuration(r.seconds || 0), true]
    ]) {
      const td = document.createElement("td");
      if (mono) td.className = "num";
      td.textContent = text;
      tr.append(td);
    }
    return tr;
  }));
}

/** ส่งออก CSV พร้อม BOM เพื่อให้ Excel ภาษาไทยเปิดแล้วไม่เป็นอักษรเพี้ยน */
export function downloadCsv() {
  const rows = [
    ["session_id", "date", "time", "path_key", "path_name", "duration_sec"],
    ...readLog().map(r => [r.sid, r.date, r.time, r.path, PATHS[r.path]?.name || "", r.seconds])
  ];
  const csv = "\uFEFF" + rows
    .map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(","))
    .join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `phangduang-log-${dateKey(new Date())}.csv`;
  document.body.append(a);          // Safari ไม่ยอมดาวน์โหลดถ้าลิงก์ยังไม่อยู่ในเอกสาร
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);   // ปล่อย blob คืน ไม่ปล่อยรั่วทั้งวัน
}
