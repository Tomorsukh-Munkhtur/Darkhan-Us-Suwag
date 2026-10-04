import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { seeded } from "@/lib/seeded";
import { GER_AREAS } from "./layout";
import { gable } from "./builder";
import type { Caster } from "./shadows";

/**
 * Гэр хороолол: хашаа (банзан хайс), эсгий гэр, өнгөт дээвэртэй жижиг байшин, саравч. Детерминистик (seeded) байрлал;
 * гурван InstancedMesh (гэр, байшин/саравч, хашааны хэрчим), нэг материал (materials.gerMaterial).
 * aPart: 0 хана, 1 дээвэр, 2 тооно (бараан), 3 хаалга/цонх (шөнө гэрэлтэнэ).
 */
export type GerItem = { x: number; z: number; sx: number; sy: number; sz: number; rot: number; wall: [number, number, number]; roof: [number, number, number]; lit: number };

const col = (hex: string): [number, number, number] => {
  const c = new THREE.Color(hex);
  return [c.r, c.g, c.b];
};
const ROOFS = ["#3d6b48", "#8e4434", "#35607f", "#6a4c36", "#56626d", "#3d7470"].map(col);
const WALLS = ["#a9a291", "#9d9480", "#97a0a4", "#a59784", "#8e999b"].map(col);
const FENCES = ["#6b5138", "#5a4a3a", "#7d6a52", "#4f6a5a", "#5f6f80"].map(col);
const FELT: [number, number, number] = col("#a8a293");

export function generateGerPlots(density: number) {
  const rnd = seeded(31337);
  const gers: GerItem[] = [];
  const houses: GerItem[] = [];
  const fences: GerItem[] = [];
  const PW = 0.14;
  const PD = 0.12;
  for (const a of GER_AREAS) {
    let row = 0;
    for (let z = a.z0 + 0.02; z + PD <= a.z1; z += PD + (row % 2 ? 0.035 : 0.004), row++) {
      for (let x0 = a.x0 + 0.02 + (row % 2) * 0.03; x0 + PW <= a.x1; x0 += PW + 0.004 + rnd() * 0.012) {
        if (rnd() < 0.1) continue;
        if (rnd() > Math.max(density, 0.55)) continue;
        const w = PW - 0.01 - rnd() * 0.02;
        const d = PD - 0.01 - rnd() * 0.015;
        const x = x0;
        const px = x + w / 2;
        const pz = z + d / 2;
        // хашаа: 4 тал (урд талд хаалганы завсар)
        const fc = FENCES[Math.floor(rnd() * FENCES.length)];
        const fh = 0.011;
        const seg = (cx: number, cz: number, len: number, rot: number) => fences.push({ x: cx, z: cz, sx: len, sy: fh, sz: 0.0022, rot, wall: fc, roof: fc, lit: 0 });
        seg(px, z, w, 0);
        seg(x, pz, d, Math.PI / 2);
        seg(x + w, pz, d, Math.PI / 2);
        seg(x + w * 0.3, z + d, w * 0.6, 0);
        seg(x + w * 0.85, z + d, w * 0.3, 0);
        // гэр ба/эсвэл байшин (хоёр хэсэгт)
        const left = rnd() < 0.5;
        const hasGer = rnd() < 0.68;
        const hasHouse = !hasGer || rnd() < 0.45;
        if (hasGer) {
          const r = 0.0135 + rnd() * 0.004;
          const gx = left ? x + w * 0.3 : x + w * 0.7;
          gers.push({ x: gx, z: pz + (rnd() - 0.5) * 0.02, sx: r, sy: r, sz: r, rot: (rnd() - 0.5) * 0.6, wall: FELT, roof: FELT, lit: rnd() < 0.3 ? 0.8 : 0.05 });
        }
        if (hasHouse) {
          const hw = 0.032 + rnd() * 0.018;
          const hd = 0.026 + rnd() * 0.012;
          const hx = hasGer ? (left ? x + w * 0.72 : x + w * 0.28) : px;
          houses.push({
            x: hx,
            z: z + d * 0.38,
            sx: hw,
            sy: 0.018 + rnd() * 0.006,
            sz: hd,
            rot: rnd() < 0.15 ? Math.PI / 2 : 0,
            wall: WALLS[Math.floor(rnd() * WALLS.length)],
            roof: ROOFS[Math.floor(rnd() * ROOFS.length)],
            lit: rnd() < 0.35 ? 0.85 : 0.05,
          });
        }
        // саравч / жорлон (жижиг)
        if (rnd() < 0.35)
          houses.push({ x: x + w * (left ? 0.88 : 0.12), z: z + d * 0.82, sx: 0.012, sy: 0.012, sz: 0.01, rot: 0, wall: col("#8b7355"), roof: col("#5a4a3a"), lit: 0 });
      }
    }
  }
  return { gers, houses, fences };
}
export type GerPlots = ReturnType<typeof generateGerPlots>;

