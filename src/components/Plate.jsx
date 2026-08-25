"use client";

/* แผ่นผังดวง — แผนภูมิเรดาร์หกแกนที่เป็นทั้งตัวบอกความคืบหน้าและผลลัพธ์
   ค่าที่รับเข้ามาเป็น 0–1 ที่ normalize แล้ว คอมโพเนนต์นี้ไม่คำนวณคะแนนเอง */

import { useEffect, useRef, useState } from "react";
import { SIZE, C, R, R_LABEL, PAD, pointAt, polygonOf } from "@/lib/plate";

const RINGS = [0.25, 0.5, 0.75, 1];
const easeOut = t => 1 - Math.pow(1 - t, 3);

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
  lead = -1,
  showLabels = false,
  showValues = false,
  frame = true,
  duration = 620,
  className = ""
}) {
  const n = values.length;
  const shown = useTween(values, duration);

  return (
    <svg className={`plate ${className}`} viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden="true">
      {frame && (
        <>
          <rect className="plate__frame" x={PAD} y={PAD}
                width={SIZE - PAD * 2} height={SIZE - PAD * 2} />
          {[[PAD, PAD], [SIZE - PAD, PAD], [SIZE - PAD, SIZE - PAD], [PAD, SIZE - PAD]]
            .map(([x, y], i) => (
              <rect key={i} className="plate__corner" x={x - 2.5} y={y - 2.5}
                    width={5} height={5} transform={`rotate(45 ${x} ${y})`} />
            ))}
        </>
      )}

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

      {showLabels && labels.map((label, i) => {
        const [x, y] = pointAt(i, n, R_LABEL);
        return (
          <text key={i} className={`plate__label${i === lead ? " is-lead" : ""}`}
                x={x.toFixed(1)} y={y.toFixed(1)}>{label}</text>
        );
      })}

      {showValues && shown.map((v, i) => {
        if (v <= 0) return null;
        const [x, y] = pointAt(i, n, R_LABEL);
        return (
          <text key={i} className="plate__value" x={x.toFixed(1)} y={(y + 11).toFixed(1)}>
            {Math.round(v * 100)}%
          </text>
        );
      })}
    </svg>
  );
}

/* ตราเล็กของแต่ละสาย = ผังดวงอันเดียวกันที่ยื่นออกเพียงแกนเดียว
   หกสายจึงเป็นหกรูปทรงของแผนภูมิเดิม ไม่ต้องมีชุดไอคอนแยกต่างหาก */
export function PathGlyph({ axisIndex, total, className = "" }) {
  const values = new Array(total).fill(0.36);
  values[axisIndex] = 1;
  const [x, y] = pointAt(axisIndex, total, R);
  return (
    <svg className={`plate ${className}`} viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden="true">
      <polygon className="plate__frame" points={polygonOf(new Array(total).fill(1), total)} />
      <polygon className="plate__area" points={polygonOf(values, total)} />
      <circle className="plate__node is-lead" cx={x.toFixed(1)} cy={y.toFixed(1)} r={7} />
    </svg>
  );
}
