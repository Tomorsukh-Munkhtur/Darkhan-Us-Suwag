"use client";

import { memo, useMemo, useRef } from "react";
import * as THREE from "three";
import { C } from "../materials/palette";
import { createAquiferMaterial } from "../materials/water";
import { createFlowMaterial, densityFor } from "../materials/flow";
import { createGlowMaterial } from "../materials/fx";
import { easeOutBack, ramp, seg } from "../utils/ease";
import { dropletGeometry, pipePath } from "../utils/geometry";
import { useDisposable } from "../utils/useDisposable";
import { particleCount, phase, RevealRoot, Strata, useStageFrame, type SceneProps } from "./common";

/* 2.2 — Ус олборлолт: хөрсний огтлол, босоо худгийн хоолой, дээш урсах ус, насос байшин, цуглуулах шугам */

const W = 3.6;
const D = 2.2;
const FRONT = D / 2;
const SHAFT_X = -0.3;
const SHAFT_Z = FRONT + 0.15;
// хөрсний давхаргын ёроолууд (дээд тал y=0)
const LAYERS = [0.12, 0.26, 0.22, 0.3, 0.28];
const AQUIFER_TOP = -(LAYERS[0] + LAYERS[1] + LAYERS[2]);
const AQUIFER_MID = AQUIFER_TOP - LAYERS[3] / 2;
const SHAFT_BOTTOM = AQUIFER_TOP - LAYERS[3] + 0.04;
const SHAFT_TOP = 0.32;
const SHAFT_H = SHAFT_TOP - SHAFT_BOTTOM;
const HOUSE = { x: SHAFT_X, z: FRONT - 0.32, w: 0.92, h: 0.52, d: 0.64 };
const PIPE_Y = 0.2;
const DROPS = 5;

const pipe = pipePath([
  [HOUSE.x + HOUSE.w / 2, PIPE_Y, HOUSE.z],
  [2.1, PIPE_Y, HOUSE.z],
]);

