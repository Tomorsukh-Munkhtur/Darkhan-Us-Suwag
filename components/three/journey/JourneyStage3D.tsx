"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import dynamic from "next/dynamic";
import { RENDER_PRIORITY, useRenderSlot } from "../renderCoordinator";
import type { JourneyDriver } from "./runtime";
import { TIERS, type QualityTier } from "./quality";
import { hasWebGL2, usePrefersReducedMotion } from "./utils/browser";
import SceneBoundary from "./SceneBoundary";

// three.js + R3F + 6 scene: зөвхөн клиент дээр, хэсэг ойртох үед л ачаалагдана
const JourneyScene3D = dynamic(() => import("./JourneyScene3D"), { ssr: false, loading: () => null });

const MOTION_KEY = "journey3d:motion";

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
};

/**
 * Production WaterJourney-ийн НЭГ хуваалцсан 3D canvas (НЭГ WebGL context). Stage доторх, картын зургийн хэсгийн
 * өндөртэй зурвас; ViewRenderer харагдаж буй карт бүрийн зүүн хэсэгт тухайн үе шатыг зурна.
 * Render зохицуулагчид "journey-3d" (priority 2) нэрээр бүртгүүлнэ → HeroWater ажиллаж байхад хүлээнэ.
 * WebGL2 байхгүй, алдаа, context алдагдвал onReadyChange(false) → картын SVG буцаж харагдана.
 */
export default function JourneyStage3D({ driver, tier, onReadyChange, onFallbackChange, bandRef }: Props) {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [inView, setInView] = useState(false);
  const [armed, setArmed] = useState(false);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [paused, setPaused] = useState(false);
  const reduced = usePrefersReducedMotion();
  const box = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setSupported(hasWebGL2());
    try {
      setPaused(localStorage.getItem(MOTION_KEY) === "paused");
    } catch {}
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
  const allowed = useRenderSlot("journey-3d", RENDER_PRIORITY.journey3d, use3D && inView);
  const ambientAllowed = !!settings?.ambient && !reduced;
  const continuous = ambientAllowed && !paused;
  const live = use3D && ready;

  // Тохиргоог render thread уншдаг runtime-д (scene-ийн төлөв нь views хэвээр)
  useEffect(() => {
    if (!on) return;
    const rt = driver.rt;
    rt.reduced = reduced;
    rt.ambient = !paused;
    rt.tier = tier;
    rt.invalidate();
  }, [driver, on, tier, reduced, paused]);

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
  const toggleMotion = () =>
    setPaused((v) => {
      try {
        localStorage.setItem(MOTION_KEY, v ? "on" : "paused");
      } catch {}
      return !v;
    });

  const label = paused ? "Хөдөлгөөн эхлүүлэх" : "Хөдөлгөөн зогсоох";

  return (
    <>
      <div ref={setBand} aria-hidden className="pointer-events-none absolute inset-x-0 top-0 z-[1]">
        {use3D && settings && (
          <SceneBoundary onError={handleFail}>
            <JourneyScene3D
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
      {/* WCAG 2.2.2: чимэглэлийн давталттай хөдөлгөөнийг зогсоох (scroll-оор босох бүтэц хэвээр) */}
      {live && ambientAllowed && (
        <button
          type="button"
          onClick={toggleMotion}
          aria-pressed={paused}
          aria-label={label}
          title={label}
          className="absolute bottom-[4.5rem] left-4 z-20 flex h-9 w-9 items-center justify-center gap-2 rounded-full border border-abyss/15 bg-foam/70 text-[11px] tracking-wide text-mist backdrop-blur transition-colors hover:border-water hover:text-abyss sm:bottom-8 sm:left-8 sm:w-auto sm:px-3.5"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" aria-hidden>
            {paused ? <path d="M3 1.5v9l7.5-4.5z" /> : <path d="M2.5 1.5h2.5v9H2.5zM7 1.5h2.5v9H7z" />}
          </svg>
          <span className="hidden sm:inline">{label}</span>
        </button>
      )}
    </>
  );
}
