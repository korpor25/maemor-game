"use client";

/* บทเรียนสอนเล่น — เปิดอัตโนมัติครั้งแรกที่เข้าหน้าคำถาม แล้วเรียกซ้ำได้จากปุ่ม
   สอนสามอย่างที่ผู้เล่นต้องรู้ก่อนเริ่มจริง: อนุญาตกล้อง · ชูนิ้วให้ตรงเลข · ค้างไว้จนครบ

   ท่ามือที่แสดงเป็นโมเดล 3D ที่ขึ้นรูปจากพิกัดข้อต่อชุดเดียวกับที่ระบบใช้ตัดสิน
   ท่าในบทเรียนจึงเป็นท่าที่นับได้จริง ไม่ใช่ภาพประกอบที่วาดขึ้นต่างหาก */

import { useEffect } from "react";
import HandPose3D, { usePoseCycle } from "@/components/HandPose3D";

const STEPS = [
  ["อนุญาตให้ใช้กล้อง", "กดอนุญาตเมื่อเบราว์เซอร์ถาม ภาพถูกประมวลผลในเครื่องนี้เท่านั้น ไม่ถูกบันทึกและไม่ถูกส่งออก"],
  ["ชูนิ้วให้ตรงกับหมายเลข", "ยกมือขึ้นหน้ากล้องให้เห็นเต็มฝ่ามือ กางนิ้วออกจากกัน ชูกี่นิ้วก็คือเลือกข้อนั้น"],
  ["ค้างไว้จนวงแหวนเต็ม", "ถือท่าเดิมนิ่งไว้ครู่หนึ่ง ถ้าเลขยังไม่ตรงก็เปลี่ยนท่าได้ทันที ยังไม่ถือว่าตอบ"]
];

export default function Tutorial({ onClose }) {
  const { index, pose } = usePoseCycle(1700);

  useEffect(() => {
    const onKey = e => { if (e.code === "Escape") onClose(); };
    addEventListener("keydown", onKey);
    const app = document.querySelector(".app");
    if (app) app.inert = true;
    return () => {
      removeEventListener("keydown", onKey);
      if (app) app.inert = false;
    };
  }, [onClose]);

  return (
    <div className="tut" role="dialog" aria-modal="true" aria-label="วิธีเล่น">
      <div className="tut__card surface">
        <header className="tut__head">
          <p className="tag tag--blue">วิธีเล่น</p>
          <h2 className="lg">ตอบด้วยการชูนิ้ว</h2>
        </header>

        <div className="tut__demo">
          <HandPose3D poseIndex={index} />
          <div className="tut__count">
            <b className="num">{pose.count}</b>
            <span className="fine">{pose.label}</span>
          </div>
        </div>

        <ol className="tut__steps">
          {STEPS.map(([title, text], i) => (
            <li key={title}>
              <span className="tut__n num">{i + 1}</span>
              <div>
                <b className="tut__t">{title}</b>
                <p className="fine">{text}</p>
              </div>
            </li>
          ))}
        </ol>

        <p className="fine tut__note">
          ทุกข้อมีไม่เกินห้าตัวเลือก ใช้มือเดียวพอ · ไม่สะดวกใช้กล้องก็แตะเลือกได้ตลอด
        </p>

        <button className="btn tut__go" onClick={onClose}>เข้าใจแล้ว เริ่มเลย</button>
      </div>
    </div>
  );
}
