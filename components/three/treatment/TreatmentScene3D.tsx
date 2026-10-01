"use client";

import { memo, useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { createBackdropMaterial } from "../journey/materials/fx";
import { TIERS, type QualityTier } from "../journey/quality";
import { useDisposable } from "../journey/utils/useDisposable";
import type { TreatmentRuntime } from "./runtime";
import { armAngle, BUILDING, createTreatmentState, LAMPS, OUTLET, PLINTH, TANKS, treatmentState } from "./layout";
import { bodyGeometry, emissiveGeometry, glowGeometry, plinthGeometry, waterGeometry } from "./geometry";
import {
  bodyMaterial,
  createTreatmentUniforms,
  emissiveMaterial,
  glowMaterial,
  groundMaterial,
  plinthShadowMaterial,
  waterMaterial,
} from "./materials";

/** Тогтмол дээрээс-ташуу камер (SVG-ийн дээрээс харсан зурагтай ойр), бага зэрэг баруун урдаас */
const CAMERA = { azimuth: 9, elevation: 42, fov: 26 };
/**
 * Багтаах NDC хүрээ. Canvas картаас 16% өндөр (svc-par parallax ±8%) → босоо тэнхлэгт ±0.74-өөс гадна
 * scroll-оор хаагдаж болно. Доод талд илүү зай: картын зүүн доод буланд шошго (pill) байрладаг.
 */
const SAFE = { x: 0.93, bottom: -0.62, top: 0.73 };

const FIT_POINTS: THREE.Vector3[] = (() => {
  const pts: [number, number, number][] = [];
  for (const x of [PLINTH.x0, PLINTH.x1]) for (const y of [PLINTH.y0, 0]) for (const z of [PLINTH.z0, PLINTH.z1]) pts.push([x, y, z]);
  for (const t of TANKS) {
    const ro = t.r + t.wall;
    for (const [dx, dz] of [
      [-ro, 0],
      [ro, 0],
      [0, -ro],
      [0, ro],
    ])
      pts.push([t.x + dx, t.top + 0.13, t.z + dz]);
    pts.push([t.x, t.top + 0.24, t.z]);
  }
  const { x, z, w, d, h } = BUILDING;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) pts.push([x + (sx * w) / 2, h + 0.1, z + (sz * d) / 2]);
  for (const l of LAMPS) pts.push([l.x, 0.5, l.z]);
  pts.push([OUTLET.xEnd, OUTLET.y + OUTLET.r, OUTLET.zRun]);
  return pts.map((p) => new THREE.Vector3(...p));
})();

function fitCamera(cam: THREE.PerspectiveCamera, aspect: number) {
  const a = THREE.MathUtils.degToRad(CAMERA.azimuth);
  const e = THREE.MathUtils.degToRad(CAMERA.elevation);
  const back = new THREE.Vector3(Math.sin(a) * Math.cos(e), Math.sin(e), Math.cos(a) * Math.cos(e));
  const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), back).normalize();
  const up = new THREE.Vector3().crossVectors(back, right);
  const tanV = Math.tan(THREE.MathUtils.degToRad(CAMERA.fov) / 2);
  const tanH = tanV * aspect;
  const halfY = (SAFE.top - SAFE.bottom) / 2;
  const midY = (SAFE.top + SAFE.bottom) / 2;
  const center = new THREE.Box3().setFromPoints(FIT_POINTS).getCenter(new THREE.Vector3());
  const v = new THREE.Vector3();
  let d = 0;
  // зай → проекцийн хүрээ → төвийг зорилтот хүрээнд тэнцвэржүүлэх (перспектив тул хэд давтана)
  for (let iter = 0; iter < 6; iter++) {
    d = 0;
    for (const p of FIT_POINTS) {
      v.subVectors(p, center);
      const depth = v.dot(back);
      d = Math.max(d, depth + Math.abs(v.dot(right)) / (tanH * SAFE.x), depth + Math.abs(v.dot(up)) / (tanV * halfY));
    }
    let x0 = Infinity;
    let x1 = -Infinity;
    let y0 = Infinity;
    let y1 = -Infinity;
    for (const p of FIT_POINTS) {
      v.subVectors(p, center);
      const z = d - v.dot(back);
      const sx = v.dot(right) / z / tanH;
      const sy = v.dot(up) / z / tanV;
      x0 = Math.min(x0, sx);
      x1 = Math.max(x1, sx);
      y0 = Math.min(y0, sy);
      y1 = Math.max(y1, sy);
    }
    center.addScaledVector(right, ((x0 + x1) / 2) * tanH * d).addScaledVector(up, ((y0 + y1) / 2 - midY) * tanV * d);
  }
  cam.fov = CAMERA.fov;
  cam.aspect = aspect;
  cam.near = Math.max(0.5, d - 8);
  cam.far = d + 10;
  cam.updateProjectionMatrix();
  cam.position.copy(center).addScaledVector(back, d);
  cam.lookAt(center);
}

type Props = {
  rt: TreatmentRuntime;
  /** Canvas үүсэх үеийн түвшин (DPR, MSAA, glow). Солигдвол хост key-ээр дахин үүсгэнэ. */
  tier: QualityTier;
  /** false — кадр зурахгүй (дэлгэцээс хол) */
  running: boolean;
  /** true — ambient-ийн тасралтгүй loop (зохицуулагчийн зөвшөөрөлтэй үед л) */
  continuous: boolean;
  onReady: () => void;
  onFail: () => void;
};

