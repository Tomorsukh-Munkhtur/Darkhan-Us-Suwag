import type * as THREE from "three";
import { TIERS, type QualityTier } from "./quality";

/**
 * Нэг canvas доторх нэг "цонх" (view): тухайн картын зургийн хэсэгт тухайн үе шатыг өөрийн progress-оор зурна.
 * Production-д харагдаж буй карт бүр нэг view авна (идэвхтэй + цухуйж буй хөрш) — бүгд НЭГ WebGL context.
 */
export type JourneyView = {
  stage: number;
  /** 0–1: харагдах бүх төлөв үүнээс тооцогдоно */
  progress: number;
  /** Canvas доторх байрлал (CSS px). null — бүтэн canvas (лаб, нэг картын горим) */
  rect: { x: number; y: number; w: number; h: number } | null;
  /** Картын CSS opacity-г дуурайна (хөрш картууд бүдэг). Шошго ч дагана. */
  opacity: number;
  /** Картын бөөрөнхий булангийн радиус (CSS px) ба аль булан: [зүүн-дээд, баруун-дээд, баруун-доод, зүүн-доод] */
  radius: number;
  corners: readonly [boolean, boolean, boolean, boolean];
};

/**
 * Canvas доторх бүх хэсгийн хуваалцдаг төлөв. React-ийн гадна хувьсана → scroll бүрт re-render хийхгүй.
 *
 * Үнэний эх сурвалж нь views (үе шат + progress). Харагдах бүх төлөв (босгосон хэсэг, усны түвшин, гэрэл,
 * урсгалын байрлал, камер) эдгээрээс тооцогдоно → progress-оо буцаахад scene урвуу явна.
 *
 * ambientTime нь зөвхөн чимэглэлийн давталтад (гялбаа, урсгалын хөдөлгөөн); ambient унтраалттай үед 0 гэж
 * тооцогдох тул тухайн progress-т зурагдах кадр бүр ижил байна.
 */
export type JourneyRuntime = {
  views: JourneyView[];
  /** Хост зөвшөөрсөн эсэх (хэрэглэгчийн "хөдөлгөөн зогсоох"). Түвшин, reduced-тэй хамт → ambientOn() */
  ambient: boolean;
  ambientTime: number;
  reduced: boolean;
  tier: QualityTier;
  labelEls: Map<string, HTMLElement>;
  labelText: Map<string, string>;
  /** Үе шат бүрийн үндэс group (RevealRoot бүртгүүлнэ) — view бүрт зөвхөн өөрийнх нь харагдана */
  roots: (THREE.Object3D | null)[];
  /** Тавцан (StageFloor бүртгүүлнэ) — view бүрт өндрийг нь тохируулна */
  floor: THREE.Object3D | null;
  /** Canvas mount хийгдсэний дараа R3F-ийн invalidate (demand горимд кадр хүсэх) */
  invalidate: () => void;
};

export type JourneyStats = { fps: number; calls: number; triangles: number; dpr: number; frames: number };

/** Хост (лаб эсвэл production WaterJourney-ийн scroll) энэ driver-аар canvas-ийг удирдана */
export type JourneyDriver = {
  rt: JourneyRuntime;
  /** Нэг үе шатыг бүтэн canvas-д (лаб, нэг картын горим) */
  set: (stage: number, progress: number) => void;
  /** Олон view (production: харагдаж буй карт бүр) */
  setViews: (views: JourneyView[]) => void;
};

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const NO_CORNERS = [false, false, false, false] as const;

/** stage өгвөл нэг бүтэн-canvas view-тэй (лаб); өгөхгүй бол view-гүй — хост setViews() дуудна (production) */
export function createJourneyDriver(stage?: number, progress = 1): JourneyDriver {
  const rt: JourneyRuntime = {
    views: [],
    ambient: false,
    ambientTime: 0,
    reduced: false,
    tier: "MEDIUM",
    labelEls: new Map(),
    labelText: new Map(),
    roots: [],
    floor: null,
    invalidate: () => {},
  };
  const set = (s: number, p: number) => {
    const np = clamp01(p);
    const v = rt.views[0];
    if (rt.views.length === 1 && v.rect === null && v.stage === s && v.progress === np) return;
    rt.views = [{ stage: s, progress: np, rect: null, opacity: 1, radius: 0, corners: NO_CORNERS }];
    rt.invalidate();
  };
  if (stage !== undefined) set(stage, progress);
  return {
    rt,
    set,
    setViews(views) {
      rt.views = views;
      rt.invalidate();
    },
  };
}

/** Үе шатын харагдах progress: ямар ч view-д байхгүй бол 0; буурсан хөдөлгөөнд бүрэн босгосон (1) */
export function stageProgress(rt: JourneyRuntime, index: number) {
  for (const v of rt.views) if (v.stage === index) return rt.reduced ? 1 : clamp01(v.progress);
  return 0;
}

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
