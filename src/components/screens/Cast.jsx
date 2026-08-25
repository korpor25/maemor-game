"use client";

/* ฉากประมวลผล — ช่วงพักสั้น ๆ ที่ทำให้ผลลัพธ์รู้สึกว่าถูกคำนวณ ไม่ใช่โผล่มาเฉย ๆ
   แตะที่ไหนก็ข้ามได้ คิวที่บูธจะได้เดินเร็วขึ้น */

import { useEffect, useState } from "react";
import Plate from "@/components/Plate";

const STEPS = [
  "รวมคะแนนรายแกน",
  "เทียบกับคะแนนเต็มของแต่ละสาย",
  "จัดอันดับผลลัพธ์"
];

export default function Cast({ values, labels, onDone }) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) { onDone(); return; }
    const ids = STEPS.map((_, i) => setTimeout(() => setStep(i), i * 700));
    const end = setTimeout(onDone, STEPS.length * 700 + 500);
    return () => { ids.forEach(clearTimeout); clearTimeout(end); };
  }, [onDone]);

  return (
    <section className="screen cast" onClick={onDone}>
      <div className="cast__plate">
        <Plate values={values} labels={labels} showLabels duration={900} />
      </div>
      <h2 className="lg">กำลังประมวลผลคำตอบของคุณ</h2>
      <p className="code cast__step">{STEPS[step]}</p>
      <p className="fine">แตะเพื่อข้าม</p>
    </section>
  );
}
