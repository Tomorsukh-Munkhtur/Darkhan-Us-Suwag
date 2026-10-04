import { seeded } from "@/lib/seeded";
import {
  BILEG_MOUND,
  BUDDHA_HILL,
  CORE,
  districtLots,
  DISTRICTS,
  FOOTBRIDGE,
  GER_AREAS,
  HIGHWAY,
  HIGHWAY_LANES,
  moundHeight,
  MORIN_KHUUR,
  nearestCleanD,
  OVOO_HILL,
  PIPES,
  PLANT,
  PUMPS,
  railZ,
  RESERVED,
  RESERVOIRS,
  RIVER_HALF,
  riverAt,
  riverDist,
  ROUNDABOUT,
  SOURCE_ZONE,
  terrainHeight,
  WELLS,
  type Network,
  type Rect,
} from "./layout";
import { clipToCore, inRoundabout, roadClearance, type RoadLayout } from "./world";
import { civicKeepOut, civicTrees } from "./civic";

export { districtLots, type Rect } from "./layout";

/**
 * Барилга (instanced) ба модны байрлалын генератор. Детерминистик (seeded) — SSR/клиент, түвшин бүрт ижил дараалал;
 * density нь зөвхөн тоог багасгана.
 */
export const FLOOR_H = 0.024;
/** 0 — хуучин панель байр, 1 — шинэ олон давхар, 2 — үйлдвэр, 3 — нийтийн (сургууль, цэцэрлэг), 4 — дээврийн төхөөрөмж */
export type BuildingKind = 0 | 1 | 2 | 3 | 4;
export type Building = {
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
  rot: boolean;
  kind: BuildingKind;
  seed: number;
  dist: number;
  district: number;
  /** суурийн өндөр (дээврийн төхөөрөмж — эх барилгын дээвэр) */
  y?: number;
  /** өргөн чөлөөний дагуух доод давхрын дэлгүүр */
  shop?: boolean;
};
const overlaps = (r: Rect, list: Rect[], m: number) => list.some((q) => r.x0 < q.x1 + m && r.x1 > q.x0 - m && r.z0 < q.z1 + m && r.z1 > q.z0 - m);
const footprint = (b: Building): Rect => {
  const hx = (b.rot ? b.d : b.w) / 2;
  const hz = (b.rot ? b.w : b.d) / 2;
  return { x0: b.x - hx, x1: b.x + hx, z0: b.z - hz, z1: b.z + hz };
};

