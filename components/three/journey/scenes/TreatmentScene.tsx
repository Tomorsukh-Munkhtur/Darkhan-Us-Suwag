"use client";

import { memo, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { seeded } from "@/lib/seeded";
import { C } from "../materials/palette";
import { createBuildingMaterial } from "../materials/building";
import { createFlowMaterial, densityFor } from "../materials/flow";
import { createGlowMaterial } from "../materials/fx";
import { clamp01, easeOutBack, ramp, seg } from "../utils/ease";
import { pipePath, rectOutline } from "../utils/geometry";
import { useDisposable } from "../utils/useDisposable";
import { particleCount, phase, Plinth, RevealRoot, useStageFrame, type SceneProps } from "./common";
import { APARTMENTS, TANK, tankZoneX as zoneX } from "./treatmentLayout";

/*
 * 2.3 — Цэвэршүүлэлт: гүний худгийн цэвэр усыг тунгалаг ханатай 5 тасалгаат саванд дахин шүүнэ.
 * 01 ундны ус → 02 дахин шүүх (шүүлтүүрийн хайрцаг) → 03 цэвэршүүлэх (агааржуулалт) → 04 халдваргүйжүүлэх (гэрэлт хоолой)
 * → стандарт (ногоон гэрэл). Процесс урагшлах тусам тасалгааны ус улам тунгалаг, гялалзсан цэнхэр болно.
 * Дараа нь гарах шугам гудамжаар салаалж орон сууцнууд (цонх асна), гэр хорооллын ус түгээх байр руу хүрнэ.
 */

const { length: L, height: H, depth: DEPTH, level: LEVEL } = TANK;
const ZONE = L / TANK.zones;
const RIGHT = TANK.x + L / 2;
const PY = 0.035;
const STREET_Z = 0.55;
const RISER_X = RIGHT + 0.22;
const STREET_END = 2.4;
// тасалгаа бүр: ирсэн цэвэр ус → улам тунгалаг, гэрэлтсэн цэнхэр
const START = new THREE.Color("#1f6fa3");
const FINAL = ["#2582bd", "#2a93cf", "#2fa4de", "#36b4ea", "#3fc6f5"].map((c) => new THREE.Color(c));
const SPARKLES_PER_ZONE = [0, 1, 2, 3, 5];
const BUBBLES = 10;
const CARTRIDGES = [-0.13, 0, 0.13];
const LAMPS = [-0.13, 0, 0.13];

/** гэр хороолол: хашаа бүрт нэг гэр; ус түгээх байр голд нь */
const KIOSK = { x: APARTMENTS[1].x, z: 0.9 };
const GERS = [
  { x: 0.9, z: 1.0 },
  { x: 1.24, z: 1.02 },
  { x: 1.92, z: 1.02 },
  { x: 2.26, z: 1.0 },
];
const PLOT = { w: 0.32, d: 0.3 };

const inlet = pipePath([
  [-2.45, 0.42, TANK.z + 0.1],
  [TANK.x - L / 2 - 0.02, 0.42, TANK.z + 0.1],
]);
// савнаас гараад доош бууж гудамжны шугамд нийлнэ
const outlet = pipePath([
  [RIGHT + 0.02, 0.36, TANK.z - 0.1],
  [RISER_X, 0.36, TANK.z - 0.1],
  [RISER_X, PY, TANK.z - 0.1],
  [RISER_X, PY, STREET_Z],
]);
const street = pipePath([
  [RISER_X, PY, STREET_Z],
  [STREET_END, PY, STREET_Z],
]);
// салаа: орон сууц бүр (гудамжны ар тал), ус түгээх байр (урд тал) — гудамжаар хүрэх дарааллаар
const services = [
  ...APARTMENTS.map((a) => ({
    x: a.x,
    kiosk: false,
    path: pipePath([
      [a.x, PY, STREET_Z],
      [a.x, PY, a.z + a.d / 2 + 0.02],
    ]),
  })),
  {
    x: KIOSK.x,
    kiosk: true,
    path: pipePath([
      [KIOSK.x, PY, STREET_Z],
      [KIOSK.x, PY, KIOSK.z - 0.08],
    ]),
  },
].sort((a, b) => a.x - b.x);
/** гудамжны шугамын урсгал x цэг дээр хүрэх явц (0–1) */
const along = (x: number) => (x - RISER_X) / (STREET_END - RISER_X);
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
  const plotOutline = useDisposable(() => rectOutline(PLOT.w, PLOT.d), []);
  const tube = (path: THREE.Curve<THREE.Vector3>, r: number, n = 32) => new THREE.TubeGeometry(path, n, r, 10, false);
  const inletGeo = useDisposable(() => tube(inlet, 0.05, 12), []);
  const outletGeo = useDisposable(() => tube(outlet, 0.045, 64), []);
  const streetGeo = useDisposable(() => tube(street, 0.042, 48), []);
  const serviceGeos = useDisposable(() => {
    const list = services.map((s) => tube(s.path, 0.028, 12));
    return { list, dispose: () => list.forEach((g) => g.dispose()) };
  }, []);
  const flow = (path: THREE.Curve<THREE.Vector3>, per = 5) => createFlowMaterial({ ...FLOW, density: densityFor(path.getLength(), per) });
  const inletMat = useDisposable(() => flow(inlet), []);
  const outletMat = useDisposable(() => flow(outlet), []);
  const streetMat = useDisposable(() => flow(street, 4), []);
  const serviceMats = useDisposable(() => {
    const list = services.map((s) => flow(s.path, 6));
    return { list, dispose: () => list.forEach((m) => m.dispose()) };
  }, []);
  const uvGlow = useDisposable(() => createGlowMaterial("#bff0ff", 0), []);
  const kioskGlow = useDisposable(() => createGlowMaterial(C.aqua, 0), []);

  // орон сууц: InstancedMesh, ус хүрэх дарааллаар цонх асна (building.ts)
  const bldMat = useDisposable(createBuildingMaterial, []);
  const bldGeo = useDisposable(() => {
    const g = new THREE.BoxGeometry(1, 1, 1);
    g.translate(0, 0.5, 0);
    const rand = seeded(13);
    g.setAttribute("aDelay", new THREE.InstancedBufferAttribute(Float32Array.from(APARTMENTS, (a) => a.delay), 1));
    g.setAttribute("aSeed", new THREE.InstancedBufferAttribute(Float32Array.from(APARTMENTS, () => rand()), 1));
    g.setAttribute("aFloors", new THREE.InstancedBufferAttribute(Float32Array.from(APARTMENTS, (a) => a.floors), 1));
    return g;
  }, []);
  const doorMat = useDisposable(
    () => new THREE.MeshStandardMaterial({ color: "#b5651d", emissive: C.warm, emissiveIntensity: 0, roughness: 0.5 }),
    [],
  );
  const kioskRoof = useDisposable(() => new THREE.MeshBasicMaterial({ color: C.line }), []);

  const basin = useRef<THREE.Group>(null);
  const waters = useRef<(THREE.Group | null)[]>([]);
  const cartridges = useRef<THREE.Group>(null);
  const lamps = useRef<THREE.Group>(null);
  const uvGlowMesh = useRef<THREE.Mesh>(null);
  const beacons = useRef<(THREE.Mesh | null)[]>([]);
  const sparkleMesh = useRef<THREE.InstancedMesh>(null);
  const bubbleMesh = useRef<THREE.InstancedMesh>(null);
  const buildings = useRef<THREE.InstancedMesh>(null);
  const gers = useRef<(THREE.Group | null)[]>([]);
  const kiosk = useRef<THREE.Group>(null);
  const kioskGlowMesh = useRef<THREE.Mesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const green = useMemo(() => new THREE.Color(C.green), []);
  const water = useMemo(() => new THREE.Color(C.water), []);
  const line = useMemo(() => new THREE.Color(C.line), []);
  const aqua = useMemo(() => new THREE.Color(C.aqua), []);

  useLayoutEffect(() => {
    const d = new THREE.Object3D();
    const bm = buildings.current!;
    APARTMENTS.forEach((a, i) => {
      d.position.set(a.x, 0.03, a.z);
      d.scale.set(a.w, a.h, a.d);
      d.updateMatrix();
      bm.setMatrixAt(i, d.matrix);
    });
    bm.instanceMatrix.needsUpdate = true;
  }, []);

  // p: сав (0.22–0.45) → ус (0.28–0.62) → шүүлтүүр, хоолой (0.3–0.6) → процесс 01…05 (0.35–0.78)
  //    → гарах шугам (0.7–0.8) → гудамж (0.78–0.9) → салаа бүр, цонх, ус түгээх байр (0.84–1)
  useStageFrame(rt, index, (p, amb, tier) => {
    basin.current!.scale.set(1, Math.max(ramp(p, 0.22, 0.45), 0.001), 1);
    cartridges.current!.scale.set(1, Math.max(ramp(p, 0.3, 0.5), 0.001), 1);
    lamps.current!.scale.set(1, Math.max(easeOutBack(seg(p, 0.4, 0.6)), 0.001), 1);

    // процессын явц (0–5): тасалгаа бүр дараалан "хүрнэ"
    const proc = ramp(p, 0.35, 0.78) * 5;
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
    outletMat.uniforms.uDraw.value = ramp(p, 0.7, 0.8);
    const st = seg(p, 0.78, 0.9);
    streetMat.uniforms.uPhase.value = phase(p, amb, 5);
    streetMat.uniforms.uDraw.value = st;
    // салаа: гудамжны урсгал тэр цэгт хүрмэгц зурагдана
    const arrive = services.map((s) => 0.78 + along(s.x) * 0.12);
    serviceMats.list.forEach((m, i) => {
      m.uniforms.uPhase.value = phase(p, amb, 5);
      m.uniforms.uDraw.value = ramp(p, arrive[i], arrive[i] + 0.06);
    });
    uvGlow.uniforms.uOpacity.value = 0.55 * clamp01(proc - 3);
    uvGlowMesh.current!.visible = tier.fx;

    // айл өрх: босож гарна → ус хүрэхэд цонх, хаалга асна
    bldMat.uniforms.uGrow.value = ramp(p, 0.3, 0.62);
    bldMat.uniforms.uLit.value = seg(p, 0.86, 1) * 1.15;
    gers.current.forEach((g, i) => g?.scale.setScalar(Math.max(easeOutBack(seg(p, 0.38 + i * 0.04, 0.58 + i * 0.04)), 0.001)));
    kiosk.current!.scale.setScalar(Math.max(easeOutBack(seg(p, 0.44, 0.62)), 0.001));
    const kioskAt = arrive[services.findIndex((s) => s.kiosk)] + 0.06;
    const kLit = seg(p, kioskAt, kioskAt + 0.05);
    kioskRoof.color.copy(line).lerp(aqua, kLit);
    kioskGlow.uniforms.uOpacity.value = 0.45 * kLit;
    kioskGlowMesh.current!.visible = tier.fx;
    doorMat.emissiveIntensity = 1.2 * seg(p, kioskAt + 0.02, kioskAt + 0.08);

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
      <Plinth width={5} depth={2.6} />

      {/* гудамж, хорооллын талбай */}
      <mesh position={[(RISER_X + 2.5) / 2, 0.004, STREET_Z]}>
        <boxGeometry args={[2.5 - RISER_X, 0.008, 0.3]} />
        <meshStandardMaterial color="#0e2c46" roughness={0.9} />
      </mesh>
      {APARTMENTS.map((a) => (
        <mesh key={a.x} position={[a.x, 0.015, a.z]}>
          <boxGeometry args={[a.w + 0.1, 0.03, a.d + 0.1]} />
          <meshStandardMaterial color="#133a5c" roughness={0.9} />
        </mesh>
      ))}

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

      {/* шугам: орох → сав → гарах → гудамж → айл өрх бүр */}
      <mesh geometry={inletGeo} material={inletMat} />
      <mesh geometry={outletGeo} material={outletMat} />
      <mesh geometry={streetGeo} material={streetMat} />
      {serviceGeos.list.map((g, i) => (
        <mesh key={i} geometry={g} material={serviceMats.list[i]} />
      ))}

      {/* орон сууц */}
      <instancedMesh ref={buildings} args={[bldGeo, bldMat, APARTMENTS.length]} frustumCulled={false} />

      {/* гэр хороолол: хашаа, гэр (хаалга нь ус ирэхэд гэрэлтэнэ) */}
      {GERS.map((g, i) => (
        <group key={i} position={[g.x, 0, g.z]}>
          <lineLoop geometry={plotOutline} position={[0, 0.006, 0]}>
            <lineBasicMaterial color={C.line} transparent opacity={0.7} />
          </lineLoop>
          <group
            ref={(el) => {
              gers.current[i] = el;
            }}
          >
            {/* хана (эсгий), бүслүүр, дээвэр, тооно, хаалга */}
            <mesh position={[0, 0.042, 0]}>
              <cylinderGeometry args={[0.105, 0.105, 0.084, 24]} />
              <meshStandardMaterial color="#c3d3df" roughness={0.9} />
            </mesh>
            <mesh position={[0, 0.07, 0]}>
              <cylinderGeometry args={[0.107, 0.107, 0.008, 24]} />
              <meshStandardMaterial color={C.metalDark} roughness={0.8} />
            </mesh>
            <mesh position={[0, 0.115, 0]}>
              <cylinderGeometry args={[0.024, 0.118, 0.062, 24]} />
              <meshStandardMaterial color="#d6e2ea" roughness={0.85} />
            </mesh>
            <mesh position={[0, 0.149, 0]}>
              <cylinderGeometry args={[0.026, 0.026, 0.008, 16]} />
              <meshStandardMaterial color={C.metalDark} roughness={0.7} />
            </mesh>
            <mesh position={[0, 0.032, 0.106]} material={doorMat}>
              <planeGeometry args={[0.034, 0.05]} />
            </mesh>
          </group>
        </group>
      ))}

      {/* ус түгээх байр */}
      <group ref={kiosk} position={[KIOSK.x, 0, KIOSK.z]}>
        <mesh position={[0, 0.06, 0]}>
          <boxGeometry args={[0.16, 0.12, 0.14]} />
          <meshStandardMaterial color={C.wall} roughness={0.7} />
        </mesh>
        <mesh position={[0, 0.13, 0]} material={kioskRoof}>
          <boxGeometry args={[0.2, 0.02, 0.18]} />
        </mesh>
        <mesh ref={kioskGlowMesh} position={[0, 0.16, 0]} rotation-x={-Math.PI / 2} material={kioskGlow}>
          <planeGeometry args={[0.6, 0.6]} />
        </mesh>
      </group>
    </RevealRoot>
  );
}

export default memo(TreatmentScene);
