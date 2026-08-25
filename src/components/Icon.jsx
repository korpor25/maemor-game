/* ไอคอนของแถบบน — SVG ฝังในโค้ด ไม่ใช่ไฟล์ภาพ
   คมทุกความละเอียด เปลี่ยนสีตามธีมเองผ่าน currentColor และไม่เพิ่มไฟล์ให้โหลด */

const paths = {
  home: <><path d="M3 10.5 12 3l9 7.5" /><path d="M5.5 9.5V20h13V9.5" /></>,
  help: <>
    <circle cx="12" cy="12" r="9" />
    <path d="M9.4 9.2a2.7 2.7 0 1 1 3.5 2.6c-.6.2-.9.7-.9 1.3v.6" />
    <circle cx="12" cy="17" r=".9" fill="currentColor" stroke="none" />
  </>,
  moon: <path d="M20 13.5A8.2 8.2 0 0 1 10.5 4a8.2 8.2 0 1 0 9.5 9.5z" />,
  sun: <>
    <circle cx="12" cy="12" r="4.2" />
    <path d="M12 2.6v2.2M12 19.2v2.2M4.2 12H2M22 12h-2.2M6.4 6.4 4.9 4.9M19.1 19.1l-1.5-1.5M17.6 6.4l1.5-1.5M4.9 19.1l1.5-1.5" />
  </>,
  booth: <>
    <rect x="2.8" y="4" width="18.4" height="12.5" rx="2" />
    <path d="M8.5 20.5h7M12 16.5v4" />
  </>,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  cam: <>
    <rect x="2.6" y="6.4" width="12.6" height="11.2" rx="2.6" />
    <path d="M15.2 11.1l4.5-2.7a.6.6 0 0 1 .9.5v6.2a.6.6 0 0 1-.9.5l-4.5-2.7z" />
  </>,
  camoff: <>
    <rect x="2.6" y="6.4" width="12.6" height="11.2" rx="2.6" />
    <path d="M15.2 11.1l4.5-2.7a.6.6 0 0 1 .9.5v6.2a.6.6 0 0 1-.9.5l-4.5-2.7z" />
    <path d="M3.6 3.6 20.4 20.4" />
  </>,
  log: <>
    <rect x="3.5" y="3.5" width="17" height="17" rx="2.5" />
    <path d="M8 15.5v-3M12 15.5v-6M16 15.5v-4.5" />
  </>
};

export default function Icon({ name, size = 18 }) {
  const d = paths[name];
  if (!d) return null;
  return (
    <svg
      className="icon" width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="1.7"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
    >
      {d}
    </svg>
  );
}
