"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useCardRenderSlot } from "../useCardRenderSlot";
import { detectTier, readTierSignals, TIERS, type QualityTier } from "../journey/quality";
import { hasWebGL2, usePrefersReducedMotion } from "../journey/utils/browser";
import SceneBoundary from "../journey/SceneBoundary";

// three.js + R3F + тоолуурын scene: карт ойртох үед л ачаалагдана
const MeterScene3D = dynamic(() => import("./MeterScene3D"), { ssr: false, loading: () => null });

/** ?meter3d=off|low|medium|high — QA ба статик (SVG) горим */
function meterMode(): QualityTier | "off" {
  const q = new URLSearchParams(window.location.search).get("meter3d");
  if (q === "off") return "off";
  if (q === "high" || q === "medium" || q === "low") return q.toUpperCase() as QualityTier;
  return detectTier(readTierSignals());
}

/** WebGL байхгүй үеийн хөдөлгөөнгүй тоолуур */
function MeterArt({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 400 400" className={className} aria-hidden>
      <rect x="20" y="215" width="360" height="26" rx="13" fill="#1b7fc0" />
      <rect x="95" y="195" width="210" height="66" rx="33" fill="#1f5f8f" />
      <ellipse cx="200" cy="190" rx="92" ry="34" fill="#e3edf4" />
      <rect x="108" y="160" width="184" height="32" fill="#e3edf4" />
      <ellipse cx="200" cy="160" rx="92" ry="34" fill="#9fb4c4" />
      <ellipse cx="200" cy="160" rx="82" ry="29" fill="#071c2b" />
      <text x="200" y="166" fill="#9ff5dc" fontSize="22" fontFamily="monospace" fontWeight="700" textAnchor="middle">
        01234.50
      </text>
      <rect x="250" y="120" width="70" height="44" rx="6" fill="#d6e2ea" />
      <line x1="270" y1="120" x2="270" y2="70" stroke="#3e5669" strokeWidth="5" strokeLinecap="round" />
      <circle cx="270" cy="66" r="7" fill="#34c28a" />
      {[26, 44, 62].map((r) => (
        <path key={r} d={`M${270 - r} ${66 - r * 0.4} A${r} ${r} 0 0 1 ${270 + r} ${66 - r * 0.4}`} fill="none" stroke="#5fd3f7" strokeOpacity={1 - r / 90} strokeWidth="3" />
      ))}
    </svg>
  );
}

/**
 * Ухаалаг тоолуурын 3D (SmartServices). Ойртоход ачаалж нэг кадр зурна; тасралтгүй хөдөлгөөн (заалт тоологдох, дохио)
 * нь render зохицуулагчийн зөвшөөрөлтэй, дэлгэцэнд харагдаж байхад л. WebGL2 байхгүй, алдаа, ?meter3d=off үед SVG.
 */
export default function SmartMeter3D({
  className = "",
  boost,
  onReading,
}: {
  className?: string;
  /** 0–1: дохионы хүч (MeterScene3D) */
  boost?: number;
  /** заалт солигдох бүрт (зөвхөн 3D ажиллаж байхад) */
  onReading?: (value: number) => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<QualityTier | "off" | null>(null);
  const [supported, setSupported] = useState(false);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    setMode(meterMode());
    setSupported(hasWebGL2());
  }, []);

  const tier = mode && mode !== "off" ? mode : null;
  const settings = tier ? TIERS[tier] : null;
  const { armed, near, allowed } = useCardRenderSlot("smart-meter", root, !!tier && supported && !failed);
  const use3D = !!tier && supported && armed && !failed;
  const continuous = allowed && !!settings?.ambient && !reduced;
  const live = use3D && ready;
  const fallback = mode !== null && (!tier || !supported || failed);

  const handleReady = useCallback(() => setReady(true), []);
  const handleFail = useCallback(() => {
    setFailed(true);
    setReady(false);
  }, []);

  return (
    <div ref={root} className={`relative overflow-hidden ${className}`}>
      <MeterArt className={`absolute inset-0 h-full w-full transition-opacity duration-500 ${fallback ? "opacity-100" : "invisible opacity-0"}`} />
      {!fallback && !live && <div aria-hidden className="three-loading absolute inset-0" />}
      {use3D && settings && (
        <div aria-hidden className={`absolute inset-0 transition-opacity duration-500 ${live ? "opacity-100" : "opacity-0"}`}>
          <SceneBoundary onError={handleFail}>
            <MeterScene3D
              key={tier}
              tier={settings}
              running={near}
              continuous={continuous}
              reduced={reduced}
              onReady={handleReady}
              onFail={handleFail}
              boost={boost}
              onReading={onReading}
            />
          </SceneBoundary>
        </div>
      )}
    </div>
  );
}
