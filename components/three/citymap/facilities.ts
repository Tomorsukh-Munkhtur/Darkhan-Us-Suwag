import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { seeded } from "@/lib/seeded";
import { BRIDGE, DISTRICTS, PLANT, PUMPS, RESERVOIR, SOURCE_ZONE, toW, WELLS, type P2 } from "./layout";
import type { Caster } from "./shadows";
import { districtLots, type Building } from "./city";

/**
 * Байгууламжуудын geometry. Материал бүрт нэг merged geometry:
 *  body    — бетон, металл, будсан хана (aColor, aMat, aZone — онцлох бүсийн индекс)
 *  lights  — цонх, гэрэл, фланцын гэрэлт цагираг (aColor, aKey — аль төлөвөөр асах)
 *  water   — усан сан, тунгаагуур, агааржуулах сав (aKind)
 *  decals  — газрын гэрэлт цагираг, бүсийн хүрээ (aKind, aKey, uv)
 */
type V3 = [number, number, number];

export const ZONE = { source: 0, pump: 1, reservoir: 2, city: 3, plant: 4, repair: 5 } as const;
/** body shader-ийн гадаргуу */
export const FMAT = { concrete: 0, metal: 1, darkMetal: 2, paint: 3, roof: 4, grating: 5, inner: 6, alert: 7 } as const;
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

class Builder {
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
  pool(g: THREE.BufferGeometry, kind: number) {
    const o = prep(g, ["position"]);
    fill(o, "aKind", kind);
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

const box = (w: number, h: number, d: number, x: number, y: number, z: number) => new THREE.BoxGeometry(w, h, d).translate(x, y + h / 2, z);
const cyl = (rt: number, rb: number, h: number, x: number, y: number, z: number, seg = 20, open = false) =>
  new THREE.CylinderGeometry(rt, rb, h, seg, 1, open).translate(x, y + h / 2, z);

/** Хэвтээ хоолойн хэрчим (a → b, өндөр y) */
const pipeSeg = (ax: number, az: number, bx: number, bz: number, y: number, r: number, seg = 10) => {
  const L = Math.hypot(bx - ax, bz - az);
  return new THREE.CylinderGeometry(r, r, L, seg, 1, true)
    .rotateZ(Math.PI / 2)
    .rotateY(Math.atan2(-(bz - az), bx - ax))
    .translate((ax + bx) / 2, y, (az + bz) / 2);
};

/** Бага налуутай хоёр талт төмөр дээвэр (нуруу нь x-ийн дагуу, суурь y) */
function gable(w: number, d: number, rise: number, x: number, y: number, z: number) {
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
function fence(b: Builder, x0: number, z0: number, x1: number, z1: number, zone: number, H = 0.03) {
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
      b.add(box(0.005, H, 0.005, ax + (bx - ax) * t, 0, az + (bz - az) * t), "#8796a3", FMAT.metal, zone);
    }
    const horiz = Math.abs(bz - az) < 1e-6;
    b.add(box(horiz ? L : 0.0035, 0.0035, horiz ? 0.0035 : L, (ax + bx) / 2, H - 0.0035, (az + bz) / 2), "#8796a3", FMAT.metal, zone);
  }
}

/** Хэвтээ цагираг (фланц, хашлагын дээд төмөр) */
const ringH = (r: number, tube: number, x: number, y: number, z: number, seg = 32) => new THREE.TorusGeometry(r, tube, 4, seg).rotateX(Math.PI / 2).translate(x, y, z);

function wells(b: Builder) {
  for (const [x, z] of WELLS) {
    b.add(cyl(0.085, 0.09, 0.008, x, 0, z, 24), "#59636c", FMAT.concrete, ZONE.source);
    b.add(cyl(0.042, 0.042, 0.05, x, 0.008, z, 16), "#9fb2c2", FMAT.paint, ZONE.source);
    b.add(cyl(0.004, 0.056, 0.03, x, 0.058, z, 16), "#3a4652", FMAT.roof, ZONE.source);
    b.light(cyl(0.012, 0.012, 0.008, x, 0.088, z, 10), "#9fe6ff", KEY.wells);
    b.decal(x, z, 0.42, 0.42, 0, KEY.wells);
    b.shadowCircle(x, z, 0.045, 0.085, 0.9);
  }
  // ариун цэврийн хамгаалалтын бүсийн хашаа
  const { x0, x1, z0, z1 } = SOURCE_ZONE;
  const H = 0.035;
  for (const [ax, az, bx, bz] of [
    [x0, z0, x1, z0],
    [x1, z0, x1, z1],
    [x1, z1, x0, z1],
    [x0, z1, x0, z0],
  ]) {
    const L = Math.hypot(bx - ax, bz - az);
    const n = Math.round(L / 0.16);
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      b.add(box(0.006, H, 0.006, ax + (bx - ax) * t, 0, az + (bz - az) * t), "#8796a3", FMAT.metal, ZONE.source);
    }
    const horiz = Math.abs(bz - az) < 1e-6;
    b.add(box(horiz ? L : 0.004, 0.004, horiz ? 0.004 : L, (ax + bx) / 2, H - 0.004, (az + bz) / 2), "#8796a3", FMAT.metal, ZONE.source);
  }
  b.decal((x0 + x1) / 2, (z0 + z1) / 2, x1 - x0 + 0.1, z1 - z0 + 0.1, 1, KEY.wells, 0.012);
}

