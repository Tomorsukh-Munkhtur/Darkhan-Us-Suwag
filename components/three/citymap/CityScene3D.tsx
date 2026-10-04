"use client";

import { memo, useEffect, useMemo, useRef, type RefObject } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { createBackdropMaterial } from "../journey/materials/fx";
import { TIERS, type QualityTier } from "../journey/quality";
import { useDisposable } from "../journey/utils/useDisposable";
import { computeNetwork, DISTRICTS, PIPES, riverAt, svgToWorld, type P2 } from "./layout";
import { cameraPose, cityState, createCityState, stageCoord, type CameraPose } from "./state";
import { riverGeometry, roadGeometry, roadLayout, sidewalkGeometry, streetLightSpots, terrainGeometry } from "./world";
import { generateBuildings, generateCars, generateTrees, type Building, type Car, type Tree } from "./city";
import { facilityGeometry, KEY } from "./facilities";
import { pipeGeometry, pipeJoints, pipeSaddles } from "./pipes";
import { buildingCasters, pipeCasters, shadowMesh, treeCasters } from "./shadows";
import { gerCasters, gerMeshes, generateGerPlots } from "./ger";
import {
  buildingMaterial,
  createCityUniforms,
  decalMaterial,
  facilityLightMaterial,
  facilityMaterial,
  facilityWaterMaterial,
  FOG_COLOR,
  gerMaterial,
  jointMaterial,
  pipeGlowMaterial,
  pipeMaterial,
  poleMaterial,
  poolMaterial,
  propMaterial,
  riverMaterial,
  shadowMaterial,
  roadMaterial,
  sidewalkMaterial,
  spriteMaterial,
  terrainMaterial,
  treeMaterial,
} from "./materials";
import { MAP_TIERS, type CityRuntime } from "./runtime";
import { useCityPostFX } from "./postfx";

const FOV = 32;
const Y_AXIS = new THREE.Vector3(0, 1, 0);

/**
 * Камер: алхмын зураглал (state.ts) → байрлал. Зай нь SVG-ийн "cover"-той адил: харагдах газар газрын зургаас
 * (16×9 / zoom) хэтрэхгүй. Фокус цэгийг off-axis проекцоор дэлгэцийн UI-гүй хэсэгт (NDC offX/offY) байрлуулна.
 */
function applyCamera(cam: THREE.PerspectiveCamera, pose: CameraPose, aspect: number) {
  const el = THREE.MathUtils.degToRad(pose.el);
  const az = THREE.MathUtils.degToRad(pose.az);
  const t = Math.tan(THREE.MathUtils.degToRad(FOV) / 2);
  const dH = (pose.ground * Math.sin(el)) / (2 * t);
  const dW = (pose.ground * 16) / 9 / (2 * t * aspect);
  const d = Math.min(dH, dW);
  cam.fov = FOV;
  cam.aspect = aspect;
  cam.near = Math.max(0.05, d * 0.05);
  cam.far = d * 4 + 24;
  cam.position.set(pose.x + d * Math.sin(az) * Math.cos(el), d * Math.sin(el), pose.z + d * Math.cos(az) * Math.cos(el));
  cam.up.copy(Y_AXIS);
  cam.lookAt(pose.x, 0, pose.z);
  cam.updateProjectionMatrix();
  cam.projectionMatrix.elements[8] = -pose.offX;
  cam.projectionMatrix.elements[9] = -pose.offY;
  cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();
  cam.updateMatrixWorld();
  return d;
}

type Props = {
  rt: CityRuntime;
  tier: QualityTier;
  running: boolean;
  continuous: boolean;
  /** DOM шошгоны сав (canvas-ийн хажууд) */
  labels: RefObject<HTMLDivElement | null>;
  outage: { x: number; y: number; area: string } | null;
  onReady: () => void;
  onFail: () => void;
};

