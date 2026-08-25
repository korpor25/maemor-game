"use client";

/* หน้าเปิด — วางเป็นตารางเต็มความสูงจอ ไม่ใช่กองเนื้อหากลางหน้า
   แถวบนคือข้อมูลกำกับสามคอลัมน์ แถวล่างคือพาดหัวขนาดใหญ่ที่ยึดมุมซ้าย
   โครงนี้ทำให้หน้าอ่านได้เป็นลำดับ: รู้ว่าคืออะไร แล้วค่อยเจอคำเชิญ */

import Plate from "@/components/Plate";

const FACTS = ["6 ข้อ", "ราว 3 นาที", "ไม่มีคำตอบถูกผิด", "ไม่เก็บข้อมูลส่วนตัว"];

export default function Intro({ values, labels, onStart, onPaths }) {
  return (
    <section className="screen intro">
      <div className="intro__top">
        <div className="intro__plate">
          <Plate values={values} labels={labels} showLabels duration={1400} />
        </div>
        <div className="intro__col">
          <p className="tag tag--blue">แบบสำรวจความสนใจ</p>
          <p className="body">
            ตอบคำถามหกข้อเกี่ยวกับความสนใจและทักษะของคุณ
            แล้วอ่านผลเป็นผังดวงหกแกน
          </p>
        </div>
        <div className="intro__col">
          <p className="tag tag--blue">เล่นด้วยการชูนิ้ว</p>
          <p className="body">
            ยกมือขึ้นหน้ากล้องแล้วชูนิ้วให้ตรงกับหมายเลขคำตอบ
            ภาพถูกประมวลผลในเครื่อง ไม่ถูกบันทึกและไม่ถูกส่งออก
          </p>
        </div>
      </div>

      <div className="intro__hero">
        <p className="code">แม่หมอ VR · IT · RMUTL Lampang</p>
        <h1 className="xl intro__title">
          <span>ชูนิ้ว อ่าน<em>ผังดวง</em></span>
          <span>อาชีพของคุณ</span>
        </h1>

        <ul className="facts">
          {FACTS.map(f => <li key={f} className="tag">{f}</li>)}
        </ul>

        <div className="row intro__actions">
          <button className="btn" onClick={onStart}>เริ่มทำแบบสำรวจ</button>
          <button className="btn btn--ghost" onClick={onPaths}>ดูสายอาชีพทั้ง 6</button>
        </div>
      </div>
    </section>
  );
}
