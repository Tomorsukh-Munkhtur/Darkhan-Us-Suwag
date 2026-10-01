import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import {
  alongCollector,
  alongHouse,
  alongMain,
  alongManhole,
  CHAMBER,
  COL,
  COL_LEVEL,
  DROP,
  FACE_Z,
  HOUSE_Z,
  HOUSES,
  HPIPE,
  JUNCTION_Y,
  LAMPS,
  MAIN,
  MH,
  SLAB,
  STREET,
  TREES,
} from "./layout";

/**
 * Огтлолын procedural geometry. Материал бүрт нэг merged geometry (draw call цөөн):
 * body (байшин, мод, гэрэл, таг), emissive (цонх, гэрэл), interior (хоолой, худгийн дотор тал),
 * water (бохир усны гадаргуу, уналт), glow (зөөлөн гэрлийн толбо). Бүгд index-гүй, атрибут нь ижил.
 */
type V3 = [number, number, number];

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

/** Орой бүрийн (эцсийн) байрлалаас атрибут тооцно */
function perVertex(g: THREE.BufferGeometry, name: string, fn: (x: number, y: number, z: number) => number) {
  const pos = g.attributes.position;
  const arr = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i++) arr[i] = fn(pos.getX(i), pos.getY(i), pos.getZ(i));
  g.setAttribute(name, new THREE.BufferAttribute(arr, 1));
  return g;
}

const rgb = (hex: string): V3 => {
  const c = new THREE.Color(hex);
  return [c.r, c.g, c.b];
};

/** Гурвалжнуудын жагсаалтаас (flat normal) geometry */
function triangles(verts: number[]) {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
  g.computeVertexNormals();
  return g;
}

/** Хоёр налуутай дээвэр (нуруу нь X-ийн дагуу, суурь y = 0). Налуу ба хоёр талын гурвалжин тусдаа. */
function gableRoof(w: number, d: number, h: number, overX: number, overZ: number) {
  const W = w / 2 + overX;
  const D = d / 2 + overZ;
  const slopes = triangles([
    // урд налуу
    -W, 0, D, W, 0, D, W, h, 0,
    -W, 0, D, W, h, 0, -W, h, 0,
    // ар налуу
    W, 0, -D, -W, 0, -D, -W, h, 0,
    W, 0, -D, -W, h, 0, W, h, 0,
    // дээврийн зузаан (урд, ар ирмэг)
    -W, -0.025, D, W, -0.025, D, W, 0, D,
    -W, -0.025, D, W, 0, D, -W, 0, D,
  ]);
  const g = w / 2;
  const gd = d / 2;
  const gh = (h * gd) / D;
  const gables = triangles([
    g, 0, gd, g, 0, -gd, g, gh, 0,
    -g, 0, -gd, -g, 0, gd, -g, gh, 0,
  ]);
  return { slopes, gables };
}

type BodyOpts = { color: string; group: number; base: V3; mat: number };
/** body атрибут: aColor, aGroup, aBase (өсөлтийн тулгуур цэг), aMat (гадаргуугийн хээ) */
function body(g: THREE.BufferGeometry, o: BodyOpts) {
  const out = prep(g);
  fill(out, "aColor", rgb(o.color));
  fill(out, "aGroup", o.group);
  fill(out, "aBase", o.base);
  fill(out, "aMat", o.mat);
  return out;
}

/** Материалын хээний төрөл (body shader) */
export const BODY_MAT = { wall: 0, roof: 1, wood: 2, foliage: 3, trunk: 4, metal: 5, iron: 6, concrete: 7 } as const;

