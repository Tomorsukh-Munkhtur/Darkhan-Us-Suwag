import { useEffect, useSyncExternalStore } from "react";

/**
 * WebGL render зохицуулагч: нэг зэрэг зөвхөн НЭГ canvas render loop ажиллана.
 * Canvas бүр "render хийх хүсэлтэй" эсэхээ (ихэвчлэн дэлгэцэнд харагдаж байгаа эсэх) бүртгүүлнэ;
 * хүсэлтэй нарын хамгийн өндөр priority-тэй нь зөвшөөрөл авч, бусад нь зогсоно (frameloop="never").
 * Зогссон canvas сүүлийн кадраа харуулсаар байна (WaterSurface хөлдсөн дэвсгэр болно).
 *
 * Санал болгох priority: HeroWater (3) > Services-ийн картууд (2.5–2.9, харагдах хувиар; useCardRenderSlot)
 * > Journey 3D (2) > WaterSurface (1). (Картын мөр гарч ирэхэд Journey хэсэг дэлгэцээс гарч байгаа тул карт давуу.)
 * → Hero шумбалтын үед Journey 3D хүлээнэ; Journey 3D ажиллаж байхад WaterSurface зогсоно.
 */
export const RENDER_PRIORITY = { heroWater: 3, serviceCard: 2.5, journey3d: 2, waterSurface: 1 } as const;

type Entry = { id: string; priority: number; wants: boolean };
export type RenderSlotState = { id: string; priority: number; wants: boolean; allowed: boolean };

const entries = new Map<string, Entry>();
const listeners = new Set<() => void>();
let allowed: ReadonlyMap<string, boolean> = new Map();
let snapshot: readonly RenderSlotState[] = [];

function recompute() {
  let top: Entry | null = null;
  for (const e of entries.values()) if (e.wants && (!top || e.priority > top.priority)) top = e;
  const next = new Map<string, boolean>();
  for (const e of entries.values()) next.set(e.id, e === top);
  allowed = next;
  snapshot = [...entries.values()]
    .sort((a, b) => b.priority - a.priority)
    .map((e) => ({ ...e, allowed: e === top }));
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

/** Canvas-ийн host: render хийж болох эсэх. wants=false үед бүртгэл хэвээр (статус харагдана), зөвшөөрөлгүй. */
export function useRenderSlot(id: string, priority: number, wants: boolean) {
  useEffect(() => {
    entries.set(id, { id, priority, wants });
    recompute();
  }, [id, priority, wants]);
  useEffect(
    () => () => {
      entries.delete(id);
      recompute();
    },
    [id],
  );
  return useSyncExternalStore(
    subscribe,
    () => allowed.get(id) ?? false,
    () => false,
  );
}

/** Бүх бүртгэлийн төлөв (лабын оношилгоонд) */
export function useRenderSlots() {
  return useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => snapshot,
  );
}
