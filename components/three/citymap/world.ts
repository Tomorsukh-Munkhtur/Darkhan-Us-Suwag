import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { CORE, RIVER, riverDist, ROADS, roadY, terrainHeight, type P2, type Road } from "./layout";

/**
 * Газар, гол, замын geometry. Бүгд нэг материалд нэг geometry (draw call цөөн).
 */

// ---------------------------------------------------------------------------------------------
// Газар

export const TERRAIN = { x0: -19, x1: 19, z0: -12.5, z1: 10.5 } as const;

export function terrainGeometry(segX: number, segZ: number) {
  const w = TERRAIN.x1 - TERRAIN.x0;
  const d = TERRAIN.z1 - TERRAIN.z0;
  const g = new THREE.PlaneGeometry(w, d, segX, segZ).rotateX(-Math.PI / 2).translate((TERRAIN.x0 + TERRAIN.x1) / 2, 0, (TERRAIN.z0 + TERRAIN.z1) / 2);
  const pos = g.attributes.position;
  const river = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i++) {
    pos.setY(i, terrainHeight(pos.getX(i), pos.getZ(i)));
    river[i] = riverDist(pos.getX(i), pos.getZ(i));
  }
  g.setAttribute("aRiver", new THREE.BufferAttribute(river, 1));
  g.computeVertexNormals();
  g.deleteAttribute("uv");
  return g;
}

// ---------------------------------------------------------------------------------------------
// Гол: төв шугамын дагуух тууз (ирмэг нь эргийн газар доор нуугдана). uv.x — урсгалын дагуух зай, uv.y — хөндлөн 0..1

export const RIVER_SURFACE_Y = -0.035;
export const RIVER_RIBBON_HALF = 0.4;

