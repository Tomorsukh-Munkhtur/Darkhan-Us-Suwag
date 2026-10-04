import * as THREE from "three";
import { AVENUE_Z, CENTRAL, CIVIC, FOOTBRIDGE, MORIN_KHUUR, OVOO_HILL, PARK, type Rect } from "./layout";
import { Builder, box, cyl, FMAT, gable, KEY, ringH, rod, ZONE } from "./builder";
import { mound } from "./landmarks";

/**
 * Хотын төвийн нийтийн байгууламж (OSM-ийн бодит объектуудаар, схемийн байрлалд):
 *  Шинэ Дархан — Засаг даргын ордон + төв талбай, "Дархан-50" цогцолбор (хөгжимт усан оргилуур), Нэгдсэн эмнэлэг,
 *    Политехник коллеж/Технологийн сургууль, Залуучуудын театр + музей, худалдааны төв + 16 давхар, Дархан Юнайтед арена;
 *  төв хэсэг — шатахуун түгээх станц, "Өргөө" кино театр, ОИЦ сургууль, цэцэрлэг, цэнгэлдэх хүрээлэн;
 *  "Миний Монгол" цэцэрлэгт хүрээлэн — алхах зам, 12 ордны хөшөө, гэрэлтдэг "Мини Монгол" загвар, цөөрөм, усан парк, хүүхдийн галт тэрэг;
 *  үйлдвэр — Дарханы ДЦС (яндан, хөргөх цамхаг), Төмөрлөгийн үйлдвэр, цементийн үйлдвэр; Дархан овоо.
 */
const Z = ZONE.city;
const LIT = KEY.service;
const IND = KEY.industry;

const cx = (r: Rect) => (r.x0 + r.x1) / 2;
const cz = (r: Rect) => (r.z0 + r.z1) / 2;
const inRect = (x: number, z: number, r: Rect, m = 0) => x > r.x0 - m && x < r.x1 + m && z > r.z0 - m && z < r.z1 + m;
const hash = (a: number, b: number) => {
  const s = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453;
  return s - Math.floor(s);
};

/** Барилга: их бие, дээвэр, урд (+z) ба хажуугийн цонхны мөр (гэрэлтэй/бараан холимог) */
function block(
  b: Builder,
  x: number,
  z: number,
  w: number,
  d: number,
  h: number,
  color: string,
  o: { roof?: string; floors?: number; win?: number; side?: boolean; mat?: number; seed?: number; lit?: number } = {},
) {
  b.add(box(w, h, d, x, 0, z), color, o.mat ?? FMAT.paint, Z);
  b.add(box(w + 0.006, 0.005, d + 0.006, x, h, z), o.roof ?? "#4a535c", FMAT.roof, Z);
  const floors = o.floors ?? Math.max(1, Math.round(h / 0.026));
  const fl = h / floors;
  const cols = o.win ?? Math.max(2, Math.round(w / 0.04));
  const seed = o.seed ?? x * 7 + z * 3;
  const lit = o.lit ?? 0.6;
  const pick = (i: number, j: number) => {
    const r = hash(seed + i, j);
    return r > lit ? "#56616c" : r < lit * 0.45 ? "#dff3ff" : "#ffe2b3";
  };
  for (let j = 0; j < floors; j++)
    for (let i = 0; i < cols; i++)
      b.light(new THREE.PlaneGeometry((w / cols) * 0.5, fl * 0.42).translate(x - w / 2 + (w / cols) * (i + 0.5), fl * (j + 0.55), z + d / 2 + 0.002), pick(i, j), LIT);
  if (o.side !== false) {
    const sc = Math.max(1, Math.round(d / 0.045));
    for (let j = 0; j < floors; j++)
      for (let i = 0; i < sc; i++)
        b.light(
          new THREE.PlaneGeometry((d / sc) * 0.5, fl * 0.42)
            .rotateY(Math.PI / 2)
            .translate(x + w / 2 + 0.002, fl * (j + 0.55), z - d / 2 + (d / sc) * (i + 0.5)),
          pick(i + 40, j),
          LIT,
        );
  }
  b.shadowRect(x, z, w / 2, d / 2, h);
}

/** Хавтгай газар бүрхэвч (зүлэг, хучилт) — газрын дээр бага зэрэг */
const pad = (b: Builder, r: Rect, color: string, mat: number = FMAT.concrete, y = 0.0025) =>
  b.add(box(r.x1 - r.x0, y, r.z1 - r.z0, cx(r), 0, cz(r)), color, mat, Z);

/** Шон + гэрэл */
function lamp(b: Builder, x: number, z: number, h = 0.06, color = "#ffe2b0") {
  b.add(cyl(0.0018, 0.0026, h, x, 0, z, 5), "#56636f", FMAT.darkMetal, Z);
  b.light(box(0.008, 0.005, 0.008, x, h, z), color, LIT);
}

/** Туг: шон, далбаа (Монгол Улсын туг — улаан-цэнхэр-улаан) */
function flag(b: Builder, x: number, z: number, h = 0.09) {
  b.add(cyl(0.0012, 0.0012, h, x, 0, z, 5), "#c9d0d6", FMAT.metal, Z);
  const fw = 0.026;
  [["#c8102e", -fw / 3], ["#0f4fa8", 0], ["#c8102e", fw / 3]].forEach(([c, dx]) =>
    b.add(new THREE.PlaneGeometry(fw / 3, 0.016).translate(x + fw / 2 + (dx as number), h - 0.01, z), c as string, FMAT.paint, Z),
  );
}

