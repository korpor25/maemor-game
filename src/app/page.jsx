"use client";

/* ============================================================
   ตัวควบคุมหลัก — ถือสถานะของรอบการเล่นทั้งหมดไว้ที่เดียว
   ฉากย่อยรับค่าลงไปอย่างเดียว ไม่มีฉากไหนเก็บสถานะของตัวเอง
   ============================================================ */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { PATHS, QUESTIONS, AXES } from "@/lib/data";
import { tally, rank, normalise } from "@/lib/score";
import { appendLog } from "@/lib/stats";
import { GridOverlay, Cursor } from "@/components/Chrome";
import Intro from "@/components/screens/Intro";
import Survey from "@/components/screens/Survey";
import Cast from "@/components/screens/Cast";
import Result from "@/components/screens/Result";
import Paths from "@/components/screens/Paths";
import Panel from "@/components/Panel";
import Tutorial from "@/components/Tutorial";
import Icon from "@/components/Icon";

/* ฉาก 3D ใช้ WebGL จึงต้องรันฝั่งเบราว์เซอร์เท่านั้น
   และโหลดแยกก้อน เพื่อไม่ให้ไปถ่วงการแสดงตัวอักษรครั้งแรก */
const Scene3D = dynamic(() => import("@/components/Scene3D"), { ssr: false });

const AXIS_LABELS = AXES.map(k => PATHS[k].axis);
const PREFS = "phangduang.prefs.v2";
const TUT_SEEN = "phangduang.tutorial.v1";

