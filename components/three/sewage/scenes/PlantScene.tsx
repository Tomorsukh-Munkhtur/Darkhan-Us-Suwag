"use client";

import { memo, useMemo, useRef } from "react";
import * as THREE from "three";
import { seeded } from "@/lib/seeded";
import { C } from "../../journey/materials/palette";
import { createFlowMaterial, densityFor } from "../../journey/materials/flow";
import { createGlowMaterial } from "../../journey/materials/fx";
import { clamp01, easeOutBack, ramp, seg } from "../../journey/utils/ease";
import { pipePath } from "../../journey/utils/geometry";
import { useDisposable } from "../../journey/utils/useDisposable";
import { particleCount, phase, Plinth, RevealRoot, useStageFrame, type SceneProps } from "../../journey/scenes/common";
import { PLANT } from "../layout";

/*
 * 04 — Төв цэвэрлэх байгууламж: урсгалын дагуу 7 үе шат — 1 сараалж, 2 элс баригч, 3 анхдагч тунгаагуур (дугуй, эргэх гүүр),
 * 4 агааржуулах сав (бөмбөлөг), 5 хоёрдогч тунгаагуур, 6 гурван шүүлтүүр, 7 халдваргүйжүүлэх (гэрэлт хоолой).
 * Ус үе шат бүрт хүрэх дарааллаар (scroll) байгууламжийн ус хүрэнээс цэнхэр болж, холбох шугам урсана.
 */

const N = PLANT.length;
const X = PLANT.map((u) => u.x);
const DIRTY = new THREE.Color(C.sewage);
const CLEAN = new THREE.Color("#2aa7e6");
const EMPTY = new THREE.Color("#0d2a44");
/** i-р үе шатын (0–6) усны өнгө: бохир → цэвэр */
const unitColor = (i: number) => DIRTY.clone().lerp(CLEAN, clamp01(i / (N - 1)));
const COLORS = PLANT.map((_, i) => unitColor(i));
/** i-р үе шатад ус хүрэх мөч (progress) */
const ARRIVE = PLANT.map((_, i) => 0.34 + i * 0.085);

// байгууламжийн хэмжээ (x дагуух хагас өргөн) — холбох шугам ирмэгээс ирмэг хүртэл
const HALF = [0.18, 0.18, 0.34, 0.35, 0.34, 0.11, 0.17];
const R = 0.34;
const FILTER_Z = [-0.38, 0, 0.38];
const PIPE_Y = 0.09;
const BUBBLES = 22;

const links = PLANT.slice(0, -1).map((_, i) =>
  pipePath([
    [X[i] + HALF[i] - 0.01, PIPE_Y, 0],
    [X[i + 1] - HALF[i + 1] + 0.01, PIPE_Y, 0],
  ]),
);
const outlet = pipePath([
  [X[N - 1] + HALF[N - 1], PIPE_Y, 0],
  [2.4, PIPE_Y, 0],
]);

/** Нээлттэй тэгш өнцөгт сав: бетон хана + усны гадаргуу (дээд талаас бага зэрэг доор) */
function Basin({ w, d, h, water }: { w: number; d: number; h: number; water: THREE.Material }) {
  return (
    <>
      <mesh position={[0, h / 2, 0]}>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color={C.concrete} roughness={0.8} />
      </mesh>
      <mesh position={[0, h + 0.001, 0]} rotation-x={-Math.PI / 2} material={water}>
        <planeGeometry args={[w - 0.05, d - 0.05]} />
      </mesh>
    </>
  );
}

/** Дугуй тунгаагуур: бетон цилиндр, усны гадаргуу, голын багана, эргэх гүүр (хусагч) */
function Clarifier({ water, bridge }: { water: THREE.Material; bridge: (el: THREE.Group | null) => void }) {
  const h = 0.15;
  return (
    <>
      <mesh position={[0, h / 2, 0]}>
        <cylinderGeometry args={[R, R + 0.02, h, 40]} />
        <meshStandardMaterial color={C.concrete} roughness={0.8} />
      </mesh>
      <mesh position={[0, h + 0.001, 0]} rotation-x={-Math.PI / 2} material={water}>
        <circleGeometry args={[R - 0.025, 40]} />
      </mesh>
      <mesh position={[0, h + 0.03, 0]}>
        <cylinderGeometry args={[0.035, 0.04, 0.06, 14]} />
        <meshStandardMaterial color={C.metalDark} roughness={0.5} metalness={0.3} />
      </mesh>
      <group ref={bridge} position={[0, h + 0.045, 0]}>
        <mesh position={[R / 2, 0, 0]}>
          <boxGeometry args={[R, 0.018, 0.05]} />
          <meshStandardMaterial color={C.metal} roughness={0.4} metalness={0.5} />
        </mesh>
      </group>
    </>
  );
}

