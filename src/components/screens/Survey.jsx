"use client";

/* หน้าคำถาม — กล้องอยู่บนสุดเพราะเป็นวิธีเลือกคำตอบหลัก
   ตัวเลือกที่แตะได้อยู่ล่างในฐานะทางสำรองที่ใช้ได้ตลอดเวลา */

import { QUESTIONS } from "@/lib/data";
import Plate from "@/components/Plate";
import CameraStage from "@/components/CameraStage";

export default function Survey({
  qi, values, labels, aim, camOn, onToggleCam, onPick, onBack, onAim
}) {
  const q = QUESTIONS[qi];
  if (!q) return null;

  return (
    <section className="screen survey">
      <div className="survey__head">
        <div className="survey__plate">
          <Plate values={values} labels={labels} frame={false} duration={480} />
        </div>
        <div className="survey__meta">
          <p className="tag tag--blue">{q.domain}</p>
          <p className="code">ข้อ {qi + 1} / {QUESTIONS.length}</p>
          <div className="ticks" aria-hidden="true">
            {QUESTIONS.map((_, i) => (
              <b key={i} className={i < qi ? "is-done" : i === qi ? "is-here" : ""} />
            ))}
          </div>
        </div>
      </div>

      <h2 className="md survey__stem">{q.stem}</h2>

      <CameraStage
        active
        enabled={camOn}
        optionCount={q.options.length}
        onPick={onPick}
        onAimChange={onAim}
      />

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

      <div className="row survey__actions">
        {qi > 0 && (
          <button className="btn btn--ghost btn--sm" onClick={onBack}>ย้อนกลับหนึ่งข้อ</button>
        )}
        <button className="sw" onClick={onToggleCam}>cam[<b>{camOn ? "on" : "off"}</b>]</button>
      </div>

      <p className="fine">
        ภาพจากกล้องถูกประมวลผลในเครื่องนี้เท่านั้น ไม่ถูกบันทึกและไม่ถูกส่งออกไปที่ใด
      </p>
    </section>
  );
}
