"use client";

/* หน้าผลลัพธ์ — สรุปให้จบในจอเดียว
   สิ่งที่ผู้เล่นอยากรู้ทันทีคือ "ได้สายอะไร" กับ "คะแนนแต่ละแกนเป็นอย่างไร"
   ส่วนคำอธิบายยาวเก็บไว้หลังปุ่มรายละเอียด ใครสนใจค่อยกดอ่าน
   ที่บูธมีคนต่อคิว การบังคับให้เลื่อนอ่านหกย่อหน้าก่อนถึงปุ่มเล่นใหม่ทำให้คิวติด */

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { PATHS, AXES } from "@/lib/data";
import { percent } from "@/lib/score";
import Plate from "@/components/Plate";
import Icon from "@/components/Icon";

export default function Result({ values, labels, ranked, scores, winner, onAgain, onPaths }) {
  const path = PATHS[winner];
  const leadIndex = AXES.indexOf(winner);
  const [detail, setDetail] = useState(false);

  useEffect(() => {
    if (!detail) return;
    const onKey = e => { if (e.code === "Escape") { e.stopPropagation(); setDetail(false); } };
    addEventListener("keydown", onKey, true);
    return () => removeEventListener("keydown", onKey, true);
  }, [detail]);

  return (
    <section className="screen screen--fit result surface">
      <div className="result__head">
        <p className="tag tag--blue">ผลการสำรวจ</p>
        <img className="result__icon" src={path.icon} alt="" width={96} height={96} />
        <h2 className="result__name">{path.name}</h2>
        <p className="result__tag">{path.tagline}</p>
      </div>

      <div className="result__body">
        <div className="result__plate">
          <Plate values={values} labels={labels} icons={AXES.map(k => PATHS[k].icon)}
                 lead={leadIndex} showLabels duration={1100} />
        </div>

        <div className="axes">
          {ranked.map(k => {
            const pct = percent(scores, k);
            return (
              <div key={k} className={`axis${k === winner ? " is-lead" : ""}`}>
                <span className="axis__name">{PATHS[k].axis}</span>
                <span className="axis__track"><i style={{ width: `${pct}%` }} /></span>
                <span className="code axis__pct">{pct}%</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="chips">
        {path.jobs.map(j => <span key={j} className="chip">{j}</span>)}
      </div>

      <div className="result__actions">
        <button className="btn" onClick={onAgain}>ทำอีกครั้ง</button>
        <button className="btn btn--ghost" onClick={() => setDetail(true)}>อ่านรายละเอียด</button>
        <button className="btn-link" onClick={onPaths}>ดูทั้ง 8 สาย</button>
      </div>

      {detail && <DetailSheet path={path} onClose={() => setDetail(false)} />}
    </section>
  );
}

/* แผ่นรายละเอียดย้ายไปแขวนไว้ที่ body ผ่าน portal
   เพราะการ์ดผลลัพธ์ใช้ backdrop-filter ซึ่งทำให้ตัวเองกลายเป็นกรอบอ้างอิงของ
   position: fixed ทุกตัวที่อยู่ข้างใน แผ่นจึงเคยถูก overflow: hidden ของการ์ดตัดหัวตัดท้าย
   แทนที่จะคลุมเต็มจอ */
function DetailSheet({ path, onClose }) {
  return createPortal(
    <div className="sheet" role="dialog" aria-modal="true" aria-label={`รายละเอียด ${path.name}`}
         onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sheet__card surface">
        <div className="sheet__head">
          <div className="sheet__title">
            <p className="tag tag--blue">รายละเอียด</p>
            <h3 className="sheet__name">{path.name}</h3>
          </div>
          <button className="iconbtn" onClick={onClose} aria-label="ปิดรายละเอียด" title="ปิด">
            <Icon name="close" size={20} />
          </button>
        </div>

        <div className="sheet__scroll">
          <Block label="ผังดวงของคุณบอกอะไร"><p className="body">{path.reading}</p></Block>
          <Block label="ทำไมจึงเหมาะกับสายนี้"><p className="body">{path.fit}</p></Block>
          <Block label="จุดแข็งที่ประเมินได้">
            <ul className="bullets">
              {path.strengths.map(s => <li key={s} className="body">{s}</li>)}
            </ul>
          </Block>
          <Block label="วิชาที่เกี่ยวข้องในหลักสูตร">
            <p className="body">{path.study}</p>
          </Block>
        </div>

        <div className="sheet__foot">
          <button className="btn btn--sm" onClick={onClose}>ปิดหน้าต่างนี้</button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function Block({ label, children }) {
  return (
    <div className="card__block">
      <h4 className="tag tag--blue">{label}</h4>
      {children}
    </div>
  );
}
