import { TIERS, type QualityTier } from "./quality";

/**
 * Canvas доторх бүх хэсгийн хуваалцдаг төлөв. React-ийн гадна хувьсана → scroll бүрт re-render хийхгүй.
 *
 * Үнэний эх сурвалж нь ХОЁР л утга: stage (0–5) ба progress (0–1). Харагдах бүх төлөв (босгосон хэсэг,
 * усны түвшин, гэрэл, урсгалын байрлал, камер) эдгээрээс тооцогдоно → progress-оо буцаахад scene урвуу явна.
 *
 * ambientTime нь зөвхөн чимэглэлийн давталтад (гялбаа, урсгалын хөдөлгөөн); ambient унтраалттай үед 0 гэж
 * тооцогдох тул тухайн (stage, progress)-т зурагдах кадр бүр ижил байна.
 */
export type JourneyRuntime = {
  stage: number;
  progress: number;
  /** Хост зөвшөөрсөн эсэх (JourneyVisual3D). Түвшин, reduced-тэй хамт шалгагдана → ambientPhase() */
  ambient: boolean;
  ambientTime: number;
  reduced: boolean;
  tier: QualityTier;
  labelEls: Map<string, HTMLElement>;
  labelText: Map<string, string>;
  /** Canvas mount хийгдсэний дараа R3F-ийн invalidate (demand горимд кадр хүсэх) */
  invalidate: () => void;
};

export type JourneyStats = { fps: number; calls: number; triangles: number; dpr: number; frames: number };

/** Хост (лаб эсвэл production WaterJourney-ийн scroll) энэ driver-аар scene-ийг удирдана */
export type JourneyDriver = {
  rt: JourneyRuntime;
  set: (stage: number, progress: number) => void;
};

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

export function createJourneyDriver(stage = 0, progress = 1): JourneyDriver {
  const rt: JourneyRuntime = {
    stage,
    progress: clamp01(progress),
    ambient: false,
    ambientTime: 0,
    reduced: false,
    tier: "MEDIUM",
    labelEls: new Map(),
    labelText: new Map(),
    invalidate: () => {},
  };
  return {
    rt,
    set(s, p) {
      const np = clamp01(p);
      if (s === rt.stage && np === rt.progress) return;
      rt.stage = s;
      rt.progress = np;
      rt.invalidate();
    },
  };
}

/** Үе шатын харагдах progress: идэвхгүй бол 0; буурсан хөдөлгөөнд бүрэн босгосон (1) */
export const stageProgress = (rt: JourneyRuntime, index: number) => (rt.stage !== index ? 0 : rt.reduced ? 1 : rt.progress);

/** Чимэглэлийн давталтын фаз (сек). Идэвхгүй үед 0 → кадр зөвхөн progress-оос хамаарна. */
export const ambientOn = (rt: JourneyRuntime) => rt.ambient && !rt.reduced && TIERS[rt.tier].ambient;
export const ambientPhase = (rt: JourneyRuntime) => (ambientOn(rt) ? rt.ambientTime : 0);

/** Шошгын текстийг шууд DOM-д бичнэ (өөрчлөгдсөн үед л) */
export function setLabelText(rt: JourneyRuntime, id: string, text: string) {
  if (rt.labelText.get(id) === text) return;
  rt.labelText.set(id, text);
  const el = rt.labelEls.get(id)?.querySelector("[data-text]");
  if (el) el.textContent = text;
}