function TreatmentScene3D({ rt, tier: tierName, running, continuous, onReady, onFail }: Props) {
  const tier = TIERS[tierName];
  const cbs = useRef({ onReady, onFail });
  useEffect(() => {
    cbs.current = { onReady, onFail };
  });
  return (
    <Canvas
      dpr={[1, tier.dpr]}
      frameloop={!running ? "never" : continuous ? "always" : "demand"}
      // Картын zoom/hover (CSS scale) хэмжээнд орохгүй: layout хэмжээ (offsetWidth/Height), scroll бүрт дахин хэмжихгүй
      resize={{ offsetSize: true, scroll: false }}
      gl={{ antialias: tier.antialias, alpha: false, powerPreference: "high-performance" }}
      camera={{ fov: CAMERA.fov, near: 1, far: 60, position: [0, 8, 8] }}
      onCreated={({ gl }) => {
        gl.domElement.addEventListener("webglcontextlost", (e) => {
          e.preventDefault();
          cbs.current.onFail();
        });
      }}
      style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
    >
      <Stage rt={rt} tier={tierName} running={running} onReady={() => cbs.current.onReady()} />
    </Canvas>
  );
}

export default memo(TreatmentScene3D);

function Stage({ rt, tier, running, onReady }: { rt: TreatmentRuntime; tier: QualityTier; running: boolean; onReady: () => void }) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const invalidate = useThree((s) => s.invalidate);
  const fx = TIERS[tier].fx;

  const U = useMemo(createTreatmentUniforms, []);
  const state = useMemo(createTreatmentState, []);
  const backdrop = useDisposable(createBackdropMaterial, []);
  const shadow = useDisposable(plinthShadowMaterial, []);
  const ground = useDisposable(() => groundMaterial(U), [U]);
  const bodyMat = useDisposable(() => bodyMaterial(U), [U]);
  const emissive = useDisposable(() => emissiveMaterial(U), [U]);
  const water = useDisposable(() => waterMaterial(U), [U]);
  const glow = useDisposable(() => glowMaterial(U), [U]);
  const plinthGeo = useDisposable(plinthGeometry, []);
  const bodyGeo = useDisposable(bodyGeometry, []);
  const emissiveGeo = useDisposable(emissiveGeometry, []);
  const waterGeo = useDisposable(waterGeometry, []);
  const glowGeo = useDisposable(() => glowGeometry(CAMERA.azimuth, CAMERA.elevation), []);

  const fit = useRef({ aspect: 0 });
  const frames = useRef(0);

  // driver → кадр; shader урьдчилан compile
  useEffect(() => {
    rt.invalidate = () => invalidate();
    gl.compile(scene, camera);
    invalidate(3);
    return () => {
      rt.invalidate = () => {};
    };
  }, [rt, gl, scene, camera, invalidate]);
  useEffect(() => {
    if (running) invalidate(2);
  }, [running, invalidate]);

  useFrame((st, delta) => {
    const aspect = st.size.width / Math.max(st.size.height, 1);
    if (Math.abs(fit.current.aspect - aspect) > 1e-3) {
      fit.current.aspect = aspect;
      fitCamera(camera, aspect);
    }

    const settings = TIERS[rt.tier];
    const amb = settings.ambient && !rt.reduced;
    if (amb) rt.ambientTime += Math.min(delta, 1 / 20);
    const t = amb ? rt.ambientTime : 0;
    const p = rt.reduced ? 1 : rt.progress;

    // --- үндсэн төлөв: зөвхөн progress
    treatmentState(p, state);
    U.uDim.value = state.dim;
    for (let i = 0; i < state.grow.length; i++) U.uGrow.value[i] = state.grow[i];
    for (let i = 0; i < state.lit.length; i++) U.uLit.value[i] = state.lit[i];
    U.uLevel.value[0] = state.level[0];
    U.uLevel.value[1] = state.level[1];
    U.uFill.value[0] = state.fill[0];
    U.uFill.value[1] = state.fill[1];
    U.uActiveL.value = state.activeL;
    U.uClean.value = state.clean;
    U.uChannel.value = state.channel;
    U.uOutlet.value = state.outlet;
    U.uCascade.value = state.cascade;
    U.uActive.value = state.active;
    // --- чимэглэл: гүүрний удаан эргэлт, урсгалын фаз (scroll + ambient), гялбаа, гэрлийн амьсгал
    U.uSpin.value[0] = armAngle(0, p, t);
    U.uSpin.value[1] = armAngle(1, p, t);
    U.uPhase.value = p * 5 + t * 0.8;
    U.uShimmer.value = t;
    U.uBreath.value = amb ? Math.sin(t * 1.3) : 0;
    U.uDetail.value = settings.waterDetail;

    frames.current++;
    if (frames.current === 2) onReady();
  });

  return (
    <>
      <mesh frustumCulled={false} renderOrder={-1000} material={backdrop}>
        <planeGeometry args={[2, 2]} />
      </mesh>
      <mesh position={[(PLINTH.x0 + PLINTH.x1) / 2, PLINTH.y0 - 0.004, (PLINTH.z0 + PLINTH.z1) / 2]} rotation-x={-Math.PI / 2} material={shadow}>
        <planeGeometry args={[PLINTH.x1 - PLINTH.x0 + 1.4, PLINTH.z1 - PLINTH.z0 + 1.4]} />
      </mesh>
      <mesh geometry={plinthGeo} material={ground} />
      <mesh geometry={bodyGeo} material={bodyMat} frustumCulled={false} />
      <mesh geometry={waterGeo} material={water} frustumCulled={false} />
      <mesh geometry={emissiveGeo} material={emissive} frustumCulled={false} />
      {fx && <mesh geometry={glowGeo} material={glow} frustumCulled={false} renderOrder={5} />}
    </>
  );
}