function PumpScene({ rt, index }: SceneProps) {
  const aquifer = useDisposable(createAquiferMaterial, []);
  const column = useDisposable(
    () => createFlowMaterial({ color: "#1f8fd0", glow: C.foam, axis: "y", density: 7, speed: 0.9, duty: 0.35 }),
    [],
  );
  const pipeGeo = useDisposable(() => new THREE.TubeGeometry(pipe, 48, 0.06, 12, false), []);
  const pipeMat = useDisposable(
    () => createFlowMaterial({ color: "#1b7fc0", glow: C.foam, density: densityFor(pipe.getLength(), 3.2), speed: 0.7 }),
    [],
  );
  const glow = useDisposable(() => createGlowMaterial(C.aqua, 0.6), []);
  const pumpRing = useDisposable(
    () => new THREE.MeshStandardMaterial({ color: C.aqua, emissive: C.water, emissiveIntensity: 0.15 }),
    [],
  );
  const glowMesh = useRef<THREE.Mesh>(null);
  const dropGeo = useDisposable(() => dropletGeometry(1), []);

  const house = useRef<THREE.Group>(null);
  const casing = useRef<THREE.Mesh>(null);
  const pumpUnit = useRef<THREE.Group>(null);
  const impeller = useRef<THREE.Group>(null);
  const supports = useRef<THREE.Group>(null);
  const drops = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  // p: огтлол (0–0.4) → байшин (0.3–0.55) → хоолой (0.35–0.6) → насос идэвхжих (0.4–0.62) → ус дээш (0.5–0.88)
  //    → цуглуулах шугам урсах (0.7–1) → хоолой доторх дусал (0.85–1)
  useStageFrame(rt, index, (p, amb, tier) => {
    const k = (a: number, b: number) => Math.max(easeOutBack(seg(p, a, b)), 0.001);
    house.current!.scale.set(1, k(0.3, 0.55), 1);
    casing.current!.scale.set(1, Math.max(ramp(p, 0.35, 0.6), 0.001), 1);
    pumpUnit.current!.scale.setScalar(k(0.4, 0.6));
    supports.current!.scale.set(1, k(0.55, 0.75), 1);

    // насос идэвхжих: гэрэлт цагираг асч, сэнс progress-оор эргэнэ
    const active = ramp(p, 0.45, 0.62);
    pumpRing.emissiveIntensity = 0.15 + 1.6 * active;
    impeller.current!.rotation.z = -(seg(p, 0.45, 1) * Math.PI * 6 + amb * 2.4);
    glow.uniforms.uOpacity.value = 0.6 * active;
    glowMesh.current!.visible = tier.fx;

    column.uniforms.uPhase.value = phase(p, amb, 6);
    column.uniforms.uDraw.value = ramp(p, 0.5, 0.88);
    pipeMat.uniforms.uPhase.value = phase(p, amb, 5);
    pipeMat.uniforms.uDraw.value = ramp(p, 0.7, 1);
    aquifer.uniforms.uPhase.value = phase(p, amb, 4, 0.3);
    aquifer.uniforms.uIntensity.value = ramp(p, 0.2, 0.6);
    aquifer.uniforms.uDetail.value = tier.waterDetail;

    // хоолой доторх дуслууд: доороос дээш (фаз нь progress-оос)
    const m = drops.current!;
    m.count = particleCount(DROPS, tier);
    const show = seg(p, 0.85, 1);
    for (let i = 0; i < m.count; i++) {
      const q = (phase(p, amb, 2.5, 0.32) + i / m.count) % 1;
      const y = SHAFT_BOTTOM + 0.12 + q * (SHAFT_H - 0.35);
      const s = 0.028 * show * Math.sin(Math.PI * Math.min(q * 1.4, 1));
      dummy.position.set(SHAFT_X + (i % 2 ? 0.02 : -0.02), y, SHAFT_Z);
      dummy.scale.setScalar(Math.max(s, 0.0001));
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  });

  return (
    <RevealRoot rt={rt} index={index}>
      <Strata
        width={W}
        depth={D}
        layers={[
          { h: LAYERS[0], color: C.ground },
          { h: LAYERS[1], color: C.soilA },
          { h: LAYERS[2], color: C.soilB },
          { h: LAYERS[3], material: aquifer },
          { h: LAYERS[4], color: C.bedrock },
        ]}
      />

      {/* огтлолын урд талын гүн ховил (хоолойн ард) */}
      <mesh position={[SHAFT_X, (SHAFT_BOTTOM - 0.04) / 2, FRONT + 0.002]}>
        <planeGeometry args={[0.36, -(SHAFT_BOTTOM - 0.04)]} />
        <meshBasicMaterial color="#061a2c" transparent opacity={0.55} />
      </mesh>

      {/* босоо хоолой: тунгалаг бүрхүүл + дээш урсах ус; дээд үзүүр нь насос байшин руу орно */}
      <group position={[SHAFT_X, SHAFT_BOTTOM, SHAFT_Z]}>
        <mesh position={[0, SHAFT_H / 2, 0]} material={column}>
          <cylinderGeometry args={[0.075, 0.075, SHAFT_H, 20, 1, true]} />
        </mesh>
        <mesh ref={casing} position={[0, SHAFT_H / 2, 0]} renderOrder={2}>
          <cylinderGeometry args={[0.13, 0.13, SHAFT_H, 24, 1, true]} />
          <meshStandardMaterial color={C.aqua} transparent opacity={0.16} roughness={0.2} depthWrite={false} />
        </mesh>
        <mesh position={[0, SHAFT_H - 0.06, -(SHAFT_Z - FRONT) / 2]} rotation-x={Math.PI / 2}>
          <cylinderGeometry args={[0.07, 0.07, SHAFT_Z - FRONT, 16]} />
          <meshStandardMaterial color={C.metalDark} roughness={0.5} metalness={0.3} />
        </mesh>
      </group>

      <instancedMesh ref={drops} args={[dropGeo, undefined, DROPS]} frustumCulled={false}>
        <meshBasicMaterial color={C.foam} />
      </instancedMesh>

      {/* гүний насос (уст үед) */}
      <group ref={pumpUnit} position={[SHAFT_X, AQUIFER_MID - 0.02, SHAFT_Z]}>
        <mesh>
          <cylinderGeometry args={[0.11, 0.11, 0.2, 20]} />
          <meshStandardMaterial color={C.metal} roughness={0.4} metalness={0.4} />
        </mesh>
        <mesh rotation-x={Math.PI / 2} material={pumpRing}>
          <torusGeometry args={[0.12, 0.012, 8, 32]} />
        </mesh>
        <mesh ref={glowMesh} position={[0, 0, 0.05]} material={glow}>
          <planeGeometry args={[0.7, 0.7]} />
        </mesh>
      </group>

      {/* насос байшин */}
      <group ref={house} position={[HOUSE.x, 0, HOUSE.z]}>
        <mesh position={[0, HOUSE.h / 2, 0]}>
          <boxGeometry args={[HOUSE.w, HOUSE.h, HOUSE.d]} />
          <meshStandardMaterial color={C.wall} roughness={0.75} />
        </mesh>
        <mesh position={[0, HOUSE.h + 0.035, 0]}>
          <boxGeometry args={[HOUSE.w + 0.1, 0.07, HOUSE.d + 0.1]} />
          <meshStandardMaterial color={C.roof} roughness={0.7} />
        </mesh>
        {/* төлөвийн гэрэл */}
        <mesh position={[-0.3, HOUSE.h - 0.1, HOUSE.d / 2 + 0.002]}>
          <planeGeometry args={[0.16, 0.04]} />
          <meshBasicMaterial color={C.aqua} />
        </mesh>
        {/* сэнс (хоолойн баруун талд) */}
        <group position={[0.26, HOUSE.h * 0.5, HOUSE.d / 2 + 0.004]}>
          <mesh>
            <circleGeometry args={[0.13, 24]} />
            <meshStandardMaterial color="#0b2238" roughness={0.6} />
          </mesh>
          <group ref={impeller} position={[0, 0, 0.004]}>
            {[0, 1, 2, 3].map((i) => (
              <mesh key={i} rotation-z={(i * Math.PI) / 2}>
                <planeGeometry args={[0.04, 0.2]} />
                <meshBasicMaterial color={C.water} />
              </mesh>
            ))}
          </group>
        </group>
      </group>

      {/* цуглуулах шугам */}
      <mesh geometry={pipeGeo} material={pipeMat} />
      <group ref={supports}>
        {[0.55, 1.15, 1.7].map((x) => (
          <mesh key={x} position={[x, PIPE_Y / 2, HOUSE.z]}>
            <boxGeometry args={[0.05, PIPE_Y, 0.05]} />
            <meshStandardMaterial color={C.metalDark} roughness={0.6} />
          </mesh>
        ))}
      </group>
    </RevealRoot>
  );
}

export default memo(PumpScene);
