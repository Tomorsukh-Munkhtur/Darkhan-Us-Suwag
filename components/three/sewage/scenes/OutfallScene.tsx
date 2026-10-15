"use client";

import { memo, useMemo, useRef } from "react";
import * as THREE from "three";
import { seeded } from "@/lib/seeded";
import { C } from "../../journey/materials/palette";
import { createFlowMaterial, densityFor } from "../../journey/materials/flow";
import { createRiverMaterial } from "../../journey/materials/water";
import { createGlowMaterial, createRingMaterial } from "../../journey/materials/fx";
import { easeOutBack, ramp, seg } from "../../journey/utils/ease";
import { dropletGeometry, pipePath, ribbonGeometry } from "../../journey/utils/geometry";
import { useDisposable } from "../../journey/utils/useDisposable";
import { particleCount, phase, Plinth, RevealRoot, useStageFrame, type SceneProps } from "../../journey/scenes/common";
import { LAB, OUTFALL, PY } from "../layout";

/*
 * 05 — Байгаль орчинд: цэвэршүүлсэн ус (цэнхэр) хоолойгоор ирж, эргийн бетон амсраас гол руу цутгана; голын ус урсаж,
 * эрэг ногоорч мод ургана. Хажууд нь лабораторийн хяналтын цэг — стандарт хангасан (ногоон гэрэл). 98% — DOM шошго.
 */

const W = 4.2;
const D = 2.6;
const BANK_Z = OUTFALL.z + 0.14;
const DROPS = 6;

const riverCurve = new THREE.CatmullRomCurve3(
  [
    [-2.1, 0.012, 0.95],
    [-1.1, 0.012, 0.72],
    [OUTFALL.x, 0.012, 0.68],
    [0.9, 0.012, 0.86],
    [2.1, 0.012, 0.7],
  ].map(([x, y, z]) => new THREE.Vector3(x, y, z)),
);
const pipe = pipePath([
  [-2.1, PY + 0.06, -0.35],
  [OUTFALL.x, PY + 0.06, -0.35],
  [OUTFALL.x, PY + 0.06, BANK_Z],
]);

function makeTrees() {
  const rand = seeded(53);
  const out: { x: number; z: number; s: number; delay: number }[] = [];
  for (let i = 0; i < 16; i++) {
    const x = -1.95 + rand() * 3.9;
    const z = -1.15 + rand() * 0.7;
    // хоолой, лабораторийн эргэн тойронд мод суулгахгүй
    if (Math.abs(z + 0.35) < 0.14 || (Math.abs(x - LAB.x) < 0.3 && Math.abs(z - LAB.z) < 0.3)) continue;
    out.push({ x, z, s: 0.7 + rand() * 0.5, delay: rand() * 0.3 });
  }
  // голын цаад эрэг
  for (let i = 0; i < 5; i++) out.push({ x: -1.8 + i * 0.85 + rand() * 0.2, z: 1.15, s: 0.55 + rand() * 0.3, delay: 0.2 + rand() * 0.2 });
  return out;
}

