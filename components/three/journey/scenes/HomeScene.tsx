"use client";

import { memo, useMemo, useRef } from "react";
import * as THREE from "three";
import { C } from "../materials/palette";
import { createFlowMaterial, densityFor } from "../materials/flow";
import { createGlowMaterial } from "../materials/fx";
import { createWaterSurfaceMaterial } from "../materials/water";
import { clamp01, easeOutBack, lerp, ramp, seg } from "../utils/ease";
import { dropletGeometry, pipePath, roofGeometry } from "../utils/geometry";
import { useDisposable } from "../utils/useDisposable";
import { phase, Plinth, RevealRoot, useStageFrame, type SceneProps } from "./common";

/* 2.6 — Хэрэглэгч: жижиг байшин, гудамжны шугамаас холболт, цонхны дулаан гэрэл, цорго, дусал */

const HOUSE = { x: -0.4, z: -0.2, w: 1.4, h: 0.85, d: 1.0 };
const HOUSE_FRONT = HOUSE.z + HOUSE.d / 2;
const STREET_Z = 1.05;
const PY = 0.035;
const TAP = { x: 1.15, z: 0.45, top: 0.6 };
const NOZZLE = { x: TAP.x + 0.2, y: TAP.top - 0.09 };
const BASIN_Y = 0.095;
const DROPS = 3;
const PERIOD = 1.3;

const mainLine = pipePath([
  [-1.9, PY, STREET_Z],
  [1.9, PY, STREET_Z],
]);
const service = pipePath([
  [HOUSE.x - 0.35, PY, STREET_Z],
  [HOUSE.x - 0.35, PY, HOUSE_FRONT],
]);
const tapLine = pipePath([
  [TAP.x, PY, STREET_Z],
  [TAP.x, PY, TAP.z],
  [TAP.x, TAP.top, TAP.z],
]);

/** байшингийн төвөөс харьцангуй */
const WINDOWS: { p: [number, number, number]; ry: number }[] = [
  { p: [-0.42, 0.5, HOUSE.d / 2 + 0.003], ry: 0 },
  { p: [0.42, 0.5, HOUSE.d / 2 + 0.003], ry: 0 },
  { p: [HOUSE.w / 2 + 0.003, 0.5, 0], ry: Math.PI / 2 },
];

