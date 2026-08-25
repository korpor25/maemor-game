/* ============================================================
   นับนิ้วจากกล้อง — วิธีเลือกคำตอบหลักของกิจกรรมนี้
   ชูนิ้วกี่นิ้ว = เลือกข้อนั้น ค้างไว้ครู่หนึ่งจึงยืนยัน

   ใช้ MediaPipe Hand Landmarker หาจุดสำคัญ 21 จุดต่อมือ แล้วตัดสินเองว่า
   นิ้วไหนเหยียดอยู่ ตัวโมเดลทำงานในเครื่องทั้งหมด ไม่มีการส่งภาพออกไปไหน

   ทำไมต้องใช้โมเดลจริง ไม่ใช้การตรวจก้อนวัตถุแบบเดิม:
   การนับนิ้วต้องรู้ตำแหน่งข้อต่อ ไม่ใช่แค่รู้ว่ามีอะไรบังกล้องตรงไหน
   วิธีดูเงาหรือรูปร่างด้วยตาเปล่าจะพังทันทีเมื่อพื้นหลังเป็นคนเดินไปมาแบบในงานนิทรรศการ
   ============================================================ */

const MP_DIR = "/mp";
const HOLD_MS = 1100;              // ค้างนิ้วนิ่งนานเท่านี้จึงนับว่าเลือก
const LOCK_MS = 1400;              // หลังเลือกแล้วหยุดรับ รอให้ลดมือลงก่อน
const LOST_GRACE_MS = 400;         // มือหลุดเฟรมชั่วครู่ ยังไม่รีเซ็ตทันที

/* เกณฑ์ตัดสินว่านิ้วเหยียด — วัดจากมุมที่ข้อกลางนิ้ว
   ใช้มุมแทนการเทียบความสูง เพราะมุมไม่เปลี่ยนตามการเอียงหรือหมุนมือ
   ผู้เล่นที่บูธไม่ได้ยกมือตั้งฉากกับกล้องเสมอไป */
const ANGLE_FINGER = 145;          // องศา ข้อ PIP ของสี่นิ้ว
const ANGLE_THUMB = 150;           // นิ้วโป้งงอน้อยกว่านิ้วอื่นโดยธรรมชาติ
const THUMB_AWAY = 0.55;           // นิ้วโป้งต้องกางออกจากฝ่ามืออย่างน้อยเท่านี้ของขนาดมือ

/* ลำดับข้อต่อของแต่ละนิ้ว [โคน, ข้อกลาง, ปลาย] */
const FINGERS = [
  { name: "index",  joints: [5, 6, 8] },
  { name: "middle", joints: [9, 10, 12] },
  { name: "ring",   joints: [13, 14, 16] },
  { name: "pinky",  joints: [17, 18, 20] }
];

/* เส้นเชื่อมสำหรับวาดโครงมือบนภาพ */
export const HAND_BONES = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20], [0, 17]
];

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, (a.z || 0) - (b.z || 0));

/* มุมที่จุด b ระหว่างแขน b→a และ b→c หน่วยเป็นองศา */
function angleAt(a, b, c) {
  const v1 = { x: a.x - b.x, y: a.y - b.y, z: (a.z || 0) - (b.z || 0) };
  const v2 = { x: c.x - b.x, y: c.y - b.y, z: (c.z || 0) - (b.z || 0) };
  const dot = v1.x * v2.x + v1.y * v2.y + v1.z * v2.z;
  const m = Math.hypot(v1.x, v1.y, v1.z) * Math.hypot(v2.x, v2.y, v2.z);
  if (!m) return 180;
  return Math.acos(Math.max(-1, Math.min(1, dot / m))) * 180 / Math.PI;
}

/* คืนสถานะการเหยียดของนิ้วทั้งห้า เรียงจากโป้งไปก้อย */
export function readFingers(lm) {
  const wrist = lm[0];
  const palm = dist(wrist, lm[9]) || 1;      // ใช้เป็นหน่วยวัดขนาดมือ

  /* นิ้วโป้งต้องดูสองอย่าง: ข้อไม่งอ และกางออกจากฝ่ามือจริง
     ถ้าดูแค่มุม นิ้วโป้งที่พับทับฝ่ามือจะยังนับว่าเหยียดอยู่ */
  const thumbStraight = angleAt(lm[2], lm[3], lm[4]) > ANGLE_THUMB;
  const thumbAway = dist(lm[4], lm[17]) / palm > THUMB_AWAY;
  const out = [thumbStraight && thumbAway];

  for (const f of FINGERS) {
    const [mcp, pip, tip] = f.joints;
    out.push(angleAt(lm[mcp], lm[pip], lm[tip]) > ANGLE_FINGER);
  }
  return out;
}

