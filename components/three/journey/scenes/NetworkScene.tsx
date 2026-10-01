"use client";

import { memo, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { seeded } from "@/lib/seeded";
import { C } from "../materials/palette";
import { createBuildingMaterial } from "../materials/building";
import { createFlowMaterial, densityFor } from "../materials/flow";
import { createGlowMaterial, createRingMaterial } from "../materials/fx";
import { easeOutBack, ramp, seg } from "../utils/ease";
import { pipePath } from "../utils/geometry";
import { useDisposable } from "../utils/useDisposable";
import { phase, Plinth, RevealRoot, useStageFrame, type SceneProps } from "./common";

/*
 * 2.5 — Шугам сүлжээ: жижиг хотын тор, эх үүсвэрийн гэрэлт цэг, хот руу орох шугам,
 * гудамжаар салаалах хоолойн импульс, ус хүрэх дарааллаар барилгын цонх асна.
 */

const COLS = 6;
const ROWS = 4;
const X0 = -1.3;
const X1 = 2.0;
const Z0 = -1.3;
const Z1 = 1.3;
const CW = (X1 - X0) / COLS;
const RH = (Z1 - Z0) / ROWS;
const ROAD = 0.24;
const PY = 0.035;
const SOURCE: [number, number, number] = [-1.95, 0, -1.05];
// гудамжны шугам: гол шугам z = 0 дагуу, салаа нь баганын завсраар
const BRANCH_X = [X0 + CW, X0 + CW * 3, X0 + CW * 5];

const main = pipePath([
  [SOURCE[0], PY, SOURCE[2]],
  [SOURCE[0], PY, 0],
  [X1 + 0.1, PY, 0],
]);
// салаа бүр гол шугамаас хоёр тийш урсана: [салаа][хагас]
const branches = BRANCH_X.map((x) => [
  pipePath([
    [x, PY, 0],
    [x, PY, Z0 + 0.05],
  ]),
  pipePath([
    [x, PY, 0],
    [x, PY, Z1 - 0.05],
  ]),
]);

type Bld = { x: number; z: number; w: number; d: number; h: number; delay: number; seed: number; floors: number };

function makeCity() {
  const rand = seeded(21);
  const out: Bld[] = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cx = X0 + CW * (c + 0.5);
      const cz = Z0 + RH * (r + 0.5);
      const w = CW - ROAD - rand() * 0.08;
      const d = RH - ROAD - rand() * 0.08;
      // хотын төв хэсэг өндөр
      const center = 1 - Math.min(Math.hypot(cx - 0.4, cz) / 2.2, 1);
      const h = 0.18 + rand() * 0.35 + center * 0.55;
      // эх үүсвэрээс шугамын дагуух зай
      const dist = Math.abs(cx - SOURCE[0]) + Math.abs(cz);
      out.push({ x: cx, z: cz, w, d, h, delay: dist, seed: rand(), floors: Math.max(2, Math.round(h * 9)) });
    }
  }
  const max = Math.max(...out.map((b) => b.delay));
  out.forEach((b) => (b.delay = b.delay / max));
  return out;
}