function CityScene3D({ rt, tier: tierName, running, continuous, labels, outage, onReady, onFail }: Props) {
  const cfg = MAP_TIERS[tierName];
  const cbs = useRef({ onReady, onFail });
  useEffect(() => {
    cbs.current = { onReady, onFail };
  });
  return (
    <Canvas
      dpr={[1, cfg.dpr]}
      frameloop={!running ? "never" : continuous ? "always" : "demand"}
      resize={{ offsetSize: true, scroll: false }}
      gl={{ antialias: cfg.aa, alpha: false, powerPreference: "high-performance" }}
      camera={{ fov: FOV, near: 0.1, far: 80, position: [0, 10, 10] }}
      onCreated={({ gl }) => {
        gl.domElement.addEventListener("webglcontextlost", (e) => {
          e.preventDefault();
          cbs.current.onFail();
        });
      }}
      style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
    >
      <Stage rt={rt} tier={tierName} running={running} labels={labels} outage={outage} onReady={() => cbs.current.onReady()} />
    </Canvas>
  );
}

export default memo(CityScene3D);

// ---------------------------------------------------------------------------------------------

function instanced(geo: THREE.BufferGeometry, mat: THREE.Material, count: number) {
  const mesh = new THREE.InstancedMesh(geo, mat, Math.max(count, 1));
  mesh.count = count;
  mesh.frustumCulled = false;
  return mesh;
}

function buildingMesh(list: Building[], mat: THREE.Material) {
  const geo = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
  geo.deleteAttribute("uv");
  const n = list.length;
  const size = new Float32Array(n * 3);
  const seed = new Float32Array(n);
  const kind = new Float32Array(n);
  const dist = new Float32Array(n);
  const shop = new Float32Array(n);
  const mesh = instanced(geo, mat, n);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const p = new THREE.Vector3();
  const s = new THREE.Vector3();
  list.forEach((b, i) => {
    q.setFromAxisAngle(Y_AXIS, b.rot ? Math.PI / 2 : 0);
    mesh.setMatrixAt(i, m.compose(p.set(b.x, b.y ?? 0, b.z), q, s.set(b.w, b.h, b.d)));
    size.set([b.w, b.h, b.d], i * 3);
    seed[i] = b.seed;
    kind[i] = b.kind;
    dist[i] = b.dist;
    shop[i] = b.shop ? 1 : 0;
  });
  geo.setAttribute("aSize", new THREE.InstancedBufferAttribute(size, 3));
  geo.setAttribute("aSeed", new THREE.InstancedBufferAttribute(seed, 1));
  geo.setAttribute("aKind", new THREE.InstancedBufferAttribute(kind, 1));
  geo.setAttribute("aDist", new THREE.InstancedBufferAttribute(dist, 1));
  geo.setAttribute("aShop", new THREE.InstancedBufferAttribute(shop, 1));
  return mesh;
}

/** Машин: их бие + бүхээг (нэгж орон зай: x урт −0.5..0.5, y 0..1, z өргөн) */
function carMesh(list: Car[], mat: THREE.Material) {
  const parts = [new THREE.BoxGeometry(1, 0.55, 1).translate(0, 0.275, 0), new THREE.BoxGeometry(0.52, 0.45, 0.84).translate(-0.05, 0.775, 0)].map((g) => {
    const o = g.toNonIndexed();
    g.dispose();
    o.deleteAttribute("uv");
    return o;
  });
  const geo = mergeGeometries(parts, false)!;
  parts.forEach((g) => g.dispose());
  const n = list.length;
  const mesh = instanced(geo, mat, n);
  const type = new Float32Array(Math.max(n, 1));
  const tint = new Float32Array(Math.max(n, 1));
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const p = new THREE.Vector3();
  const s = new THREE.Vector3(0.03, 0.012, 0.0135);
  list.forEach((c, i) => {
    q.setFromAxisAngle(Y_AXIS, c.rot);
    mesh.setMatrixAt(i, m.compose(p.set(c.x, 0.006, c.z), q, s));
    type[i] = c.moving ? 2 : 1;
    tint[i] = c.tint;
  });
  geo.setAttribute("aType", new THREE.InstancedBufferAttribute(type, 1));
  geo.setAttribute("aTint", new THREE.InstancedBufferAttribute(tint, 1));
  return mesh;
}