export const countFingers = lm => readFingers(lm).filter(Boolean).length;

/* ไฟล์ก้อนใหญ่สองไฟล์ที่ต้องโหลดก่อนใช้งาน พร้อมขนาดโดยประมาณสำหรับคำนวณเปอร์เซ็นต์
   ขนาดจริงหลังบีบอัดจะน้อยกว่านี้ จึงใช้ค่าที่อ่านจาก Content-Length ถ้าเซิร์ฟเวอร์ส่งมา */
const BIG_FILES = [
  { url: `${MP_DIR}/wasm/vision_wasm_internal.wasm`, approx: 11_756_954 },
  { url: `${MP_DIR}/hand_landmarker.task`, approx: 7_819_105 }
];

/* ดึงไฟล์โมเดลเองเพื่อรายงานความคืบหน้าให้ผู้ใช้เห็น
   MediaPipe ดึงไฟล์เองภายในโดยไม่บอกความคืบหน้า ถ้าปล่อยให้มันโหลดเงียบ ๆ
   ผู้ใช้บน WiFi งานที่ช้าจะเห็นแค่หน้าจอค้างโดยไม่รู้ว่าต้องรออีกนานแค่ไหน
   เมื่อโหลดผ่านที่นี่แล้ว การดึงซ้ำของ MediaPipe จะได้จากแคชทันที */
export async function prefetchModel(onProgress) {
  const total = BIG_FILES.reduce((s, f) => s + f.approx, 0);
  let done = 0;

  for (const file of BIG_FILES) {
    const url = file.url;
    let res;
    try {
      res = await fetch(url);
    } catch {
      return false;                       // ออฟไลน์และยังไม่เคยแคช — ปล่อยให้แตะจอเล่นไปก่อน
    }
    if (!res.ok) return false;

    const len = +(res.headers.get("content-length") || 0) || file.approx;
    if (!res.body) { done += file.approx; onProgress?.(done / total); continue; }

    const reader = res.body.getReader();
    let got = 0;
    for (;;) {
      const { done: end, value } = await reader.read();
      if (end) break;
      got += value.length;
      /* เทียบสัดส่วนภายในไฟล์นี้แล้วคูณด้วยขนาดที่คาดไว้ ตัวเลขจึงเดินสม่ำเสมอ
         แม้เซิร์ฟเวอร์จะส่งไฟล์ที่ถูกบีบอัดมาแล้วก็ตาม */
      onProgress?.(Math.min(1, (done + file.approx * (got / len)) / total));
    }
    done += file.approx;
    onProgress?.(Math.min(1, done / total));
  }
  return true;
}

export class HandCounter {
  /**
   * @param {object} handlers { onProgress, onStatus, onPick, onFrame }
   */
  constructor(handlers = {}) {
    this.on = handlers;
    this.landmarker = null;
    this.loading = null;
    this.video = null;
    this.stream = null;
    this.running = false;
    this.raf = 0;
    this.maxCount = 5;
    this.held = 0;
    this.heldValue = 0;
    this.lostFor = 0;
    this.lockUntil = 0;
    this.lastT = 0;
    this.lastVideoTime = -1;
  }

  get ready() { return !!this.landmarker && !!this.stream; }

  /** โหลดโมเดล — ก้อนใหญ่ จึงเรียกแยกจากการเปิดกล้องเพื่อให้โหลดคู่ขนานกันได้ */
  load() {
    if (this.loading) return this.loading;
    this.loading = (async () => {
      this.on.onStatus?.("loading");
      const { FilesetResolver, HandLandmarker } = await import(/* webpackIgnore: true */ `${MP_DIR}/vision_bundle.mjs`);
      const fileset = await FilesetResolver.forVisionTasks(`${MP_DIR}/wasm`);
      this.landmarker = await HandLandmarker.createFromOptions(fileset, {
        baseOptions: {
          modelAssetPath: `${MP_DIR}/hand_landmarker.task`,
          delegate: "GPU"
        },
        runningMode: "VIDEO",
        /* มือเดียวพอ เพราะทุกข้อมีไม่เกินห้าตัวเลือก
           รับมือเดียวยังเร็วกว่า และตัดโอกาสที่มือของคนที่เดินผ่านจะถูกนับรวมเข้ามา */
        numHands: 1,
        minHandDetectionConfidence: 0.5,
        minHandPresenceConfidence: 0.5,
        minTrackingConfidence: 0.5
      });
      this.on.onStatus?.("loaded");
      return this.landmarker;
    })().catch(err => {
      this.loading = null;
      this.on.onStatus?.("failed", { message: String(err?.message || err) });
      throw err;
    });
    return this.loading;
  }