function tagged(g: THREE.BufferGeometry, part: number) {
  const o = g.index ? g.toNonIndexed() : g;
  if (o !== g) g.dispose();
  for (const n of Object.keys(o.attributes)) if (n !== "position" && n !== "normal") o.deleteAttribute(n);
  if (!o.attributes.normal) o.computeVertexNormals();
  o.setAttribute("aPart", new THREE.BufferAttribute(new Float32Array(o.attributes.position.count).fill(part), 1));
  return o;
}

/** Гэр: нэгж радиус — хана (0.75 өндөр), конус дээвэр, тооно, урд хаалга */
function gerGeometry() {
  const parts = [
    tagged(new THREE.CylinderGeometry(1, 1, 0.72, 14, 1, true).translate(0, 0.36, 0), 0),
    tagged(new THREE.ConeGeometry(1.06, 0.5, 14, 1, true).translate(0, 0.72 + 0.25, 0), 1),
    tagged(new THREE.CylinderGeometry(0.22, 0.26, 0.08, 10).translate(0, 1.2, 0), 2),
    tagged(new THREE.PlaneGeometry(0.42, 0.5).translate(0, 0.27, 1.005), 3),
  ];
  const g = mergeGeometries(parts, false)!;
  parts.forEach((p) => p.dispose());
  return g;
}

/** Байшин: нэгж хайрцаг (0..1 өндөр) + хоёр талт дээвэр + урд цонх */
function houseGeometry() {
  const parts = [
    tagged(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), 0),
    tagged(gable(1.12, 1.14, 0.42, 0, 1, 0), 1),
    tagged(new THREE.PlaneGeometry(0.26, 0.3).translate(-0.18, 0.5, 0.505), 3),
    tagged(new THREE.PlaneGeometry(0.26, 0.3).translate(0.2, 0.5, 0.505), 3),
  ];
  const g = mergeGeometries(parts, false)!;
  parts.forEach((p) => p.dispose());
  return g;
}

function fenceGeometry() {
  return tagged(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), 0);
}

function mesh(geo: THREE.BufferGeometry, mat: THREE.Material, list: GerItem[]) {
  const n = list.length;
  const m = new THREE.InstancedMesh(geo, mat, Math.max(n, 1));
  m.count = n;
  m.frustumCulled = false;
  const wall = new Float32Array(Math.max(n, 1) * 3);
  const roof = new Float32Array(Math.max(n, 1) * 3);
  const lit = new Float32Array(Math.max(n, 1));
  const mat4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const p = new THREE.Vector3();
  const s = new THREE.Vector3();
  const Y = new THREE.Vector3(0, 1, 0);
  list.forEach((it, i) => {
    q.setFromAxisAngle(Y, it.rot);
    m.setMatrixAt(i, mat4.compose(p.set(it.x, 0.002, it.z), q, s.set(it.sx, it.sy, it.sz)));
    wall.set(it.wall, i * 3);
    roof.set(it.roof, i * 3);
    lit[i] = it.lit;
  });
  geo.setAttribute("aWall", new THREE.InstancedBufferAttribute(wall, 3));
  geo.setAttribute("aRoof", new THREE.InstancedBufferAttribute(roof, 3));
  geo.setAttribute("aLitW", new THREE.InstancedBufferAttribute(lit, 1));
  return m;
}

export function gerMeshes(plots: GerPlots, mat: THREE.Material) {
  return [mesh(gerGeometry(), mat, plots.gers), mesh(houseGeometry(), mat, plots.houses), mesh(fenceGeometry(), mat, plots.fences)];
}

/** Хуурамч сүүдэр (гэр — тойрог, байшин — тэгш өнцөгт) */
export function gerCasters(plots: GerPlots): Caster[] {
  return [
    ...plots.gers.map((g) => ({ kind: 1 as const, cx: g.x, cz: g.z, r: g.sx, h: g.sy * 1.2, k: 0.6 })),
    ...plots.houses.map((h) => ({ kind: 0 as const, cx: h.x, cz: h.z, hx: h.sx / 2, hz: h.sz / 2, rot: h.rot, h: h.sy * 1.4, k: 0.6 })),
  ];
}