export function bodyGeometry() {
  const parts: THREE.BufferGeometry[] = [];
  const V = STREET.vergeH;

  HOUSES.forEach((h, i) => {
    const zc = HOUSE_Z - h.d / 2;
    const base: V3 = [h.x, V, zc];
    const o = (color: string, mat: number) => ({ color, group: i, base, mat });
    parts.push(body(new THREE.BoxGeometry(h.w, h.h, h.d).translate(h.x, V + h.h / 2, zc), o(h.wall, BODY_MAT.wall)));
    // суурь (plinth)
    parts.push(body(new THREE.BoxGeometry(h.w + 0.02, 0.05, h.d + 0.02).translate(h.x, V + 0.025, zc), o("#4a5058", BODY_MAT.concrete)));
    const roof = h.gable ? gableRoof(h.d, h.w, h.roof, 0.05, 0.05) : gableRoof(h.w, h.d, h.roof, 0.05, 0.06);
    if (h.gable) {
      roof.slopes.rotateY(Math.PI / 2);
      roof.gables.rotateY(Math.PI / 2);
    }
    for (const r of [roof.slopes, roof.gables]) r.translate(h.x, V + h.h, zc);
    parts.push(body(roof.slopes, o(h.roofColor, BODY_MAT.roof)));
    parts.push(body(roof.gables, o(h.wall, BODY_MAT.wall)));
    if (i === 0) parts.push(body(new THREE.BoxGeometry(0.07, 0.3, 0.07).translate(h.x + 0.22, V + h.h + 0.2, zc - 0.1), o("#3a3f47", BODY_MAT.concrete)));
    // хаалга + шат
    parts.push(body(new THREE.PlaneGeometry(0.12, 0.23).translate(h.x + h.door, V + 0.115 + 0.03, HOUSE_Z + 0.003), o("#4b3527", BODY_MAT.wood)));
    parts.push(body(new THREE.BoxGeometry(0.2, 0.03, 0.08).translate(h.x + h.door, V + 0.015, HOUSE_Z + 0.04), o("#555c64", BODY_MAT.concrete)));
  });

  TREES.forEach((t, k) => {
    const s = t.s;
    const base: V3 = [t.x, V, t.z];
    const o = (color: string, mat: number) => ({ color, group: 3 + k, base, mat });
    const trunkH = (t.round ? 0.2 : 0.12) * s;
    parts.push(body(new THREE.CylinderGeometry(0.018 * s, 0.026 * s, trunkH, 6).translate(t.x, V + trunkH / 2, t.z), o("#3b2e25", BODY_MAT.trunk)));
    if (t.round) {
      parts.push(body(new THREE.IcosahedronGeometry(0.17 * s, 1).scale(1, 1.08, 1).translate(t.x, V + 0.32 * s, t.z), o("#2a4d40", BODY_MAT.foliage)));
      parts.push(body(new THREE.IcosahedronGeometry(0.11 * s, 1).translate(t.x + 0.1 * s, V + 0.4 * s, t.z + 0.04 * s), o("#315a4a", BODY_MAT.foliage)));
    } else {
      const tiers: [number, number, number][] = [
        [0.17, 0.26, 0.08],
        [0.13, 0.24, 0.2],
        [0.085, 0.2, 0.32],
      ];
      for (const [r, hh, y] of tiers)
        parts.push(body(new THREE.ConeGeometry(r * s, hh * s, 8).translate(t.x, V + (y + hh / 2) * s, t.z), o("#244538", BODY_MAT.foliage)));
    }
  });

  LAMPS.forEach((l, k) => {
    const base: V3 = [l.x, V, l.z];
    const o = { color: "#4c5763", group: 7 + k, base, mat: BODY_MAT.metal };
    parts.push(body(new THREE.CylinderGeometry(0.011, 0.016, 0.84, 8).translate(l.x, V + 0.42, l.z), o));
    parts.push(body(new THREE.BoxGeometry(0.016, 0.016, 0.2).translate(l.x, V + 0.83, l.z + 0.09), o));
    parts.push(body(new THREE.BoxGeometry(0.065, 0.024, 0.11).translate(l.x, V + 0.82, l.z + 0.19), o));
  });

  // Замын таг: засварын худгийн (хагас дугуй, огтлолын нүүртэй) ба айлын үзлэгийн худгийн (дөрвөлжин)
  const road = (mat: number, color = "#2c3238") => ({ color, group: 9, base: [0, 0, FACE_Z] as V3, mat });
  parts.push(body(new THREE.CylinderGeometry(MH.coverR + 0.04, MH.coverR + 0.04, 0.012, 32, 1, false, Math.PI / 2, Math.PI).translate(MH.x, 0.006, FACE_Z), road(BODY_MAT.concrete, "#3d434a")));
  parts.push(body(new THREE.CylinderGeometry(MH.coverR, MH.coverR, 0.022, 32, 1, false, Math.PI / 2, Math.PI).translate(MH.x, 0.011, FACE_Z), road(BODY_MAT.iron)));
  parts.push(body(new THREE.PlaneGeometry(MH.coverR * 2, 0.022).translate(MH.x, 0.011, FACE_Z), road(BODY_MAT.iron, "#20252a")));
  for (const h of HOUSES) parts.push(body(new THREE.BoxGeometry(0.2, 0.014, 0.11).translate(h.x, 0.007, FACE_Z - 0.055), road(BODY_MAT.iron)));

  return mergeGeometries(parts, false)!;
}