function PlantScene({ rt, index }: SceneProps) {
  const bubbles = useMemo(() => {
    const rand = seeded(47);
    return Array.from({ length: BUBBLES }, () => ({ x: (rand() - 0.5) * 0.6, z: (rand() - 0.5) * 0.5, ph: rand(), s: 0.012 + rand() * 0.01 }));
  }, []);
  const waters = useDisposable(() => {
    const list = PLANT.map(() => new THREE.MeshStandardMaterial({ color: EMPTY, roughness: 0.25, emissive: EMPTY, emissiveIntensity: 0.15 }));
    return { list, dispose: () => list.forEach((m) => m.dispose()) };
  }, []);
  const linkGeos = useDisposable(() => {
    const list = links.map((l) => new THREE.TubeGeometry(l, 8, 0.03, 10, false));
    return { list, dispose: () => list.forEach((g) => g.dispose()) };
  }, []);
  const linkMats = useDisposable(() => {
    const list = links.map((l, i) =>
      createFlowMaterial({
        color: `#${COLORS[i].clone().lerp(COLORS[i + 1], 0.5).getHexString()}`,
        glow: i < 3 ? C.sewageGlow : C.foam,
        density: densityFor(l.getLength(), 14),
        speed: 0.8,
      }),
    );
    return { list, dispose: () => list.forEach((m) => m.dispose()) };
  }, []);
  const outletGeo = useDisposable(() => new THREE.TubeGeometry(outlet, 12, 0.035, 10, false), []);
  const outletMat = useDisposable(
    () => createFlowMaterial({ color: "#1b8fd0", glow: C.foam, density: densityFor(outlet.getLength(), 8), speed: 0.8 }),
    [],
  );
  const uvGlow = useDisposable(() => createGlowMaterial("#bff0ff", 0), []);
  const filterBand = useDisposable(() => new THREE.MeshStandardMaterial({ color: C.aqua, emissive: C.water, emissiveIntensity: 0 }), []);

  const units = useRef<(THREE.Group | null)[]>([]);
  const bridges = useRef<(THREE.Group | null)[]>([]);
  const bubbleMesh = useRef<THREE.InstancedMesh>(null);
  const uvMesh = useRef<THREE.Mesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  // p: байгууламжууд дараалан босно (0.15–0.6) → ус 1…7-р үе шатад дараалан хүрнэ (ARRIVE, 0.34–0.94):
  //    холбох шугам урсаж, байгууламжийн ус өнгөө авна → гарах шугам (0.9–1)
  useStageFrame(rt, index, (p, amb, tier) => {
    for (let i = 0; i < N; i++) {
      units.current[i]?.scale.setScalar(Math.max(easeOutBack(seg(p, 0.15 + i * 0.05, 0.38 + i * 0.05)), 0.001));
      const a = seg(p, ARRIVE[i], ARRIVE[i] + 0.07);
      const m = waters.list[i];
      m.color.copy(EMPTY).lerp(COLORS[i], a);
      m.emissive.copy(EMPTY).lerp(COLORS[i], a);
      if (i < N - 1) {
        const l = linkMats.list[i];
        l.uniforms.uPhase.value = phase(p, amb, 6);
        l.uniforms.uDraw.value = ramp(p, ARRIVE[i] + 0.04, ARRIVE[i + 1]);
      }
    }
    outletMat.uniforms.uPhase.value = phase(p, amb, 6);
    outletMat.uniforms.uDraw.value = ramp(p, 0.9, 1);
    // тунгаагуурын гүүр аажим эргэнэ
    const turn = phase(p, amb, 2.2, 0.25);
    bridges.current.forEach((b, i) => b && (b.rotation.y = turn + i * 1.7));
    filterBand.emissiveIntensity = 1.2 * seg(p, ARRIVE[5], ARRIVE[5] + 0.07);
    uvGlow.uniforms.uOpacity.value = 0.6 * seg(p, ARRIVE[6], ARRIVE[6] + 0.07);
    uvMesh.current!.visible = tier.fx;

    // агааржуулалт: гадаргуу дээр бөмбөлөг буцалж хагарна
    const bm = bubbleMesh.current!;
    bm.count = particleCount(BUBBLES, tier);
    const on = seg(p, ARRIVE[3], ARRIVE[3] + 0.07);
    for (let i = 0; i < bm.count; i++) {
      const b = bubbles[i];
      const k = (phase(p, amb, 3, 0.6) + b.ph) % 1;
      dummy.position.set(X[3] + b.x, 0.225 + k * 0.03, b.z);
      dummy.scale.setScalar(Math.max(b.s * on * Math.sin(Math.PI * k), 0.0001));
      dummy.updateMatrix();
      bm.setMatrixAt(i, dummy.matrix);
    }
    bm.instanceMatrix.needsUpdate = true;
  });

  const unit = (i: number) => (el: THREE.Group | null) => {
    units.current[i] = el;
  };

  return (
    <RevealRoot rt={rt} index={index}>
      <Plinth width={4.85} depth={2.0} />

      {/* 1 сараалж: ил суваг, торгууд */}
      <group ref={unit(0)} position={[X[0], 0, 0]}>
        <Basin w={HALF[0] * 2} d={0.26} h={0.12} water={waters.list[0]} />
        {[-0.08, -0.04, 0, 0.04, 0.08].map((z) => (
          <mesh key={z} position={[0, 0.17, z]} rotation-z={0.3}>
            <boxGeometry args={[0.01, 0.14, 0.008]} />
            <meshStandardMaterial color={C.metal} roughness={0.4} metalness={0.5} />
          </mesh>
        ))}
      </group>

      {/* 2 элс баригч */}
      <group ref={unit(1)} position={[X[1], 0, 0]}>
        <Basin w={HALF[1] * 2} d={0.5} h={0.16} water={waters.list[1]} />
      </group>

      {/* 3 анхдагч тунгаагуур */}
      <group ref={unit(2)} position={[X[2], 0, 0]}>
        <Clarifier
          water={waters.list[2]}
          bridge={(el) => {
            bridges.current[0] = el;
          }}
        />
      </group>

      {/* 4 агааржуулах сав */}
      <group ref={unit(3)} position={[X[3], 0, 0]}>
        <Basin w={HALF[3] * 2} d={0.62} h={0.2} water={waters.list[3]} />
        {[-0.2, 0.2].map((z) => (
          <mesh key={z} position={[0, 0.215, z]} rotation-z={Math.PI / 2}>
            <cylinderGeometry args={[0.012, 0.012, HALF[3] * 2 - 0.08, 8]} />
            <meshStandardMaterial color={C.metal} roughness={0.4} metalness={0.5} />
          </mesh>
        ))}
      </group>
      <instancedMesh ref={bubbleMesh} args={[undefined, undefined, BUBBLES]} frustumCulled={false}>
        <sphereGeometry args={[1, 8, 6]} />
        <meshBasicMaterial color={C.foam} />
      </instancedMesh>

      {/* 5 хоёрдогч тунгаагуур */}
      <group ref={unit(4)} position={[X[4], 0, 0]}>
        <Clarifier
          water={waters.list[4]}
          bridge={(el) => {
            bridges.current[1] = el;
          }}
        />
      </group>

      {/* 6 гурван шүүлтүүр + цуглуулах толгой шугам */}
      <group ref={unit(5)} position={[X[5], 0, 0]}>
        <mesh position={[0, PIPE_Y, 0]} rotation-x={Math.PI / 2}>
          <cylinderGeometry args={[0.028, 0.028, FILTER_Z[2] * 2, 10]} />
          <meshStandardMaterial color={C.metalDark} roughness={0.5} metalness={0.3} />
        </mesh>
        {FILTER_Z.map((z) => (
          <group key={z} position={[0, 0, z]}>
            <mesh position={[0, 0.17, 0]}>
              <cylinderGeometry args={[0.1, 0.1, 0.34, 22]} />
              <meshStandardMaterial color="#c9d9e5" roughness={0.45} metalness={0.2} />
            </mesh>
            <mesh position={[0, 0.34, 0]}>
              <sphereGeometry args={[0.1, 22, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
              <meshStandardMaterial color="#c9d9e5" roughness={0.45} metalness={0.2} />
            </mesh>
            <mesh position={[0, 0.2, 0]} material={filterBand}>
              <cylinderGeometry args={[0.102, 0.102, 0.03, 22]} />
            </mesh>
            <mesh position={[0, 0.06, 0]} material={waters.list[5]}>
              <cylinderGeometry args={[0.103, 0.103, 0.05, 22]} />
            </mesh>
          </group>
        ))}
      </group>

      {/* 7 халдваргүйжүүлэх: суваг, гэрэлт хоолойнууд */}
      <group ref={unit(6)} position={[X[6], 0, 0]}>
        <Basin w={HALF[6] * 2} d={0.26} h={0.12} water={waters.list[6]} />
        {[-0.08, 0, 0.08].map((x) => (
          <mesh key={x} position={[x, 0.15, 0]} rotation-x={Math.PI / 2}>
            <cylinderGeometry args={[0.012, 0.012, 0.3, 8]} />
            <meshBasicMaterial color={C.foam} />
          </mesh>
        ))}
        <mesh ref={uvMesh} position={[0, 0.16, 0.16]} material={uvGlow}>
          <planeGeometry args={[0.6, 0.45]} />
        </mesh>
      </group>

      {/* холбох шугам (өнгө нь үе шатаар бохир → цэвэр), гарах шугам */}
      {linkGeos.list.map((g, i) => (
        <mesh key={i} geometry={g} material={linkMats.list[i]} />
      ))}
      <mesh geometry={outletGeo} material={outletMat} />
    </RevealRoot>
  );
}

export default memo(PlantScene);
