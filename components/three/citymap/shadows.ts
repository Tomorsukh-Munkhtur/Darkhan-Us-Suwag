import * as THREE from "three";
import { CORE, PIPES, terrainHeight } from "./layout";
import { PIPE_Y } from "./pipes";
import type { Building, Tree } from "./city";

/**
 * Хуурамч сүүдэр (realtime shadow map-гүй): барилга, мод, байгууламж, хоолой бүрт газар дээрх нэг instanced quad.
 * Сарны key гэрлийн (materials KEY_DIR) эсрэг чиглэлд өндрөөрөө сунасан дүрс + ёроолын зөөлөн AO. Нэг draw call.
 */
/** Нэгж өндөрт газар дээрх сүүдрийн шилжилт: −(L.x, L.z) / L.y, L = normalize(−0.5, 0.8, 0.38) */
export const SHADOW_DIR = [0.625, -0.475] as const;

/** 0 — тэгш өнцөгт (rot — Y эргэлт), 1 — тойрог, 2 — хэрчим (хөвөгч хоолой: зөвхөн шилжсэн сүүдэр) */
export type Caster =
  | { kind: 0; cx: number; cz: number; hx: number; hz: number; rot: number; h: number; k: number }
  | { kind: 1; cx: number; cz: number; r: number; h: number; k: number }
  | { kind: 2; ax: number; az: number; bx: number; bz: number; r: number; h: number; k: number };

export function buildingCasters(list: Building[]): Caster[] {
  return list
    .filter((b) => b.kind !== 4)
    .map((b) => ({ kind: 0, cx: b.x, cz: b.z, hx: b.w / 2, hz: b.d / 2, rot: b.rot ? Math.PI / 2 : 0, h: b.h, k: 1 }));
}

export function treeCasters(list: Tree[]): Caster[] {
  return list.map((t) => ({ kind: 1, cx: t.x, cz: t.z, r: 0.03 * t.s, h: 0.085 * t.s, k: 0.7 }));
}

export function pipeCasters(): Caster[] {
  const out: Caster[] = [];
  for (const p of PIPES) {
    if (p.kind === "outfall") continue;
    for (let k = 0; k < p.pts.length - 1; k++) {
      const [ax, az] = p.pts[k];
      const [bx, bz] = p.pts[k + 1];
      out.push({ kind: 2, ax, az, bx, bz, r: p.r * 1.15, h: p.trunk ? PIPE_Y + 0.008 : PIPE_Y, k: 0.75 });
    }
  }
  return out;
}

export function shadowMesh(casters: Caster[], mat: THREE.Material) {
  const geo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  geo.deleteAttribute("normal");
  const n = casters.length;
  const shape = new Float32Array(Math.max(n, 1) * 4);
  const param = new Float32Array(Math.max(n, 1) * 4);
  const strength = new Float32Array(Math.max(n, 1));
  const mesh = new THREE.InstancedMesh(geo, mat, Math.max(n, 1));
  mesh.count = n;
  mesh.frustumCulled = false;
  const m = new THREE.Matrix4();
  casters.forEach((c, i) => {
    const sx = SHADOW_DIR[0] * c.h;
    const sz = SHADOW_DIR[1] * c.h;
    let x0: number, x1: number, z0: number, z1: number;
    if (c.kind === 0) {
      const ex = Math.abs(Math.cos(c.rot)) * c.hx + Math.abs(Math.sin(c.rot)) * c.hz;
      const ez = Math.abs(Math.sin(c.rot)) * c.hx + Math.abs(Math.cos(c.rot)) * c.hz;
      [x0, x1, z0, z1] = [c.cx - ex, c.cx + ex, c.cz - ez, c.cz + ez];
      shape.set([c.cx, c.cz, c.hx, c.hz], i * 4);
      param.set([0, c.rot, sx, sz], i * 4);
    } else if (c.kind === 1) {
      [x0, x1, z0, z1] = [c.cx - c.r, c.cx + c.r, c.cz - c.r, c.cz + c.r];
      shape.set([c.cx, c.cz, c.r, 0], i * 4);
      param.set([1, 0, sx, sz], i * 4);
    } else {
      [x0, x1, z0, z1] = [Math.min(c.ax, c.bx) - c.r, Math.max(c.ax, c.bx) + c.r, Math.min(c.az, c.bz) - c.r, Math.max(c.az, c.bz) + c.r];
      shape.set([c.ax, c.az, c.bx, c.bz], i * 4);
      param.set([2, c.r, sx, sz], i * 4);
    }
    // дүрс ∪ (дүрс + шилжилт) + зөөлөн ирмэгийн нөөц
    const M = 0.05;
    const bx0 = Math.min(x0, x0 + sx) - M;
    const bx1 = Math.max(x1, x1 + sx) + M;
    const bz0 = Math.min(z0, z0 + sz) - M;
    const bz1 = Math.max(z1, z1 + sz) + M;
    const cx = (bx0 + bx1) / 2;
    const cz = (bz0 + bz1) / 2;
    const inCore = cx > CORE.x0 && cx < CORE.x1 && cz > CORE.z0 && cz < CORE.z1;
    const y = (inCore ? 0 : Math.max(terrainHeight(cx, cz), -0.03)) + 0.0135;
    m.makeScale(bx1 - bx0, 1, bz1 - bz0).setPosition(cx, y, cz);
    mesh.setMatrixAt(i, m);
    strength[i] = c.k;
  });
  geo.setAttribute("aShape", new THREE.InstancedBufferAttribute(shape, 4));
  geo.setAttribute("aParam", new THREE.InstancedBufferAttribute(param, 4));
  geo.setAttribute("aK", new THREE.InstancedBufferAttribute(strength, 1));
  return mesh;
}