  async openCamera(video) {
    this.video = video;
    if (this.stream) return true;
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 960 }, height: { ideal: 720 } },
        audio: false
      });
      video.srcObject = this.stream;
      await video.play().catch(() => { });
      this.on.onStatus?.("camera");
      return true;
    } catch {
      this.on.onStatus?.("denied");
      return false;
    }
  }

  closeCamera() {
    this.stop();
    this.stream?.getTracks().forEach(t => t.stop());
    this.stream = null;
    if (this.video) this.video.srcObject = null;
    this.on.onStatus?.("off");
  }

  /** จำนวนตัวเลือกของข้อปัจจุบัน ใช้ตัดจำนวนนิ้วที่เกินทิ้ง */
  setRange(maxCount) {
    this.maxCount = maxCount;
    this.reset();
  }

  reset() {
    this.held = 0;
    this.heldValue = 0;
    this.lostFor = 0;
  }

  start() {
    if (this.running || !this.ready) return;
    this.running = true;
    this.lastT = 0;
    this.reset();
    this.raf = requestAnimationFrame(this.#tick);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  #tick = now => {
    if (!this.running) return;
    const dt = this.lastT ? Math.min(120, now - this.lastT) : 16;
    this.lastT = now;
    const v = this.video;

    if (!v || v.readyState < 2 || !this.landmarker) {
      this.raf = requestAnimationFrame(this.#tick);
      return;
    }

    /* detectForVideo ต้องได้เวลาที่เดินหน้าเสมอ ถ้าเฟรมยังไม่เปลี่ยนก็ข้ามไป
       ไม่งั้นโมเดลจะโยน error เรื่อง timestamp ย้อนหลัง */
    let hands = [];
    if (v.currentTime !== this.lastVideoTime) {
      this.lastVideoTime = v.currentTime;
      try {
        const res = this.landmarker.detectForVideo(v, now);
        hands = res?.landmarks || [];
      } catch { /* เฟรมเสีย ข้ามไปเฟรมถัดไป */ }
    }

    const perHand = hands.map(lm => ({ landmarks: lm, fingers: readFingers(lm) }));
    const raw = perHand.reduce((s, h) => s + h.fingers.filter(Boolean).length, 0);
    const value = Math.min(raw, this.maxCount);
    const locked = now < this.lockUntil;

    if (!hands.length) {
      /* มือหลุดเฟรม — ผ่อนผันสั้น ๆ ก่อนล้างค่า มือสั่นหรือออกนอกขอบชั่วครู่จะได้ไม่ต้องเริ่มใหม่ */
      this.lostFor += dt;
      if (this.lostFor > LOST_GRACE_MS) { this.held = 0; this.heldValue = 0; }
    } else {
      this.lostFor = 0;
      if (value >= 1 && value === this.heldValue && !locked) {
        this.held = Math.min(HOLD_MS, this.held + dt);
      } else {
        this.heldValue = value;
        this.held = 0;
      }
    }

    this.on.onFrame?.({ hands: perHand, count: value, raw });
    this.on.onProgress?.({
      count: this.held > 0 ? this.heldValue : (hands.length ? value : 0),
      progress: this.held / HOLD_MS,
      seen: hands.length > 0,
      locked
    });

    if (this.held >= HOLD_MS && !locked && this.heldValue >= 1) {
      const picked = this.heldValue;
      this.lockUntil = now + LOCK_MS;
      this.reset();
      this.on.onProgress?.({ count: 0, progress: 0, seen: true, locked: true });
      this.on.onPick?.(picked);
    }

    this.raf = requestAnimationFrame(this.#tick);
  };
}
