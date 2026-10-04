import * as THREE from "three";
import { CORE, RAILWAY, railZ, STATIONS, terrainHeight } from "./layout";
import { Builder, box, cyl, FMAT, KEY, ZONE } from "./builder";

/**
 * Транс-Монголын төмөр зам: балласт (хайрга), дэр мод, хоёр төмөр, Дархан-1 (зорчигчийн) ба Дархан-2 (ачааны, салаа замтай)
 * буудал, үр тарианы элеватор, зорчигчийн ба ачааны галт тэрэг (статик). Бүгд байгууламжийн нэг geometry-д.
 */
const Z = ZONE.city;
const LIT = KEY.service;
const GAUGE = 0.0145;

const groundY = (x: number, z: number) => {
  const inCore = x > CORE.x0 && x < CORE.x1 && z > CORE.z0 && z < CORE.z1;
  return inCore ? 0 : Math.max(terrainHeight(x, z), -0.02);
};

/** Полилиний дагуух хавтгай тууз (дээшээ харсан), өндөр y(x, z) + lift */
function ribbon(pts: [number, number][], half: number, lift: number) {
  const pos: number[] = [];
  const nor: number[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i];
    const [bx, bz] = pts[i + 1];
    const l = Math.hypot(bx - ax, bz - az) || 1;
    const nx = -(bz - az) / l;
    const nz = (bx - ax) / l;
    const c = [
      [ax - nx * half, az - nz * half],
      [ax + nx * half, az + nz * half],
      [bx + nx * half, bz + nz * half],
      [bx - nx * half, bz - nz * half],
    ];
    for (const k of [0, 1, 2, 0, 2, 3]) {
      const [x, z] = c[k];
      pos.push(x, groundY(x, z) + lift, z);
      nor.push(0, 1, 0);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  return g;
}

/** Гурвалжин бүрийг дээрээс харахад урд тал болгоно (DoubleSide материал ар талд нь normal-ийг урвуулдаг) */
function flipToUp(g: THREE.BufferGeometry) {
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i += 3) {
    const ax = p.getX(i + 1) - p.getX(i);
    const az = p.getZ(i + 1) - p.getZ(i);
    const bx = p.getX(i + 2) - p.getX(i);
    const bz = p.getZ(i + 2) - p.getZ(i);
    // (a × b).y < 0 → доош харсан: 2 ба 3-р оройг солино
    if (az * bx - ax * bz < 0) {
      const t = [p.getX(i + 1), p.getY(i + 1), p.getZ(i + 1)];
      p.setXYZ(i + 1, p.getX(i + 2), p.getY(i + 2), p.getZ(i + 2));
      p.setXYZ(i + 2, t[0], t[1], t[2]);
    }
  }
  return g;
}

/** Замын полилиниас [x0, x1] хэсгийг (z шилжилттэй) */
function track(x0: number, x1: number, dz = 0): [number, number][] {
  return RAILWAY.filter(([x]) => x >= x0 && x <= x1).map(([x, z]) => [x, z + dz]);
}

function rails(b: Builder, pts: [number, number][], sleepers: boolean) {
  b.add(flipToUp(ribbon(pts, 0.036, 0.0035)), "#5d5852", FMAT.concrete, Z);
  for (const s of [-1, 1]) b.add(flipToUp(ribbon(offset(pts, s * GAUGE), 0.0018, 0.0075)), "#a7afb6", FMAT.metal, Z);
  if (!sleepers) return;
  // дэр мод: ~0.03 тутамд (зөвхөн харагдах хэсэгт)
  let acc = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i];
    const [bx, bz] = pts[i + 1];
    const l = Math.hypot(bx - ax, bz - az);
    const rot = Math.atan2(-(bz - az), bx - ax);
    for (let t = (0.03 - acc) / l; t < 1; t += 0.03 / l) {
      const x = ax + (bx - ax) * t;
      const z = az + (bz - az) * t;
      b.add(new THREE.BoxGeometry(0.008, 0.003, 0.05).rotateY(rot).translate(x, groundY(x, z) + 0.005, z), "#3a3029", FMAT.darkMetal, Z);
    }
    acc = (acc + l) % 0.03;
  }
}

function offset(pts: [number, number][], d: number): [number, number][] {
  return pts.map(([x, z], i) => {
    const [ax, az] = pts[Math.max(i - 1, 0)];
    const [bx, bz] = pts[Math.min(i + 1, pts.length - 1)];
    const l = Math.hypot(bx - ax, bz - az) || 1;
    return [x - ((bz - az) / l) * d, z + ((bx - ax) / l) * d];
  });
}

