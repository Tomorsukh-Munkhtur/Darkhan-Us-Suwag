import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { seeded } from "@/lib/seeded";
import { BRIDGE, DISTRICTS, NET, PLANT, PUMPS, RESERVED, RESERVOIR_H, RESERVOIRS, SOURCE_ZONE, WELLS, type P2 } from "./layout";
import { districtLots, type Building } from "./city";
import { Builder, box, cyl, fence, FMAT, gable, KEY, pipeSeg, ringH, ZONE } from "./builder";
import { landmarks } from "./landmarks";
import { civic } from "./civic";
import { railway } from "./rail";

export { FMAT, KEY, KEYS, ZONE } from "./builder";

/**
 * Байгууламжуудын geometry (builder.ts-ийн нэгтгэгчээр): худаг, насос станц, усан сан, цэвэрлэх байгууламж,
 * үйлдвэрийн силос/яндан, Хараа голын гүүр, засвар; дурсгалт газрууд — landmarks.ts.
 */

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

/** Нэг усан сан: бетон хана, дотор хана, дээврийн хүрээ, хашлага, шат, ус (түвшинг shader тавина) */
function tank(b: Builder, x: number, z: number, r: number, h: number) {
  const Zr = ZONE.reservoir;
  b.add(cyl(r, r, h, x, 0, z, 48, true), "#8a959f", FMAT.concrete, Zr);
  b.add(cyl(r * 0.96, r * 0.96, h, x, 0, z, 48, true), "#3c464f", FMAT.inner, Zr);
  b.add(new THREE.RingGeometry(r * 0.62, r + 0.004, 48, 1).rotateX(-Math.PI / 2).translate(x, h, z), "#7d8892", FMAT.concrete, Zr);
  b.add(new THREE.CircleGeometry(r * 0.96, 40).rotateX(-Math.PI / 2).translate(x, 0.012, z), "#222a31", FMAT.inner, Zr);
  b.add(ringH(r + 0.002, 0.0025, x, h + 0.03, z, 56), "#b3c0ca", FMAT.metal, Zr);
  const posts = Math.round(r * 90);
  for (let k = 0; k < posts; k++) {
    const a = (k / posts) * Math.PI * 2;
    b.add(box(0.004, 0.03, 0.004, x + Math.cos(a) * r, h, z + Math.sin(a) * r), "#b3c0ca", FMAT.metal, Zr);
  }
  for (let y = 0.02; y < h + 0.02; y += 0.025) b.add(box(0.03, 0.004, 0.004, x - r * 0.7, y, z + r * 0.72), "#9aa6b1", FMAT.metal, Zr);
  const ri = r * 0.62;
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2 + 0.15;
    b.add(pipeSeg(x + Math.cos(a) * ri, z + Math.sin(a) * ri, x + Math.cos(a) * 0.03, z + Math.sin(a) * 0.03, h + 0.004, 0.003, 5), "#8b97a2", FMAT.metal, Zr);
  }
  b.add(cyl(0.03, 0.03, 0.01, x, h - 0.004, z, 16), "#6f7b86", FMAT.metal, Zr);
  b.light(cyl(0.008, 0.008, 0.005, x, h + 0.006, z, 8), "#9fe6ff", KEY.reservoir);
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2 + 0.4;
    b.light(box(0.006, 0.005, 0.006, x + Math.cos(a) * (r + 0.002), h + 0.032, z + Math.sin(a) * (r + 0.002)), "#bfeeff", KEY.reservoir);
  }
  b.pool(new THREE.CircleGeometry(r * 0.955, 48).rotateX(-Math.PI / 2).translate(x, 0, z), 0, [x, z, r]);
  b.shadowCircle(x, z, r + 0.01, h, 1);
}

