"use client";

/* หน้าคำถาม — ต้องอยู่ในจอเดียวเสมอ ไม่มีการเลื่อน
   ผู้เล่นต้องอ่านโจทย์ อ่านตัวเลือก และเห็นภาพกล้องได้พร้อมกัน
   แล้วตอบด้วยการขยับมืออย่างเดียว

   วิธีที่ทำให้พอดีจอทุกกรณี: ตัวเลือกแบ่งความสูงที่เหลือเท่า ๆ กัน
   ข้อที่มีสี่ตัวเลือกจึงได้แถวสูง ข้อที่มีหกได้แถวเตี้ยลง แต่ไม่มีข้อไหนล้นจอ
   ถ้าตั้งความสูงตายตัวให้แต่ละแถว ข้อสุดท้ายที่มีหกตัวเลือกจะล้นทันที */

import { QUESTIONS } from "@/lib/data";
import CameraStage from "@/components/CameraStage";

export default function Survey({
  qi, aim, camOn, onToggleCam, onPick, onBack, onAim
}) {
  const q = QUESTIONS[qi];
  if (!q) return null;

  return (
    <section className="screen screen--fit survey">
      <div className="survey__bar">
        <p className="tag tag--blue">{q.domain}</p>
        <div className="ticks" aria-hidden="true">
          {QUESTIONS.map((_, i) => (
            <b key={i} className={i < qi ? "is-done" : i === qi ? "is-here" : ""} />
          ))}
        </div>
        <p className="code">{qi + 1} / {QUESTIONS.length}</p>
        {qi > 0 && <button className="btn-link" onClick={onBack}>ย้อนกลับ</button>}
        <button className="sw" onClick={onToggleCam}>cam[<b>{camOn ? "on" : "off"}</b>]</button>
      </div>

      <h2 className="survey__stem">{q.stem}</h2>

      <div className="choices" role="group" aria-label={q.stem}>
        {q.options.map((opt, i) => (
          <button
            key={i}
            type="button"
            className={`choice${aim === i + 1 ? " is-aimed" : ""}`}
            onClick={() => onPick(i)}
          >
            <span className="choice__key" aria-hidden="true">{i + 1}</span>
            <span className="choice__text">{opt.text}</span>
          </button>
        ))}
      </div>

      <CameraStage
        active
        enabled={camOn}
        optionCount={q.options.length}
        onPick={onPick}
        onAimChange={onAim}
      />
    </section>
  );
}
