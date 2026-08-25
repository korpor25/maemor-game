/* ============================================================
   ชั้นบรรยากาศและการเคลื่อนไหวรอบนอก
   ทุกอย่างในไฟล์นี้เป็นของประดับ ถ้าไม่ทำงานแอปยังใช้ได้ครบ
   จึงหุ้มด้วยการตรวจ prefers-reduced-motion และการมีเมาส์จริงไว้ทุกจุด
   ============================================================ */

const NS = "http://www.w3.org/2000/svg";
const reduceMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const hasMouse = () => matchMedia("(hover: hover) and (pointer: fine)").matches;
const lerp = (a, b, t) => a + (b - a) * t;

/* ------------------------------------------------------------
   กริดเชิงเทคนิค — เส้นแบ่งคอลัมน์พร้อมกากบาทตรงจุดตัด
   วาดเป็น SVG เพราะ CSS วางกากบาทให้ตรงจุดตัดพอดีทุกขนาดจอไม่ได้
   ------------------------------------------------------------ */
export function mountGrid(host) {
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("aria-hidden", "true");
  host.replaceChildren(svg);

  const draw = () => {
    const w = host.clientWidth, h = host.clientHeight;
    if (!w || !h) return;
    svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
    svg.replaceChildren();

    /* ระยะขอบต้องตรงกับ --pad ใน CSS เส้นกริดจึงจะทาบกับขอบเนื้อหาจริง */
    const pad = parseFloat(getComputedStyle(document.documentElement)
      .getPropertyValue("--pad")) || 16;
    const cols = w < 736 ? 2 : 3;
    const inner = w - pad * 2;

    const xs = [pad];
    for (let i = 1; i < cols; i++) xs.push(pad + (inner / cols) * i);
    xs.push(w - pad);

    /* แถวแนวนอนเว้นระยะเท่ากัน ไม่ผูกกับเนื้อหา เป็นฉากหลังล้วน */
    const rows = Math.max(2, Math.round(h / 260));
    const ys = Array.from({ length: rows + 1 }, (_, i) => (h / rows) * i);

    const g = document.createElementNS(NS, "g");
    for (const x of xs) {
      const line = document.createElementNS(NS, "line");
      line.setAttribute("class", "grid__line");
      line.setAttribute("x1", x); line.setAttribute("y1", 0);
      line.setAttribute("x2", x); line.setAttribute("y2", h);
      g.append(line);
    }
    /* กากบาทเล็ก ๆ ตรงจุดตัด — ยืมภาษาจากแบบร่างทางวิศวกรรม
       บอกว่าหน้านี้วางบนระบบพิกัด ไม่ได้จัดวางตามใจ */
    for (const x of xs) {
      for (const y of ys.slice(1, -1)) {
        for (const [x1, y1, x2, y2] of [[x - 5, y, x + 5, y], [x, y - 5, x, y + 5]]) {
          const t = document.createElementNS(NS, "line");
          t.setAttribute("class", "grid__tick");
          t.setAttribute("x1", x1); t.setAttribute("y1", y1);
          t.setAttribute("x2", x2); t.setAttribute("y2", y2);
          g.append(t);
        }
      }
    }
    svg.append(g);
  };

  draw();
  addEventListener("resize", draw, { passive: true });
  return draw;
}

/* ------------------------------------------------------------
   เคอร์เซอร์กำหนดเอง — จุดตามติดกับวงแหวนที่ตามช้ากว่า
   ระยะหน่วงเล็กน้อยทำให้รู้สึกว่ามีน้ำหนัก ไม่ใช่แค่รูปที่ติดกับเมาส์
   ------------------------------------------------------------ */
