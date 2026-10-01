"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { RENDER_PRIORITY, useRenderSlot } from "../renderCoordinator";
import { detectTier, readTierSignals, TIERS, type QualityTier } from "../journey/quality";
import { hasWebGL2, usePrefersReducedMotion } from "../journey/utils/browser";
import SceneBoundary from "../journey/SceneBoundary";
import type { CityRuntime } from "./runtime";

// three.js + R3F (Hero-той хуваалцсан chunk) + хотын scene: хэсэг ойртох үед л ачаалагдана
const CityScene3D = dynamic(() => import("./CityScene3D"), { ssr: false, loading: () => null });

/**
 * ?map3d=off|low|medium|high — QA ба статик (SVG) горим. Хадгалах горим (Save-Data) эсвэл маш бага санах ойтой
 * (≤ 2 GB) төхөөрөмж дээр бүтэн дэлгэцийн 3D хотын оронд SVG газрын зураг үлдэнэ.
 */
function mapMode(): QualityTier | "off" {
  const q = new URLSearchParams(window.location.search).get("map3d");
  if (q === "off") return "off";
  if (q === "high" || q === "medium" || q === "low") return q.toUpperCase() as QualityTier;
  const s = readTierSignals();
  if (s.saveData || (s.memory !== undefined && s.memory <= 2)) return "off";
  return detectTier(s);
}

type Props = {
  rt: CityRuntime;
  /** 3D эхний кадраа зурсан (true) / алдаа, context алдагдсан (false) — CityMap SVG давхаргаа нуух/харуулах */
  onLive: (live: boolean) => void;
  /** true — 3D ажиллах боломжгүй (off, WebGL2 байхгүй, алдаа) → хуучин SVG мап харагдана; ачаалж байхад false */
  onFallback?: (fallback: boolean) => void;
  outage: { x: number; y: number; area: string } | null;
};

/**
 * CityMap-ийн газрын зургийн 3D давхарга (бүтэн дэлгэц, UI-ийн ард). Pin ScrollTrigger progress-ийг rt-ээр уншина.
 * SVG газрын зураг (CSS камертай) нь fallback: 3D бэлэн болтол, WebGL2 байхгүй, алдаа, context алдагдах, ?map3d=off.
 */
export default function CityMap3D({ rt, onLive, onFallback, outage }: Props) {
  const root = useRef<HTMLDivElement>(null);
  const labels = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<QualityTier | "off" | null>(null);
  const [supported, setSupported] = useState(false);
  const [armed, setArmed] = useState(false);
  const [near, setNear] = useState(false);
  const [visible, setVisible] = useState(false);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    const m = mapMode();
    if (m !== "off") rt.tier = m;
    setMode(m);
    setSupported(hasWebGL2());
    const el = root.current!;
    // scene-ийн geometry (мод, барилга) үүсгэлтийг хэсэг ирэхээс өмнө хийнэ
    const nearIO = new IntersectionObserver(
      ([e]) => {
        setNear(e.isIntersecting);
        if (e.isIntersecting) setArmed(true);
      },
      { rootMargin: "900px 0px" },
    );
    const visIO = new IntersectionObserver(([e]) => setVisible(e.isIntersecting));
    nearIO.observe(el);
    visIO.observe(el);
    return () => {
      nearIO.disconnect();
      visIO.disconnect();
    };
  }, [rt]);

  const tier = mode && mode !== "off" ? mode : null;
  const use3D = !!tier && supported && armed && !failed;
  const allowed = useRenderSlot("city-map", RENDER_PRIORITY.cityMap, use3D && visible);
  const continuous = allowed && !!tier && TIERS[tier].ambient && !reduced;
  const live = use3D && ready;

  useEffect(() => {
    rt.reduced = reduced;
    rt.invalidate();
  }, [rt, reduced]);
  useEffect(() => {
    onLive(live);
  }, [live, onLive]);

  // mode тодорхойлогдох хүртэл (null) fallback биш — ачаалж байх хооронд хуучин мап хальт харагдахгүй
  const fallback = mode !== null && (mode === "off" || !supported || failed);
  useEffect(() => {
    onFallback?.(fallback);
  }, [fallback, onFallback]);

  const handleReady = useCallback(() => setReady(true), []);
  const handleFail = useCallback(() => {
    setFailed(true);
    setReady(false);
  }, []);

  return (
    <div ref={root} aria-hidden className={`pointer-events-none absolute inset-0 transition-opacity duration-700 ${live ? "opacity-100" : "opacity-0"}`}>
      {use3D && tier && (
        <SceneBoundary onError={handleFail}>
          <CityScene3D
            key={tier}
            rt={rt}
            tier={tier}
            running={near}
            continuous={continuous}
            labels={labels}
            outage={outage}
            onReady={handleReady}
            onFail={handleFail}
          />
        </SceneBoundary>
      )}
      <div ref={labels} className="absolute inset-0 overflow-hidden" />
    </div>
  );
}
