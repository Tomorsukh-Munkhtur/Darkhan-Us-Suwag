/**
 * Дархан хотын 3D газрын зургийн өгөгдөл ба цэвэр функцүүд (three.js import хийхгүй).
 *
 * Координат: дэлхийн нэгж, бодит байршилд ойртуулсан схем (доорх geo) — хойд зүг +x, зүүн зүг +z.
 * Хараа гол нь SVG схемийн (DarkhanMap.tsx, 1600×900) муруйгаар: x = (sx − 800) / 100, z = (sy − 450) / 100 (toW).
 */
export type P2 = [number, number];

export const toW = (sx: number, sy: number): P2 => [(sx - 800) / 100, (sy - 450) / 100];

// ---------------------------------------------------------------------------------------------
// Хараа гол: SVG-ийн cubic bezier (S командыг C болгож задалсан), x-ээр монотон

const RIVER_SVG: number[][][] = [
  [[-900, 120], [-600, 60], [-300, 170], [-40, 130]],
  [[-40, 130], [160, 90], [360, 185], [600, 150]],
  [[600, 150], [840, 115], [1010, 85], [1220, 135]],
  [[1220, 135], [1430, 185], [1520, 190], [1640, 150]],
  [[1640, 150], [1760, 110], [2100, 90], [2500, 140]],
];
/** Харагдах усны хагас өргөн (газрын налуу усны түвшинг огтлох зай) */
export const RIVER_HALF = 0.27;

function cubic(p: number[][], t: number): P2 {
  const u = 1 - t;
  const a = u * u * u;
  const b = 3 * u * u * t;
  const c = 3 * u * t * t;
  const d = t * t * t;
  return [a * p[0][0] + b * p[1][0] + c * p[2][0] + d * p[3][0], a * p[0][1] + b * p[1][1] + c * p[2][1] + d * p[3][1]];
}

/** Голын төв шугам (дэлхийн координат), x өсөх дарааллаар */
export const RIVER: P2[] = (() => {
  const out: P2[] = [];
  RIVER_SVG.forEach((seg, k) => {
    for (let i = k === 0 ? 0 : 1; i <= 60; i++) {
      const [sx, sy] = cubic(seg, i / 60);
      out.push(toW(sx, sy));
    }
  });
  return out;
})();

/** x дээрх голын төв z ба чиглэлийн cos (x-ээр монотон тул хайлт хялбар) */
export function riverAt(x: number): { z: number; cos: number } {
  const r = RIVER;
  if (x <= r[0][0]) return { z: r[0][1], cos: 1 };
  if (x >= r[r.length - 1][0]) return { z: r[r.length - 1][1], cos: 1 };
  let lo = 0;
  let hi = r.length - 1;
  while (hi - lo > 1) {
    const m = (lo + hi) >> 1;
    if (r[m][0] <= x) lo = m;
    else hi = m;
  }
  const [x0, z0] = r[lo];
  const [x1, z1] = r[hi];
  const t = (x - x0) / (x1 - x0);
  const dx = x1 - x0;
  const dz = z1 - z0;
  return { z: z0 + (z1 - z0) * t, cos: dx / Math.hypot(dx, dz) };
}

/** Голын төв шугам хүртэлх (ойролцоо) зай */
export function riverDist(x: number, z: number) {
  const r = riverAt(x);
  return Math.abs(z - r.z) * r.cos;
}

// ---------------------------------------------------------------------------------------------
// Газрын өндөр (детерминистик value noise) — terrain, мод, гэрэлд хуваалцана

function hash2(x: number, y: number) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}
function vnoise(x: number, y: number) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const a = hash2(ix, iy);
  const b = hash2(ix + 1, iy);
  const c = hash2(ix, iy + 1);
  const d = hash2(ix + 1, iy + 1);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}
export function fbm(x: number, y: number) {
  return vnoise(x, y) * 0.55 + vnoise(x * 2.1 + 3.1, y * 2.1 + 7.3) * 0.3 + vnoise(x * 4.3 + 11.7, y * 4.3 + 1.9) * 0.15;
}
const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
};

/** Хотын хавтгай бүс (дэлхийн координат) — энд газар тэгш */
export const CORE = { x0: -9.0, x1: 9.0, z0: -2.9, z1: 4.6 } as const;
export const RIVER_BED = -0.1;