function pumpStation(b: Builder, [x, z]: P2, key: number, joints: P2[]) {
  const W = 0.34;
  const zone = ZONE.pump;
  const hz = z - W * 0.14;
  const D = W * 0.72;
  b.add(box(W + 0.06, 0.008, W + 0.06, x, 0, z), "#4a535c", FMAT.concrete, zone);
  // машин танхим: будсан хана, суурь, бага налуутай төмөр дээвэр, өнхрөх хаалга, агааржуулалтын сараалж
  b.add(box(W, 0.1, D, x, 0.008, hz), "#a3b1bd", FMAT.paint, zone);
  b.add(box(W + 0.006, 0.012, D + 0.006, x, 0.008, hz), "#6d7882", FMAT.concrete, zone);
  b.add(gable(W + 0.02, D + 0.02, 0.035, x, 0.108, hz), "#46525e", FMAT.roof, zone);
  b.add(new THREE.PlaneGeometry(0.07, 0.07).translate(x + 0.09, 0.043, hz + D / 2 + 0.002), "#5a6672", FMAT.grating, zone);
  for (const dz of [-0.06, 0.06]) b.add(new THREE.PlaneGeometry(0.035, 0.03).rotateY(-Math.PI / 2).translate(x - W / 2 - 0.002, 0.07, hz + dz), "#3c4650", FMAT.grating, zone);
  // хуваарилах байр (annex)
  b.add(box(W * 0.5, 0.07, W * 0.3, x - W * 0.22, 0.008, z + W * 0.3), "#909eab", FMAT.paint, zone);
  b.add(box(W * 0.5 + 0.01, 0.01, W * 0.3 + 0.01, x - W * 0.22, 0.078, z + W * 0.3), "#3a434c", FMAT.roof, zone);
  for (const dx of [-0.08, 0.06]) b.add(box(0.03, 0.02, 0.03, x + dx, 0.13, hz - D * 0.2), "#7a8692", FMAT.metal, zone);
  // оролтын коллектор: хэвтээ хоолой + босоо оролт + гар дугуйтай хаалт
  const my = 0.03;
  const mz = hz + D / 2 + 0.035;
  b.add(pipeSeg(x - W * 0.42, mz, x + W * 0.42, mz, my, 0.011), "#5d7f9a", FMAT.metal, zone);
  for (const dx of [-0.1, 0.0, 0.1]) {
    b.add(cyl(0.008, 0.008, my, x + dx, 0, mz, 8), "#5d7f9a", FMAT.metal, zone);
    b.add(pipeSeg(x + dx, mz, x + dx, hz + D / 2, my, 0.008, 8), "#5d7f9a", FMAT.metal, zone);
    b.add(ringH(0.012, 0.0025, x + dx, my + 0.022, mz, 14), "#c0453f", FMAT.metal, zone);
    b.add(cyl(0.002, 0.002, 0.022, x + dx, my, mz, 4), "#8796a3", FMAT.metal, zone);
  }
  // трансформатор, хашаа
  const tx = x + W * 0.36;
  const tz = z + W * 0.36;
  b.add(box(0.05, 0.05, 0.04, tx, 0, tz), "#56625c", FMAT.darkMetal, zone);
  fence(b, tx - 0.05, tz - 0.045, tx + 0.05, tz + 0.045, zone, 0.03);
  // дээд цонхны мөр (урд, баруун), хаалганы гэрэл
  for (const dx of [-0.12, -0.04, 0.04]) b.light(new THREE.PlaneGeometry(0.05, 0.018).translate(x + dx, 0.088, hz + D / 2 + 0.002), "#dff3ff", key);
  b.light(new THREE.PlaneGeometry(0.1, 0.018).rotateY(Math.PI / 2).translate(x + W / 2 + 0.002, 0.088, hz), "#dff3ff", key);
  b.light(box(0.02, 0.006, 0.01, x + 0.09, 0.09, hz + D / 2 + 0.006), "#fff0cf", KEY.service);
  b.light(box(0.016, 0.006, 0.01, x - W * 0.22, 0.066, z + W * 0.45 + 0.006), "#fff0cf", KEY.service);
  // оролт/гаралтын фланц — гэрэлтэх холбоос
  for (const [jx, jz] of joints) {
    b.add(cyl(0.05, 0.05, 0.016, jx, 0, jz, 16), "#4a535c", FMAT.concrete, zone);
    b.light(ringH(0.034, 0.008, jx, 0.045, jz, 20), "#7fe0ff", key);
  }
  b.decal(x, z, 0.86, 0.86, 0, key);
  b.shadowRect(x, hz, W / 2, D / 2, 0.14);
  b.shadowRect(x - W * 0.22, z + W * 0.3, W * 0.25, W * 0.15, 0.08);
}

