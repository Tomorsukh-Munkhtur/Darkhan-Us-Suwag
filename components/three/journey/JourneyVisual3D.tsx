"use client";

import { memo, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { RENDER_PRIORITY, useRenderSlot } from "../renderCoordinator";
import type { JourneyDriver, JourneyStats } from "./runtime";
import { detectTier, readTierSignals, TIERS, type QualityTier } from "./quality";
import { hasWebGL2, usePrefersReducedMotion } from "./utils/browser";
import SceneBoundary from "./SceneBoundary";

// three.js + R3F нь зөвхөн клиент дээр, хэрэгтэй үед л ачаалагдана
const JourneyScene3D = dynamic(() => import("./JourneyScene3D"), { ssr: false, loading: () => null });

/** Fallback-тай (нэг картын) горимд canvas бэлэн болох хүртэлх дэвсгэр (Backdrop shader-тэй ижил) */
const BACKDROP = "linear-gradient(180deg, #0f3a5e 0%, #07213a 100%)";

type Props = {
  /** Хост stage/progress-ийг үүгээр бичнэ (createJourneyDriver) */
  driver: JourneyDriver;
  /**
   * Нэг картын горимд: WebGL байхгүй, алдаа гарсан эсвэл 3D бэлэн болох хүртэл харагдах SVG.
   * Production-ий давхарга (overlay) горимд өгөхгүй — картын slot доторх SVG өөрөө fallback болно.
   */
  fallback?: ReactNode;
  /** Системийн prefers-reduced-motion-ыг дарж тохируулах (лаб) */
  reducedMotion?: boolean;
  /** Чимэглэлийн давталттай хөдөлгөөн (default: асаалттай; LOW түвшин, reduced үед үргэлж унтарна) */
  ambient?: boolean;
  /** "auto" — төхөөрөмжөөс тодорхойлно */
  tier?: QualityTier | "auto";
  /** true — render loop зогсоно */
  paused?: boolean;
  onStats?: (s: JourneyStats) => void;
  onTier?: (t: QualityTier) => void;
  className?: string;
};

/**
 * Progressive enhancement: эхлээд fallback (SSR-д ч харагдана), дэлгэцэнд ойртмогц 3D-г ачаалж,
 * эхний кадр бэлэн болоход уусгаж солино. WebGL2 байхгүй, context алдагдсан эсвэл алдаа гарвал 3D алга болно.
 * Render зохицуулагчид "journey-3d" нэрээр бүртгүүлнэ → HeroWater ажиллаж байхад хүлээнэ.
 */
function JourneyVisual3D({
  driver,
  fallback,
  reducedMotion,
  ambient = true,
  tier: tierProp = "auto",
  paused = false,
  onStats,
  onTier,
  className = "",
}: Props) {
  const box = useRef<HTMLDivElement>(null);
  const [supported, setSupported] = useState<boolean | null>(null);
  const [autoTier, setAutoTier] = useState<QualityTier>("MEDIUM");
  const [armed, setArmed] = useState(false);
  const [inView, setInView] = useState(false);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [covered, setCovered] = useState(false);
  const prefersReduced = usePrefersReducedMotion();
  const reduced = reducedMotion ?? prefersReduced;
  const tier = tierProp === "auto" ? autoTier : tierProp;
  const settings = TIERS[tier];
  const continuous = ambient && settings.ambient && !reduced;

  useEffect(() => {
    setSupported(hasWebGL2());
    setAutoTier(detectTier(readTierSignals()));
    const io = new IntersectionObserver(
      ([e]) => {
        setInView(e.isIntersecting);
        if (e.isIntersecting) setArmed(true);
      },
      { rootMargin: "200px" },
    );
    io.observe(box.current!);
    return () => io.disconnect();
  }, []);

  // Тохиргоог render thread уншдаг runtime-д хийнэ (scene-ийн төлөв нь stage/progress хэвээр)
  useEffect(() => {
    const rt = driver.rt;
    rt.reduced = reduced;
    rt.ambient = ambient;
    rt.tier = tier;
    rt.invalidate();
  }, [driver, reduced, ambient, tier]);

  useEffect(() => {
    onTier?.(tier);
  }, [tier, onTier]);

  const handleReady = useCallback(() => setReady(true), []);
  const handleFail = useCallback(() => setFailed(true), []);

  const use3D = supported === true && armed && !failed;
  const allowed = useRenderSlot("journey-3d", RENDER_PRIORITY.journey3d, use3D && inView && !paused);
  const showFallback = fallback !== undefined && (!use3D || !covered);

  return (
    <div
      ref={box}
      className={`relative h-full w-full overflow-hidden ${className}`}
      style={fallback !== undefined ? { background: BACKDROP } : undefined}
    >
      {showFallback && (
        <div className="absolute inset-0 [&>svg]:absolute [&>svg]:inset-0 [&>svg]:h-full [&>svg]:w-full">{fallback}</div>
      )}
      {use3D && (
        <div
          className={`absolute inset-0 transition-opacity duration-700 ${ready ? "opacity-100" : "opacity-0"}`}
          onTransitionEnd={(e) => {
            if (e.target === e.currentTarget && ready) setCovered(true);
          }}
        >
          <SceneBoundary onError={handleFail}>
            <JourneyScene3D
              driver={driver}
              running={allowed}
              continuous={continuous}
              dpr={settings.dpr}
              antialias={settings.antialias}
              onReady={handleReady}
              onFail={handleFail}
              onStats={onStats}
            />
          </SceneBoundary>
        </div>
      )}
    </div>
  );
}

export default memo(JourneyVisual3D);
