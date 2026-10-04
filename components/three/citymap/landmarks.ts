import * as THREE from "three";
import { BILEG_MOUND, BUDDHA_HILL, FOOTBRIDGE, HQ, moundHeight, MORIN_KHUUR, ROUNDABOUT } from "./layout";
import { Builder, box, cyl, fence, FMAT, KEY, ringH, rod, ZONE } from "./builder";

/**
 * Дурсгалт газрууд (схемийн хэмжээ — газрын зураг дээр танигдахуйц бага зэрэг томсгосон):
 * "Дархан Ус Суваг" ХК-ийн байр, Бурхантай уул (алтан Будда, суварга), Билэг тэмдэг №1, Морин хуур цогцолбор,
 * улбар шар татлагат явган гүүр, авто замын тойргийн арал (Дархан хотын бэлгэ тэмдэг хөшөө, цэцгийн мандал).
 * Бүгд "хот" бүсэд (онцлох үед тод), гэрэл нь үйлчилгээний (байнга асаалттай).
 */
const Z = ZONE.city;
const LIT = KEY.service;
const STONE = "#c4c8cb";
const ORANGE = "#cf5a2c";
const BRONZE = "#4b5049";
const GOLD = "#d9a633";

/** Профиль: h·(1 − q²)² (layout.moundHeight-тэй ижил), ирмэг нь газар доор бага зэрэг орно */
export function mound(b: Builder, cx: number, cz: number, r: number, h: number) {
  const g = new THREE.RingGeometry(0.002, r, 56, 14).rotateX(-Math.PI / 2);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const q = Math.min(Math.hypot(x, z) / r, 1);
    const wob = 1 + 0.06 * Math.sin(Math.atan2(z, x) * 3 + 1.3) * q;
    pos.setY(i, h * wob * (1 - q * q) ** 2 + 0.002 - 0.007 * q * q);
  }
  g.translate(cx, 0, cz);
  g.computeVertexNormals();
  b.add(g, "#4a6b4b", FMAT.grass, Z);
  b.shadowCircle(cx, cz, r * 0.62, h, 0.45);
}

/** Толгодын урд (+z) налуугаар оройн талбай хүртэл өгсөх шат (sx — шатны x, толгойн төвөөс хазайж болно) */
function stairs(b: Builder, sx: number, hx: number, cz: number, r: number, top: number, w: number) {
  const n = 16;
  const end = Math.sqrt(Math.max(r * r - (sx - hx) ** 2, 0));
  const dz = (end - top) / n;
  for (let i = 0; i < n; i++) {
    const z = cz + top + dz * (i + 0.5);
    const y = moundHeight(sx, z - dz / 2) + 0.003;
    b.add(box(w, y, dz * 1.02, sx, 0, z), "#948f85", FMAT.concrete, Z);
  }
  // хоёр талын хашлага (цагаан)
  for (const s of [-1, 1]) {
    for (let i = 0; i < n; i += 2) {
      const z = cz + top + dz * (i + 0.5);
      b.add(box(0.006, moundHeight(sx, z - dz / 2) + 0.012, dz * 2, sx + s * (w / 2 + 0.003), 0, z), STONE, FMAT.stone, Z);
    }
  }
}

/** Суварга: дөрвөлжин суурь, бөмбөгөр, алтан оргил */
function stupa(b: Builder, x: number, y: number, z: number, s = 1) {
  b.add(box(0.02 * s, 0.008 * s, 0.02 * s, x, y, z), STONE, FMAT.stone, Z);
  b.add(box(0.015 * s, 0.004 * s, 0.015 * s, x, y + 0.008 * s, z), STONE, FMAT.stone, Z);
  b.add(new THREE.SphereGeometry(0.009 * s, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 1.15, 1).translate(x, y + 0.012 * s, z), STONE, FMAT.stone, Z);
  b.add(new THREE.ConeGeometry(0.0035 * s, 0.018 * s, 8).translate(x, y + 0.031 * s, z), GOLD, FMAT.gold, Z);
}

