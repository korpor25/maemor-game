/* ============================================================
   แผ่นผังดวง — องค์ประกอบเด่นชิ้นเดียวของงานนี้
   เป็นแผนภูมิเรดาร์จริงที่ห่อด้วยกรอบสี่เหลี่ยมแบบผังดวงโหราศาสตร์
   ใช้ซ้ำสี่ที่: หน้าเปิด (ว่าง) · หัวข้อคำถาม (เติมทีละข้อ)
                ฉากประมวลผล (ไฟวิ่งรอบแกน) · หน้าผล (เต็มรูปแบบ)
   ============================================================ */

const NS = "http://www.w3.org/2000/svg";
const SIZE = 220;
const C = SIZE / 2;
const R = 70;          // รัศมีของยอดแกนเมื่อคะแนนเต็ม
const R_LABEL = 92;    // รัศมีของป้ายชื่อแกน วางนอกกรอบข้อมูล
const PAD = 12;        // ระยะขอบกรอบสี่เหลี่ยมชั้นนอก

const el = (tag, attrs) => {
  const n = document.createElementNS(NS, tag);
  for (const k in attrs) n.setAttribute(k, attrs[k]);
  return n;
};

/* แกนที่ i ชี้ไปทางไหน — เริ่มจากยอด (−90°) แล้วเดินตามเข็มนาฬิกา
   สามฟังก์ชันนี้เป็นคณิตศาสตร์ล้วน ไม่แตะ DOM จึง export ให้สคริปต์ตอน build
   เรียกใช้วาดผังดวงลงคู่มือได้ด้วยสูตรเดียวกัน ไม่ต้องคัดลอกเรขาคณิตไปไว้สองที่ */
export const PLATE = { SIZE, C, R, R_LABEL, PAD };
export const angleOf = (i, n) => (-90 + (360 / n) * i) * Math.PI / 180;
export const pointAt = (i, n, radius) => {
  const a = angleOf(i, n);
  return [C + Math.cos(a) * radius, C + Math.sin(a) * radius];
};
export const polygonOf = (values, n, radius = R) =>
  values.map((v, i) => pointAt(i, n, Math.max(0.04, v) * radius).map(x => x.toFixed(2)).join(","))
        .join(" ");

const easeOutCubic = t => 1 - Math.pow(1 - t, 3);
const reduceMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

export class FateChart {
  /**
   * @param {SVGElement} svg  แท็ก <svg> เปล่าที่จะวาดลงไป
   * @param {string[]} labels ชื่อแกนตามลำดับ
   * @param {{labels?:boolean, values?:boolean, frame?:boolean}} opts
   */
  constructor(svg, labels, opts = {}) {
    this.svg = svg;
    this.labels = labels;
    this.n = labels.length;
    this.opts = { labels: true, values: false, frame: true, ...opts };
    this.values = new Array(this.n).fill(0);
    this.lead = -1;
    this.raf = 0;
    this.#build();
  }

  #build() {
    const { svg, n, opts } = this;
    svg.setAttribute("viewBox", `0 0 ${SIZE} ${SIZE}`);
    svg.setAttribute("class", "plate");
    svg.replaceChildren();

    /* กรอบสี่เหลี่ยมชั้นนอก + หมุดมุม — ยืมโครงจากผังดวงแบบเรือนชะตา
       ทำให้แผนภูมิดูเป็นแผ่นเครื่องมือ ไม่ใช่กราฟลอย ๆ */
    if (opts.frame) {
      svg.append(el("rect", {
        class: "plate__frame",
        x: PAD, y: PAD, width: SIZE - PAD * 2, height: SIZE - PAD * 2
      }));
      for (const [x, y] of [[PAD, PAD], [SIZE - PAD, PAD], [SIZE - PAD, SIZE - PAD], [PAD, SIZE - PAD]]) {
        svg.append(el("rect", {
          class: "plate__corner",
          x: x - 2.5, y: y - 2.5, width: 5, height: 5,
          transform: `rotate(45 ${x} ${y})`
        }));
      }
    }

    /* วงในสี่ชั้น = สเกล 25 / 50 / 75 / 100 เปอร์เซ็นต์ */
    for (const step of [0.25, 0.5, 0.75, 1]) {
      svg.append(el("polygon", {
        class: "plate__ring",
        points: polygonOf(new Array(n).fill(step), n)
      }));
    }