export default function Page() {
  const [screen, setScreen] = useState("intro");
  const [answers, setAnswers] = useState([]);
  const [theme, setTheme] = useState("day");
  const [mode, setMode] = useState("phone");
  const [camOn, setCamOn] = useState(true);
  const [panelOpen, setPanelOpen] = useState(false);
  const [tutOpen, setTutOpen] = useState(false);
  const [aim, setAim] = useState(0);
  const [online, setOnline] = useState(true);
  const [ready3D, setReady3D] = useState(false);
  const startedAt = useRef(Date.now());
  const picking = useRef(false);

  /* ---------- คะแนน ---------- */
  const totals = useMemo(() => tally(answers), [answers]);
  const values = useMemo(() => normalise(totals.scores), [totals]);
  const ranked = useMemo(() => rank(totals), [totals]);
  const winner = ranked[0];

  /* ---------- ค่าที่จำไว้ในเครื่อง ---------- */
  useEffect(() => {
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem(PREFS)) || {}; } catch { /* ใช้ค่าเริ่มต้น */ }
    const url = new URLSearchParams(location.search);
    setTheme(url.get("theme") || saved.theme || "day");
    setMode(url.get("mode") || saved.mode || "phone");
    if (saved.camOn === false) setCamOn(false);
    /* รอให้ตัวอักษรและเนื้อหาขึ้นก่อน แล้วค่อยเริ่มฉาก 3D
       ผู้ที่สแกน QR มาจะได้อ่านได้ทันทีโดยไม่ต้องรอ WebGL */
    const t = setTimeout(() => setReady3D(true), 400);
    return () => clearTimeout(t);
  }, []);

  /* บอก CSS ว่ากำลังอยู่ฉากไหน หน้าคำถามต้องล็อกความสูงให้พอดีจอ
     ส่วนฉากอื่นปล่อยให้เลื่อนได้ตามเนื้อหา */
  useEffect(() => { document.documentElement.dataset.screen = screen; }, [screen]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.mode = mode;
    document.querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", theme === "night" ? "#070A11" : "#BDD8EF");
    try { localStorage.setItem(PREFS, JSON.stringify({ theme, mode, camOn })); } catch { /* ไม่สำคัญพอจะขวางผู้เล่น */ }
  }, [theme, mode, camOn]);

  useEffect(() => {
    const sync = () => setOnline(navigator.onLine);
    sync();
    addEventListener("online", sync);
    addEventListener("offline", sync);
    return () => { removeEventListener("online", sync); removeEventListener("offline", sync); };
  }, []);

  /* ---------- service worker ---------- */
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => { /* ออฟไลน์จะไม่พร้อม แต่แอปยังเล่นได้ */ });
    }
  }, []);

  /* ---------- ลำดับการเล่น ----------
     ข้อปัจจุบันคำนวณจากจำนวนคำตอบที่มีอยู่ ไม่เก็บเป็นสถานะแยก
     เคยแยกเก็บแล้วต้องซิงก์สองตัวให้ตรงกัน ซึ่งบังคับให้ต้องเรียก setState
     ข้างใน updater ของอีกตัว — ผิดกฎที่ว่า updater ต้องบริสุทธิ์
     และทำให้กดเลือกคำตอบแล้วโจทย์ไม่เปลี่ยน */
  const done = answers.length >= QUESTIONS.length;
  const qi = Math.min(answers.length, QUESTIONS.length - 1);

  const start = useCallback(() => {
    setAnswers([]); setAim(0);
    startedAt.current = Date.now();
    /* ครั้งแรกของเครื่องนี้ให้ดูวิธีเล่นก่อน ครั้งต่อไปเข้าเล่นได้เลย
       ที่บูธมีคนต่อคิว การบังคับดูซ้ำทุกรอบจะทำให้คิวเดินช้า */
    let seen = false;
    try { seen = localStorage.getItem(TUT_SEEN) === "1"; } catch { /* ถือว่ายังไม่เคยดู */ }
    if (!seen) setTutOpen(true);
    setScreen("survey");
  }, []);

  const closeTutorial = useCallback(() => {
    setTutOpen(false);
    try { localStorage.setItem(TUT_SEEN, "1"); } catch { /* ไม่สำคัญพอจะขวางผู้เล่น */ }
  }, []);

  const pick = useCallback(index => {
    if (picking.current) return;
    picking.current = true;
    setAnswers(prev => {
      if (prev.length >= QUESTIONS.length) return prev;
      const q = QUESTIONS[prev.length];
      if (!q || index < 0 || index >= q.options.length) return prev;
      return [...prev, index];
    });
    setAim(0);
    setTimeout(() => { picking.current = false; }, 240);
  }, []);

  const back = useCallback(() => setAnswers(prev => prev.slice(0, -1)), []);

  /* ตอบครบแล้วจึงเข้าฉากประมวลผล แยกเป็น effect ไม่ผูกไว้ในตัวจัดการคลิก */
  useEffect(() => {
    if (done && screen === "survey") setScreen("cast");
  }, [done, screen]);

  const finishCast = useCallback(() => {
    setScreen(s => {
      if (s !== "cast") return s;
      appendLog({ pathKey: winner, seconds: Math.round((Date.now() - startedAt.current) / 1000) });
      return "result";
    });
  }, [winner]);

  const restart = useCallback(() => {
    setAnswers([]); setAim(0); setScreen("intro");
  }, []);

  /* ---------- แป้นพิมพ์ ----------
     ใช้ e.code ไม่ใช่ e.key เพราะ e.key ให้อักษรไทยเมื่อเครื่องค้างโหมดภาษาไทย
     แล้วคีย์ลัดทั้งหมดจะใช้ไม่ได้เลย */
  useEffect(() => {
    const onKey = e => {
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      if (tutOpen) return;                       // บทเรียนจัดการปุ่ม Escape ของตัวเอง
      if (panelOpen) { if (e.code === "Escape") setPanelOpen(false); return; }
      if (e.code === "KeyL") { setPanelOpen(true); return; }
      if (e.code === "KeyC") { setCamOn(v => !v); return; }
      if (e.code === "Escape" && screen !== "intro") { restart(); return; }
      if (screen === "survey") {
        const m = /^(?:Digit|Numpad)([1-5])$/.exec(e.code);
        if (m) { pick(+m[1] - 1); return; }
        if (e.code === "Backspace") { e.preventDefault(); back(); }
      }
      if (screen === "cast" && (e.code === "Space" || e.code === "Enter")) finishCast();
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [screen, panelOpen, tutOpen, pick, back, restart, finishCast]);

  /* ---------- กลับหน้าแรกเองเมื่อไม่มีคนเล่นต่อ (เฉพาะโหมดบูธ) ---------- */
  useEffect(() => {
    if (mode !== "kiosk") return;
    if (screen !== "result" && screen !== "paths") return;
    const id = setTimeout(restart, 60000);
    const poke = () => { clearTimeout(id); };
    addEventListener("pointerdown", poke, { once: true, passive: true });
    return () => { clearTimeout(id); removeEventListener("pointerdown", poke); };
  }, [screen, mode, restart]);

  /* ฉาก 3D ขึ้นเฉพาะตอนประมวลผล ซึ่งเป็นจังหวะเดียวที่ไม่มีอะไรให้อ่าน
     หน้าอื่นวัตถุลอยไปแย่งสายตาจากเนื้อหา และหน้าคำถามต้องการการ์ดจอไปให้กล้อง
     ผลพลอยได้: three.js ไม่ถูกดึงมาตอนเปิดครั้งแรก คนที่สแกน QR มาจึงโหลดเบา */
  const show3D = ready3D && screen === "cast";

  return (
    <>
      {show3D && <Scene3D theme={theme} quality={mode === "kiosk" ? "high" : "low"} />}
      <GridOverlay />
      <Cursor />

      <div className="app">
        <header className="bar">
          <button className="brand" onClick={restart} aria-label="กลับหน้าแรก" title="กลับหน้าแรก">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <rect x="1.5" y="1.5" width="21" height="21" fill="none" stroke="currentColor" strokeWidth="1" />
              <polygon points="12,4.5 18.5,8.25 18.5,15.75 12,19.5 5.5,15.75 5.5,8.25"
                       fill="none" stroke="currentColor" strokeWidth="1.4" />
              <circle cx="12" cy="12" r="2" fill="currentColor" />
            </svg>
            <span className="brand__text">ผังดวงอาชีพ</span>
          </button>
          <span className="bar__gap" />

          {/* ปุ่มบนแถบใช้ไอคอนนำ แล้วมีคำกำกับบนจอกว้าง
              ไอคอนอย่างเดียวบนจอแคบยังเดาออกเพราะเป็นสัญลักษณ์ที่คุ้นกันทั่วไป */}
          <button className="navbtn" onClick={() => setTutOpen(true)} title="วิธีเล่น">
            <Icon name="help" /><span className="navbtn__t">วิธีเล่น</span>
          </button>

          <button
            className="navbtn"
            onClick={() => setTheme(t => (t === "night" ? "day" : "night"))}
            title={theme === "night" ? "เปลี่ยนเป็นโหมดกลางวัน" : "เปลี่ยนเป็นโหมดกลางคืน"}
          >
            <Icon name={theme === "night" ? "sun" : "moon"} />
            <span className="navbtn__t">{theme === "night" ? "กลางวัน" : "กลางคืน"}</span>
          </button>

          {/* เปิดปิดกล้องได้จากทุกหน้า ไม่ต้องรอเข้าไปถึงหน้าคำถามก่อน
              บางคนไม่สะดวกให้กล้องทำงาน จะได้ปิดไว้ตั้งแต่ยังไม่เริ่มเล่น

              เน้นสีตอน "ปิด" ไม่ใช่ตอน "เปิด" เพราะเปิดคือค่าปกติของเกมนี้
              ถ้าเน้นตอนเปิด ปุ่มจะสว่างค้างอยู่ทุกหน้าโดยไม่ได้บอกอะไรใหม่ */}
          <button
            className={`navbtn${camOn ? "" : " is-off"}`}
            onClick={() => setCamOn(v => !v)}
            title={camOn ? "ปิดกล้อง แล้วตอบด้วยการแตะ" : "เปิดกล้อง เพื่อตอบด้วยการชูนิ้ว"}
            aria-pressed={camOn}
          >
            <Icon name={camOn ? "cam" : "camoff"} /><span className="navbtn__t">กล้อง</span>
          </button>

          <button
            className={`navbtn${mode === "kiosk" ? " is-on" : ""}`}
            onClick={() => setMode(m => (m === "kiosk" ? "phone" : "kiosk"))}
            title={mode === "kiosk" ? "ออกจากโหมดบูธ" : "เข้าโหมดบูธ"}
            aria-pressed={mode === "kiosk"}
          >
            <Icon name="booth" /><span className="navbtn__t">โหมดบูธ</span>
          </button>

          {!online && <span className="code bar__net">offline</span>}

          <button className="navbtn" onClick={() => setPanelOpen(true)} title="บันทึกผู้เข้าร่วม">
            <Icon name="log" /><span className="navbtn__t">บันทึก</span>
          </button>
        </header>

        <main className="main">
          {screen === "intro" && (
            <Intro labels={AXIS_LABELS} onStart={start} onPaths={() => setScreen("paths")} />
          )}
          {screen === "survey" && (
            <Survey
              qi={qi} values={values} labels={AXIS_LABELS} aim={aim}
              camOn={camOn} onToggleCam={() => setCamOn(v => !v)}
              onPick={pick} onBack={back} onAim={setAim}
            />
          )}
          {screen === "cast" && (
            <Cast values={values} labels={AXIS_LABELS} onDone={finishCast} />
          )}
          {screen === "result" && (
            <Result
              values={values} labels={AXIS_LABELS} ranked={ranked}
              scores={totals.scores} winner={winner}
              onAgain={start} onPaths={() => setScreen("paths")}
            />
          )}
          {screen === "paths" && (
            <Paths onBack={() => setScreen(answers.length >= QUESTIONS.length ? "result" : "intro")} />
          )}
        </main>

      </div>

      {panelOpen && <Panel onClose={() => setPanelOpen(false)} />}
      {tutOpen && <Tutorial onClose={closeTutorial} />}
    </>
  );
}
