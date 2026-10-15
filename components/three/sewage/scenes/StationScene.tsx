"use client";

import { memo, useMemo, useRef } from "react";
import * as THREE from "three";
import { seeded } from "@/lib/seeded";
import { C } from "../../journey/materials/palette";
import { createFlowMaterial, densityFor } from "../../journey/materials/flow";
import { createGlowMaterial } from "../../journey/materials/fx";
import { easeOutBack, ramp, seg } from "../../journey/utils/ease";
import { pipePath } from "../../journey/utils/geometry";
import { useDisposable } from "../../journey/utils/useDisposable";
import { particleCount, phase, Plinth, RevealRoot, useStageFrame, type SceneProps } from "../../journey/scenes/common";
import { PY, STATION } from "../layout";

/*
 * 03 — Дамжуулах станц (эхний цэвэрлэгээ): орох шугамаас ил суваг руу, сараалж том хог хаягдлыг барьж (хог хуримтлагдана,
 * хажуугийн саванд), шүүгдсэн ус насос станц руу орж, насосоор даралттай шугамаар баруун тийш (Төв цэвэрлэх байгууламж руу) шахагдана.
 */

const { channel: CH, screenX: SX, house: HOUSE, pumps: PUMPS, w: W } = STATION;
const CH_LEN = CH.x1 - CH.x0;
const WALL = 0.035;
const CH_H = 0.13;
const WATER_Y = 0.085;
const BARS = 9;
const DEBRIS = 16;
const BIN = { x: SX - 0.05, z: CH.z + 0.42 };

const inlet = pipePath([
  [-W / 2, PY, CH.z],
  [CH.x0 + 0.02, PY, CH.z],
]);
// насосоос дээш гараад баруун тийш — даралттай шугам
const pressure = pipePath([
  [HOUSE.x + HOUSE.w / 2, 0.16, 0],
  [PUMPS.x, 0.16, 0],
  [PUMPS.x + 0.28, 0.16, 0],
  [PUMPS.x + 0.28, 0.34, 0],
  [W / 2, 0.34, 0],
]);

