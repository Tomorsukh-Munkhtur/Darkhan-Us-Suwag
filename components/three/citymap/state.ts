import type { Network, P2 } from "./layout";

/**
 * Pin-ий scroll progress (0 → 1) → тасралтгүй алхмын координат v (0 → 6).
 * CityMap-ийн `active` = floor(min(p / 0.9, 1) · 5) — алхам 0–4 нь pin-ий 18%, сүүлийн алхам 10% "барих" хэсэгт.
 * v: алхам i идэвхтэй үед v ∈ [i, i + 1); 5-р алхмын дотоод явц нь p ∈ [0.9, 1].
 */
export function stageCoord(p: number) {
  const q = Math.min(Math.max(p, 0), 1);
  return q <= 0.9 ? (q / 0.9) * 5 : 5 + (q - 0.9) / 0.1;
}

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const seg = (v: number, a: number, b: number) => clamp01((v - a) / (b - a));
const smooth = (v: number, a: number, b: number) => {
  const t = seg(v, a, b);
  return t * t * (3 - 2 * t);
};
/** Камерын шилжилт: эхлэл/төгсгөлдөө илүү зөөлөн (smootherstep) */
const smoother = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Алхам бүрт хүрээд камер (ба онцлох бүс) барина; дараагийн алхам руу шилжилт нь алхмын сүүлийн 38%-д */
const HOLD = 0.62;
export function stageBlend(v: number) {
  const a = Math.min(Math.floor(v), 5);
  const f = v - a;
  const t = a >= 5 ? 0 : smoother(seg(f, HOLD, 1));
  return { a, b: Math.min(a + 1, 5), t };
}

// Онцлох бүс: [эх үүсвэр, насос, усан сан, хот (барилга, цэвэр усны сүлжээ), цэвэрлэх байгууламж (бохир ус)]
export const ZONES = 5;
const EMPH: number[][] = [
  [1.0, 0.42, 0.42, 0.42, 0.4],
  [0.72, 1.0, 0.62, 0.45, 0.4],
  [0.62, 0.82, 1.0, 0.5, 0.42],
  [0.7, 0.82, 0.85, 1.0, 0.55],
  [0.6, 0.6, 0.62, 0.72, 1.0],
  [0.9, 0.9, 0.9, 1.0, 0.92],
];

export type CityState = {
  v: number;
  emph: number[];
  /** цэвэр усны фронт (сүлжээний зай D) */
  clean: number;
  /** бохир усны фронт (D) */
  sewer: number;
  /** цэвэршсэн усны гаргалгаа 0..1 */
  outfall: number;
  wells: number;
  pump1: number;
  pump2: number;
  /** усан сангийн дүүргэлт 0..1 */
  reservoir: number;
  plant: number;
  /** цонхны гэрлийн долгион: D-ийн фронт (5-р алхам) */
  windows: number;
};

export function createCityState(): CityState {
  return { v: 0, emph: new Array(ZONES).fill(0), clean: 0, sewer: 0, outfall: 0, wells: 0, pump1: 0, pump2: 0, reservoir: 0, plant: 0, windows: 0 };
}

/** Цэвэр функц: v (scroll) → бүх төлөв. Цаг ашиглахгүй — буцааж гүйлгэхэд яг урвуу. */
export function cityState(v: number, net: Network, s: CityState): CityState {
  const D = net.D;
  s.v = v;
  const { a, b, t } = stageBlend(v);
  for (let i = 0; i < ZONES; i++) s.emph[i] = lerp(EMPH[a][i], EMPH[b][i], t);

  // 1 — эх үүсвэр: худгийн хоолой; 2 — коллектор → I насос → усан сан руу
  let c = lerp(0, D.stub, smooth(v, 0.08, 0.55));
  c = Math.max(c, lerp(D.stub, D.pump1, smooth(v, 1.0, 1.4)) * (v >= 1 ? 1 : 0));
  c = Math.max(c, lerp(D.pump1, D.reservoir, smooth(v, 1.45, 1.65)) * (v >= 1.45 ? 1 : 0));
  // 3 — усан сан дүүрч, II насос руу
  c = Math.max(c, lerp(D.reservoirOut, D.pump2, smooth(v, 2.35, 2.6)) * (v >= 2.35 ? 1 : 0));
  // 4 — хот даяар түгээлт
  c = Math.max(c, lerp(D.pump2, D.cleanMax + 0.05, smooth(v, 3.0, 3.62)) * (v >= 3 ? 1 : 0));
  s.clean = c;
  s.wells = smooth(v, 0.02, 0.3);
  s.pump1 = smooth(v, 1.3, 1.5);
  s.reservoir = smooth(v, 2.0, 2.45);
  s.pump2 = smooth(v, 2.5, 2.65);
  // 5 — бохир ус → цэвэрлэх байгууламж → гол
  s.sewer = lerp(0, D.sewerMax + 0.05, smooth(v, 4.0, 4.4));
  s.plant = smooth(v, 4.3, 4.55);
  s.outfall = smooth(v, 4.5, 4.65);
  // 6 — хэрэглэгчид: ус хүрсэн дарааллаар цонх асна
  s.windows = lerp(D.pump2, D.cleanMax + 0.3, smooth(v, 5.0, 5.6)) * (v >= 5 ? 1 : 0);
  return s;
}

