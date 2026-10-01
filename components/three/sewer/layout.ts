import { easeOutCubic, seg } from "../journey/utils/ease";

/**
 * Ариутгах татуургын 3D огтлолын дэлхийн координат (нэгж ≈ 10 м).
 * y = 0 — замын гадаргуу; z = FACE_Z — огтлолын хавтгай (хөрсний блокийн урд тал).
 * Гол шугам, коллектор, худаг, айлын холболт бүгд огтлолын хавтгай дээр төвтэй: урд хагас нь хасагдаж
 * дотор нь (бохир усны урсгал) харагдана. Shader-үүд эдгээр тогтмолыг template-ээр авна (JS ↔ GLSL ижил).
 * three.js import хийхгүй — wrapper эхний bundle-д үүнийг авч болно.
 */
export const FACE_Z = 0.45;
export const SLAB = { x0: -3, x1: 3, y0: -2.12, z0: -1.75 } as const;

/** Гудамж (урдаас хойш): зам → хашлага (curb) → явган зам → зүлэг, байшин. Хашлагаас хойш VERGE_H өндөр. */
export const STREET = { roadZ: -0.14, curbZ: -0.22, walkZ: -0.56, vergeH: 0.045 } as const;

/** Хөрсний давхаргын дээд хил: асфальт | суурь хайрга | нягтруулсан дүүргэлт | хөрс | шавранцар */
export const LAYERS = { base: -0.07, fill: -0.22, soil: -0.6, clay: -1.35 } as const;

export type House = { x: number; w: number; d: number; h: number; roof: number; gable: boolean; door: number; wall: string; roofColor: string };
export const HOUSE_Z = -0.95; // байшингуудын нүүр тал
export const HOUSES: readonly House[] = [
  { x: -2.2, w: 0.9, d: 0.6, h: 0.46, roof: 0.3, gable: false, door: 0.02, wall: "#7d8c9b", roofColor: "#2a3848" },
  { x: -0.95, w: 0.7, d: 0.64, h: 0.42, roof: 0.34, gable: true, door: 0.15, wall: "#8a8f98", roofColor: "#33333c" },
  { x: 0.3, w: 1.0, d: 0.62, h: 0.54, roof: 0.32, gable: false, door: 0.14, wall: "#728599", roofColor: "#243446" },
];

export const TREES = [
  { x: -2.84, z: -1.22, s: 0.72, round: false },
  { x: -1.54, z: -1.32, s: 0.95, round: true },
  { x: 1.02, z: -1.42, s: 1.0, round: false },
  { x: 2.62, z: -1.05, s: 0.9, round: true },
] as const;
export const LAMPS = [
  { x: -0.39, z: -0.29 },
  { x: 2.12, z: -0.29 },
] as const;

/** Айлын үзлэгийн худаг (огтлолоор хагас хайрцаг): хажуугийн гаргалгаа арын хананд орж ирнэ */
export const CHAMBER = { half: 0.1, depth: 0.2, wall: 0.035, floor: -0.46, lateralY: -0.3, lateralR: 0.042 } as const;
/** Айлын босоо холболт (худгийн ёроолоос гол шугам руу) */
export const HPIPE = { rIn: 0.038, rOut: 0.056 } as const;

/** Засвар үйлчилгээний худаг (бетон цагираг, конус, хүзүү, ган шат) */
export const MH = { x: 1.45, rIn: 0.25, wall: 0.07, neckR: 0.15, coneY: -0.42, neckY: -0.2, coverR: 0.19 } as const;
/** Гол шугам: зүүн ирмэгээс худгийн дотор хана хүртэл */
export const MAIN = { y: -1.12, rIn: 0.14, rOut: 0.18, x0: SLAB.x0, x1: MH.x - MH.rIn } as const;
/** Том коллектор: худгийн ёроолын суваг → баруун ирмэгээс гадагш цухуйсан хэсэг (stub) хүртэл */
export const COL = { y: -1.72, rIn: 0.2, rOut: 0.26, x0: MH.x - MH.rIn, x1: 3.28 } as const;
export const COL_LEVEL = COL.y - COL.rIn + 0.15;
/** Худгийн суурийн доод тал (reveal-ийн хэмжээ) */
export const MH_BOTTOM = COL.y - COL.rOut - 0.1;
/** Айлын холболт гол шугамд нийлэх өндөр */
export const JUNCTION_Y = MAIN.y + MAIN.rIn;
/** Хоолойн муфт хоорондын зай */
export const JOINT = 0.84;

/** Гол шугамын усны түвшин: айлын холболт бүрийн дараа бага зэрэг нэмэгдэнэ (урсгал нийлнэ) */
export const MAIN_DEPTH0 = 0.07;
export const MAIN_STEP = 0.022;
const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
};
export function mainLevel(x: number) {
  let d = MAIN_DEPTH0;
  for (const h of HOUSES) d += MAIN_STEP * smooth(h.x - 0.05, h.x + 0.25, x);
  return MAIN.y - MAIN.rIn + d;
}