/** Хүрэл хөшөө (тавцан + хүний дүрс) */
function statue(b: Builder, x: number, z: number, s = 1, base = "#b9b4a8") {
  b.add(box(0.03 * s, 0.03 * s, 0.03 * s, x, 0, z), base, FMAT.stone, Z);
  b.add(cyl(0.006 * s, 0.008 * s, 0.03 * s, x, 0.03 * s, z, 8), "#4b5049", FMAT.bronze, Z);
  b.add(new THREE.SphereGeometry(0.0055 * s, 8, 6).translate(x, 0.066 * s, z), "#4b5049", FMAT.bronze, Z);
}

/** Усан оргилуур: чулуун хүрээ, ус, гэрэлтэй цацрага */
function fountain(b: Builder, x: number, z: number, r: number, jets = 8) {
  b.add(cyl(r, r + 0.006, 0.012, x, 0, z, 36), "#a8a59a", FMAT.stone, Z);
  b.pool(new THREE.CircleGeometry(r - 0.008, 36).rotateX(-Math.PI / 2).translate(x, 0.0125, z), 3);
  b.light(cyl(0.004, 0.006, 0.05 * (r / 0.1), x, 0.012, z, 8), "#bdeeff", LIT);
  for (let k = 0; k < jets; k++) {
    const a = (k / jets) * Math.PI * 2;
    b.light(cyl(0.0018, 0.0028, 0.022, x + Math.cos(a) * r * 0.6, 0.012, z + Math.sin(a) * r * 0.6, 5), "#9fe6ff", LIT);
  }
}

// ---------------------------------------------------------------------------------------------
// Шинэ Дархан

function government(b: Builder) {
  const r = CIVIC.government;
  pad(b, r, "#8e9096");
  const x = cx(r);
  const z0 = r.z0 + 0.09;
  block(b, x, z0, 0.44, 0.13, 0.1, "#d9cfb8", { roof: "#3e464e", floors: 3, win: 11, seed: 3 });
  // гол хаалганы баганат хаалт (portico), дээврийн туг
  for (let i = 0; i < 6; i++) b.add(cyl(0.005, 0.005, 0.08, x - 0.075 + i * 0.03, 0, z0 + 0.085, 8), "#efe7d6", FMAT.stone, Z);
  b.add(box(0.18, 0.012, 0.04, x, 0.08, z0 + 0.08), "#e6dcc6", FMAT.stone, Z);
  b.add(box(0.2, 0.008, 0.06, x, 0, z0 + 0.09), "#bdb6a6", FMAT.stone, Z);
  flag(b, x, z0, 0.16);
  // талбай: тугнууд, хөшөө, гэрэл
  for (let i = 0; i < 5; i++) flag(b, x - 0.2 + i * 0.1, r.z1 - 0.05);
  statue(b, x, z0 + 0.22, 1.4);
  for (const dx of [-0.32, 0.32]) for (const dz of [0.2, 0.36]) lamp(b, x + dx, z0 + dz);
}

function darkhan50(b: Builder) {
  const r = CIVIC.d50;
  pad(b, r, "#3d6646", FMAT.grass, 0.003);
  // хөндлөн зам
  b.add(box(r.x1 - r.x0, 0.0035, 0.022, cx(r), 0, cz(r)), "#9a9a92", FMAT.concrete, Z);
  b.add(box(0.022, 0.0035, r.z1 - r.z0, r.x0 + 0.33, 0, cz(r)), "#9a9a92", FMAT.concrete, Z);
  // хөгжимт усан оргилуур, гэр хэлбэрийн усан байгууламж
  fountain(b, r.x0 + 0.16, cz(r), 0.12, 10);
  for (const dz of [-0.17, 0.17]) {
    const gx = r.x0 + 0.36;
    b.add(new THREE.SphereGeometry(0.028, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.7, 1).translate(gx, 0.003, cz(r) + dz), "#e8ecef", FMAT.stone, Z);
    b.light(ringH(0.032, 0.0025, gx, 0.006, cz(r) + dz, 20), "#9fe6ff", LIT);
  }
  // ажиглах асар (гэр хэлбэрийн оройтой)
  const px = r.x0 + 0.05;
  const pz = r.z1 - 0.05;
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2;
    b.add(cyl(0.002, 0.002, 0.04, px + Math.cos(a) * 0.032, 0, pz + Math.sin(a) * 0.032, 4), "#e6dcc6", FMAT.stone, Z);
  }
  b.add(new THREE.ConeGeometry(0.045, 0.025, 12).translate(px, 0.052, pz), "#b8462f", FMAT.paint, Z);
  // баримал, гэрэл
  for (let i = 0; i < 4; i++) statue(b, r.x0 + 0.08 + i * 0.09, r.z0 + 0.03, 0.8);
  for (let i = 0; i < 4; i++) lamp(b, r.x0 + 0.06 + i * 0.12, r.z1 - 0.02, 0.05);
}

