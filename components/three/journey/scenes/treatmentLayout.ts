/**
 * 2.3 — Цэвэршүүлэлт: савны байрлал. TreatmentScene.tsx ба DOM шошго (stages.ts) хуваалцана.
 * Сав тавцангийн голд; зүүнээс орох, баруун тийш гарах шугамтай.
 */
export const TANK = { x: 0, z: 0, length: 3.2, height: 0.72, depth: 0.8, level: 0.56, zones: 5 } as const;

/** тасалгаа i-гийн төвийн x */
export const tankZoneX = (i: number) => TANK.x - TANK.length / 2 + (TANK.length / TANK.zones) * (i + 0.5);
