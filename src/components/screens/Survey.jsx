"use client";

/* หน้าคำถาม — ต้องอยู่ในจอเดียวเสมอ ไม่มีการเลื่อน
   ผู้เล่นอ่านโจทย์ อ่านตัวเลือก และเห็นภาพกล้องได้พร้อมกัน
   แล้วตอบด้วยการขยับมืออย่างเดียว

   เนื้อหาวางบนผิวทึบ ไม่ลอยบนพื้นหลังโดยตรง
   เพราะพื้นหลังมีลำแสงเคลื่อนผ่านตลอด ถ้าไม่มีผิวรอง ความคมชัดของตัวอักษร
   จะเปลี่ยนไปมาตามจังหวะแสงจนอ่านยาก

   ลำดับบล็อกในโค้ดเป็นลำดับของจอแนวตั้ง ส่วนจอแนวนอนสลับตำแหน่งด้วย
   grid-template-areas ไม่ต้องมีมาร์กอัปสองชุด */

import { QUESTIONS } from "@/lib/data";
import CameraStage from "@/components/CameraStage";
import Icon from "@/components/Icon";

export default function Survey({
  qi, aim, camOn, onToggleCam, onPick, onBack, onAim
}) {
  const q = QUESTIONS[qi];
  if (!q) return null;
  const progress = ((qi + 1) / QUESTIONS.length) * 100;

  return (
    <section className="screen screen--fit survey surface">
      <header className="survey__head">
        <div className="survey__meta">
          <span className="code">คำถาม {qi + 1} / {QUESTIONS.length}</span>
          <span className="tag tag--blue">{q.domain}</span>
        </div>
        <div className="progress" role="progressbar"
             aria-valuenow={qi + 1} aria-valuemin={1} aria-valuemax={QUESTIONS.length}>
          <i style={{ width: `${progress}%` }} />
        </div>
      </header>

      <h2 className="survey__stem">{q.stem}</h2>

      <div className="survey__cam">
        <CameraStage
          active
          enabled={camOn}
          optionCount={q.options.length}
          onPick={onPick}
          onAimChange={onAim}
        />
      </div>

      <div className="survey__answers">
        <div className="choices" data-count={q.options.length} role="group" aria-label={q.stem}>
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
        <div className="survey__tools">
          <button
            className={`camtoggle${camOn ? " is-on" : ""}`}
            onClick={onToggleCam}
            aria-pressed={camOn}
            title={camOn ? "ปิดกล้องแล้วตอบด้วยการแตะ" : "เปิดกล้องเพื่อตอบด้วยการชูนิ้ว"}
          >
            <Icon name={camOn ? "cam" : "camoff"} />
            {camOn ? "ปิดกล้อง" : "เปิดกล้อง"}
          </button>
          {qi > 0 && <button className="btn-link" onClick={onBack}>ย้อนกลับ</button>}
        </div>
      </div>
    </section>
  );
}