/** Хурдан морь: их бие −x руу харсан (galloping — урд/хойд хөл сунасан, эсвэл зогсож буй) */
function horse(b: Builder, x: number, y: number, z: number, s: number, gallop: boolean, color = BRONZE) {
  const add = (g: THREE.BufferGeometry) => b.add(g, color, FMAT.bronze, Z);
  const P = (dx: number, dy: number, dz = 0): [number, number, number] => [x + dx * s, y + dy * s, z + dz * s];
  add(new THREE.SphereGeometry(1, 12, 8).scale(0.026 * s, 0.009 * s, 0.0085 * s).translate(...P(0, 0.026)));
  add(rod(P(-0.018, 0.029), P(-0.031, 0.043), 0.0048 * s, 6));
  add(new THREE.SphereGeometry(1, 10, 6).scale(0.0095 * s, 0.0045 * s, 0.0045 * s).rotateZ(-0.5).translate(...P(-0.036, 0.042)));
  add(rod(P(0.024, 0.03), P(0.046, gallop ? 0.024 : 0.012), 0.0028 * s, 5));
  for (const dz of [-0.0045, 0.0045]) {
    if (gallop) {
      add(rod(P(-0.016, 0.022, dz), P(-0.036, 0.011, dz), 0.0024 * s, 5));
      add(rod(P(0.017, 0.022, dz), P(0.039, 0.01, dz), 0.0024 * s, 5));
    } else {
      for (const dx of [-0.016, 0.017]) add(rod(P(dx, 0.022, dz), P(dx, 0, dz), 0.0022 * s, 5));
    }
  }
}

// ---------------------------------------------------------------------------------------------

/** "Дархан Ус Суваг" ХК: 3 давхар, доод давхар цэнхэр, дээд давхрууд шар/цэнхэр босоо зурвастай, дээвэр дээр улаан бичигтэй самбар */
function headquarters(b: Builder) {
  const { x, z, w, d, h } = HQ;
  const fz = z + d / 2;
  const fl = h / 3;
  const YELLOW = "#e9bd2e";
  const BLUE = "#2b7fd0";
  // зогсоол + хашаа
  b.add(box(w + 0.16, 0.003, d + 0.24, x, 0, z + 0.045), "#3a4048", FMAT.concrete, Z);
  for (let i = 0; i < 7; i++) b.add(box(0.002, 0.0008, 0.03, x - 0.15 + i * 0.05, 0.003, fz + 0.09), "#c9d0d6", FMAT.paint, Z);
  fence(b, x - w / 2 - 0.08, z - d / 2 - 0.06, x + w / 2 + 0.08, fz + 0.165, Z, 0.012, "#2b3138");
  // их бие
  b.add(box(w, h, d, x, 0, z), YELLOW, FMAT.paint, Z);
  b.add(box(w + 0.003, fl, d + 0.003, x, 0, z), BLUE, FMAT.paint, Z);
  b.add(box(w + 0.007, 0.005, d + 0.007, x, h, z), "#6a737c", FMAT.roof, Z);
  b.add(box(w + 0.009, 0.004, d + 0.009, x, h - 0.004, z), YELLOW, FMAT.paint, Z);
  // урд фасад: цонхны багана бүр цэнхэр зурвас дээр (шар баганууд хооронд нь)
  const cols = 9;
  const cw = (w - 0.04) / cols;
  const hashW = (i: number, j: number) => {
    const s = Math.sin(i * 12.9898 + j * 78.233) * 43758.5453;
    return s - Math.floor(s);
  };
  for (let i = 0; i < cols; i++) {
    const wx = x - w / 2 + 0.02 + cw * (i + 0.5);
    b.add(box(cw * 0.62, h - fl - 0.006, 0.002, wx, fl, fz + 0.001), BLUE, FMAT.paint, Z);
    for (let j = 0; j < 3; j++) {
      if (j === 0 && i === 4) continue;
      const r = hashW(i, j);
      const col = r < 0.25 ? "#5d6874" : r < 0.6 ? "#ffe2b3" : "#dff3ff";
      b.light(new THREE.PlaneGeometry(cw * 0.5, fl * 0.42).translate(wx, fl * j + fl * 0.55, fz + 0.0035), col, LIT);
    }
  }
  // хажуу фасад (баруун, зүүн): шар, цонхтой
  for (const s of [-1, 1]) {
    for (let k = 0; k < 3; k++)
      for (let j = 0; j < 3; j++) {
        const g = new THREE.PlaneGeometry(0.02, fl * 0.42).rotateY((s * Math.PI) / 2).translate(x + s * (w / 2 + 0.0035), fl * j + fl * 0.55, z - d / 2 + 0.035 + k * 0.04);
        b.light(g, hashW(k + s * 5, j) < 0.4 ? "#5d6874" : "#ffe2b3", LIT);
      }
  }
  // орц: шилэн хаалга, саравч
  b.add(box(0.034, fl * 0.8, 0.003, x, 0, fz + 0.0025), "#1b2a36", FMAT.darkMetal, Z);
  b.add(box(0.06, 0.003, 0.02, x, fl * 0.86, fz + 0.01), "#3f474f", FMAT.roof, Z);
  b.light(box(0.016, 0.002, 0.004, x, fl * 0.82, fz + 0.004), "#fff0cf", LIT);
  // дээвэр: самбар (бараан хүрээ + улаан гэрэлт бичиг), лого
  const sy = h + 0.006;
  for (const dx of [-0.13, 0, 0.13]) b.add(box(0.003, 0.012, 0.003, x + 0.02 + dx, sy, fz - 0.03), "#2a3036", FMAT.darkMetal, Z);
  b.add(box(0.3, 0.024, 0.004, x + 0.02, sy + 0.01, fz - 0.03), "#1c2329", FMAT.darkMetal, Z);
  b.light(new THREE.PlaneGeometry(0.27, 0.011).translate(x + 0.03, sy + 0.022, fz - 0.0275), "#ff4b4b", LIT);
  b.light(new THREE.CircleGeometry(0.009, 18).translate(x - 0.115, sy + 0.022, fz - 0.0275), "#3fa9f5", LIT);
  b.add(box(0.05, 0.012, 0.03, x - 0.12, sy, z - 0.02), "#7a8692", FMAT.metal, Z);
  // туг (3 шон)
  for (let i = 0; i < 3; i++) {
    const px = x + w / 2 - 0.02 - i * 0.022;
    const pz = fz + 0.05;
    b.add(cyl(0.0012, 0.0012, 0.075, px, 0, pz, 5), "#c9d0d6", FMAT.metal, Z);
    b.add(new THREE.PlaneGeometry(0.02, 0.012).translate(px + 0.01, 0.066, pz), i === 1 ? "#0f4fa8" : "#c8102e", FMAT.paint, Z);
  }
  b.shadowRect(x, z, w / 2, d / 2, h + 0.02);
}

