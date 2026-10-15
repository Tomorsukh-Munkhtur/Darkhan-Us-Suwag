import { sewageJourney } from "@/lib/content";
import type { JourneyConfig } from "../journey/runtime";
import type { StageDef, StageLabel } from "../journey/stages";
import { HOMES, HOMES_DEPTH, HOMES_SEWER_Z, JUNCTION, LAB, OUTFALL, PLANT, STATION } from "./layout";

/**
 * Бохир усны аялал (SewageJourney): 5 үе шатын камер, тавцан, DOM шошго. Усны аяллын (journey/stages.ts) бүтэцтэй ижил —
 * НЭГ canvas-ийн систем (JourneyCanvas, ViewRenderer)-ийг дахин ашиглана.
 */
export const SEWAGE_STAGES: StageDef[] = [
  { id: "homes", floorY: -HOMES_DEPTH - 0.02, camera: { azimuth: 20, elevation: 18, bounds: [-2.1, -HOMES_DEPTH, -1.2, 2.1, 1.5, 1.32] } },
  { id: "collector", floorY: -0.62, camera: { azimuth: 22, elevation: 40, bounds: [-2.2, -0.52, -1.4, 2.3, 0.75, 1.4] } },
  { id: "station", floorY: -0.62, camera: { azimuth: 20, elevation: 26, bounds: [-1.9, -0.52, -0.95, 1.9, 1.05, 0.95] } },
  { id: "plant", floorY: -0.62, camera: { azimuth: 12, elevation: 34, bounds: [-2.4, -0.52, -1.0, 2.45, 1.05, 1.0] } },
  { id: "outfall", floorY: -0.62, camera: { azimuth: 18, elevation: 26, bounds: [-2.1, -0.52, -1.3, 2.1, 1.25, 1.3] } },
];

if (process.env.NODE_ENV !== "production") {
  SEWAGE_STAGES.forEach((s, i) => {
    if (sewageJourney[i]?.id !== s.id) console.warn(`[sewage-3d] SEWAGE_STAGES[${i}].id "${s.id}" ≠ sewageJourney[${i}].id "${sewageJourney[i]?.id}"`);
  });
}

const plant = sewageJourney.find((s) => s.id === "plant");
const plantSteps: readonly string[] = plant && "steps" in plant ? plant.steps : [];

export const SEWAGE_LABELS: StageLabel[] = [
  { id: "sw-homes-bld", stage: 0, anchor: [HOMES.buildings[0].x, HOMES.buildings[0].h + 0.12, HOMES.buildings[0].z], text: "Орон сууц" },
  { id: "sw-homes-sewer", stage: 0, anchor: [1.55, HOMES.sewerY + 0.1, HOMES_SEWER_Z], text: "Татуургын шугам", minor: true },

  { id: "sw-junction", stage: 1, anchor: [JUNCTION[0], 0.42, JUNCTION[2]], text: "Хяналтын худаг", minor: true },
  { id: "sw-collector", stage: 1, anchor: [1.95, 0.12, JUNCTION[2]], text: "Гол шугам" },

  { id: "sw-screen", stage: 2, anchor: [STATION.screenX, 0.32, STATION.channel.z], text: "Сараалж" },
  { id: "sw-pump", stage: 2, anchor: [STATION.pumps.x, 0.62, 0], text: "Насос", minor: true },

  // 7 үе шат: дугаар (өргөн үед нэр), өндөр нь ээлжилнэ — хөрш шошго давхцахгүй
  ...plantSteps.map(
    (name, i): StageLabel => ({
      id: `sw-plant-${i}`,
      stage: 3,
      anchor: [PLANT[i].x, PLANT[i].top + (i % 2 ? 0.5 : 0.18), 0],
      index: String(i + 1),
      text: name,
      variant: "step",
    }),
  ),

  { id: "sw-outfall-pct", stage: 4, anchor: [-1.25, 1.0, OUTFALL.z], text: "98%", caption: "Цэвэршилт", variant: "metric" },
  { id: "sw-outfall-std", stage: 4, anchor: [LAB.x, 0.5, LAB.z], text: "MNS 4943:2015", minor: true },
];

// Аялал зүүн тийш явна (SewageJourney.tsx) — диорамын урсгал ч баруунаас зүүн тийш
export const SEWAGE_JOURNEY: JourneyConfig = { stages: SEWAGE_STAGES, labels: SEWAGE_LABELS, mirror: true };