export function terrainHeight(x: number, z: number) {
  // хотоос гадагш: хойд талын толгод (голын цаана), зүүн/баруун/өмнөд захын дов
  const dxOut = Math.max(CORE.x0 - x, x - CORE.x1, 0);
  const dzOut = Math.max(z - CORE.z1, 0);
  const north = Math.max(riverAt(x).z - z - 0.75, 0);
  const out = Math.max(smooth(0, 4.5, north), smooth(0.4, 6, dxOut), smooth(0.4, 5, dzOut));
  let h = out * (0.25 + 0.75 * fbm(x * 0.22 + 4, z * 0.22 - 2)) * 1.1;
  // хотын захад бага зэргийн долгион
  const nearCore = 1 - smooth(0.2, 1.2, Math.max(dxOut, dzOut, north * 0.5));
  h += (fbm(x * 0.7, z * 0.7) - 0.5) * 0.05 * (1 - nearCore * 0.85);
  // голын хөндий
  const d = riverDist(x, z);
  // усны ирмэг ≈ 0.27 (усны түвшин −0.035-ыг газар огтлох зай)
  const bank = smooth(0.15, 0.36, d);
  return RIVER_BED + (h - RIVER_BED) * bank;
}

// ---------------------------------------------------------------------------------------------
// Бодит байршилд ойртуулсан схем (OpenStreetMap-ын өгөгдлөөр): хойд зүг → +x (дэлгэцэнд баруун тийш),
// зүүн зүг → +z (камер руу), баруун зүг → −z (ард — Хараа гол). Хот хойд-өмнөд чиглэлд урт тул өргөн дэлгэцэнд
// багтаахаар эргүүлсэн; зүүн-баруун тэнхлэгийг шахсан. Бодит координатаас: geo(lat, lon).
//   Хуучин Дархан — хойд (баруун), Шинэ Дархан — өмнөд-зүүн (зүүн доод), үйлдвэр/ДЦС — өмнөд (зүүн), цэвэрлэх
//   байгууламж — хамгийн хойд талд (Хараа гол руу урсгалын доод хэсэг), авто зам А0401 ба төмөр зам хотыг хойд-өмнөд
//   чиглэлд дайрна, тойрог — Хуучин/Шинэ Дарханы хооронд, Бурхантай уул, Морин хуурын цогцолбор хажууд нь.

/** OSM (lat, lon) → дэлхийн нэгж (хойд-өмнөд 1.38/км, зүүн-баруун 0.8/км) */
export const geo = (lat: number, lon: number): P2 => [1.38 * (lat - 49.47) * 111.2 + 0.3, 0.8 * (lon - 105.95) * 72.36 + 0.6];

export type Rect = { x0: number; x1: number; z0: number; z1: number };

// ---------------------------------------------------------------------------------------------
// Хороолол, гудамж

export type DistrictKind = "old" | "new" | "ind";
/** xs — x тэнхлэгийн (босоо гудамж), ys — z тэнхлэгийн (хэвтээ гудамж) шугамууд; avenue — ys доторх төв өргөн чөлөөний индекс (−1 — байхгүй) */
export type District = { id: DistrictKind; name: string; label: P2; xs: number[]; ys: number[]; avenue: number };

/** Төв өргөн чөлөө (Шинэ Дархан → төв хэсэг → Хуучин Дархан) */
export const AVENUE_Z = 2.2;

export const DISTRICTS: District[] = [
  { id: "old", name: "ХУУЧИН ДАРХАН", label: [4.5, AVENUE_Z], xs: [2.4, 3.45, 4.5, 5.55, 6.6], ys: [0.7, 1.45, AVENUE_Z, 2.95], avenue: 2 },
  { id: "new", name: "ШИНЭ ДАРХАН", label: [-1.5, AVENUE_Z], xs: [-3.0, -2.0, -1.0, -0.1], ys: [0.7, 1.45, AVENUE_Z, 2.95, 3.7], avenue: 2 },
  { id: "ind", name: "ҮЙЛДВЭРИЙН РАЙОН", label: [-6.8, 1.55], xs: [-8.6, -7.4, -6.2, -5.0], ys: [0.7, 1.55, 2.4], avenue: -1 },
];

/** highway — хоёр урсгалтай авто зам (дунд нь модтой тусгаарлагч, дугуйн зам) */
export type Road = { a: P2; b: P2; w: number; major: boolean; highway?: boolean };
export const STREET_W = 0.1;
export const AVENUE_W = 0.16;
const SIDEWALK = 0.034;

/** Хорооллын хашаа (lot): гудамжны хагас өргөн + явган зам + зай */
function roadHalf(d: District, axis: "x" | "y", i: number) {
  const major = axis === "y" && i === d.avenue;
  return (major ? AVENUE_W : STREET_W) / 2 + SIDEWALK + 0.03;
}
export function districtLot(d: District, i: number, j: number): Rect {
  return {
    x0: d.xs[i] + roadHalf(d, "x", i),
    x1: d.xs[i + 1] - roadHalf(d, "x", i + 1),
    z0: d.ys[j] + roadHalf(d, "y", j),
    z1: d.ys[j + 1] - roadHalf(d, "y", j + 1),
  };
}
export function districtLots(d: District) {
  const lots: (Rect & { i: number; j: number })[] = [];
  for (let i = 0; i < d.xs.length - 1; i++) for (let j = 0; j < d.ys.length - 1; j++) lots.push({ ...districtLot(d, i, j), i, j });
  return lots;
}
const district = (id: DistrictKind) => DISTRICTS.find((d) => d.id === id)!;