    this.spokes = [];
    for (let i = 0; i < n; i++) {
      const [x, y] = pointAt(i, n, R);
      const line = el("line", { class: "plate__spoke", x1: C, y1: C, x2: x, y2: y });
      this.spokes.push(line);
      svg.append(line);
    }

    this.area = el("polygon", {
      class: "plate__area",
      points: polygonOf(this.values, n)
    });
    svg.append(this.area);

    this.nodes = [];
    for (let i = 0; i < n; i++) {
      const node = el("circle", { class: "plate__node", cx: C, cy: C, r: 3 });
      this.nodes.push(node);
      svg.append(node);
    }

    this.labelEls = [];
    if (opts.labels) {
      for (let i = 0; i < n; i++) {
        const [x, y] = pointAt(i, n, R_LABEL);
        const t = el("text", { class: "plate__label", x: x.toFixed(1), y: y.toFixed(1) });
        t.textContent = this.labels[i];
        this.labelEls.push(t);
        svg.append(t);
      }
    }

    this.valueEls = [];
    if (opts.values) {
      for (let i = 0; i < n; i++) {
        const [x, y] = pointAt(i, n, R_LABEL);
        const t = el("text", {
          class: "plate__value",
          x: x.toFixed(1), y: (y + 10).toFixed(1)
        });
        t.textContent = "";
        this.valueEls.push(t);
        svg.append(t);
      }
    }

    this.#paint(this.values);
  }

  #paint(values) {
    this.area.setAttribute("points", polygonOf(values, this.n));
    for (let i = 0; i < this.n; i++) {
      const [x, y] = pointAt(i, this.n, Math.max(0.04, values[i]) * R);
      this.nodes[i].setAttribute("cx", x.toFixed(2));
      this.nodes[i].setAttribute("cy", y.toFixed(2));
      this.nodes[i].setAttribute("r", i === this.lead ? 4.5 : 3);
      if (this.valueEls[i]) {
        this.valueEls[i].textContent = values[i] > 0 ? Math.round(values[i] * 100) + "%" : "";
      }
    }
  }

  /** ค่อย ๆ ขยับรูปหลายเหลี่ยมไปยังค่าใหม่ — ไม่กระโดด ผู้ตอบจะเห็นว่าคำตอบมีผล */
  setValues(next, { duration = 620 } = {}) {
    cancelAnimationFrame(this.raf);
    const from = this.values.slice();
    const to = next.slice();
    if (reduceMotion() || duration === 0) {
      this.values = to;
      this.#paint(to);
      return Promise.resolve();
    }
    return new Promise(resolve => {
      let t0 = 0;
      const step = now => {
        if (!t0) t0 = now;
        const p = Math.min(1, (now - t0) / duration);
        const k = easeOutCubic(p);
        const mid = from.map((v, i) => v + (to[i] - v) * k);
        this.values = mid;
        this.#paint(mid);
        if (p < 1) this.raf = requestAnimationFrame(step);
        else resolve();
      };
      this.raf = requestAnimationFrame(step);
    });
  }

  /** ทำให้แกนหนึ่งวาบขึ้นมา ใช้ตอนคำตอบเพิ่งเพิ่มคะแนนให้แกนนั้น */
  pulse(i) {
    const s = this.spokes[i];
    if (!s) return;
    s.classList.remove("is-lit");
    void s.getBBox();          // บังคับให้เบราว์เซอร์เริ่มแอนิเมชันใหม่
    s.classList.add("is-lit");
  }

  /** แกนที่ชนะ — เปลี่ยนสีหมุดและป้ายเป็นสีสัญญาณ */
  setLead(i) {
    this.lead = i;
    this.labelEls.forEach((t, k) => t.classList.toggle("is-lead", k === i));
    this.nodes.forEach((c, k) => c.classList.toggle("is-lead", k === i));
    this.#paint(this.values);
  }

  /** ไฟวิ่งรอบแกนทีละอัน ใช้ตอนฉากประมวลผล */
  async sweep(rounds = 2, gap = 130) {
    if (reduceMotion()) return;
    for (let r = 0; r < rounds; r++) {
      for (let i = 0; i < this.n; i++) {
        this.pulse(i);
        await new Promise(res => setTimeout(res, gap));
      }
    }
  }

  /** ให้เส้นรอบรูปวาดตัวเองจากศูนย์ ใช้ครั้งเดียวตอนเปิดผล */
  drawIn() {
    if (reduceMotion()) return;
    /* getTotalLength บน <polygon> ไม่ได้รองรับเท่ากันทุกเบราว์เซอร์
       ถ้าเรียกไม่ได้ก็ใช้ค่าประมาณ เส้นยังวาดสวยอยู่ ดีกว่าปล่อยให้ทั้งฉากพัง */
    let len = 400;
    try { len = this.area.getTotalLength() || 400; } catch { /* ใช้ค่าประมาณ */ }
    this.svg.style.setProperty("--len", len.toFixed(1));
    this.svg.classList.remove("plate--draw");
    void this.svg.getBBox();
    this.svg.classList.add("plate--draw");
  }

  destroy() { cancelAnimationFrame(this.raf); }
}