/** Галт тэрэгний вагон: замын дагуу (x төв), тангенсаар эргүүлсэн */
function car(b: Builder, x: number, len: number, color: string, kind: "loco" | "coach" | "box" | "tank" | "coal", dz = 0) {
  const z = railZ(x) + dz;
  const z2 = railZ(x + 0.01) + dz;
  const rot = Math.atan2(-(z2 - z), 0.01);
  const y = groundY(x, z) + 0.008;
  const place = (g: THREE.BufferGeometry) => g.rotateY(rot).translate(x, y, z);
  const w = 0.017;
  if (kind === "tank") {
    b.add(place(new THREE.CylinderGeometry(w * 0.55, w * 0.55, len * 0.9, 12).rotateZ(Math.PI / 2).translate(0, 0.012, 0)), color, FMAT.metal, Z);
    b.add(place(new THREE.BoxGeometry(len, 0.004, w).translate(0, 0.002, 0)), "#2b2f33", FMAT.darkMetal, Z);
    return;
  }
  const h = kind === "coal" ? 0.012 : kind === "loco" ? 0.02 : 0.019;
  b.add(place(new THREE.BoxGeometry(len, h, w).translate(0, h / 2, 0)), color, kind === "loco" ? FMAT.paint : FMAT.metal, Z);
  if (kind === "coal") b.add(place(new THREE.BoxGeometry(len * 0.92, 0.003, w * 0.86).translate(0, h, 0)), "#1d1e20", FMAT.concrete, Z);
  else b.add(place(new THREE.BoxGeometry(len * 0.98, 0.002, w * 0.9).translate(0, h, 0)), kind === "box" ? "#5b4636" : "#4a535c", FMAT.roof, Z);
  if (kind === "coach") {
    // цонхны эгнээ (хоёр тал), шар судал
    b.add(place(new THREE.BoxGeometry(len * 0.98, 0.002, w + 0.0006).translate(0, 0.006, 0)), "#e2c045", FMAT.paint, Z);
    for (const s of [-1, 1]) {
      const g = new THREE.PlaneGeometry(len * 0.82, 0.005).translate(0, 0.012, 0);
      if (s < 0) g.rotateY(Math.PI);
      b.light(place(g.translate(0, 0, s * (w / 2 + 0.0006))), "#ffe2b3", LIT);
    }
  }
  if (kind === "loco") {
    b.add(place(new THREE.BoxGeometry(len * 0.25, 0.006, w * 0.9).translate(len * 0.3, h + 0.003, 0)), "#e2c045", FMAT.paint, Z);
    b.light(place(new THREE.BoxGeometry(0.002, 0.004, 0.006).translate(len / 2 + 0.001, 0.012, 0)), "#fff4dc", LIT);
  }
}

function station(b: Builder, x: number, len: number, main: boolean) {
  const rz = railZ(x);
  // тавцан (+z тал), саравч
  const pz = rz + 0.062;
  b.add(box(len + 0.1, 0.012, 0.05, x, 0, pz), "#a9a69c", FMAT.concrete, Z);
  b.add(box(len * 0.8, 0.004, 0.034, x, 0.05, pz), "#4e6a7d", FMAT.roof, Z);
  for (let k = 0; k <= 4; k++) b.add(cyl(0.002, 0.002, 0.04, x - len * 0.38 + (k * len * 0.76) / 4, 0.012, pz, 5), "#8a96a2", FMAT.metal, Z);
  for (let k = 0; k < 5; k++) b.light(box(0.01, 0.002, 0.006, x - len * 0.32 + (k * len * 0.64) / 4, 0.048, pz), "#fff0cf", LIT);
  // буудлын барилга: төв хэсэг + хоёр жигүүр (цөцгий, цагаан хүрээ), цаг, нэрийн самбар
  const bz = pz + 0.09;
  const cw = main ? 0.16 : 0.12;
  const ch = main ? 0.095 : 0.06;
  const col = "#e5d7b4";
  const roof = "#7a3b2e";
  b.add(box(cw, ch, 0.12, x, 0, bz), col, FMAT.paint, Z);
  b.add(box(cw + 0.008, 0.008, 0.128, x, ch, bz), roof, FMAT.roof, Z);
  for (let k = 0; k < 4; k++) b.add(cyl(0.0045, 0.0045, ch * 0.75, x - cw * 0.36 + (k * cw * 0.72) / 3, 0, bz + 0.064, 8), "#f3ece0", FMAT.stone, Z);
  if (main) {
    for (const s of [-1, 1]) {
      b.add(box(0.15, 0.06, 0.1, x + s * 0.155, 0, bz), col, FMAT.paint, Z);
      b.add(box(0.156, 0.007, 0.106, x + s * 0.155, 0.06, bz), roof, FMAT.roof, Z);
      for (let j = 0; j < 2; j++)
        for (let i = 0; i < 4; i++) b.light(new THREE.PlaneGeometry(0.02, 0.012).translate(x + s * 0.155 - 0.054 + i * 0.036, 0.016 + j * 0.026, bz + 0.0505), j ? "#dff3ff" : "#ffe2b3", LIT);
    }
    b.add(box(0.05, 0.05, 0.05, x, ch, bz - 0.02), col, FMAT.paint, Z);
    b.add(new THREE.ConeGeometry(0.038, 0.035, 4).rotateY(Math.PI / 4).translate(x, ch + 0.067, bz - 0.02), roof, FMAT.roof, Z);
    b.light(new THREE.CircleGeometry(0.01, 16).translate(x, ch + 0.028, bz + 0.0052), "#fff6d8", LIT);
  }
  b.light(box(cw * 0.7, 0.01, 0.003, x, ch * 0.82, bz + 0.0615), "#7fd0ff", LIT);
  b.shadowRect(x, bz, main ? 0.23 : cw / 2, 0.06, ch);
  // буудлын талбай (авто зам руу)
  b.add(box(main ? 0.5 : 0.24, 0.0025, 0.2, x, 0, bz + 0.17), "#7e8188", FMAT.concrete, Z);
  for (const dx of main ? [-0.22, 0.22] : [-0.1, 0.1]) {
    b.add(cyl(0.0018, 0.0025, 0.06, x + dx, 0, bz + 0.2, 5), "#56636f", FMAT.darkMetal, Z);
    b.light(box(0.008, 0.005, 0.008, x + dx, 0.06, bz + 0.2), "#ffe2b0", LIT);
  }
}

