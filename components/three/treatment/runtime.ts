import type { QualityTier } from "../journey/quality";

/**
 * Цэвэрлэх байгууламжийн canvas-тай хуваалцах төлөв. three.js import хийхгүй — wrapper (TreatmentVisual3D)
 * эхний bundle-д үүнийг л авна; scene өөрөө (three + R3F) lazy chunk-д үлдэнэ.
 *
 * Үндсэн төлөв (сав, усны түвшин, цэвэршилт, урсгал) зөвхөн progress-оос; ambientTime нь гүүрний удаан
 * эргэлт, усны гялбаа, жижиг долгио, гэрлийн "амьсгал"-д л нөлөөлнө (унтраалттай үед 0).
 */
export type TreatmentRuntime = {
  progress: number;
  ambientTime: number;
  reduced: boolean;
  tier: QualityTier;
  invalidate: () => void;
};

export function createTreatmentRuntime(): TreatmentRuntime {
  return { progress: 0, ambientTime: 0, reduced: false, tier: "MEDIUM", invalidate: () => {} };
}
