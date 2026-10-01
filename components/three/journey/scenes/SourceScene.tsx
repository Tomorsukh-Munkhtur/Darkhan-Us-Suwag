"use client";

import { memo, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { seeded } from "@/lib/seeded";
import { C } from "../materials/palette";
import { createAquiferMaterial, createRiverMaterial } from "../materials/water";
import { createRingMaterial } from "../materials/fx";
import { easeOutBack, ramp, seg } from "../utils/ease";
import { mountainGeometry, ribbonGeometry } from "../utils/geometry";
import { useDisposable } from "../utils/useDisposable";
import { phase, RevealRoot, Strata, useStageFrame, type SceneProps } from "./common";

/* 2.1 — Эх үүсвэр: нам полигон уулс, газрын огтлол, гэрэлтэх гүний уст үе, гол, хамгаалалтын бүсийн цагиргууд */

const W = 4.4;
const D = 2.8;
const WELL: [number, number, number] = [0.95, 0, 0.15];
const RINGS = [0.36, 0.62, 0.88];

type Peak = { x: number; z: number; r: number; h: number; color: THREE.Color; rot: number; delay: number };

function makePeaks(): Peak[] {
  const rand = seeded(3);
  const back = new THREE.Color(C.mountainA);
  const front = new THREE.Color(C.mountainB);
  const out: Peak[] = [];
  // арын нуруу: өндөр, хавтангийн ирмэгээс хэтрэхгүй
  for (let i = 0; i < 7; i++) {
    out.push({
      x: -1.9 + i * 0.63 + (rand() - 0.5) * 0.18,
      z: -0.95 + (rand() - 0.5) * 0.12,
      r: 0.36 + rand() * 0.1,
      h: 0.7 + rand() * 0.55,
      color: back,
      rot: rand() * Math.PI,
      delay: i * 0.035,
    });
  }
  // урд толгод: зүүн тал (голын хөндий, худгийн бүс нээлттэй)
  for (let i = 0; i < 4; i++) {
    out.push({
      x: -1.85 + i * 0.46 + (rand() - 0.5) * 0.12,
      z: -0.52 + (rand() - 0.5) * 0.12,
      r: 0.26 + rand() * 0.1,
      h: 0.32 + rand() * 0.22,
      color: front,
      rot: rand() * Math.PI,
      delay: 0.12 + i * 0.035,
    });
  }
  return out;
}

const riverCurve = new THREE.CatmullRomCurve3(
  [
    [-2.2, 0.012, 0.02],
    [-1.35, 0.012, 0.42],
    [-0.45, 0.012, 0.2],
    [0.35, 0.012, 0.66],
    [1.3, 0.012, 0.52],
    [2.2, 0.012, 0.86],
  ].map(([x, y, z]) => new THREE.Vector3(x, y, z)),
);

function SourceScene({ rt, index }: SceneProps) {
  const peaks = useMemo(makePeaks, []);
  const mountainGeo = useDisposable(() => mountainGeometry(5), []);
  const mountainMat = useDisposable(
    () => new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.85 }),
    [],
  );
  const aquifer = useDisposable(createAquiferMaterial, []);
  const riverGeo = useDisposable(() => ribbonGeometry(riverCurve, 0.2, 120), []);
  const river = useDisposable(() => createRiverMaterial(riverCurve.getLength()), []);
  const ringMat = useDisposable(() => createRingMaterial(C.aqua, 40), []);
  const ringGeos = useDisposable(() => {
    const list = RINGS.map((r) => new THREE.RingGeometry(r - 0.012, r + 0.012, 128));
    return { list, dispose: () => list.forEach((g) => g.dispose()) };
  }, []);

  const mountains = useRef<THREE.InstancedMesh>(null);
  const rings = useRef<(THREE.Mesh | null)[]>([]);
  const well = useRef<THREE.Group>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const lastGrow = useRef(-1);

  useLayoutEffect(() => {
    const m = mountains.current!;
    peaks.forEach((p, i) => m.setColorAt(i, p.color));
    m.instanceColor!.needsUpdate = true;
  }, [peaks]);

  // p: газар (0–0.4) → уулс (0.15–0.6) → уст давхарга гэрэлтэх (0.2–0.65) → гол урсах (0.35–0.85) → бүсийн цагираг (0.55–1)
  useStageFrame(rt, index, (p, amb, tier) => {
    // уулс: дараалан ургана (grow өөрчлөгдсөн үед л матриц шинэчилнэ)
    const grow = seg(p, 0.15, 0.6);
    if (grow !== lastGrow.current) {
      lastGrow.current = grow;
      const m = mountains.current!;
      peaks.forEach((p, i) => {
        const k = easeOutBack(seg(grow, p.delay, p.delay + 0.55));
        dummy.position.set(p.x, 0, p.z);
        dummy.rotation.set(0, p.rot, 0);
        dummy.scale.set(p.r, Math.max(p.h * k, 0.001), p.r);
        dummy.updateMatrix();
        m.setMatrixAt(i, dummy.matrix);
      });
      m.instanceMatrix.needsUpdate = true;
    }

    aquifer.uniforms.uPhase.value = phase(p, amb, 4, 0.3);
    aquifer.uniforms.uIntensity.value = ramp(p, 0.2, 0.65);
    aquifer.uniforms.uDetail.value = tier.waterDetail;
    river.uniforms.uPhase.value = phase(p, amb, 5);
    river.uniforms.uDraw.value = ramp(p, 0.35, 0.85);
    river.uniforms.uDetail.value = tier.waterDetail;
    ringMat.uniforms.uPhase.value = phase(p, amb, 6);

    RINGS.forEach((_, i) => {
      const ring = rings.current[i];
      if (ring) ring.scale.setScalar(Math.max(easeOutBack(seg(p, 0.55 + i * 0.1, 0.8 + i * 0.1)), 0.001));
    });
    if (well.current) well.current.scale.setScalar(Math.max(easeOutBack(seg(p, 0.5, 0.75)), 0.001));
  });

  return (
    <RevealRoot rt={rt} index={index}>
      <Strata
        width={W}
        depth={D}
        layers={[
          { h: 0.16, color: C.ground },
          { h: 0.24, color: C.clay },
          { h: 0.28, material: aquifer },
          { h: 0.5, color: C.bedrock },
        ]}
      />

      <instancedMesh ref={mountains} args={[mountainGeo, mountainMat, peaks.length]} frustumCulled={false} />

      <mesh geometry={riverGeo} material={river} />

      {/* хамгаалалтын бүс (I, II, III) */}
      <group position={[WELL[0], 0.008, WELL[2]]} rotation-x={-Math.PI / 2}>
        {ringGeos.list.map((g, i) => (
          <mesh
            key={i}
            geometry={g}
            material={ringMat}
            ref={(el) => {
              rings.current[i] = el;
            }}
          />
        ))}
      </group>

      {/* гүний худаг */}
      <group ref={well} position={WELL}>
        <mesh position={[0, 0.07, 0]}>
          <cylinderGeometry args={[0.07, 0.085, 0.14, 16]} />
          <meshStandardMaterial color={C.metal} roughness={0.45} metalness={0.3} />
        </mesh>
        <mesh position={[0, 0.15, 0]}>
          <cylinderGeometry args={[0.045, 0.045, 0.03, 16]} />
          <meshStandardMaterial color={C.aqua} emissive={C.water} emissiveIntensity={1.4} />
        </mesh>
      </group>
    </RevealRoot>
  );
}

export default memo(SourceScene);
