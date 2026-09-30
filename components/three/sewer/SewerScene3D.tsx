"use client";

import { memo, useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { createBackdropMaterial } from "../journey/materials/fx";
import { TIERS, type QualityTier } from "../journey/quality";
import { useDisposable } from "../journey/utils/useDisposable";
import type { SewerRuntime } from "./runtime";
import { COL, createSewerState, FACE_Z, HOUSE_Z, HOUSES, LAMPS, SLAB, STREET, sewerState, TREES } from "./layout";
import { bodyGeometry, emissiveGeometry, glowGeometry, interiorGeometry, slabGeometry, surfaceGeometry, waterGeometry } from "./geometry";
import {
  bodyMaterial,
  createSewerUniforms,
  earthMaterial,
  emissiveMaterial,
  glowMaterial,
  interiorMaterial,
  slabShadowMaterial,
  surfaceMaterial,
  waterMaterial,
} from "./materials";

/** Тогтмол огтлолын камер: бага зэрэг дээрээс, баруун урдаас (баруун талын давхарга, коллекторын төгсгөл харагдана) */
const CAMERA = { azimuth: 16, elevation: 17, fov: 24 };
/**
 * Canvas нь картаас 16% өндөр (svc-par parallax ±8%) → дээд/доод 13% нь scroll-оор хаагдаж болно.
 * Чухал бүх зүйл босоо тэнхлэгт ±0.7 (NDC), хэвтээд ±0.93 дотор (hover-ийн 1.05 томролт, дугуй булан).
 */
const SAFE_X = 0.93;
const SAFE_Y = 0.7;

/** Багтаах цэгүүд: блокийн булангууд, коллекторын цухуйсан хэсэг, байшин, мод, гэрлийн орой */
const FIT_POINTS: THREE.Vector3[] = (() => {
  const pts: [number, number, number][] = [];
  for (const x of [SLAB.x0, SLAB.x1]) for (const y of [SLAB.y0, STREET.vergeH]) for (const z of [SLAB.z0, FACE_Z]) pts.push([x, y, z]);
  pts.push([COL.x1, COL.y - COL.rOut, FACE_Z], [COL.x1, COL.y + COL.rOut, FACE_Z], [COL.x1, COL.y - COL.rOut, FACE_Z - COL.rOut]);
  for (const h of HOUSES) {
    const zc = HOUSE_Z - h.d / 2;
    const top = STREET.vergeH + h.h + h.roof;
    pts.push([h.x - h.w / 2 - 0.06, top, zc], [h.x + h.w / 2 + 0.06, top, zc]);
  }
  for (const t of TREES) pts.push([t.x, STREET.vergeH + (t.round ? 0.5 : 0.52) * t.s, t.z]);
  for (const l of LAMPS) pts.push([l.x, STREET.vergeH + 0.86, l.z + 0.2]);
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
  const box = new THREE.Box3().setFromPoints(FIT_POINTS);
  const center = box.getCenter(new THREE.Vector3());
  const v = new THREE.Vector3();
  let d = 0;
  // зай → проекцийн хүрээ → төвийг тэнцвэржүүлэх (перспектив тул хэд давтана)
  for (let iter = 0; iter < 5; iter++) {
    d = 0;
    for (const p of FIT_POINTS) {
      v.subVectors(p, center);
      const depth = v.dot(back);
      d = Math.max(d, depth + Math.abs(v.dot(right)) / (tanH * SAFE_X), depth + Math.abs(v.dot(up)) / (tanV * SAFE_Y));
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
    center.addScaledVector(right, ((x0 + x1) / 2) * tanH * d).addScaledVector(up, ((y0 + y1) / 2) * tanV * d);
  }
  cam.fov = CAMERA.fov;
  cam.aspect = aspect;
  cam.near = Math.max(0.5, d - 8);
  cam.far = d + 12;
  cam.updateProjectionMatrix();
  cam.position.copy(center).addScaledVector(back, d);
  cam.lookAt(center);
}

type Props = {
  rt: SewerRuntime;
  /** Canvas үүсэх үеийн түвшин (DPR, MSAA, glow). Солигдвол хост key-ээр дахин үүсгэнэ. */
  tier: QualityTier;
  /** false — кадр зурахгүй (дэлгэцээс хол) */
  running: boolean;
  /** true — ambient-ийн тасралтгүй loop (зохицуулагчийн зөвшөөрөлтэй үед л) */
  continuous: boolean;
  onReady: () => void;
  onFail: () => void;
};

function SewerScene3D({ rt, tier: tierName, running, continuous, onReady, onFail }: Props) {
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
      camera={{ fov: CAMERA.fov, near: 1, far: 60, position: [0, 3, 20] }}
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

export default memo(SewerScene3D);

function Stage({ rt, tier, running, onReady }: { rt: SewerRuntime; tier: QualityTier; running: boolean; onReady: () => void }) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const invalidate = useThree((s) => s.invalidate);
  const fx = TIERS[tier].fx;

  const U = useMemo(createSewerUniforms, []);
  const state = useMemo(createSewerState, []);
  const backdrop = useDisposable(createBackdropMaterial, []);
  const shadow = useDisposable(slabShadowMaterial, []);
  const earth = useDisposable(() => earthMaterial(U), [U]);
  const surface = useDisposable(() => surfaceMaterial(U), [U]);
  const bodyMat = useDisposable(() => bodyMaterial(U), [U]);
  const emissive = useDisposable(() => emissiveMaterial(U), [U]);
  const interior = useDisposable(() => interiorMaterial(U), [U]);
  const water = useDisposable(() => waterMaterial(U), [U]);
  const glow = useDisposable(() => glowMaterial(U), [U]);
  const slabGeo = useDisposable(slabGeometry, []);
  const surfaceGeo = useDisposable(surfaceGeometry, []);
  const bodyGeo = useDisposable(bodyGeometry, []);
  const emissiveGeo = useDisposable(emissiveGeometry, []);
  const interiorGeo = useDisposable(interiorGeometry, []);
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
    sewerState(p, state);
    U.uDim.value = state.dim;
    U.uSurface.value = state.surface;
    U.uMarks.value = state.marks;
    U.uActive.value = state.active;
    for (let i = 0; i < state.grow.length; i++) U.uGrow.value[i] = state.grow[i];
    for (let i = 0; i < state.lit.length; i++) U.uLit.value[i] = state.lit[i];
    for (let i = 0; i < state.reveal.length; i++) {
      U.uReveal.value[i] = state.reveal[i];
      U.uFlow.value[i] = state.flow[i];
    }
    // --- чимэглэл: урсгалын зурвас scroll-оор урагшилна (+ ambient-д тасралтгүй), гялбаа, гэрлийн амьсгал
    U.uPhase.value = p * 5 + t * 0.85;
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
      <mesh position={[(SLAB.x0 + SLAB.x1) / 2, SLAB.y0 - 0.004, (FACE_Z + SLAB.z0) / 2]} rotation-x={-Math.PI / 2} material={shadow}>
        <planeGeometry args={[SLAB.x1 - SLAB.x0 + 1.6, FACE_Z - SLAB.z0 + 1.6]} />
      </mesh>
      <mesh geometry={slabGeo} material={earth} />
      <mesh geometry={surfaceGeo} material={surface} />
      <mesh geometry={interiorGeo} material={interior} frustumCulled={false} />
      <mesh geometry={waterGeo} material={water} frustumCulled={false} />
      <mesh geometry={bodyGeo} material={bodyMat} frustumCulled={false} />
      <mesh geometry={emissiveGeo} material={emissive} frustumCulled={false} />
      {fx && <mesh geometry={glowGeo} material={glow} frustumCulled={false} renderOrder={5} />}
    </>
  );
}
