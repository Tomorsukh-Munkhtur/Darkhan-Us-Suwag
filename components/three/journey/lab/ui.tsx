"use client";

import { useCallback, useEffect, useRef, type ReactNode } from "react";
import type { gsap } from "gsap";
import {
  ScrubDriver,
  SourceVisual,
  ExtractionVisual,
  TreatmentVisual,
  ReservoirVisual,
  NetworkVisual,
  HomeVisual,
} from "@/components/sections/journey/Visuals";

/** Одоогийн production SVG зураглал (өөрчлөхгүй, зөвхөн уншина) */
export const SVG_VISUALS = [SourceVisual, ExtractionVisual, TreatmentVisual, ReservoirVisual, NetworkVisual, HomeVisual];

export const pad = (n: number) => String(n).padStart(2, "0");

/**
 * SVG visual-ын GSAP timeline-ийг progress-оор шууд байрлуулна (tween-гүй, детерминистик).
 * Production WaterJourney-ийн ScrubDriver-тэй ижил гэрээ: visual timeline-аа бүртгүүлнэ.
 */
export function useSvgScrub(progress: number) {
  const tl = useRef<gsap.core.Timeline | null>(null);
  const value = useRef(progress);
  const driver = useCallback((t: gsap.core.Timeline) => {
    tl.current = t;
    t.progress(value.current);
    return () => {
      if (tl.current === t) tl.current = null;
    };
  }, []);
  useEffect(() => {
    value.current = progress;
    tl.current?.progress(progress);
  }, [progress]);
  return driver;
}

/** Тухайн үе шатын SVG-г өгсөн progress дээр */
export function SvgAtProgress({ stage, progress }: { stage: number; progress: number }) {
  const driver = useSvgScrub(progress);
  const Visual = SVG_VISUALS[stage];
  return (
    <ScrubDriver.Provider value={driver}>
      <Visual key={stage} />
    </ScrubDriver.Provider>
  );
}

export function Toggle<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly (readonly [T, string])[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div role="group" aria-label={label} className="flex items-center gap-2 text-xs">
      <span className="text-mist">{label}</span>
      <div className="flex rounded-full border border-abyss/15 bg-abyss/5 p-0.5">
        {options.map(([v, l]) => (
          <button
            key={v}
            type="button"
            aria-pressed={value === v}
            onClick={() => onChange(v)}
            className={`rounded-full px-3 py-1 transition-colors ${value === v ? "bg-water/20 text-abyss" : "text-abyss/60 hover:text-abyss"}`}
          >
            {l}
          </button>
        ))}
      </div>
    </div>
  );
}

export function IconButton({ label, onClick, active, children }: { label: string; onClick: () => void; active?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      onClick={onClick}
      className={`h-9 min-w-9 rounded-full border px-2.5 text-sm transition-colors ${
        active ? "border-water bg-water/15 text-abyss" : "border-abyss/15 text-abyss/80 hover:border-water hover:text-abyss"
      }`}
    >
      {children}
    </button>
  );
}

/**
 * Лабын тоглуулагч (зөвхөн тав тухтай байдалд): утгыг rAF-аар өөрчилнө. Scene өөрөө зөвхөн утгаас хамаарна.
 * mode: "fwd" — to дээр зогсоно, "back" — from дээр зогсоно, "loop" — нааш цааш.
 */
export function usePlayer(
  mode: "fwd" | "back" | "loop" | null,
  value: number,
  setValue: (v: number) => void,
  { from = 0, to = 1, speed = 0.4, onDone }: { from?: number; to?: number; speed?: number; onDone?: () => void } = {},
) {
  const current = useRef(value);
  useEffect(() => {
    current.current = value;
  }, [value]);
  useEffect(() => {
    if (!mode) return;
    let raf = 0;
    let last = performance.now();
    let dir = mode === "back" ? -1 : 1;
    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      let n = current.current + dir * speed * dt;
      let done = false;
      if (mode === "loop") {
        if (n >= to) [n, dir] = [to, -1];
        else if (n <= from) [n, dir] = [from, 1];
      } else if (n >= to || n <= from) {
        n = Math.min(to, Math.max(from, n));
        done = true;
      }
      current.current = n;
      setValue(n);
      if (done) onDone?.();
      else raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [mode, setValue, from, to, speed, onDone]);
}
