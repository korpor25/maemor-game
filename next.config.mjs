/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  /* แอปนี้ไม่มีตรรกะฝั่งเซิร์ฟเวอร์เลย จึง export เป็นไฟล์สแตติกล้วน
     ได้สองอย่าง: เสิร์ฟเร็วที่สุดและไม่ต้องมีเซิร์ฟเวอร์คอยรัน
     กับ service worker ที่รู้ชื่อไฟล์ทุกไฟล์หลัง build เพราะอยู่ใน out/ ทั้งหมด
     ข้อแลกเปลี่ยน: headers() ใช้ไม่ได้ในโหมดนี้ จึงย้ายไปตั้งใน vercel.json แทน */
  output: "export",
  images: { unoptimized: true },
  trailingSlash: false
};
export default nextConfig;