/** Бурхантай уул: дугуй толгод, урд талын шат, найман өнцөгт цагаан суурь, алтан Будда, суварганууд */
function buddhaHill(b: Builder) {
  const { x, z, r, h } = BUDDHA_HILL;
  mound(b, x, z, r, h);
  const sx = x - 0.1;
  stairs(b, sx, x, z, r, 0.13, 0.05);
  const y0 = h - 0.008;
  // найман өнцөгт суурь, алтан хүрээ
  b.add(cyl(0.125, 0.13, 0.03, x, y0, z, 8), STONE, FMAT.stone, Z);
  b.add(cyl(0.127, 0.127, 0.005, x, y0 + 0.024, z, 8), GOLD, FMAT.gold, Z);
  const y1 = y0 + 0.03;
  // дугуй тавцан (алтан чимэглэлтэй), бадамлянхуа
  b.add(cyl(0.075, 0.08, 0.022, x, y1, z, 32), STONE, FMAT.stone, Z);
  b.add(cyl(0.0775, 0.0775, 0.007, x, y1 + 0.008, z, 32), GOLD, FMAT.gold, Z);
  b.add(cyl(0.064, 0.052, 0.012, x, y1 + 0.022, z, 24), GOLD, FMAT.gold, Z);
  // Будда (урагш, камер руу харсан, бясалгалын байрлал)
  const y2 = y1 + 0.034;
  const G = (g: THREE.BufferGeometry) => b.add(g, GOLD, FMAT.gold, Z);
  const sph = () => new THREE.SphereGeometry(1, 22, 14);
  G(sph().scale(0.054, 0.017, 0.036).translate(x, y2 + 0.014, z + 0.004));
  G(sph().scale(0.031, 0.044, 0.022).translate(x, y2 + 0.052, z - 0.004));
  G(sph().scale(0.04, 0.016, 0.022).translate(x, y2 + 0.076, z - 0.004));
  for (const s of [-1, 1]) G(sph().scale(0.011, 0.03, 0.012).rotateZ(s * 0.35).translate(x + s * 0.032, y2 + 0.052, z + 0.004));
  G(cyl(0.008, 0.009, 0.012, x, y2 + 0.084, z - 0.004, 12));
  G(sph().scale(0.016, 0.019, 0.016).translate(x, y2 + 0.106, z - 0.002));
  // үс, оройн товгор (хар хөх), аяга (цэнхэр)
  b.add(sph().scale(0.0165, 0.012, 0.0165).translate(x, y2 + 0.115, z - 0.004), "#1d2c4a", FMAT.paint, Z);
  b.add(new THREE.SphereGeometry(0.007, 12, 8).translate(x, y2 + 0.128, z - 0.004), "#1d2c4a", FMAT.paint, Z);
  b.add(cyl(0.012, 0.008, 0.009, x, y2 + 0.026, z + 0.026, 14), "#2a5fa8", FMAT.paint, Z);
  // суварганууд (оройн тавцангийн ирмэгээр), гэрэлтүүлэг
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2 + Math.PI / 8;
    stupa(b, x + Math.cos(a) * 0.104, y1, z + Math.sin(a) * 0.104, 0.9);
    b.light(box(0.008, 0.004, 0.008, x + Math.cos(a + Math.PI / 8) * 0.118, y1, z + Math.sin(a + Math.PI / 8) * 0.118), "#ffe2b0", LIT);
  }
  // шатны гэрэл
  for (const t of [0.32, 0.62, 0.9]) {
    const zz = z + 0.13 + (r - 0.15) * t;
    for (const s of [-1, 1]) {
      const yy = moundHeight(sx + s * 0.04, zz);
      b.add(cyl(0.002, 0.003, 0.05, sx + s * 0.04, yy, zz, 5), "#56636f", FMAT.darkMetal, Z);
      b.light(box(0.008, 0.005, 0.008, sx + s * 0.04, yy + 0.05, zz), "#ffe2b0", LIT);
    }
  }
  b.shadowCircle(x, z, 0.13, 0.05, 0.6);
}