/* ------------------------------------------------------------
   ตราเล็กของแต่ละสาย = ผังดวงอันเดียวกันที่ยื่นออกเพียงแกนเดียว
   หกสายจึงเป็นหกรูปทรงของแผนภูมิเดิม ไม่ต้องมีชุดไอคอนแยกต่างหาก
   ------------------------------------------------------------ */
export function renderPathGlyph(svg, axisIndex, total) {
  svg.setAttribute("viewBox", `0 0 ${SIZE} ${SIZE}`);
  svg.replaceChildren();
  svg.append(el("polygon", {
    class: "plate__frame",
    points: polygonOf(new Array(total).fill(1), total)
  }));
  /* แกนที่เหลือต้องมีเนื้ออยู่บ้าง ไม่งั้นตราขนาดเล็กจะอ่านเป็นเส้นบาง ๆ
     ไม่ใช่รูปหกเหลี่ยมที่ยื่นออกด้านเดียว */
  const values = new Array(total).fill(0.36);
  values[axisIndex] = 1;
  svg.append(el("polygon", {
    class: "plate__area",
    points: polygonOf(values, total)
  }));
  const [x, y] = pointAt(axisIndex, total, R);
  svg.append(el("circle", { class: "plate__node is-lead", cx: x.toFixed(1), cy: y.toFixed(1), r: 6 }));
}

/* ------------------------------------------------------------
   วงขอบแอสโตรเลบที่หมุนอยู่หลังทุกอย่าง — บรรยากาศล้วน ไม่มีข้อมูล
   แยกจากแผนภูมิจริงเพื่อไม่ให้ผู้ตอบอ่านมันเป็นตัวเลข
   ------------------------------------------------------------ */
export function renderSkyRim(svg) {
  const S = 400, c = S / 2;
  svg.setAttribute("viewBox", `0 0 ${S} ${S}`);
  svg.replaceChildren();
  const g = el("g", { fill: "none", stroke: "currentColor" });

  for (const r of [196, 178, 132]) {
    g.append(el("circle", { cx: c, cy: c, r, "stroke-width": .6, opacity: .5 }));
  }
  /* ขีดรอบวง 72 ขีด ทุกขีดที่ 6 ยาวกว่า = แบ่งเป็น 12 เรือนแบบผังดวง */
  for (let i = 0; i < 72; i++) {
    const a = (i / 72) * Math.PI * 2;
    const long = i % 6 === 0;
    const r1 = 178, r2 = long ? 196 : 188;
    g.append(el("line", {
      x1: (c + Math.cos(a) * r1).toFixed(1), y1: (c + Math.sin(a) * r1).toFixed(1),
      x2: (c + Math.cos(a) * r2).toFixed(1), y2: (c + Math.sin(a) * r2).toFixed(1),
      "stroke-width": long ? 1.1 : .55, opacity: long ? .85 : .45
    }));
  }
  /* หกเหลี่ยมจาง ๆ ตรงกลาง สะท้อนรูปทรงของแผ่นผังดวงหลัก */
  const hex = Array.from({ length: 6 }, (_, i) => {
    const a = (-90 + 60 * i) * Math.PI / 180;
    return `${(c + Math.cos(a) * 132).toFixed(1)},${(c + Math.sin(a) * 132).toFixed(1)}`;
  }).join(" ");
  g.append(el("polygon", { points: hex, "stroke-width": .6, opacity: .4 }));

  svg.append(g);
}
