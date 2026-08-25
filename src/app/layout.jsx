import "./globals.css";
import "./app.css";

export const metadata = {
  title: "ผังดวงอาชีพ — แบบสำรวจความสนใจด้านเทคโนโลยีและอาชีพดิจิทัล",
  description:
    "ตอบ 7 ข้อด้วยการชูนิ้วหน้ากล้อง แล้วอ่านผลเป็นผังดวงแปดแกนที่บอกว่าคุณเอนไปทางสายงานดิจิทัลใด " +
    "โดยหลักสูตรเทคโนโลยีสารสนเทศ มทร.ล้านนา ลำปาง",
  manifest: "/app.webmanifest",
  applicationName: "ผังดวงอาชีพ",
  appleWebApp: { capable: true, title: "ผังดวงอาชีพ", statusBarStyle: "default" },
  icons: {
    icon: [{ url: "/icons/icon.svg", type: "image/svg+xml" }],
    apple: "/icons/icon-192.png"
  }
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#BDD8EF"
};

export default function RootLayout({ children }) {
  return (
    <html lang="th" data-theme="day" data-mode="phone">
      <head>
        {/* ฟอนต์ไทยเป็นสิ่งแรกที่ผู้ใช้ต้องอ่าน จึงบอกเบราว์เซอร์ให้ดึงก่อนอย่างอื่น */}
        <link rel="preload" as="font" type="font/woff2" crossOrigin="anonymous"
              href="/fonts/ibm-plex-sans-thai-400-thai.woff2" />
        <link rel="preload" as="font" type="font/woff2" crossOrigin="anonymous"
              href="/fonts/ibm-plex-sans-thai-700-thai.woff2" />
      </head>
      <body>{children}</body>
    </html>
  );
}