/** Билэг тэмдэг №1: жижиг толгод, шат, дугуй тавцан, цөцгий өнгийн цэцэг хэлбэрийн хөшөө (4 дэлбээ + төв шон, цагираг) */
function bilegMonument(b: Builder) {
  const { x, z, r, h } = BILEG_MOUND;
  mound(b, x, z, r, h);
  stairs(b, x, x, z, r, 0.08, 0.04);
  const y0 = h - 0.004;
  b.add(cyl(0.078, 0.082, 0.012, x, y0, z, 32), "#cfcabd", FMAT.concrete, Z);
  b.add(ringH(0.06, 0.003, x, y0 + 0.0125, z, 32), "#7d776a", FMAT.concrete, Z);
  const y1 = y0 + 0.012;
  const CREAM = "#cdbf9f";
  // дэлбээ: гадна ирмэг газраас муруйгаар дээш нарийсна (дэлбээний профиль — u радиаль, v өндөр)
  const petal = new THREE.Shape();
  petal.moveTo(0.006, 0);
  petal.lineTo(0.082, 0);
  petal.quadraticCurveTo(0.05, 0.012, 0.034, 0.07);
  petal.quadraticCurveTo(0.022, 0.13, 0.015, 0.205);
  petal.lineTo(0.009, 0.215);
  petal.quadraticCurveTo(0.007, 0.12, 0.012, 0.05);
  petal.quadraticCurveTo(0.018, 0.016, 0.006, 0.012);
  petal.closePath();
  for (let k = 0; k < 4; k++) {
    const g = new THREE.ExtrudeGeometry(petal, { depth: 0.007, bevelEnabled: false, curveSegments: 10 }).translate(0, 0, -0.0035);
    b.add(g.rotateY((k * Math.PI) / 2 + Math.PI / 4).translate(x, y1, z), CREAM, FMAT.stone, Z);
  }
  b.add(box(0.012, 0.25, 0.016, x, y1, z), CREAM, FMAT.stone, Z);
  b.add(new THREE.ConeGeometry(0.008, 0.03, 4).rotateY(Math.PI / 4).translate(x, y1 + 0.265, z), CREAM, FMAT.stone, Z);
  b.add(ringH(0.019, 0.0028, x, y1 + 0.15, z, 24), "#8a7448", FMAT.bronze, Z);
  b.add(box(0.016, 0.016, 0.003, x, y1 + 0.118, z + 0.0095), "#6b5a3a", FMAT.bronze, Z);
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2;
    b.light(box(0.008, 0.004, 0.008, x + Math.cos(a) * 0.065, y1, z + Math.sin(a) * 0.065), "#ffe2b0", LIT);
  }
  b.shadowCircle(x, z, 0.03, 0.28, 0.7);
}

