import type { QualityTier } from "../journey/quality";

/**
 * Ариутгах татуургын огтлолын canvas-тай хуваалцах төлөв. three.js import хийхгүй — wrapper (SewerVisual3D)
 * эхний bundle-д үүнийг л авна; scene өөрөө (three + R3F) lazy chunk-д үлдэнэ.
 *
 * Үндсэн төлөв (юу нээгдсэн, урсгал хаа хүрсэн) зөвхөн progress-оос; ambientTime нь бохир усны гялбаа,
 * урсгалын зурвасын жижиг хөдөлгөөн, гэрлийн "амьсгал"-д л нөлөөлнө (унтраалттай үед 0).
 */
export type SewerRuntime = {
  progress: number;
  ambientTime: number;
  reduced: boolean;
  tier: QualityTier;
  invalidate: () => void;
};

export function createSewerRuntime(): SewerRuntime {
  return { progress: 0, ambientTime: 0, reduced: false, tier: "MEDIUM", invalidate: () => {} };
}
