"use client";

import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { gsap } from "gsap";
import { journey } from "@/lib/content";
import { ScrubDriver } from "@/components/sections/journey/Visuals";
import { RENDER_PRIORITY, useRenderSlot, useRenderSlots } from "../../renderCoordinator";
import JourneyVisual3D from "../JourneyVisual3D";
import { createJourneyDriver, type JourneyStats } from "../runtime";
import { activeCard, cardProgress, overlayOpacity, svgScrubTarget } from "../progress";
import { contextCounter } from "../diagnostics";
import type { QualityTier } from "../quality";
import { IconButton, pad, SVG_VISUALS, usePlayer } from "./ui";

// Production WaterJourney-ийн арын усны гадаргуу (өөрчлөхгүй, зөвхөн import)
const WaterSurface = dynamic(() => import("@/components/three/WaterSurface"), { ssr: false });

const N = journey.length;
type Timeline = gsap.core.Timeline;

/** Нэг карт: production-тэй ижил SVG visual (scrub нь pos-оос). 3D энд mount хийгдэхгүй. */
const SimCard = memo(function SimCard({
  i,
  driver,
  cardRef,
  slotRef,
}: {
  i: number;
  driver: (tl: Timeline) => () => void;
  cardRef: (el: HTMLElement | null) => void;
  slotRef: (el: HTMLDivElement | null) => void;
}) {
  const Visual = SVG_VISUALS[i];
  const s = journey[i];
  return (
    <article ref={cardRef} aria-label={`${pad(i + 1)} / ${pad(N)} ${s.label}`} className="relative w-(--card) shrink-0 origin-[50%_0]">
      <div className="glass overflow-hidden rounded-3xl border-water/30!">
        <div
          ref={slotRef}
          className="relative aspect-[4/3] overflow-hidden border-b border-abyss/10 sm:aspect-square [&>svg]:absolute [&>svg]:inset-0 [&>svg]:h-full [&>svg]:w-full"
        >
          <ScrubDriver.Provider value={driver}>
            <Visual />
          </ScrubDriver.Provider>
        </div>
        <p className="flex items-baseline gap-2 px-4 py-3 text-sm">
          <span className="font-display text-[11px] text-water">{pad(i + 1)}</span>
          <span className="font-medium tracking-wide">{s.label}</span>
        </p>
      </div>
    </article>
  );
});

/** HeroWater-ийг загварчилна: зөвхөн зохицуулагчид "render хийх хүсэлтэй" гэж бүртгүүлнэ (canvas-гүй) */
function HeroSim({ on }: { on: boolean }) {
  useRenderSlot("hero-water", RENDER_PRIORITY.heroWater, on);
  return null;
}

/** Арын WaterSurface: зохицуулагч зөвшөөрсөн үед л render хийнэ (production-д WaterJourney.tsx-д хийгдэх өөрчлөлт) */
function CoordinatedSurface({ reduced }: { reduced: boolean }) {
  const box = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting));
    io.observe(box.current!);
    return () => io.disconnect();
  }, []);
  const allowed = useRenderSlot("water-surface", RENDER_PRIORITY.waterSurface, inView);
  return (
    <div ref={box} aria-hidden className="pointer-events-none absolute inset-0">
      <WaterSurface running={allowed} reduced={reduced} />
    </div>
  );
}

/**
 * Production WaterJourney-ийн загвар: 6 карт нэг эгнээнд, scroll байрлал (pos 0…5)-оор гулсана.
 * ИДЭВХТЭЙ карт = НЭГ хуваалцсан 3D canvas (давхарга нь slot-ыг transform-оор дагана),
 * хөрш/алс картууд = одоогийн SVG. Canvas хэзээ ч дахин mount хийгдэхгүй.
 */
