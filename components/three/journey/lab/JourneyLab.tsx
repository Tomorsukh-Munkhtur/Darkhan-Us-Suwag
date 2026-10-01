"use client";

import { useCallback, useEffect, useState, type KeyboardEvent } from "react";
import { journey } from "@/lib/content";
import JourneyVisual3D from "../JourneyVisual3D";
import { createJourneyDriver, type JourneyStats } from "../runtime";
import type { QualityTier } from "../quality";
import { usePrefersReducedMotion } from "../utils/browser";
import ProductionSim from "./ProductionSim";
import { IconButton, pad, SvgAtProgress, Toggle, usePlayer } from "./ui";

const N = journey.length;

declare global {
  interface Window {
    /** Автомат шалгалтад (CDP): progress-ийг шууд тохируулах */
    __journeyLab?: {
      setScene?: (stage: number, progress: number) => void;
      setPos?: (pos: number) => void;
      /** Зөвхөн унших (оношилгоо) */
      rt?: import("../runtime").JourneyRuntime;
    };
  }
}

type Options = { reducedMotion?: boolean; reduced: boolean; ambient: boolean; tier: QualityTier | "auto"; onTier: (t: QualityTier) => void };

/**
 * /lab/journey-3d — усны аяллын 3D-ийн progress-д суурилсан прототип.
 * Горим: "scene" — нэг үе шатыг progress (0–1)-оор scrub хийх; "sim" — production WaterJourney-ийн загвар.
 * URL: ?mode=sim &stage=1..6 &p=0..1 &size=large &view=svg &motion=reduced &ambient=on &tier=HIGH|MEDIUM|LOW
 */
export default function JourneyLab() {
  const [mode, setMode] = useState<"scene" | "sim">("scene");
  const [motion, setMotion] = useState<"system" | "reduced">("system");
  const [ambient, setAmbient] = useState<"off" | "on">("off");
  const [tier, setTier] = useState<QualityTier | "auto">("auto");
  const [resolved, setResolved] = useState<QualityTier | null>(null);
  const prefersReduced = usePrefersReducedMotion();

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (q.get("mode") === "sim") setMode("sim");
    if (q.get("motion") === "reduced") setMotion("reduced");
    if (q.get("ambient") === "on") setAmbient("on");
    const t = q.get("tier");
    if (t === "HIGH" || t === "MEDIUM" || t === "LOW") setTier(t);
  }, []);

  const reducedMotion = motion === "reduced" ? true : undefined;
  const opts: Options = {
    reducedMotion,
    reduced: reducedMotion ?? prefersReduced,
    ambient: ambient === "on",
    tier,
    onTier: setResolved,
  };

  return (
    <main className="mx-auto max-w-6xl px-4 pb-24 pt-12 sm:px-8">
      <p className="eyebrow">Лаб · үйлдвэрлэлд холбогдоогүй</p>
      <h1 className="mt-3 text-h2">
        Усны аялал — <span className="text-water">3D диорама</span>
      </h1>
      <p className="mt-4 max-w-3xl text-sm text-mist">
        Scene бүр зөвхөн <code className="text-abyss">progress</code> (0–1)-оос хамаарна: ижил утга → ижил кадр, буцааж гүйлгэхэд урвуу
        явна. Ambient (чимэглэлийн давталт) унтраалттай үед цаг огт оролцохгүй.
      </p>

      <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
        <Toggle
          label="Горим"
          value={mode}
          onChange={setMode}
          options={[
            ["scene", "Нэг scene"],
            ["sim", "Production симуляц"],
          ]}
        />
        <Toggle
          label="Хөдөлгөөн"
          value={motion}
          onChange={setMotion}
          options={[
            ["system", "Систем"],
            ["reduced", "Багасгах"],
          ]}
        />
        <Toggle
          label="Ambient"
          value={ambient}
          onChange={setAmbient}
          options={[
            ["off", "Унтраах"],
            ["on", "Асаах"],
          ]}
        />
        <Toggle
          label="Чанар"
          value={tier}
          onChange={setTier}
          options={[
            ["auto", `Auto${tier === "auto" && resolved ? ` (${resolved})` : ""}`],
            ["HIGH", "High"],
            ["MEDIUM", "Medium"],
            ["LOW", "Low"],
          ]}
        />
      </div>

      {mode === "scene" ? <SceneLab {...opts} /> : <ProductionSim {...opts} />}
    </main>
  );
}

