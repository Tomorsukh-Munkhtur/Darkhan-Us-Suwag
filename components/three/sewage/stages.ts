import { sewageJourney } from "@/lib/content";
import type { JourneyConfig } from "../journey/runtime";
import type { StageDef } from "../journey/stages";
import { HOMES_DEPTH } from "./layout";

/**
 * Бохир усны аялал (SewageJourney): 5 үе шатын камер, тавцан (3D дээр шошгогүй — тайлбар нь картын текстэд). Усны аяллын (journey/stages.ts) бүтэцтэй ижил —
 * НЭГ canvas-ийн систем (JourneyCanvas, ViewRenderer)-ийг дахин ашиглана.
 */
export const SEWAGE_STAGES: StageDef[] = [
  { id: "homes", floorY: -HOMES_DEPTH - 0.02, camera: { azimuth: 20, elevation: 18, bounds: [-2.1, -HOMES_DEPTH, -1.2, 2.1, 1.3, 1.32] } },
  { id: "collector", floorY: -0.62, camera: { azimuth: 22, elevation: 40, bounds: [-2.2, -0.52, -1.4, 2.3, 0.75, 1.4] } },
  { id: "station", floorY: -0.62, camera: { azimuth: 20, elevation: 26, bounds: [-1.9, -0.52, -0.95, 1.9, 0.8, 0.95] } },
  { id: "plant", floorY: -0.62, camera: { azimuth: 12, elevation: 34, bounds: [-2.4, -0.52, -1.0, 2.45, 0.6, 1.0] } },
  { id: "outfall", floorY: -0.62, camera: { azimuth: 18, elevation: 26, bounds: [-2.1, -0.52, -1.3, 2.1, 0.65, 1.3] } },
];

if (process.env.NODE_ENV !== "production") {
  SEWAGE_STAGES.forEach((s, i) => {
    if (sewageJourney[i]?.id !== s.id) console.warn(`[sewage-3d] SEWAGE_STAGES[${i}].id "${s.id}" ≠ sewageJourney[${i}].id "${sewageJourney[i]?.id}"`);
  });
}

// Аялал зүүн тийш явна (SewageJourney.tsx) — диорамын урсгал ч баруунаас зүүн тийш
export const SEWAGE_JOURNEY: JourneyConfig = { stages: SEWAGE_STAGES, labels: [], mirror: true };