function NetworkScene({ rt, index }: SceneProps) {
  const city = useMemo(makeCity, []);
  const bldMat = useDisposable(createBuildingMaterial, []);
  const bldGeo = useDisposable(() => {
    const g = new THREE.BoxGeometry(1, 1, 1);
    g.translate(0, 0.5, 0);
    const delay = new Float32Array(city.length);
    const seed = new Float32Array(city.length);
    const floors = new Float32Array(city.length);
    city.forEach((b, i) => {
      delay[i] = b.delay;
      seed[i] = b.seed;
      floors[i] = b.floors;
    });
    g.setAttribute("aDelay", new THREE.InstancedBufferAttribute(delay, 1));
    g.setAttribute("aSeed", new THREE.InstancedBufferAttribute(seed, 1));
    g.setAttribute("aFloors", new THREE.InstancedBufferAttribute(floors, 1));
    return g;
  }, [city]);
  const mainGeo = useDisposable(() => new THREE.TubeGeometry(main, 96, 0.048, 10, false), []);
  const mainMat = useDisposable(
    () => createFlowMaterial({ color: "#1b7fc0", glow: C.foam, density: densityFor(main.getLength(), 2.6), speed: 0.9 }),
    [],
  );
  const branchGeos = useDisposable(() => {
    const list = branches.map((pair) => pair.map((b) => new THREE.TubeGeometry(b, 24, 0.036, 8, false)));
    return { list, dispose: () => list.flat().forEach((g) => g.dispose()) };
  }, []);
  // нэг салааны хоёр хагас нэг материал хуваалцана (зэрэг зурагдана)
  const branchMats = useDisposable(() => {
    const list = branches.map(([half]) =>
      createFlowMaterial({ color: "#1b7fc0", glow: C.foam, density: densityFor(half.getLength(), 2.6), speed: 0.9 }),
    );
    return { list, dispose: () => list.forEach((m) => m.dispose()) };
  }, []);
  const ringMat = useDisposable(() => createRingMaterial(C.aqua, 24), []);
  const glow = useDisposable(() => createGlowMaterial(C.aqua, 0.8), []);

  const buildings = useRef<THREE.InstancedMesh>(null);
  const plots = useRef<THREE.InstancedMesh>(null);
  const node = useRef<THREE.Group>(null);
  const pulse = useRef<THREE.Mesh>(null);
  const nodeGlow = useRef<THREE.Mesh>(null);

  useLayoutEffect(() => {
    const dummy = new THREE.Object3D();
    const bm = buildings.current!;
    const pm = plots.current!;
    city.forEach((b, i) => {
      dummy.position.set(b.x, 0.03, b.z);
      dummy.scale.set(b.w, b.h, b.d);
      dummy.updateMatrix();
      bm.setMatrixAt(i, dummy.matrix);
      dummy.position.set(b.x, 0, b.z);
      dummy.scale.set(CW - ROAD + 0.04, 0.03, RH - ROAD + 0.04);
      dummy.updateMatrix();
      pm.setMatrixAt(i, dummy.matrix);
    });
    bm.instanceMatrix.needsUpdate = true;
    pm.instanceMatrix.needsUpdate = true;
  }, [city]);

  // p: эх үүсвэр (0.2–0.4) → барилга долгиолон босох (0.2–0.6) → гол шугам (0.3–0.6) → салаанууд (0.5–0.92)
  //    → ус хүрэх дарааллаар цонх асах (0.55–1)
  useStageFrame(rt, index, (r, amb, tier) => {
    bldMat.uniforms.uGrow.value = ramp(r, 0.2, 0.6);
    bldMat.uniforms.uLit.value = seg(r, 0.55, 1) * 1.15;
    mainMat.uniforms.uPhase.value = phase(r, amb, 6);
    mainMat.uniforms.uDraw.value = ramp(r, 0.3, 0.6);
    branchMats.list.forEach((m, i) => {
      m.uniforms.uPhase.value = phase(r, amb, 6);
      m.uniforms.uDraw.value = ramp(r, 0.5 + i * 0.06, 0.8 + i * 0.06);
    });
    node.current!.scale.setScalar(Math.max(easeOutBack(seg(r, 0.2, 0.4)), 0.001));
    nodeGlow.current!.visible = tier.fx;
    ringMat.uniforms.uPhase.value = phase(r, amb, 6);
    // эх үүсвэрийн долгион: гадагш тэлж бүдгэрнэ (фаз нь progress-оос)
    const k = phase(r, amb, 2, 0.5) % 1;
    pulse.current!.scale.setScalar(0.4 + k * 1.2);
    ringMat.uniforms.uOpacity.value = (1 - k) * ramp(r, 0.3, 0.5);
  });

  return (
    <RevealRoot rt={rt} index={index}>
      <Plinth width={4.4} depth={3.4} top="#0e2c46" />

      {/* хорооллын талбай (зам нь завсрын бараан хэсэг) */}
      <instancedMesh ref={plots} args={[undefined, undefined, city.length]} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#133a5c" roughness={0.9} />
      </instancedMesh>
      <instancedMesh ref={buildings} args={[bldGeo, bldMat, city.length]} frustumCulled={false} />

      {/* шугам */}
      <mesh geometry={mainGeo} material={mainMat} />
      {branchGeos.list.map((pair, i) =>
        pair.map((g, h) => <mesh key={`${i}-${h}`} geometry={g} material={branchMats.list[i]} />),
      )}

      {/* эх үүсвэрийн цэг */}
      <group ref={node} position={SOURCE}>
        <mesh position={[0, 0.12, 0]}>
          <cylinderGeometry args={[0.13, 0.16, 0.24, 24]} />
          <meshStandardMaterial color={C.metalDark} roughness={0.5} metalness={0.3} />
        </mesh>
        <mesh position={[0, 0.25, 0]}>
          <cylinderGeometry args={[0.1, 0.1, 0.03, 24]} />
          <meshBasicMaterial color={C.aqua} />
        </mesh>
        <mesh ref={nodeGlow} position={[0, 0.3, 0]} rotation-x={-Math.PI / 2} material={glow}>
          <planeGeometry args={[1.1, 1.1]} />
        </mesh>
        <mesh ref={pulse} position={[0, 0.01, 0]} rotation-x={-Math.PI / 2} material={ringMat}>
          <ringGeometry args={[0.3, 0.33, 64]} />
        </mesh>
      </group>
    </RevealRoot>
  );
}

export default memo(NetworkScene);
