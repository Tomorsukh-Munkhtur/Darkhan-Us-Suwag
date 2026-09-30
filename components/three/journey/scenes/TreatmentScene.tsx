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

/*
 * 2.3 — Цэвэршүүлэлт: тунгалаг ханатай 5 тасалгаат сав.
 * 01 түүхий ус → 02 шүүх (элс, хайрга, нүүрс) → 03 цэвэршүүлэх (агааржуулалт) → 04 халдваргүйжүүлэх (гэрэлт хоолой) → 05 цэвэр ус.
 * Процесс урагшлах тусам тасалгааны ус булингараас тунгалаг цэнхэр болж, дээрх төлөвийн гэрэл асна.
 */

const L = 3.4;
const H = 0.8;
const DEPTH = 0.9;
const LEVEL = 0.62;
const ZONE = L / 5;
const zoneX = (i: number) => -L / 2 + ZONE * (i + 0.5);
const MEDIA = [
  { h: 0.08, color: C.sand },
  { h: 0.07, color: C.gravel },
  { h: 0.06, color: C.carbon },
];
const MEDIA_TOP = MEDIA.reduce((s, m) => s + m.h, 0.02);
/** давхарга бүрийн төвийн өндөр (шүүлтүүрийн ёроолоос) */
const MEDIA_Y = MEDIA.map((m, i) => MEDIA.slice(0, i).reduce((s, x) => s + x.h, 0) + m.h / 2);
// тасалгаа бүрийн эцсийн өнгө: булингартай → тунгалаг цэнхэр
const FINAL = ["#6d5a36", "#56694e", "#2f7fa8", "#2a9fd8", "#3cc0f2"].map((c) => new THREE.Color(c));
const MURK = new THREE.Color(C.murk);
const DIRT_PER_ZONE = [14, 7, 3, 1, 0];
const BUBBLES = 10;

const inlet = pipePath([
  [-2.1, 0.5, 0.1],
  [-L / 2 - 0.02, 0.5, 0.1],
]);
const outlet = pipePath([
  [L / 2 + 0.02, 0.44, -0.1],
  [2.1, 0.44, -0.1],
]);

