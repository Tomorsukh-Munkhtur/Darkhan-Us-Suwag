/**
 * Чанарын түвшин. Шинэ dependency-гүй; бодит төхөөрөмж дээр туршиж тохируулна.
 * Дүрслэлийн төлөв (юу босгосон, түвшин, гэрэл) бүх түвшинд ижил — зөвхөн нарийвчлал, хоёрдогч эффект өөр.
 */
export type QualityTier = "HIGH" | "MEDIUM" | "LOW";

export type TierSettings = {
  /** devicePixelRatio-ийн дээд хязгаар */
  dpr: number;
  /** MSAA (context үүсэх үед л хэрэглэгдэнэ) */
  antialias: boolean;
  /** Чимэглэлийн давталттай хөдөлгөөн (гялбаа, урсгал) — scroll-гүй үед ч зурна */
  ambient: boolean;
  /** Хоёрдогч эффект: гэрлийн толбо (glow), тавцангийн техникийн шугам */
  fx: boolean;
  /** Бөөмийн тоо (хольц, бөмбөлөг, дусал) — бүтэн тооны хувь */
  particles: number;
  /** Усны shader-ийн noise давхарга: 1 — хоёр, 0 — нэг */
  waterDetail: number;
};

export const TIERS: Record<QualityTier, TierSettings> = {
  HIGH: { dpr: 2, antialias: true, ambient: true, fx: true, particles: 1, waterDetail: 1 },
  MEDIUM: { dpr: 1.5, antialias: true, ambient: true, fx: true, particles: 0.6, waterDetail: 1 },
  LOW: { dpr: 1, antialias: false, ambient: false, fx: false, particles: 0.3, waterDetail: 0 },
};

export type TierSignals = {
  coarsePointer: boolean;
  saveData: boolean;
  /** navigator.deviceMemory (зөвхөн Chromium; бусад хөтөчид undefined) */
  memory?: number;
  cores?: number;
};

/** Цэвэр функц: эхний түвшин. GPU-ийн нэрийг ашиглахгүй (найдваргүй, нууцлалын хязгаартай). */
export function detectTier(s: TierSignals): QualityTier {
  if (s.saveData) return "LOW";
  const cores = s.cores ?? 4;
  const memory = s.memory ?? 4;
  if (s.coarsePointer) return memory <= 4 || cores <= 4 ? "LOW" : "MEDIUM";
  return cores >= 8 && memory >= 8 ? "HIGH" : "MEDIUM";
}

export function readTierSignals(): TierSignals {
  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
  return {
    coarsePointer: window.matchMedia("(pointer: coarse)").matches,
    saveData: nav.connection?.saveData === true,
    memory: nav.deviceMemory,
    cores: nav.hardwareConcurrency,
  };
}
