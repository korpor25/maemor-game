"use client";

/* หน้ารวมหกสาย — ใช้เป็นเอกสารอ้างอิงหน้าบูธได้ด้วย
   ตราของแต่ละสายคือผังดวงอันเดียวกันที่ยื่นออกคนละแกน */

import { PATHS, AXES } from "@/lib/data";
import { PathGlyph } from "@/components/Plate";

export default function Paths({ onBack }) {
  return (
    <section className="screen paths">
      <div className="paths__head">
        <p className="tag tag--blue">อ้างอิง</p>
        <h2 className="lg">สายอาชีพทั้ง 6 แกน</h2>
        <p className="lede">แต่ละตราคือผังดวงอันเดียวกัน ที่ยื่นออกเพียงแกนเดียว</p>
      </div>

      <ul className="paths__list">
        {AXES.map((k, i) => {
          const p = PATHS[k];
          return (
            <li key={k} className="path">
              <PathGlyph axisIndex={i} total={AXES.length} className="path__glyph" />
              <div className="path__body">
                <h3 className="md path__name">{p.name}</h3>
                <p className="body path__tag">{p.tagline}</p>
                <p className="fine"><b className="tag">อาชีพ</b> {p.jobs.join(" · ")}</p>
                <p className="fine"><b className="tag">วิชาที่เรียน</b> {p.study}</p>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="row">
        <button className="btn btn--ghost" onClick={onBack}>ย้อนกลับ</button>
      </div>
    </section>
  );
}
