"use client";

import { memo, useLayoutEffect, useRef } from "react";
import * as THREE from "three";
import { C } from "../../journey/materials/palette";
import { createBuildingMaterial } from "../../journey/materials/building";
import { createFlowMaterial, densityFor } from "../../journey/materials/flow";
import { easeOutBack, ramp, seg } from "../../journey/utils/ease";
import { pipePath } from "../../journey/utils/geometry";
import { useDisposable } from "../../journey/utils/useDisposable";
import { phase, RevealRoot, Strata, useStageFrame, type SceneProps } from "../../journey/scenes/common";
import { HOMES, HOMES_SEWER_Z } from "../layout";

/*
 * 01 — Бохир ус үүсэх: орон сууцууд (цонх асна), фасадны босоо шугамаар бохир ус доош урсаж, газрын огтлол дахь
 * гудамжны татуурга руу орно. Татуурга урд огтлолын нүүрэн дээр — газар доор харагдана; баруун тийш (дараагийн шат руу) урсана.
 */

const { w: W, d: D, layers: LAYERS, sewerY: SEWER_Y, buildings: BLDS } = HOMES;
const SEWER_Z = HOMES_SEWER_Z;
const TREES = [
  { x: -1.95, z: 0.55, s: 1 },
  { x: -0.62, z: 0.62, s: 0.85 },
  { x: 0.7, z: 0.58, s: 0.95 },
  { x: 1.85, z: 0.5, s: 0.8 },
];

// барилга бүрийн гаргалгаа: фасадны дээрээс доош → гадаргуугаар урагш → огтлолоор доош гудамжны шугам руу
const stacks = BLDS.map((b) => {
  const x = b.x + b.w * 0.32;
  const z = b.z + b.d / 2 + 0.03;
  return pipePath([
    [x, b.h - 0.06, z],
    [x, 0.025, z],
    [x, 0.025, SEWER_Z],
    [x, SEWER_Y, SEWER_Z],
  ]);
});
const sewer = pipePath([
  [-W / 2 + 0.02, SEWER_Y, SEWER_Z],
  [W / 2 + 0.05, SEWER_Y, SEWER_Z],
]);
const sewageFlow = (path: THREE.Curve<THREE.Vector3>, per: number, speed = 0.8) =>
  createFlowMaterial({ color: C.sewage, glow: C.sewageGlow, density: densityFor(path.getLength(), per), speed });

function HomesScene({ rt, index }: SceneProps) {
  const bldMat = useDisposable(createBuildingMaterial, []);
  const bldGeo = useDisposable(() => {
    const g = new THREE.BoxGeometry(1, 1, 1);
    g.translate(0, 0.5, 0);
    g.setAttribute("aDelay", new THREE.InstancedBufferAttribute(Float32Array.from(BLDS, (b) => b.delay), 1));
    g.setAttribute("aSeed", new THREE.InstancedBufferAttribute(Float32Array.from(BLDS, (_, i) => 0.17 + i * 0.29), 1));
    g.setAttribute("aFloors", new THREE.InstancedBufferAttribute(Float32Array.from(BLDS, (b) => b.floors), 1));
    return g;
  }, []);
  const stackGeos = useDisposable(() => {
    const list = stacks.map((s) => new THREE.TubeGeometry(s, 64, 0.022, 8, false));
    return { list, dispose: () => list.forEach((g) => g.dispose()) };
  }, []);
  const stackMats = useDisposable(() => {
    const list = stacks.map((s) => sewageFlow(s, 6));
    return { list, dispose: () => list.forEach((m) => m.dispose()) };
  }, []);
  const sewerGeo = useDisposable(() => new THREE.TubeGeometry(sewer, 64, 0.055, 12, false), []);
  const sewerMat = useDisposable(() => sewageFlow(sewer, 3, 0.7), []);

  const buildings = useRef<THREE.InstancedMesh>(null);
  const trees = useRef<(THREE.Group | null)[]>([]);

  useLayoutEffect(() => {
    const d = new THREE.Object3D();
    BLDS.forEach((b, i) => {
      d.position.set(b.x, 0, b.z);
      d.scale.set(b.w, b.h, b.d);
      d.updateMatrix();
      buildings.current!.setMatrixAt(i, d.matrix);
    });
    buildings.current!.instanceMatrix.needsUpdate = true;
  }, []);

  // p: газар (0–0.4) → барилга босох (0.15–0.55) → цонх асах (0.3–0.7) → гаргалгаагаар бохир ус (0.42–0.82)
  //    → гудамжны татуурга (0.66–1)
  useStageFrame(rt, index, (p, amb) => {
    bldMat.uniforms.uGrow.value = ramp(p, 0.15, 0.55);
    bldMat.uniforms.uLit.value = seg(p, 0.3, 0.7) * 1.15;
    stackMats.list.forEach((m, i) => {
      m.uniforms.uPhase.value = phase(p, amb, 5);
      m.uniforms.uDraw.value = ramp(p, 0.42 + i * 0.05, 0.72 + i * 0.05);
    });
    sewerMat.uniforms.uPhase.value = phase(p, amb, 4);
    sewerMat.uniforms.uDraw.value = ramp(p, 0.66, 1);
    trees.current.forEach((t, i) => t?.scale.setScalar(Math.max(easeOutBack(seg(p, 0.3 + i * 0.05, 0.55 + i * 0.05)) * TREES[i].s, 0.001)));
  });

  return (
    <RevealRoot rt={rt} index={index}>
      <Strata
        width={W}
        depth={D}
        layers={[
          { h: LAYERS[0], color: C.ground },
          { h: LAYERS[1], color: C.soilA },
          { h: LAYERS[2], color: C.clay },
          { h: LAYERS[3], color: C.bedrock },
        ]}
      />
      {/* гудамж */}
      <mesh position={[0, 0.004, 0.6]}>
        <boxGeometry args={[W - 0.02, 0.008, 0.34]} />
        <meshStandardMaterial color="#0e2c46" roughness={0.9} />
      </mesh>

      <instancedMesh ref={buildings} args={[bldGeo, bldMat, BLDS.length]} frustumCulled={false} />

      {TREES.map((t, i) => (
        <group
          key={i}
          position={[t.x, 0, t.z - 0.32]}
          ref={(el) => {
            trees.current[i] = el;
          }}
        >
          <mesh position={[0, 0.05, 0]}>
            <cylinderGeometry args={[0.015, 0.02, 0.1, 6]} />
            <meshStandardMaterial color="#3a3226" roughness={0.9} />
          </mesh>
          <mesh position={[0, 0.2, 0]}>
            <coneGeometry args={[0.1, 0.26, 8]} />
            <meshStandardMaterial color={C.tree} roughness={0.85} flatShading />
          </mesh>
        </group>
      ))}

      {/* гаргалгаа, гудамжны татуурга (бохир ус) */}
      {stackGeos.list.map((g, i) => (
        <mesh key={i} geometry={g} material={stackMats.list[i]} />
      ))}
      <mesh geometry={sewerGeo} material={sewerMat} />
    </RevealRoot>
  );
}

export default memo(HomesScene);