/** Хоолойн бетон тулгуур (instanced хайрцаг) */
function saddleMesh(list: ReturnType<typeof pipeSaddles>, mat: THREE.Material) {
  const geo = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
  geo.deleteAttribute("uv");
  const n = list.length;
  const mesh = instanced(geo, mat, n);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const p = new THREE.Vector3();
  const s = new THREE.Vector3();
  list.forEach((d, i) => {
    q.setFromAxisAngle(Y_AXIS, d.rot);
    mesh.setMatrixAt(i, m.compose(p.set(d.x, 0, d.z), q, s.set(0.014, d.h, d.r * 2.4)));
  });
  geo.setAttribute("aType", new THREE.InstancedBufferAttribute(new Float32Array(Math.max(n, 1)), 1));
  geo.setAttribute("aTint", new THREE.InstancedBufferAttribute(new Float32Array(Math.max(n, 1)), 1));
  return mesh;
}

function treeGeometry(conifer: boolean) {
  const tag = (g: THREE.BufferGeometry, part: number) => {
    const o = g.index ? g.toNonIndexed() : g;
    o.deleteAttribute("uv");
    o.setAttribute("aPart", new THREE.BufferAttribute(new Float32Array(o.attributes.position.count).fill(part), 1));
    return o;
  };
  // дээрээс харагддаггүй таг, суурийг хасна (triangle хэмнэлт)
  const parts = [tag(new THREE.CylinderGeometry(0.0035, 0.0055, 0.03, 4, 1, true).translate(0, 0.015, 0), 0)];
  if (conifer) {
    parts.push(tag(new THREE.ConeGeometry(0.03, 0.085, 8, 1, true).translate(0, 0.06, 0), 1));
    parts.push(tag(new THREE.ConeGeometry(0.021, 0.06, 8, 1, true).translate(0, 0.095, 0), 1));
  } else {
    parts.push(tag(new THREE.IcosahedronGeometry(0.034, 1).scale(1, 1.12, 1).translate(0, 0.058, 0), 1));
  }
  const g = mergeGeometries(parts, false)!;
  parts.forEach((x) => x.dispose());
  return g;
}

function treeMesh(list: Tree[], conifer: boolean, mat: THREE.Material) {
  const sel = list.filter((t) => t.conifer === conifer);
  const geo = treeGeometry(conifer);
  const mesh = instanced(geo, mat, sel.length);
  const tint = new Float32Array(Math.max(sel.length, 1));
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const p = new THREE.Vector3();
  const s = new THREE.Vector3();
  sel.forEach((t, i) => {
    q.setFromAxisAngle(Y_AXIS, t.tint * Math.PI * 2);
    mesh.setMatrixAt(i, m.compose(p.set(t.x, t.y, t.z), q, s.setScalar(t.s)));
    tint[i] = t.tint;
  });
  geo.setAttribute("aTint", new THREE.InstancedBufferAttribute(tint, 1));
  return mesh;
}

// ---------------------------------------------------------------------------------------------

type LabelDef = { text: string; x: number; y: number; z: number; kind: "river" | "district" | "repair" };

