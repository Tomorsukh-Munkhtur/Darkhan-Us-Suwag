import type { QualityTier } from "../journey/quality";

/**
 * CityMap-ийн pin ScrollTrigger ↔ 3D canvas хуваалцах төлөв. three.js import хийхгүй — CityMap.tsx (эхний bundle)
 * үүнийг л авна; scene (three + R3F) lazy chunk-д үлдэнэ.
 * progress — pin-ий scroll явц (0 → 1, scrub-гүй шууд утга); бүх үндсэн төлөв үүнээс (state.ts).
 * ambientTime — зөвхөн усны гялбаа, урсгалын жижиг хөдөлгөөн, модны найгалт, гэрлийн амьсгал.
 */
export type CityRuntime = {
  progress: number;
  ambientTime: number;
  reduced: boolean;
  tier: QualityTier;
  invalidate: () => void;
};

export function createCityRuntime(): CityRuntime {
  return { progress: 0, ambientTime: 0, reduced: false, tier: "MEDIUM", invalidate: () => {} };
}

/** Газрын зургийн түвшин бүрийн тохиргоо (бүтэн дэлгэцийн canvas тул DPR-ийг картуудаас бага барина) */
export const MAP_TIERS = {
  HIGH: { dpr: 1.5, aa: true, terrain: [180, 112], density: 1, lightStep: 0.42, fx: true },
  MEDIUM: { dpr: 1.25, aa: true, terrain: [150, 92], density: 0.72, lightStep: 0.5, fx: true },
  LOW: { dpr: 1, aa: false, terrain: [100, 62], density: 0.42, lightStep: 0.72, fx: false },
} as const;