function reservoir(b: Builder) {
  const [x, z] = RESERVOIR.c;
  const { r, h } = RESERVOIR;
  b.add(cyl(r + 0.06, r + 0.06, 0.006, x, 0, z, 48), "#4a535c", FMAT.concrete, ZONE.reservoir);
  b.add(cyl(r, r, h, x, 0, z, 64, true), "#8a959f", FMAT.concrete, ZONE.reservoir);
  b.add(cyl(r * 0.97, r * 0.97, h, x, 0, z, 64, true), "#3c464f", FMAT.inner, ZONE.reservoir);
  b.add(new THREE.RingGeometry(r * 0.6, r + 0.004, 64, 1).rotateX(-Math.PI / 2).translate(x, h, z), "#7d8892", FMAT.concrete, ZONE.reservoir);
  b.add(new THREE.CircleGeometry(r * 0.97, 48).rotateX(-Math.PI / 2).translate(x, 0.012, z), "#222a31", FMAT.inner, ZONE.reservoir);
  // хашлага, шат, хаалтын байр
  b.add(ringH(r + 0.002, 0.003, x, h + 0.04, z, 72), "#b3c0ca", FMAT.metal, ZONE.reservoir);
  b.add(ringH(r * 0.6, 0.003, x, h + 0.04, z, 48), "#b3c0ca", FMAT.metal, ZONE.reservoir);
  for (let k = 0; k < 24; k++) {
    const a = (k / 24) * Math.PI * 2;
    b.add(box(0.005, 0.04, 0.005, x + Math.cos(a) * r, h, z + Math.sin(a) * r), "#b3c0ca", FMAT.metal, ZONE.reservoir);
  }
  for (let y = 0.02; y < h + 0.03; y += 0.025) b.add(box(0.04, 0.004, 0.004, x - r * 0.7, y, z + r * 0.72), "#9aa6b1", FMAT.metal, ZONE.reservoir);
  b.add(box(0.13, 0.08, 0.1, x + r + 0.13, 0, z + 0.08), "#9aa9b6", FMAT.paint, ZONE.reservoir);
  b.add(box(0.14, 0.01, 0.11, x + r + 0.13, 0.08, z + 0.08), "#3a434c", FMAT.roof, ZONE.reservoir);
  b.light(new THREE.PlaneGeometry(0.04, 0.025).translate(x + r + 0.13, 0.05, z + 0.131), "#dff3ff", KEY.reservoir);
  for (const a of [0.6, 2.4, 4.2]) b.light(box(0.012, 0.01, 0.012, x + Math.cos(a) * r * 0.8, h + 0.004, z + Math.sin(a) * r * 0.8), "#fff0cf", KEY.service);
  // ус (түвшинг shader тавина)
  b.pool(new THREE.CircleGeometry(r * 0.965, 64).rotateX(-Math.PI / 2).translate(x, 0, z), 0);
  // оролт (баруун) ба гаралт (урд)
  for (const [jx, jz] of [toW(566, 240), toW(600, 274)]) b.light(ringH(0.03, 0.007, jx, 0.045, jz, 18), "#7fe0ff", KEY.reservoir);
  b.decal(x, z, 1.25, 1.25, 0, KEY.reservoir);
  // дээврийн радиаль хүрээ (төвийн цагираг руу) — инженерийн байгууламжийн бүтэц
  const ri = r * 0.6;
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * Math.PI * 2 + 0.15;
    b.add(pipeSeg(x + Math.cos(a) * ri, z + Math.sin(a) * ri, x + Math.cos(a) * 0.05, z + Math.sin(a) * 0.05, h + 0.004, 0.0035, 5), "#8b97a2", FMAT.metal, ZONE.reservoir);
  }
  b.add(cyl(0.05, 0.05, 0.012, x, h - 0.004, z, 20), "#6f7b86", FMAT.metal, ZONE.reservoir);
  b.light(cyl(0.012, 0.012, 0.006, x, h + 0.008, z, 10), "#9fe6ff", KEY.reservoir);
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2 + 0.4;
    b.light(box(0.008, 0.006, 0.008, x + Math.cos(a) * (r + 0.002), h + 0.042, z + Math.sin(a) * (r + 0.002)), "#bfeeff", KEY.reservoir);
  }
  b.shadowCircle(x, z, r + 0.01, h, 1);
  b.shadowRect(x + r + 0.13, z + 0.08, 0.065, 0.05, 0.09);
}

