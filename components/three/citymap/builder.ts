import * as THREE from "three";
import type { Caster } from "./shadows";

/**
 * Байгууламж / дурсгалт газрын geometry цуглуулагч ба хэлбэрийн туслахууд. Материал бүрт нэг merged geometry:
 *  body    — бетон, металл, будсан хана (aColor, aMat, aZone — онцлох бүсийн индекс)
 *  lights  — цонх, гэрэл, фланцын гэрэлт цагираг (aColor, aKey — аль төлөвөөр асах)
 *  water   — усан сан, тунгаагуур, агааржуулах сав, усан толь (aKind)
 *  decals  — газрын гэрэлт цагираг, бүсийн хүрээ (aKind, aKey, uv)
 */
export type V3 = [number, number, number];

export const ZONE = { source: 0, pump: 1, reservoir: 2, city: 3, plant: 4, repair: 5 } as const;
/** body shader-ийн гадаргуу */
export const FMAT = { concrete: 0, metal: 1, darkMetal: 2, paint: 3, roof: 4, grating: 5, inner: 6, alert: 7, gold: 8, grass: 9, bronze: 10, stone: 11 } as const;
/** гэрлийн түлхүүр (uLit[]) */
export const KEY = { service: 0, wells: 1, pump1: 2, pump2: 3, reservoir: 4, plant: 5, repair: 6, industry: 7 } as const;
export const KEYS = 8;

function prep(g: THREE.BufferGeometry, keep: string[] = ["position", "normal"]) {
  const out = g.index ? g.toNonIndexed() : g;
  if (out !== g) g.dispose();
  for (const name of Object.keys(out.attributes)) if (!keep.includes(name)) out.deleteAttribute(name);
  return out;
}
function fill(g: THREE.BufferGeometry, name: string, value: number | readonly number[]) {
  const n = g.attributes.position.count;
  const size = typeof value === "number" ? 1 : value.length;
  const arr = new Float32Array(n * size);
  for (let i = 0; i < n; i++) {
    if (typeof value === "number") arr[i] = value;
    else for (let k = 0; k < size; k++) arr[i * size + k] = value[k];
  }
  g.setAttribute(name, new THREE.BufferAttribute(arr, size));
  return g;
}
const rgb = (hex: string): V3 => {
  const c = new THREE.Color(hex);
  return [c.r, c.g, c.b];
};

export class Builder {
  body: THREE.BufferGeometry[] = [];
  lights: THREE.BufferGeometry[] = [];
  water: THREE.BufferGeometry[] = [];
  decals: THREE.BufferGeometry[] = [];
  shadows: Caster[] = [];
  shadowRect(cx: number, cz: number, hx: number, hz: number, h: number, k = 1, rot = 0) {
    this.shadows.push({ kind: 0, cx, cz, hx, hz, rot, h, k });
  }
  shadowCircle(cx: number, cz: number, r: number, h: number, k = 1) {
    this.shadows.push({ kind: 1, cx, cz, r, h, k });
  }
  add(g: THREE.BufferGeometry, color: string, mat: number, zone: number) {
    const o = prep(g);
    fill(o, "aColor", rgb(color));
    fill(o, "aMat", mat);
    fill(o, "aZone", zone);
    this.body.push(o);
  }
  light(g: THREE.BufferGeometry, color: string, key: number) {
    const o = prep(g);
    fill(o, "aColor", rgb(color));
    fill(o, "aKey", key);
    this.lights.push(o);
  }
  /** ref — усан сангийн төв (x, z) ба радиус: долгионы цагираг сан бүрийн төвөөс */
  pool(g: THREE.BufferGeometry, kind: number, ref: readonly [number, number, number] = [0, 0, 1]) {
    const o = prep(g, ["position"]);
    fill(o, "aKind", kind);
    fill(o, "aRef", ref);
    this.water.push(o);
  }
  /** Газрын тэмдэглэгээ: (x, z) төвтэй size×size quad; kind 0 — цагираг, 1 — тэгш өнцөгт хүрээ (ratio = өргөн/урт) */
  decal(x: number, z: number, sx: number, sz: number, kind: number, key: number, y = 0.014) {
    const g = new THREE.PlaneGeometry(sx, sz).rotateX(-Math.PI / 2).translate(x, y, z);
    const o = prep(g, ["position", "uv"]);
    fill(o, "aKind", kind);
    fill(o, "aKey", key);
    fill(o, "aSize", [sx, sz]);
    this.decals.push(o);
  }
}