/**
 * Хоёр урсгалтай авто зам А0401 (Улаанбаатар — Дархан — Сүхбаатар): хотыг хойд-өмнөд (x) чиглэлд дайрна.
 * Төвөөс гадагш — модтой тусгаарлагч, 2 эгнээтэй зорчих хэсэг, модтой зурвас, дугуйн зам. Хагас өргөнүүд (төвөөс).
 */
export const HIGHWAY = { z: 0.3, median: 0.03, carriage: 0.14, strip: 0.19, half: 0.23 } as const;
export const HIGHWAY_W = HIGHWAY.half * 2;
/** Хоёр урсгалтай замын эгнээний төв (төвөөс): дотор, гадна */
export const HIGHWAY_LANES = [HIGHWAY.median + (HIGHWAY.carriage - HIGHWAY.median) * 0.25, HIGHWAY.median + (HIGHWAY.carriage - HIGHWAY.median) * 0.75] as const;

/**
 * Авто замын тойрог (Хуучин/Шинэ Дарханы хооронд, бодитоор 49.4742, 105.9462): цагираг зам + төвийн арал.
 * arms — тойрогт орох замууд (өнцөг: 0 — +x, π/2 — +z), хагас өргөн нь явган замтай.
 */
export const ROUNDABOUT = {
  c: [1.0, HIGHWAY.z] as P2,
  rIn: 0.3,
  rOut: 0.45,
  arms: [
    { a: 0, half: HIGHWAY.half + SIDEWALK },
    { a: Math.PI, half: HIGHWAY.half + SIDEWALK },
    { a: Math.PI / 2, half: AVENUE_W / 2 + SIDEWALK },
  ],
} as const;
/** Тойрогт орох замын төгсгөл төвөөс (цагираг доогуур орж нуугдана) */
const RB_ARM = ROUNDABOUT.rIn + 0.03;

/** Гудамж, гол зам: тэнхлэгтэй параллель хэрчмүүд (дэлхийн нэгж) */
export const ROADS: Road[] = (() => {
  const roads: Road[] = [];
  const add = (a: P2, b: P2, major = false) => roads.push({ a, b, w: major ? AVENUE_W : STREET_W, major });
  for (const d of DISTRICTS) {
    const x0 = d.xs[0];
    const x1 = d.xs[d.xs.length - 1];
    const y0 = d.ys[0];
    const y1 = d.ys[d.ys.length - 1];
    // өргөн чөлөөний шугамыг доорх нийтлэг өргөн чөлөө давхардуулалгүй бүрхэнэ
    d.ys.forEach((y, j) => j !== d.avenue && add([x0, y], [x1, y]));
    for (const x of d.xs) add([x, y0], [x, y1]);
  }
  add([-3.0, AVENUE_Z], [6.6, AVENUE_Z], true);
  // хоёр урсгалтай авто зам: тойргоор тасарна
  const [rx, rz] = ROUNDABOUT.c;
  for (const [a, b] of [
    [-19, rx - RB_ARM],
    [rx + RB_ARM, 19],
  ])
    roads.push({ a: [a, rz], b: [b, rz], w: HIGHWAY_W, major: true, highway: true });
  // тойргоос Шинэ Дархан руу (Залуучуудын өргөн чөлөө) — төв хэсгийг хуваана
  add([rx, rz + RB_ARM], [rx, 3.7], true);
  // хорооллыг авто замтай холбох гудамж
  for (const x of [-6.2, -2.0, 4.5]) add([x, HIGHWAY.z], [x, 0.7]);
  add([-5.0, 0.7], [-3.0, 0.7]); // үйлдвэр ↔ Шинэ Дархан
  add([3.0, -0.62], [3.0, HIGHWAY.z]); // Дархан-1 буудлын талбай
  add([-5.8, -0.3], [-5.8, HIGHWAY.z]); // Дархан-2 буудал
  add([7.15, -0.3], [7.15, HIGHWAY.z]); // цэвэрлэх байгууламжийн орц
  add([6.0, HIGHWAY.z], [6.0, -4.6]); // баруун тийш: төмөр замын гарам, Хараа голын гүүр
  return roads;
})();

// ---------------------------------------------------------------------------------------------
// Төмөр зам (Транс-Монголын): хойд-өмнөд чиглэлд, авто замаас баруун талд (−z) зэрэгцэнэ