/** Хараа голын гүүр: тавцан, хашлага, тулгуур, гэрэл (хойд зам) */
function bridge(b: Builder) {
  const { x, z, half, width } = BRIDGE;
  const zone = ZONE.city;
  const top = 0.013;
  b.add(box(width - 0.012, 0.022, half * 2, x, top - 0.022, z), "#6f7a84", FMAT.concrete, zone);
  for (const s of [-1, 1]) {
    b.add(box(0.007, 0.02, half * 2, x + s * (width / 2 - 0.004), top, z), "#8d98a2", FMAT.concrete, zone);
    for (const dz of [-0.36, 0, 0.36]) {
      b.add(box(0.004, 0.06, 0.004, x + s * (width / 2 - 0.004), top + 0.02, z + dz), "#56636f", FMAT.darkMetal, zone);
      b.light(box(0.01, 0.005, 0.01, x + s * (width / 2 - 0.004), top + 0.08, z + dz), "#fff0cf", KEY.service);
    }
  }
  for (const dz of [-0.18, 0.18]) b.add(box(width * 0.7, top + 0.1, 0.035, x, -0.1, z + dz), "#5d6872", FMAT.concrete, zone);
}

function plant(b: Builder) {
  const p = PLANT.pad;
  const z = ZONE.plant;
  // дугуй тунгаагуурууд (SVG-ийн хоёр сав)
  for (const c of PLANT.clarifiers) {
    const [x, cz] = c.c;
    b.add(cyl(c.r + 0.02, c.r + 0.02, 0.06, x, 0, cz, 48, true), "#7d8892", FMAT.concrete, z);
    b.add(new THREE.RingGeometry(c.r, c.r + 0.02, 48, 1).rotateX(-Math.PI / 2).translate(x, 0.06, cz), "#949ea7", FMAT.concrete, z);
    b.add(cyl(0.02, 0.02, 0.07, x, 0.02, cz, 10), "#9aa6b1", FMAT.metal, z);
    b.add(box(c.r, 0.01, 0.022, x + c.r / 2, 0.065, cz).rotateY(0), "#9aa6b1", FMAT.grating, z);
    b.pool(new THREE.CircleGeometry(c.r, 40).rotateX(-Math.PI / 2).translate(x, 0.045, cz), 1);
  }
  // тэгш өнцөгт агааржуулах савнууд
  for (const [x0, z0, w, d] of [
    [5.55, -1.86, 0.78, 0.13],
    [5.55, -1.7, 0.78, 0.13],
  ]) {
    const cx = x0 + w / 2;
    const cz = z0 + d / 2;
    b.add(box(w + 0.03, 0.05, d + 0.03, cx, 0, cz), "#7d8892", FMAT.concrete, z);
    b.add(box(w + 0.034, 0.008, 0.012, cx, 0.05, z0 - 0.006), "#9aa6b1", FMAT.grating, z);
    b.pool(new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2).translate(cx, 0.051, cz), 2);
  }
  // процессын барилга, метантенк, оролтын байр
  b.add(box(0.34, 0.1, 0.2, 6.6, 0, -1.72), "#9aa9b6", FMAT.paint, z);
  b.add(box(0.355, 0.012, 0.215, 6.6, 0.1, -1.72), "#3a434c", FMAT.roof, z);
  for (const dx of [-0.11, -0.02, 0.07]) b.light(new THREE.PlaneGeometry(0.05, 0.025).translate(6.6 + dx, 0.065, -1.72 + 0.101), "#dff3ff", KEY.plant);
  for (const dx of [0, 0.17]) {
    b.add(cyl(0.065, 0.065, 0.09, 6.95 + dx, 0, -1.72, 24), "#8a959f", FMAT.concrete, z);
    b.add(new THREE.SphereGeometry(0.065, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2).translate(6.95 + dx, 0.09, -1.72), "#6f7b86", FMAT.metal, z);
  }
  b.add(box(0.16, 0.07, 0.12, 6.86, 0, -2.2), "#9aa9b6", FMAT.paint, z);
  b.add(box(0.17, 0.01, 0.13, 6.86, 0.07, -2.2), "#3a434c", FMAT.roof, z);
  b.light(ringH(0.04, 0.008, PLANT.inlet[0], 0.045, PLANT.inlet[1], 18), "#7ff0c8", KEY.plant);
  // гэрэлтүүлэг
  for (const [lx, lz] of [
    [5.5, -2.42],
    [6.3, -1.98],
    [7.12, -2.42],
    [7.12, -1.6],
  ]) {
    b.add(cyl(0.004, 0.006, 0.14, lx, 0, lz, 6), "#56636f", FMAT.darkMetal, z);
    b.light(box(0.02, 0.008, 0.02, lx, 0.14, lz), "#fff0cf", KEY.plant);
  }
  b.decal((p.x0 + p.x1) / 2, (p.z0 + p.z1) / 2, p.x1 - p.x0 + 0.24, p.z1 - p.z0 + 0.24, 1, KEY.plant, 0.012);
  // хашаа
  fence(b, p.x0 - 0.04, p.z0 - 0.04, p.x1 + 0.04, p.z1 + 0.04, z, 0.032);
  // лагийн өтгөрүүлэгч
  b.add(cyl(0.075, 0.075, 0.05, 6.93, 0, -2.4, 32, true), "#7d8892", FMAT.concrete, z);
  b.add(new THREE.RingGeometry(0.06, 0.075, 32, 1).rotateX(-Math.PI / 2).translate(6.93, 0.05, -2.4), "#949ea7", FMAT.concrete, z);
  b.pool(new THREE.CircleGeometry(0.06, 24).rotateX(-Math.PI / 2).translate(6.93, 0.04, -2.4), 1);
  b.add(box(0.075, 0.008, 0.014, 6.93 + 0.035, 0.054, -2.4), "#9aa6b1", FMAT.grating, z);
  // удирдлагын байр (гэрэлтэй цонх)
  b.add(box(0.2, 0.065, 0.11, 7.02, 0, -1.98), "#aab6c1", FMAT.paint, z);
  b.add(box(0.21, 0.01, 0.12, 7.02, 0.065, -1.98), "#3a434c", FMAT.roof, z);
  for (const dx of [-0.06, 0.0, 0.06]) b.light(new THREE.PlaneGeometry(0.035, 0.02).translate(7.02 + dx, 0.04, -1.98 + 0.056), "#ffe2b3", KEY.plant);
  // процессын хоолой: оролт → агааржуулах сав → тунгаагуур → гаргалгаа
  const py = 0.022;
  for (const [ax, az, bx, bz] of [
    [6.8, -2.2, 6.42, -2.2],
    [6.42, -2.2, 6.42, -1.86],
    [6.36, -1.66, 6.0, -1.66],
    [6.0, -1.66, 6.0, -1.84],
    [6.56, -1.85, 6.56, -1.6],
    [6.0, -2.4, 6.0, -2.46],
  ])
    b.add(pipeSeg(ax, az, bx, bz, py, 0.009, 8), "#3f6e66", FMAT.metal, z);
  // сүүдэр
  for (const c of PLANT.clarifiers) b.shadowCircle(c.c[0], c.c[1], c.r + 0.02, 0.06, 0.8);
  b.shadowRect(5.94, -1.79, 0.405, 0.08, 0.05, 0.7);
  b.shadowRect(5.94, -1.63, 0.405, 0.08, 0.05, 0.7);
  b.shadowRect(6.6, -1.72, 0.17, 0.1, 0.11);
  for (const dx of [0, 0.17]) b.shadowCircle(6.95 + dx, -1.72, 0.065, 0.155);
  b.shadowRect(6.86, -2.2, 0.08, 0.06, 0.08);
  b.shadowRect(7.02, -1.98, 0.1, 0.055, 0.075);
  b.shadowCircle(6.93, -2.4, 0.075, 0.05, 0.7);
}