/** Морин хуур цогцолбор: өнгөт хавтанцартай дугуй талбай, тахир хана, цагаан налуу хөшөө + морьтон хуурч, унага, усан толь */
function morinKhuur(b: Builder) {
  const { x, z, r } = MORIN_KHUUR;
  b.add(cyl(r, r + 0.012, 0.006, x, 0, z, 48), "#8d8a80", FMAT.concrete, Z);
  // хавтанцар: хөшөөнөөс урд руу зам, хөшөөг тойрсон зурвас
  const TILE = ["#c98f8f", "#7fb5a8", "#d9c47e", "#9aa8c9"];
  let t = 0;
  for (let zz = z + 0.07; zz < z + 0.13; zz += 0.022)
    for (const dx of [-0.011, 0.011]) b.add(box(0.02, 0.0012, 0.02, x + dx, 0.006, zz), TILE[t++ % 4], FMAT.paint, Z);
  for (let k = 0; k < 20; k++) {
    const a = (k / 20) * Math.PI * 2;
    b.add(box(0.02, 0.0012, 0.02, x + Math.cos(a) * 0.075, 0.006, z + Math.sin(a) * 0.075).rotateY(0), TILE[(k + 1) % 4], FMAT.paint, Z);
  }
  // хойд талын тахир хана, чулуу
  const wr = 0.24;
  const n = 18;
  for (let k = 0; k < n; k++) {
    const a0 = Math.PI + (k / n) * Math.PI;
    const a1 = Math.PI + ((k + 1) / n) * Math.PI;
    const am = (a0 + a1) / 2;
    // гүүрний шатнаас орох зам (−z тал) — ханан дунд гарц
    if (Math.abs(am - Math.PI * 1.5) < 0.3) continue;
    const len = wr * (a1 - a0) * 1.02;
    b.add(box(len, 0.024, 0.012, 0, 0, 0).rotateY(-am - Math.PI / 2).translate(x + Math.cos(am) * wr, 0.006, z + Math.sin(am) * wr), "#c19a8c", FMAT.concrete, Z);
  }
  for (let k = 0; k < 14; k++) {
    const a = Math.PI * 1.05 + (k / 13) * Math.PI * 0.9;
    const rr = 0.26 + 0.025 * Math.sin(k * 2.7);
    const s = 0.01 + 0.006 * ((k * 7) % 3);
    b.add(new THREE.IcosahedronGeometry(s, 0).scale(1.3, 0.8, 1).translate(x + Math.cos(a) * rr, 0.006 + s * 0.5, z + Math.sin(a) * rr), "#9a7a5c", FMAT.concrete, Z);
  }
  // хөшөөний суурь: дөрвөлжин, доошоо налж өргөсдөг цагаан (4 талт lathe)
  const prof = [
    [0.074, 0],
    [0.062, 0.012],
    [0.047, 0.035],
    [0.036, 0.07],
    [0.03, 0.11],
    [0.028, 0.13],
    [0.0001, 0.13],
  ].map(([u, v]) => new THREE.Vector2(u, v));
  const ped = new THREE.LatheGeometry(prof, 4, Math.PI / 4).toNonIndexed();
  ped.computeVertexNormals();
  b.add(ped.translate(x, 0.006, z), STONE, FMAT.stone, Z);
  b.add(box(0.012, 0.045, 0.002, x, 0.04, z + 0.031), "#c8ccc8", FMAT.concrete, Z);
  b.add(box(0.05, 0.012, 0.026, x, 0.136, z), "#3b3f3d", FMAT.darkMetal, Z);
  // морьтон хуурч: долгион/үүлэн суурь, хурдан морь, хүн, морин хуур
  const y1 = 0.148;
  b.add(new THREE.SphereGeometry(1, 14, 8).scale(0.036, 0.008, 0.015).translate(x, y1 + 0.004, z), BRONZE, FMAT.bronze, Z);
  horse(b, x, y1, z, 1, true);
  b.add(rod([x + 0.002, y1 + 0.034, z], [x + 0.009, y1 + 0.056, z], 0.0055, 6), BRONZE, FMAT.bronze, Z);
  b.add(new THREE.SphereGeometry(0.0058, 10, 8).translate(x + 0.01, y1 + 0.063, z), BRONZE, FMAT.bronze, Z);
  b.add(rod([x - 0.002, y1 + 0.036, z + 0.004], [x - 0.016, y1 + 0.078, z + 0.004], 0.0014, 4), BRONZE, FMAT.bronze, Z);
  b.add(box(0.007, 0.01, 0.004, x - 0.004, y1 + 0.034, z + 0.004), BRONZE, FMAT.bronze, Z);
  // унаганууд
  for (const [dx, dz, rot] of [
    [-0.16, 0.06, 0.5],
    [0.17, 0.08, Math.PI + 0.3],
    [0.14, -0.1, Math.PI - 0.6],
  ]) {
    const hb = new Builder();
    horse(hb, 0, 0.006, 0, 0.55, false);
    for (const g of hb.body) {
      g.rotateY(rot).translate(x + dx, 0, z + dz);
      b.body.push(g);
    }
  }
  // усан толь (урд), хүрээ
  const pz = z + 0.19;
  b.add(box(0.27, 0.007, 0.085, x, 0, pz), "#9a9890", FMAT.concrete, Z);
  b.pool(new THREE.PlaneGeometry(0.255, 0.07).rotateX(-Math.PI / 2).translate(x, 0.0072, pz), 3);
  // гэрэлтүүлэг
  for (let k = 0; k < 4; k++) {
    const a = Math.PI / 4 + (k * Math.PI) / 2;
    const lx = x + Math.cos(a) * 0.27;
    const lz = z + Math.sin(a) * 0.27;
    b.add(cyl(0.002, 0.003, 0.07, lx, 0, lz, 5), "#56636f", FMAT.darkMetal, Z);
    b.light(box(0.01, 0.006, 0.01, lx, 0.07, lz), "#ffe2b0", LIT);
  }
  for (const s of [-1, 1]) b.light(box(0.008, 0.004, 0.008, x + s * 0.05, 0.006, z + 0.05), "#ffe2b0", LIT);
  b.shadowRect(x, z, 0.045, 0.045, 0.2, 0.9);
}

