/* ดึงไอคอน 3D ของแต่ละสายอาชีพจากชุด Fluent Emoji ของ Microsoft (MIT)
   อีโมจิที่เลือกตรงกับที่ระบุไว้ในเอกสารชุดคำถามชุดที่ 3

   เก็บไว้เป็นสคริปต์เพื่อให้ทำซ้ำได้ ไม่ใช่ไฟล์ที่จู่ ๆ ก็มีอยู่ในโปรเจกต์
   รันเมื่อเพิ่มหรือเปลี่ยนสายอาชีพเท่านั้น ไม่ได้อยู่ในขั้นตอน build ปกติ
   เพราะแอปต้องสร้างได้โดยไม่ต้องต่อเน็ต */

import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const OUT = resolve(ROOT, "public/icons3d");
const BASE = "https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets";

/* คีย์ = แกนในผังดวง · ชื่อโฟลเดอร์ = ชื่ออีโมจิตามที่ Microsoft ตั้งไว้ */
const ICONS = {
  dev:  ["Laptop",               "💻"],
  ux:   ["Artist palette",       "🎨"],
  ai:   ["Robot",                "🤖"],
  data: ["Bar chart",            "📊"],
  net:  ["Globe with meridians", "🌐"],
  sec:  ["Shield",               "🛡️"],
  game: ["Video game",           "🎮"],
  biz:  ["Rocket",               "🚀"]
};

const LICENSE = `ไอคอน 3D ในโฟลเดอร์นี้มาจาก Microsoft Fluent Emoji
https://github.com/microsoft/fluentui-emoji

MIT License · Copyright (c) Microsoft Corporation

อนุญาตให้ใช้ ทำสำเนา แก้ไข รวมเข้ากับงานอื่น เผยแพร่ และแจกจ่ายได้
โดยต้องแนบประกาศลิขสิทธิ์และประกาศอนุญาตนี้ไปกับสำเนาทุกชุด

ซอฟต์แวร์นี้ให้มาตามสภาพ โดยไม่มีการรับประกันใด ๆ

ไฟล์ในโฟลเดอร์นี้
${Object.entries(ICONS).map(([k, [name, ch]]) => `  ${k}.png  ${ch}  ${name}`).join("\n")}
`;

const slug = name => name.toLowerCase().replace(/[^a-z0-9]+/g, "_");

await mkdir(OUT, { recursive: true });

let total = 0;
for (const [key, [name]] of Object.entries(ICONS)) {
  const url = `${BASE}/${encodeURIComponent(name)}/3D/${slug(name)}_3d.png`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`ดึง ${key} ไม่สำเร็จ (${res.status}) — ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(resolve(OUT, `${key}.png`), buf);
  total += buf.length;
  console.log(`  ${key.padEnd(5)} ${name.padEnd(22)} ${(buf.length / 1024).toFixed(0)} KB`);
}

await writeFile(resolve(OUT, "LICENSE.txt"), LICENSE, "utf8");
console.log(`\nรวม ${Object.keys(ICONS).length} ไฟล์ · ${(total / 1024).toFixed(0)} KB`);
