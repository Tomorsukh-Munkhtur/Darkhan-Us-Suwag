import { seeded } from "@/lib/seeded";
import {
  CORE,
  DISTRICTS,
  nearestCleanD,
  PIPES,
  PLANT,
  PUMPS,
  RESERVOIR,
  RIVER_HALF,
  riverAt,
  riverDist,
  SOURCE_ZONE,
  terrainHeight,
  WELLS,
  type District,
  type Network,
} from "./layout";
import { roadClearance, type RoadLayout } from "./world";

/**
 * Барилга (instanced) ба модны байрлалын генератор. Детерминистик (seeded) — SSR/клиент, түвшин бүрт ижил дараалал;
 * density нь зөвхөн тоог багасгана.
 */
export const FLOOR_H = 0.024;
/** 0 — хуучин панель байр, 1 — шинэ олон давхар, 2 — үйлдвэр, 3 — нийтийн (сургууль, цэцэрлэг) */
export type BuildingKind = 0 | 1 | 2 | 3;
export type Building = { x: number; z: number; w: number; d: number; h: number; rot: boolean; kind: BuildingKind; seed: number; dist: number; district: number };
export type Rect = { x0: number; x1: number; z0: number; z1: number };

const SIDEWALK = 0.034;

function roadHalf(d: District, axis: "x" | "y", i: number) {
  // дүүргийн эхний хэвтээ гудамж нь өргөн чөлөө
  const major = axis === "y" && i === 0;
  return (major ? 0.16 : 0.1) / 2 + SIDEWALK + 0.03;
}

export function districtLots(d: District) {
  const lots: Rect[] = [];
  for (let i = 0; i < d.xs.length - 1; i++)
    for (let j = 0; j < d.ys.length - 1; j++)
      lots.push({
        x0: d.xs[i] + roadHalf(d, "x", i),
        x1: d.xs[i + 1] - roadHalf(d, "x", i + 1),
        z0: d.ys[j] + roadHalf(d, "y", j),
        z1: d.ys[j + 1] - roadHalf(d, "y", j + 1),
      });
  return lots;
}

const overlaps = (r: Rect, list: Rect[], m: number) => list.some((q) => r.x0 < q.x1 + m && r.x1 > q.x0 - m && r.z0 < q.z1 + m && r.z1 > q.z0 - m);
const footprint = (b: Building): Rect => {
  const hx = (b.rot ? b.d : b.w) / 2;
  const hz = (b.rot ? b.w : b.d) / 2;
  return { x0: b.x - hx, x1: b.x + hx, z0: b.z - hz, z1: b.z + hz };
};

