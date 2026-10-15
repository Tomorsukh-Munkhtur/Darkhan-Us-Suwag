"use client";

import { useCallback, useEffect, useRef, useState, type ComponentType, type RefObject } from "react";
import dynamic from "next/dynamic";
import { RENDER_PRIORITY, useRenderSlot } from "../renderCoordinator";
import type { JourneyDriver } from "./runtime";
import { TIERS, type QualityTier } from "./quality";
import { hasWebGL2, usePrefersReducedMotion } from "./utils/browser";
import SceneBoundary from "./SceneBoundary";
import type { JourneyScene3DProps } from "./JourneyCanvas";

// three.js + R3F + 6 scene: зөвхөн клиент дээр, хэсэг ойртох үед л ачаалагдана
const JourneyScene3D = dynamic(() => import("./JourneyScene3D"), { ssr: false, loading: () => null });

type Props = {
  driver: JourneyDriver;
  /** WaterJourney тодорхойлсон түвшин. "off" — статик (SVG) горим, null — хараахан тодорхойгүй */
  tier: QualityTier | "off" | null;
  /** true — 3D эхний кадраа зурсан (SVG-г нууж болно); false — fallback (SVG) харагдах ёстой */
  onReadyChange: (ready: boolean) => void;
  /** true — 3D ажиллах боломжгүй (off, WebGL2 байхгүй, алдаа) → хуучин SVG харагдана; ачаалж байхад false */
  onFallbackChange?: (fallback: boolean) => void;
  /** Canvas зурвас: байрлал, өндрийг WaterJourney.measure() тохируулна */
  bandRef: RefObject<HTMLDivElement | null>;
  /** Үе шатуудын scene-тэй canvas (dynamic import). Анхдагч — Усны аялал */
  Scene3D?: ComponentType<JourneyScene3DProps>;
  /** Render зохицуулагчийн нэр (хуудсанд хэд хэдэн аялал байвал давтагдахгүй) */
  slotId?: string;
};

/**
 * Production WaterJourney-ийн НЭГ хуваалцсан 3D canvas (НЭГ WebGL context). Stage доторх, картын зургийн хэсгийн
 * өндөртэй зурвас; ViewRenderer харагдаж буй карт бүрийн зүүн хэсэгт тухайн үе шатыг зурна.
 * Render зохицуулагчид "journey-3d" (priority 2) нэрээр бүртгүүлнэ → HeroWater ажиллаж байхад хүлээнэ.
 * WebGL2 байхгүй, алдаа, context алдагдвал onReadyChange(false) → картын SVG буцаж харагдана.
 * Чимэглэлийн хөдөлгөөн (урсгал, гялбаа) үргэлж ажиллана — зогсоох товчгүй (зөвхөн түвшин, reduced motion хязгаарлана).
 */
export default function JourneyStage3D({
  driver,
  tier,
  onReadyChange,
  onFallbackChange,
  bandRef,
  Scene3D = JourneyScene3D,
  slotId = "journey-3d",
}: Props) {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [inView, setInView] = useState(false);
  const [armed, setArmed] = useState(false);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const reduced = usePrefersReducedMotion();
  const box = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setSupported(hasWebGL2());
    const io = new IntersectionObserver(
      ([e]) => {
        setInView(e.isIntersecting);
        if (e.isIntersecting) setArmed(true);
      },
      { rootMargin: "300px 0px" },
    );
    io.observe(box.current!);
    return () => io.disconnect();
  }, []);

  const on = tier !== null && tier !== "off";
  const settings = on ? TIERS[tier] : null;
  const use3D = on && supported === true && armed && !failed;
  const allowed = useRenderSlot(slotId, RENDER_PRIORITY.journey3d, use3D && inView);
  const continuous = !!settings?.ambient && !reduced;
  const live = use3D && ready;

  // Тохиргоог render thread уншдаг runtime-д (scene-ийн төлөв нь views хэвээр)
  useEffect(() => {
    if (!on) return;
    const rt = driver.rt;
    rt.reduced = reduced;
    rt.ambient = true;
    rt.tier = tier;
    rt.invalidate();
  }, [driver, on, tier, reduced]);

  useEffect(() => {
    onReadyChange(live);
  }, [live, onReadyChange]);

  // тодорхойгүй (null) үед fallback биш — ачаалж байх хооронд хуучин зураг хальт харагдахгүй
  const fallback = tier === "off" || supported === false || failed;
  useEffect(() => {
    onFallbackChange?.(fallback);
  }, [fallback, onFallbackChange]);

  const setBand = useCallback(
    (el: HTMLDivElement | null) => {
      box.current = el;
      bandRef.current = el;
    },
    [bandRef],
  );
  const handleReady = useCallback(() => setReady(true), []);
  const handleFail = useCallback(() => {
    setFailed(true);
    setReady(false);
  }, []);

  return (
    <div ref={setBand} aria-hidden className="pointer-events-none absolute inset-x-0 top-0 z-[1]">
      {use3D && settings && (
        <SceneBoundary onError={handleFail}>
          <Scene3D
            driver={driver}
            running={allowed}
            continuous={continuous}
            dpr={settings.dpr}
            antialias={settings.antialias}
            onReady={handleReady}
            onFail={handleFail}
          />
        </SceneBoundary>
      )}
    </div>
  );
}
