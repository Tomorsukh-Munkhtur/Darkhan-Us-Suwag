/**
 * Production WaterJourney-ийн scroll байрлал (pos: 0 … N-1, аль картын төвд байгааг илэрхийлэх бутархай тоо)
 * → идэвхтэй карт, 3D-ийн progress, давхаргын ил тод байдал. Бүгд цэвэр функц — scroll-оо буцаахад урвуу.
 *
 * WaterJourney.tsx-д pos = progress · (N − 1) гэж аль хэдийн тооцогддог (update()).
 */

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

/** 3D давхарга бүдгэрч эхлэх / бүрэн алга болох зай (картын өргөнөөр) */
export const FADE_START = 0.35;
export const FADE_END = 0.5;

/** Идэвхтэй карт: төвд хамгийн ойр нь (WaterJourney-ийн active-тай ижил: Math.round) */
export function activeCard(pos: number, count: number) {
  return Math.min(count - 1, Math.max(0, Math.round(pos)));
}

/**
 * Идэвхтэй картын 3D progress: идэвхтэй болох мөчид (pos = i − 0.5) 0, төвд ирэхэд (pos = i) 1,
 * цааш явахад 1 хэвээр. Эхний карт pos = 0-д бүрэн босгосон байна.
 */
export function cardProgress(pos: number, index: number) {
  return clamp01((pos - (index - 0.5)) / 0.5);
}

/**
 * Одоогийн SVG visual-ын scrub зорилго (WaterJourney.tsx driveVisual-тай ижил): карт баруунаас орж ирэхэд
 * эхэлж, төвд ирэхэд дуусна. Хөрш, алс картууд үүнийг хэвээр ашиглана.
 */
export function svgScrubTarget(pos: number, index: number) {
  return clamp01(pos - (index - 1));
}

/**
 * 3D давхаргын opacity: картын төвөөс FADE_START хүртэл бүрэн, FADE_END-д 0.
 * Идэвхтэй карт солигдох агшинд (|pos − i| = 0.5) 3D харагдахгүй → доорх SVG харагдана, үсрэлт үгүй.
 */
export function overlayOpacity(pos: number, index: number) {
  return 1 - smoothstep(FADE_START, FADE_END, Math.abs(pos - index));
}

/**
 * Production 3D-ийн progress (WaterJourney-ийн одоогийн SVG scrub-тай ижил логик):
 * карт баруунаас ойртож эхлэхэд (pos = i − 1) 0, төвд ирэхэд (pos = i) 1; буцааж гүйлгэхэд урвуу.
 * Эхний карт: хэсэг рүү орж ирэх scroll-оор (entry 0 → 1) босно, аялал эхэлсний дараа 1 хэвээр.
 */
export function journeyProgress(pos: number, index: number, entry: number) {
  if (index === 0) return pos > 0 ? 1 : clamp01(entry);
  return clamp01(pos - (index - 1));
}
