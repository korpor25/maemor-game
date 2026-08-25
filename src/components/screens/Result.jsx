"use client";

/* หน้าผลลัพธ์ — ผังดวงเต็มรูปแบบ แล้วตามด้วยคำอธิบายที่อ่านเป็นย่อหน้าได้จริง
   ทุกส่วนดึงจาก data.js ไม่มีข้อความไหนถูกเขียนซ้ำไว้ที่นี่ */

import { useEffect, useState } from "react";
import { PATHS, AXES } from "@/lib/data";
import { percent } from "@/lib/score";
import Plate from "@/components/Plate";

export default function Result({ values, labels, ranked, scores, winner, onAgain, onPaths }) {
  const path = PATHS[winner];
  const leadIndex = AXES.indexOf(winner);
  const [bars, setBars] = useState(false);

  /* แถบรายแกนไล่ขึ้นหลังผังดวงวาดเสร็จ ไม่ขึ้นพร้อมกันทั้งหมด */
  useEffect(() => {
    const id = setTimeout(() => setBars(true), 420);
    return () => clearTimeout(id);
  }, []);

  return (
    <section className="screen result">
      <div className="result__top">
        <div className="result__plate">
          <Plate values={values} labels={labels} lead={leadIndex} showLabels showValues duration={1100} />
        </div>
        <div className="result__title">
          <p className="tag tag--blue">ผลการสำรวจ</p>
          <h2 className="xl">{path.name}</h2>
          <p className="lede">{path.tagline}</p>
        </div>
      </div>

      <div className="card">
        <Block label="ผังดวงของคุณบอกอะไร"><p className="body">{path.reading}</p></Block>
        <Block label="ทำไมจึงเหมาะกับสายนี้"><p className="body">{path.fit}</p></Block>

        <Block label="จุดแข็งที่ประเมินได้">
          <ul className="bullets">
            {path.strengths.map(s => <li key={s} className="body">{s}</li>)}
          </ul>
        </Block>

        <Block label="คะแนนรายแกน">
          <div className="axes">
            {ranked.map(k => {
              const pct = percent(scores, k);
              return (
                <div key={k} className={`axis${k === winner ? " is-lead" : ""}`}>
                  <span className="tag axis__name">{PATHS[k].axis}</span>
                  <span className="axis__track">
                    <i style={{ width: bars ? `${pct}%` : 0 }} />
                  </span>
                  <span className="code axis__pct">{pct}%</span>
                </div>
              );
            })}
          </div>
        </Block>

        <Block label="ตัวอย่างอาชีพ">
          <div className="chips">
            {path.jobs.map(j => <span key={j} className="chip">{j}</span>)}
          </div>
        </Block>

        <Block label="วิชาที่เกี่ยวข้องในหลักสูตร">
          <p className="body">{path.study}</p>
        </Block>
      </div>

      <div className="row">
        <button className="btn" onClick={onAgain}>ทำแบบสำรวจอีกครั้ง</button>
        <button className="btn btn--ghost" onClick={onPaths}>ดูสายอาชีพทั้ง 6</button>
      </div>
    </section>
  );
}

function Block({ label, children }) {
  return (
    <div className="card__block">
      <h3 className="tag tag--blue">{label}</h3>
      {children}
    </div>
  );
}