/** Цонх, гэрлийн гэрэлтэх гадаргуу. aLit — асах индекс; aMat 0 — хүрээтэй цонх, 1 — энгийн гэрэл. */
export function emissiveGeometry() {
  const parts: THREE.BufferGeometry[] = [];
  const V = STREET.vergeH;
  const add = (g: THREE.BufferGeometry, color: string, lit: number, group: number, base: V3, mat: number) => {
    const out = prep(g, ["position", "normal", "uv"]);
    fill(out, "aColor", rgb(color));
    fill(out, "aLit", lit);
    fill(out, "aGroup", group);
    fill(out, "aBase", base);
    fill(out, "aMat", mat);
    parts.push(out);
  };
  const warm = ["#ffcc78", "#ffc066", "#ffd690", "#ffc470"];
  HOUSES.forEach((h, i) => {
    const zc = HOUSE_Z - h.d / 2;
    const base: V3 = [h.x, V, zc];
    const y = V + h.h * 0.56;
    const front = h.gable ? [-0.17] : i === 0 ? [-0.25, 0.27] : [-0.34, -0.11, 0.37];
    front.forEach((dx, k) => add(new THREE.PlaneGeometry(0.15, 0.15).translate(h.x + dx, y, HOUSE_Z + 0.004), warm[(i + k) % 4], i, i, base, 0));
    if (h.gable) add(new THREE.PlaneGeometry(0.09, 0.09).translate(h.x, V + h.h + 0.11, HOUSE_Z + 0.004), warm[1], i, i, base, 0);
    else {
      // баруун хажуугийн цонх (камер баруун урдаас харна)
      add(new THREE.PlaneGeometry(0.15, 0.15).rotateY(Math.PI / 2).translate(h.x + h.w / 2 + 0.004, y, zc), warm[(i + 2) % 4], i, i, base, 0);
    }
    // хаалганы дээрх гэрэл
    add(new THREE.PlaneGeometry(0.035, 0.03).translate(h.x + h.door, V + 0.3, HOUSE_Z + 0.006), "#ffe2a8", i, i, base, 1);
  });
  LAMPS.forEach((l, k) => {
    add(new THREE.BoxGeometry(0.048, 0.01, 0.08).translate(l.x, V + 0.803, l.z + 0.19), "#fff0cf", 3 + k, 7 + k, [l.x, V, l.z], 1);
  });
  return mergeGeometries(parts, false)!;
}