function hospital(b: Builder) {
  const r = CIVIC.hospital;
  pad(b, r, "#7d838a");
  const x = cx(r);
  block(b, x - 0.04, r.z0 + 0.08, 0.56, 0.13, 0.12, "#dfe5ea", { roof: "#56606a", floors: 5, win: 13, seed: 11, lit: 0.75 });
  b.add(box(0.565, 0.012, 0.135, x - 0.04, 0.04, r.z0 + 0.08), "#3f86c4", FMAT.paint, Z);
  block(b, r.x1 - 0.1, cz(r) + 0.06, 0.12, 0.2, 0.09, "#d7dde2", { floors: 4, win: 3, seed: 13, lit: 0.7 });
  block(b, r.x0 + 0.12, r.z1 - 0.08, 0.2, 0.11, 0.07, "#e2c9c9", { floors: 3, win: 5, seed: 17 }); // Төрөх эмнэлэг
  // улаан загалмай (гэрэлтэй), түргэн тусламжийн саравч
  const sx = x - 0.04;
  const sy = 0.125;
  b.light(box(0.03, 0.009, 0.004, sx, sy + 0.01, r.z0 + 0.147), "#ff3b3b", LIT);
  b.light(box(0.009, 0.03, 0.004, sx, sy, r.z0 + 0.147), "#ff3b3b", LIT);
  b.add(box(0.1, 0.004, 0.05, sx + 0.16, 0.03, r.z0 + 0.17), "#c9d0d6", FMAT.metal, Z);
  for (const dx of [-0.25, 0, 0.25]) lamp(b, x + dx, r.z1 - 0.01);
}

function colleges(b: Builder) {
  const r = CIVIC.colleges;
  pad(b, r, "#6f7780");
  // Политехник коллеж (Г хэлбэр), Технологийн сургууль, спорт талбай
  block(b, r.x0 + 0.22, r.z0 + 0.075, 0.38, 0.11, 0.1, "#d8c9a8", { roof: "#3f6e8f", floors: 4, seed: 21 });
  block(b, r.x0 + 0.08, r.z0 + 0.26, 0.11, 0.22, 0.1, "#d8c9a8", { roof: "#3f6e8f", floors: 4, win: 2, seed: 23 });
  block(b, r.x1 - 0.16, r.z1 - 0.1, 0.26, 0.12, 0.085, "#c9d3dc", { roof: "#4a535c", floors: 3, seed: 27 });
  const fx = r.x1 - 0.16;
  const fz = r.z0 + 0.12;
  b.add(box(0.22, 0.003, 0.13, fx, 0, fz), "#3f7a4f", FMAT.grass, Z);
  b.add(box(0.2, 0.0035, 0.002, fx, 0, fz), "#e6ebef", FMAT.paint, Z);
  b.add(ringH(0.02, 0.0012, fx, 0.0035, fz, 18), "#e6ebef", FMAT.paint, Z);
}

function theatre(b: Builder) {
  const r = CIVIC.theatre;
  pad(b, r, "#8e9096");
  // Залуучуудын театр: баганат урд тал, тайзны өндөр хэсэг
  const tx = r.x0 + 0.18;
  const tz = r.z0 + 0.12;
  block(b, tx, tz, 0.26, 0.16, 0.1, "#e3d6bd", { roof: "#5b4a42", floors: 2, win: 6, seed: 31 });
  b.add(box(0.14, 0.06, 0.1, tx, 0.1, tz - 0.02), "#d6c8ad", FMAT.paint, Z);
  for (let i = 0; i < 6; i++) b.add(cyl(0.005, 0.005, 0.075, tx - 0.075 + i * 0.03, 0, tz + 0.1, 8), "#f1eadb", FMAT.stone, Z);
  b.add(box(0.19, 0.012, 0.04, tx, 0.075, tz + 0.095), "#e9dfc9", FMAT.stone, Z);
  b.light(box(0.12, 0.008, 0.003, tx, 0.088, tz + 0.116), "#ffd27a", LIT);
  // Аймгийн музей: бөмбөгөр оройтой
  const mx = r.x1 - 0.13;
  const mz = r.z1 - 0.12;
  block(b, mx, mz, 0.2, 0.14, 0.07, "#c9b79a", { roof: "#4a535c", floors: 2, win: 5, seed: 33 });
  b.add(new THREE.SphereGeometry(0.035, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2).translate(mx, 0.075, mz), "#7f9aa3", FMAT.metal, Z);
  fountain(b, r.x1 - 0.13, r.z0 + 0.09, 0.05, 6);
  lamp(b, r.x0 + 0.04, r.z1 - 0.04);
}

function market(b: Builder) {
  const r = CIVIC.market;
  pad(b, r, "#5e646b");
  // Олон улсын худалдааны төв: нуман дээвэртэй танхим, гэрэлт самбар
  const hx = r.x0 + 0.21;
  const hz = r.z0 + 0.12;
  b.add(box(0.36, 0.05, 0.18, hx, 0, hz), "#b9c1c8", FMAT.paint, Z);
  b.add(new THREE.CylinderGeometry(0.09, 0.09, 0.36, 20, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).rotateY(Math.PI / 2).scale(1, 0.35, 1).translate(hx, 0.05, hz), "#4f6d86", FMAT.roof, Z);
  b.light(box(0.3, 0.012, 0.003, hx, 0.035, hz + 0.092), "#ff6aa8", LIT);
  for (let i = 0; i < 6; i++) b.light(new THREE.PlaneGeometry(0.035, 0.022).translate(hx - 0.15 + i * 0.06, 0.012, hz + 0.091), "#ffe2b3", LIT);
  // 16 давхар орон сууц
  block(b, r.x1 - 0.08, r.z1 - 0.1, 0.12, 0.12, 16 * 0.024, "#c3ccd4", { roof: "#3e464e", floors: 16, win: 4, seed: 37, lit: 0.55 });
  b.light(box(0.006, 0.006, 0.006, r.x1 - 0.08, 16 * 0.024 + 0.012, r.z1 - 0.1), "#ff3b3b", IND);
  // зогсоол
  for (let i = 0; i < 6; i++) b.add(box(0.002, 0.0008, 0.03, r.x0 + 0.06 + i * 0.045, 0.0026, r.z1 - 0.05), "#c9d0d6", FMAT.paint, Z);
}

