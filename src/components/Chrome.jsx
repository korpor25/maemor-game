"use client";

/* ชั้นเปลือกของหน้า — กริดเชิงเทคนิค เคอร์เซอร์ และแถบข้อมูลสถานะ
   ทั้งหมดเป็นของประดับ ถ้าไม่ทำงานแอปยังใช้ได้ครบ */

import { useEffect, useRef, useState } from "react";

const lerp = (a, b, t) => a + (b - a) * t;
const hasMouse = () =>
  typeof matchMedia !== "undefined" && matchMedia("(hover: hover) and (pointer: fine)").matches;
const reduceMotion = () =>
  typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ------------------------------------------------------------
   กริด — เส้นแบ่งคอลัมน์พร้อมกากบาทตรงจุดตัด
   วาดเป็น SVG เพราะ CSS วางกากบาทให้ตรงจุดตัดพอดีทุกขนาดจอไม่ได้
   ------------------------------------------------------------ */
export function GridOverlay() {
  const [box, setBox] = useState({ w: 0, h: 0, pad: 20 });

  useEffect(() => {
    const measure = () => {
      const pad = parseFloat(
        getComputedStyle(document.documentElement).getPropertyValue("--pad")) || 20;
      setBox({ w: innerWidth, h: innerHeight, pad });
    };
    measure();
    addEventListener("resize", measure, { passive: true });
    return () => removeEventListener("resize", measure);
  }, []);

  if (!box.w) return null;
  const { w, h, pad } = box;
  const cols = w < 760 ? 2 : 3;
  const inner = w - pad * 2;
  const xs = [pad, ...Array.from({ length: cols - 1 }, (_, i) => pad + (inner / cols) * (i + 1)), w - pad];
  const rows = Math.max(2, Math.round(h / 280));
  const ys = Array.from({ length: rows - 1 }, (_, i) => (h / rows) * (i + 1));

  return (
    <div className="grid-layer" aria-hidden="true">
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
        {xs.map((x, i) => (
          <line key={`v${i}`} className="grid-line" x1={x} y1={0} x2={x} y2={h} />
        ))}
        {xs.flatMap((x, i) =>
          ys.map((y, j) => (
            <g key={`t${i}-${j}`} className="grid-tick">
              <line x1={x - 5} y1={y} x2={x + 5} y2={y} />
              <line x1={x} y1={y - 5} x2={x} y2={y + 5} />
            </g>
          ))
        )}
      </svg>
    </div>
  );
}

/* ------------------------------------------------------------
   เคอร์เซอร์ — จุดตามติดกับวงแหวนที่ตามช้ากว่า
   ระยะหน่วงทำให้รู้สึกว่ามีน้ำหนัก ไม่ใช่รูปที่ติดกับเมาส์เฉย ๆ
   ------------------------------------------------------------ */
export function Cursor() {
  const dot = useRef(null);
  const ring = useRef(null);
  const wrap = useRef(null);

  useEffect(() => {
    if (!hasMouse() || reduceMotion()) return;
    let mx = innerWidth / 2, my = innerHeight / 2, rx = mx, ry = my, seen = false, raf = 0;

    const move = e => {
      mx = e.clientX; my = e.clientY;
      if (!seen) { seen = true; rx = mx; ry = my; wrap.current?.style.setProperty("opacity", "1"); }
    };
    /* วงแหวนโตขึ้นเมื่ออยู่เหนือสิ่งที่กดได้ รู้ได้ว่าอะไรคลิกได้โดยไม่ต้องลอง */
    const HOT = "a, button, input, label, [role='button']";
    const over = e => wrap.current?.classList.toggle("is-hot", !!e.target.closest?.(HOT));
    const leave = () => { wrap.current?.style.setProperty("opacity", "0"); seen = false; };

    addEventListener("pointermove", move, { passive: true });
    addEventListener("pointerover", over, { passive: true });
    document.addEventListener("mouseleave", leave);

    const tick = () => {
      if (dot.current) dot.current.style.transform = `translate3d(${mx}px, ${my}px, 0)`;
      rx = lerp(rx, mx, 0.19); ry = lerp(ry, my, 0.19);
      if (ring.current) ring.current.style.transform = `translate3d(${rx}px, ${ry}px, 0)`;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    document.documentElement.classList.add("has-cursor");

    return () => {
      cancelAnimationFrame(raf);
      removeEventListener("pointermove", move);
      removeEventListener("pointerover", over);
      document.removeEventListener("mouseleave", leave);
      document.documentElement.classList.remove("has-cursor");
    };
  }, []);

  return (
    <div className="cursor" ref={wrap} style={{ opacity: 0 }} aria-hidden="true">
      <div className="cursor__dot" ref={dot} />
      <div className="cursor__ring" ref={ring} />
    </div>
  );
}

/* ------------------------------------------------------------
   แถบข้อมูลสถานะล่าง — นาฬิกาที่เดินจริงกับพิกัดเมาส์
   ตัวเลขที่ขยับตลอดทำให้หน้ารู้สึกเป็นเครื่องมือที่ทำงานอยู่ ไม่ใช่ภาพนิ่ง
   ------------------------------------------------------------ */
export function Telemetry({ children }) {
  const [clock, setClock] = useState("");
  const [xy, setXY] = useState("0000 X 0000 Y");

  useEffect(() => {
    const two = n => String(n).padStart(2, "0");
    const tick = () => {
      const d = new Date();
      /* บอกเขตเวลาไว้ด้วย เครื่องบูธกับมือถือผู้เล่นอาจตั้งเวลาต่างกัน
         เจ้าหน้าที่จะได้รู้ว่าเวลาที่บันทึกอ้างอิงจากอะไร */
      const off = -d.getTimezoneOffset() / 60;
      setClock(`GMT${off >= 0 ? "+" : "−"}${Math.abs(off)} ${two(d.getHours())}:${two(d.getMinutes())}:${two(d.getSeconds())}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    const move = e =>
      setXY(`${String(Math.round(e.clientX)).padStart(4, "0")} X ${String(Math.round(e.clientY)).padStart(4, "0")} Y`);
    addEventListener("pointermove", move, { passive: true });
    return () => { clearInterval(id); removeEventListener("pointermove", move); };
  }, []);

  return (
    <footer className="tele">
      <span className="code">{clock}</span>
      <span className="code tele__mid">{xy}</span>
      <span className="tele__end">{children}</span>
    </footer>
  );
}