function SceneLab({ reducedMotion, ambient, tier, onTier }: Options) {
  const [driver] = useState(() => createJourneyDriver(0, 1));
  const [stage, setStage] = useState(0);
  const [progress, setProgress] = useState(1);
  const [play, setPlay] = useState<"fwd" | "back" | "loop" | null>(null);
  const [size, setSize] = useState<"card" | "large">("card");
  const [view, setView] = useState<"3d" | "svg">("3d");
  const [stats, setStats] = useState<JourneyStats | null>(null);
  const stop = useCallback(() => setPlay(null), []);
  usePlayer(play, progress, setProgress, { speed: 0.35, onDone: stop });

  useEffect(() => {
    driver.set(stage, progress);
  }, [driver, stage, progress]);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const s = Number(q.get("stage"));
    if (s >= 1 && s <= N) setStage(s - 1);
    const p = q.get("p");
    if (p !== null && !Number.isNaN(Number(p))) setProgress(Math.min(1, Math.max(0, Number(p))));
    if (q.get("size") === "large") setSize("large");
    if (q.get("view") === "svg") setView("svg");
    window.__journeyLab = {
      ...window.__journeyLab,
      rt: driver.rt,
      setScene: (st: number, pr: number) => {
        setPlay(null);
        setStage(st);
        setProgress(pr);
      },
    };
    return () => {
      if (window.__journeyLab) delete window.__journeyLab.setScene;
    };
  }, []);

  const go = (i: number) => setStage((i + N) % N);
  const onTabKey = (e: KeyboardEvent) => {
    if (e.key === "ArrowRight") go(stage + 1);
    else if (e.key === "ArrowLeft") go(stage - 1);
    else return;
    e.preventDefault();
  };
  const nudge = (d: number) => {
    setPlay(null);
    setProgress((v) => Math.min(1, Math.max(0, Math.round((v + d) * 1000) / 1000)));
  };

  const s = journey[stage];
  const large = size === "large";

  return (
    <section aria-label="Нэг scene">
      <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
        <div role="tablist" aria-label="Үе шат" onKeyDown={onTabKey} className="flex flex-wrap gap-1.5">
          {journey.map((j, i) => (
            <button
              key={j.id}
              role="tab"
              type="button"
              aria-selected={i === stage}
              aria-controls="journey-lab-card"
              tabIndex={i === stage ? 0 : -1}
              onClick={() => setStage(i)}
              className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
                i === stage ? "border-water bg-water/15 text-abyss" : "border-abyss/10 text-abyss/60 hover:border-abyss/30 hover:text-abyss"
              }`}
            >
              <span className="font-display text-water">{pad(i + 1)}</span> {j.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <Toggle
            label="Хэмжээ"
            value={size}
            onChange={setSize}
            options={[
              ["card", "Карт"],
              ["large", "Том"],
            ]}
          />
          <Toggle
            label="Харьцуулах"
            value={view}
            onChange={setView}
            options={[
              ["3d", "3D"],
              ["svg", "Одоогийн SVG"],
            ]}
          />
        </div>
      </div>

      {/* progress: scrub, алхам, тоглуулагч (лабын тав тух) */}
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <IconButton label="progress 0" onClick={() => (setPlay(null), setProgress(0))}>⏮</IconButton>
        <IconButton label="Буцааж scrub" active={play === "back"} onClick={() => setPlay("back")}>◀</IconButton>
        <IconButton label="−0.05" onClick={() => nudge(-0.05)}>−</IconButton>
        <IconButton label="Зогсоох" onClick={stop}>⏸</IconButton>
        <IconButton label="+0.05" onClick={() => nudge(0.05)}>+</IconButton>
        <IconButton label="Урагш scrub" active={play === "fwd"} onClick={() => setPlay("fwd")}>▶</IconButton>
        <IconButton label="progress 1" onClick={() => (setPlay(null), setProgress(1))}>⏭</IconButton>
        <IconButton label="Автоматаар нааш цааш (лаб)" active={play === "loop"} onClick={() => setPlay(play === "loop" ? null : "loop")}>⟲</IconButton>
        <label className="ml-2 flex min-w-60 flex-1 items-center gap-3">
          <span className="font-mono text-xs text-abyss">p = {progress.toFixed(3)}</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.001}
            value={progress}
            aria-label="Progress"
            onChange={(e) => (setPlay(null), setProgress(Number(e.target.value)))}
            className="w-full accent-[#38b6f0]"
          />
        </label>
      </div>
      <p className="mt-2 font-mono text-[11px] text-mist" aria-live="off">
        {stats
          ? `${Math.round(stats.fps)} FPS · ${stats.calls} draw · ${(stats.triangles / 1000).toFixed(1)}k tri · DPR ${stats.dpr} · нийт кадр ${stats.frames}`
          : "—"}
      </p>

      {/* Үйлдвэрлэлийн картын бүтэц (WaterJourney.tsx) — visual-ын div нь хэмжээ солиход remount хийгдэхгүй */}
      <article id="journey-lab-card" aria-label={`${pad(stage + 1)} / ${pad(N)} ${s.label}`} className={`mx-auto mt-8 ${large ? "max-w-6xl" : "max-w-[920px]"}`}>
        <header className="mb-4 flex flex-col items-center text-center sm:mb-6">
          <span className="stage-node" data-lit />
          <p className="mt-3 font-display text-[11px] tracking-[0.3em] text-mist">
            {pad(stage + 1)} / {pad(N)}
          </p>
          <h2 className="mt-1 text-h3 tracking-[0.08em]">{s.label}</h2>
        </header>

        <div
          className={`glass grid overflow-hidden rounded-3xl border-water/30! ${
            large ? "grid-rows-[auto_auto]" : "grid-rows-[auto_1fr] [--vis:min(400px,50svh)] lg:grid-cols-[var(--vis)_1fr] lg:grid-rows-[1fr]"
          }`}
        >
          <div
            className={`relative overflow-hidden border-abyss/10 ${
              large ? "aspect-[16/9] border-b" : "h-[clamp(7.5rem,20svh,13rem)] border-b lg:h-auto lg:min-h-(--vis) lg:border-b-0 lg:border-r"
            }`}
          >
            <JourneyVisual3D
              driver={driver}
              fallback={<SvgAtProgress stage={stage} progress={progress} />}
              reducedMotion={reducedMotion}
              ambient={ambient}
              tier={tier}
              paused={view === "svg"}
              onStats={setStats}
              onTier={onTier}
            />
            {view === "svg" && (
              <div className="absolute inset-0 z-10 [&>svg]:absolute [&>svg]:inset-0 [&>svg]:h-full [&>svg]:w-full">
                <SvgAtProgress stage={stage} progress={progress} />
              </div>
            )}
          </div>
          <div className="flex flex-col justify-center p-5 sm:p-8 lg:px-10 lg:py-7">
            <p className="font-display text-h4 font-bold text-deep">{s.title}</p>
            <p className="mt-2 text-sm leading-relaxed text-abyss/75 sm:mt-3 sm:text-base">{s.lead}</p>
            <dl className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-abyss/10 bg-abyss/10 sm:mt-5">
              {s.facts.map((f, fi) => (
                <div key={f.k} className={`bg-white px-3 py-2.5 sm:px-4 sm:py-3 ${s.facts.length % 2 && fi === s.facts.length - 1 ? "col-span-2" : ""}`}>
                  <dt className="text-[10px] uppercase tracking-widest text-mist sm:text-[11px]">{f.k}</dt>
                  <dd className="mt-1 font-display text-sm text-abyss">{f.v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </article>

      <p className="mt-6 text-center text-xs text-mist">← → товчоор үе шат солино. Гулсуулагч дээр сум товч progress-ийг өөрчилнө.</p>
    </section>
  );
}
