"use client";

/* หน้าเปิด — ผังดวงเป็นตัวเอก โดยมีไอคอนของแต่ละสายอยู่ที่ยอดแกน
   รูปหลายเหลี่ยมเปลี่ยนไปเรื่อย ๆ เพื่อบอกโดยไม่ต้องเขียนว่า
   ผลลัพธ์มีได้หลายทรง ขึ้นกับคำตอบของแต่ละคน หนึ่งทรงต่อหนึ่งสายอาชีพ

   ทำด้วย SVG ล้วน จึงเบาและไม่ต้องรอ WebGL ก่อนเห็นอะไร */

import { useEffect, useState } from "react";
import Plate from "@/components/Plate";
import { PATHS, AXES } from "@/lib/data";

const FACTS = ["7 ข้อ", "ราว 3 นาที", "ไม่มีคำตอบถูกผิด", "ไม่เก็บข้อมูลส่วนตัว"];

/* ผังดวงตัวอย่างที่เดินคู่ไปกับท่ามือ — บอกว่าปลายทางของการชูนิ้วคือรูปแบบนี้ */
const SHAPES = [
  [1.00, 0.34, 0.22, 0.30, 0.46, 0.38, 0.20, 0.28],
  [0.30, 1.00, 0.48, 0.36, 0.24, 0.20, 0.18, 0.26],
  [0.26, 0.44, 1.00, 0.32, 0.20, 0.34, 0.16, 0.22],
  [0.24, 0.38, 0.28, 1.00, 0.42, 0.26, 0.20, 0.30],
  [0.22, 0.18, 0.16, 0.34, 1.00, 0.52, 0.30, 0.26],
  [0.28, 0.20, 0.30, 0.24, 0.50, 1.00, 0.34, 0.32],
  [0.20, 0.16, 0.18, 0.22, 0.34, 0.30, 1.00, 0.48],
  [0.32, 0.18, 0.20, 0.28, 0.26, 0.30, 0.46, 1.00]
];

export default function Intro({ labels, onStart, onPaths }) {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => setIndex(i => (i + 1) % SHAPES.length), 2400);
    return () => clearInterval(id);
  }, []);
  const shape = SHAPES[index];

  return (
    <section className="screen intro">
      <div className="intro__text">
        <p className="code intro__eyebrow">แม่หมอ VR · IT · RMUTL Lampang</p>

        <h1 className="intro__title">
          <span>ชูนิ้ว อ่าน<em>ผังดวง</em></span>
          <span>อาชีพของคุณ</span>
        </h1>

        <p className="intro__lede">
          ตอบคำถามเจ็ดข้อด้วยการชูนิ้วหน้ากล้อง
          แล้วอ่านผลเป็นผังดวงแปดแกนที่บอกว่าคุณเอนไปทางสายงานดิจิทัลใด
        </p>

        <ul className="facts">
          {FACTS.map(f => <li key={f} className="tag">{f}</li>)}
        </ul>

        <div className="intro__actions">
          <button className="btn" onClick={onStart}>เริ่มทำแบบสำรวจ</button>
          <button className="btn btn--ghost" onClick={onPaths}>ดูสายอาชีพทั้ง 8</button>
        </div>
      </div>

      <div className="intro__art" aria-hidden="true">
        <div className="intro__halo" />
        <Plate
          values={shape}
          labels={labels}
          icons={AXES.map(k => PATHS[k].icon)}
          lead={shape.indexOf(1)}
          showLabels
          duration={1800}
        />
      </div>
    </section>
  );
}
