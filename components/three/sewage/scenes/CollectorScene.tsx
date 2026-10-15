"use client";

import { memo, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { seeded } from "@/lib/seeded";
import { C } from "../../journey/materials/palette";
import { createBuildingMaterial } from "../../journey/materials/building";
import { createFlowMaterial, densityFor } from "../../journey/materials/flow";
import { createRingMaterial } from "../../journey/materials/fx";
import { easeOutBack, ramp, seg } from "../../journey/utils/ease";
import { pipePath } from "../../journey/utils/geometry";
import { useDisposable } from "../../journey/utils/useDisposable";
import { phase, Plinth, RevealRoot, useStageFrame, type SceneProps } from "../../journey/scenes/common";
import { JUNCTION, PY } from "../layout";

/*
 * 02 — Шугам нэгдэх: хорооллуудын дундуур гурван салаа татуурга хяналтын худаг (J) руу нийлж,
 * тэндээс НЭГ бүдүүн гол шугам болж баруун тийш (дамжуулах станц руу) урсана.
 */

const [JX, , JZ] = JUNCTION;
const branches = [
  // арын хорооллоос: зүүнээс баруун, дараа нь J руу урагш
  pipePath([
    [-2.05, PY, -0.95],
    [JX, PY, -0.95],
    [JX, PY, JZ],
  ]),
  // зүүн талаас шууд
  pipePath([
    [-2.05, PY, JZ],
    [JX, PY, JZ],
  ]),
  // урд хорооллоос: J руу хойш
  pipePath([
    [-1.45, PY, 1.15],
    [JX, PY, 1.15],
    [JX, PY, JZ],
  ]),
];
const main = pipePath([
  [JX, PY + 0.01, JZ],
  [2.25, PY + 0.01, JZ],
]);
// салаа шугамын эргэлт дээрх хяналтын худгууд
const MANHOLES: [number, number][] = [
  [-1.0, -0.95],
  [JX, -0.95],
  [-0.9, JZ],
  [-0.4, 1.15],
  [JX, 1.15],
  [1.3, JZ],
];

type Bld = { x: number; z: number; w: number; d: number; h: number; delay: number; seed: number; floors: number };

/** Хорооллын барилгууд: шугамуудын хоорондох блокуудад */
function makeBlocks(): Bld[] {
  const rand = seeded(41);
  const rows: { z: number; d: number; xs: number[]; hMax: number }[] = [
    { z: -1.22, d: 0.28, xs: [-1.7, -1.05, -0.4, 0.95, 1.6], hMax: 0.3 },
    { z: -0.36, d: 0.52, xs: [-1.65, -1.0, -0.35, 0.95, 1.6], hMax: 0.6 },
    { z: 0.72, d: 0.5, xs: [-1.75, -1.1, -0.42, 0.95, 1.6], hMax: 0.5 },
  ];
  const out: Bld[] = [];
  for (const r of rows)
    for (const x of r.xs) {
      // гол шугамын урд талын (камер руу) барилгууд намхан — шугамыг халхлахгүй
      const low = r.z > JZ && x > JX;
      const h = low ? 0.1 + rand() * 0.1 : 0.14 + rand() * r.hMax;
      out.push({
        x,
        z: r.z,
        w: 0.42 + rand() * 0.08,
        d: r.d - rand() * 0.06,
        h,
        delay: Math.min(1, Math.hypot(x - JX, r.z - JZ) / 2.4),
        seed: rand(),
        floors: Math.max(2, Math.round(h * 10)),
      });
    }
  return out;
}

const sewageFlow = (path: THREE.Curve<THREE.Vector3>, per: number, speed = 0.8) =>
  createFlowMaterial({ color: C.sewage, glow: C.sewageGlow, density: densityFor(path.getLength(), per), speed });

function CollectorScene({ rt, index }: SceneProps) {
  const city = useMemo(makeBlocks, []);
  const bldMat = useDisposable(createBuildingMaterial, []);
  const bldGeo = useDisposable(() => {
    const g = new THREE.BoxGeometry(1, 1, 1);
    g.translate(0, 0.5, 0);
    g.setAttribute("aDelay", new THREE.InstancedBufferAttribute(Float32Array.from(city, (b) => b.delay), 1));
    g.setAttribute("aSeed", new THREE.InstancedBufferAttribute(Float32Array.from(city, (b) => b.seed), 1));
    g.setAttribute("aFloors", new THREE.InstancedBufferAttribute(Float32Array.from(city, (b) => b.floors), 1));
    return g;
  }, [city]);
  const branchGeos = useDisposable(() => {
    const list = branches.map((b) => new THREE.TubeGeometry(b, 64, 0.032, 8, false));
    return { list, dispose: () => list.forEach((g) => g.dispose()) };
  }, []);
  const branchMats = useDisposable(() => {
    const list = branches.map((b) => sewageFlow(b, 3.5));
    return { list, dispose: () => list.forEach((m) => m.dispose()) };
  }, []);
  const mainGeo = useDisposable(() => new THREE.TubeGeometry(main, 48, 0.075, 14, false), []);
  const mainMat = useDisposable(() => sewageFlow(main, 2.6, 0.9), []);
  const ringMat = useDisposable(() => createRingMaterial(C.sewageGlow, 24), []);

  const buildings = useRef<THREE.InstancedMesh>(null);
  const plots = useRef<THREE.InstancedMesh>(null);
  const manholes = useRef<(THREE.Group | null)[]>([]);
  const junction = useRef<THREE.Group>(null);
  const pulse = useRef<THREE.Mesh>(null);

  useLayoutEffect(() => {
    const d = new THREE.Object3D();
    city.forEach((b, i) => {
      d.position.set(b.x, 0.02, b.z);
      d.scale.set(b.w, b.h, b.d);
      d.updateMatrix();
      buildings.current!.setMatrixAt(i, d.matrix);
      d.position.set(b.x, 0.01, b.z);
      d.scale.set(b.w + 0.08, 0.02, b.d + 0.08);
      d.updateMatrix();
      plots.current!.setMatrixAt(i, d.matrix);
    });
    buildings.current!.instanceMatrix.needsUpdate = true;
    plots.current!.instanceMatrix.needsUpdate = true;
  }, [city]);

  // p: хороолол (0.15–0.55) → салаа шугамууд (0.3–0.7, дараалан) → хяналтын худгууд → нийлэх худаг (0.55–0.7)
  //    → гол шугам (0.66–0.95)
  useStageFrame(rt, index, (p, amb) => {
    bldMat.uniforms.uGrow.value = ramp(p, 0.15, 0.55);
    bldMat.uniforms.uLit.value = seg(p, 0.3, 0.75) * 1.15;
    branchMats.list.forEach((m, i) => {
      m.uniforms.uPhase.value = phase(p, amb, 5);
      m.uniforms.uDraw.value = ramp(p, 0.3 + i * 0.06, 0.6 + i * 0.06);
    });
    mainMat.uniforms.uPhase.value = phase(p, amb, 5);
    mainMat.uniforms.uDraw.value = ramp(p, 0.66, 0.95);
    manholes.current.forEach((m, i) => m?.scale.setScalar(Math.max(easeOutBack(seg(p, 0.35 + i * 0.04, 0.55 + i * 0.04)), 0.001)));
    junction.current!.scale.setScalar(Math.max(easeOutBack(seg(p, 0.55, 0.7)), 0.001));
    // нийлэх худгийн долгион: урсгал нийлэх цэгээс гадагш
    const k = phase(p, amb, 2, 0.5) % 1;
    pulse.current!.scale.setScalar(0.5 + k * 1.3);
    ringMat.uniforms.uPhase.value = phase(p, amb, 6);
    ringMat.uniforms.uOpacity.value = (1 - k) * ramp(p, 0.62, 0.75);
  });

  return (
    <RevealRoot rt={rt} index={index}>
      <Plinth width={4.5} depth={2.8} top="#0e2c46" />

      {/* хорооллын талбай, барилга */}
      <instancedMesh ref={plots} args={[undefined, undefined, city.length]} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#133a5c" roughness={0.9} />
      </instancedMesh>
      <instancedMesh ref={buildings} args={[bldGeo, bldMat, city.length]} frustumCulled={false} />

      {/* салаа ба гол шугам */}
      {branchGeos.list.map((g, i) => (
        <mesh key={i} geometry={g} material={branchMats.list[i]} />
      ))}
      <mesh geometry={mainGeo} material={mainMat} />

      {/* хяналтын худгууд (таг) */}
      {MANHOLES.map(([x, z], i) => (
        <group
          key={i}
          position={[x, 0, z]}
          ref={(el) => {
            manholes.current[i] = el;
          }}
        >
          <mesh position={[0, 0.03, 0]}>
            <cylinderGeometry args={[0.06, 0.06, 0.06, 16]} />
            <meshStandardMaterial color={C.metalDark} roughness={0.6} metalness={0.3} />
          </mesh>
          <mesh position={[0, 0.062, 0]}>
            <cylinderGeometry args={[0.045, 0.045, 0.006, 16]} />
            <meshStandardMaterial color={C.metal} roughness={0.5} metalness={0.4} />
          </mesh>
        </group>
      ))}

      {/* нийлэх худаг: том, урсгал нийлэх цэгээс долгион тарна */}
      <group ref={junction} position={[JX, 0, JZ]}>
        <mesh position={[0, 0.05, 0]}>
          <cylinderGeometry args={[0.13, 0.15, 0.1, 24]} />
          <meshStandardMaterial color={C.metalDark} roughness={0.55} metalness={0.3} />
        </mesh>
        <mesh position={[0, 0.102, 0]}>
          <cylinderGeometry args={[0.1, 0.1, 0.008, 24]} />
          <meshStandardMaterial color={C.sewageGlow} emissive={C.sewage} emissiveIntensity={0.6} />
        </mesh>
      </group>
      <mesh ref={pulse} position={[JX, 0.012, JZ]} rotation-x={-Math.PI / 2} material={ringMat}>
        <ringGeometry args={[0.2, 0.225, 64]} />
      </mesh>
    </RevealRoot>
  );
}

export default memo(CollectorScene);
