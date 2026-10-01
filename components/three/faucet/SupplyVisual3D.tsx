"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SupplyArt } from "@/components/sections/services/Illustrations";
import { useCardRenderSlot } from "../useCardRenderSlot";
import { detectTier, readTierSignals, TIERS, type QualityTier } from "../journey/quality";
import { hasWebGL2, usePrefersReducedMotion } from "../journey/utils/browser";
import SceneBoundary from "../journey/SceneBoundary";
import { createFaucetRuntime } from "./runtime";

gsap.registerPlugin(ScrollTrigger);

// three.js + R3F (Hero-той хуваалцсан chunk) + цоргоны scene: мөр ойртох үед л ачаалагдана
const FaucetScene3D = dynamic(() => import("./FaucetScene3D"), { ssr: false, loading: () => null });

/** ?faucet3d=off|low|medium|high — QA ба статик (SVG) горим */
function faucetMode(): QualityTier | "off" {
  const q = new URLSearchParams(window.location.search).get("faucet3d");
  if (q === "off") return "off";
  if (q === "high" || q === "medium" || q === "low") return q.toUpperCase() as QualityTier;
  return detectTier(readTierSignals());
}

/**
 * "01 Ус хангамж" картын зураг: цорго → шилэн аяга 3D (SupplyArt-ын оронд, ижил className).
 * Усны түвшин нь мөрийн scroll-оор (progress 0 → 1, scrub — tween-гүй): буцааж гүйлгэхэд урвуу.
 * Хуучин SVG нь зөвхөн fallback: 3D эхний кадраа зуртал, WebGL2 байхгүй, алдаа, context алдагдах, ?faucet3d=off.
 */
export default function SupplyVisual3D({ className = "" }: { className?: string }) {
  const root = useRef<HTMLDivElement>(null);
  const [rt] = useState(createFaucetRuntime);
  const [mode, setMode] = useState<QualityTier | "off" | null>(null);
  const [supported, setSupported] = useState(false);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    const m = faucetMode();
    if (m !== "off") rt.tier = m;
    setMode(m);
    setSupported(hasWebGL2());

    // progress: мөр дэлгэцийн доод 80%-д орж ирэхээс дээд 30% хүртэл гарах хооронд (scrub, цаг ашиглахгүй)
    const trigger = root.current!.closest(".svc-row") ?? root.current!;
    const onProgress = (self: ScrollTrigger) => {
      rt.progress = self.progress;
      rt.invalidate();
    };
    const st = ScrollTrigger.create({ trigger, start: "top 80%", end: "bottom 30%", onUpdate: onProgress, onRefresh: onProgress });
    return () => st.kill();
  }, [rt]);

  const tier = mode && mode !== "off" ? mode : null;
  const settings = tier ? TIERS[tier] : null;
  // ойртоход ачаална, progress-оор (demand) зурна; тасралтгүй ambient нь зохицуулагчийн зөвшөөрөлтэй үед л
  const { armed, near, allowed } = useCardRenderSlot("supply-faucet", root, !!tier && supported && !failed);
  const use3D = !!tier && supported && armed && !failed;
  const continuous = allowed && !!settings?.ambient && !reduced;
  const live = use3D && ready;

  useEffect(() => {
    rt.reduced = reduced;
    rt.ambient = true;
    rt.invalidate();
  }, [rt, reduced]);

  const handleReady = useCallback(() => setReady(true), []);
  const handleFail = useCallback(() => {
    setFailed(true);
    setReady(false);
  }, []);

  return (
    <div ref={root} className={`relative overflow-hidden ${className}`}>
      <SupplyArt
        className={`absolute inset-0 h-full w-full transition-opacity duration-500 ${live ? "invisible opacity-0" : "opacity-100"}`}
      />
      {use3D && tier && (
        <div aria-hidden className={`absolute inset-0 transition-opacity duration-500 ${live ? "opacity-100" : "opacity-0"}`}>
          <SceneBoundary onError={handleFail}>
            <FaucetScene3D key={tier} rt={rt} tier={tier} running={near} continuous={continuous} onReady={handleReady} onFail={handleFail} />
          </SceneBoundary>
        </div>
      )}
    </div>
  );
}
