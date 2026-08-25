"use client";

/* หน้ารวมแปดสาย — ใช้เป็นเอกสารอ้างอิงหน้าบูธได้ด้วย
   ไอคอนมาจากชุด Fluent Emoji 3D ของ Microsoft (MIT) */

import { PATHS, AXES } from "@/lib/data";


export default function Paths({ onBack }) {
  return (
    <section className="screen screen--fit paths surface">
      <div className="paths__head">
        <p className="tag tag--blue">อ้างอิง</p>
        <h2 className="paths__title">สายอาชีพทั้ง 8 แกน</h2>
        <p className="fine">ผลการสำรวจจะออกมาเป็นหนึ่งในแปดสายนี้</p>
      </div>

      {/* สองคอลัมน์บนจอกว้าง แปดใบจึงอยู่ครบในจอเดียวโดยไม่ต้องเลื่อน
          ตัดรายชื่อวิชาออกจากที่นี่ เพราะมีอยู่ในหน้ารายละเอียดผลอยู่แล้ว */}
      <ul className="paths__list">
        {AXES.map(k => {
          const p = PATHS[k];
          return (
            <li key={k} className="path">
              <img className="path__glyph" src={p.icon} alt="" width={56} height={56} loading="lazy" />
              <div className="path__body">
                <h3 className="path__name">{p.name}</h3>
                <p className="path__tag">{p.tagline}</p>
                <p className="path__jobs">{p.jobs.join(" · ")}</p>
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
