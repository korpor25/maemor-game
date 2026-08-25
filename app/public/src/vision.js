/* ============================================================
   ตรวจจับ "มือที่ยกค้าง" สำหรับโหมดบูธ
   ทำงานในเครื่องทั้งหมด ไม่มีการอัปโหลดหรือบันทึกภาพ

   ปัญหาจริงของบูธนิทรรศการที่อัลกอริทึมนี้ต้องรับมือ:
     · มีคนเดินผ่านหลังผู้เล่นตลอดเวลา
     · ผู้เล่นยืนนิ่งอยู่หน้ากล้อง ตัวและใบหน้ากินพื้นที่มากกว่ามือเสียอีก
     · แสงในฮอลล์เปลี่ยนเมื่อมีคนบังไฟหรือเปิดประตู
   จึงไม่ใช้ "ต่างจากพื้นหลังเท่าไร" อย่างเดียว แต่รวมสามอย่าง:
     1. โมเดลพื้นหลังสองความเร็ว — จุดว่างปรับไว จุดที่มีวัตถุปรับช้า
     2. การกลืนของที่นิ่งเกิน AGE_MS เป็นพื้นหลัง (ตัวคนที่ยืนรอจึงหายไป เหลือแต่มือที่เพิ่งยก)
     3. ถ่วงน้ำหนักแถวบน — มือที่ยกขึ้นอยู่สูงกว่าหัวเสมอ
   ============================================================ */

const W = 96, H = 54;                  // ความละเอียดที่ใช้วิเคราะห์ (สัดส่วนใกล้กรอบ 16:9 ที่ผู้เล่นเห็น)
const HOLD_MS = 1400;                  // ยกมือค้างนานเท่านี้จึงนับว่าเลือก
const LOCK_MS = 1500;                  // หลังเลือกแล้วหยุดรับคำสั่ง รอให้ลดมือลง
const A_BG = 0.020;                    // อัตราปรับพื้นหลังของจุดว่าง ต่อเฟรมมาตรฐาน
const A_FG = 0.0016;                   // จุดที่เห็นเป็นวัตถุ ปรับช้ากว่ามาก มือที่ยกค้างจึงไม่จมหาย
const AGE_MS = 2500;                   // ของที่นิ่งอยู่กับที่นานกว่านี้ ให้กลืนเป็นพื้นหลัง
const MOVE_CAP = 10;                   // ค่าความขยับเฉลี่ยต่อจุด เกินนี้ถือว่าภาพกำลังเปลี่ยนทั้งจอ
const FLOOD = 0.60;                    // ต่างจากพื้นหลังเกินสัดส่วนนี้ = แสงเปลี่ยนยกจอ ต้องจำใหม่
const SETTLE_MS = 500;                 // หลังภาพนิ่งแล้ว รออีกเท่านี้จึงเริ่มเชื่อผลตรวจ
const WARM_MS = 600;                   // จำพื้นหลังนานเท่านี้ก่อนเริ่มตัดสิน
const RELEARN_MS = 700;                // ภาพวุ่นวายนานเกินนี้ พอสงบให้จำพื้นหลังใหม่ทั้งหมด

const THRESHOLD = [0, 32, 25, 19, 14, 10];        // ดัชนีคือระดับความไว 1–5
const NEED_RATIO = [0, .15, .115, .085, .062, .046];

export class HandVision {
  /**
   * @param {HTMLVideoElement} video
   * @param {HTMLCanvasElement} canvas  แคนวาสเล็กสำหรับวิเคราะห์ (ซ่อนไว้)
   * @param {object} handlers { onAim, onProgress, onStatus, onPick }
   */
  constructor(video, canvas, handlers = {}) {
    this.video = video;
    this.ctx = canvas.getContext("2d", { willReadFrequently: true });
    this.on = handlers;

    this.zones = 0;
    this.sens = 4;
    this.stream = null;
    this.running = false;
    this.ready = false;
    this.raf = 0;
    this.lastT = 0;
    this.lockUntil = 0;

    /* จองบัฟเฟอร์ครั้งเดียวแล้วใช้ซ้ำทุกเฟรม — ไม่สร้างขยะให้ GC ที่ 60fps */
    const n = W * H;
    this.cur = new Float32Array(n);
    this.prev = new Float32Array(n);
    this.bg = new Float32Array(n);
    this.age = new Float32Array(n);
    this.fgMask = new Uint8Array(n);
    this.solid = new Uint8Array(n);

    this.reset();
  }

  /** ลืมพื้นหลังเดิมทั้งหมด เรียกเมื่อสลับข้อ เปลี่ยนความไว หรือกรอบภาพเปลี่ยน */
  reset() {
    this.hasBg = false;
    this.warmup = 0;
    this.settle = 0;
    this.busyMs = 0;
    this.dwell = new Array(this.zones).fill(0);
    this.age.fill(0);
  }