/** Усан сангийн цогцолбор: 2 том (6000 м³), 2 жижиг (2000 м³) сан, хаалтын байр, холбох шугам, оролт/гаралтын фланц */
function reservoirs(b: Builder) {
  const Zr = ZONE.reservoir;
  const xs = RESERVOIRS.map((t) => t.c[0]);
  const zs = RESERVOIRS.map((t) => t.c[1]);
  const x0 = Math.min(...xs) - 0.24;
  const x1 = Math.max(...xs) + 0.26;
  const z0 = Math.min(...zs) - 0.22;
  const z1 = Math.max(...zs) + 0.16;
  b.add(box(x1 - x0, 0.005, z1 - z0, (x0 + x1) / 2, 0, (z0 + z1) / 2), "#4a535c", FMAT.concrete, Zr);
  for (const t of RESERVOIRS) tank(b, t.c[0], t.c[1], t.r, RESERVOIR_H);
  // хаалтын байр (оролт/гаралтын хооронд)
  const [ox, oz] = NET.resOut;
  b.add(box(0.1, 0.07, 0.09, ox + 0.005, 0, (NET.resIn[1] + oz) / 2), "#9aa9b6", FMAT.paint, Zr);
  b.add(box(0.11, 0.01, 0.1, ox + 0.005, 0.07, (NET.resIn[1] + oz) / 2), "#3a434c", FMAT.roof, Zr);
  b.light(new THREE.PlaneGeometry(0.035, 0.022).translate(ox + 0.005, 0.045, (NET.resIn[1] + oz) / 2 + 0.046), "#dff3ff", KEY.reservoir);
  // сангуудыг холбох шугам (оролтын ба гаралтын коллектор)
  const py = 0.03;
  b.add(pipeSeg(NET.resIn[0], NET.resIn[1], xs[0], NET.resIn[1], py, 0.01, 8), "#5d7f9a", FMAT.metal, Zr);
  for (const t of RESERVOIRS.slice(0, 2)) b.add(pipeSeg(t.c[0], NET.resIn[1], t.c[0], t.c[1] - t.r, py, 0.008, 8), "#5d7f9a", FMAT.metal, Zr);
  b.add(pipeSeg(ox - 0.02, zs[0], ox - 0.02, oz, py, 0.01, 8), "#5d7f9a", FMAT.metal, Zr);
  for (const t of RESERVOIRS) b.add(pipeSeg(t.c[0] + t.r, t.c[1], ox - 0.02, t.c[1], py, 0.007, 8), "#5d7f9a", FMAT.metal, Zr);
  for (const [jx, jz] of [NET.resIn, NET.resOut]) b.light(ringH(0.03, 0.007, jx, 0.045, jz, 18), "#7fe0ff", KEY.reservoir);
  for (const [lx, lz] of [
    [x0 + 0.02, z0 + 0.02],
    [x1 - 0.02, z0 + 0.02],
    [x0 + 0.02, z1 - 0.02],
  ]) b.light(box(0.01, 0.008, 0.01, lx, 0.006, lz), "#fff0cf", KEY.service);
  b.decal((x0 + x1) / 2, (z0 + z1) / 2, x1 - x0 + 0.5, z1 - z0 + 0.5, 0, KEY.reservoir);
  b.shadowRect(ox + 0.005, (NET.resIn[1] + oz) / 2, 0.05, 0.045, 0.08);
}

/** Хараа голын гүүр: тавцан, хашлага, тулгуур, гэрэл (хойд зам) */
function bridge(b: Builder) {
  const { x, z, half, width } = BRIDGE;
  const zone = ZONE.city;
  // замын гадаргуу (y ≈ 0.014) тавцангийн дээр харагдана
  const top = 0.009;
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

/** Цэвэрлэх байгууламж: загвар нь анхны (SVG схемийн) координатад, PLANT.off-оор шинэ байрлал руу шилжинэ */
function plant(out: Builder) {
  const [ox, oz] = PLANT.off;
  const b = new Builder();
  const p = { x0: PLANT.pad.x0 - ox, x1: PLANT.pad.x1 - ox, z0: PLANT.pad.z0 - oz, z1: PLANT.pad.z1 - oz };
  const clarifiers = PLANT.clarifiers.map((c) => ({ c: [c.c[0] - ox, c.c[1] - oz] as P2, r: c.r }));
  const inlet: P2 = [PLANT.inlet[0] - ox, PLANT.inlet[1] - oz];
  const z = ZONE.plant;
  // дугуй тунгаагуурууд
  for (const c of clarifiers) {
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
  b.light(ringH(0.04, 0.008, inlet[0], 0.045, inlet[1], 18), "#7ff0c8", KEY.plant);
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
  for (const c of clarifiers) b.shadowCircle(c.c[0], c.c[1], c.r + 0.02, 0.06, 0.8);
  b.shadowRect(5.94, -1.79, 0.405, 0.08, 0.05, 0.7);
  b.shadowRect(5.94, -1.63, 0.405, 0.08, 0.05, 0.7);
  b.shadowRect(6.6, -1.72, 0.17, 0.1, 0.11);
  for (const dx of [0, 0.17]) b.shadowCircle(6.95 + dx, -1.72, 0.065, 0.155);
  b.shadowRect(6.86, -2.2, 0.08, 0.06, 0.08);
  b.shadowRect(7.02, -1.98, 0.1, 0.055, 0.075);
  b.shadowCircle(6.93, -2.4, 0.075, 0.05, 0.7);
  // шинэ байрлал руу шилжүүлнэ
  for (const [src, dst] of [
    [b.body, out.body],
    [b.lights, out.lights],
    [b.water, out.water],
    [b.decals, out.decals],
  ] as const)
    for (const g of src) dst.push(g.translate(ox, 0, oz));
  for (const c of b.shadows) {
    if (c.kind === 2) out.shadows.push({ ...c, ax: c.ax + ox, az: c.az + oz, bx: c.bx + ox, bz: c.bz + oz });
    else out.shadows.push({ ...c, cx: c.cx + ox, cz: c.cz + oz });
  }
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
    if (RESERVED.some((q) => lot.x0 < q.x1 && lot.x1 > q.x0 && lot.z0 < q.z1 && lot.z1 > q.z0)) return;
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
  pumpStation(b, PUMPS[0], KEY.pump1, [NET.pump1In, NET.pump1Out]);
  pumpStation(b, PUMPS[1], KEY.pump2, [NET.pump2In, ...NET.pump2Outs]);
  reservoirs(b);
  plant(b);
  industry(b, buildings);
  bridge(b);
  railway(b);
  civic(b);
  landmarks(b);
  if (outage) repair(b, outage);
  const merge = (list: THREE.BufferGeometry[]) => {
    const g = mergeGeometries(list, false)!;
    list.forEach((x) => x.dispose());
    return g;
  };
  return { body: merge(b.body), lights: merge(b.lights), water: merge(b.water), decals: merge(b.decals), shadows: b.shadows };
}