function industry(b: Builder, buildings: Building[]) {
  const rnd = seeded(911);
  const fps = buildings
    .filter((q) => q.kind === 2)
    .map((q) => {
      const hx = (q.rot ? q.d : q.w) / 2 + 0.04;
      const hz = (q.rot ? q.w : q.d) / 2 + 0.04;
      return { x0: q.x - hx, x1: q.x + hx, z0: q.z - hz, z1: q.z + hz };
    });
  const free = (x: number, z: number, r: number) => !fps.some((f) => x + r > f.x0 && x - r < f.x1 && z + r > f.z0 && z - r < f.z1);
  const ind = DISTRICTS.find((d) => d.id === "ind")!;
  districtLots(ind).forEach((lot, i) => {
    for (let tries = 0; tries < 14; tries++) {
      const x = lot.x0 + 0.1 + rnd() * (lot.x1 - lot.x0 - 0.2);
      const zz = lot.z0 + 0.1 + rnd() * (lot.z1 - lot.z0 - 0.2);
      const kind = (i + tries) % 3;
      if (kind === 0 && free(x, zz, 0.12)) {
        // силосууд
        for (const [dx, dz] of [
          [-0.05, 0],
          [0.05, 0],
          [0, 0.085],
        ]) {
          b.add(cyl(0.042, 0.042, 0.15, x + dx, 0, zz + dz, 16), "#9aa3ab", FMAT.metal, ZONE.city);
          b.shadowCircle(x + dx, zz + dz, 0.042, 0.17);
          b.add(cyl(0.006, 0.042, 0.025, x + dx, 0.15, zz + dz, 16), "#6f7b86", FMAT.metal, ZONE.city);
        }
        fps.push({ x0: x - 0.12, x1: x + 0.12, z0: zz - 0.08, z1: zz + 0.16 });
        break;
      }
      if (kind === 1 && free(x, zz, 0.06)) {
        // яндан
        b.add(cyl(0.016, 0.026, 0.36, x, 0, zz, 12), "#7d8892", FMAT.concrete, ZONE.city);
        b.shadowCircle(x, zz, 0.022, 0.36, 0.8);
        b.add(cyl(0.018, 0.018, 0.012, x, 0.33, zz, 12), "#4a535c", FMAT.darkMetal, ZONE.city);
        b.light(cyl(0.006, 0.006, 0.006, x, 0.37, zz, 6), "#ffd9a0", KEY.industry);
        fps.push({ x0: x - 0.06, x1: x + 0.06, z0: zz - 0.06, z1: zz + 0.06 });
        break;
      }
      if (kind === 2 && free(x, zz, 0.12)) {
        // хадгалах сав
        b.add(cyl(0.095, 0.095, 0.07, x, 0, zz, 28), "#a7b0b8", FMAT.metal, ZONE.city);
        b.shadowCircle(x, zz, 0.095, 0.09);
        b.add(cyl(0.02, 0.095, 0.02, x, 0.07, zz, 28), "#8a959f", FMAT.metal, ZONE.city);
        fps.push({ x0: x - 0.12, x1: x + 0.12, z0: zz - 0.12, z1: zz + 0.12 });
        break;
      }
    }
  });
}

