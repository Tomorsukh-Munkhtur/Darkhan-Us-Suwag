"use client";

import { memo, useMemo, useRef } from "react";
import * as THREE from "three";
import { C } from "../materials/palette";
import { createFlowMaterial, densityFor } from "../materials/flow";
import { createWaterSurfaceMaterial } from "../materials/water";
import { setLabelText } from "../runtime";
import { easeInOutCubic, easeOutBack, ramp, seg } from "../utils/ease";
import { pipePath } from "../utils/geometry";
import { useDisposable } from "../utils/useDisposable";
import { phase, Plinth, RevealRoot, useStageFrame, type SceneProps } from "./common";

/* 2.4 — Усан сан: тунгалаг цилиндр сав, ус 12% → 86% хүртэл дүүрнэ, гадаргуу долгиолж гэрэл тусна */

const TX = -0.2;
const R = 1.02;
const TANK_H = 1.9;
const BASE = 0.03;
const WATER_R = R - 0.05;
const FROM = 0.12;
const TO = 0.86;
const GAUGE_X = TX + R + 0.3;
const GAUGE_Z = 0.55;
const TICKS = 11;

const inflow = pipePath([
  [-2.0, 1.72, -0.35],
  [TX - R * 0.94, 1.72, -0.35],
]);
const outflow = pipePath([
  [TX + R * 0.9, 0.2, -0.45],
  [2.0, 0.2, -0.45],
]);