/** Гэрлийн зөөлөн толбо (additive, камер руу харсан quad) — зөвхөн fx түвшинд */
export function glowGeometry(azimuthDeg: number, elevationDeg: number) {
  const parts: THREE.BufferGeometry[] = [];
  const V = STREET.vergeH;
  const quad = (size: number, pos: V3, color: string, lit: number) => {
    const g = new THREE.PlaneGeometry(size, size);
    g.rotateX(-THREE.MathUtils.degToRad(elevationDeg));
    g.rotateY(THREE.MathUtils.degToRad(azimuthDeg));
    g.translate(...pos);
    const out = prep(g, ["position", "uv"]);
    fill(out, "aColor", rgb(color));
    fill(out, "aLit", lit);
    parts.push(out);
  };
  LAMPS.forEach((l, k) => quad(0.42, [l.x, V + 0.8, l.z + 0.19], "#ffd9a0", 3 + k));
  HOUSES.forEach((h, i) => {
    const y = V + h.h * 0.56;
    const front = h.gable ? [-0.17] : i === 0 ? [-0.25, 0.27] : [-0.34, -0.11, 0.37];
    front.forEach((dx) => quad(0.34, [h.x + dx, y, HOUSE_Z + 0.03], "#ffb65c", i));
  });
  return mergeGeometries(parts, false)!;
}

/** interior shader-ийн гадаргуугийн төрөл */
export const INTERIOR_MAT = { pipe: 0, concrete: 1, steel: 2, exterior: 3, floor: 4, rim: 5 } as const;

/**
 * Огтлолын ард байгаа гадаргуу: хоолой, худгийн арын хагас (дотор тал), шат, коллекторын цухуйсан хэсэг.
 * aElem — reveal/flow индекс, aAlong — элементийн дагуух байрлал (0 → 1), aMat — өнгө/хээ.
 */
