import { journey } from "@/lib/content";

export type Vec3 = readonly [number, number, number];

/**
 * Камер: хүрээний (bounds) төвийг тойрох азимут (°, +z-ээс +x рүү), өндрийн өнцөг (°).
 * Зай нь bounds-ийн 8 оройг фрэймд багтаахаар тооцогдоно — карт квадрат ч, утасны нарийн зурвас ч тасрахгүй.
 * bounds: [minX, minY, minZ, maxX, maxY, maxZ] — DOM шошгыг багтаах өндрийг оруулна.
 */
export type CameraPreset = { azimuth: number; elevation: number; bounds: readonly [number, number, number, number, number, number] };

export type StageDef = {
  /** lib/content.ts-ийн journey[i].id-тэй таарна */
  id: string;
  camera: CameraPreset;
  /** Диорамын доорх тавцангийн өндөр (хавтангийн ёроолоос бага зэрэг доор) */
  floorY: number;
};

export const STAGES: StageDef[] = [
  { id: "source", floorY: -1.28, camera: { azimuth: 20, elevation: 21, bounds: [-2.2, -1.18, -1.4, 2.2, 1.25, 1.4] } },
  { id: "extraction", floorY: -1.28, camera: { azimuth: 24, elevation: 16, bounds: [-1.8, -1.18, -1.1, 2.1, 0.85, 1.4] } },
  { id: "treatment", floorY: -0.62, camera: { azimuth: 12, elevation: 25, bounds: [-2.1, -0.52, -1.2, 2.1, 1.35, 1.2] } },
  { id: "reservoir", floorY: -0.62, camera: { azimuth: 24, elevation: 20, bounds: [-1.6, -0.52, -1.3, 1.6, 2.3, 1.3] } },
  { id: "network", floorY: -0.62, camera: { azimuth: 28, elevation: 44, bounds: [-2.2, -0.52, -1.7, 2.2, 1.3, 1.7] } },
  { id: "home", floorY: -0.62, camera: { azimuth: -24, elevation: 20, bounds: [-1.9, -0.52, -1.4, 1.9, 1.7, 1.4] } },
];

if (process.env.NODE_ENV !== "production") {
  STAGES.forEach((s, i) => {
    if (journey[i]?.id !== s.id) console.warn(`[journey-3d] STAGES[${i}].id "${s.id}" ≠ journey[${i}].id "${journey[i]?.id}"`);
  });
}

/**
 * DOM шошго: 3D цэг (anchor) дээр байрлана. variant:
 * tag — жижиг хаяг; metric — том тоо + тайлбар; step — дугаар (+ өргөн үед нэр).
 * minor — нарийн (≤ 360px) контейнерт нуугдана.
 */
export type StageLabel = {
  id: string;
  stage: number;
  anchor: Vec3;
  text: string;
  caption?: string;
  index?: string;
  variant?: "tag" | "metric" | "step";
  minor?: boolean;
};

const treatmentSteps = journey[2]?.facts ?? [];

export const LABELS: StageLabel[] = [
  { id: "source-zone", stage: 0, anchor: [0.95, 0.5, 0.15], text: "Хамгаалалтын бүс" },
  { id: "source-aquifer", stage: 0, anchor: [-1.45, -0.53, 1.4], text: "Гүний уст үе", minor: true },
  { id: "source-river", stage: 0, anchor: [-1.35, 0.12, 0.52], text: "Хараа гол", minor: true },

  { id: "pump-house", stage: 1, anchor: [-0.3, 0.78, 0.78], text: "Насос" },
  { id: "pump-aquifer", stage: 1, anchor: [-1.25, -0.75, 1.1], text: "Гүний ус", minor: true },
  { id: "pump-line", stage: 1, anchor: [1.45, 0.48, 0.78], text: "Цуглуулах шугам", minor: true },

  ...treatmentSteps.map(
    (f, i): StageLabel => ({
      id: `treatment-${i}`,
      stage: 2,
      anchor: [-1.36 + i * 0.68, i % 2 ? 1.32 : 1.04, 0],
      index: f.k,
      text: f.v,
      variant: "step",
    }),
  ),

  { id: "reservoir-level", stage: 3, anchor: [-0.2, 2.2, 0], text: "86%", caption: "Нөөц", variant: "metric" },

  { id: "network-source", stage: 4, anchor: [-1.95, 0.62, -1.05], text: "Эх үүсвэр" },
  { id: "network-city", stage: 4, anchor: [1.1, 1.25, -0.95], text: "Дархан хот", minor: true },

  { id: "home-house", stage: 5, anchor: [-0.4, 1.62, -0.2], text: "Таны гэр" },
];
