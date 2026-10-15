/**
 * Бохир усны аяллын (SewageJourney) 3D диорамуудын хуваалцсан байрлал (scene-үүд, камерын тавцан — stages.ts).
 * Тэнхлэг: x — урсгалын чиглэл (зүүнээс баруун тийш), z — камер руу, y — дээш.
 * three.js импортлохгүй — хэсгийн (SewageJourney) үндсэн bundle-д шошгоор дамжин орно.
 */

/** Гадаргуу дээрх шугамын өндөр (Plinth-ийн дээд тал y = 0) */
export const PY = 0.035;

/** 01 Айл өрх: огтлолтой газар, газар доорх гудамжны татуурга (урд огтлолын нүүрэн дээр) */
export const HOMES = {
  w: 4.2,
  d: 2.4,
  layers: [0.14, 0.3, 0.3, 0.36],
  sewerY: -0.27,
  buildings: [
    { x: -1.25, z: -0.4, w: 0.9, d: 0.6, h: 1.25, floors: 9, delay: 0 },
    { x: 0.05, z: -0.35, w: 0.75, d: 0.6, h: 0.95, floors: 7, delay: 0.45 },
    { x: 1.2, z: -0.45, w: 0.6, d: 0.5, h: 0.7, floors: 5, delay: 0.9 },
  ],
} as const;
export const HOMES_DEPTH = HOMES.layers.reduce((a, b) => a + b, 0);
export const HOMES_SEWER_Z = HOMES.d / 2 + 0.07;

/** 02 Шугам нэгдэх: салаа шугамууд нийлэх худаг (J) руу нийлж, гол шугам баруун тийш */
export const JUNCTION: [number, number, number] = [0.3, PY, 0.25];

/** 03 Дамжуулах станц: суваг, сараалж, насос станц, даралттай шугам */
export const STATION = {
  channel: { x0: -1.55, x1: -0.15, z: 0, w: 0.28 },
  screenX: -0.9,
  house: { x: 0.4, z: -0.05, w: 1.1, d: 0.75, h: 0.62 },
  pumps: { x: 1.2, z: [-0.18, 0.18] as const },
  /** хавтангийн өргөн (x хагас нь орох / гарах шугамын үзүүр) */
  w: 3.8,
} as const;

/** 04 Төв цэвэрлэх байгууламж: 7 үе шатын байгууламж урсгалын дагуу (x); top — байгууламжийн дээд өндөр (ойролцоо) */
export const PLANT = [
  { id: "screen", x: -2.0, top: 0.16 },
  { id: "grit", x: -1.45, top: 0.22 },
  { id: "primary", x: -0.8, top: 0.2 },
  { id: "aeration", x: 0.05, top: 0.22 },
  { id: "secondary", x: 0.9, top: 0.2 },
  { id: "filters", x: 1.5, top: 0.42 },
  { id: "uv", x: 2.05, top: 0.16 },
] as const;

/** 05 Байгаль орчин: гадагшлуулах хоолойн ам (headwall) */
export const OUTFALL = { x: -0.25, z: 0.3 } as const;
/** Лабораторийн хяналтын цэг */
export const LAB = { x: 0.75, z: -0.45 } as const;