export function interiorGeometry() {
  const parts: THREE.BufferGeometry[] = [];
  const add = (g: THREE.BufferGeometry, elem: number, mat: number, along: (x: number, y: number, z: number) => number) => {
    const out = prep(g);
    fill(out, "aElem", elem);
    fill(out, "aMat", mat);
    perVertex(out, "aAlong", along);
    parts.push(out);
  };
  const half = Math.PI / 2;
  /** X-ийн дагуух хоолойн арын хагас (эсвэл thetaLength-ээр доод-ар дөрөвний нэг) */
  const pipeX = (r: number, x0: number, x1: number, y: number, thetaLength = Math.PI, segs = 24) =>
    new THREE.CylinderGeometry(r, r, x1 - x0, segs, 1, true, half, thetaLength)
      .rotateZ(-half)
      .translate((x0 + x1) / 2, y, FACE_Z);
  /** Босоо цилиндр/конусын арын хагас */
  const shaftY = (rTop: number, rBottom: number, y0: number, y1: number, x: number, segs = 24) =>
    new THREE.CylinderGeometry(rTop, rBottom, y1 - y0, segs, 1, true, half, Math.PI).translate(x, (y0 + y1) / 2, FACE_Z);

  // --- айлын үзлэгийн худаг + босоо холболт
  HOUSES.forEach((h, i) => {
    const { half: w, depth, floor } = CHAMBER;
    const along = (_x: number, y: number) => alongHouse(y);
    const back = new THREE.PlaneGeometry(w * 2, -floor).translate(h.x, floor / 2, FACE_Z - depth);
    const left = new THREE.PlaneGeometry(depth, -floor).rotateY(half).translate(h.x - w, floor / 2, FACE_Z - depth / 2);
    const right = new THREE.PlaneGeometry(depth, -floor).rotateY(-half).translate(h.x + w, floor / 2, FACE_Z - depth / 2);
    const bottom = new THREE.PlaneGeometry(w * 2, depth).rotateX(-half).translate(h.x, floor, FACE_Z - depth / 2);
    for (const g of [back, left, right]) add(g, i, INTERIOR_MAT.concrete, along);
    add(bottom, i, INTERIOR_MAT.floor, along);
    add(shaftY(HPIPE.rIn, HPIPE.rIn, JUNCTION_Y, floor, h.x, 12), i, INTERIOR_MAT.pipe, along);
  });

  // --- гол шугам
  add(pipeX(MAIN.rIn, MAIN.x0, MAIN.x1, MAIN.y), 3, INTERIOR_MAT.pipe, (x) => alongMain(x));

  // --- засварын худаг: босоо бетон цагираг → конус → хүзүү, ёроолын тавцан, ган шат
  const mhAlong = (_x: number, y: number) => alongManhole(y);
  add(shaftY(MH.rIn, MH.rIn, COL.y, MH.coneY, MH.x, 28), 4, INTERIOR_MAT.concrete, mhAlong);
  add(shaftY(MH.neckR, MH.rIn, MH.coneY, MH.neckY, MH.x, 28), 4, INTERIOR_MAT.concrete, mhAlong);
  add(shaftY(MH.neckR, MH.neckR, MH.neckY, 0, MH.x, 20), 4, INTERIOR_MAT.concrete, mhAlong);
  {
    // коллекторын сувгийн ар талын нарийн тавцан (benching)
    const lim = Math.sqrt(MH.rIn * MH.rIn - COL.rIn * COL.rIn);
    const verts: number[] = [];
    const n = 8;
    for (let k = 0; k < n; k++) {
      const xa = -lim + ((2 * lim) / n) * k;
      const xb = xa + (2 * lim) / n;
      const za = FACE_Z - Math.sqrt(MH.rIn * MH.rIn - xa * xa);
      const zb = FACE_Z - Math.sqrt(MH.rIn * MH.rIn - xb * xb);
      const zf = FACE_Z - COL.rIn;
      verts.push(MH.x + xa, COL.y, zf, MH.x + xb, COL.y, zf, MH.x + xb, COL.y, zb, MH.x + xa, COL.y, zf, MH.x + xb, COL.y, zb, MH.x + xa, COL.y, za);
    }
    add(triangles(verts), 4, INTERIOR_MAT.floor, mhAlong);
  }
  const mhRadius = (y: number) =>
    y < MH.coneY ? MH.rIn : y < MH.neckY ? MH.rIn + ((MH.neckR - MH.rIn) * (y - MH.coneY)) / (MH.neckY - MH.coneY) : MH.neckR;
  for (let y = -0.13; y > COL.y + 0.14; y -= 0.105) {
    const zw = FACE_Z - mhRadius(y);
    add(new THREE.BoxGeometry(0.12, 0.012, 0.012).translate(MH.x, y, zw + 0.05), 4, INTERIOR_MAT.steel, mhAlong);
    for (const sx of [-1, 1]) add(new THREE.BoxGeometry(0.012, 0.012, 0.05).translate(MH.x + sx * 0.055, y, zw + 0.025), 4, INTERIOR_MAT.steel, mhAlong);
  }

  // --- коллектор: худгийн ёроолын ил суваг (доод-ар дөрөвний нэг) → хоолой → блокоос гадагш цухуйсан хэсэг
  const colAlong = (x: number) => alongCollector(x);
  add(pipeX(COL.rIn, MH.x - MH.rIn, MH.x + MH.rIn, COL.y, half, 12), 5, INTERIOR_MAT.pipe, colAlong);
  add(pipeX(COL.rIn, MH.x + MH.rIn, COL.x1, COL.y), 5, INTERIOR_MAT.pipe, colAlong);
  const stubX0 = SLAB.x1;
  // гадна тал (хар ган/бетон), огтлолын ирмэг, төгсгөлийн цагираг
  const ext = new THREE.CylinderGeometry(COL.rOut, COL.rOut, COL.x1 - stubX0, 24, 1, true, half, Math.PI);
  ext.rotateZ(-half).translate((stubX0 + COL.x1) / 2, COL.y, FACE_Z);
  // гадна тал: normal гадагш — rotateZ хийсэн тул эргүүлэх шаардлагагүй
  add(ext, 5, INTERIOR_MAT.exterior, colAlong);
  const wallT = COL.rOut - COL.rIn;
  for (const sy of [-1, 1])
    add(new THREE.PlaneGeometry(COL.x1 - stubX0, wallT).translate((stubX0 + COL.x1) / 2, COL.y + sy * (COL.rIn + wallT / 2), FACE_Z), 5, INTERIOR_MAT.rim, colAlong);
  add(
    new THREE.RingGeometry(COL.rIn, COL.rOut, 24, 1, -half, Math.PI).rotateY(half).translate(COL.x1, COL.y, FACE_Z),
    5,
    INTERIOR_MAT.rim,
    colAlong,
  );

  return mergeGeometries(parts, false)!;
}