/** Үр тарианы элеватор: силосын хоёр эгнээ, ажлын цамхаг */
function elevator(b: Builder, x: number) {
  const z0 = railZ(x) + 0.26;
  for (let r = 0; r < 2; r++)
    for (let k = 0; k < 5; k++) {
      const sx = x - 0.12 + k * 0.06;
      const sz = z0 + r * 0.06;
      b.add(cyl(0.03, 0.03, 0.2, sx, 0, sz, 16), "#c9c6bd", FMAT.concrete, Z);
      b.shadowCircle(sx, sz, 0.03, 0.2, 0.8);
    }
  b.add(box(0.3, 0.02, 0.13, x, 0.2, z0 + 0.03), "#a9a59c", FMAT.concrete, Z);
  b.add(box(0.06, 0.32, 0.08, x + 0.2, 0, z0 + 0.03), "#bdb9af", FMAT.concrete, Z);
  b.add(box(0.07, 0.02, 0.09, x + 0.2, 0.32, z0 + 0.03), "#7a3b2e", FMAT.roof, Z);
  b.light(box(0.006, 0.006, 0.006, x + 0.2, 0.345, z0 + 0.03), "#ff3b3b", KEY.industry);
  for (let j = 0; j < 4; j++) b.light(new THREE.PlaneGeometry(0.02, 0.01).translate(x + 0.2, 0.05 + j * 0.07, z0 + 0.0705), "#ffd9a0", KEY.industry);
  b.shadowRect(x + 0.2, z0 + 0.03, 0.03, 0.04, 0.33);
}

export function railway(b: Builder) {
  // гол зам: харагдах хэсэгт дэр модтой, алсад зөвхөн балласт + төмөр
  rails(b, track(-11, 11), true);
  rails(b, track(-19.5, -10.9), false);
  rails(b, track(10.9, 19.5), false);
  // Дархан-2: ачааны буудлын салаа замууд (баруун тал)
  for (const dz of [-0.075, -0.15]) rails(b, track(-7.4, -4.4, dz), false);
  for (const s of STATIONS) station(b, s.x, s.len, s.main);
  elevator(b, 3.75);
  // зорчигчийн галт тэрэг (Дархан-1 тавцан), ачааны галт тэрэг (Дархан-2 — төв хооронд)
  const p0 = STATIONS[0].x - 0.24;
  car(b, p0, 0.05, "#2f6b4f", "loco");
  for (let k = 1; k <= 6; k++) car(b, p0 + k * 0.067, 0.064, "#3c7a5c", "coach");
  const f0 = -3.2;
  car(b, f0, 0.05, "#2f6b4f", "loco");
  const kinds = ["coal", "coal", "tank", "box", "coal", "tank", "tank", "box", "coal", "coal", "box", "tank"] as const;
  kinds.forEach((k, i) => car(b, f0 - 0.058 * (i + 1), 0.054, k === "box" ? "#7a4a33" : k === "tank" ? "#202428" : "#4f3a2c", k));
  for (let i = 0; i < 8; i++) car(b, -6.6 + i * 0.058, 0.054, i % 3 ? "#4f3a2c" : "#7a4a33", i % 3 ? "coal" : "box", -0.075);
}