function arena(b: Builder) {
  const r = CIVIC.arena;
  pad(b, r, "#6a7078");
  // Дархан Юнайтед арена: нуман дээвэр, шилэн урд тал, усан бассейны хэсэг
  const ax = r.x0 + 0.22;
  const az = r.z0 + 0.15;
  b.add(box(0.4, 0.06, 0.24, ax, 0, az), "#c4ccd3", FMAT.paint, Z);
  b.add(new THREE.CylinderGeometry(0.12, 0.12, 0.4, 24, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).rotateY(Math.PI / 2).scale(1, 0.38, 1).translate(ax, 0.06, az), "#8fa3b3", FMAT.metal, Z);
  b.light(box(0.36, 0.022, 0.003, ax, 0.02, az + 0.121), "#9fe6ff", LIT);
  b.light(box(0.14, 0.01, 0.003, ax, 0.048, az + 0.121), "#ffffff", LIT);
  block(b, r.x1 - 0.1, az, 0.14, 0.18, 0.05, "#d4dde4", { floors: 2, win: 3, seed: 41 });
  b.shadowRect(ax, az, 0.2, 0.12, 0.1);
  // гадна талбай
  const bx = r.x1 - 0.1;
  const bz = r.z1 - 0.06;
  b.add(box(0.12, 0.003, 0.07, bx, 0, bz), "#a14f3c", FMAT.paint, Z);
  b.add(box(0.11, 0.0035, 0.0015, bx, 0, bz), "#e6ebef", FMAT.paint, Z);
}

// ---------------------------------------------------------------------------------------------
// Үйлдвэрийн бүс

/** Улаан-цагаан судалтай яндан, оройд аврагч гэрэл */
function chimney(b: Builder, x: number, z: number, r0: number, r1: number, h: number) {
  const n = 8;
  for (let i = 0; i < n; i++) {
    const t0 = i / n;
    const t1 = (i + 1) / n;
    b.add(cyl(r0 + (r1 - r0) * t1, r0 + (r1 - r0) * t0, h / n, x, h * t0, z, 14, true), i % 2 ? "#e9eef2" : "#c8423a", FMAT.paint, Z);
  }
  b.light(cyl(r1 * 0.9, r1 * 0.9, 0.006, x, h, z, 10), "#ff4b3a", IND);
  b.shadowCircle(x, z, r0, h, 0.8);
}

function powerPlant(b: Builder) {
  const r = CIVIC.tpp;
  pad(b, r, "#55595e");
  const x = cx(r);
  // зуухны барилга, турбины танхим
  block(b, x + 0.06, r.z0 + 0.1, 0.32, 0.14, 0.24, "#c6cbcf", { roof: "#5a6168", floors: 6, win: 8, seed: 51, lit: 0.45, mat: FMAT.concrete });
  block(b, x + 0.06, r.z0 + 0.28, 0.42, 0.13, 0.12, "#d5d9dc", { roof: "#6a7178", floors: 3, win: 10, seed: 53, lit: 0.5 });
  chimney(b, r.x0 + 0.08, r.z0 + 0.1, 0.032, 0.022, 0.62);
  chimney(b, r.x0 + 0.08, r.z0 + 0.25, 0.032, 0.022, 0.58);
  // хөргөх цамхаг (гипербол)
  const pts = [
    [0.105, 0],
    [0.085, 0.08],
    [0.07, 0.17],
    [0.072, 0.24],
    [0.08, 0.28],
  ].map(([u, v]) => new THREE.Vector2(u, v));
  const tower = new THREE.LatheGeometry(pts, 28);
  b.add(tower.translate(r.x1 - 0.13, 0, r.z1 - 0.12), "#b8bdc1", FMAT.concrete, Z);
  b.shadowCircle(r.x1 - 0.13, r.z1 - 0.12, 0.09, 0.28, 0.8);
  // нүүрсний овоо, тээвэрлэгч
  b.add(new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(0.13, 0.05, 0.06).translate(r.x0 + 0.2, 0, r.z1 - 0.07), "#25272a", FMAT.concrete, Z);
  b.add(rod([r.x0 + 0.3, 0.02, r.z1 - 0.07], [x + 0.06, 0.15, r.z0 + 0.14], 0.006, 4), "#7a8692", FMAT.metal, Z);
  for (const dz of [0.1, 0.28]) b.light(box(0.01, 0.006, 0.01, x - 0.11, 0.25, r.z0 + dz), "#ffd9a0", IND);
}