  setZones(n) {
    this.zones = n;
    this.dwell = new Array(n).fill(0);
    this.reset();
  }

  setSensitivity(level) {
    this.sens = Math.min(5, Math.max(1, level | 0));
    this.reset();
  }

  async open() {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" },
        audio: false
      });
      this.video.srcObject = this.stream;
      this.ready = true;
      this.reset();
      this.on.onStatus?.("ready");
      return true;
    } catch {
      this.ready = false;
      this.on.onStatus?.("denied");
      return false;
    }
  }

  close() {
    this.stream?.getTracks().forEach(t => t.stop());
    this.stream = null;
    this.video.srcObject = null;
    this.ready = false;
    this.stop();
    this.reset();
    this.on.onStatus?.("off");
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.lastT = 0;
    this.lockUntil = 0;
    this.raf = requestAnimationFrame(this.#tick);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  /* วิดีโอถูกแสดงแบบ object-fit:cover จึงถูกครอบขอบทิ้ง
     ต้องวิเคราะห์เฉพาะส่วนที่ผู้เล่นมองเห็นจริง ไม่งั้นมือที่บังเต็มช่องบนจอ
     จะถูกคิดเป็นสัดส่วนเล็กนิดเดียวของเฟรมเต็มจนตรวจไม่เจอ */
  #sourceRect() {
    const v = this.video;
    const vw = v.videoWidth, vh = v.videoHeight;
    const cw = v.clientWidth, ch = v.clientHeight;
    if (!vw || !vh || !cw || !ch) return { sx: 0, sy: 0, sw: vw || 1, sh: vh || 1 };
    const scale = Math.max(cw / vw, ch / vh);
    const sw = Math.min(vw, cw / scale), sh = Math.min(vh, ch / scale);
    return { sx: (vw - sw) / 2, sy: (vh - sh) / 2, sw, sh };
  }

  #tick = now => {
    if (!this.running) return;
    const dt = this.lastT ? Math.min(100, now - this.lastT) : 16;
    this.lastT = now;
    const v = this.video;

    if (!this.ready || !v.videoWidth || v.readyState < 2 || this.zones < 1) {
      this.raf = requestAnimationFrame(this.#tick);
      return;
    }

    const { sx, sy, sw, sh } = this.#sourceRect();
    this.ctx.drawImage(v, sx, sy, sw, sh, 0, 0, W, H);
    const data = this.ctx.getImageData(0, 0, W, H).data;
    const { cur, prev, bg, age, fgMask, solid } = this;
    for (let i = 0, p = 0; i < cur.length; i++, p += 4) {
      cur[i] = (data[p] + data[p + 1] + data[p + 2]) / 3;
    }

    /* ยังไม่มีพื้นหลัง — ถ้าเพิ่งเลือกไป ต้องรอพ้นช่วงล็อกก่อน
       ไม่งั้นมือที่ยังยกค้างอยู่จะถูกจำเป็นพื้นหลัง แล้วข้อถัดไปจะตรวจไม่เจอ */
    if (!this.hasBg) {
      if (performance.now() < this.lockUntil) {
        prev.set(cur);
        this.raf = requestAnimationFrame(this.#tick);
        return;
      }
      bg.set(cur); prev.set(cur); age.fill(0);
      this.hasBg = true; this.warmup = 0;
      this.raf = requestAnimationFrame(this.#tick);
      return;
    }
    this.warmup += dt;

    const n = this.zones;
    const TH = THRESHOLD[this.sens];
    const NEED = NEED_RATIO[this.sens];

    /* รอบที่ 1 — จุดที่ต่างจากพื้นหลัง และภาพขยับมากแค่ไหนเทียบเฟรมก่อน */
    let allFg = 0, move = 0;
    for (let i = 0; i < cur.length; i++) {
      const isFg = Math.abs(cur[i] - bg[i]) > TH;
      fgMask[i] = isFg ? 1 : 0;
      if (isFg) allFg++;
      move += Math.abs(cur[i] - prev[i]);
    }
    move /= cur.length;

    /* รอบที่ 2 — กัดขอบทิ้ง จุดที่นับต้องมีเพื่อนบ้านเป็นวัตถุอย่างน้อย 5 ใน 8
       ขอบเงาบางที่เกิดตอนคนเอียงตัวจะหายไป เหลือแต่ก้อนใหญ่จริงอย่างฝ่ามือ */
    solid.fill(0);
    for (let y = 1; y < H - 1; y++) {
      for (let x = 1; x < W - 1; x++) {
        const i = y * W + x;
        if (!fgMask[i]) continue;
        const c = fgMask[i - W - 1] + fgMask[i - W] + fgMask[i - W + 1]
                + fgMask[i - 1]                     + fgMask[i + 1]
                + fgMask[i + W - 1] + fgMask[i + W] + fgMask[i + W + 1];
        if (c >= 5) solid[i] = 1;
      }
    }

    /* รอบที่ 3 — รวมคะแนนรายช่อง ถ่วงน้ำหนักแถวบนมากกว่า
       ภาพบนจอถูกกลับซ้าย-ขวา จึงกลับคอลัมน์ให้ตรงกับที่ผู้เล่นเห็น */
    const fg = new Array(n).fill(0), tot = new Array(n).fill(0);
    for (let y = 0; y < H; y++) {
      const wy = 1 + 0.6 * (1 - y / (H - 1));
      for (let x = 0; x < W; x++) {
        const z = Math.min(n - 1, Math.floor((W - 1 - x) / (W / n)));
        if (solid[y * W + x]) fg[z] += wy;
        tot[z] += wy;
      }
    }

    const busy = move > MOVE_CAP || allFg / cur.length > FLOOD;
    this.settle = busy ? SETTLE_MS : Math.max(0, this.settle - dt);
    this.busyMs = busy ? this.busyMs + dt : this.busyMs;

    /* ภาพเพิ่งวุ่นวายมานาน (มีคนเดินเข้ามายืน) พอสงบแล้วให้จำพื้นหลังใหม่
       กันพลาด: ถ้ากำลังนับมือที่ยกค้างอยู่ ห้ามจำใหม่ ไม่งั้นมือจะกลายเป็นพื้นหลังเสียเอง */
    const holding = this.dwell.some(d => d > 200);
    if (!busy && this.settle === 0 && this.busyMs > RELEARN_MS && !holding) {
      this.busyMs = 0;
      this.hasBg = false;
      this.warmup = 0;
      this.on.onStatus?.("relearn");
      this.raf = requestAnimationFrame(this.#tick);
      return;
    }
    if (!busy && this.settle === 0) this.busyMs = 0;

    const ratio = fg.map((f, i) => f / tot[i]);
    let best = 0;
    for (let i = 1; i < n; i++) if (ratio[i] > ratio[best]) best = i;
    const second = n > 1 ? Math.max(...ratio.filter((_, i) => i !== best)) : 0;
    const settled = this.warmup > WARM_MS && !busy && this.settle === 0;
    /* ต้องชนะที่สองอย่างน้อย 25% ด้วย — กันกรณีมือคร่อมสองช่องแล้วสุ่มเลือก */
    const aiming = settled && ratio[best] > NEED && ratio[best] > second * 1.25;
    const locked = performance.now() < this.lockUntil;

    if (aiming && !locked) {
      this.dwell[best] = Math.min(HOLD_MS, this.dwell[best] + dt);
      for (let i = 0; i < n; i++) if (i !== best) this.dwell[i] = Math.max(0, this.dwell[i] - dt * 2);
    } else {
      /* ลดช้ากว่าตอนสะสม มือสั่นหรือหลุดเฟรมชั่วครู่จึงไม่ทำให้เริ่มนับใหม่ */
      for (let i = 0; i < n; i++) this.dwell[i] = Math.max(0, this.dwell[i] - dt * 0.6);
    }

    this.on.onProgress?.(this.dwell.map(d => d / HOLD_MS), aiming && !locked ? best : -1);
    this.on.onStatus?.(
      busy ? "busy" : !settled ? "learning" : aiming ? "aiming" : "idle",
      { zone: best + 1, remain: Math.max(0, (HOLD_MS - this.dwell[best]) / 1000) }
    );

    if (this.dwell[best] >= HOLD_MS && !locked) {
      this.lockUntil = performance.now() + LOCK_MS;
      this.dwell = new Array(n).fill(0);
      this.hasBg = false;                 // ขึ้นข้อใหม่ ให้จำพื้นหลังใหม่ทุกครั้ง
      this.on.onProgress?.(this.dwell, -1);
      this.on.onPick?.(best);
      this.raf = requestAnimationFrame(this.#tick);
      return;
    }

    /* ปรับพื้นหลัง: จุดว่างปรับไวตามแสง จุดที่มีวัตถุปรับช้า
       ส่วนของที่อยู่นิ่งเกิน AGE_MS ให้กลืนเป็นพื้นหลัง เหลือแต่มือที่เพิ่งยกขึ้น */
    const k = dt / 16.7;
    const rFg = Math.min(1, A_FG * k), rBg = Math.min(1, A_BG * k);
    for (let i = 0; i < cur.length; i++) {
      if (fgMask[i] && !busy) age[i] += dt; else age[i] = 0;
      const rate = (fgMask[i] && !busy && age[i] < AGE_MS) ? rFg : rBg;
      bg[i] += (cur[i] - bg[i]) * rate;
    }
    prev.set(cur);

    this.raf = requestAnimationFrame(this.#tick);
  };
}