export function generateBuildings(net: Network) {
  const out: Building[] = [];
  const rnd = seeded(20251);
  const r = (a: number, b: number) => a + (b - a) * rnd();
  DISTRICTS.forEach((d, di) => {
    for (const lot of districtLots(d)) {
      const placed: Rect[] = [];
      const push = (b: Omit<Building, "seed" | "dist" | "district">) => {
        const full: Building = { ...b, seed: rnd(), dist: 0, district: di };
        const fp = footprint(full);
        if (fp.x0 < lot.x0 - 1e-3 || fp.x1 > lot.x1 + 1e-3 || fp.z0 < lot.z0 - 1e-3 || fp.z1 > lot.z1 + 1e-3) return false;
        if (overlaps(fp, placed, 0.035)) return false;
        placed.push(fp);
        out.push(full);
        return true;
      };
      if (d.id === "ind") {
        // үйлдвэр: урт тэнхлэгийн дагуу 2–3 том цех + жижиг нэмэлт барилга
        const along = lot.x1 - lot.x0 >= lot.z1 - lot.z0;
        const L = along ? lot.x1 - lot.x0 : lot.z1 - lot.z0;
        const D = along ? lot.z1 - lot.z0 : lot.x1 - lot.x0;
        const n = L > 1.1 ? 3 : 2;
        let t = 0;
        for (let k = 0; k < n; k++) {
          const len = (L / n) * r(0.62, 0.86);
          const dep = D * r(0.42, 0.72);
          const c = t + L / n / 2;
          const off = r(-0.5, 0.5) * (D - dep) * 0.8;
          const x = along ? lot.x0 + c : (lot.x0 + lot.x1) / 2 + off;
          const z = along ? (lot.z0 + lot.z1) / 2 + off : lot.z0 + c;
          push({ x, z, w: len, d: dep, h: r(0.055, 0.1), rot: !along, kind: 2 });
          t += L / n;
        }
        for (let k = 0; k < 3; k++) {
          const w = r(0.1, 0.18);
          push({ x: r(lot.x0 + 0.08, lot.x1 - 0.08), z: r(lot.z0 + 0.08, lot.z1 - 0.08), w, d: w * r(0.6, 1), h: r(0.04, 0.07), rot: rnd() < 0.5, kind: 2 });
        }
        continue;
      }
      const isNew = d.id === "new";
      const depth = isNew ? 0.1 : 0.092;
      const setback = 0.035;
      const floors = () => {
        const q = rnd();
        if (isNew) return q < 0.55 ? 9 : q < 0.85 ? 12 : 5;
        return q < 0.72 ? 5 : q < 0.9 ? 9 : 4;
      };
      // хашааг тойруулсан хавтан байр (perimeter block)
      const runX = (z: number) => {
        let x = lot.x0 + r(0, 0.06);
        while (x < lot.x1 - 0.2) {
          const len = r(0.32, isNew ? 0.66 : 0.58);
          if (x + len > lot.x1) break;
          push({ x: x + len / 2, z, w: len, d: depth, h: floors() * FLOOR_H, rot: false, kind: isNew ? 1 : 0 });
          x += len + r(0.06, 0.14);
        }
      };
      const runZ = (x: number) => {
        let z = lot.z0 + depth + 0.09 + r(0, 0.05);
        while (z < lot.z1 - depth - 0.25) {
          const len = r(0.3, 0.52);
          if (z + len > lot.z1 - depth - 0.08) break;
          push({ x, z: z + len / 2, w: len, d: depth, h: floors() * FLOOR_H, rot: true, kind: isNew ? 1 : 0 });
          z += len + r(0.07, 0.15);
        }
      };
      runX(lot.z0 + setback + depth / 2);
      runX(lot.z1 - setback - depth / 2);
      runZ(lot.x0 + setback + depth / 2);
      runZ(lot.x1 - setback - depth / 2);
      if (isNew) {
        // олон давхар цамхаг
        for (let k = 0; k < 2; k++) {
          const s = r(0.12, 0.15);
          push({ x: r(lot.x0 + 0.25, lot.x1 - 0.25), z: r(lot.z0 + 0.25, lot.z1 - 0.25), w: s, d: s, h: Math.round(r(12, 16)) * FLOOR_H, rot: false, kind: 1 });
        }
      } else if (rnd() < 0.55) {
        // сургууль / цэцэрлэг
        push({ x: (lot.x0 + lot.x1) / 2 + r(-0.1, 0.1), z: (lot.z0 + lot.z1) / 2 + r(-0.1, 0.1), w: r(0.26, 0.34), d: r(0.14, 0.18), h: 3 * FLOOR_H, rot: rnd() < 0.5, kind: 3 });
      }
    }
  });
  for (const b of out) b.dist = nearestCleanD(net.cleanNodes, b.x, b.z);
  return out;
}

// ---------------------------------------------------------------------------------------------
// Мод

export type Tree = { x: number; y: number; z: number; s: number; conifer: boolean; tint: number };

function pipeDist(x: number, z: number) {
  let best = Infinity;
  for (const p of PIPES)
    for (let k = 0; k < p.pts.length - 1; k++) {
      const [ax, az] = p.pts[k];
      const [bx, bz] = p.pts[k + 1];
      const vx = bx - ax;
      const vz = bz - az;
      const t = Math.max(0, Math.min(1, ((x - ax) * vx + (z - az) * vz) / (vx * vx + vz * vz || 1)));
      best = Math.min(best, Math.hypot(x - ax - vx * t, z - az - vz * t));
    }
  return best;
}