export default function ProductionSim({
  reduced,
  reducedMotion,
  ambient,
  tier,
  onTier,
}: {
  reduced: boolean;
  reducedMotion?: boolean;
  ambient: boolean;
  tier: QualityTier | "auto";
  onTier: (t: QualityTier) => void;
}) {
  const [driver] = useState(() => createJourneyDriver(0, 1));
  const [pos, setPos] = useState(0);
  const [play, setPlay] = useState<"fwd" | "back" | "loop" | null>(null);
  const [hero, setHero] = useState(false);
  const [stats, setStats] = useState<JourneyStats | null>(null);
  const [diag, setDiag] = useState({ canvases: 0, created: 0, lost: 0 });
  const stop = useCallback(() => setPlay(null), []);
  usePlayer(play, pos, setPos, { from: 0, to: N - 1, speed: 0.45, onDone: stop });
  const slotsState = useRenderSlots();

  const container = useRef<HTMLDivElement>(null);
  const row = useRef<HTMLDivElement>(null);
  const overlay = useRef<HTMLDivElement>(null);
  const cards = useRef<(HTMLElement | null)[]>([]);
  const slots = useRef<(HTMLDivElement | null)[]>([]);
  const tls = useRef<(Timeline | null)[]>([]);
  const posRef = useRef(pos);

  const cardRefs = useMemo(() => journey.map((_, i) => (el: HTMLElement | null) => void (cards.current[i] = el)), []);
  const slotRefs = useMemo(() => journey.map((_, i) => (el: HTMLDivElement | null) => void (slots.current[i] = el)), []);
  const drivers = useMemo(
    () =>
      journey.map((_, i) => (tl: Timeline) => {
        tls.current[i] = tl;
        tl.progress(svgScrubTarget(posRef.current, i));
        return () => {
          if (tls.current[i] === tl) tls.current[i] = null;
        };
      }),
    [],
  );

  /** pos → бүх зүйл (production-д ScrollTrigger onUpdate-ээс дуудагдана). Цэвэр: зөвхөн pos-оос хамаарна. */
  const apply = useCallback(
    (p: number) => {
      posRef.current = p;
      const c0 = cards.current[0];
      const c1 = cards.current[1];
      const o = overlay.current;
      if (!c0 || !c1 || !o || !container.current || !row.current) return;
      const step = c1.offsetLeft - c0.offsetLeft;
      row.current.style.transform = `translate3d(${(-p * step).toFixed(1)}px, 0, 0)`;
      cards.current.forEach((c, i) => {
        const a = Math.min(Math.abs(p - i), 1);
        c!.style.transform = `scale(${(1 - 0.1 * a).toFixed(3)})`;
        c!.style.opacity = (1 - 0.6 * a).toFixed(3);
        c!.dataset.active = String(i === activeCard(p, N));
        tls.current[i]?.progress(svgScrubTarget(p, i));
      });

      const active = activeCard(p, N);
      driver.set(active, cardProgress(p, active));

      // Нэг canvas идэвхтэй slot-ыг дагана: хэмжээ = slot-ын layout хэмжээ (гүйлгэх үед canvas resize хийгдэхгүй),
      // байрлал/томрол = transform. Урсгалаас гадуур (absolute) → layout shift үгүй.
      const slot = slots.current[active]!;
      const cr = container.current.getBoundingClientRect();
      const sr = slot.getBoundingClientRect();
      o.style.width = `${slot.offsetWidth}px`;
      o.style.height = `${slot.offsetHeight}px`;
      o.style.transform = `translate3d(${(sr.left - cr.left).toFixed(1)}px, ${(sr.top - cr.top).toFixed(1)}px, 0) scale(${(sr.width / slot.offsetWidth).toFixed(4)})`;
      o.style.opacity = overlayOpacity(p, active).toFixed(3);
    },
    [driver],
  );

  useLayoutEffect(() => apply(pos), [pos, apply]);
  useEffect(() => {
    const ro = new ResizeObserver(() => apply(posRef.current));
    ro.observe(container.current!);
    return () => ro.disconnect();
  }, [apply]);

  useEffect(() => {
    const id = window.setInterval(() => setDiag({ canvases: document.querySelectorAll("canvas").length, ...contextCounter }), 500);
    window.__journeyLab = { ...window.__journeyLab, setPos: (p: number) => (setPlay(null), setPos(p)) };
    return () => {
      window.clearInterval(id);
      if (window.__journeyLab) delete window.__journeyLab.setPos;
    };
  }, []);

  const active = activeCard(pos, N);
  const label = (id: string) => ({ "hero-water": "HeroWater (симуляц)", "journey-3d": "Journey 3D", "water-surface": "WaterSurface" })[id] ?? id;

  return (
    <section aria-label="Production симуляц">
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <IconButton label="Эхлэл (pos 0)" onClick={() => (setPlay(null), setPos(0))}>⏮</IconButton>
        <IconButton label="Буцааж гүйлгэх" active={play === "back"} onClick={() => setPlay("back")}>◀</IconButton>
        <IconButton label="Зогсоох" onClick={stop}>⏸</IconButton>
        <IconButton label="Урагш гүйлгэх" active={play === "fwd"} onClick={() => setPlay("fwd")}>▶</IconButton>
        <IconButton label="Төгсгөл (pos 5)" onClick={() => (setPlay(null), setPos(N - 1))}>⏭</IconButton>
        <IconButton label="Автоматаар нааш цааш (лаб)" active={play === "loop"} onClick={() => setPlay(play === "loop" ? null : "loop")}>⟲</IconButton>
        <label className="ml-2 flex items-center gap-2 text-xs text-mist">
          <input type="checkbox" checked={hero} onChange={(e) => setHero(e.target.checked)} className="accent-[#38b6f0]" />
          HeroWater render хийж байна (симуляц)
        </label>
      </div>
      <label className="mt-4 block">
        <span className="sr-only">Scroll байрлал</span>
        <input
          type="range"
          min={0}
          max={N - 1}
          step={0.001}
          value={pos}
          onChange={(e) => (setPlay(null), setPos(Number(e.target.value)))}
          className="w-full accent-[#38b6f0]"
        />
      </label>
      <p className="mt-1 font-mono text-[11px] text-mist">
        pos {pos.toFixed(3)} · идэвхтэй {pad(active + 1)} · 3D progress {cardProgress(pos, active).toFixed(3)} · 3D opacity{" "}
        {overlayOpacity(pos, active).toFixed(2)}
      </p>

      <div
        ref={container}
        className="relative mt-6 overflow-hidden rounded-3xl border border-abyss/10 bg-foam py-10 [--card:min(70vw,340px)]"
      >
        <CoordinatedSurface reduced={reducedMotion ?? reduced} />
        <div ref={row} className="relative flex items-start gap-[8vw] px-[calc((100%-var(--card))/2)] will-change-transform sm:gap-16">
          {journey.map((j, i) => (
            <SimCard key={j.id} i={i} driver={drivers[i]} cardRef={cardRefs[i]} slotRef={slotRefs[i]} />
          ))}
        </div>
        {/* НЭГ canvas: идэвхтэй картын slot дээр */}
        <div ref={overlay} className="absolute left-0 top-0 origin-top-left overflow-hidden rounded-t-3xl" style={{ opacity: 0 }}>
          <JourneyVisual3D driver={driver} reducedMotion={reducedMotion} ambient={ambient} tier={tier} onStats={setStats} onTier={onTier} />
        </div>
      </div>

      <div className="mt-6 grid gap-4 text-xs sm:grid-cols-2">
        <div className="rounded-2xl border border-abyss/10 p-4">
          <p className="eyebrow">Render зохицуулагч</p>
          <ul className="mt-3 space-y-1.5 font-mono text-[11px]">
            {slotsState.map((s) => (
              <li key={s.id} className="flex justify-between gap-4">
                <span>
                  {label(s.id)} <span className="text-mist">(p{s.priority})</span>
                </span>
                <span className={s.allowed ? "text-leaf" : s.wants ? "text-alert" : "text-mist"}>
                  {s.allowed ? "RENDER" : s.wants ? "ЗОГССОН (хүлээж байна)" : "идэвхгүй"}
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl border border-abyss/10 p-4">
          <p className="eyebrow">WebGL context</p>
          <p className="mt-3 font-mono text-[11px] leading-relaxed">
            Хуудсан дээрх canvas: {diag.canvases} (Journey 3D + WaterSurface) · Journey 3D context үүссэн: {diag.created} · алдагдсан:{" "}
            {diag.lost}
            <br />
            {stats ? `${Math.round(stats.fps)} FPS · ${stats.calls} draw · ${(stats.triangles / 1000).toFixed(1)}k tri · DPR ${stats.dpr} · нийт кадр ${stats.frames}` : "—"}
          </p>
        </div>
      </div>
      <HeroSim on={hero} />
    </section>
  );
}
