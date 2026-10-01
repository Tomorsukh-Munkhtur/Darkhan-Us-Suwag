"use client";

import { memo, useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { fitDistance } from "../journey/JourneyCamera";
import { createBackdropMaterial } from "../journey/materials/fx";
import { TIERS, type QualityTier } from "../journey/quality";
import type { FaucetRuntime } from "./runtime";
import { easeInOutCubic, seg } from "../journey/utils/ease";
import { useDisposable } from "../journey/utils/useDisposable";
import { faucetGeometry, glassGeometry, GLASS, innerRadius, NOZZLE_Y, streamGeometry, X_FAUCET, X_GLASS } from "./geometry";
import {
  aeratorMaterial,
  chromeMaterial,
  contactShadowMaterial,
  counterMaterial,
  createEnvironment,
  glassMaterial,
  glassRimMaterial,
  streamMaterial,
  waterBodyMaterial,
  waterSurfaceMaterial,
} from "./materials";

/** Цорго → шилэн аяга: хост (SupplyVisual3D) progress-ийг бичнэ, canvas кадр бүр уншина (runtime.ts). */
const ambientOn = (rt: FaucetRuntime) => rt.ambient && !rt.reduced && TIERS[rt.tier].ambient;

/** progress → аяганы дотоод өндрийн дүүргэлт (3% → 82%) */
const FILL_MIN = 0.03;
const FILL_MAX = 0.82;
export const levelFor = (p: number) => GLASS.base + (FILL_MIN + (FILL_MAX - FILL_MIN) * easeInOutCubic(p)) * (GLASS.h - GLASS.base);

const BUBBLES = 14;
const SPLASH = 7;
/** Камер: бага зэрэг дээрээс, зүүн тийш эргэсэн. bounds-д parallax-ын (±8%) нөөц орсон. */
const CAMERA = { azimuth: -7, elevation: 8, bounds: [-1.22, -0.28, -0.55, 1.15, 2.86, 0.55] as const };

type Props = {
  rt: FaucetRuntime;
  /** Canvas үүсэх үеийн түвшин (DPR, MSAA, transmission). Солигдвол хост key-ээр дахин үүсгэнэ. */
  tier: QualityTier;
  running: boolean;
  continuous: boolean;
  onReady: () => void;
  onFail: () => void;
};

function FaucetScene3D({ rt, tier: tierName, running, continuous, onReady, onFail }: Props) {
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
      camera={{ fov: 28, near: 0.1, far: 60, position: [0, 1.4, 9] }}
      onCreated={({ gl }) => {
        gl.toneMappingExposure = 1.05;
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

export default memo(FaucetScene3D);

function Stage({ rt, tier, running, onReady }: { rt: FaucetRuntime; tier: QualityTier; running: boolean; onReady: () => void }) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const invalidate = useThree((s) => s.invalidate);
  const transmission = tier !== "LOW";

  const backdrop = useDisposable(createBackdropMaterial, []);
  const faucetGeo = useDisposable(faucetGeometry, []);
  const chrome = useDisposable(chromeMaterial, []);
  const aerator = useDisposable(aeratorMaterial, []);
  const counter = useDisposable(counterMaterial, []);
  const glassGeo = useDisposable(() => glassGeometry(64), []);
  const glass = useDisposable(() => glassMaterial(transmission), [transmission]);
  const waterBody = useDisposable(waterBodyMaterial, []);
  const surface = useDisposable(waterSurfaceMaterial, []);
  const streamGeo = useDisposable(() => streamGeometry(0.046), []);
  const rim = useDisposable(glassRimMaterial, []);
  const stream = useDisposable(streamMaterial, []);
  const shadowGlass = useDisposable(() => contactShadowMaterial(0.6), []);
  const shadowFaucet = useDisposable(() => contactShadowMaterial(0.45), []);
  const bubbleMat = useDisposable(
    () => new THREE.MeshStandardMaterial({ color: "#e9fbff", emissive: "#5fd3f7", emissiveIntensity: 0.35, roughness: 0.08, metalness: 0 }),
    [],
  );

  // Bubble бүрийн тогтмол санамсаргүй утга (детерминистик)
  const bubbles = useMemo(() => {
    const out: { a: number; r: number; s: number; off: number; speed: number }[] = [];
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
    for (let i = 0; i < BUBBLES; i++) out.push({ a: rnd() * Math.PI * 2, r: 0.05 + rnd() * 0.24, s: 0.008 + rnd() * 0.012, off: rnd(), speed: 0.6 + rnd() * 0.6 });
    return out;
  }, []);

  const top = useRef<THREE.Mesh>(null);
  const bubbleMesh = useRef<THREE.InstancedMesh>(null);
  const splashMesh = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const fit = useRef({ aspect: 0 });
  const frames = useRef(0);

  // Орчны гэрэл (IBL) — нэг удаа
  useEffect(() => {
    const env = createEnvironment(gl);
    scene.environment = env.texture;
    invalidate();
    return () => {
      scene.environment = null;
      env.dispose();
    };
  }, [gl, scene, invalidate]);

  // Transmission-ийн render target-ийн нягтрал (MEDIUM-д хагас)
  useEffect(() => {
    gl.transmissionResolutionScale = tier === "HIGH" ? 1 : 0.6;
  }, [gl, tier]);

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

  useFrame((state, delta) => {
    const size = state.size;
    const aspect = size.width / Math.max(size.height, 1);
    if (Math.abs(fit.current.aspect - aspect) > 1e-3) {
      fit.current.aspect = aspect;
      const f = fitDistance(CAMERA, camera.fov, aspect);
      const a = THREE.MathUtils.degToRad(CAMERA.azimuth);
      const e = THREE.MathUtils.degToRad(CAMERA.elevation);
      camera.aspect = aspect;
      camera.updateProjectionMatrix();
      camera.position.set(
        f.center.x + f.distance * Math.sin(a) * Math.cos(e),
        f.center.y + f.distance * Math.sin(e),
        f.center.z + f.distance * Math.cos(a) * Math.cos(e),
      );
      camera.lookAt(f.center);
    }

    const amb = ambientOn(rt);
    if (amb) rt.ambientTime += Math.min(delta, 1 / 20);
    const t = amb ? rt.ambientTime : 0;
    const p = rt.reduced ? 1 : rt.progress;
    const settings = TIERS[rt.tier];

    // --- үндсэн төлөв: зөвхөн progress ---
    const level = levelFor(p);
    const rTop = innerRadius(level) - 0.004;
    waterBody.uniforms.uLevel.value = level;
    top.current!.position.y = level + 0.0005;
    top.current!.scale.set(rTop, rTop, 1);
    stream.uniforms.uLevel.value = level;

    // урсгал ба долгио: scroll-оор урагшилна + (ambient) тасралтгүй
    const phase = p * 6 + t * 1.6;
    stream.uniforms.uPhase.value = phase;
    stream.uniforms.uWobble.value = t;
    surface.uniforms.uPhase.value = phase;
    surface.uniforms.uShimmer.value = p * 2 + t;
    surface.uniforms.uDetail.value = settings.waterDetail;
    waterBody.uniforms.uPhase.value = phase;

    // бөмбөлөг: усан дотор доороос дээш (гүн хангалттай үед)
    const depth = level - GLASS.base;
    const bm = bubbleMesh.current!;
    bm.count = Math.max(2, Math.round(BUBBLES * settings.particles));
    for (let i = 0; i < bm.count; i++) {
      const b = bubbles[i];
      const k = (b.off + (p * 1.5 + t * 0.22) * b.speed) % 1;
      const y = GLASS.base + 0.02 + k * Math.max(depth - 0.05, 0);
      const rr = Math.min(b.r, innerRadius(y) - 0.06);
      dummy.position.set(X_GLASS + Math.cos(b.a) * rr + Math.sin(k * 9 + i) * 0.01, y, Math.sin(b.a) * rr);
      const s = depth > 0.08 ? b.s * Math.sin(Math.PI * Math.min(k * 1.15, 1)) : 0;
      dummy.scale.setScalar(Math.max(s, 0.0001));
      dummy.updateMatrix();
      bm.setMatrixAt(i, dummy.matrix);
    }
    bm.instanceMatrix.needsUpdate = true;

    // цацрал: урсгал усанд унах цэгээс жижиг дуслууд нуман замаар (фаз — progress + ambient)
    const sm = splashMesh.current!;
    sm.count = Math.max(3, Math.round(SPLASH * settings.particles));
    for (let i = 0; i < sm.count; i++) {
      const k = (i / sm.count + p * 2.2 + t * 0.9) % 1;
      const ang = (i / sm.count) * Math.PI * 2 + 0.6;
      const vx = Math.cos(ang) * 0.22;
      const vz = Math.sin(ang) * 0.22;
      dummy.position.set(X_GLASS + vx * k, level + 0.012 + 0.2 * k - 0.32 * k * k, vz * k);
      const s = 0.012 * (1 - k) * seg(depth, 0.02, 0.1);
      dummy.scale.setScalar(Math.max(s, 0.0001));
      dummy.updateMatrix();
      sm.setMatrixAt(i, dummy.matrix);
    }
    sm.instanceMatrix.needsUpdate = true;

    frames.current++;
    if (frames.current === 2) onReady();
  });

  return (
    <>
      <mesh frustumCulled={false} renderOrder={-1000} material={backdrop}>
        <planeGeometry args={[2, 2]} />
      </mesh>
      <hemisphereLight args={["#bfe6ff", "#061526", 0.55]} />
      <directionalLight position={[2.5, 4.5, 3.5]} intensity={1.4} color="#f2f9ff" />
      <directionalLight position={[-3.5, 2.2, -2.5]} intensity={0.9} color="#5fd3f7" />

      {/* тавцан */}
      <mesh position={[0, -0.07, 0]} material={counter}>
        <boxGeometry args={[4.6, 0.14, 2.2]} />
      </mesh>
      <mesh position={[X_GLASS, 0.002, 0]} rotation-x={-Math.PI / 2} material={shadowGlass}>
        <planeGeometry args={[1.5, 1.1]} />
      </mesh>
      <mesh position={[X_FAUCET, 0.002, 0]} rotation-x={-Math.PI / 2} material={shadowFaucet}>
        <planeGeometry args={[0.9, 0.7]} />
      </mesh>

      {/* цорго (нэг geometry) + хошуувчийн бараан тор */}
      <mesh geometry={faucetGeo} material={chrome} />
      <mesh position={[X_GLASS, NOZZLE_Y - 0.001, 0]} rotation-x={Math.PI / 2} material={aerator}>
        <circleGeometry args={[0.052, 24]} />
      </mesh>

      {/* ус: хажуу (vertex shader сунгана) + гадаргуу */}
      <mesh position={[X_GLASS, 0, 0]} material={waterBody} frustumCulled={false}>
        <cylinderGeometry args={[1, 1, 1, 64, 1, true]} />
      </mesh>
      <mesh ref={top} position={[X_GLASS, GLASS.base, 0]} rotation-x={-Math.PI / 2} material={surface}>
        <circleGeometry args={[1, 64]} />
      </mesh>
      <mesh geometry={streamGeo} position={[X_GLASS, 0, 0]} material={stream} />
      <instancedMesh ref={bubbleMesh} args={[undefined, bubbleMat, BUBBLES]} frustumCulled={false}>
        <icosahedronGeometry args={[1, 1]} />
      </instancedMesh>
      <instancedMesh ref={splashMesh} args={[undefined, bubbleMat, SPLASH]} frustumCulled={false}>
        <icosahedronGeometry args={[1, 1]} />
      </instancedMesh>

      {/* шилэн аяга — хамгийн сүүлд (transmission нь ард байгаа бүгдийг хугалж харуулна) */}
      <mesh geometry={glassGeo} position={[X_GLASS, 0, 0]} material={glass} renderOrder={10} />
      <mesh geometry={glassGeo} position={[X_GLASS, 0, 0]} scale={1.004} material={rim} renderOrder={11} />
    </>
  );
}
