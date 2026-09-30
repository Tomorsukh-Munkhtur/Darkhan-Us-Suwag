import type { JourneyView } from "./runtime";
import { journeyProgress } from "./progress";

/** Canvas зурвасын байрлал (stage доторх, CSS px) ба картын булангийн мэдээлэл — measure() үед л тооцно */
export type JourneyBand = {
  top: number;
  height: number;
  /** Картын дотоод бөөрөнхий радиус (scale = 1 үед) */
  radius: number;
  /** Зургийн хэсгийн аль булан картын булантай давхцах: [зүүн-дээд, баруун-дээд, баруун-доод, зүүн-доод] */
  corners: readonly [boolean, boolean, boolean, boolean];
};

/**
 * Зурвас = картын зургийн хэсгийн (.journey-visual) босоо муж × stage-ийн бүтэн өргөн.
 * Хөрш картууд (scale 0.9, дээд төвөөрөө жижгэрнэ) энэ мужид багтана → гүйлгэх үед canvas resize хийгдэхгүй.
 * offsetTop/offsetLeft нь transform-д нөлөөлөгдөхгүй тул картын одоогийн scale-аас үл хамаарна.
 */
export function measureJourneyBand(row: HTMLElement, card: HTMLElement, slot: HTMLElement): JourneyBand {
  const glass = slot.parentElement!;
  const cs = getComputedStyle(glass);
  const radius = Math.max(0, parseFloat(cs.borderTopLeftRadius) - glass.clientLeft);
  // article-ийн координатаар: картын дотоод хүрээ ба зургийн хэсэг
  const gl = glass.offsetLeft + glass.clientLeft;
  const gt = glass.offsetTop + glass.clientTop;
  const gr = gl + glass.clientWidth;
  const gb = gt + glass.clientHeight;
  const sl = slot.offsetLeft;
  const st = slot.offsetTop;
  const sr = sl + slot.offsetWidth;
  const sb = st + slot.offsetHeight;
  const near = (a: number, b: number) => Math.abs(a - b) <= 2;
  return {
    top: row.offsetTop + card.offsetTop + slot.offsetTop,
    height: slot.offsetHeight,
    radius,
    corners: [near(sl, gl) && near(st, gt), near(sr, gr) && near(st, gt), near(sr, gr) && near(sb, gb), near(sl, gl) && near(sb, gb)],
  };
}

/**
 * Одоогийн scroll байрлалаас (pos) харагдаж буй карт бүрийн view: зургийн хэсгийн дотоод хүрээ (border-ийг
 * хасна — картын хуваагч шугам харагдсаар байна), картын одоогийн opacity, progress.
 * WaterJourney.update()-д картын transform/opacity бичсэний ДАРАА дуудна (getBoundingClientRect нь тэдгээрийг тусгана).
 */
export function computeJourneyViews(
  pos: number,
  entry: number,
  band: HTMLElement,
  cards: (HTMLElement | null)[],
  slots: (HTMLElement | null)[],
  layout: JourneyBand,
): JourneyView[] {
  const br = band.getBoundingClientRect();
  const views: JourneyView[] = [];
  for (let i = 0; i < slots.length; i++) {
    if (Math.abs(pos - i) > 1.6) continue;
    const slot = slots[i];
    const card = cards[i];
    if (!slot || !card || slot.offsetWidth === 0) continue;
    const r = slot.getBoundingClientRect();
    const s = r.width / slot.offsetWidth;
    const rect = {
      x: r.left - br.left + slot.clientLeft * s,
      y: r.top - br.top + slot.clientTop * s,
      w: slot.clientWidth * s,
      h: slot.clientHeight * s,
    };
    if (rect.x + rect.w <= 0 || rect.x >= br.width || rect.y + rect.h <= 0 || rect.y >= br.height) continue;
    const opacity = card.style.opacity === "" ? 1 : Number(card.style.opacity);
    if (opacity <= 0.01) continue;
    views.push({ stage: i, progress: journeyProgress(pos, i, entry), rect, opacity, radius: layout.radius * s, corners: layout.corners });
  }
  return views;
}
