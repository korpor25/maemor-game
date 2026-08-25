"use client";

/* เวทีกล้อง — วิธีเลือกคำตอบหลักของกิจกรรมนี้
   ชูนิ้วกี่นิ้ว = เลือกข้อนั้น ค้างท่าเดิมไว้จนวงแหวนเต็มจึงยืนยัน

   คอมโพเนนต์นี้ถือ HandCounter ไว้ตลอดอายุของหน้า ไม่สร้างใหม่ทุกข้อ
   เพราะการเปิดกล้องและโหลดโมเดลใหม่ทุกครั้งจะทำให้ผู้เล่นรอซ้ำ ๆ โดยไม่จำเป็น */

import { useEffect, useRef, useState, useCallback } from "react";
import { HandCounter, prefetchModel, HAND_BONES } from "@/lib/hands";

const VEIL = {
  loading: ["กำลังเตรียมกล้อง", "ระหว่างนี้แตะเลือกคำตอบได้เลย"],
  denied: ["ยังไม่ได้อนุญาตให้ใช้กล้อง", "แตะเลือกคำตอบได้ตามปกติ"],
  failed: ["เครื่องนี้ใช้กล้องนับนิ้วไม่ได้", "แตะเลือกคำตอบได้ตามปกติ"],
  off: ["ปิดกล้องอยู่", "แตะเลือกคำตอบได้ตามปกติ"]
};

