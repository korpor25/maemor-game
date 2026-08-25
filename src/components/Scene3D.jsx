"use client";

/* ============================================================
   ฉาก 3D ที่อยู่หลังเนื้อหาทั้งหมด
   วัตถุหลักคือวงแหวนหกเหลี่ยม ซึ่งเป็นรูปทรงเดียวกับแผ่นผังดวง
   จึงไม่ใช่ของประดับที่หยิบมาลอย ๆ แต่เป็นสัญลักษณ์ของตัวกิจกรรมเอง

   ข้อจำกัดที่ออกแบบเผื่อไว้ตั้งแต่ต้น
     · ไม่ใช้ HDR จาก CDN — drei โหลดจากภายนอกซึ่งใช้ออฟไลน์ไม่ได้
       จึงประกอบ environment เองจาก Lightformer ในเครื่อง
     · หยุดเรนเดอร์ทั้งฉากตอนอยู่หน้าคำถาม เพราะกล้องกับโมเดลนับนิ้ว
       ต้องการ GPU ทั้งหมดในจังหวะนั้น
     · ปิดตัวเองเมื่อระบบตั้งค่าลดการเคลื่อนไหว หรือเครื่องไม่ไหว
   ============================================================ */

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, Lightformer } from "@react-three/drei";
import { useMemo, useRef, Suspense } from "react";
import * as THREE from "three";
import { point3 } from "@/lib/plate";

/* ---------- เส้นทางหกเหลี่ยมมุมมน ใช้เป็นแกนของท่อ ---------- */
function useHexCurve(n = 6, radius = 1) {
  return useMemo(() => {
    const pts = Array.from({ length: n }, (_, i) => new THREE.Vector3(...point3(i, n, radius)));
    /* closed CatmullRom ทำให้มุมมนเองโดยไม่ต้องคำนวณส่วนโค้งทีละมุม */
    return new THREE.CatmullRomCurve3(pts, true, "catmullrom", 0.4);
  }, [n, radius]);
}

/* ---------- วงแหวนหกเหลี่ยมมันวาว ---------- */
function GlossyHex({ scale = 1 }) {
  const ref = useRef();
  const curve = useHexCurve();
  const geo = useMemo(() => new THREE.TubeGeometry(curve, 220, 0.30, 26, true), [curve]);

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime;
    const m = ref.current;
    if (!m) return;
    /* หมุนช้ามากและแกว่งเล็กน้อย ให้ผิวจับแสงเปลี่ยนไปเรื่อย ๆ
       ถ้าอยู่นิ่งสนิทวัตถุจะดูเป็นภาพแบน ไม่ใช่ของมันวาว */
    m.rotation.y += dt * 0.12;
    m.rotation.x = Math.sin(t * 0.22) * 0.18;
    m.rotation.z = Math.cos(t * 0.17) * 0.1;
    m.position.y = Math.sin(t * 0.5) * 0.06;
  });

  /* พลาสติกเป่าลมสีอ่อน ไม่ใช่แก้ว
     เคยลองวัสดุแบบแก้ว (transmission เต็ม) แล้วออกมาดำสนิท
     เพราะแก้วต้องมีฉากหลังให้หักเห แต่ environment ที่ประกอบเองมีแค่แผ่นไฟ
     และวัตถุสีเข้มทำให้ตัวหนังสือที่ทับอยู่อ่านไม่ออก */
  return (
    <mesh ref={ref} geometry={geo} scale={scale}>
      <meshPhysicalMaterial
        color="#CFE4FA"
        roughness={0.14}
        metalness={0}
        clearcoat={1}
        clearcoatRoughness={0.06}
        transmission={0.28}
        thickness={0.9}
        ior={1.34}
        sheen={0.5}
        sheenColor="#FFFFFF"
        envMapIntensity={1.3}
      />
    </mesh>
  );
}

/* ---------- ลูกกลมเล็กที่ลอยอยู่รอบ ๆ ---------- */
function Bead({ position, radius, speed, hue }) {
  const ref = useRef();
  useFrame(state => {
    const t = state.clock.elapsedTime * speed;
    const m = ref.current;
    if (!m) return;
    m.position.y = position[1] + Math.sin(t) * 0.28;
    m.position.x = position[0] + Math.cos(t * 0.8) * 0.16;
  });
  return (
    <mesh ref={ref} position={position}>
      <sphereGeometry args={[radius, 48, 48]} />
      <meshPhysicalMaterial
        color={hue}
        roughness={0.08}
        metalness={0}
        clearcoat={1}
        clearcoatRoughness={0.05}
        transmission={0.55}
        thickness={0.6}
        ior={1.4}
      />
    </mesh>
  );
}

/* ---------- ตัวชี้สามเหลี่ยมมันวาว ----------
   ยืมภาษาจากลูกศรเคอร์เซอร์ ให้หน้ารู้สึกว่าเป็นของที่ต้องเอามือไปยุ่ง */