/** Засвар: ажлын хашлага, дохионы шон, улаан гэрэл, газрын цагираг */
function repair(b: Builder, [x, z]: P2) {
  b.add(box(0.008, 0.11, 0.008, x, 0, z), "#56636f", FMAT.darkMetal, ZONE.repair);
  b.light(new THREE.SphereGeometry(0.014, 12, 8).translate(x, 0.12, z), "#ff5a6e", KEY.repair);
  for (const [dx, dz, rot] of [
    [-0.07, 0.05, 0],
    [0.07, 0.05, 0],
    [0, -0.06, Math.PI / 2],
  ])
    b.add(box(0.08, 0.018, 0.008, 0, 0.012, 0).rotateY(rot).translate(x + dx, 0, z + dz), "#e8eef2", FMAT.alert, ZONE.repair);
  b.decal(x, z, 0.62, 0.62, 2, KEY.repair, 0.016);
}

export function facilityGeometry(buildings: Building[], outage: P2 | null) {
  const b = new Builder();
  wells(b);
  pumpStation(b, PUMPS[0], KEY.pump1, [toW(520, 282), toW(538, 300)]);
  pumpStation(b, PUMPS[1], KEY.pump2, [toW(622, 360), toW(640, 378), toW(658, 356), toW(650, 378)]);
  reservoir(b);
  plant(b);
  industry(b, buildings);
  bridge(b);
  if (outage) repair(b, outage);
  const merge = (list: THREE.BufferGeometry[]) => {
    const g = mergeGeometries(list, false)!;
    list.forEach((x) => x.dispose());
    return g;
  };
  return { body: merge(b.body), lights: merge(b.lights), water: merge(b.water), decals: merge(b.decals), shadows: b.shadows };
}