// ---------------------------------------------------------------------------------------------
// Камер: алхам бүрийн зураглал (дронын дээрээс-ташуу харагдац), алхмын хооронд зөөлөн шилжилт

export type Shot = {
  /** фокус (дэлхийн x, z) */
  target: P2;
  /** харагдах газрын босоо хүрээ (нэгж) — SVG-ийн "cover" + zoom-той дүйцэхүйц */
  ground: number;
  az: number;
  el: number;
  /** фокус дэлгэцийн хаана (NDC) — desktop дээр самбараас баруун тийш (SVG-ийн --vx/--vy) */
  focus: boolean;
};

/** Хойд зүг +x (баруун), зүүн зүг +z (камер руу): эх үүсвэр — Хараа голын эрэг (баруун-ард), насос станц ба усан сан —
 *  төмөр зам ба авто замын хооронд, цэвэрлэх байгууламж — хамгийн хойд (баруун) талд */
const S: Shot[] = [
  { target: [4.15, -2.45], ground: 5.6, az: -5, el: 50, focus: true },
  { target: [2.25, -1.35], ground: 4.9, az: 6, el: 53, focus: true },
  { target: [1.3, -0.5], ground: 4.4, az: -4, el: 55, focus: true },
  { target: [-0.6, 0.55], ground: 10.6, az: 0, el: 56, focus: false },
  { target: [7.15, -0.8], ground: 5.0, az: 8, el: 52, focus: true },
  { target: [-0.55, 0.65], ground: 10.6, az: -4, el: 58, focus: false },
];
export const SHOTS = S;
/**
 * Mobile (босоо нарийн дэлгэц): тойм зураглалын оронд 4-р алхамд төв хэсэг → Шинэ Дархан, 6-р алхамд Хуучин Дархны
 * гэрэлтэй байрууд руу. 2-р алхамд I насос станцаас усан сан руу чиглэсэн шугам руу ойртуулна.
 */
const MOBILE: (Partial<Shot> | null)[] = [
  null,
  { target: [2.4, -1.5], ground: 5.0 },
  null,
  { target: [-0.4, 1.4], ground: 6.0, focus: true },
  null,
  { target: [4.3, 1.6], ground: 5.6, focus: true },
];
const shotFor = (i: number, mobile: boolean): Shot => (mobile && MOBILE[i] ? { ...S[i], ...MOBILE[i] } : S[i]);

/** Фокустай зураглалын дэлгэцийн байрлал: desktop — баруун-төв (алхмын самбар зүүн талд), mobile — баруун-дээш (доод карт) */
export const FOCUS_NDC = { desktop: [0.3, -0.05] as P2, mobile: [0.36, 0.2] as P2 };

export type CameraPose = { x: number; z: number; ground: number; az: number; el: number; offX: number; offY: number };

export function cameraPose(v: number, mobile: boolean, out: CameraPose): CameraPose {
  const { a, b, t } = stageBlend(v);
  const A = shotFor(a, mobile);
  const B = shotFor(b, mobile);
  const off = mobile ? FOCUS_NDC.mobile : FOCUS_NDC.desktop;
  const fa = A.focus ? 1 : 0;
  const fb = B.focus ? 1 : 0;
  // хол/ойрын шилжилтэд зайг логарифмаар (жигд мэдрэмж)
  out.x = lerp(A.target[0], B.target[0], t);
  out.z = lerp(A.target[1], B.target[1], t);
  out.ground = Math.exp(lerp(Math.log(A.ground), Math.log(B.ground), t)) * (mobile ? 1.18 : 1);
  out.az = lerp(A.az, B.az, t);
  out.el = lerp(A.el, B.el, t);
  // дроны нум: хол зайн шилжилтэд дунд хэсэгт дээш гарч, илүү өргөн харагдаад дараагийн обьект руу буух
  const travel = Math.hypot(B.target[0] - A.target[0], B.target[1] - A.target[1]);
  const arc = Math.sin(Math.PI * t) * Math.min(1, travel / 5);
  out.ground *= 1 + 0.3 * arc;
  out.el += 6 * arc;
  const f = lerp(fa, fb, t);
  out.offX = off[0] * f;
  out.offY = off[1] * f;
  return out;
}