function OutfallScene({ rt, index }: SceneProps) {
  const trees = useMemo(makeTrees, []);
  const riverGeo = useDisposable(() => ribbonGeometry(riverCurve, 0.5, 120), []);
  const river = useDisposable(() => createRiverMaterial(riverCurve.getLength()), []);
  const pipeGeo = useDisposable(() => new THREE.TubeGeometry(pipe, 64, 0.06, 12, false), []);
  const pipeMat = useDisposable(
    () => createFlowMaterial({ color: "#1b8fd0", glow: C.foam, density: densityFor(pipe.getLength(), 3.5), speed: 0.8 }),
    [],
  );
  const dropGeo = useDisposable(() => dropletGeometry(1), []);
  const ringMat = useDisposable(() => createRingMaterial(C.aqua, 20), []);
  const labGlow = useDisposable(() => createGlowMaterial(C.green, 0), []);
  const beacon = useDisposable(() => new THREE.MeshBasicMaterial({ color: C.line }), []);
  const crownGeo = useDisposable(() => new THREE.ConeGeometry(1, 2.2, 7), []);
  const crownMat = useDisposable(() => new THREE.MeshStandardMaterial({ color: C.tree, roughness: 0.85, flatShading: true }), []);

  const treeMesh = useRef<THREE.InstancedMesh>(null);
  const headwall = useRef<THREE.Group>(null);
  const lab = useRef<THREE.Group>(null);
  const drops = useRef<THREE.InstancedMesh>(null);
  const ripple = useRef<THREE.Mesh>(null);
  const labGlowMesh = useRef<THREE.Mesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const lastGrow = useRef(-1);
  const green = useMemo(() => new THREE.Color(C.green), []);
  const line = useMemo(() => new THREE.Color(C.line), []);

  // p: эрэг, гол (0.2–0.6) → мод ургах (0.25–0.7) → хоолой (0.4–0.75) → гол руу цутгах (0.7–) → хяналт ногоон (0.8–0.95)
  useStageFrame(rt, index, (p, amb, tier) => {
    river.uniforms.uPhase.value = phase(p, amb, 5);
    river.uniforms.uDraw.value = ramp(p, 0.2, 0.6);
    river.uniforms.uDetail.value = tier.waterDetail;
    pipeMat.uniforms.uPhase.value = phase(p, amb, 5);
    pipeMat.uniforms.uDraw.value = ramp(p, 0.4, 0.75);
    headwall.current!.scale.setScalar(Math.max(easeOutBack(seg(p, 0.3, 0.5)), 0.001));
    lab.current!.scale.setScalar(Math.max(easeOutBack(seg(p, 0.5, 0.7)), 0.001));
    const ok = seg(p, 0.8, 0.95);
    beacon.color.copy(line).lerp(green, ok);
    labGlow.uniforms.uOpacity.value = 0.6 * ok;
    labGlowMesh.current!.visible = tier.fx;

    const grow = seg(p, 0.25, 0.7);
    if (grow !== lastGrow.current) {
      lastGrow.current = grow;
      const m = treeMesh.current!;
      trees.forEach((t, i) => {
        const k = easeOutBack(seg(grow, t.delay, t.delay + 0.6));
        // конус: өндөр 2.2 × scale, суурь нь газарт
        dummy.position.set(t.x, 1.1 * 0.085 * t.s * k, t.z);
        dummy.rotation.set(0, i, 0);
        dummy.scale.setScalar(Math.max(0.085 * t.s * k, 0.0001));
        dummy.updateMatrix();
        m.setMatrixAt(i, dummy.matrix);
      });
      m.instanceMatrix.needsUpdate = true;
    }

    // амсраас гол руу цутгах дуслууд (фаз нь progress-оос)
    const flowing = seg(p, 0.72, 0.8);
    const dm = drops.current!;
    dm.count = particleCount(DROPS, tier);
    for (let i = 0; i < dm.count; i++) {
      const k = (phase(p, amb, 4, 1.2) + i / dm.count) % 1;
      dummy.position.set(OUTFALL.x + (i % 3 - 1) * 0.02, PY + 0.04 - k * 0.08, BANK_Z + 0.04 + k * 0.1);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.setScalar(Math.max(0.018 * flowing * (1 - k * 0.5), 0.0001));
      dummy.updateMatrix();
      dm.setMatrixAt(i, dummy.matrix);
    }
    dm.instanceMatrix.needsUpdate = true;
    const r = phase(p, amb, 2, 0.6) % 1;
    ripple.current!.scale.setScalar(0.4 + r * 1.4);
    ringMat.uniforms.uPhase.value = phase(p, amb, 6);
    ringMat.uniforms.uOpacity.value = (1 - r) * flowing;
  });

  return (
    <RevealRoot rt={rt} index={index}>
      <Plinth width={W} depth={D} top="#16413f" />
      <mesh geometry={riverGeo} material={river} />

      {/* мод */}
      <instancedMesh ref={treeMesh} args={[crownGeo, crownMat, trees.length]} frustumCulled={false} />

      {/* цэвэр усны хоолой, эргийн бетон амсар */}
      <mesh geometry={pipeGeo} material={pipeMat} />
      <group ref={headwall} position={[OUTFALL.x, 0, BANK_Z - 0.02]}>
        <mesh position={[0, 0.08, 0]}>
          <boxGeometry args={[0.42, 0.16, 0.08]} />
          <meshStandardMaterial color={C.concrete} roughness={0.8} />
        </mesh>
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * 0.24, 0.06, 0.08]} rotation-y={s * 0.5}>
            <boxGeometry args={[0.06, 0.12, 0.2]} />
            <meshStandardMaterial color={C.concrete} roughness={0.8} />
          </mesh>
        ))}
      </group>
      <instancedMesh ref={drops} args={[dropGeo, undefined, DROPS]} frustumCulled={false}>
        <meshBasicMaterial color={C.foam} />
      </instancedMesh>
      <mesh ref={ripple} position={[OUTFALL.x, 0.016, BANK_Z + 0.2]} rotation-x={-Math.PI / 2} material={ringMat}>
        <ringGeometry args={[0.12, 0.135, 48]} />
      </mesh>

      {/* лабораторийн хяналтын цэг: стандарт хангасан — ногоон гэрэл */}
      <group ref={lab} position={[LAB.x, 0, LAB.z]}>
        <mesh position={[0, 0.14, 0]}>
          <boxGeometry args={[0.36, 0.28, 0.3]} />
          <meshStandardMaterial color={C.wall} roughness={0.7} />
        </mesh>
        <mesh position={[0, 0.295, 0]}>
          <boxGeometry args={[0.4, 0.03, 0.34]} />
          <meshStandardMaterial color={C.roof} roughness={0.6} />
        </mesh>
        <mesh position={[0, 0.36, 0]} material={beacon}>
          <sphereGeometry args={[0.04, 14, 10]} />
        </mesh>
        <mesh ref={labGlowMesh} position={[0, 0.36, 0.02]} material={labGlow}>
          <planeGeometry args={[0.5, 0.5]} />
        </mesh>
      </group>
    </RevealRoot>
  );
}

export default memo(OutfallScene);