function StationScene({ rt, index }: SceneProps) {
  const debris = useMemo(() => {
    const rand = seeded(43);
    return Array.from({ length: DEBRIS }, (_, i) => ({
      // сараалжийн өмнө (урсгалын эсрэг тал) хуримтлагдана; эхний хэсэг нь саванд
      inBin: i % 3 === 2,
      x: (rand() - 0.5) * 0.14,
      z: (rand() - 0.5) * (CH.w - 0.06),
      y: rand() * 0.04,
      s: 0.016 + rand() * 0.014,
      r: rand() * Math.PI,
    }));
  }, []);
  const inletGeo = useDisposable(() => new THREE.TubeGeometry(inlet, 16, 0.055, 12, false), []);
  const inletMat = useDisposable(
    () => createFlowMaterial({ color: C.sewage, glow: C.sewageGlow, density: densityFor(inlet.getLength(), 4), speed: 0.8 }),
    [],
  );
  // ил сувгийн усны гадаргуу: PlaneGeometry-ийн uv.x урсгалын дагуу
  const waterMat = useDisposable(
    () => createFlowMaterial({ color: C.sewage, glow: C.sewageGlow, density: densityFor(CH_LEN, 5), speed: 0.6, duty: 0.25 }),
    [],
  );
  const pressureGeo = useDisposable(() => new THREE.TubeGeometry(pressure, 72, 0.06, 12, false), []);
  const pressureMat = useDisposable(
    () => createFlowMaterial({ color: C.sewage, glow: C.sewageGlow, density: densityFor(pressure.getLength(), 4), speed: 1.2 }),
    [],
  );
  const glow = useDisposable(() => createGlowMaterial(C.sewageGlow, 0), []);
  const pumpRing = useDisposable(() => new THREE.MeshStandardMaterial({ color: C.aqua, emissive: C.water, emissiveIntensity: 0.1 }), []);

  const walls = useRef<THREE.Group>(null);
  const water = useRef<THREE.Mesh>(null);
  const screen = useRef<THREE.Group>(null);
  const house = useRef<THREE.Group>(null);
  const pumps = useRef<THREE.Group>(null);
  const bin = useRef<THREE.Group>(null);
  const debrisMesh = useRef<THREE.InstancedMesh>(null);
  const glowMesh = useRef<THREE.Mesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  // p: суваг (0.15–0.4) → орох шугам, ус (0.25–0.55) → сараалж (0.35–0.55) → хог хуримтлагдах (0.45–0.8)
  //    → насос станц (0.25–0.55), насос (0.5–0.7) → даралттай шугам (0.65–1)
  useStageFrame(rt, index, (p, amb, tier) => {
    walls.current!.scale.set(1, Math.max(ramp(p, 0.15, 0.4), 0.001), 1);
    inletMat.uniforms.uPhase.value = phase(p, amb, 5);
    inletMat.uniforms.uDraw.value = ramp(p, 0.25, 0.45);
    waterMat.uniforms.uPhase.value = phase(p, amb, 5);
    waterMat.uniforms.uDraw.value = ramp(p, 0.35, 0.6);
    water.current!.visible = p > 0.35;
    screen.current!.scale.set(1, Math.max(easeOutBack(seg(p, 0.35, 0.55)), 0.001), 1);
    house.current!.scale.set(1, Math.max(ramp(p, 0.25, 0.55), 0.001), 1);
    pumps.current!.scale.setScalar(Math.max(easeOutBack(seg(p, 0.5, 0.7)), 0.001));
    bin.current!.scale.setScalar(Math.max(easeOutBack(seg(p, 0.4, 0.6)), 0.001));
    pressureMat.uniforms.uPhase.value = phase(p, amb, 6);
    pressureMat.uniforms.uDraw.value = ramp(p, 0.65, 1);
    pumpRing.emissiveIntensity = 0.1 + 1.4 * ramp(p, 0.6, 0.8);
    glow.uniforms.uOpacity.value = 0.5 * ramp(p, 0.45, 0.8);
    glowMesh.current!.visible = tier.fx;

    // хог: сараалжийн өмнө дараалан хуримтлагдана, хэсэг нь саванд
    const dm = debrisMesh.current!;
    dm.count = particleCount(DEBRIS, tier);
    const pile = seg(p, 0.45, 0.85);
    for (let i = 0; i < dm.count; i++) {
      const d = debris[i];
      const k = Math.max(easeOutBack(seg(pile, i / DEBRIS - 0.05, i / DEBRIS + 0.15)), 0.0001);
      if (d.inBin) dummy.position.set(BIN.x + d.x * 0.8, 0.1 + d.y, BIN.z + d.z * 0.6);
      else dummy.position.set(SX - 0.07 + d.x * 0.5, WATER_Y + d.y * 0.5, CH.z + d.z);
      dummy.rotation.set(d.r, d.r * 2, 0);
      dummy.scale.setScalar(d.s * k);
      dummy.updateMatrix();
      dm.setMatrixAt(i, dummy.matrix);
    }
    dm.instanceMatrix.needsUpdate = true;
  });

  return (
    <RevealRoot rt={rt} index={index}>
      <Plinth width={W} depth={1.9} />

      {/* ил суваг: хана, ёроол */}
      <group ref={walls} position={[(CH.x0 + CH.x1) / 2, 0, CH.z]}>
        <mesh position={[0, 0.01, 0]}>
          <boxGeometry args={[CH_LEN, 0.02, CH.w + WALL * 2]} />
          <meshStandardMaterial color={C.foundation} roughness={0.9} />
        </mesh>
        {[-1, 1].map((s) => (
          <mesh key={s} position={[0, CH_H / 2, s * (CH.w / 2 + WALL / 2)]}>
            <boxGeometry args={[CH_LEN, CH_H, WALL]} />
            <meshStandardMaterial color={C.concrete} roughness={0.8} />
          </mesh>
        ))}
      </group>
      <mesh ref={water} position={[(CH.x0 + CH.x1) / 2, WATER_Y, CH.z]} rotation-x={-Math.PI / 2} material={waterMat}>
        <planeGeometry args={[CH_LEN, CH.w]} />
      </mesh>
      <mesh geometry={inletGeo} material={inletMat} />

      {/* сараалж: налуу төмөр торгууд + дээрх тавцан */}
      <group ref={screen} position={[SX, 0, CH.z]}>
        <group rotation-z={0.28}>
          {Array.from({ length: BARS }, (_, i) => (
            <mesh key={i} position={[0, 0.13, -CH.w / 2 + 0.02 + (i * (CH.w - 0.04)) / (BARS - 1)]}>
              <boxGeometry args={[0.012, 0.26, 0.01]} />
              <meshStandardMaterial color={C.metal} roughness={0.4} metalness={0.5} />
            </mesh>
          ))}
        </group>
        <mesh position={[0.04, 0.27, 0]}>
          <boxGeometry args={[0.16, 0.02, CH.w + 0.16]} />
          <meshStandardMaterial color={C.metalDark} roughness={0.5} metalness={0.3} />
        </mesh>
        <mesh ref={glowMesh} position={[0, 0.2, CH.w / 2 + 0.1]} material={glow}>
          <planeGeometry args={[0.6, 0.6]} />
        </mesh>
      </group>

      {/* баригдсан хог: сараалжийн өмнө ба хажуугийн саванд */}
      <group ref={bin} position={[BIN.x, 0, BIN.z]}>
        <mesh position={[0, 0.06, 0]}>
          <boxGeometry args={[0.24, 0.12, 0.18]} />
          <meshStandardMaterial color={C.metalDark} roughness={0.6} metalness={0.25} />
        </mesh>
      </group>
      <instancedMesh ref={debrisMesh} args={[undefined, undefined, DEBRIS]} frustumCulled={false}>
        <dodecahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color={C.debris} roughness={0.95} flatShading />
      </instancedMesh>

      {/* насос станцын байр */}
      <group ref={house} position={[HOUSE.x, 0, HOUSE.z]}>
        <mesh position={[0, HOUSE.h / 2, 0]}>
          <boxGeometry args={[HOUSE.w, HOUSE.h, HOUSE.d]} />
          <meshStandardMaterial color={C.wall} roughness={0.7} />
        </mesh>
        <mesh position={[0, HOUSE.h + 0.025, 0]}>
          <boxGeometry args={[HOUSE.w + 0.08, 0.05, HOUSE.d + 0.08]} />
          <meshStandardMaterial color={C.roof} roughness={0.6} />
        </mesh>
        {/* хаалга, цонх */}
        <mesh position={[0.18, 0.15, HOUSE.d / 2 + 0.002]}>
          <planeGeometry args={[0.16, 0.28]} />
          <meshStandardMaterial color={C.metalDark} roughness={0.6} />
        </mesh>
        {[-0.3, -0.08].map((x) => (
          <mesh key={x} position={[x, 0.36, HOUSE.d / 2 + 0.002]}>
            <planeGeometry args={[0.14, 0.08]} />
            <meshStandardMaterial color="#2e2508" emissive={C.warm} emissiveIntensity={0.9} />
          </mesh>
        ))}
      </group>

      {/* насосууд: даралттай шугам руу */}
      <group ref={pumps} position={[PUMPS.x, 0, 0]}>
        {PUMPS.z.map((z) => (
          <group key={z} position={[0, 0, z]}>
            <mesh position={[0, 0.03, 0]}>
              <boxGeometry args={[0.26, 0.06, 0.2]} />
              <meshStandardMaterial color={C.foundation} roughness={0.85} />
            </mesh>
            <mesh position={[0, 0.16, 0]}>
              <cylinderGeometry args={[0.07, 0.08, 0.2, 18]} />
              <meshStandardMaterial color={C.metal} roughness={0.35} metalness={0.5} />
            </mesh>
            <mesh position={[0, 0.27, 0]} material={pumpRing}>
              <cylinderGeometry args={[0.05, 0.05, 0.025, 18]} />
            </mesh>
            {/* насосоос толгой шугам руу */}
            <mesh position={[0, 0.16, -z / 2]} rotation-x={Math.PI / 2}>
              <cylinderGeometry args={[0.025, 0.025, Math.abs(z), 10]} />
              <meshStandardMaterial color={C.metalDark} roughness={0.5} metalness={0.3} />
            </mesh>
          </group>
        ))}
      </group>
      <mesh geometry={pressureGeo} material={pressureMat} />
    </RevealRoot>
  );
}

export default memo(StationScene);
