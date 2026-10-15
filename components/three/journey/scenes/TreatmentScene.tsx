"use client";

import { memo, useMemo, useRef } from "react";
import * as THREE from "three";
import { seeded } from "@/lib/seeded";
import { C } from "../materials/palette";
import { createFlowMaterial, densityFor } from "../materials/flow";
import { createGlowMaterial } from "../materials/fx";
import { clamp01, easeOutBack, ramp, seg } from "../utils/ease";
import { pipePath } from "../utils/geometry";
import { useDisposable } from "../utils/useDisposable";
import { particleCount, phase, Plinth, RevealRoot, useStageFrame, type SceneProps } from "./common";
import { TANK, tankZoneX as zoneX } from "./treatmentLayout";

/*
 * 2.3 — Цэвэршүүлэлт: гүний худгийн цэвэр усыг тунгалаг ханатай 5 тасалгаат саванд дахин шүүнэ.
 * 01 ундны ус → 02 дахин шүүх (шүүлтүүрийн хайрцаг) → 03 цэвэршүүлэх (агааржуулалт) → 04 халдваргүйжүүлэх (гэрэлт хоолой)
 * → стандарт (ногоон гэрэл). Процесс урагшлах тусам тасалгааны ус улам тунгалаг, гялалзсан цэнхэр болно.
 * Цэвэршсэн ус гарах шугамаар цааш (усан сан руу) урсана.
 */

const { length: L, height: H, depth: DEPTH, level: LEVEL } = TANK;
const ZONE = L / TANK.zones;
const RIGHT = TANK.x + L / 2;
// тасалгаа бүр: ирсэн цэвэр ус → улам тунгалаг, гэрэлтсэн цэнхэр
const START = new THREE.Color("#1f6fa3");
const FINAL = ["#2582bd", "#2a93cf", "#2fa4de", "#36b4ea", "#3fc6f5"].map((c) => new THREE.Color(c));
const SPARKLES_PER_ZONE = [0, 1, 2, 3, 5];
const BUBBLES = 10;
const CARTRIDGES = [-0.13, 0, 0.13];
const LAMPS = [-0.13, 0, 0.13];

const inlet = pipePath([
  [-2.3, 0.42, TANK.z + 0.1],
  [TANK.x - L / 2 - 0.02, 0.42, TANK.z + 0.1],
]);
// цэвэршсэн ус савнаас гараад цааш (усан сан руу)
const outlet = pipePath([
  [RIGHT + 0.02, 0.36, TANK.z - 0.1],
  [2.3, 0.36, TANK.z - 0.1],
]);
const FLOW = { color: "#1b7fc0", glow: C.foam, speed: 0.8 };