function steelPlant(b: Builder) {
  const r = CIVIC.steel;
  pad(b, r, "#4f5357");
  // урт цехүүд (хоёр талт дээвэр)
  for (const [i, c] of (["#6f8090", "#5f7486", "#7a8794"] as const).entries()) {
    const z = r.z0 + 0.1 + i * 0.16;
    b.add(box(0.72, 0.07, 0.13, r.x0 + 0.42, 0, z), c, FMAT.paint, Z);
    b.add(gable(0.73, 0.14, 0.03, r.x0 + 0.42, 0.07, z), "#3c4650", FMAT.roof, Z);
    b.shadowRect(r.x0 + 0.42, z, 0.36, 0.065, 0.1);
    for (let k = 0; k < 6; k++) b.light(new THREE.PlaneGeometry(0.04, 0.012).translate(r.x0 + 0.12 + k * 0.12, 0.05, z + 0.066), "#ffb867", IND);
  }
  // хайлуулах зуухны цамхаг, яндан, шаарын овоо
  block(b, r.x1 - 0.1, r.z0 + 0.18, 0.14, 0.14, 0.18, "#8a8f94", { floors: 5, win: 3, seed: 61, lit: 0.35, mat: FMAT.concrete });
  chimney(b, r.x1 - 0.06, r.z1 - 0.12, 0.022, 0.016, 0.42);
  b.add(new THREE.ConeGeometry(0.07, 0.05, 14).translate(r.x1 - 0.12, 0.025, r.z1 - 0.05), "#3a3633", FMAT.concrete, Z);
}

function cementPlant(b: Builder) {
  const r = CIVIC.cement;
  pad(b, r, "#77797a");
  // эргэлддэг зуух (налуу урт цилиндр) + тулгуур
  const kz = cz(r) - 0.04;
  b.add(new THREE.CylinderGeometry(0.024, 0.024, 0.5, 14).rotateZ(Math.PI / 2 - 0.05).translate(cx(r), 0.05, kz), "#9b8f80", FMAT.metal, Z);
  for (let k = 0; k < 4; k++) b.add(box(0.014, 0.04 + k * 0.006, 0.04, cx(r) - 0.2 + k * 0.13, 0, kz), "#8a8c8e", FMAT.concrete, Z);
  b.shadowRect(cx(r), kz, 0.25, 0.024, 0.07, 0.7);
  // халаагч цамхаг, силос, яндан
  block(b, r.x1 - 0.08, kz, 0.08, 0.08, 0.3, "#a7a9ab", { floors: 6, win: 2, seed: 71, lit: 0.3, mat: FMAT.concrete });
  for (let k = 0; k < 4; k++) {
    b.add(cyl(0.042, 0.042, 0.2, r.x0 + 0.07 + k * 0.095, 0, r.z1 - 0.07, 18), "#c3c5c6", FMAT.concrete, Z);
    b.add(cyl(0.006, 0.042, 0.02, r.x0 + 0.07 + k * 0.095, 0.2, r.z1 - 0.07, 18), "#9a9c9e", FMAT.concrete, Z);
    b.shadowCircle(r.x0 + 0.07 + k * 0.095, r.z1 - 0.07, 0.042, 0.22);
  }
  chimney(b, r.x1 - 0.04, r.z0 + 0.06, 0.016, 0.012, 0.36);
}

// ---------------------------------------------------------------------------------------------
// Төв хэсэг (тойргийн өмнөх салаанаас баруун тийш)