export const box = (w: number, h: number, d: number, x: number, y: number, z: number) => new THREE.BoxGeometry(w, h, d).translate(x, y + h / 2, z);
export const cyl = (rt: number, rb: number, h: number, x: number, y: number, z: number, seg = 20, open = false) =>
  new THREE.CylinderGeometry(rt, rb, h, seg, 1, open).translate(x, y + h / 2, z);

/** Хэвтээ хоолойн хэрчим (a → b, өндөр y) */
export const pipeSeg = (ax: number, az: number, bx: number, bz: number, y: number, r: number, seg = 10) => {
  const L = Math.hypot(bx - ax, bz - az);
  return new THREE.CylinderGeometry(r, r, L, seg, 1, true)
    .rotateZ(Math.PI / 2)
    .rotateY(Math.atan2(-(bz - az), bx - ax))
    .translate((ax + bx) / 2, y, (az + bz) / 2);
};

/** Дурын хоёр цэгийг холбосон нарийн цилиндр (татлага, шон) */
export const rod = (a: V3, b: V3, r: number, seg = 5) => {
  const va = new THREE.Vector3(...a);
  const vb = new THREE.Vector3(...b);
  const dir = vb.clone().sub(va);
  const g = new THREE.CylinderGeometry(r, r, dir.length(), seg, 1, true);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize()));
  return g.translate((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
};

/** Бага налуутай хоёр талт төмөр дээвэр (нуруу нь x-ийн дагуу, суурь y) */
export function gable(w: number, d: number, rise: number, x: number, y: number, z: number) {
  const W = w / 2;
  const D = d / 2;
  const v = [
    -W, 0, D, W, 0, D, W, rise, 0, -W, 0, D, W, rise, 0, -W, rise, 0,
    W, 0, -D, -W, 0, -D, -W, rise, 0, W, 0, -D, -W, rise, 0, W, rise, 0,
    W, 0, D, W, 0, -D, W, rise, 0, -W, 0, -D, -W, 0, D, -W, rise, 0,
  ];
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(v, 3));
  g.computeVertexNormals();
  return g.translate(x, y, z);
}

/** Тэгш өнцөгт хашаа (багана + дээд төмөр) */
export function fence(b: Builder, x0: number, z0: number, x1: number, z1: number, zone: number, H = 0.03, color = "#8796a3") {
  for (const [ax, az, bx, bz] of [
    [x0, z0, x1, z0],
    [x1, z0, x1, z1],
    [x1, z1, x0, z1],
    [x0, z1, x0, z0],
  ]) {
    const L = Math.hypot(bx - ax, bz - az);
    const n = Math.max(1, Math.round(L / 0.15));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      b.add(box(0.005, H, 0.005, ax + (bx - ax) * t, 0, az + (bz - az) * t), color, FMAT.metal, zone);
    }
    const horiz = Math.abs(bz - az) < 1e-6;
    b.add(box(horiz ? L : 0.0035, 0.0035, horiz ? 0.0035 : L, (ax + bx) / 2, H - 0.0035, (az + bz) / 2), color, FMAT.metal, zone);
  }
}

/** Хэвтээ цагираг (фланц, хашлагын дээд төмөр) */
export const ringH = (r: number, tube: number, x: number, y: number, z: number, seg = 32) => new THREE.TorusGeometry(r, tube, 4, seg).rotateX(Math.PI / 2).translate(x, y, z);