function TreatmentScene({ rt, index }: SceneProps) {
  const sparkles = useMemo(() => {
    const rand = seeded(11);
    const out: { x: number; y: number; z: number; s: number; ph: number; zone: number }[] = [];
    SPARKLES_PER_ZONE.forEach((n, zi) => {
      for (let k = 0; k < n; k++) {
        out.push({
          x: zoneX(zi) + (rand() - 0.5) * (ZONE - 0.14),
          y: 0.1 + rand() * (LEVEL - 0.2),
          z: (rand() - 0.5) * (DEPTH - 0.2),
          s: 0.012 + rand() * 0.01,
          ph: rand() * Math.PI * 2,
          zone: zi,
        });
      }
    });
    return out;
  }, []);
  const bubbles = useMemo(() => {
    const rand = seeded(12);
    return Array.from({ length: BUBBLES }, () => ({
      x: zoneX(2) + (rand() - 0.5) * (ZONE - 0.16),
      z: (rand() - 0.5) * (DEPTH - 0.25),
      s: 0.016 + rand() * 0.012,
    }));
  }, []);

  const waterMats = useDisposable(() => {
    const list = FINAL.map(
      () => new THREE.MeshStandardMaterial({ color: START, roughness: 0.2, transparent: true, opacity: 0.6, depthWrite: false }),
    );
    return { list, dispose: () => list.forEach((m) => m.dispose()) };
  }, []);
  const beaconMats = useDisposable(() => {
    const list = FINAL.map(() => new THREE.MeshBasicMaterial({ color: C.line }));
    return { list, dispose: () => list.forEach((m) => m.dispose()) };
  }, []);
  const glassEdges = useDisposable(() => new THREE.EdgesGeometry(new THREE.BoxGeometry(L + 0.04, H, DEPTH + 0.04)), []);
  const tube = (path: THREE.Curve<THREE.Vector3>, r: number, n = 32) => new THREE.TubeGeometry(path, n, r, 10, false);
  const inletGeo = useDisposable(() => tube(inlet, 0.05, 12), []);
  const outletGeo = useDisposable(() => tube(outlet, 0.045, 24), []);
  const flow = (path: THREE.Curve<THREE.Vector3>, per = 5) => createFlowMaterial({ ...FLOW, density: densityFor(path.getLength(), per) });
  const inletMat = useDisposable(() => flow(inlet), []);
  const outletMat = useDisposable(() => flow(outlet), []);
  const uvGlow = useDisposable(() => createGlowMaterial("#bff0ff", 0), []);
  const basin = useRef<THREE.Group>(null);
  const waters = useRef<(THREE.Group | null)[]>([]);
  const cartridges = useRef<THREE.Group>(null);
  const lamps = useRef<THREE.Group>(null);
  const uvGlowMesh = useRef<THREE.Mesh>(null);
  const beacons = useRef<(THREE.Mesh | null)[]>([]);
  const sparkleMesh = useRef<THREE.InstancedMesh>(null);
  const bubbleMesh = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const green = useMemo(() => new THREE.Color(C.green), []);
  const water = useMemo(() => new THREE.Color(C.water), []);
  const line = useMemo(() => new THREE.Color(C.line), []);

  // p: сав (0.22–0.45) → ус (0.28–0.62) → шүүлтүүр, хоолой (0.3–0.6) → процесс 01…05 (0.35–0.85)
  //    → гарах шугам (0.85–1)
  useStageFrame(rt, index, (p, amb, tier) => {
    basin.current!.scale.set(1, Math.max(ramp(p, 0.22, 0.45), 0.001), 1);
    cartridges.current!.scale.set(1, Math.max(ramp(p, 0.3, 0.5), 0.001), 1);
    lamps.current!.scale.set(1, Math.max(easeOutBack(seg(p, 0.4, 0.6)), 0.001), 1);

    // процессын явц (0–5): тасалгаа бүр дараалан "хүрнэ"
    const proc = ramp(p, 0.35, 0.85) * 5;
    for (let i = 0; i < 5; i++) {
      const w = waters.current[i];
      if (w) w.scale.set(1, Math.max(ramp(p, 0.28 + i * 0.03, 0.5 + i * 0.03), 0.001), 1);
      const a = clamp01(proc - i);
      waterMats.list[i].color.copy(START).lerp(FINAL[i], a);
      waterMats.list[i].opacity = 0.6 - 0.1 * a;
      const b = beaconMats.list[i];
      if (a >= 1) b.color.copy(i === 4 ? green : water);
      else b.color.copy(line).lerp(water, a * 0.6);
      const bm = beacons.current[i];
      if (bm) bm.scale.setScalar(Math.max(easeOutBack(seg(p, 0.3 + i * 0.05, 0.5 + i * 0.05)), 0.001));
    }

    inletMat.uniforms.uPhase.value = phase(p, amb, 5);
    inletMat.uniforms.uDraw.value = ramp(p, 0.3, 0.5);
    outletMat.uniforms.uPhase.value = phase(p, amb, 5);
    outletMat.uniforms.uDraw.value = ramp(p, 0.85, 1);
    uvGlow.uniforms.uOpacity.value = 0.55 * clamp01(proc - 3);
    uvGlowMesh.current!.visible = tier.fx;

    // гялбаа: процесс хүрсэн тасалгаанд л анивчина (тунгалаг, цэвэр усны шинж)
    const sm = sparkleMesh.current!;
    sm.count = particleCount(sparkles.length, tier);
    for (let i = 0; i < sm.count; i++) {
      const s = sparkles[i];
      const tw = 0.4 + 0.6 * Math.abs(Math.sin(amb * 1.6 + s.ph + p * 8));
      dummy.position.set(s.x, s.y + Math.sin(amb * 0.6 + s.ph) * 0.012, s.z);
      dummy.rotation.set(s.ph, amb * 0.5 + s.ph, 0);
      dummy.scale.setScalar(Math.max(s.s * clamp01(proc - s.zone) * tw, 0.0001));
      dummy.updateMatrix();
      sm.setMatrixAt(i, dummy.matrix);
    }
    sm.instanceMatrix.needsUpdate = true;

    // агааржуулалт: бөмбөлөг дээш хөөрнө (фаз нь progress-оос)
    const bm = bubbleMesh.current!;
    bm.count = particleCount(BUBBLES, tier);
    const bShow = clamp01(proc - 2);
    for (let i = 0; i < bm.count; i++) {
      const b = bubbles[i];
      const k = (phase(p, amb, 3, 0.35) + i / bm.count) % 1;
      dummy.position.set(b.x + Math.sin(k * 9 + i) * 0.015, 0.05 + k * (LEVEL - 0.1), b.z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.setScalar(Math.max(b.s * bShow * Math.sin(Math.PI * Math.min(k * 1.2, 1)), 0.0001));
      dummy.updateMatrix();
      bm.setMatrixAt(i, dummy.matrix);
    }
    bm.instanceMatrix.needsUpdate = true;
  });

  return (
    <RevealRoot rt={rt} index={index}>
      <Plinth width={4.6} depth={2.0} />

      <group position={[TANK.x, 0.001, TANK.z]}>
        {/* савны ёроол */}
        <mesh position={[0, 0.01, 0]}>
          <boxGeometry args={[L + 0.04, 0.02, DEPTH + 0.04]} />
          <meshStandardMaterial color="#0d2a44" roughness={0.8} />
        </mesh>

        {/* тасалгаа бүрийн ус */}
        {FINAL.map((_, i) => {
          const h = LEVEL - 0.02;
          return (
            <group
              key={i}
              position={[zoneX(i) - TANK.x, 0.02, 0]}
              ref={(el) => {
                waters.current[i] = el;
              }}
            >
              <mesh position={[0, h / 2, 0]} material={waterMats.list[i]} renderOrder={1}>
                <boxGeometry args={[ZONE - 0.04, h, DEPTH - 0.02]} />
              </mesh>
            </group>
          );
        })}

        {/* 02 дахин шүүх: шүүлтүүрийн хайрцагнууд */}
        <group ref={cartridges} position={[zoneX(1) - TANK.x, 0.02, 0]}>
          {CARTRIDGES.map((x) => (
            <group key={x} position={[x, 0, 0]}>
              <mesh position={[0, (LEVEL - 0.08) / 2, 0]}>
                <cylinderGeometry args={[0.045, 0.045, LEVEL - 0.08, 14]} />
                <meshStandardMaterial color="#cfe0ec" roughness={0.55} />
              </mesh>
              <mesh position={[0, LEVEL - 0.08, 0]}>
                <cylinderGeometry args={[0.05, 0.05, 0.03, 14]} />
                <meshStandardMaterial color={C.metalDark} roughness={0.5} metalness={0.3} />
              </mesh>
              {[0.14, 0.3].map((y) => (
                <mesh key={y} position={[0, y, 0]}>
                  <cylinderGeometry args={[0.047, 0.047, 0.012, 14]} />
                  <meshBasicMaterial color={C.water} />
                </mesh>
              ))}
            </group>
          ))}
        </group>

        {/* 04 халдваргүйжүүлэх гэрэлт хоолойнууд */}
        <group ref={lamps} position={[zoneX(3) - TANK.x, 0.08, 0]}>
          {LAMPS.map((x) => (
            <mesh key={x} position={[x, 0.2, 0]}>
              <cylinderGeometry args={[0.016, 0.016, 0.4, 10]} />
              <meshBasicMaterial color={C.foam} />
            </mesh>
          ))}
          <mesh ref={uvGlowMesh} position={[0, 0.22, DEPTH / 2 - 0.02]} material={uvGlow}>
            <planeGeometry args={[0.65, 0.65]} />
          </mesh>
        </group>

        <group position={[-TANK.x, 0, 0]}>
          <instancedMesh ref={sparkleMesh} args={[undefined, undefined, sparkles.length]} frustumCulled={false}>
            <octahedronGeometry args={[1, 0]} />
            <meshBasicMaterial color={C.foam} />
          </instancedMesh>
          <instancedMesh ref={bubbleMesh} args={[undefined, undefined, BUBBLES]} frustumCulled={false}>
            <sphereGeometry args={[1, 10, 8]} />
            <meshBasicMaterial color={C.foam} />
          </instancedMesh>
        </group>

        {/* тасалгааны хаалт (ус дээгүүр урсах) */}
        {[1, 2, 3, 4].map((i) => (
          <mesh key={i} position={[-L / 2 + ZONE * i, (LEVEL + 0.04) / 2, 0]}>
            <boxGeometry args={[0.025, LEVEL + 0.04, DEPTH]} />
            <meshStandardMaterial color={C.metalDark} roughness={0.5} metalness={0.3} />
          </mesh>
        ))}

        {/* тунгалаг хана + техникийн хүрээ */}
        <group ref={basin}>
          <mesh position={[0, H / 2, 0]} renderOrder={2}>
            <boxGeometry args={[L + 0.04, H, DEPTH + 0.04]} />
            <meshStandardMaterial color={C.aqua} transparent opacity={0.08} roughness={0.1} depthWrite={false} />
          </mesh>
          <lineSegments geometry={glassEdges} position={[0, H / 2, 0]}>
            <lineBasicMaterial color={C.aqua} transparent opacity={0.6} />
          </lineSegments>
        </group>

        {/* төлөвийн гэрэл (тасалгаа бүрийн дээр) */}
        {FINAL.map((_, i) => (
          <mesh
            key={i}
            position={[zoneX(i) - TANK.x, H + 0.08, 0]}
            material={beaconMats.list[i]}
            ref={(el) => {
              beacons.current[i] = el;
            }}
          >
            <sphereGeometry args={[0.04, 14, 10]} />
          </mesh>
        ))}
      </group>

      {/* шугам: орох → сав → гарах */}
      <mesh geometry={inletGeo} material={inletMat} />
      <mesh geometry={outletGeo} material={outletMat} />
    </RevealRoot>
  );
}

export default memo(TreatmentScene);