function centralBlock(b: Builder) {
  const r = CENTRAL;
  // шатахуун түгээх станц: саравч, түгээгүүр, дэлгүүр, үнийн самбар
  const fx = r.x0 + 0.33;
  const fz = r.z0 + 0.23;
  b.add(box(0.24, 0.0025, 0.2, fx, 0, fz + 0.02), "#4a5058", FMAT.concrete, Z);
  for (const dx of [-0.09, 0.09]) for (const dz of [-0.04, 0.04]) b.add(cyl(0.004, 0.004, 0.045, fx + dx, 0, fz + dz, 6), "#d6dbe0", FMAT.metal, Z);
  b.add(box(0.22, 0.008, 0.12, fx, 0.045, fz), "#e8ecef", FMAT.paint, Z);
  b.light(box(0.222, 0.004, 0.122, fx, 0.049, fz), "#ff4b4b", LIT);
  for (const dx of [-0.06, 0.06]) b.light(box(0.05, 0.0015, 0.03, fx + dx, 0.0445, fz), "#bfb39a", LIT);
  for (const dx of [-0.06, 0, 0.06]) b.add(box(0.012, 0.022, 0.008, fx + dx, 0, fz), "#3b4a59", FMAT.darkMetal, Z);
  block(b, fx, fz + 0.12, 0.13, 0.05, 0.035, "#e2e6ea", { floors: 1, win: 3, seed: 81, lit: 0.95 });
  b.add(box(0.012, 0.07, 0.004, fx - 0.13, 0, fz - 0.07), "#2d3a46", FMAT.darkMetal, Z);
  b.light(box(0.03, 0.03, 0.005, fx - 0.13, 0.055, fz - 0.07), "#ffd34d", LIT);
  // "Өргөө" кино театр
  const kx = r.x1 - 0.27;
  block(b, kx, r.z0 + 0.27, 0.22, 0.16, 0.08, "#3b3f52", { roof: "#2b2f38", floors: 1, win: 4, seed: 83, lit: 0.2 });
  b.light(box(0.2, 0.014, 0.003, kx, 0.06, r.z0 + 0.352), "#ffb347", LIT);
  for (let i = 0; i < 4; i++) b.light(new THREE.PlaneGeometry(0.03, 0.04).translate(kx - 0.075 + i * 0.05, 0.026, r.z0 + 0.352), i % 2 ? "#7fd0ff" : "#ff7fb0", LIT);
  // ОИЦ сургууль (Г хэлбэр) + сагсан бөмбөгийн талбай
  const sx = r.x0 + 0.38;
  const sz = r.z0 + 0.82;
  block(b, sx, sz, 0.34, 0.1, 0.078, "#d8c9a8", { roof: "#2f6c9b", floors: 3, seed: 85 });
  block(b, sx - 0.12, sz + 0.17, 0.1, 0.24, 0.078, "#d8c9a8", { roof: "#2f6c9b", floors: 3, win: 2, seed: 87 });
  b.add(box(0.14, 0.003, 0.09, sx + 0.07, 0, sz + 0.16), "#3f6e8f", FMAT.paint, Z);
  b.add(box(0.13, 0.0035, 0.0015, sx + 0.07, 0, sz + 0.16), "#e6ebef", FMAT.paint, Z);
  // цэцэрлэг: өнгөлөг нам барилга, тоглоомын талбай
  const gx = r.x1 - 0.24;
  const gz = r.z0 + 1.13;
  block(b, gx, gz, 0.18, 0.12, 0.045, "#f1d36b", { roof: "#d0473a", floors: 2, win: 5, seed: 89 });
  b.add(box(0.16, 0.003, 0.09, gx, 0, gz + 0.12), "#4f8a5a", FMAT.grass, Z);
  for (const [dx, c] of [
    [-0.05, "#e5533d"],
    [0, "#3fa9f5"],
    [0.05, "#f2c230"],
  ] as const)
    b.add(box(0.016, 0.014, 0.016, gx + dx, 0.003, gz + 0.12), c, FMAT.paint, Z);
  // "Миний Монгол" цэнгэлдэх хүрээлэн: гүйлтийн зам, хөлбөмбөгийн талбай, индэр, гэрэлтүүлгийн шон
  const tx = cx(r) - 0.05;
  const tz = r.z1 - 0.62;
  b.add(new THREE.CircleGeometry(1, 48).scale(0.42, 0.25, 1).rotateX(-Math.PI / 2).translate(tx, 0.003, tz), "#9a4b36", FMAT.paint, Z);
  b.add(box(0.5, 0.0035, 0.28, tx, 0, tz), "#3f7f4c", FMAT.grass, Z);
  b.add(box(0.002, 0.004, 0.27, tx, 0, tz), "#e6ebef", FMAT.paint, Z);
  b.add(ringH(0.04, 0.0015, tx, 0.004, tz, 20), "#e6ebef", FMAT.paint, Z);
  for (const s of [-1, 1]) {
    const iz = tz + s * 0.3;
    b.add(box(0.62, 0.025, 0.05, tx, 0, iz), "#8a929a", FMAT.concrete, Z);
    b.add(box(0.62, 0.02, 0.03, tx, 0.025, iz + s * 0.01), "#3f6e8f", FMAT.paint, Z);
  }
  b.shadowRect(tx, tz - 0.3, 0.31, 0.025, 0.045);
  b.shadowRect(tx, tz + 0.3, 0.31, 0.025, 0.045);
  for (const dx of [-0.36, 0.36])
    for (const dz of [-0.24, 0.24]) {
      b.add(cyl(0.003, 0.004, 0.16, tx + dx, 0, tz + dz, 6), "#8a96a2", FMAT.metal, Z);
      b.light(box(0.02, 0.012, 0.006, tx + dx, 0.16, tz + dz), "#ffffff", LIT);
    }
}

// ---------------------------------------------------------------------------------------------
// "Миний Монгол" цэцэрлэгт хүрээлэн

/** Монгол Улсын хилийн хялбаршуулсан хэлбэр (уртраг, өргөрөг) */
const MONGOLIA: [number, number][] = [
  [87.8, 49.2], [90.0, 50.4], [92.3, 50.8], [94.6, 50.0], [97.2, 49.8], [98.2, 51.4], [100.0, 51.7], [102.1, 51.3],
  [102.4, 50.3], [106.1, 50.3], [108.0, 49.4], [110.4, 49.2], [114.0, 50.2], [116.6, 49.9], [117.9, 49.5], [116.3, 47.8],
  [119.7, 47.0], [118.5, 46.6], [116.0, 46.3], [113.6, 44.8], [111.9, 45.1], [111.0, 44.0], [110.7, 43.3], [107.8, 42.4],
  [105.0, 41.6], [100.8, 42.6], [96.3, 42.7], [95.3, 44.2], [93.5, 45.0], [90.9, 45.2], [90.6, 47.0], [88.8, 48.0],
];
/** 21 аймгийн төв (ойролцоо) — гэрэлт цэг */
const AIMAGS: [number, number][] = [
  [106.9, 47.9], [105.9, 49.5], [104.1, 49.0], [102.8, 46.3], [101.4, 47.6], [100.2, 49.6], [97.9, 49.9], [91.6, 48.0],
  [89.9, 49.0], [93.6, 50.0], [96.2, 46.4], [99.4, 46.2], [104.4, 43.6], [106.3, 45.8], [110.1, 44.9], [113.3, 46.7],
  [114.5, 48.1], [108.3, 47.3], [105.7, 46.4], [103.5, 48.8], [106.2, 48.8],
];