export function riverGeometry() {
  const pts = RIVER.filter(([x]) => x > TERRAIN.x0 - 1 && x < TERRAIN.x1 + 1);
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x, z] = pts[i];
    const [xa, za] = pts[Math.max(0, i - 1)];
    const [xb, zb] = pts[Math.min(pts.length - 1, i + 1)];
    const tx = xb - xa;
    const tz = zb - za;
    const l = Math.hypot(tx, tz);
    const nx = -tz / l;
    const nz = tx / l;
    if (i > 0) s += Math.hypot(x - pts[i - 1][0], z - pts[i - 1][1]);
    pos.push(x - nx * RIVER_RIBBON_HALF, RIVER_SURFACE_Y, z - nz * RIVER_RIBBON_HALF, x + nx * RIVER_RIBBON_HALF, RIVER_SURFACE_Y, z + nz * RIVER_RIBBON_HALF);
    uv.push(s, 0, s, 1);
    if (i < pts.length - 1) {
      const a = i * 2;
      // дээрээс харахад урд тал (normal +y)
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

// ---------------------------------------------------------------------------------------------
// Зам: уулзварыг тооцоолж хэрчмүүдийг хуваана (уулзвар дээр тэмдэглэгээгүй дөрвөлжин, ирмэгт нь явган хүний гарц)

type Crossing = { x: number; z: number; wx: number; wz: number };
export type RoadPiece = { horizontal: boolean; c: number; a: number; b: number; w: number; major: boolean; ja: boolean; jb: boolean };

const isH = (r: Road) => Math.abs(r.a[1] - r.b[1]) < 1e-6;

export function roadLayout() {
  const H = ROADS.filter(isH).map((r) => ({ r, c: r.a[1], lo: Math.min(r.a[0], r.b[0]), hi: Math.max(r.a[0], r.b[0]) }));
  const V = ROADS.filter((r) => !isH(r)).map((r) => ({ r, c: r.a[0], lo: Math.min(r.a[1], r.b[1]), hi: Math.max(r.a[1], r.b[1]) }));
  const eps = 1e-4;
  const crossings: Crossing[] = [];
  const addCrossing = (x: number, z: number, wx: number, wz: number) => {
    const ex = crossings.find((c) => Math.abs(c.x - x) < 0.01 && Math.abs(c.z - z) < 0.01);
    if (ex) {
      ex.wx = Math.max(ex.wx, wx);
      ex.wz = Math.max(ex.wz, wz);
    } else crossings.push({ x, z, wx, wz });
  };
  for (const h of H)
    for (const v of V)
      if (v.c >= h.lo - eps && v.c <= h.hi + eps && h.c >= v.lo - eps && h.c <= v.hi + eps) addCrossing(v.c, h.c, v.r.w, h.r.w);

  // хэрчим бүрийг уулзваруудаар хувааж, уулзварын хагас өргөнөөр тайрна
  const pieces: RoadPiece[] = [];
  const split = (horizontal: boolean, c: number, lo: number, hi: number, w: number, major: boolean) => {
    const cuts = crossings
      .filter((k) => (horizontal ? Math.abs(k.z - c) < 0.01 && k.x >= lo - eps && k.x <= hi + eps : Math.abs(k.x - c) < 0.01 && k.z >= lo - eps && k.z <= hi + eps))
      .map((k) => ({ t: horizontal ? k.x : k.z, half: (horizontal ? k.wx : k.wz) / 2 }))
      .sort((p, q) => p.t - q.t);
    const stops = [{ t: lo, half: 0, j: false }, ...cuts.map((k) => ({ ...k, j: true })), { t: hi, half: 0, j: false }];
    for (let i = 0; i < stops.length - 1; i++) {
      const s0 = stops[i];
      const s1 = stops[i + 1];
      const a = s0.t + s0.half;
      const b = s1.t - s1.half;
      if (b - a > 0.02) pieces.push({ horizontal, c, a, b, w, major, ja: s0.j, jb: s1.j });
    }
  };
  for (const h of H) split(true, h.c, h.lo, h.hi, h.r.w, h.r.major);
  for (const v of V) split(false, v.c, v.lo, v.hi, v.r.w, v.r.major);
  return { pieces, crossings };
}

export type RoadLayout = ReturnType<typeof roadLayout>;

/**
 * Замын гадаргуу: хэрчим ба уулзварын дөрвөлжин. Атрибут: aRoad (x — урт тэнхлэгийн дэлхийн координат,
 * y — хөндлөн −1..1, z — өргөн, w — major), aEnds (start/end хүртэлх зай; уулзвар биш бол их утга), aKind (0 хэрчим, 1 уулзвар).
 */
export function roadGeometry(layout: RoadLayout) {
  const pos: number[] = [];
  const road: number[] = [];
  const ends: number[] = [];
  const kind: number[] = [];
  const quad = (corners: number[][], attrs: number[][], e: number[][], k: number) => {
    for (const i of [0, 1, 2, 0, 2, 3]) {
      pos.push(corners[i][0], roadY(corners[i][0], corners[i][1]), corners[i][1]);
      road.push(...attrs[i]);
      ends.push(...e[i]);
      kind.push(k);
    }
  };
  for (const p of layout.pieces) {
    const h = p.w / 2;
    const m = p.major ? 1 : 0;
    const len = p.b - p.a;
    // урт хэрчмийг хувааж газрын гадаргууг дагуулна (хотоос гадна толгод, гол дээр гүүр)
    const n = Math.max(1, Math.ceil(len / 0.25));
    const endA = (t: number) => (p.ja ? t - p.a : 99);
    const endB = (t: number) => (p.jb ? p.b - t : 99);
    for (let k = 0; k < n; k++) {
      const t0 = p.a + (len * k) / n;
      const t1 = p.a + (len * (k + 1)) / n;
      const attrs = [
        [t0, -1, p.w, m],
        [t1, -1, p.w, m],
        [t1, 1, p.w, m],
        [t0, 1, p.w, m],
      ];
      const e = [
        [endA(t0), endB(t0)],
        [endA(t1), endB(t1)],
        [endA(t1), endB(t1)],
        [endA(t0), endB(t0)],
      ];
      const corners = p.horizontal
        ? [
            [t0, p.c - h],
            [t1, p.c - h],
            [t1, p.c + h],
            [t0, p.c + h],
          ]
        : [
            [p.c + h, t0],
            [p.c + h, t1],
            [p.c - h, t1],
            [p.c - h, t0],
          ];
      quad(corners, attrs, e, 0);
    }
  }
  for (const c of layout.crossings) {
    const hx = c.wx / 2;
    const hz = c.wz / 2;
    const zero = [0, 0, 0, 0];
    const far = [99, 99];
    quad(
      [
        [c.x - hx, c.z - hz],
        [c.x + hx, c.z - hz],
        [c.x + hx, c.z + hz],
        [c.x - hx, c.z + hz],
      ],
      [zero, zero, zero, zero],
      [far, far, far, far],
      1,
    );
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("aRoad", new THREE.Float32BufferAttribute(road, 4));
  g.setAttribute("aEnds", new THREE.Float32BufferAttribute(ends, 2));
  g.setAttribute("aKind", new THREE.Float32BufferAttribute(kind, 1));
  return g;
}

/** Хэрчмийг хотын хүрээнд тайрна (явган зам, гудамжны гэрэл зөвхөн хотод) */
export function clipToCore(p: RoadPiece): [number, number] | null {
  const [lo, hi, cLo, cHi] = p.horizontal ? [CORE.x0, CORE.x1, CORE.z0, CORE.z1] : [CORE.z0, CORE.z1, CORE.x0, CORE.x1];
  if (p.c < cLo || p.c > cHi) return null;
  const a = Math.max(p.a, lo);
  const b = Math.min(p.b, hi);
  return b - a > 0.04 ? [a, b] : null;
}

/** Явган зам + хашлага (замын хоёр талын бага зэрэг өндөр зурвас) — нэг geometry */
export function sidewalkGeometry(layout: RoadLayout) {
  const parts: THREE.BufferGeometry[] = [];
  const SW = 0.034;
  const SH = 0.012;
  for (const p of layout.pieces) {
    const span = clipToCore(p);
    if (!span) continue;
    const len = span[1] - span[0];
    const mid = (span[0] + span[1]) / 2;
    for (const s of [-1, 1]) {
      const off = s * (p.w / 2 + SW / 2);
      const g = p.horizontal
        ? new THREE.BoxGeometry(len, SH, SW).translate(mid, SH / 2, p.c + off)
        : new THREE.BoxGeometry(SW, SH, len).translate(p.c + off, SH / 2, mid);
      g.deleteAttribute("uv");
      parts.push(g);
    }
  }
  const merged = mergeGeometries(parts, false)!;
  parts.forEach((g) => g.dispose());
  return merged;
}

/** Гудамжны гэрлийн байрлал: хэрчмийн дагуу ~0.42 тутамд, ээлжлэн хоёр талд (уулзвараас зайтай) */
export function streetLightSpots(layout: RoadLayout, step: number) {
  const out: { x: number; z: number; rot: number; road: P2 }[] = [];
  for (const p of layout.pieces) {
    const span = clipToCore(p);
    if (!span) continue;
    const len = span[1] - span[0];
    if (len < 0.25) continue;
    const n = Math.max(1, Math.floor(len / step));
    for (let i = 0; i < n; i++) {
      const t = span[0] + ((i + 0.5) / n) * len;
      const side = (i + Math.round(p.c * 7)) % 2 === 0 ? 1 : -1;
      const off = side * (p.w / 2 + 0.03);
      if (p.horizontal) out.push({ x: t, z: p.c + off, rot: side > 0 ? Math.PI : 0, road: [t, p.c] });
      else out.push({ x: p.c + off, z: t, rot: side > 0 ? -Math.PI / 2 : Math.PI / 2, road: [p.c, t] });
    }
  }
  return out;
}

/** Цэгээс хамгийн ойрын замын төв хүртэлх зай − хагас өргөн (замын гадна талд эерэг) */
export function roadClearance(layout: RoadLayout, x: number, z: number) {
  let best = Infinity;
  for (const p of layout.pieces) {
    const along = p.horizontal ? x : z;
    const across = p.horizontal ? z : x;
    const da = along < p.a ? p.a - along : along > p.b ? along - p.b : 0;
    const dc = Math.abs(across - p.c) - p.w / 2;
    best = Math.min(best, Math.max(da, dc));
  }
  for (const c of layout.crossings) best = Math.min(best, Math.max(Math.abs(x - c.x) - c.wx / 2, Math.abs(z - c.z) - c.wz / 2));
  return best;
}
