"use client";

/* แผ่นผังดวง — แผนภูมิเรดาร์ที่เป็นทั้งตัวบอกความคืบหน้าและผลลัพธ์
   จำนวนแกนมาจากความยาวของ values จึงเปลี่ยนจำนวนสายอาชีพได้โดยไม่ต้องแก้ที่นี่
   ค่าที่รับเข้ามาเป็น 0–1 ที่ normalize แล้ว คอมโพเนนต์นี้ไม่คำนวณคะแนนเอง

   ไม่มีกรอบสี่เหลี่ยมรอบกราฟแล้ว — รูปหลายเหลี่ยมกับไอคอนที่ยอดแกน
   บอกขอบเขตของแผนภูมิได้ด้วยตัวเองอยู่แล้ว กรอบมีแต่เพิ่มเส้นให้รก */

import { useEffect, useRef, useState } from "react";
import { SIZE, C, R, R_LABEL, pointAt, polygonOf } from "@/lib/plate";

const RINGS = [0.25, 0.5, 0.75, 1];
const easeOut = t => 1 - Math.pow(1 - t, 3);

/* ป้ายชื่อแกนวางออกด้านนอกจากไอคอนเสมอ — ยอดครึ่งบนวางเหนือ ยอดครึ่งล่างวางใต้
   ถ้าวางไว้ระหว่างไอคอนกับกราฟ ป้ายจะไปทับจุดข้อมูลตอนคะแนนเข้าใกล้เต็ม */
function labelY(y, hasIcon, extra) {
  if (!hasIcon) return y + extra;
  const outward = y < C ? -1 : 1;
  return y + outward * (19 + extra);
}

/** ค่อย ๆ ขยับค่าจากชุดเดิมไปชุดใหม่ ผู้ตอบจะได้เห็นว่าคำตอบมีผลจริง */
function useTween(target, duration = 620) {
  const [shown, setShown] = useState(target);
  const from = useRef(target);
  const raf = useRef(0);

  useEffect(() => {
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || duration === 0) { from.current = target; setShown(target); return; }
    const start = performance.now();
    const a = from.current;
    cancelAnimationFrame(raf.current);
    const tick = now => {
      const p = Math.min(1, (now - start) / duration);
      const k = easeOut(p);
      const mid = target.map((v, i) => (a[i] ?? 0) + (v - (a[i] ?? 0)) * k);
      setShown(mid);
      if (p < 1) raf.current = requestAnimationFrame(tick);
      else from.current = target;
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [target, duration]);

  return shown;
}

export default function Plate({
  values,
  labels = [],
  icons = [],
  lead = -1,
  showLabels = false,
  showValues = false,
  duration = 620,
  className = ""
}) {
  const n = values.length;
  const shown = useTween(values, duration);

  return (
    <svg className={`plate ${className}`} viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden="true">
      {RINGS.map(step => (
        <polygon key={step} className="plate__ring"
                 points={polygonOf(new Array(n).fill(step), n)} />
      ))}

      {Array.from({ length: n }, (_, i) => {
        const [x, y] = pointAt(i, n, R);
        return <line key={i} className="plate__spoke" x1={C} y1={C} x2={x} y2={y} />;
      })}

      <polygon className="plate__area" points={polygonOf(shown, n)} />

      {shown.map((v, i) => {
        const [x, y] = pointAt(i, n, Math.max(0.04, v) * R);
        return (
          <circle key={i}
                  className={`plate__node${i === lead ? " is-lead" : ""}`}
                  cx={x.toFixed(2)} cy={y.toFixed(2)} r={i === lead ? 5 : 3.2} />
        );
      })}

      {/* ไอคอนของแต่ละสายวางที่ยอดแกนของตัวเอง
          บอกว่าแกนนั้นหมายถึงอะไรโดยไม่ต้องอ่านชื่อแกน */}
      {icons.length > 0 && icons.map((src, i) => {
        const [x, y] = pointAt(i, n, R_LABEL);
        const size = 24;
        return (
          <image key={i} href={src} width={size} height={size}
                 x={(x - size / 2).toFixed(1)} y={(y - size / 2).toFixed(1)}
                 className={`plate__icon${i === lead ? " is-lead" : ""}`} />
        );
      })}

      {showLabels && labels.map((label, i) => {
        const [x, y] = pointAt(i, n, R_LABEL);
        return (
          <text key={i} className={`plate__label${i === lead ? " is-lead" : ""}`}
                x={x.toFixed(1)} y={labelY(y, icons.length > 0, 0).toFixed(1)}>{label}</text>
        );
      })}

      {showValues && shown.map((v, i) => {
        if (v <= 0) return null;
        const [x, y] = pointAt(i, n, R_LABEL);
        return (
          <text key={i} className="plate__value"
                x={x.toFixed(1)} y={labelY(y, icons.length > 0, 11).toFixed(1)}>
            {Math.round(v * 100)}%
          </text>
        );
      })}
    </svg>
  );
}

/* ตราเล็กของแต่ละสาย = ผังดวงอันเดียวกันที่ยื่นออกเพียงแกนเดียว
   แต่ละสายจึงเป็นรูปทรงหนึ่งของแผนภูมิเดิม ไม่ต้องมีชุดไอคอนแยกต่างหาก */
export function PathGlyph({ axisIndex, total, className = "" }) {
  const values = new Array(total).fill(0.36);
  values[axisIndex] = 1;
  const [x, y] = pointAt(axisIndex, total, R);
  return (
    <svg className={`plate ${className}`} viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden="true">
      <polygon className="plate__ring" points={polygonOf(new Array(total).fill(1), total)} />
      <polygon className="plate__area" points={polygonOf(values, total)} />
      <circle className="plate__node is-lead" cx={x.toFixed(1)} cy={y.toFixed(1)} r={7} />
    </svg>
  );
}