/** Уналт (худаг доторх): гол шугамын гаралтаас коллекторын суваг руу */
export const DROP = { x0: MAIN.x1, dx: 0.2, y0: mainLevel(MAIN.x1) - 0.065, y1: COL_LEVEL } as const;

// ---------------------------------------------------------------------------------------------
// Элемент (reveal/flow uniform-ын индекс) ба "along" (0 → 1) — JS geometry ба GLSL ижил томьёогоор
// 0..2 — айлын холболт (гадаргуу → гол шугам, y-ээр), 3 — гол шугам (x), 4 — худаг (y), 5 — коллектор (x)
export const ELEMENTS = 6;
export const alongHouse = (y: number) => y / JUNCTION_Y;
export const alongMain = (x: number) => (x - MAIN.x0) / (MAIN.x1 - MAIN.x0);
export const alongManhole = (y: number) => y / MH_BOTTOM;
export const alongCollector = (x: number) => (x - COL.x0) / (COL.x1 - COL.x0);
/** Айлын урсгал хажуугийн гаргалгаанаас эхэлнэ */
export const LATERAL_ALONG = alongHouse(CHAMBER.lateralY) - 0.012;
export const IMPACT_ALONG = alongCollector(DROP.x0 + DROP.dx);

// Өсөлтийн бүлэг (uGrow): 0..2 байшин, 3..6 мод, 7..8 гудамжны гэрэл, 9 — замын таг (зам бэлэн болоход)
export const GROUPS = 10;
// Гэрлийн индекс (uLit): 0..2 байшингийн цонх, 3..4 гудамжны гэрэл
export const LITS = 5;

/**
 * Progress (0 → 1) → бүх төлөв. Цэвэр функц: цаг ашиглахгүй, буцааж гүйлгэхэд яг урвуу.
 *   0.00–0.10  хөрсний блок бараан (бараг хоосон)
 *   0.10–0.30  зам, явган зам, байшин, мод, гэрэл босч, цонх асна
 *   0.30–0.50  айлын үзлэгийн худаг ба босоо холболтууд (дээрээс доош)
 *   0.50–0.70  гол шугам (зүүнээс баруун), засварын худаг, коллектор
 *   0.70–0.90  бохир ус: айлаас → гол шугам → худгийн уналт → коллектор
 *   0.90–1.00  бүрэн ажиллагаа (урсгалын гэрэлтэлт, засварын худгийн тэмдэглэгээ)
 */
export type SewerState = {
  dim: number;
  surface: number;
  marks: number;
  active: number;
  grow: number[];
  lit: number[];
  /** элемент бүрийн нээгдсэн хэсэг (along) */
  reveal: number[];
  /** элемент бүрийн урсгалын фронт (along) */
  flow: number[];
};

export function createSewerState(): SewerState {
  return {
    dim: 0,
    surface: 0,
    marks: 0,
    active: 0,
    grow: new Array(GROUPS).fill(0),
    lit: new Array(LITS).fill(0),
    reveal: new Array(ELEMENTS).fill(0),
    flow: new Array(ELEMENTS).fill(0),
  };
}

const ramp = (p: number, a: number, b: number) => easeOutCubic(seg(p, a, b));
const front = (f: number, start: number) => (f > 0.0005 ? start + (1 - start) * f : 0);

export function sewerState(p: number, s: SewerState): SewerState {
  s.dim = 0.4 + 0.6 * ramp(p, 0.02, 0.3);
  s.surface = seg(p, 0.1, 0.24);
  s.marks = seg(p, 0.18, 0.28);
  s.active = ramp(p, 0.9, 1);
  for (let i = 0; i < 3; i++) s.grow[i] = ramp(p, 0.1 + i * 0.045, 0.2 + i * 0.045);
  for (let i = 0; i < 4; i++) s.grow[3 + i] = ramp(p, 0.16 + i * 0.022, 0.26 + i * 0.022);
  for (let i = 0; i < 2; i++) s.grow[7 + i] = ramp(p, 0.19 + i * 0.02, 0.27 + i * 0.02);
  s.grow[9] = seg(p, 0.14, 0.22);
  for (let i = 0; i < 3; i++) s.lit[i] = seg(p, 0.22 + i * 0.03, 0.3 + i * 0.03);
  for (let i = 0; i < 2; i++) s.lit[3 + i] = seg(p, 0.25 + i * 0.015, 0.3 + i * 0.015);

  for (let i = 0; i < 3; i++) s.reveal[i] = seg(p, 0.3 + i * 0.04, 0.42 + i * 0.04);
  s.reveal[3] = seg(p, 0.5, 0.63);
  s.reveal[4] = seg(p, 0.55, 0.66);
  s.reveal[5] = seg(p, 0.6, 0.7);

  for (let i = 0; i < 3; i++) s.flow[i] = front(seg(p, 0.7 + i * 0.02, 0.76 + i * 0.02), LATERAL_ALONG);
  s.flow[3] = front(seg(p, 0.74, 0.84), 0);
  s.flow[4] = front(seg(p, 0.83, 0.86), 0);
  s.flow[5] = front(seg(p, 0.85, 0.92), IMPACT_ALONG - 0.08);
  return s;
}
