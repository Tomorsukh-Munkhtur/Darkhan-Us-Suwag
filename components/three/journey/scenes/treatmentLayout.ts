/**
 * 2.3 — Цэвэршүүлэлт: савны байрлал. TreatmentScene.tsx ба DOM шошго (stages.ts) хуваалцана.
 * Сав зүүн талд, баруун талд нь түгээх шугам ба айл өрх (орон сууц, гэр хороолол).
 */
export const TANK = { x: -0.85, z: -0.35, length: 2.5, height: 0.72, depth: 0.8, level: 0.56, zones: 5 } as const;

/** тасалгаа i-гийн төвийн x */
export const tankZoneX = (i: number) => TANK.x - TANK.length / 2 + (TANK.length / TANK.zones) * (i + 0.5);

/** орон сууцнууд: төв (x, z), өргөн, гүн, өндөр, давхар; delay — ус хүрэх дараалал (0–1) */
export const APARTMENTS = [
  { x: 1.0, z: -0.2, w: 0.42, d: 0.5, h: 0.62, floors: 6, delay: 0 },
  { x: 1.58, z: -0.2, w: 0.42, d: 0.5, h: 0.86, floors: 8, delay: 0.5 },
  { x: 2.16, z: -0.2, w: 0.42, d: 0.5, h: 0.55, floors: 5, delay: 1 },
] as const;

/** "Айл өрх" шошго — хамгийн өндөр орон сууцны дээр */
export const HOMES_ANCHOR: [number, number, number] = [APARTMENTS[1].x, APARTMENTS[1].h + 0.24, APARTMENTS[1].z];