const RAIL_CTRL: P2[] = [
  [-19, -0.6],
  [-12, -0.6],
  [-7, -0.56],
  [-5.8, -0.55],
  [-3.6, -0.6],
  [-1.8, -0.8],
  [-0.3, -1.0],
  [1.2, -1.08],
  [2.6, -1.06],
  [3.6, -1.1],
  [5.0, -1.25],
  [6.2, -1.4],
  [8.4, -1.6],
  [12, -1.85],
  [19, -2.05],
];
/** Төмөр замын төв шугам (Catmull-Rom, x-ээр монотон) */
export const RAILWAY: P2[] = (() => {
  const out: P2[] = [];
  const c = RAIL_CTRL;
  for (let k = 0; k < c.length - 1; k++) {
    const p0 = c[Math.max(k - 1, 0)];
    const p1 = c[k];
    const p2 = c[k + 1];
    const p3 = c[Math.min(k + 2, c.length - 1)];
    const n = Math.max(2, Math.ceil((p2[0] - p1[0]) / 0.1));
    for (let i = k === 0 ? 0 : 1; i <= n; i++) {
      const t = i / n;
      const t2 = t * t;
      const t3 = t2 * t;
      const cr = (a: number, b: number, cc: number, d: number) => 0.5 * (2 * b + (-a + cc) * t + (2 * a - 5 * b + 4 * cc - d) * t2 + (-a + 3 * b - 3 * cc + d) * t3);
      out.push([cr(p0[0], p1[0], p2[0], p3[0]), cr(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  return out;
})();
export function railZ(x: number) {
  const r = RAILWAY;
  if (x <= r[0][0]) return r[0][1];
  for (let i = 1; i < r.length; i++)
    if (r[i][0] >= x) {
      const t = (x - r[i - 1][0]) / (r[i][0] - r[i - 1][0]);
      return r[i - 1][1] + (r[i][1] - r[i - 1][1]) * t;
    }
  return r[r.length - 1][1];
}
/** Буудлууд: Дархан-1 (Хуучин Дархан, зорчигчийн), Дархан-2 (үйлдвэрийн) */
export const STATIONS = [
  { name: "Дархан-1", x: 3.0, len: 0.5, main: true },
  { name: "Дархан-2", x: -5.8, len: 0.32, main: false },
] as const;

// ---------------------------------------------------------------------------------------------
// Ус хангамж: Хараа голын эргийн гүний худгууд (бодитоор 18) → I өргөлт → 4 усан сан (2×2000, 2×6000 м³) →
// II өргөлт (хлоржуулалт) → хот. Бохир ус → хойд талын цэвэрлэх байгууламж → Хараа гол.

/** Эх үүсвэрийн ариун цэврийн хамгаалалтын бүс (голын эрэг дагуу) */
export const SOURCE_ZONE = { x0: 2.8, x1: 5.7, z0: -2.75, z1: -2.2 } as const;
export const WELLS: P2[] = [3.05, 3.45, 3.85, 4.25, 4.65, 5.05, 5.45].map((x, i) => [x, i % 2 ? -2.42 : -2.6] as P2);
/** [I өргөлт (худгийн талбайн өмнөд үзүүр), II өргөлт (усан сангийн хажууд)] */
export const PUMPS: P2[] = [
  [2.5, -2.35],
  [1.95, -0.45],
];
/** Усан сан: 2 том (6000 м³), 2 жижиг (2000 м³) — Бурхантай уулын хажуу, төмөр зам ба авто замын хооронд */
export const RESERVOIR_H = 0.14;
export const RESERVOIRS = [
  { c: [0.95, -0.7] as P2, r: 0.17 },
  { c: [1.38, -0.7] as P2, r: 0.17 },
  { c: [0.95, -0.3] as P2, r: 0.12 },
  { c: [1.38, -0.3] as P2, r: 0.12 },
] as const;
/** Шугам сүлжээний гол зангилаа (насос станцын оролт/гаралт, усан сангийн оролт/гаралт) */
export const NET = {
  collectorZ: -2.3,
  pump1In: [2.72, -2.3] as P2,
  pump1Out: [2.5, -2.12] as P2,
  resIn: [1.6, -0.95] as P2,
  resOut: [1.6, -0.45] as P2,
  pump2In: [1.73, -0.45] as P2,
  pump2Outs: [
    [2.1, -0.24],
    [1.85, -0.24],
  ] as P2[],
};

/** Цэвэрлэх байгууламж (хамгийн хойд талд, төмөр зам ба авто замын хооронд): дугуй тунгаагуур, агааржуулах сав, барилга */
const PO: P2 = [0.85, 1.25];
export const PLANT = {
  /** байгууламжийн загварын (анхны байрлалаас) шилжилт */
  off: PO,
  pad: { x0: 6.3, x1: 8.05, z0: -1.25, z1: -0.3 },
  clarifiers: [
    { c: [6.0 + PO[0], -2.12 + PO[1]] as P2, r: 0.28 },
    { c: [6.56 + PO[0], -2.06 + PO[1]] as P2, r: 0.21 },
  ],
  inlet: [6.8 + PO[0], -2.18 + PO[1]] as P2,
  outfall: [
    [6.0 + PO[0], -2.45 + PO[1]],
    [6.0 + PO[0], -2.7],
  ] as [P2, P2],
} as const;

/** Хараа голын гүүр (баруун тийшх зам, x = 6.0) */
export const BRIDGE = (() => {
  const x = 6.0;
  return { x, z: riverAt(x).z, half: 0.52, width: STREET_W + 0.08 };
})();

// ---------------------------------------------------------------------------------------------
// Дурсгалт газрууд, нийтийн байгууламж

/** "Дархан Ус Суваг" ХК-ийн төв байр (Хуучин Дархан, 8-р баг): 3 давхар, урд тал (+z) нь камер руу */
export const HQ = { x: 2.95, z: 1.07, w: 0.42, d: 0.15, h: 0.09 } as const;
/** Бурхантай уул: тойргийн баруун-өмнөд талд, оройд нь алтан Будда, суварга */
export const BUDDHA_HILL = { x: 0.25, z: -0.45, r: 0.42, h: 0.15 } as const;
/** Билэг тэмдэг №1: Шинэ Дарханы төвд ("Дархан-50" цогцолборт) жижиг толгод дээр */
export const BILEG_MOUND = { x: -1.36, z: 1.78, r: 0.21, h: 0.06 } as const;
/** Морин хуур цогцолбор ("Миний Монгол" цэцэрлэгт хүрээлэн): тойргийн зүүн-хойд талд */
export const MORIN_KHUUR = { x: 0.37, z: 1.3, r: 0.3 } as const;
/** Явган хүний гүүр (улбар шар, татлагат): Бурхантай уулаас авто замын дээгүүр (z чиглэлд) Морин хуур руу */
export const FOOTBRIDGE = { x: 0.37, z0: -0.316, z1: 0.7, stairs: 0.28, y: 0.1, width: 0.05, pylons: [-0.1, 0.66] } as const;
/** Дархан овоо — хотын өмнөд талын толгой */
export const OVOO_HILL = { x: -4.0, z: 1.45, r: 0.38, h: 0.12 } as const;

/** Гэр хороолол (хашаатай гэр, байшин): голын эрэг, төмөр замын баруун тал, хотын зах */
export const GER_AREAS: Rect[] = [
  { x0: 0.6, x1: 2.25, z0: -2.6, z1: -1.3 },
  { x0: 2.75, x1: 4.5, z0: -2.05, z1: -1.3 },
  { x0: 4.5, x1: 5.85, z0: -2.05, z1: -1.55 },
  { x0: -4.6, x1: -0.7, z0: -2.5, z1: -1.15 },
  { x0: 2.6, x1: 6.4, z0: 3.22, z1: 3.85 },
  { x0: -4.7, x1: -3.2, z0: 2.6, z1: 3.75 },
  { x0: 4.4, x1: 5.85, z0: -0.95, z1: -0.15 },
];

/** Шинэ Дархан, үйлдвэрийн төвийн байгууламжийн хашаа (генераторын барилга орохгүй) */
const ND = district("new");
const IND = district("ind");
export const CIVIC = {
  government: districtLot(ND, 1, 0),
  d50: districtLot(ND, 1, 1),
  hospital: districtLot(ND, 0, 1),
  colleges: districtLot(ND, 1, 2),
  theatre: districtLot(ND, 2, 0),
  market: districtLot(ND, 2, 1),
  arena: districtLot(ND, 2, 2),
  steel: districtLot(IND, 0, 0),
  tpp: districtLot(IND, 2, 0),
  cement: districtLot(IND, 1, 1),
} as const;
/** "Миний Монгол" цэцэрлэгт хүрээлэн (тойргийн өмнөх салаанаас зүүн тийш) ба төв хэсгийн баруун тал */
export const PARK: Rect = { x0: -0.02, x1: 0.88, z0: 0.62, z1: 3.62 };
export const CENTRAL: Rect = { x0: 1.12, x1: 2.32, z0: 0.62, z1: 3.62 };

/** Барилга генератор, мод орохгүй тэгш өнцөгтүүд */
export const RESERVED: Rect[] = [
  ...Object.values(CIVIC),
  { x0: HQ.x - HQ.w / 2 - 0.1, x1: HQ.x + HQ.w / 2 + 0.1, z0: HQ.z - HQ.d / 2 - 0.08, z1: HQ.z + HQ.d / 2 + 0.2 },
];

/** Толгодын өндөр (дурсгалт газрын толгод) — мод, сүүдэр, гүүрний тулгуурт */
export function moundHeight(x: number, z: number) {
  let h = 0;
  for (const m of [BUDDHA_HILL, BILEG_MOUND, OVOO_HILL]) {
    const q = Math.hypot(x - m.x, z - m.z) / m.r;
    if (q < 1) h = Math.max(h, m.h * (1 - q * q) ** 2);
  }
  return h;
}

/** Замын гадаргуугийн өндөр: хотод тэгш, хотоос гадна газрыг дагана, гол дээр гүүрний тавцан (y ≈ 0) */
export function roadY(x: number, z: number) {
  const inCore = x > CORE.x0 && x < CORE.x1 && z > CORE.z0 && z < CORE.z1;
  return inCore ? 0.006 : Math.max(terrainHeight(x, z), 0) + 0.014;
}

/** Засвар (lib/content outages[0].mapPoint-ийг scene хүлээн авна) */
export const svgToWorld = toW;

// ---------------------------------------------------------------------------------------------
// Шугам сүлжээ: цэвэр ус — гудамжны +0.08, бохир ус — −0.08 зайтай (замын хажуугийн зурвас)

export type Pipe = { pts: P2[]; r: number; kind: "clean" | "sewer" | "outfall"; trunk: boolean };

export const PIPES: Pipe[] = (() => {
  const P: Pipe[] = [];
  const add = (pts: P2[], kind: Pipe["kind"], trunk = false) => P.push({ pts, r: trunk ? 0.034 : kind === "sewer" ? 0.026 : 0.022, kind, trunk });
  const old = district("old");
  const ind = IND;
  // эх үүсвэр: худаг → коллектор → I өргөлт → усан сан → II өргөлт
  for (const [x, z] of WELLS) add([[x, z + 0.06], [x, NET.collectorZ]], "clean");
  add([[WELLS[WELLS.length - 1][0], NET.collectorZ], NET.pump1In], "clean", true);
  add([NET.pump1Out, [NET.pump1Out[0], NET.resIn[1]], NET.resIn], "clean", true);
  add([NET.resOut, NET.pump2In], "clean", true);
  // Хуучин Дархан: II өргөлтөөс авто замыг гатлан хорооллын эхний эгнээгээр
  const oz = old.ys[0] + 0.1;
  add([NET.pump2Outs[0], [2.25, NET.pump2Outs[0][1]], [2.25, oz], [old.xs[old.xs.length - 1] - 0.05, oz]], "clean", true);
  for (const x of old.xs.slice(1, -1)) add([[x + 0.08, oz], [x + 0.08, old.ys[old.ys.length - 1] - 0.08]], "clean");
  add([[old.xs[0] + 0.08, old.ys[1] + 0.08], [old.xs[old.xs.length - 1] - 0.08, old.ys[1] + 0.08]], "clean");
  // Шинэ Дархан, үйлдвэр: төв хэсгээр өмнө, өргөн чөлөөний дагуу баруун тийш
  const az = AVENUE_Z - 0.16;
  add(
    [
      NET.pump2Outs[1],
      [NET.pump2Outs[1][0], az],
      [ind.xs[ind.xs.length - 1] - 0.08, az],
      [ind.xs[ind.xs.length - 1] - 0.08, ind.ys[1] + 0.08],
      [ind.xs[0] + 0.08, ind.ys[1] + 0.08],
    ],
    "clean",
    true,
  );
  for (const x of ND.xs.slice(0, -1)) add([[x + 0.08, ND.ys[0] + 0.08], [x + 0.08, ND.ys[ND.ys.length - 1] - 0.08]], "clean");
  for (const j of [1, 3]) add([[ND.xs[0] + 0.08, ND.ys[j] + 0.08], [ND.xs[ND.xs.length - 1] - 0.08, ND.ys[j] + 0.08]], "clean");
  for (const x of ind.xs.slice(1, -1)) add([[x + 0.08, ind.ys[0] + 0.08], [x + 0.08, ind.ys[ind.ys.length - 1] - 0.08]], "clean");
  // бохир ус: үйлдвэр → Шинэ Дарханы зүүн зах → Хуучин Дархан → хойд талаар → цэвэрлэх байгууламж
  const sNew = ND.ys[ND.ys.length - 1] + 0.12;
  const sOld = old.ys[old.ys.length - 1] + 0.12;
  add(
    [
      [ind.xs[0] + 0.08, ind.ys[ind.ys.length - 1] + 0.08],
      [ind.xs[ind.xs.length - 1] + 0.08, ind.ys[ind.ys.length - 1] + 0.08],
      [ind.xs[ind.xs.length - 1] + 0.08, sNew],
      [2.3, sNew],
      [2.3, sOld],
      [8.67, sOld],
      [8.67, PLANT.inlet[1]],
      PLANT.inlet,
    ],
    "sewer",
    true,
  );
  for (const x of ND.xs.slice(1)) add([[x - 0.08, ND.ys[0] + 0.08], [x - 0.08, sNew]], "sewer");
  for (const x of old.xs.slice(1)) add([[x - 0.08, old.ys[0] + 0.08], [x - 0.08, sOld]], "sewer");
  for (const x of ind.xs.slice(1, -1)) add([[x - 0.08, ind.ys[0] + 0.08], [x - 0.08, ind.ys[ind.ys.length - 1] + 0.08]], "sewer");
  // цэвэршсэн ус → Хараа гол
  add([...PLANT.outfall], "outfall", true);
  return P;
})();

// ---------------------------------------------------------------------------------------------
// Сүлжээний зай (Dijkstra): урсгалын фронт ба импульсийн чиглэл

export type NetNode = { x: number; z: number; d: number };
export type PipeDist = { s: number[]; d: number[]; len: number };

/**
 * Хоолой бүрийг ~0.05 нэгжийн зангилаагаар хувааж, огтлолцол/холболтыг (0.03 доторх) нэгтгэнэ.
 * Цэвэр ус: эх үүсвэрийн хэсэг (худаг → I насос) нь "I насос хүртэлх зай"-гаар (урсгал нийлнэ),
 * түгээлт нь "I насосноос авах зай"-гаар; D = srcMax − toPump (эх үүсвэр), srcMax + fromPump (түгээлт) — тасралтгүй, урсгалын дагуу өснө.
 * Бохир ус: D = sewerMax − (байгууламж хүртэлх зай) — дээд урсгалаас байгууламж руу өснө.
 */
export function computeNetwork(pipes: Pipe[]) {
  type Node = { x: number; z: number; adj: { j: number; w: number }[] };
  const build = (filter: (p: Pipe) => boolean) => {
    const nodes: Node[] = [];
    const grid = new Map<string, number[]>();
    const key = (x: number, z: number) => `${Math.round(x / 0.06)},${Math.round(z / 0.06)}`;
    const near = (x: number, z: number) => {
      const kx = Math.round(x / 0.06);
      const kz = Math.round(z / 0.06);
      for (let a = -1; a <= 1; a++)
        for (let b = -1; b <= 1; b++)
          for (const i of grid.get(`${kx + a},${kz + b}`) ?? []) if (Math.hypot(nodes[i].x - x, nodes[i].z - z) < 0.03) return i;
      return -1;
    };
    const nodeAt = (x: number, z: number) => {
      const f = near(x, z);
      if (f >= 0) return f;
      nodes.push({ x, z, adj: [] });
      const k = key(x, z);
      grid.set(k, [...(grid.get(k) ?? []), nodes.length - 1]);
      return nodes.length - 1;
    };
    const paths: { pipe: number; ids: number[]; s: number[] }[] = [];
    pipes.forEach((p, pi) => {
      if (!filter(p)) return;
      const ids: number[] = [];
      const s: number[] = [];
      let acc = 0;
      for (let k = 0; k < p.pts.length - 1; k++) {
        const [x0, z0] = p.pts[k];
        const [x1, z1] = p.pts[k + 1];
        const L = Math.hypot(x1 - x0, z1 - z0);
        const n = Math.max(1, Math.ceil(L / 0.05));
        for (let i = k === 0 ? 0 : 1; i <= n; i++) {
          const t = i / n;
          ids.push(nodeAt(x0 + (x1 - x0) * t, z0 + (z1 - z0) * t));
          s.push(acc + L * t);
        }
        acc += L;
      }
      for (let i = 0; i < ids.length - 1; i++) {
        const a = ids[i];
        const b = ids[i + 1];
        if (a === b) continue;
        const w = Math.hypot(nodes[a].x - nodes[b].x, nodes[a].z - nodes[b].z);
        nodes[a].adj.push({ j: b, w });
        nodes[b].adj.push({ j: a, w });
      }
      paths.push({ pipe: pi, ids, s });
    });
    // огтлолцол: хоолойн дундах зангилаа нөгөө хоолойн зангилаатай давхцаагүй ч ойрхон бол холбоно
    for (let i = 0; i < nodes.length; i++)
      for (let j = i + 1; j < nodes.length; j++) {
        const w = Math.hypot(nodes[i].x - nodes[j].x, nodes[i].z - nodes[j].z);
        if (w < 0.045 && !nodes[i].adj.some((e) => e.j === j)) {
          nodes[i].adj.push({ j, w });
          nodes[j].adj.push({ j: i, w });
        }
      }
    const find = (x: number, z: number) => {
      const i = near(x, z);
      if (i < 0) throw new Error(`citymap: шугамын зангилаа олдсонгүй (${x.toFixed(2)}, ${z.toFixed(2)})`);
      return i;
    };
    return { nodes, paths, find };
  };
  const dijkstra = (nodes: Node[], sources: number[]) => {
    const dist = new Array(nodes.length).fill(Infinity);
    const done = new Array(nodes.length).fill(false);
    for (const s of sources) dist[s] = 0;
    for (;;) {
      let u = -1;
      let best = Infinity;
      for (let i = 0; i < nodes.length; i++) if (!done[i] && dist[i] < best) (best = dist[i]), (u = i);
      if (u < 0) break;
      done[u] = true;
      for (const e of nodes[u].adj) if (dist[u] + e.w < dist[e.j]) dist[e.j] = dist[u] + e.w;
    }
    return dist.map((d) => (Number.isFinite(d) ? d : 0));
  };

  // цэвэр ус
  const clean = build((p) => p.kind === "clean");
  const pump1In = clean.find(...NET.pump1In);
  const pump1Out = clean.find(...NET.pump1Out);
  // насос станцын байр: оролт ↔ гаралт (байр дотор) холбоно
  clean.nodes[pump1In].adj.push({ j: pump1Out, w: 0.18 });
  clean.nodes[pump1Out].adj.push({ j: pump1In, w: 0.18 });
  const res0 = clean.find(...NET.resIn);
  const res1 = clean.find(...NET.resOut);
  clean.nodes[res0].adj.push({ j: res1, w: 0.45 });
  clean.nodes[res1].adj.push({ j: res0, w: 0.45 });
  const p2In = clean.find(...NET.pump2In);
  const p2Outs = NET.pump2Outs.map((p) => clean.find(...p));
  for (const o of p2Outs) {
    clean.nodes[p2In].adj.push({ j: o, w: 0.2 });
    clean.nodes[o].adj.push({ j: p2In, w: 0.2 });
  }
  const toPump = dijkstra(clean.nodes, [pump1In]);
  const fromPump = dijkstra(clean.nodes, [pump1Out]);
  // эх үүсвэрийн хэсэг: I насосны оролт хүртэлх зай нь түгээлтийнхээс бага зангилаанууд
  const srcPart = clean.nodes.map((_, i) => toPump[i] < fromPump[i] && toPump[i] < 4.2);
  let srcMax = 0;
  clean.nodes.forEach((_, i) => {
    if (srcPart[i]) srcMax = Math.max(srcMax, toPump[i]);
  });
  const cleanD = clean.nodes.map((_, i) => (srcPart[i] ? srcMax - toPump[i] : srcMax + fromPump[i]));

  // бохир ус
  const sewer = build((p) => p.kind === "sewer");
  const plantIn = sewer.find(...PLANT.inlet);
  const toPlant = dijkstra(sewer.nodes, [plantIn]);
  const sewerMax = Math.max(...toPlant);
  const sewerD = toPlant.map((d) => sewerMax - d);

  const D = {
    stub: 0,
    pump1: srcMax,
    reservoir: cleanD[res0],
    reservoirOut: cleanD[res1],
    pump2: cleanD[p2In],
    cleanMax: Math.max(...cleanD),
    sewerMax,
  };
  // худгийн хоолойн төгсгөл (коллектор) хүртэлх D — эх үүсвэрийн алхмын фронт
  D.stub = Math.max(...WELLS.map(([x]) => cleanD[clean.find(x, NET.collectorZ)]));

  const perPipe = new Map<number, PipeDist>();
  const collect = (net: ReturnType<typeof build>, d: number[]) => {
    for (const p of net.paths) perPipe.set(p.pipe, { s: p.s, d: p.ids.map((i) => d[i]), len: p.s[p.s.length - 1] });
  };
  collect(clean, cleanD);
  collect(sewer, sewerD);
  return { perPipe, D, cleanNodes: clean.nodes.map((n, i) => ({ x: n.x, z: n.z, d: cleanD[i] })) };
}

export type Network = ReturnType<typeof computeNetwork>;

/** Цэгээс хамгийн ойрын цэвэр усны зангилааны D (барилга ус хүлээн авах дараалал) */
export function nearestCleanD(nodes: NetNode[], x: number, z: number) {
  let best = Infinity;
  let d = 0;
  for (const n of nodes) {
    const q = (n.x - x) ** 2 + (n.z - z) ** 2;
    if (q < best) {
      best = q;
      d = n.d;
    }
  }
  return d;
}