function ReservoirScene({ rt, index }: SceneProps) {
  const surface = useDisposable(createWaterSurfaceMaterial, []);
  const inGeo = useDisposable(() => new THREE.TubeGeometry(inflow, 16, 0.06, 12, false), []);
  const outGeo = useDisposable(() => new THREE.TubeGeometry(outflow, 24, 0.06, 12, false), []);
  const inMat = useDisposable(
    () => createFlowMaterial({ color: "#1b7fc0", glow: C.foam, density: densityFor(inflow.getLength(), 4), speed: 0.8 }),
    [],
  );
  const outMat = useDisposable(
    () => createFlowMaterial({ color: "#1b7fc0", glow: C.foam, density: densityFor(outflow.getLength(), 4), speed: 0.8 }),
    [],
  );
  const ribs = useDisposable(() => {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const x = Math.cos(a) * (R + 0.004);
      const z = Math.sin(a) * (R + 0.004);
      pts.push(new THREE.Vector3(x, 0, z), new THREE.Vector3(x, TANK_H, z));
    }
    return new THREE.BufferGeometry().setFromPoints(pts);
  }, []);

  const tank = useRef<THREE.Group>(null);
  const water = useRef<THREE.Mesh>(null);
  const top = useRef<THREE.Mesh>(null);
  const marker = useRef<THREE.Group>(null);
  const gauge = useRef<THREE.Group>(null);
  const ticks = useRef<THREE.InstancedMesh>(null);
  const pointer = useRef<THREE.Mesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const ticksSet = useRef(false);

  // p: сав (0.2–0.45) → хэмжүүр (0.3–0.55) → орох шугам (0.3–0.5) → ус 12% → 86% (0.35–1) → гарах шугам (0.8–1)
  useStageFrame(rt, index, (r, amb, tier) => {
    tank.current!.scale.set(1, Math.max(ramp(r, 0.2, 0.45), 0.001), 1);
    gauge.current!.scale.set(1, Math.max(easeOutBack(seg(r, 0.3, 0.55)), 0.001), 1);

    if (!ticksSet.current) {
      ticksSet.current = true;
      const m = ticks.current!;
      for (let i = 0; i < TICKS; i++) {
        dummy.position.set(0, BASE + (i / (TICKS - 1)) * TANK_H, 0);
        dummy.scale.set(i % 5 === 0 ? 1.8 : 1, 1, 1);
        dummy.updateMatrix();
        m.setMatrixAt(i, dummy.matrix);
      }
      m.instanceMatrix.needsUpdate = true;
    }

    // түвшин: SVG-тэй адил 12% → 86% (зөвхөн progress-оос). Ambient үед гадаргуу бага зэрэг хэлбэлзэнэ, тоо өөрчлөгдөхгүй.
    const fill = easeInOutCubic(seg(r, 0.35, 1));
    const level = FROM + (TO - FROM) * fill;
    const h = Math.max((level + Math.sin(amb * 0.9) * 0.003 * fill) * TANK_H, 0.001);
    const show = ramp(r, 0.3, 0.45);
    water.current!.scale.set(1, h * show, 1);
    water.current!.position.y = BASE + (h * show) / 2;
    top.current!.position.y = BASE + h * show + 0.001;
    top.current!.visible = show > 0.01;
    marker.current!.position.y = BASE + h * show;
    pointer.current!.position.y = BASE + h * show;
    setLabelText(rt, "reservoir-level", `${Math.round(level * 100)}%`);

    surface.uniforms.uPhase.value = phase(r, amb, 3);
    surface.uniforms.uDetail.value = tier.waterDetail;
    inMat.uniforms.uPhase.value = phase(r, amb, 5);
    inMat.uniforms.uDraw.value = ramp(r, 0.3, 0.5);
    outMat.uniforms.uPhase.value = phase(r, amb, 5);
    outMat.uniforms.uDraw.value = ramp(r, 0.8, 1);
  });

  return (
    <RevealRoot rt={rt} index={index}>
      <Plinth width={3.2} depth={2.6} />

      <group position={[TX, 0, 0]}>
        {/* дотор ёроол */}
        <mesh position={[0, BASE - 0.005, 0]}>
          <cylinderGeometry args={[R, R + 0.06, 0.05, 64]} />
          <meshStandardMaterial color="#0d2a44" roughness={0.7} />
        </mesh>

        {/* ус: өндөр нь scale.y-аар (нэгж цилиндр) */}
        <mesh ref={water} position={[0, BASE, 0]}>
          <cylinderGeometry args={[WATER_R, WATER_R, 1, 64]} />
          <meshStandardMaterial color="#1c86c6" emissive="#0b4f80" emissiveIntensity={0.55} roughness={0.3} />
        </mesh>
        <mesh ref={top} rotation-x={-Math.PI / 2} material={surface}>
          <circleGeometry args={[WATER_R, 64]} />
        </mesh>

        {/* түвшний гэрэлт цагираг */}
        <group ref={marker}>
          <mesh rotation-x={Math.PI / 2}>
            <torusGeometry args={[R + 0.012, 0.01, 8, 96]} />
            <meshBasicMaterial color={C.aqua} />
          </mesh>
        </group>

        {/* тунгалаг хана, хүрээ, дээд/доод обруч */}
        <group ref={tank}>
          <mesh position={[0, TANK_H / 2, 0]} renderOrder={2}>
            <cylinderGeometry args={[R, R, TANK_H, 64, 1, true]} />
            <meshStandardMaterial
              color={C.aqua}
              transparent
              opacity={0.1}
              roughness={0.15}
              side={THREE.DoubleSide}
              depthWrite={false}
            />
          </mesh>
          <lineSegments geometry={ribs}>
            <lineBasicMaterial color={C.aqua} transparent opacity={0.28} />
          </lineSegments>
          {[0, TANK_H].map((y) => (
            <mesh key={y} position={[0, y, 0]} rotation-x={Math.PI / 2}>
              <torusGeometry args={[R + 0.01, 0.022, 10, 96]} />
              <meshStandardMaterial color={C.metal} roughness={0.35} metalness={0.4} />
            </mesh>
          ))}
        </group>
      </group>

      {/* түвшний хэмжүүр */}
      <group ref={gauge} position={[GAUGE_X, 0, GAUGE_Z]}>
        <mesh position={[0, BASE + TANK_H / 2, 0]}>
          <boxGeometry args={[0.03, TANK_H, 0.03]} />
          <meshStandardMaterial color={C.line} roughness={0.6} />
        </mesh>
        <instancedMesh ref={ticks} args={[undefined, undefined, TICKS]} frustumCulled={false}>
          <boxGeometry args={[0.07, 0.012, 0.012]} />
          <meshBasicMaterial color={C.mist} />
        </instancedMesh>
        <mesh ref={pointer} position={[-0.07, BASE, 0]}>
          <boxGeometry args={[0.12, 0.028, 0.045]} />
          <meshBasicMaterial color={C.aqua} />
        </mesh>
      </group>

      <mesh geometry={inGeo} material={inMat} />
      <mesh geometry={outGeo} material={outMat} />
    </RevealRoot>
  );
}

export default memo(ReservoirScene);