function Stage({
  rt,
  tier,
  running,
  labels,
  outage,
  onReady,
}: {
  rt: CityRuntime;
  tier: QualityTier;
  running: boolean;
  labels: RefObject<HTMLDivElement | null>;
  outage: Props["outage"];
  onReady: () => void;
}) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const invalidate = useThree((s) => s.invalidate);
  const size = useThree((s) => s.size);
  const cfg = MAP_TIERS[tier];
  const mobile = size.width < 1024;
  const density = cfg.density * (size.width < 700 ? 0.65 : 1);
  // фото мэт эцсийн боловсруулалт (bloom, tone mapping, линз) — fx түвшинд (сул төхөөрөмж дээр шууд render)
  useCityPostFX(cfg.fx, rt.reduced, 0);

  const repairW: P2 | null = useMemo(() => (outage ? svgToWorld(outage.x, outage.y) : null), [outage]);

  // --- өгөгдөл (детерминистик)
  const net = useMemo(() => computeNetwork(PIPES), []);
  const layout = useMemo(() => roadLayout(), []);
  const buildings = useMemo(() => generateBuildings(net, layout), [net, layout]);
  const trees = useMemo(() => generateTrees(layout, buildings, density), [layout, buildings, density]);
  const lights = useMemo(() => streetLightSpots(layout, cfg.lightStep), [layout, cfg.lightStep]);
  const joints = useMemo(() => pipeJoints(net), [net]);
  const cars = useMemo(() => generateCars(layout, Math.min(1, density * 1.1)), [layout, density]);
  const saddles = useMemo(() => pipeSaddles(), []);
  const gerPlots = useMemo(() => generateGerPlots(density), [density]);

  // --- материал
  const U = useMemo(createCityUniforms, []);
  const state = useMemo(createCityState, []);
  const pose = useMemo<CameraPose>(() => ({ x: 0, z: 0, ground: 9, az: 0, el: 55, offX: 0, offY: 0 }), []);
  const backdrop = useDisposable(() => {
    const m = createBackdropMaterial();
    m.uniforms.uTop.value.set(FOG_COLOR);
    m.uniforms.uBottom.value.set("#08223a");
    m.uniforms.uHalo.value.set("#123f66");
    return m;
  }, []);
  const terrainMat = useDisposable(() => terrainMaterial(U), [U]);
  const riverMat = useDisposable(() => riverMaterial(U), [U]);
  const roadMat = useDisposable(() => roadMaterial(U), [U]);
  const walkMat = useDisposable(() => sidewalkMaterial(U), [U]);
  const bldMat = useDisposable(() => buildingMaterial(U), [U]);
  const treeMat = useDisposable(() => treeMaterial(U), [U]);
  const pipeMat = useDisposable(() => pipeMaterial(U), [U]);
  const glowMat = useDisposable(() => pipeGlowMaterial(U), [U]);
  const jointMat = useDisposable(() => jointMaterial(U), [U]);
  const facMat = useDisposable(() => facilityMaterial(U), [U]);
  const facLightMat = useDisposable(() => facilityLightMaterial(U), [U]);
  const facWaterMat = useDisposable(() => facilityWaterMaterial(U), [U]);
  const decalMat = useDisposable(() => decalMaterial(U), [U]);
  const poleMat = useDisposable(() => poleMaterial(U), [U]);
  const lampMat = useDisposable(() => spriteMaterial(U, "#ffd9a0", 0.85), [U]);
  const poolMat = useDisposable(poolMaterial, []);
  const shadowMat = useDisposable(() => shadowMaterial(U), [U]);
  const propMat = useDisposable(() => propMaterial(U), [U]);
  const gerMat = useDisposable(() => gerMaterial(U), [U]);

  // --- geometry
  const terrainGeo = useDisposable(() => terrainGeometry(cfg.terrain[0], cfg.terrain[1]), [cfg.terrain]);
  const riverGeo = useDisposable(riverGeometry, []);
  const roadGeo = useDisposable(() => roadGeometry(layout), [layout]);
  const walkGeo = useDisposable(() => sidewalkGeometry(layout), [layout]);
  const pipeGeo = useDisposable(() => pipeGeometry(net, tier === "LOW" ? 6 : 8), [net, tier]);
  const glowGeo = useDisposable(() => (cfg.fx ? pipeGeometry(net, 6, 2.6) : new THREE.BufferGeometry()), [net, cfg.fx]);
  const fac = useMemo(() => facilityGeometry(buildings, repairW), [buildings, repairW]);
  useEffect(
    () => () => {
      fac.body.dispose();
      fac.lights.dispose();
      fac.water.dispose();
      fac.decals.dispose();
    },
    [fac],
  );

  // --- instanced
  const bldMesh = useMemo(() => buildingMesh(buildings, bldMat), [buildings, bldMat]);
  const carsMesh = useMemo(() => carMesh(cars, propMat), [cars, propMat]);
  const saddlesMesh = useMemo(() => saddleMesh(saddles, propMat), [saddles, propMat]);
  const shadows = useMemo(
    () => shadowMesh([...buildingCasters(buildings), ...treeCasters(trees), ...fac.shadows, ...pipeCasters(), ...gerCasters(gerPlots)], shadowMat),
    [buildings, trees, fac, gerPlots, shadowMat],
  );
  const roundTrees = useMemo(() => treeMesh(trees, false, treeMat), [trees, treeMat]);
  const gerList = useMemo(() => gerMeshes(gerPlots, gerMat), [gerPlots, gerMat]);
  const conifers = useMemo(() => treeMesh(trees, true, treeMat), [trees, treeMat]);
  const jointMesh = useMemo(() => {
    const geo = new THREE.CylinderGeometry(1, 1, 1, 12).translate(0, 0.5, 0);
    geo.deleteAttribute("uv");
    const mesh = instanced(geo, jointMat, joints.length);
    const d = new Float32Array(Math.max(joints.length, 1));
    const k = new Float32Array(Math.max(joints.length, 1));
    const m = new THREE.Matrix4();
    joints.forEach((j, i) => {
      m.makeScale(j.r, j.r * 2.3, j.r).setPosition(j.x, j.y - j.r * 1.15, j.z);
      mesh.setMatrixAt(i, m);
      d[i] = j.d;
      k[i] = j.kind;
    });
    geo.setAttribute("aD", new THREE.InstancedBufferAttribute(d, 1));
    geo.setAttribute("aKind", new THREE.InstancedBufferAttribute(k, 1));
    return mesh;
  }, [joints, jointMat]);
  const { poles, lamps, pools } = useMemo(() => {
    const poleParts = [
      new THREE.CylinderGeometry(0.0032, 0.005, 0.12, 5).translate(0, 0.06, 0),
      new THREE.BoxGeometry(0.036, 0.0035, 0.0035).translate(0.017, 0.118, 0),
      new THREE.BoxGeometry(0.018, 0.006, 0.01).translate(0.034, 0.115, 0),
    ].map((g) => {
      const o = g.index ? g.toNonIndexed() : g;
      o.deleteAttribute("uv");
      return o;
    });
    const poleGeo = mergeGeometries(poleParts, false)!;
    poleParts.forEach((g) => g.dispose());
    const n = lights.length;
    const poles = instanced(poleGeo, poleMat, n);
    const lampGeo = new THREE.PlaneGeometry(1, 1);
    lampGeo.setAttribute("aSize", new THREE.InstancedBufferAttribute(new Float32Array(Math.max(n, 1)).fill(0.07), 1));
    const lamps = instanced(lampGeo, lampMat, n);
    const pools = instanced(new THREE.PlaneGeometry(0.24, 0.24).rotateX(-Math.PI / 2), poolMat, cfg.fx ? n : 0);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const one = new THREE.Vector3(1, 1, 1);
    const p = new THREE.Vector3();
    lights.forEach((l, i) => {
      const dx = l.road[0] - l.x;
      const dz = l.road[1] - l.z;
      const len = Math.hypot(dx, dz) || 1;
      const theta = Math.atan2(-dz / len, dx / len);
      q.setFromAxisAngle(Y_AXIS, theta);
      poles.setMatrixAt(i, m.compose(p.set(l.x, 0, l.z), q, one));
      const hx = l.x + (dx / len) * 0.034;
      const hz = l.z + (dz / len) * 0.034;
      lamps.setMatrixAt(i, m.makeTranslation(hx, 0.11, hz));
      if (cfg.fx) pools.setMatrixAt(i, m.makeTranslation(hx, 0.0095, hz));
    });
    return { poles, lamps, pools };
  }, [lights, poleMat, lampMat, poolMat, cfg.fx]);
  useEffect(
    () => () => {
      for (const mesh of [bldMesh, roundTrees, conifers, jointMesh, poles, lamps, pools, carsMesh, saddlesMesh, shadows, ...gerList]) {
        mesh.geometry.dispose();
        mesh.dispose();
      }
    },
    [bldMesh, roundTrees, conifers, jointMesh, poles, lamps, pools, carsMesh, saddlesMesh, shadows, gerList],
  );

  // --- DOM шошго (lazy chunk дотор үүсгэнэ — эхний bundle-д layout өгөгдөл орохгүй)
  const labelDefs = useMemo<LabelDef[]>(() => {
    const defs: LabelDef[] = [{ text: "ХАРАА ГОЛ", x: -5.6, y: 0.02, z: riverAt(-5.6).z, kind: "river" }];
    for (const d of DISTRICTS) defs.push({ text: d.name, x: d.label[0], y: 0.42, z: d.label[1], kind: "district" });
    if (repairW && outage) defs.push({ text: `ЗАСВАР · ${outage.area}`, x: repairW[0], y: 0.17, z: repairW[1], kind: "repair" });
    return defs;
  }, [repairW, outage]);
  const labelEls = useRef<HTMLElement[]>([]);
  useEffect(() => {
    const host = labels.current;
    if (!host) return;
    const els = labelDefs.map((d) => {
      const el = document.createElement("span");
      el.textContent = d.text;
      el.className =
        d.kind === "repair"
          ? "absolute left-0 top-0 flex items-center gap-1.5 whitespace-nowrap rounded-full border border-[#ff5a6e]/50 bg-[#0b2e4c]/90 px-3 py-1 text-[12px] font-bold text-[#ff5a6e] shadow-[0_6px_20px_-8px_rgba(255,90,110,.6)]"
          : d.kind === "river"
            ? "absolute left-0 top-0 whitespace-nowrap font-display text-[11px] font-bold tracking-[0.35em] text-[#8fd0f0]/80 [text-shadow:0_1px_10px_rgba(4,26,46,.95)]"
            : "absolute left-0 top-0 whitespace-nowrap font-display text-[12px] font-bold tracking-[0.3em] text-[#e4f2fb] [text-shadow:0_2px_12px_rgba(4,26,46,1)]";
      el.style.opacity = "0";
      el.style.willChange = "transform, opacity";
      host.appendChild(el);
      return el;
    });
    labelEls.current = els;
    return () => {
      els.forEach((el) => el.remove());
      labelEls.current = [];
    };
  }, [labels, labelDefs]);

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

  const frames = useRef(0);
  const tmp = useMemo(() => new THREE.Vector3(), []);
  useFrame((st, delta) => {
    const settings = TIERS[rt.tier];
    const amb = settings.ambient && !rt.reduced;
    if (amb) rt.ambientTime += Math.min(delta, 1 / 20);
    const t = amb ? rt.ambientTime : 0;
    const v = stageCoord(rt.progress);

    // --- үндсэн төлөв: зөвхөн scroll progress
    cityState(v, net, state);
    cameraPose(v, mobile, pose);
    const aspect = st.size.width / Math.max(st.size.height, 1);
    const d = applyCamera(camera, pose, aspect);
    U.uFogStart.value = d * 1.0;
    U.uFogDensity.value = 1 / (d * 1.3);
    for (let i = 0; i < state.emph.length; i++) U.uEmph.value[i] = state.emph[i];
    U.uClean.value = state.clean;
    U.uSewer.value = state.sewer;
    U.uOutfall.value = state.outfall;
    U.uReservoir.value = state.reservoir;
    U.uPlant.value = state.plant;
    U.uWindows.value = state.windows;
    U.uWells.value = state.wells;
    if (repairW) U.uRepair.value.set(repairW[0], repairW[1]);
    // гэрэл/тэмдэглэгээ: тухайн алхам дээр л тод (онцлох бүс ≈ 1)
    const focus = (e: number) => Math.min(Math.max((e - 0.78) / 0.22, 0), 1);
    const L = U.uLit.value;
    L[KEY.service] = 0.9;
    L[KEY.wells] = (0.35 + 0.65 * state.wells) * (0.45 + 0.55 * focus(state.emph[0]));
    L[KEY.pump1] = (0.25 + 0.75 * state.pump1) * (0.6 + 0.4 * focus(state.emph[1]));
    L[KEY.pump2] = (0.25 + 0.75 * state.pump2) * (0.6 + 0.4 * focus(state.emph[1]));
    L[KEY.reservoir] = (0.25 + 0.75 * state.reservoir) * (0.6 + 0.4 * focus(state.emph[2]));
    L[KEY.plant] = (0.25 + 0.75 * state.plant) * (0.6 + 0.4 * focus(state.emph[4]));
    L[KEY.repair] = 1.1;
    L[KEY.industry] = 0.8;

    // --- чимэглэл: урсгалын фаз (scroll + ambient), усны гялбаа, модны найгалт, засварын импульс
    U.uPhase.value = v * 2.2 + t * 0.55;
    U.uTime.value = t;
    U.uPulse.value = amb ? 0.5 + 0.5 * Math.sin(t * 3.2) : 0.6;
    U.uDetail.value = settings.waterDetail;

    // --- DOM шошго (камерын одоогийн матрицаар)
    const els = labelEls.current;
    const W = st.size.width;
    const H = st.size.height;
    labelDefs.forEach((def, i) => {
      const el = els[i];
      if (!el) return;
      tmp.set(def.x, def.y, def.z).project(camera);
      const inside = tmp.z < 1 && Math.abs(tmp.x) < 1.05 && Math.abs(tmp.y) < 1.05;
      const x = (tmp.x * 0.5 + 0.5) * W;
      const y = (-tmp.y * 0.5 + 0.5) * H;
      el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translate(-50%, -50%)`;
      const o = def.kind === "district" ? 0.45 + 0.55 * state.emph[3] : def.kind === "river" ? 0.55 + 0.45 * state.emph[0] : 1;
      el.style.opacity = inside ? o.toFixed(2) : "0";
    });

    frames.current++;
    if (frames.current === 2) onReady();
  });

  return (
    <>
      <mesh frustumCulled={false} renderOrder={-1000} material={backdrop}>
        <planeGeometry args={[2, 2]} />
      </mesh>
      <mesh geometry={terrainGeo} material={terrainMat} />
      <mesh geometry={riverGeo} material={riverMat} />
      <mesh geometry={roadGeo} material={roadMat} />
      <mesh geometry={walkGeo} material={walkMat} />
      <primitive object={bldMesh} />
      <primitive object={roundTrees} />
      <primitive object={conifers} />
      <primitive object={poles} />
      <primitive object={carsMesh} />
      <primitive object={saddlesMesh} />
      {gerList.map((m, i) => (
        <primitive key={i} object={m} />
      ))}
      <primitive object={shadows} renderOrder={2} />
      <mesh geometry={fac.body} material={facMat} />
      <mesh geometry={fac.lights} material={facLightMat} />
      <mesh geometry={fac.water} material={facWaterMat} />
      <mesh geometry={pipeGeo} material={pipeMat} />
      <primitive object={jointMesh} />
      <mesh geometry={fac.decals} material={decalMat} renderOrder={4} />
      {cfg.fx && <mesh geometry={glowGeo} material={glowMat} renderOrder={5} />}
      {cfg.fx && <primitive object={pools} renderOrder={3} />}
      <primitive object={lamps} renderOrder={6} />
    </>
  );
}