function park(b: Builder) {
  const r = PARK;
  const mk = MORIN_KHUUR;
  // алхах зам: Морин хуурын цогцолборыг тойрсон цагираг, хүрээлэнгийн дагуух зам
  b.add(new THREE.RingGeometry(mk.r + 0.06, mk.r + 0.085, 64, 1).rotateX(-Math.PI / 2).translate(mk.x, 0.0035, mk.z), "#a39b8c", FMAT.concrete, Z);
  b.add(box(0.025, 0.0035, r.z1 - (mk.z + mk.r + 0.07), mk.x, 0, (mk.z + mk.r + 0.07 + r.z1) / 2), "#a39b8c", FMAT.concrete, Z);
  // 12 ордны хөшөө (тойрог замын дагуу)
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2 + 0.26;
    const x = mk.x + Math.cos(a) * (mk.r + 0.11);
    const z = mk.z + Math.sin(a) * (mk.r + 0.11);
    if (Math.abs(x - FOOTBRIDGE.x) < 0.05 && z < mk.z) continue;
    b.add(box(0.016, 0.014, 0.016, x, 0, z), "#b9b4a8", FMAT.stone, Z);
    b.add(new THREE.IcosahedronGeometry(0.008, 0).scale(1.2, 0.9, 0.8).translate(x, 0.022, z), "#5a5a4c", FMAT.bronze, Z);
    if (k % 3 === 0) lamp(b, x + 0.03, z, 0.045);
  }
  // "Мини Монгол": Монгол Улсын рельеф загвар (шөнө гэрэлтэнэ), 21 аймгийн цэг
  const mx = cx(r) - 0.02;
  const mz = AVENUE_Z - 0.32;
  const W = 0.38;
  const H = 0.17;
  const shape = new THREE.Shape(MONGOLIA.map(([lon, lat]) => new THREE.Vector2(((lon - 103.7) / 32) * W, ((lat - 46.6) / 10.1) * H)));
  b.add(box(W + 0.04, 0.008, H + 0.04, mx, 0, mz), "#8c8a80", FMAT.stone, Z);
  for (const s of [-1, 1]) {
    b.light(box(W + 0.044, 0.003, 0.003, mx, 0.008, mz + s * (H / 2 + 0.021)), "#3f9fd0", LIT);
    b.light(box(0.003, 0.003, H + 0.044, mx + s * (W / 2 + 0.021), 0.008, mz), "#3f9fd0", LIT);
  }
  const relief = new THREE.ExtrudeGeometry(shape, { depth: 0.012, bevelEnabled: false }).rotateX(-Math.PI / 2).translate(mx, 0.008, mz);
  b.add(relief, "#7c9a5a", FMAT.grass, Z);
  for (const [lon, lat] of AIMAGS)
    b.light(box(0.006, 0.004, 0.006, mx + ((lon - 103.7) / 32) * W, 0.021, mz - ((lat - 46.6) / 10.1) * H), "#ffe08a", LIT);
  // цөөрөм, гүүр
  const px = r.x0 + 0.3;
  const pz = AVENUE_Z + 0.4;
  b.add(new THREE.CircleGeometry(1, 40).scale(0.2, 0.13, 1).rotateX(-Math.PI / 2).translate(px, 0.0025, pz), "#8a8577", FMAT.stone, Z);
  b.pool(new THREE.CircleGeometry(1, 40).scale(0.185, 0.118, 1).rotateX(-Math.PI / 2).translate(px, 0.004, pz), 3);
  b.add(box(0.12, 0.008, 0.018, px, 0.004, pz), "#a0522d", FMAT.paint, Z);
  // хүүхдийн галт тэрэг (зууван зам + жижиг тэрэг)
  const kx = r.x0 + 0.36;
  const kz = AVENUE_Z + 0.78;
  b.add(new THREE.RingGeometry(0.95, 1.0, 48, 1).scale(0.22, 0.12, 1).rotateX(-Math.PI / 2).translate(kx, 0.004, kz), "#4a4038", FMAT.darkMetal, Z);
  for (let k = 0; k < 4; k++) {
    const a = -0.9 + k * 0.32;
    b.add(box(0.03, 0.014, 0.014, 0, 0, 0).rotateY(-a - Math.PI / 2).translate(kx + Math.cos(a) * 0.215, 0.004, kz + Math.sin(a) * 0.118), ["#d0473a", "#f2c230", "#3fa9f5", "#4caf50"][k], FMAT.paint, Z);
  }
  // усан парк: усан сан, гулсуур, барилга
  const wx = r.x1 - 0.3;
  const wz = r.z1 - 0.18;
  b.add(box(0.36, 0.006, 0.24, wx, 0, wz), "#c9cfd4", FMAT.concrete, Z);
  b.pool(new THREE.PlaneGeometry(0.16, 0.1).rotateX(-Math.PI / 2).translate(wx - 0.08, 0.0065, wz + 0.04), 3);
  b.pool(new THREE.CircleGeometry(0.05, 24).rotateX(-Math.PI / 2).translate(wx + 0.1, 0.0065, wz + 0.05), 3);
  block(b, wx, wz - 0.08, 0.3, 0.07, 0.04, "#e8f1f6", { roof: "#3fa9f5", floors: 1, win: 6, seed: 91 });
  b.add(box(0.03, 0.09, 0.03, wx + 0.13, 0, wz - 0.03), "#f2c230", FMAT.paint, Z);
  for (let k = 0; k < 10; k++) {
    const t0 = k / 10;
    const t1 = (k + 1) / 10;
    const p = (t: number): [number, number, number] => [wx + 0.13 - Math.sin(t * 5) * 0.04 - t * 0.06, 0.09 * (1 - t) + 0.008, wz - 0.03 + Math.cos(t * 5) * 0.04 + t * 0.08];
    b.add(rod(p(t0), p(t1), 0.006, 6), k % 2 ? "#e5533d" : "#3fa9f5", FMAT.paint, Z);
  }
  // гэрэлтүүлэг
  for (let z = r.z0 + 0.1; z < r.z1; z += 0.32) lamp(b, mk.x + 0.02, z, 0.05);
}