function HomeScene({ rt, index }: SceneProps) {
  const flow = (curve: THREE.Curve<THREE.Vector3>, per = 3) =>
    createFlowMaterial({ color: "#1b7fc0", glow: C.foam, density: densityFor(curve.getLength(), per), speed: 0.8 });
  const mainGeo = useDisposable(() => new THREE.TubeGeometry(mainLine, 64, 0.045, 10, false), []);
  const mainMat = useDisposable(() => flow(mainLine), []);
  const serviceGeo = useDisposable(() => new THREE.TubeGeometry(service, 16, 0.03, 8, false), []);
  const serviceMat = useDisposable(() => flow(service, 4), []);
  const tapGeo = useDisposable(() => new THREE.TubeGeometry(tapLine, 48, 0.03, 8, false), []);
  const tapMat = useDisposable(() => flow(tapLine, 4), []);
  const roofGeo = useDisposable(() => roofGeometry(HOUSE.w + 0.16, 0.55, HOUSE.d + 0.16), []);
  const roofEdges = useDisposable(() => new THREE.EdgesGeometry(roofGeo), [roofGeo]);
  const windowMat = useDisposable(
    () => new THREE.MeshStandardMaterial({ color: "#2e2508", emissive: C.warm, emissiveIntensity: 0, roughness: 0.4 }),
    [],
  );
  const windowGlow = useDisposable(() => createGlowMaterial(C.warm, 0), []);
  const basinWater = useDisposable(createWaterSurfaceMaterial, []);
  const dropGeo = useDisposable(() => dropletGeometry(1), []);

  const house = useRef<THREE.Group>(null);
  const roof = useRef<THREE.Group>(null);
  const trees = useRef<(THREE.Group | null)[]>([]);
  const faucet = useRef<THREE.Group>(null);
  const drops = useRef<THREE.InstancedMesh>(null);
  const splashes = useRef<(THREE.Mesh | null)[]>([]);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  // p: байшин (0.22–0.48) → мод (0.3–0.61) → дээвэр (0.4–0.6) → гудамжны шугам (0.3–0.6) → холболт (0.55–0.85)
  //    → цорго (0.6–0.8) → цонх гэрэлтэх (0.68–0.92) → дусал дараалан унах (0.82–1)
  useStageFrame(rt, index, (r, amb, tier) => {
    house.current!.scale.set(1, Math.max(ramp(r, 0.22, 0.48), 0.001), 1);
    roof.current!.scale.setScalar(Math.max(easeOutBack(seg(r, 0.4, 0.6)), 0.001));
    trees.current.forEach((g, i) => g?.scale.setScalar(Math.max(easeOutBack(seg(r, 0.3 + i * 0.06, 0.55 + i * 0.06)), 0.001)));
    faucet.current!.scale.setScalar(Math.max(easeOutBack(seg(r, 0.6, 0.8)), 0.001));

    for (const [m, a, b] of [
      [mainMat, 0.3, 0.6],
      [serviceMat, 0.55, 0.72],
      [tapMat, 0.58, 0.85],
    ] as const) {
      m.uniforms.uPhase.value = phase(r, amb, 5);
      m.uniforms.uDraw.value = ramp(r, a, b);
    }
    const lit = ramp(r, 0.68, 0.92);
    windowMat.emissiveIntensity = lit * 1.6;
    windowGlow.uniforms.uOpacity.value = lit * 0.55;
    windowGlow.visible = tier.fx;
    basinWater.uniforms.uPhase.value = phase(r, amb, 3);
    basinWater.uniforms.uDetail.value = tier.waterDetail;

    // дусал: хошуунаас унаж, усанд хүрэхэд цагираг тарна. Дараалал нь progress-ийн сүүлийн хэсгээр
    // (0.82 → 1 хооронд дусал бүр 2 удаа), ambient үед давтагдана.
    const seq = seg(r, 0.82, 1);
    const show = seg(r, 0.82, 0.9);
    const m = drops.current!;
    for (let i = 0; i < DROPS; i++) {
      const k = (seq * 2 + amb / PERIOD + i / DROPS) % 1;
      const fall = clamp01(k / 0.45);
      const y = lerp(NOZZLE.y - 0.02, BASIN_Y + 0.02, fall * fall);
      const s = k < 0.45 ? 0.032 * Math.min(k / 0.08, 1) * show : 0.0001;
      dummy.position.set(NOZZLE.x, y, TAP.z);
      dummy.scale.set(s, s * (1 + fall * 0.35), s);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);

      const ring = splashes.current[i];
      if (ring) {
        const e = seg(k, 0.45, 0.95);
        const on = k >= 0.45 && show > 0;
        ring.visible = on;
        ring.scale.setScalar(lerp(0.3, 1.25, e));
        (ring.material as THREE.MeshBasicMaterial).opacity = (1 - e) * 0.8;
      }
    }
    m.instanceMatrix.needsUpdate = true;
  });

  return (
    <RevealRoot rt={rt} index={index}>
      <Plinth width={3.8} depth={2.8} top={C.lawn} />

      {/* гудамж */}
      <mesh position={[0, 0.006, STREET_Z]}>
        <boxGeometry args={[3.8, 0.012, 0.36]} />
        <meshStandardMaterial color="#123450" roughness={0.9} />
      </mesh>

      {/* шугам: гудамжны гол шугам → байшин, → цорго */}
      <mesh geometry={mainGeo} material={mainMat} />
      <mesh geometry={serviceGeo} material={serviceMat} />
      <mesh geometry={tapGeo} material={tapMat} />

      {/* байшин */}
      <group ref={house} position={[HOUSE.x, 0, HOUSE.z]}>
        <mesh position={[0, 0.03, 0]}>
          <boxGeometry args={[HOUSE.w + 0.06, 0.06, HOUSE.d + 0.06]} />
          <meshStandardMaterial color="#10304c" roughness={0.8} />
        </mesh>
        <mesh position={[0, HOUSE.h / 2, 0]}>
          <boxGeometry args={[HOUSE.w, HOUSE.h, HOUSE.d]} />
          <meshStandardMaterial color={C.wall} roughness={0.8} />
        </mesh>
        {/* хаалга + дээрх гэрэл */}
        <mesh position={[0, 0.25, HOUSE.d / 2 + 0.004]}>
          <planeGeometry args={[0.26, 0.46]} />
          <meshStandardMaterial color="#0b2238" roughness={0.7} />
        </mesh>
        <mesh position={[0, 0.54, HOUSE.d / 2 + 0.006]} material={windowMat}>
          <planeGeometry args={[0.1, 0.035]} />
        </mesh>
        {WINDOWS.map((w, i) => (
          <group key={i} position={w.p} rotation-y={w.ry}>
            <mesh material={windowMat}>
              <planeGeometry args={[0.28, 0.24]} />
            </mesh>
            <mesh position={[0, 0, 0.006]}>
              <boxGeometry args={[0.28, 0.012, 0.004]} />
              <meshStandardMaterial color={C.roof} />
            </mesh>
            <mesh position={[0, 0, 0.01]} material={windowGlow}>
              <planeGeometry args={[0.8, 0.7]} />
            </mesh>
          </group>
        ))}
      </group>
      <group ref={roof} position={[HOUSE.x, HOUSE.h, HOUSE.z]}>
        <mesh geometry={roofGeo}>
          <meshStandardMaterial color={C.roof} roughness={0.7} flatShading />
        </mesh>
        <lineSegments geometry={roofEdges}>
          <lineBasicMaterial color={C.aqua} transparent opacity={0.35} />
        </lineSegments>
        <mesh position={[0.35, 0.3, -0.25]}>
          <boxGeometry args={[0.14, 0.36, 0.14]} />
          <meshStandardMaterial color="#163f60" roughness={0.8} />
        </mesh>
      </group>

      {/* мод */}
      {[
        [1.35, -0.75, 1],
        [-1.55, 0.5, 0.8],
      ].map(([x, z, s], i) => (
        <group
          key={i}
          position={[x, 0, z]}
          ref={(el) => {
            trees.current[i] = el;
          }}
        >
          <group scale={s}>
            <mesh position={[0, 0.1, 0]}>
              <cylinderGeometry args={[0.035, 0.045, 0.2, 8]} />
              <meshStandardMaterial color="#2b3a3f" roughness={0.9} />
            </mesh>
            <mesh position={[0, 0.48, 0]}>
              <coneGeometry args={[0.26, 0.62, 6]} />
              <meshStandardMaterial color="#1b5e6b" roughness={0.85} flatShading />
            </mesh>
          </group>
        </group>
      ))}

      {/* цорго + сав */}
      <group ref={faucet} position={[TAP.x, 0, TAP.z]}>
        <mesh position={[0, TAP.top + 0.02, 0]}>
          <sphereGeometry args={[0.045, 16, 12]} />
          <meshStandardMaterial color={C.metal} roughness={0.3} metalness={0.5} />
        </mesh>
        <mesh position={[0, TAP.top + 0.08, 0]}>
          <cylinderGeometry args={[0.012, 0.012, 0.08, 8]} />
          <meshStandardMaterial color={C.metal} roughness={0.3} metalness={0.5} />
        </mesh>
        <mesh position={[0, TAP.top + 0.12, 0]} rotation-z={Math.PI / 2}>
          <cylinderGeometry args={[0.018, 0.018, 0.14, 10]} />
          <meshStandardMaterial color={C.water} roughness={0.4} />
        </mesh>
        <mesh position={[0.1, TAP.top + 0.02, 0]} rotation-z={Math.PI / 2}>
          <cylinderGeometry args={[0.028, 0.028, 0.2, 12]} />
          <meshStandardMaterial color={C.metal} roughness={0.3} metalness={0.5} />
        </mesh>
        <mesh position={[0.2, TAP.top - 0.03, 0]}>
          <cylinderGeometry args={[0.026, 0.02, 0.1, 12]} />
          <meshStandardMaterial color={C.metal} roughness={0.3} metalness={0.5} />
        </mesh>
        <group position={[0.2, 0, 0]}>
          <mesh position={[0, 0.055, 0]}>
            <cylinderGeometry args={[0.17, 0.15, 0.11, 32, 1, true]} />
            <meshStandardMaterial color={C.metalDark} roughness={0.5} metalness={0.3} side={THREE.DoubleSide} />
          </mesh>
          <mesh position={[0, BASIN_Y, 0]} rotation-x={-Math.PI / 2} material={basinWater}>
            <circleGeometry args={[0.16, 32]} />
          </mesh>
        </group>
      </group>

      <instancedMesh ref={drops} args={[dropGeo, undefined, DROPS]} frustumCulled={false}>
        <meshStandardMaterial color={C.aqua} emissive={C.water} emissiveIntensity={0.8} roughness={0.2} />
      </instancedMesh>
      {Array.from({ length: DROPS }, (_, i) => (
        <mesh
          key={i}
          position={[NOZZLE.x, BASIN_Y + 0.004, TAP.z]}
          rotation-x={Math.PI / 2}
          visible={false}
          ref={(el) => {
            splashes.current[i] = el;
          }}
        >
          <torusGeometry args={[0.1, 0.006, 6, 32]} />
          <meshBasicMaterial color={C.foam} transparent opacity={0} depthWrite={false} />
        </mesh>
      ))}
    </RevealRoot>
  );
}

export default memo(HomeScene);
