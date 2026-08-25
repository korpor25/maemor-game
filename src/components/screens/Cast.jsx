"use client";

/* ฉากประมวลผล — หน้ารอที่บอกความคืบหน้าจริง
   ไม่ใช่แค่วงหมุนเปล่า ๆ ผู้เล่นเห็นแถบเดินหน้า เห็นว่าทำอะไรไปแล้วบ้าง
   และเหลืออีกกี่ขั้น จึงรู้ว่าเครื่องยังทำงานอยู่และอีกไม่นานก็เสร็จ

   แตะที่ไหนก็ข้ามได้ คิวที่บูธจะได้เดินเร็วขึ้น */

import { useEffect, useState } from "react";
import Plate from "@/components/Plate";
import { PATHS, AXES } from "@/lib/data";

const STEPS = [
  "รวมคะแนนรายแกน",
  "เทียบกับคะแนนเต็มของแต่ละสาย",
  "จัดอันดับผลลัพธ์"
];

const STEP_MS = 700;
const TAIL_MS = 500;
const TOTAL_MS = STEPS.length * STEP_MS + TAIL_MS;

export default function Cast({ values, labels, onDone }) {
  /* เดินด้วยเวลาจริงผ่าน rAF ไม่ใช่ตัวจับเวลาแยกขั้นละตัว
     แถบเปอร์เซ็นต์จึงตรงกับเวลาที่เหลือจริง ไม่กระโดดเป็นช่วง ๆ */
  const [t, setT] = useState(0);

  /* คนที่ตั้งค่าลดการเคลื่อนไหวยังได้เห็นหน้านี้ แค่ผ่านเร็วขึ้น
     เดิมข้ามทิ้งไปเลย ผลลัพธ์จึงเด้งขึ้นมาทันทีจนไม่รู้ว่าระบบคิดอะไรไปบ้าง
     วงแหวนหมุนกับจุดกะพริบถูกปิดจาก CSS อยู่แล้ว เหลือแค่แถบที่เดินหน้า */
  useEffect(() => {
    const total = matchMedia("(prefers-reduced-motion: reduce)").matches ? 1000 : TOTAL_MS;
    const start = performance.now();
    let raf = 0;
    const tick = now => {
      const p = Math.min(1, (now - start) / total);
      setT(p);
      if (p < 1) raf = requestAnimationFrame(tick);
      else onDone();
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [onDone]);

  const step = Math.min(STEPS.length - 1, Math.floor(t * STEPS.length));
  const pct = Math.round(t * 100);

  return (
    <section className="screen screen--fit cast surface" onClick={onDone}>
      <div className="cast__plate">
        <span className="cast__ring" aria-hidden="true" />
        <Plate values={values} labels={labels} icons={AXES.map(k => PATHS[k].icon)}
               showLabels duration={900} />
      </div>

      <h2 className="cast__title">กำลังประมวลผลคำตอบของคุณ</h2>

      <div className="cast__meter">
        <div className="cast__bar" role="progressbar" aria-label="ความคืบหน้าการประมวลผล"
             aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <i style={{ width: `${pct}%` }} />
        </div>
        <span className="code cast__pct">{pct}%</span>
      </div>

      <ol className="cast__steps">
        {STEPS.map((label, i) => (
          <li key={label}
              className={`cast__step${i < step ? " is-done" : ""}${i === step ? " is-now" : ""}`}>
            <span className="cast__dot" aria-hidden="true" />
            <span>{label}</span>
          </li>
        ))}
      </ol>

      <p className="fine">แตะเพื่อข้ามไปดูผลได้เลย</p>
    </section>
  );
}
