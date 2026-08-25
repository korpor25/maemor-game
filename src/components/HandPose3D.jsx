"use client";

/* ============================================================
   มือ 3D มันวาวที่สลับท่าไปทีละหมายเลข

   บทเรียนจากรอบก่อน: เอาพิกัดข้อต่อที่สร้างไว้สำหรับทดสอบตรรกะการนับ
   มาขึ้นรูปตรง ๆ แล้วอ่านไม่ออกว่าเป็นมือ เพราะสองเรื่อง
     · พิกัดชุดนั้นวางนิ้วชิดกันเกินจริง (ห่างกันแค่ 0.06 ของความกว้างภาพ)
       เพราะมันมีหน้าที่แค่ทดสอบมุมข้อต่อ ไม่ได้มีหน้าที่ดูเหมือนมือ
     · ไม่มีฝ่ามือเลย มีแต่ก้านกับลูกกลมตามข้อต่อ
   รอบนี้จึงถ่างนิ้วให้ได้สัดส่วนจริงและใส่ฝ่ามือเป็นก้อนเดียว
   ส่วนสถานะเหยียด/งอ ยังมาจากชุดเดิม ท่าที่เห็นจึงยังเป็นท่าที่ระบบนับได้จริง
   ============================================================ */

import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, Lightformer, RoundedBox } from "@react-three/drei";
import { useMemo, useRef, useState, Suspense, useEffect } from "react";
import * as THREE from "three";
import { makeHand, POSES } from "@/lib/handPoses";

/* ถ่างนิ้วออกจากกันให้ได้สัดส่วนของมือจริง
   ฝ่ามือคนกว้างพอ ๆ กับความยาวจากข้อมือถึงโคนนิ้ว */
const SPREAD_X = 3.4;
const SCALE_Y = 2.1;

const toWorld = lm => lm.map(p => new THREE.Vector3(
  (p.x - 0.5) * SPREAD_X,
  (0.68 - p.y) * SCALE_Y,
  0
));

const POSE_POINTS = POSES.map(pose => toWorld(makeHand(pose.up)));

/* นิ้วห้านิ้ว แต่ละนิ้วคือข้อต่อสี่จุดเรียงกัน
   นิ้วโป้งอ้วนกว่าและสั้นกว่านิ้วอื่นตามธรรมชาติ */
const FINGERS = [
  { joints: [1, 2, 3, 4], r: 0.19 },
  { joints: [5, 6, 7, 8], r: 0.155 },
  { joints: [9, 10, 11, 12], r: 0.16 },
  { joints: [13, 14, 15, 16], r: 0.15 },
  { joints: [17, 18, 19, 20], r: 0.135 }
];

/* ผิวเดียวกับวัตถุ 3D ในฉากหลัง — พลาสติกเป่าลมสีอ่อน ไม่ใช่แก้ว */
const SKIN = {
  color: "#EBD3C0",
  roughness: 0.32,
  metalness: 0,
  clearcoat: 0.9,
  clearcoatRoughness: 0.22,
  sheen: 0.6,
  sheenColor: "#FFFFFF",
  envMapIntensity: 1.1
};

/* ท่อนนิ้วหนึ่งข้อ — เรียวลงเล็กน้อยไปทางปลาย เหมือนนิ้วจริง */
function Segment({ a, b, rA, rB }) {
  const ref = useRef();
  useFrame(() => {
    const m = ref.current;
    if (!m) return;
    const p1 = a.current, p2 = b.current;
    const dir = new THREE.Vector3().subVectors(p2, p1);
    const len = dir.length() || 0.0001;
    m.position.copy(p1).addScaledVector(dir, 0.5);
    m.scale.set(1, len, 1);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  });
  return (
    <mesh ref={ref}>
      <cylinderGeometry args={[rB, rA, 1, 16]} />
      <meshPhysicalMaterial {...SKIN} />
    </mesh>
  );
}

function Knuckle({ at, r }) {
  const ref = useRef();
  useFrame(() => { if (ref.current) ref.current.position.copy(at.current); });
  return (
    <mesh ref={ref}>
      <sphereGeometry args={[r, 20, 20]} />
      <meshPhysicalMaterial {...SKIN} />
    </mesh>
  );
}

/* ฝ่ามือ — ก้อนเดียวที่พาดจากข้อมือถึงแถวโคนนิ้ว
   นี่คือส่วนที่ขาดไปรอบก่อน และเป็นเหตุผลเดียวที่ทำให้มันไม่อ่านเป็นมือ */
function Palm({ pts }) {
  const ref = useRef();
  useFrame(() => {
    const g = ref.current;
    if (!g) return;
    const wrist = pts[0].current;
    const mid = pts[9].current;
    const centre = new THREE.Vector3().addVectors(wrist, mid).multiplyScalar(0.5);
    g.position.copy(centre);
    const up = new THREE.Vector3().subVectors(mid, wrist);
    g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), up.clone().normalize());
    const width = pts[5].current.distanceTo(pts[17].current) * 1.34;
    const height = up.length() * 1.16;
    g.scale.set(width, height, width * 0.52);
  });
  return (
    <group ref={ref}>
      <RoundedBox args={[1, 1, 1]} radius={0.34} smoothness={5}>
        <meshPhysicalMaterial {...SKIN} />
      </RoundedBox>
    </group>
  );
}

function Hand({ poseIndex }) {
  const group = useRef();
  /* ตำแหน่งจริงที่วาดอยู่ตอนนี้ ค่อย ๆ วิ่งเข้าหาท่าเป้าหมาย
     การเปลี่ยนท่าแบบกระโดดทำให้ดูเหมือนสไลด์ ไม่ใช่มือที่ขยับ */
  const live = useRef(POSE_POINTS[0].map(v => v.clone()));
  const refs = useMemo(() => live.current.map(v => ({ current: v })), []);

  useFrame((state, dt) => {
    const target = POSE_POINTS[poseIndex] || POSE_POINTS[0];
    const k = 1 - Math.pow(0.0001, dt);
    live.current.forEach((v, i) => v.lerp(target[i], k));
    if (group.current) {
      const t = state.clock.elapsedTime;
      group.current.rotation.y = Math.sin(t * 0.45) * 0.2;
      group.current.rotation.z = Math.sin(t * 0.31) * 0.05;
    }
  });

  return (
    <group ref={group} position={[0, -0.15, 0]}>
      <Palm pts={refs} />
      {FINGERS.map((f, fi) => (
        <group key={fi}>
          {f.joints.slice(0, -1).map((j, si) => (
            <Segment
              key={si}
              a={refs[j]} b={refs[f.joints[si + 1]]}
              rA={f.r * (1 - si * 0.1)} rB={f.r * (1 - (si + 1) * 0.1)}
            />
          ))}
          {f.joints.map((j, si) => (
            <Knuckle key={si} at={refs[j]} r={f.r * (1 - si * 0.12)} />
          ))}
        </group>
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
        camera={{ position: [0, 0, 4.6], fov: 38 }}
      >
        <Suspense fallback={null}>
          <ambientLight intensity={1.1} />
          <directionalLight position={[2, 3, 4]} intensity={2.4} />
          <directionalLight position={[-3, -1, 2]} intensity={0.9} color="#CFE0FF" />
          <Environment resolution={128}>
            <Lightformer form="rect" intensity={4} color="#ffffff"
                         position={[0, 3, 2]} scale={[5, 3, 1]} rotation={[-Math.PI / 3, 0, 0]} />
            <Lightformer form="circle" intensity={2.4} color="#CFE0FF"
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