export default function CameraStage({ active, optionCount, onPick, enabled, onAimChange }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const handsRef = useRef(null);
  const bootRef = useRef(null);

  const [phase, setPhase] = useState("loading");   // loading | live | denied | failed | off
  const [progress, setProgress] = useState(0);
  const [tally, setTally] = useState({ count: 0, progress: 0, armed: false });

  /* ---- วาดโครงมือทับภาพ ----
     ปลายนิ้วที่ระบบนับว่าเหยียดเป็นจุดสีสัญญาณ
     ถ้าไม่วาดส่วนนี้ เวลานับผิดผู้เล่นจะไม่รู้เลยว่าปัญหาอยู่ที่นิ้วไหน */
  const drawSkeleton = useCallback(frame => {
    const cv = canvasRef.current;
    const v = videoRef.current;
    if (!cv || !v) return;
    const rect = v.getBoundingClientRect();
    if (!rect.width) return;
    const dpr = Math.min(2, devicePixelRatio || 1);
    const w = Math.round(rect.width * dpr), h = Math.round(rect.height * dpr);
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }

    const ctx = cv.getContext("2d");
    ctx.clearRect(0, 0, w, h);
    if (!frame?.hands?.length) return;

    for (const hand of frame.hands) {
      const lm = hand.landmarks;
      ctx.strokeStyle = "rgba(255,255,255,.92)";
      ctx.lineWidth = Math.max(2, w / 260);
      ctx.lineCap = "round";
      for (const [a, b] of HAND_BONES) {
        ctx.beginPath();
        ctx.moveTo(lm[a].x * w, lm[a].y * h);
        ctx.lineTo(lm[b].x * w, lm[b].y * h);
        ctx.stroke();
      }
      [4, 8, 12, 16, 20].forEach((tip, i) => {
        const up = hand.fingers[i];
        ctx.fillStyle = up ? "#4D8CFF" : "rgba(255,255,255,.42)";
        ctx.beginPath();
        ctx.arc(lm[tip].x * w, lm[tip].y * h, up ? w / 58 : w / 120, 0, Math.PI * 2);
        ctx.fill();
      });
    }
  }, []);

  /* ---- สร้างตัวนับนิ้วครั้งเดียว ---- */
  useEffect(() => {
    const h = new HandCounter({
      onFrame: drawSkeleton,
      onProgress: p => {
        const armed = p.seen && p.count >= 1 && !p.locked;
        setTally({ count: p.count, progress: p.progress, armed });
        onAimChange?.(armed && p.progress > 0 ? p.count : 0);
      },
      onPick: count => onPick(count - 1),      // ชู n นิ้ว = ตัวเลือกที่ n
      onStatus: kind => {
        if (kind === "denied") setPhase("denied");
        if (kind === "failed") setPhase("failed");
      }
    });
    handsRef.current = h;
    return () => { h.closeCamera(); handsRef.current = null; };
  }, [drawSkeleton, onPick, onAimChange]);

  /* ---- เปิดกล้องและโหลดโมเดลพร้อมกัน ----
     ระหว่างนี้ตัวเลือกที่แตะได้ยังใช้งานได้ตลอด
     ไม่มีใครถูกบังคับให้รอโมเดลแปดเมกะไบต์ */
  const boot = useCallback(() => {
    if (bootRef.current) return bootRef.current;
    const h = handsRef.current;
    if (!h) return Promise.resolve(false);
    setPhase("loading"); setProgress(0);
    bootRef.current = (async () => {
      if (!(await h.openCamera(videoRef.current))) { setPhase("denied"); return false; }
      if (!(await prefetchModel(p => setProgress(p)))) { setPhase("failed"); return false; }
      try { await h.load(); } catch { setPhase("failed"); return false; }
      setPhase("live");
      return true;
    })().finally(() => { bootRef.current = null; });
    return bootRef.current;
  }, []);

  /* ---- เดินลูปเฉพาะตอนอยู่หน้าคำถามจริง ---- */
  useEffect(() => {
    const h = handsRef.current;
    if (!h) return;
    if (!enabled) { h.stop(); h.closeCamera(); setPhase("off"); return; }
    if (!active) { h.stop(); return; }

    if (h.ready) {
      h.setRange(optionCount);
      h.start();
      setPhase("live");
      return () => h.stop();
    }
    let cancelled = false;
    boot().then(ok => {
      if (ok && !cancelled) { h.setRange(optionCount); h.start(); }
    });
    return () => { cancelled = true; h.stop(); };
  }, [active, enabled, optionCount, boot]);

  const veil = phase !== "live" ? (VEIL[phase] || VEIL.loading) : null;
  const dash = 283 - 283 * (tally.armed ? tally.progress : 0);

  return (
    <div className="cam">
      <div className="cam__stage">
        <video className="cam__video" ref={videoRef} autoPlay muted playsInline aria-hidden="true" />
        <canvas className="cam__skeleton" ref={canvasRef} aria-hidden="true" />

        <div className={`tally${tally.armed ? " is-armed" : " is-idle"}`} aria-hidden="true">
          <svg className="tally__ring" viewBox="0 0 100 100">
            <circle className="tally__track" cx="50" cy="50" r="45" />
            <circle className="tally__fill" cx="50" cy="50" r="45" style={{ strokeDashoffset: dash }} />
          </svg>
          <span className="tally__num">{tally.armed ? tally.count : "—"}</span>
        </div>

        {veil && (
          <div className="cam__veil">
            <div className="cam__veil-in">
              <p className="tag" style={{ color: "#fff" }}>{veil[0]}</p>
              {phase === "loading" && (
                <div className="cam__bar"><i style={{ width: `${Math.round(progress * 100)}%` }} /></div>
              )}
              <p className="fine" style={{ color: "rgba(255,255,255,.72)" }}>{veil[1]}</p>
              {(phase === "denied" || phase === "failed") && (
                <button className="btn btn--sm" onClick={boot}>ลองเปิดกล้องอีกครั้ง</button>
              )}
            </div>
          </div>
        )}
      </div>

      <p className="fine cam__hint">
        {phase === "live"
          ? "ชูนิ้วให้ตรงกับหมายเลขคำตอบ แล้วค้างไว้จนวงแหวนเต็ม"
          : "ระหว่างนี้แตะเลือกคำตอบได้เลย"}
      </p>
    </div>
  );
}