// ---------------------------------------------------------------------------------------------
// Дархан овоо

function ovooHill(b: Builder) {
  const { x, z, r, h } = OVOO_HILL;
  mound(b, x, z, r, h);
  // чулуун овоо, хадагтай шон
  b.add(new THREE.ConeGeometry(0.035, 0.035, 10).translate(x, h + 0.012, z), "#8f8a80", FMAT.concrete, Z);
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * Math.PI * 2;
    b.add(new THREE.IcosahedronGeometry(0.008, 0).translate(x + Math.cos(a) * 0.03, h + 0.003, z + Math.sin(a) * 0.03), "#7d776c", FMAT.concrete, Z);
  }
  b.add(cyl(0.0015, 0.0015, 0.09, x, h, z, 4), "#6b4a2b", FMAT.paint, Z);
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2;
    b.add(rod([x, h + 0.085, z], [x + Math.cos(a) * 0.04, h + 0.02, z + Math.sin(a) * 0.04], 0.0012, 3), "#3f86d6", FMAT.paint, Z);
  }
  b.light(box(0.006, 0.006, 0.006, x, h + 0.092, z), "#9fd6ff", LIT);
}

export function civic(b: Builder) {
  government(b);
  darkhan50(b);
  hospital(b);
  colleges(b);
  theatre(b);
  market(b);
  arena(b);
  powerPlant(b);
  steelPlant(b);
  cementPlant(b);
  centralBlock(b);
  park(b);
  ovooHill(b);
}

/** Санамсаргүй мод орохгүй бүс (нийтийн байгууламж, цэцэрлэгт хүрээлэн — мод нь civicTrees-ээр) */
export function civicKeepOut(x: number, z: number) {
  return inRect(x, z, PARK, 0.02) || inRect(x, z, CENTRAL, 0.02) || Math.hypot(x - OVOO_HILL.x, z - OVOO_HILL.z) < 0.1;
}

/** Цэцэрлэгт хүрээлэн, төв хэсэг, нийтийн байгууламжийн хашааны мод (детерминистик) */
export function civicTrees() {
  const out: { x: number; z: number; s: number; conifer: boolean }[] = [];
  const mk = MORIN_KHUUR;
  const r = PARK;
  const mx = cx(r) - 0.02;
  const mz = AVENUE_Z - 0.32;
  // хүрээлэнгийн мод: онцлох объект, зам, хоолойноос зайтай
  const parkFree = (x: number, z: number) =>
    Math.hypot(x - mk.x, z - mk.z) > mk.r + 0.14 &&
    !(Math.abs(x - mx) < 0.25 && Math.abs(z - mz) < 0.13) &&
    Math.abs(z - (AVENUE_Z - 0.16)) > 0.06 &&
    Math.abs(z - AVENUE_Z) > 0.13 &&
    !(Math.abs(x - mk.x) < 0.04 && z > mk.z) &&
    !(Math.abs(x - FOOTBRIDGE.x) < 0.06 && z < mk.z) &&
    Math.hypot((x - (r.x0 + 0.3)) / 0.24, (z - (AVENUE_Z + 0.4)) / 0.17) > 1 &&
    Math.hypot((x - (r.x0 + 0.36)) / 0.26, (z - (AVENUE_Z + 0.78)) / 0.16) > 1 &&
    !(x > r.x1 - 0.5 && z > r.z1 - 0.32);
  for (let x = r.x0 + 0.04; x < r.x1 - 0.02; x += 0.065)
    for (let z = r.z0 + 0.06; z < r.z1 - 0.02; z += 0.065) {
      const jx = x + (hash(x, z) - 0.5) * 0.04;
      const jz = z + (hash(z, x) - 0.5) * 0.04;
      if (hash(jx * 3, jz * 5) < 0.3 || !parkFree(jx, jz)) continue;
      out.push({ x: jx, z: jz, s: 0.65 + hash(jx, jz * 2) * 0.35, conifer: hash(jz, jx * 2) < 0.3 });
    }
  // төв хэсэг: цэнгэлдэхийг тойрсон, сургуулийн хашааны мод
  const c = CENTRAL;
  for (let x = c.x0 + 0.04; x < c.x1; x += 0.08) {
    out.push({ x, z: c.z1 - 0.02, s: 0.75, conifer: false });
    out.push({ x, z: c.z1 - 1.0, s: 0.7, conifer: hash(x, 1) < 0.3 });
  }
  for (let z = c.z0 + 0.5; z < c.z1 - 1.05; z += 0.08) out.push({ x: c.x1 - 0.02, z, s: 0.72, conifer: false });
  // нийтийн барилгын хашааны хажуугийн мод
  for (const q of [CIVIC.government, CIVIC.hospital, CIVIC.colleges, CIVIC.arena, CIVIC.d50]) {
    for (let z = q.z0 + 0.03; z < q.z1; z += 0.075) {
      out.push({ x: q.x0 + 0.015, z, s: 0.7, conifer: false });
      out.push({ x: q.x1 - 0.015, z, s: 0.7, conifer: false });
    }
  }
  return out;
}