/**
 * Явган хүний татлагат гүүр: улбар шар хоёр П хэлбэрийн тулгуур, татлага, цагаан хашлага. Авто замыг (x тэнхлэг) хөндлөн
 * z чиглэлд гатална: эхлэл нь Бурхантай уулын энгэрт, төгсгөл нь шатаар Морин хуурын цогцолбор руу буух.
 * Орон нутгийн тэнхлэгт (тавцан +x) байгуулаад −90° эргүүлнэ: (lx, lz) → (X − lz, lx).
 */
function footbridge(b: Builder) {
  const { x: X, z0, z1, y, width: W, pylons, stairs: sl } = FOOTBRIDGE;
  const f = new Builder();
  const L = z1 - z0;
  const cx = (z0 + z1) / 2;
  f.add(box(L, 0.012, W, cx, y - 0.012, 0), ORANGE, FMAT.paint, Z);
  f.add(box(L, 0.0015, W - 0.008, cx, y, 0), "#8a6656", FMAT.grating, Z);
  for (const s of [-1, 1]) {
    const rz = s * (W / 2 - 0.002);
    f.add(new THREE.PlaneGeometry(L, 0.016).translate(cx, y + 0.009, rz), "#c9d0d6", FMAT.grating, Z);
    f.add(box(L, 0.003, 0.004, cx, y + 0.017, rz), "#e6ebef", FMAT.metal, Z);
    for (let px = z0 + 0.1; px < z1; px += 0.22) f.light(box(0.006, 0.004, 0.006, px, y + 0.02, rz), "#ffe2b0", LIT);
  }
  // П тулгуур + татлага (авто замын хоёр талд)
  const top = 0.3;
  for (const px of pylons) {
    for (const s of [-1, 1]) f.add(box(0.013, top, 0.013, px, 0, s * 0.04), ORANGE, FMAT.paint, Z);
    f.add(box(0.013, 0.014, 0.093, px, top - 0.014, 0), ORANGE, FMAT.paint, Z);
    f.add(box(0.01, 0.01, 0.093, px, 0.205, 0), ORANGE, FMAT.paint, Z);
    f.add(box(0.01, 0.01, 0.093, px, y - 0.024, 0), ORANGE, FMAT.paint, Z);
    f.light(box(0.008, 0.005, 0.008, px, top + 0.001, 0), "#ff5a3c", LIT);
    for (const s of [-1, 1])
      for (const d of [-0.27, -0.18, -0.09, 0.09, 0.18, 0.27]) {
        const ex = Math.min(Math.max(px + d, z0 + 0.02), z1 - 0.02);
        f.add(rod([px, top - 0.01, s * 0.04], [ex, y + 0.012, s * (W / 2)], 0.0011, 4), "#dfe4e8", FMAT.metal, Z);
      }
    b.shadowRect(X, px, 0.047, 0.007, top, 0.7);
  }
  // төгсгөлийн шат (газар хүртэл)
  const n = 12;
  const dx = sl / n;
  for (let i = 0; i < n; i++) f.add(box(dx * 1.02, y * (1 - (i + 0.5) / n), W, z1 + dx * (i + 0.5), 0, 0), "#8d9399", FMAT.concrete, Z);
  for (const s of [-1, 1]) f.add(rod([z1, y + 0.017, s * (W / 2)], [z1 + sl, 0.017, s * (W / 2)], 0.002, 5), "#e6ebef", FMAT.metal, Z);
  // уулын талын тулгуур (энгэрт суурилна)
  const base = moundHeight(X, z0 + 0.03);
  for (const s of [-1, 1]) f.add(box(0.009, y - 0.012 - base + 0.004, 0.009, z0 + 0.03, base - 0.004, s * 0.017), ORANGE, FMAT.paint, Z);
  for (const list of [f.body, f.lights])
    for (const g of list) {
      g.rotateY(-Math.PI / 2).translate(X, 0, 0);
      (list === f.body ? b.body : b.lights).push(g);
    }
  b.shadowRect(X, cx, W / 2, L / 2, y, 0.55);
}