/** water shader-ийн төрөл: 0 гол шугамын гадаргуу (түвшинг shader тооцно), 1 коллектор, 2 уналт/дусал, 3 огтлолын нүүр */
export const WATER_KIND = { main: 0, collector: 1, ribbon: 2, section: 3 } as const;

function waterPiece(pos: number[], along: number[], across: number[], elem: number, kind: number) {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("aAlong", new THREE.Float32BufferAttribute(along, 1));
  g.setAttribute("aAcross", new THREE.Float32BufferAttribute(across, 1));
  fill(g, "aElem", elem);
  fill(g, "aKind", kind);
  return g;
}

/** Тууз: цэгүүдийн дагуу (a, b хоёр ирмэг) гурвалжин жагсаалт */
function strip(edgeA: V3[], edgeB: V3[], alongs: number[], elem: number, kind: number) {
  const pos: number[] = [];
  const al: number[] = [];
  const ac: number[] = [];
  for (let i = 0; i < edgeA.length - 1; i++) {
    const quad: [V3, number, number][] = [
      [edgeA[i], alongs[i], 0],
      [edgeB[i], alongs[i], 1],
      [edgeB[i + 1], alongs[i + 1], 1],
      [edgeA[i], alongs[i], 0],
      [edgeB[i + 1], alongs[i + 1], 1],
      [edgeA[i + 1], alongs[i + 1], 0],
    ];
    for (const [p, a, c] of quad) {
      pos.push(...p);
      al.push(a);
      ac.push(c);
    }
  }
  return waterPiece(pos, al, ac, elem, kind);
}