function TreatmentScene({ rt, index }: SceneProps) {
  const dirt = useMemo(() => {
    const rand = seeded(11);
    const out: { x: number; y: number; z: number; s: number; ph: number }[] = [];
    DIRT_PER_ZONE.forEach((n, zi) => {
      for (let k = 0; k < n; k++) {
        out.push({
          x: zoneX(zi) + (rand() - 0.5) * (ZONE - 0.14),
          y: (zi === 1 ? MEDIA_TOP : 0.06) + rand() * (LEVEL - 0.14 - (zi === 1 ? MEDIA_TOP : 0.06)),
          z: (rand() - 0.5) * (DEPTH - 0.2),
          s: 0.018 + rand() * 0.02,
          ph: rand() * Math.PI * 2,
        });
      }
    });
    return out;
  }, []);
  const bubbles = useMemo(() => {
    const rand = seeded(12);
    return Array.from({ length: BUBBLES }, () => ({
      x: zoneX(2) + (rand() - 0.5) * (ZONE - 0.18),
      z: (rand() - 0.5) * (DEPTH - 0.25),
      s: 0.018 + rand() * 0.014,
    }));
  }, []);

  const waterMats = useDisposable(() => {
    const list = FINAL.map(
      () => new THREE.MeshStandardMaterial({ color: MURK, roughness: 0.25, transparent: true, opacity: 0.62, depthWrite: false }),
    );
    return { list, dispose: () => list.forEach((m) => m.dispose()) };
  }, []);
  const beaconMats = useDisposable(() => {
    const list = FINAL.map(() => new THREE.MeshBasicMaterial({ color: C.line }));
    return { list, dispose: () => list.forEach((m) => m.dispose()) };
  }, []);
  const glassEdges = useDisposable(() => new THREE.EdgesGeometry(new THREE.BoxGeometry(L + 0.04, H, DEPTH + 0.04)), []);
  const inletGeo = useDisposable(() => new THREE.TubeGeometry(inlet, 12, 0.055, 12, false), []);
  const outletGeo = useDisposable(() => new THREE.TubeGeometry(outlet, 12, 0.055, 12, false), []);
  const inletMat = useDisposable(
    () => createFlowMaterial({ color: "#7a6640", glow: "#e0cf9a", density: densityFor(inlet.getLength(), 5), speed: 0.8 }),
    [],
  );
  const outletMat = useDisposable(
    () => createFlowMaterial({ color: "#1b8fd0", glow: C.foam, density: densityFor(outlet.getLength(), 5), speed: 0.8 }),
    [],
  );
  const uvGlow = useDisposable(() => createGlowMaterial("#bff0ff", 0), []);

  const basin = useRef<THREE.Group>(null);
  const waters = useRef<(THREE.Group | null)[]>([]);
  const media = useRef<THREE.Group>(null);
  const lamps = useRef<THREE.Group>(null);
  const uvGlowMesh = useRef<THREE.Mesh>(null);
  const beacons = useRef<(THREE.Mesh | null)[]>([]);
  const dirtMesh = useRef<THREE.InstancedMesh>(null);
  const bubbleMesh = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const green = useMemo(() => new THREE.Color(C.green), []);
  const water = useMemo(() => new THREE.Color(C.water), []);
  const line = useMemo(() => new THREE.Color(C.line), []);

  // p: сав (0.22–0.45) → ус (0.28–0.62) → шүүлтүүр (0.3–0.5) → процесс 01…05 дараалан (0.35–0.95) → гарах шугам (0.85–1)
  useStageFrame(rt, index, (p, amb, tier) => {
    basin.current!.scale.set(1, Math.max(ramp(p, 0.22, 0.45), 0.001), 1);
    media.current!.scale.set(1, Math.max(ramp(p, 0.3, 0.5), 0.001), 1);
    lamps.current!.scale.set(1, Math.max(easeOutBack(seg(p, 0.4, 0.6)), 0.001), 1);

    // процессын явц (0–5): тасалгаа бүр дараалан "хүрнэ"
    const proc = ramp(p, 0.35, 0.95) * 5;
    for (let i = 0; i < 5; i++) {
      const w = waters.current[i];
      if (w) w.scale.set(1, Math.max(ramp(p, 0.28 + i * 0.03, 0.5 + i * 0.03), 0.001), 1);
      const a = clamp01(proc - i);
      waterMats.list[i].color.copy(MURK).lerp(FINAL[i], a);
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

    // хольц: тасалгаагаар цөөрнө; ambient үед л бага зэрэг хөвнө
    const dm = dirtMesh.current!;
    dm.count = particleCount(dirt.length, tier);
    const dShow = ramp(p, 0.35, 0.55);
    for (let i = 0; i < dm.count; i++) {
      const d = dirt[i];
      dummy.position.set(d.x, d.y + Math.sin(amb * 0.7 + d.ph) * 0.015, d.z);
      dummy.rotation.set(d.ph, amb * 0.3 + d.ph, 0);
      dummy.scale.setScalar(Math.max(d.s * dShow, 0.0001));
      dummy.updateMatrix();
      dm.setMatrixAt(i, dummy.matrix);
    }
    dm.instanceMatrix.needsUpdate = true;

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
      <Plinth width={4.2} depth={2.4} />

      <group position={[0, 0.001, 0]}>
        {/* савны ёроол */}
        <mesh position={[0, 0.01, 0]}>
          <boxGeometry args={[L + 0.04, 0.02, DEPTH + 0.04]} />
          <meshStandardMaterial color="#0d2a44" roughness={0.8} />
        </mesh>

        {/* тасалгаа бүрийн ус */}
        {FINAL.map((_, i) => {
          const bottom = i === 1 ? MEDIA_TOP : 0.02;
          const h = LEVEL - bottom;
          return (
            <group
              key={i}
              position={[zoneX(i), bottom, 0]}
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

        {/* 02 шүүлтүүрийн давхарга */}
        <group ref={media} position={[zoneX(1), 0.02, 0]}>
          {MEDIA.map((m, i) => (
            <mesh key={i} position={[0, MEDIA_Y[i], 0]}>
              <boxGeometry args={[ZONE - 0.04, m.h, DEPTH - 0.02]} />
              <meshStandardMaterial color={m.color} roughness={0.95} flatShading />
            </mesh>
          ))}
        </group>

        {/* 04 халдваргүйжүүлэх гэрэлт хоолойнууд */}
        <group ref={lamps} position={[zoneX(3), 0.08, 0]}>
          {[-0.17, 0, 0.17].map((x) => (
            <mesh key={x} position={[x, 0.23, 0]}>
              <cylinderGeometry args={[0.018, 0.018, 0.46, 10]} />
              <meshBasicMaterial color={C.foam} />
            </mesh>
          ))}
          <mesh ref={uvGlowMesh} position={[0, 0.25, DEPTH / 2 - 0.02]} material={uvGlow}>
            <planeGeometry args={[0.8, 0.8]} />
          </mesh>
        </group>

        <instancedMesh ref={dirtMesh} args={[undefined, undefined, dirt.length]} frustumCulled={false}>
          <icosahedronGeometry args={[1, 0]} />
          <meshStandardMaterial color={C.dirt} roughness={0.9} flatShading />
        </instancedMesh>
        <instancedMesh ref={bubbleMesh} args={[undefined, undefined, BUBBLES]} frustumCulled={false}>
          <sphereGeometry args={[1, 10, 8]} />
          <meshBasicMaterial color={C.foam} />
        </instancedMesh>

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
            position={[zoneX(i), H + 0.08, 0]}
            material={beaconMats.list[i]}
            ref={(el) => {
              beacons.current[i] = el;
            }}
          >
            <sphereGeometry args={[0.04, 14, 10]} />
          </mesh>
        ))}

        <mesh geometry={inletGeo} material={inletMat} />
        <mesh geometry={outletGeo} material={outletMat} />
      </group>
    </RevealRoot>
  );
}

export default memo(TreatmentScene);