/** Авто замын тойргийн арал: хашлага, зүлэг, радиаль зам, цэцгийн мандал, төвд — хоёр цагаан багана, давхар цагиргат хөшөө */
function roundaboutIsland(b: Builder) {
  const [x, z] = ROUNDABOUT.c;
  const r = ROUNDABOUT.rIn;
  // гадна талын явган зам (салаа замуудын хооронд)
  const ro = ROUNDABOUT.rOut;
  const arms = [...ROUNDABOUT.arms].map((m) => ({ a: m.a, gap: Math.asin(Math.min(m.half / ro, 0.99)) })).sort((p, q) => p.a - q.a);
  for (let k = 0; k < arms.length; k++) {
    const p = arms[k];
    const q = arms[(k + 1) % arms.length];
    const a0 = p.a + p.gap;
    const a1 = q.a + (k === arms.length - 1 ? Math.PI * 2 : 0) - q.gap;
    if (a1 - a0 < 0.05) continue;
    b.add(new THREE.RingGeometry(ro, ro + 0.034, 16, 1, a0, a1 - a0).rotateX(Math.PI / 2).translate(x, 0.012, z), "#606a74", FMAT.concrete, Z);
  }
  b.add(cyl(r, r, 0.01, x, 0, z, 72, true), "#b9bfc4", FMAT.concrete, Z);
  b.add(new THREE.RingGeometry(r - 0.012, r, 72, 1).rotateX(-Math.PI / 2).translate(x, 0.01, z), "#b9bfc4", FMAT.concrete, Z);
  b.add(new THREE.CircleGeometry(r - 0.012, 72).rotateX(-Math.PI / 2).translate(x, 0.0085, z), "#3e6a48", FMAT.grass, Z);
  // радиаль зам, төвийн талбай
  for (let k = 0; k < 4; k++) {
    const a = (k * Math.PI) / 2;
    const rm = (0.08 + r - 0.012) / 2;
    b.add(box(r - 0.012 - 0.08, 0.0016, 0.026, 0, 0, 0).rotateY(-a).translate(x + Math.cos(a) * rm, 0.0085, z + Math.sin(a) * rm), "#9a9a92", FMAT.concrete, Z);
  }
  b.add(new THREE.CircleGeometry(0.088, 36).rotateX(-Math.PI / 2).translate(x, 0.0102, z), "#9a9a92", FMAT.concrete, Z);
  b.add(ringH(0.088, 0.002, x, 0.0105, z, 36), "#c9ccc6", FMAT.concrete, Z);
  // цэцгийн мандал (салбар бүрт нуман хэлбэр)
  const FLOWERS = ["#9c4a62", "#6a4e8c", "#94463e", "#a8893c"];
  for (let k = 0; k < 4; k++) {
    const a0 = (k * Math.PI) / 2 + 0.22;
    b.add(new THREE.RingGeometry(0.14, 0.205, 14, 1, a0, Math.PI / 2 - 0.44).rotateX(Math.PI / 2).translate(x, 0.0098, z), FLOWERS[k], FMAT.paint, Z);
    b.add(new THREE.RingGeometry(0.235, 0.26, 14, 1, a0 + 0.1, Math.PI / 2 - 0.64).rotateX(Math.PI / 2).translate(x, 0.0098, z), FLOWERS[(k + 2) % 4], FMAT.paint, Z);
  }
  // хөшөө: шатлалтай суурь, хоёр өндөр багана, дунд нь хоёр цагираг (∞), жижиг цилиндрүүд
  b.add(box(0.07, 0.01, 0.07, x, 0.0102, z), STONE, FMAT.stone, Z);
  b.add(box(0.052, 0.01, 0.052, x, 0.0202, z), STONE, FMAT.stone, Z);
  const y0 = 0.0302;
  const H = 0.34;
  for (const s of [-1, 1]) b.add(box(0.011, H, 0.02, x + s * 0.0085, y0, z), STONE, FMAT.stone, Z);
  const yo = y0 + 0.2;
  for (const s of [-1, 1]) {
    const bx = x + s * 0.034;
    b.add(cyl(0.03, 0.03, 0.022, bx, yo, z, 28, true), STONE, FMAT.stone, Z);
    for (const a of [0, Math.PI / 3, -Math.PI / 3, Math.PI / 2, -Math.PI / 2]) {
      const ox = Math.cos(a) * 0.031 * s;
      const oz = Math.sin(a) * 0.031;
      if (Math.abs(bx + ox - x) < 0.02) continue;
      b.add(cyl(0.0048, 0.0048, 0.03, bx + ox, yo - 0.004, z + oz, 10), STONE, FMAT.stone, Z);
    }
  }
  for (let k = 0; k < 4; k++) {
    const a = Math.PI / 4 + (k * Math.PI) / 2;
    b.light(box(0.008, 0.004, 0.008, x + Math.cos(a) * 0.06, 0.0102, z + Math.sin(a) * 0.06), "#ffe2b0", LIT);
  }
  b.shadowRect(x, z, 0.02, 0.012, y0 + H, 0.8);
}

export function landmarks(b: Builder) {
  headquarters(b);
  buddhaHill(b);
  bilegMonument(b);
  morinKhuur(b);
  footbridge(b);
  roundaboutIsland(b);
}