export function mountCursor(el) {
  if (!hasMouse() || reduceMotion()) { el.remove(); return; }

  const dot = el.querySelector(".cursor__dot");
  const ring = el.querySelector(".cursor__ring");
  let mx = innerWidth / 2, my = innerHeight / 2;
  let rx = mx, ry = my;
  let visible = false;

  addEventListener("pointermove", e => {
    mx = e.clientX; my = e.clientY;
    if (!visible) { visible = true; el.style.opacity = "1"; rx = mx; ry = my; }
  }, { passive: true });
  addEventListener("pointerdown", () => el.classList.add("is-hot"));
  addEventListener("pointerup", () => el.classList.remove("is-hot"));
  document.addEventListener("mouseleave", () => { el.style.opacity = "0"; visible = false; });

  /* วงแหวนโตขึ้นเมื่ออยู่เหนือสิ่งที่กดได้ ทำให้รู้ว่าอะไรคลิกได้โดยไม่ต้องลอง */
  const HOT = "a, button, input, label, .choice, [role='button']";
  addEventListener("pointerover", e => {
    el.classList.toggle("is-hot", !!e.target.closest?.(HOT));
  }, { passive: true });

  el.style.opacity = "0";
  const tick = () => {
    dot.style.transform = `translate3d(${mx}px, ${my}px, 0)`;
    rx = lerp(rx, mx, .18);
    ry = lerp(ry, my, .18);
    ring.style.transform = `translate3d(${rx}px, ${ry}px, 0)`;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

/* ------------------------------------------------------------
   แถบข้อมูลสถานะล่าง — นาฬิกาที่เดินจริงกับพิกัดเมาส์
   ตัวเลขที่ขยับตลอดเวลาทำให้หน้ารู้สึกเป็นเครื่องมือที่ทำงานอยู่
   ------------------------------------------------------------ */
export function mountTelemetry({ clock, coords }) {
  const two = n => String(n).padStart(2, "0");

  const tickClock = () => {
    const d = new Date();
    /* แสดงเขตเวลาไว้ด้วย เครื่องบูธกับมือถือผู้เล่นอาจตั้งเวลาต่างกัน
       เจ้าหน้าที่จะได้เห็นทันทีว่าเวลาที่บันทึกอ้างอิงจากอะไร */
    const offset = -d.getTimezoneOffset() / 60;
    const sign = offset >= 0 ? "+" : "−";
    clock.textContent =
      `GMT${sign}${Math.abs(offset)} · ${two(d.getHours())}:${two(d.getMinutes())}:${two(d.getSeconds())}`;
  };
  tickClock();
  setInterval(tickClock, 1000);

  if (!coords) return;
  const setCoords = (x, y) =>
    coords.textContent = `${String(Math.round(x)).padStart(4, "0")} X ${String(Math.round(y)).padStart(4, "0")} Y`;
  setCoords(0, 0);
  addEventListener("pointermove", e => setCoords(e.clientX, e.clientY), { passive: true });
}

/* ------------------------------------------------------------
   ก้อนแสงขยับตามเมาส์เล็กน้อย — ให้ฉากหลังมีความลึก
   แต่ละก้อนขยับคนละอัตรา ตาจึงอ่านว่าอยู่คนละระยะ
   ------------------------------------------------------------ */
export function mountParallax(nodes) {
  if (reduceMotion() || !nodes.length) return;
  const depths = [26, -18, 12];
  let tx = 0, ty = 0, cx = 0, cy = 0;

  addEventListener("pointermove", e => {
    tx = (e.clientX / innerWidth - .5) * 2;
    ty = (e.clientY / innerHeight - .5) * 2;
  }, { passive: true });

  const tick = () => {
    cx = lerp(cx, tx, .045);
    cy = lerp(cy, ty, .045);
    nodes.forEach((n, i) => {
      const d = depths[i % depths.length];
      n.style.transform = `translate3d(${(cx * d).toFixed(2)}px, ${(cy * d).toFixed(2)}px, 0)`;
    });
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

/* ------------------------------------------------------------
   ปุ่มขยับเข้าหาเมาส์เล็กน้อยเมื่อเข้าใกล้
   ใช้เฉพาะปุ่มหลัก ถ้าใส่ทุกปุ่มหน้าจะกระตุกไปหมด
   ------------------------------------------------------------ */
export function magnetic(el, strength = 0.28) {
  if (!hasMouse() || reduceMotion()) return;
  const reset = () => el.style.transform = "";

  el.addEventListener("pointermove", e => {
    const r = el.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2);
    const dy = e.clientY - (r.top + r.height / 2);
    el.style.transform = `translate3d(${dx * strength}px, ${dy * strength}px, 0)`;
  });
  el.addEventListener("pointerleave", reset);
  el.addEventListener("click", reset);
}

/* ------------------------------------------------------------
   เผยพาดหัวทีละบรรทัด โดยแบ่งตาม <br> ที่ผู้เขียนกำหนดไว้เอง

   เคยลองแบ่งตามตำแหน่งบรรทัดจริงหลังจัดหน้า ซึ่งฟังดูฉลาดกว่า
   แต่ต้องรื้อเนื้อหาเป็นคำ ๆ ก่อน วิธีนั้นจึงทำลายมาร์กอัปข้างใน
   ทั้งตัวเน้นสีและจุดขึ้นบรรทัดหายหมด การแบ่งตาม <br> ให้ผลที่คาดเดาได้
   และเก็บทุกอย่างที่อยู่ในบรรทัดไว้ครบ
   ------------------------------------------------------------ */
export function revealLines(el) {
  const parts = el.innerHTML.split(/<br\s*\/?>/i).map(s => s.trim()).filter(Boolean);
  if (parts.length === 0) return;

  el.replaceChildren(...parts.map(html => {
    const mask = document.createElement("span");
    mask.style.cssText = "display:block;overflow:hidden;padding-bottom:.06em";
    const inner = document.createElement("span");
    inner.style.display = "block";
    inner.innerHTML = html;
    mask.append(inner);
    return mask;
  }));

  if (reduceMotion() || !el.firstChild?.firstChild?.animate) return;
  [...el.children].forEach((mask, i) => {
    mask.firstChild.animate(
      [{ transform: "translateY(108%)" }, { transform: "translateY(0)" }],
      { duration: 900, delay: 90 + i * 110, easing: "cubic-bezier(.16,1,.3,1)", fill: "both" }
    );
  });
}