export function generateTrees(layout: RoadLayout, buildings: Building[], density: number) {
  const rnd = seeded(7331);
  const r = (a: number, b: number) => a + (b - a) * rnd();
  const fps = buildings.map(footprint);
  const out: Tree[] = [];
  const blocked = (x: number, z: number, m = 0.035) => {
    if (riverDist(x, z) < RIVER_HALF + 0.12) return true;
    if (roadClearance(layout, x, z) < 0.05) return true;
    if (fps.some((q) => x > q.x0 - m && x < q.x1 + m && z > q.z0 - m && z < q.z1 + m)) return true;
    if (pipeDist(x, z) < 0.06) return true;
    if (WELLS.some(([wx, wz]) => Math.hypot(x - wx, z - wz) < 0.2)) return true;
    if (PUMPS.some(([px, pz]) => Math.hypot(x - px, z - pz) < 0.32)) return true;
    if (Math.hypot(x - RESERVOIR.c[0], z - RESERVOIR.c[1]) < RESERVOIR.r + 0.18) return true;
    const pp = PLANT.pad;
    if (x > pp.x0 - 0.05 && x < pp.x1 + 0.05 && z > pp.z0 - 0.05 && z < pp.z1 + 0.05) return true;
    return false;
  };
  const add = (x: number, z: number, s: number, conifer: boolean) => {
    if (rnd() > density) return;
    if (blocked(x, z)) return;
    out.push({ x, y: terrainHeight(x, z), z, s, conifer, tint: rnd() });
  };

  // хашааны мод
  DISTRICTS.forEach((d) => {
    if (d.id === "ind") return;
    for (const lot of districtLots(d)) {
      const n = Math.round((lot.x1 - lot.x0) * (lot.z1 - lot.z0) * 14);
      for (let k = 0; k < n; k++) add(r(lot.x0, lot.x1), r(lot.z0, lot.z1), r(0.75, 1.15), false);
    }
  });
  // өргөн чөлөөний дагуух мод
  for (const p of layout.pieces) {
    if (!p.major) continue;
    for (let t = p.a + 0.08; t < p.b - 0.08; t += 0.16)
      for (const s of [-1, 1]) {
        const off = s * (p.w / 2 + 0.07);
        if (p.horizontal) add(t, p.c + off, r(0.7, 0.95), false);
        else add(p.c + off, t, r(0.7, 0.95), false);
      }
  }
  // голын эргийн ой (хоёр эрэг)
  for (let x = -18; x < 18; x += 0.105) {
    const rz = riverAt(x).z;
    for (const s of [-1, 1]) {
      const n = 1 + Math.floor(rnd() * 2.2);
      for (let k = 0; k < n; k++) add(x + r(-0.04, 0.04), rz + s * r(RIVER_HALF + 0.14, RIVER_HALF + 0.75), r(0.8, 1.3), rnd() < 0.18);
    }
  }
  // эх үүсвэрийн хамгаалалтын бүсийн ойн зурвас
  const sz = SOURCE_ZONE;
  for (let x = sz.x0; x < sz.x1; x += 0.11) {
    add(x, sz.z0 - r(0.02, 0.12), r(0.85, 1.2), rnd() < 0.35);
    add(x, sz.z1 + r(0.03, 0.14), r(0.85, 1.2), rnd() < 0.35);
  }
  // цэвэрлэх байгууламжийн хамгаалалтын мод
  const pp = PLANT.pad;
  for (let x = pp.x0 - 0.15; x < pp.x1 + 0.15; x += 0.1) add(x, pp.z1 + 0.12, r(0.8, 1.05), false);
  for (let z = pp.z0; z < pp.z1 + 0.1; z += 0.1) add(pp.x0 - 0.14, z, r(0.8, 1.05), false);
  // хөдөө: бөөгнөрсөн мод, толгод дээр шилмүүст
  for (let k = 0; k < 400; k++) {
    const cx = r(-17, 17);
    const cz = r(-11, 9.5);
    const inCore = cx > CORE.x0 - 0.3 && cx < CORE.x1 + 0.3 && cz > CORE.z0 && cz < CORE.z1 + 0.3;
    if (inCore && rnd() < 0.85) continue;
    const hill = terrainHeight(cx, cz) > 0.25;
    const n = 2 + Math.floor(rnd() * 5);
    for (let j = 0; j < n; j++) add(cx + r(-0.25, 0.25), cz + r(-0.25, 0.25), r(0.8, 1.4), hill ? rnd() < 0.7 : rnd() < 0.2);
  }
  return out;
}
