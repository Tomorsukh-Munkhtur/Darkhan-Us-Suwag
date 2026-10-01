import type { QualityTier } from "../journey/quality";

/**
 * Цорго → шилэн аяганы canvas-тай хуваалцах төлөв. three.js import хийхгүй — wrapper (SupplyVisual3D)
 * эхний bundle-д үүнийг л авна; scene өөрөө (three + R3F) lazy chunk-д үлдэнэ.
 *
 * Үндсэн төлөв (усны түвшин) зөвхөн progress-оос; ambientTime нь гадаргуугийн гялбаа, урсгалын жижиг
 * хэлбэлзэл, бөмбөлгийн хөдөлгөөнд л нөлөөлнө (унтраалттай үед 0 → кадр progress-ийн цэвэр функц).
 */
export type FaucetRuntime = {
  progress: number;
  ambient: boolean;
  ambientTime: number;
  reduced: boolean;
  tier: QualityTier;
  invalidate: () => void;
};

export function createFaucetRuntime(): FaucetRuntime {
  return { progress: 0, ambient: true, ambientTime: 0, reduced: false, tier: "MEDIUM", invalidate: () => {} };
}