function Pointer({ position }) {
  const ref = useRef();
  useFrame((state, dt) => {
    const m = ref.current;
    if (!m) return;
    m.rotation.z += dt * 0.25;
    m.rotation.x = Math.sin(state.clock.elapsedTime * 0.4) * 0.3;
  });
  return (
    <mesh ref={ref} position={position} rotation={[0.4, 0.2, 0.6]}>
      <coneGeometry args={[0.26, 0.56, 3]} />
      <meshPhysicalMaterial
        color="#5D93E8"
        roughness={0.12}
        metalness={0.1}
        clearcoat={1}
        clearcoatRoughness={0.04}
      />
    </mesh>
  );
}

/* ---------- กล้องขยับตามเมาส์เล็กน้อย ---------- */
function Parallax({ strength = 0.5 }) {
  useFrame((state, dt) => {
    const { camera, pointer } = state;
    const k = 1 - Math.pow(0.001, dt);      // ตามทันแบบเฟรมเรตไม่มีผล
    camera.position.x += (pointer.x * strength - camera.position.x) * k;
    camera.position.y += (pointer.y * strength - camera.position.y) * k;
    camera.lookAt(0, 0, 0);
  });
  return null;
}

/* ---------- แสง ----------
   ประกอบ environment เองจากแผ่นไฟ ไม่ดึง HDR จากที่ไหน
   จึงยังทำงานได้เมื่อไม่มีอินเทอร์เน็ต */
function Rig({ night }) {
  return (
    <>
      <ambientLight intensity={night ? 0.6 : 1.5} />
      <directionalLight position={[3, 4, 5]} intensity={night ? 1.4 : 2.6} />
      <directionalLight position={[-4, -2, 3]} intensity={night ? 0.6 : 1.1} color="#BFD9F5" />
      <Environment resolution={256}>
        <Lightformer form="rect" intensity={night ? 2.4 : 6} color="#ffffff"
                     position={[0, 3, 2]} scale={[6, 3, 1]} rotation={[-Math.PI / 3, 0, 0]} />
        <Lightformer form="circle" intensity={night ? 1.6 : 3.6} color="#BFDCFF"
                     position={[-4, 1, 2]} scale={[3, 3, 1]} />
        <Lightformer form="rect" intensity={night ? 1.2 : 2.6} color="#2A6BE0"
                     position={[4, -2, 1]} scale={[4, 2, 1]} rotation={[0, -Math.PI / 4, 0]} />
      </Environment>
    </>
  );
}

/* ---------- การจัดวางวัตถุ ----------
   จอกว้างวางวัตถุไว้ขวาให้พ้นคอลัมน์ข้อความ
   จอแคบวางถอยไปด้านหลังตรงกลางและย่อลง ไม่งั้นจะโผล่ครึ่งตัวที่ขอบจอ */
function Stage() {
  const narrow = useThree(s => s.viewport.aspect) < 1;

  const ring = narrow ? { pos: [0.35, 0.55, -3.4], scale: 0.72 } : { pos: [1.85, -0.2, -1.5], scale: 0.85 };
  /* เนื้อหาทั้งหมดยึดขอบซ้าย ลูกกลมจึงต้องอยู่ฝั่งขวาเท่านั้น
     ไม่งั้นจะไปทับตัวหนังสือในหน้าที่มีรายการยาว ๆ */
  const beads = narrow
    ? [[1.5, -2.3, -3.2, 0.14], [1.9, 2.1, -3.4, 0.11]]
    : [[3.1, 1.5, -2.4, 0.2], [2.4, -1.15, -2.8, 0.15]];
  const pointer = narrow ? [1.5, -2.4, -1.6] : [2.9, -1.75, -0.4];

  return (
    <>
      <group position={ring.pos}><GlossyHex scale={ring.scale} /></group>
      <Bead position={beads[0].slice(0, 3)} radius={beads[0][3]} speed={0.55} hue="#9CC6FF" />
      <Bead position={beads[1].slice(0, 3)} radius={beads[1][3]} speed={0.8} hue="#FFFFFF" />
      <Pointer position={pointer} />
    </>
  );
}

export default function Scene3D({ theme = "day", quality = "high" }) {
  const night = theme === "night";
  const light = quality === "low";

  return (
    <Canvas
      className="scene"
      dpr={light ? [1, 1.2] : [1, 1.75]}
      gl={{ antialias: !light, alpha: true, powerPreference: "high-performance" }}
      camera={{ position: [0, 0, 5.2], fov: 42 }}
      frameloop="always"
    >
      <Suspense fallback={null}>
        <Rig night={night} />
        <Parallax />
        <Stage />
      </Suspense>
    </Canvas>
  );
}
