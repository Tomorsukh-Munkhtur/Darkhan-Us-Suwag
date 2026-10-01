import { useEffect, useState, type RefObject } from "react";
import { RENDER_PRIORITY, useRenderSlot } from "./renderCoordinator";

const THRESHOLDS = Array.from({ length: 11 }, (_, i) => i / 10);

/**
 * Services картын жижиг canvas-ууд (цорго, татуурга …) хоёулаа дэлгэцэнд зэрэг харагдаж болно.
 * - armed/near: карт 250px ойртоход scene ачаалж, progress өөрчлөгдөхөд (demand) кадр зурна —
 *   карт орж ирэхэд 3D аль хэдийн бэлэн (SVG → 3D солигдох анивчилтгүй).
 * - allowed: тасралтгүй (ambient) loop-ын зөвшөөрөл — зохицуулагчаар НЭГ л canvas-т. Priority нь
 *   харагдаж буй хувиар (2.5 → 2.9, Hero-оос доогуур): илүү харагдаж буй карт ambient-аа авна.
 */
export function useCardRenderSlot(id: string, ref: RefObject<HTMLElement | null>, enabled: boolean) {
  const [armed, setArmed] = useState(false);
  const [near, setNear] = useState(false);
  const [ratio, setRatio] = useState(0);

  useEffect(() => {
    const el = ref.current!;
    const nearIO = new IntersectionObserver(
      ([e]) => {
        setNear(e.isIntersecting);
        if (e.isIntersecting) setArmed(true);
      },
      { rootMargin: "250px 0px" },
    );
    const visIO = new IntersectionObserver(
      ([e]) => setRatio(e.isIntersecting ? Math.max(0.05, Math.round(e.intersectionRatio * 10) / 10) : 0),
      { threshold: THRESHOLDS },
    );
    nearIO.observe(el);
    visIO.observe(el);
    return () => {
      nearIO.disconnect();
      visIO.disconnect();
    };
  }, [ref]);

  const allowed = useRenderSlot(id, RENDER_PRIORITY.serviceCard + ratio * 0.4, enabled && armed && ratio > 0);
  return { armed, near, allowed };
}
