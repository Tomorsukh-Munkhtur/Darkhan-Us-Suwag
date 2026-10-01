"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SewerArt } from "@/components/sections/services/Illustrations";
import { useCardRenderSlot } from "../useCardRenderSlot";
import { detectTier, readTierSignals, TIERS, type QualityTier } from "../journey/quality";
import { hasWebGL2, usePrefersReducedMotion } from "../journey/utils/browser";
import SceneBoundary from "../journey/SceneBoundary";
import { createSewerRuntime } from "./runtime";

gsap.registerPlugin(ScrollTrigger);

// three.js + R3F (Hero-той хуваалцсан chunk) + огтлолын scene: карт ойртох үед л ачаалагдана
const SewerScene3D = dynamic(() => import("./SewerScene3D"), { ssr: false, loading: () => null });

/** ?sewer3d=off|low|medium|high — QA ба статик (SVG) горим */
function sewerMode(): QualityTier | "off" {
  const q = new URLSearchParams(window.location.search).get("sewer3d");
  if (q === "off") return "off";
  if (q === "high" || q === "medium" || q === "low") return q.toUpperCase() as QualityTier;
  return detectTier(readTierSignals());
}

/**
 * "02 Ариутгах татуурга" картын зураг: газар доорх шугам сүлжээний 3D огтлол (SewerArt-ын оронд, ижил className).
 * Progress (0 → 1) нь картын scroll-оор (scrub, tween-гүй): карт доороос орж ирэхээс (top 85%) дэлгэцийн
 * голоос бага зэрэг дээш гарах (center 40%) хүртэл — бүрэн ажиллагаа карт бүтэн харагдаж байхад гүйцэнэ.
 * Хуучин SVG нь зөвхөн fallback: 3D эхний кадраа зуртал, WebGL2 байхгүй, алдаа, context алдагдах, ?sewer3d=off.
 */
/**
 * triggerId — scroll-ын явцыг унших элементийн id (Services-ийн нийтлэг наалттай дэлгэцэд тайлбарын мөр).
 * active — false бол зурахгүй (наалттай дэлгэцэд идэвхгүй үйлчилгээ; scene ачаалагдсан хэвээр үлдэнэ).
 */
export default function SewerVisual3D({
  className = "",
  triggerId,
  active = true,
}: {
  className?: string;
  triggerId?: string;
  active?: boolean;
}) {
  const root = useRef<HTMLDivElement>(null);
  const [rt] = useState(createSewerRuntime);
  const [mode, setMode] = useState<QualityTier | "off" | null>(null);
  const [supported, setSupported] = useState(false);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    const m = sewerMode();
    if (m !== "off") rt.tier = m;
    setMode(m);
    setSupported(hasWebGL2());

    // progress: картын (svc-img) байрлалаар, parallax-аас хамааралгүй
    const trigger = (triggerId ? document.getElementById(triggerId) : null) ?? root.current!.closest(".svc-img") ?? root.current!;
    const onProgress = (self: ScrollTrigger) => {
      rt.progress = self.progress;
      rt.invalidate();
    };
    const st = ScrollTrigger.create({ trigger, start: "top 85%", end: "center 40%", onUpdate: onProgress, onRefresh: onProgress });
    return () => st.kill();
  }, [rt, triggerId]);

  const tier = mode && mode !== "off" ? mode : null;
  const settings = tier ? TIERS[tier] : null;
  const { armed, near, allowed } = useCardRenderSlot("services-sewer", root, !!tier && supported && !failed && active);
  const use3D = !!tier && supported && armed && !failed;
  const continuous = allowed && !!settings?.ambient && !reduced;
  const live = use3D && ready;
  // хуучин SVG зөвхөн 3D ажиллах боломжгүй үед; ачаалж байхад зөөлөн ачааллын дэвсгэр
  const fallback = mode !== null && (!tier || !supported || failed);

  useEffect(() => {
    rt.reduced = reduced;
    rt.invalidate();
  }, [rt, reduced]);

  const handleReady = useCallback(() => setReady(true), []);
  const handleFail = useCallback(() => {
    setFailed(true);
    setReady(false);
  }, []);

  return (
    <div ref={root} className={`relative overflow-hidden ${className}`}>
      <SewerArt
        className={`absolute inset-0 h-full w-full transition-opacity duration-500 ${fallback ? "opacity-100" : "invisible opacity-0"}`}
      />
      {!fallback && !live && <div aria-hidden className="three-loading absolute inset-0" />}
      {use3D && tier && (
        <div aria-hidden className={`absolute inset-0 transition-opacity duration-500 ${live ? "opacity-100" : "opacity-0"}`}>
          <SceneBoundary onError={handleFail}>
            <SewerScene3D key={tier} rt={rt} tier={tier} running={near && active} continuous={continuous} onReady={handleReady} onFail={handleFail} />
          </SceneBoundary>
        </div>
      )}
    </div>
  );
}
