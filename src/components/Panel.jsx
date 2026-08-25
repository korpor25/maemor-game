"use client";

/* แผงบันทึกผู้เข้าร่วม สำหรับเจ้าหน้าที่บูธ
   ข้อมูลอยู่ใน localStorage ของเครื่องนั้นเท่านั้น ไม่มีเซิร์ฟเวอร์ */

import { useEffect, useMemo, useRef } from "react";
import { PATHS, AXES } from "@/lib/data";
import { readLog, summarise, clearLog, downloadCsv } from "@/lib/stats";

const fmt = s => (s >= 60 ? `${Math.floor(s / 60)} นาที ${s % 60} วินาที` : `${s} วินาที`);

export default function Panel({ onClose }) {
  const closeRef = useRef(null);
  const log = useMemo(() => readLog(), []);
  const s = useMemo(() => summarise(log), [log]);

  /* กันแท็บไม่ให้หลุดไปโดนปุ่มที่อยู่หลังแผง
     aria-modal บอกแค่โปรแกรมอ่านหน้าจอ ไม่ได้ล็อกโฟกัสจริง */
  useEffect(() => {
    const app = document.querySelector(".app");
    if (app) app.inert = true;
    closeRef.current?.focus();
    return () => { if (app) app.inert = false; };
  }, []);

  const wipe = () => {
    if (confirm("ล้างบันทึกผู้เข้าร่วมทั้งหมดในเครื่องนี้?")) { clearLog(); onClose(); }
  };

  return (
    <div className="panel" role="dialog" aria-modal="true" aria-label="บันทึกผู้เข้าร่วมกิจกรรม">
      <div className="panel__in">
        <div className="stack">
          <p className="tag tag--blue">สำหรับเจ้าหน้าที่บูธ</p>
          <h2 className="lg">บันทึกผู้เข้าร่วมกิจกรรม</h2>
          <p className="fine">เก็บอยู่ในเครื่องนี้เท่านั้น ไม่ถูกส่งออกไปที่ใด</p>
        </div>

        <div className="stats">
          <Stat value={s.today} label="วันนี้" />
          <Stat value={s.all} label="ทั้งหมด" />
          <Stat value={s.avgSeconds ? `${s.avgSeconds}s` : "—"} label="เวลาเฉลี่ยต่อคน" />
          <Stat value={s.top ? PATHS[s.top].name : "—"} label="ผลที่พบบ่อยที่สุด" small />
        </div>

        <div className="stack">
          <h3 className="tag tag--blue">การกระจายของผลลัพธ์</h3>
          <div className="dist">
            {AXES.map(k => {
              const n = s.counts[k];
              const pct = s.all ? (n / s.all) * 100 : 0;
              return (
                <div key={k} className="dist__row">
                  <span className="tag">{PATHS[k].axis}</span>
                  <span className="dist__track">
                    <i style={{ width: `${s.maxCount ? (n / s.maxCount) * 100 : 0}%` }} />
                  </span>
                  <span className="code">{s.all ? `${n} · ${pct.toFixed(0)}%` : "0"}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="tablewrap">
          <table>
            <thead>
              <tr><th>วันที่</th><th>เวลา</th><th>รอบ</th><th>ผลการสำรวจ</th><th>ใช้เวลา</th></tr>
            </thead>
            <tbody>
              {log.length === 0 ? (
                <tr><td colSpan={5}>ยังไม่มีผู้เข้าร่วมในเครื่องนี้</td></tr>
              ) : (
                log.slice().reverse().slice(0, 200).map(r => (
                  <tr key={r.sid}>
                    <td className="num">{r.date}</td>
                    <td className="num">{r.time}</td>
                    <td className="num">{r.sid}</td>
                    <td>{PATHS[r.path]?.name || r.path}</td>
                    <td className="num">{fmt(r.seconds || 0)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="row">
          <button className="btn btn--ghost btn--sm" onClick={downloadCsv}>ดาวน์โหลด CSV</button>
          <button className="btn btn--ghost btn--sm" onClick={wipe}>ล้างข้อมูล</button>
          <button className="btn btn--sm" ref={closeRef} onClick={onClose}>ปิด</button>
        </div>
      </div>
    </div>
  );
}

function Stat({ value, label, small }) {
  return (
    <div className="stat">
      <b className={small ? "stat__v stat__v--sm" : "stat__v"}>{value}</b>
      <span className="code">{label}</span>
    </div>
  );
}