export function generateBuildings(net: Network, layout: RoadLayout) {
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
        if (overlaps(fp, placed, 0.035) || overlaps(fp, RESERVED, 0.01)) return false;
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
      // хөндлөн байр: хоёр эгнээний хооронд (жижиг хашаанд богино байр — хаалттай хороолол)
      const runZ = (x: number) => {
        const zEnd = lot.z1 - setback - depth - 0.038;
        let z = lot.z0 + setback + depth + 0.038 + r(0, 0.02);
        while (zEnd - z >= 0.16) {
          const len = Math.min(r(0.2, 0.52), zEnd - z);
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
  // өргөн чөлөөний дагуух орон сууцны доод давхарт дэлгүүр
  const avenues = layout.pieces.filter((p) => p.major);
  for (const b of out) {
    if (b.kind > 1) continue;
    b.shop = avenues.some((p) => {
      const along = p.horizontal ? b.x : b.z;
      const across = p.horizontal ? b.z : b.x;
      return along > p.a - 0.05 && along < p.b + 0.05 && Math.abs(across - p.c) < p.w / 2 + 0.2;
    });
  }
  // дээврийн төхөөрөмж: лифтний машин өрөө, агааржуулалт (үйлдвэрт — дээврийн гэрэлтүүлэгч, сэнс)
  const rr = seeded(4242);
  const roofs: Building[] = [];
  for (const b of out) {
    const n = b.kind === 1 ? 2 + Math.round(rr()) : b.kind === 2 ? 2 + Math.round(rr() * 2) : 1 + Math.round(rr() * 0.7);
    for (let k = 0; k < n; k++) {
      const w = b.kind === 2 ? 0.03 + rr() * 0.04 : 0.022 + rr() * 0.016;
      const d = b.kind === 2 ? 0.02 + rr() * 0.02 : 0.016 + rr() * 0.014;
      const la = (rr() - 0.5) * Math.max(b.w - w - 0.04, 0);
      const lc = (rr() - 0.5) * Math.max(b.d - d - 0.03, 0);
      const x = b.x + (b.rot ? lc : la);
      const z = b.z + (b.rot ? -la : lc);
      roofs.push({ x, z, y: b.h, w, d, h: b.kind === 2 ? 0.008 + rr() * 0.006 : 0.011 + rr() * 0.01, rot: b.rot, kind: 4, seed: rr(), dist: b.dist, district: b.district });
    }
  }
  return [...out, ...roofs];
}

// ---------------------------------------------------------------------------------------------
// Машин: гудамжинд зогсоол, өргөн чөлөөнд явж буй (баруун гар талын хөдөлгөөн, урд/хойд гэрэлтэй). Статик байрлал.

export type Car = { x: number; z: number; rot: number; moving: boolean; tint: number };

export function generateCars(layout: RoadLayout, density: number) {
  const rnd = seeded(5150);
  const out: Car[] = [];
  for (const p of layout.pieces) {
    const span = clipToCore(p);
    if (!span) continue;
    const [a, b] = [span[0] + (p.ja ? 0.07 : 0.02), span[1] - (p.jb ? 0.07 : 0.02)];
    if (b - a < 0.05) continue;
    const put = (t: number, off: number, dir: number, moving: boolean) => {
      if (rnd() > density) return;
      const x = p.horizontal ? t : p.c + off;
      const z = p.horizontal ? p.c + off : t;
      if (inRoundabout(x, z, 0.02)) return;
      // орон нутгийн +x урагш: хэвтээ зам — ±x, босоо — ±z
      const rot = p.horizontal ? (dir > 0 ? 0 : Math.PI) : dir > 0 ? -Math.PI / 2 : Math.PI / 2;
      out.push({ x, z, rot, moving, tint: rnd() });
    };
    // хорооллын гудамж (зогсоолтой) / хорооллоос гадуурх зам (цөөн, зөвхөн явж буй)
    const mid = (a + b) / 2;
    const [mx, mz] = p.horizontal ? [mid, p.c] : [p.c, mid];
    const urban = DISTRICTS.some((d) => mx > d.xs[0] - 0.05 && mx < d.xs[d.xs.length - 1] + 0.05 && mz > d.ys[0] - 0.05 && mz < d.ys[d.ys.length - 1] + 0.05);
    if (p.highway) {
      // хоёр урсгал, тус бүр 2 эгнээ (баруун гар талын хөдөлгөөн)
      for (const lane of HIGHWAY_LANES.flatMap((l) => [-l, l])) {
        const dir = p.horizontal ? (lane > 0 ? 1 : -1) : lane > 0 ? -1 : 1;
        for (let t = a + rnd() * 0.1; t < b; t += 0.08 + rnd() * 0.16) if (rnd() < 0.3) put(t, lane, dir, true);
      }
    } else if (p.major) {
      const pMove = urban ? 0.34 : 0.16;
      for (const lane of [-0.054, -0.02, 0.02, 0.054]) {
        const dir = p.horizontal ? (lane > 0 ? 1 : -1) : lane > 0 ? -1 : 1;
        for (let t = a + rnd() * 0.1; t < b; t += 0.08 + rnd() * 0.18) if (rnd() < pMove) put(t, lane, dir, true);
      }
    } else {
      for (const side of [-1, 1]) {
        if (urban) for (let t = a; t < b; t += 0.034) if (rnd() < 0.36) put(t + rnd() * 0.004, side * (p.w / 2 - 0.013), rnd() < 0.5 ? 1 : -1, false);
        const dir = p.horizontal ? side : -side;
        for (let t = a + rnd() * 0.2; t < b; t += 0.2 + rnd() * 0.3) if (rnd() < (urban ? 0.35 : 0.1)) put(t, side * 0.018, dir, true);
      }
    }
  }
  // тойрог дээрх машин: цагийн зүүний эсрэг (дээрээс харахад) — өнцөг буурах чиглэлд
  const { c, rIn, rOut } = ROUNDABOUT;
  for (const [rr, n] of [
    [rIn + (rOut - rIn) * 0.3, 3],
    [rIn + (rOut - rIn) * 0.7, 4],
  ] as const) {
    for (let k = 0; k < n; k++) {
      if (rnd() > density) continue;
      const ang = (k / n) * Math.PI * 2 + rnd() * 0.8;
      out.push({ x: c[0] + Math.cos(ang) * rr, z: c[1] + Math.sin(ang) * rr, rot: Math.atan2(Math.cos(ang), Math.sin(ang)), moving: true, tint: rnd() });
    }
  }
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
  const fb = FOOTBRIDGE;
  const inRect = (x: number, z: number, q: Rect, m = 0) => x > q.x0 - m && x < q.x1 + m && z > q.z0 - m && z < q.z1 + m;
  /** Дурсгалт газрын талбай (оройн тавцан, шат, гүүр, байр, цогцолбор, тойргийн арал, нийтийн барилгын хашаа, төмөр зам) */
  const landmark = (x: number, z: number) => {
    const bh = BUDDHA_HILL;
    if (Math.hypot(x - bh.x, z - bh.z) < 0.17 || (Math.abs(x - (bh.x - 0.1)) < 0.06 && z > bh.z && z < bh.z + bh.r + 0.03)) return true;
    const bm = BILEG_MOUND;
    if (Math.hypot(x - bm.x, z - bm.z) < 0.1 || (Math.abs(x - bm.x) < 0.05 && z > bm.z && z < bm.z + bm.r + 0.03)) return true;
    if (Math.hypot(x - MORIN_KHUUR.x, z - MORIN_KHUUR.z) < MORIN_KHUUR.r + 0.06) return true;
    if (Math.abs(x - fb.x) < 0.07 && z > fb.z0 - 0.05 && z < fb.z1 + fb.stairs + 0.05) return true;
    if (Math.hypot(x - OVOO_HILL.x, z - OVOO_HILL.z) < 0.1) return true;
    if (Math.abs(z - railZ(x)) < 0.12) return true;
    if (RESERVED.some((q) => inRect(x, z, q))) return true;
    if (civicKeepOut(x, z)) return true;
    return Math.hypot(x - ROUNDABOUT.c[0], z - ROUNDABOUT.c[1]) < ROUNDABOUT.rOut + 0.03;
  };
  const blocked = (x: number, z: number, m = 0.035, road = true) => {
    if (riverDist(x, z) < RIVER_HALF + 0.12) return true;
    if (road && roadClearance(layout, x, z) < 0.05) return true;
    if (landmark(x, z)) return true;
    if (fps.some((q) => x > q.x0 - m && x < q.x1 + m && z > q.z0 - m && z < q.z1 + m)) return true;
    if (pipeDist(x, z) < 0.06) return true;
    if (WELLS.some(([wx, wz]) => Math.hypot(x - wx, z - wz) < 0.2)) return true;
    if (PUMPS.some(([px, pz]) => Math.hypot(x - px, z - pz) < 0.32)) return true;
    if (RESERVOIRS.some((t) => Math.hypot(x - t.c[0], z - t.c[1]) < t.r + 0.12)) return true;
    if (GER_AREAS.some((q) => inRect(x, z, q, 0.02)) && rnd() < 0.85) return true;
    const pp = PLANT.pad;
    if (x > pp.x0 - 0.05 && x < pp.x1 + 0.05 && z > pp.z0 - 0.05 && z < pp.z1 + 0.05) return true;
    return false;
  };
  const add = (x: number, z: number, s: number, conifer: boolean, road = true) => {
    if (rnd() > density) return;
    if (blocked(x, z, 0.035, road)) return;
    out.push({ x, y: terrainHeight(x, z) + moundHeight(x, z), z, s, conifer, tint: rnd() });
  };

  // хашааны мод
  DISTRICTS.forEach((d) => {
    if (d.id === "ind") return;
    for (const lot of districtLots(d)) {
      const n = Math.round((lot.x1 - lot.x0) * (lot.z1 - lot.z0) * 14);
      for (let k = 0; k < n; k++) add(r(lot.x0, lot.x1), r(lot.z0, lot.z1), r(0.75, 1.15), false);
    }
  });
  // хоёр урсгалтай зам: тусгаарлагч ба хоёр талын зурвасын мод (хотын хүрээнд, уулзвар/гүүрнээс зайтай)
  const nearCrossing = (x: number, z: number) => layout.crossings.some((c) => Math.abs(x - c.x) < c.wx / 2 + 0.03 && Math.abs(z - c.z) < c.wz / 2 + 0.05);
  for (const p of layout.pieces) {
    const span = p.highway ? clipToCore(p) : null;
    if (!span) continue;
    for (const [off, step] of [
      [0, 0.075],
      [-(HIGHWAY.carriage + HIGHWAY.strip) / 2, 0.09],
      [(HIGHWAY.carriage + HIGHWAY.strip) / 2, 0.09],
    ] as const)
      for (let t = span[0] + 0.05 + rnd() * 0.03; t < span[1] - 0.05; t += step) {
        const x = p.horizontal ? t : p.c + off;
        const z = p.horizontal ? p.c + off : t;
        if (nearCrossing(x, z) || inRoundabout(x, z, 0.06)) continue;
        add(x, z, off === 0 ? r(0.62, 0.78) : r(0.66, 0.84), false, false);
      }
  }
  // Бурхантай уул, Билэг тэмдэг, Дархан овоогийн толгодын энгэрийн мод
  for (const [m, n] of [
    [BUDDHA_HILL, 46],
    [BILEG_MOUND, 8],
    [OVOO_HILL, 22],
  ] as const)
    for (let k = 0; k < n; k++) {
      const a = rnd() * Math.PI * 2;
      const q = r(0.42, 0.95);
      add(m.x + Math.cos(a) * m.r * q, m.z + Math.sin(a) * m.r * q, r(0.7, 1.0), rnd() < 0.45);
    }
  // тойргийн арал дээрх бут
  for (let k = 0; k < 4; k++) {
    const a = Math.PI / 4 + (k * Math.PI) / 2;
    out.push({ x: ROUNDABOUT.c[0] + Math.cos(a) * 0.255, y: 0.0085, z: ROUNDABOUT.c[1] + Math.sin(a) * 0.255, s: 0.55, conifer: true, tint: rnd() });
  }
  // нийтийн байгууламж, цэцэрлэгт хүрээлэнгийн мод (civic.ts тодорхойлно)
  for (const t of civicTrees()) {
    if (rnd() > Math.max(density, 0.6)) continue;
    out.push({ x: t.x, y: terrainHeight(t.x, t.z) + moundHeight(t.x, t.z), z: t.z, s: t.s, conifer: t.conifer, tint: rnd() });
  }
  // өргөн чөлөөний дагуух мод
  for (const p of layout.pieces) {
    if (!p.major || p.highway) continue;
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
