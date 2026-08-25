import { PATHS, QUESTIONS, AXES, CEILING } from "../src/lib/data.js";

console.log("axes    :", AXES.join(" "));
console.log("questions:", QUESTIONS.length, "| options per q:", QUESTIONS.map(q => q.options.length).join(","));
console.log("ceilings:", AXES.map(k => `${k}=${CEILING[k]}`).join("  "));

// จำลองทุกเส้นทางคำตอบที่เป็นไปได้ แล้วนับว่าแต่ละแกนชนะกี่ครั้ง
// ทำเพื่อพิสูจน์ว่าหลัง normalize แล้วไม่มีแกนไหนถูกกันออกจากผลลัพธ์
const win = Object.fromEntries(AXES.map(k => [k, 0]));
let total = 0;
const walk = (qi, sc) => {
  if (qi === QUESTIONS.length) {
    total++;
    let best = AXES[0], bv = -1;
    for (const k of AXES) {
      const v = sc[k] / CEILING[k];
      if (v > bv + 1e-9) { bv = v; best = k; }
    }
    win[best]++;
    return;
  }
  for (const o of QUESTIONS[qi].options) {
    const next = { ...sc };
    for (const k in o.score) next[k] += o.score[k];
    walk(qi + 1, next);
  }
};
walk(0, Object.fromEntries(AXES.map(k => [k, 0])));

console.log("\nเส้นทางคำตอบทั้งหมด:", total.toLocaleString());
console.log("สัดส่วนที่แต่ละแกนได้เป็นผลลัพธ์ (หลัง normalize):");
for (const k of AXES) {
  const pct = win[k] / total * 100;
  const bar = "#".repeat(Math.round(pct / 2)).padEnd(25, ".");
  console.log(`  ${PATHS[k].axis.padEnd(10)} ${bar} ${pct.toFixed(1)}%  (${win[k].toLocaleString()})`);
}
const pcts = AXES.map(k => win[k] / total * 100);
console.log(`\nต่ำสุด ${Math.min(...pcts).toFixed(1)}%  สูงสุด ${Math.max(...pcts).toFixed(1)}%`);
