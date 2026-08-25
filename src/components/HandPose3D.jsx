"use client";

/* ============================================================
   มือ 3D มันวาวที่สลับท่าไปทีละหมายเลข

   ขึ้นรูปจากพิกัดข้อต่อ 21 จุดชุดเดียวกับที่ build/test-fingers.mjs ใช้ตรวจ
   ท่าที่เห็นในบทเรียนจึงเป็นท่าที่ระบบนับได้จริง
   ไม่ใช่ไอคอนที่วาดขึ้นเองแล้วหวังว่าจะตรงกับสิ่งที่โมเดลอ่าน

   ใช้แคนวาสเดียวและให้มือค่อย ๆ เปลี่ยนท่าไปเรื่อย ๆ
   แทนการวางไอคอนหกอันเรียงกัน ซึ่งจะต้องเปิด WebGL หกตัวพร้อมกัน
   ============================================================ */

import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, Lightformer } from "@react-three/drei";
import { useMemo, useRef, useState, Suspense, useEffect } from "react";
import * as THREE from "three";
import { makeHand, POSES } from "@/lib/handPoses";
import { HAND_BONES } from "@/lib/hands";

/* พิกัดจาก makeHand อยู่ในช่วง 0–1 โดยแกน y ชี้ลงแบบภาพ
   ต้องย้ายจุดกึ่งกลางไปที่ศูนย์และกลับแกน y ให้ตรงกับระบบของ three.js */
const toWorld = lm => lm.map(p => new THREE.Vector3(
  (p.x - 0.5) * 3.2,
  (0.62 - p.y) * 3.2,
  0
));

const POSE_POINTS = POSES.map(pose => toWorld(makeHand(pose.up)));

/* กระดูกหนึ่งท่อน — ทรงกระบอกที่ยืดและหมุนให้พาดระหว่างข้อต่อสองจุด
   ใช้ mesh เดียวต่อกระดูก แล้วขยับทุกเฟรมตอนเปลี่ยนท่า */
function Bone({ from, to, radius }) {
  const ref = useRef();
  useFrame(() => {
    const m = ref.current;
    if (!m) return;
    const a = from.current, b = to.current;
    const dir = new THREE.Vector3().subVectors(b, a);
    const len = dir.length() || 0.0001;
    m.position.copy(a).addScaledVector(dir, 0.5);
    m.scale.set(1, len, 1);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  });
  return (
    <mesh ref={ref}>
      <cylinderGeometry args={[radius, radius, 1, 14]} />
      <Skin />
    </mesh>
  );
}

function Joint({ at, radius }) {
  const ref = useRef();
  useFrame(() => { if (ref.current) ref.current.position.copy(at.current); });
  return (
    <mesh ref={ref}>
      <sphereGeometry args={[radius, 20, 20]} />
      <Skin />
    </mesh>
  );
}

/* ผิวเดียวกับวัตถุ 3D ในฉากหลัง — พลาสติกเป่าลมสีอ่อน ไม่ใช่แก้ว */
function Skin() {
  return (
    <meshPhysicalMaterial
      color="#D6E8FC"
      roughness={0.16}
      metalness={0}
      clearcoat={1}
      clearcoatRoughness={0.07}
      sheen={0.5}
      sheenColor="#FFFFFF"
      envMapIntensity={1.2}
    />
  );
}

function Hand({ poseIndex }) {
  const group = useRef();
  /* ตำแหน่งจริงที่วาดอยู่ตอนนี้ ค่อย ๆ วิ่งเข้าหาท่าเป้าหมาย
     การเปลี่ยนท่าแบบกระโดดทำให้ดูเหมือนสไลด์ ไม่ใช่มือที่ขยับ */
  const live = useRef(POSE_POINTS[0].map(v => v.clone()));

  useFrame((state, dt) => {
    const target = POSE_POINTS[poseIndex] || POSE_POINTS[0];
    const k = 1 - Math.pow(0.0001, dt);
    live.current.forEach((v, i) => v.lerp(target[i], k));
    if (group.current) {
      const t = state.clock.elapsedTime;
      group.current.rotation.y = Math.sin(t * 0.5) * 0.28;
      group.current.rotation.x = Math.sin(t * 0.34) * 0.1;
    }
  });

  const refs = useMemo(
    () => live.current.map(v => ({ current: v })),
    []
  );

  return (
    <group ref={group}>
      {HAND_BONES.map(([a, b], i) => (
        <Bone key={i} from={refs[a]} to={refs[b]} radius={0.115} />
      ))}
      {refs.map((r, i) => (
        <Joint key={i} at={r} radius={i === 0 ? 0.2 : 0.13} />
      ))}
    </group>
  );
}

export default function HandPose3D({ poseIndex = 0, className = "" }) {
  return (
    <div className={`hand3d ${className}`}>
      <Canvas
        dpr={[1, 1.6]}
        gl={{ antialias: true, alpha: true }}
        camera={{ position: [0, 0, 5], fov: 38 }}
      >
        <Suspense fallback={null}>
          <ambientLight intensity={1.4} />
          <directionalLight position={[2, 3, 4]} intensity={2.2} />
          <Environment resolution={128}>
            <Lightformer form="rect" intensity={5} color="#ffffff"
                         position={[0, 3, 2]} scale={[5, 3, 1]} rotation={[-Math.PI / 3, 0, 0]} />
            <Lightformer form="circle" intensity={3} color="#BFDCFF"
                         position={[-3, 0, 2]} scale={[3, 3, 1]} />
          </Environment>
          <Hand poseIndex={poseIndex} />
        </Suspense>
      </Canvas>
    </div>
  );
}

/** วนท่าไปเรื่อย ๆ คืนดัชนีท่าปัจจุบันกับป้ายกำกับ */
export function usePoseCycle(everyMs = 1800) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setI(v => (v + 1) % POSES.length), everyMs);
    return () => clearInterval(id);
  }, [everyMs]);
  return { index: i, pose: POSES[i] };
}