export function waterGeometry() {
  const parts: THREE.BufferGeometry[] = [];

  // Гол шугам: x-ийн дагуу 60 хэсэг; y, z-ийг vertex shader түвшнээс тооцно (aAcross: 0 ар, 1 огтлол)
  {
    const n = 60;
    const a: V3[] = [];
    const b: V3[] = [];
    const al: number[] = [];
    for (let i = 0; i <= n; i++) {
      const x = MAIN.x0 + ((MAIN.x1 - MAIN.x0) * i) / n;
      a.push([x, 0, 0]);
      b.push([x, 0, 0]);
      al.push(alongMain(x));
    }
    parts.push(strip(a, b, al, 3, WATER_KIND.main));
  }

  // Коллектор: тогтмол түвшин
  {
    const dy = COL_LEVEL - COL.y;
    const c = Math.sqrt(COL.rIn * COL.rIn - dy * dy) - 0.004;
    const n = 24;
    const a: V3[] = [];
    const b: V3[] = [];
    const al: number[] = [];
    for (let i = 0; i <= n; i++) {
      const x = COL.x0 + 0.004 + ((COL.x1 - COL.x0 - 0.004) * i) / n;
      a.push([x, COL_LEVEL, FACE_Z - c]);
      b.push([x, COL_LEVEL, FACE_Z]);
      al.push(alongCollector(x));
    }
    parts.push(strip(a, b, al, 5, WATER_KIND.collector));
    // блокоос гадагш цухуйсан хэсгийн огтлолын нүүр (блок доторхыг earth shader зурна)
    const x0 = SLAB.x1;
    const ys = [COL.y - COL.rIn + 0.004, COL_LEVEL];
    parts.push(
      strip(
        ys.map((y) => [x0, y, FACE_Z] as V3),
        ys.map((y) => [COL.x1, y, FACE_Z] as V3),
        [alongCollector(x0), alongCollector(x0)],
        5,
        WATER_KIND.section,
      ),
    );
    // along нь x-ээс хамаарах ёстой: B ирмэгийн along-ыг засна
    const last = parts[parts.length - 1];
    const pos = last.attributes.position;
    const al2 = last.attributes.aAlong as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) al2.setX(i, alongCollector(pos.getX(i)));
  }

  // Худаг доторх уналт: гол шугамын гаралтаас коллекторын суваг руу (огтлолын хавтгайн дээрх зузаантай тууз)
  {
    const n = 18;
    const a: V3[] = [];
    const b: V3[] = [];
    const al: number[] = [];
    const z = FACE_Z - 0.003;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const x = DROP.x0 + DROP.dx * t;
      const y = DROP.y0 - (DROP.y0 - DROP.y1) * t * t;
      // замын нормаль (xy хавтгайд)
      const tx = DROP.dx;
      const ty = -2 * (DROP.y0 - DROP.y1) * t;
      const len = Math.hypot(tx, ty);
      const nx = -ty / len;
      const ny = tx / len;
      const th = (0.11 - 0.05 * t) / 2;
      a.push([x - nx * th, y - ny * th, z]);
      b.push([x + nx * th, y + ny * th, z]);
      al.push(t);
    }
    parts.push(strip(a, b, al, 4, WATER_KIND.ribbon));
  }

  // Айлын үзлэгийн худаг: хажуугийн гаргалгаанаас ёроолын нүх рүү дусал урсгал
  HOUSES.forEach((h, i) => {
    const n = 10;
    const a: V3[] = [];
    const b: V3[] = [];
    const al: number[] = [];
    const z0 = FACE_Z - CHAMBER.depth + 0.006;
    const z1 = FACE_Z - HPIPE.rIn;
    const y0 = CHAMBER.lateralY;
    const y1 = CHAMBER.floor + 0.004;
    for (let k = 0; k <= n; k++) {
      const t = k / n;
      const z = z0 + (z1 - z0) * Math.sqrt(t);
      const y = y0 - (y0 - y1) * t * t;
      const w = 0.018 - 0.006 * t;
      a.push([h.x - w, y, z]);
      b.push([h.x + w, y, z]);
      al.push(alongHouse(y));
    }
    parts.push(strip(a, b, al, i, WATER_KIND.ribbon));
  });

  return mergeGeometries(parts, false)!;
}

/** Хөрсний блок (огтлолын урд тал z = FACE_Z) */
export function slabGeometry() {
  const w = SLAB.x1 - SLAB.x0;
  const h = -SLAB.y0;
  const d = FACE_Z - SLAB.z0;
  return new THREE.BoxGeometry(w, h, d).translate((SLAB.x0 + SLAB.x1) / 2, SLAB.y0 / 2, (FACE_Z + SLAB.z0) / 2);
}

/** Замын гадаргуу + хашлагаас хойших өндөрлөг (явган зам, зүлэг) */
export function surfaceGeometry() {
  const w = SLAB.x1 - SLAB.x0;
  const cx = (SLAB.x0 + SLAB.x1) / 2;
  const road = new THREE.PlaneGeometry(w, FACE_Z - STREET.roadZ)
    .rotateX(-Math.PI / 2)
    .translate(cx, 0.002, (FACE_Z + STREET.roadZ) / 2);
  const verge = new THREE.BoxGeometry(w, STREET.vergeH, STREET.roadZ - SLAB.z0).translate(cx, STREET.vergeH / 2, (STREET.roadZ + SLAB.z0) / 2);
  return mergeGeometries([prep(road), prep(verge)], false)!;
}
