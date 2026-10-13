/**
 * Системийн "Animation effects" / prefers-reduced-motion тохиргоог хүндэтгэх эсэх.
 * false — Windows/macOS дээр хөдөлгөөн унтраалттай байсан ч усны бүх эффект ажиллана.
 * true болговол хуучин зан төлөв (reduce үед эффектүүд унтарна) сэргэнэ.
 */
export const RESPECT_REDUCED_MOTION = false;

/** gsap.matchMedia / matchMedia-д: хөдөлгөөн зөвшөөрөгдсөн үед таарах query */
export const MQ_MOTION_OK = RESPECT_REDUCED_MOTION ? "(prefers-reduced-motion: no-preference)" : "all";
/** хөдөлгөөн багасгах горимд таарах query ("not all" — хэзээ ч таарахгүй) */
export const MQ_MOTION_REDUCED = RESPECT_REDUCED_MOTION ? "(prefers-reduced-motion: reduce)" : "not all";

/** Хөдөлгөөн багасгах горим идэвхтэй эсэх (зөвхөн client дээр дуудна) */
export function prefersReducedMotion() {
  return window.matchMedia(MQ_MOTION_REDUCED).matches;
}
