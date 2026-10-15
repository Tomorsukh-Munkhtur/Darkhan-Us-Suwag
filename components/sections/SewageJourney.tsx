"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { sewageIntro, sewageJourney } from "@/lib/content";
import JourneyStage3D from "@/components/three/journey/JourneyStage3D";
import { createJourneyDriver } from "@/components/three/journey/runtime";
import { detectTier, readTierSignals, type QualityTier } from "@/components/three/journey/quality";
import { hasWebGL2 } from "@/components/three/journey/utils/browser";
import { computeJourneyViews, measureJourneyBand, type JourneyBand } from "@/components/three/journey/stageLayout";
import { SEWAGE_JOURNEY } from "@/components/three/sewage/stages";
import SectionHeading from "../ui/SectionHeading";
import DripDots from "./journey/DripDots";
import { sewageVisuals } from "./sewage/Visuals";
import { prefersReducedMotion } from "@/lib/motion";

gsap.registerPlugin(ScrollTrigger);

// three.js + R3F + 5 scene: зөвхөн клиент дээр, хэсэг ойртох үед л ачаалагдана
const SewageScene3D = dynamic(() => import("@/components/three/sewage/SewageScene3D"), { ssr: false, loading: () => null });
const WaterSurface = dynamic(() => import("@/components/three/WaterSurface"), { ssr: false });

const pad = (n: number) => String(n).padStart(2, "0");
const N = sewageJourney.length;

/** ?sewage3d=off|low|medium|high — QA ба статик (SVG) горим; бусад үед төхөөрөмжөөс тодорхойлно */
function sewageMode(): QualityTier | "off" {
  const q = new URLSearchParams(window.location.search).get("sewage3d");
  if (q === "off") return "off";
  if (q === "high" || q === "medium" || q === "low") return q.toUpperCase() as QualityTier;
  return detectTier(readTierSignals());
}

/**
 * Бохир ус хэрхэн цэвэршдэг вэ? — АТА-ийн 5 шат, хэвтээ аялал ЗҮҮН тийш (Усны аяллын эсрэг): самбар дэлгэцэнд тогтож (sticky),
 * 1-р шат баруун талд; доош гүйлгэхэд картууд зүүнээс орж ирээд баруун тийш гулсана. Хоолойд ус баруунаас зүүн тийш
 * бохир (хүрэн) өнгөөс цэвэр (цэнхэр) болж дүүрнэ; 3D диорамууд ч толин тусгалтай (урсгал зүүн тийш — sewage/stages.ts).
 * Карт бүрийн зураг — 3D (НЭГ хуваалцсан canvas, three/sewage; Усны аяллын систем — JourneyStage3D, ViewRenderer).
 * SVG (sewage/Visuals) зөвхөн 3D ажиллах боломжгүй үед.
 */
export default function SewageJourney() {
  const root = useRef<HTMLElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const row = useRef<HTMLDivElement>(null);
  const pipe = useRef<HTMLDivElement>(null);
  const pipeFill = useRef<HTMLDivElement>(null);
  const hint = useRef<HTMLParagraphElement>(null);
  const cards = useRef<(HTMLElement | null)[]>([]);
  const anchors = useRef<(HTMLSpanElement | null)[]>([]);
  const slots = useRef<(HTMLDivElement | null)[]>([]);
  const dist = useRef(0);
  const travel = useRef(0);
  const pos = useRef(0);
  const entry = useRef(0);
  const [active, setActive] = useState(0);
  const activeRef = useRef(0);

  const [driver] = useState(() => createJourneyDriver(undefined, 1, SEWAGE_JOURNEY));
  const [mode, setMode] = useState<QualityTier | "off" | null>(null);
  const [threeReady, setThreeReady] = useState(false);
  const [svgFallback, setSvgFallback] = useState(false);
  const band = useRef<HTMLDivElement | null>(null);
  const bandLayout = useRef<JourneyBand | null>(null);

  // арын усны урсгалын хээ (Үйлчилгээ хэсгийнх шиг): WebGL2 байвал, хэсэг ойртоход л үүсгэж, дэлгэцэнд байхад урсана
  const [flow, setFlow] = useState<{ reduced: boolean } | null>(null);
  const [near, setNear] = useState(false);

  useEffect(() => {
    setMode(sewageMode());
    const webgl = hasWebGL2();
    const io = new IntersectionObserver(
      ([e]) => {
        setNear(e.isIntersecting);
        if (e.isIntersecting && webgl) setFlow((f) => f ?? { reduced: prefersReducedMotion() });
      },
      { rootMargin: "200px 0px" },
    );
    io.observe(root.current!);
    return () => io.disconnect();
  }, []);
  const onThreeReady = useCallback((ready: boolean) => setThreeReady(ready), []);

  useEffect(() => {
    // Хэмжээ: картууд урвуу дараалалтай (flex-row-reverse) — 1-р карт хамгийн баруунд, сүүлийнх нь зүүнд.
    // Сүүлийн картын төвөөс эхний картын төв хүртэлх зай = хэвтээ аялал; шат бүрт дор хаяж 0.8 дэлгэц ногдоно
    const measure = () => {
      const first = cards.current[0]!;
      const last = cards.current[N - 1]!;
      const c0 = first.offsetLeft + first.offsetWidth / 2;
      const cN = last.offsetLeft + last.offsetWidth / 2;
      dist.current = c0 - cN;
      const len = dist.current * Math.max(1, (0.8 * window.innerHeight) / (dist.current / (N - 1)));
      travel.current = len;
      track.current!.style.height = `calc(100svh + ${len}px)`;
      anchors.current.forEach((a, i) => a && (a.style.top = `${(i / (N - 1)) * len}px`));
      const node = first.querySelector<HTMLElement>(".stage-node")!;
      const rowTop = row.current!.getBoundingClientRect().top;
      const r = node.getBoundingClientRect();
      pipe.current!.style.left = `${cN}px`;
      pipe.current!.style.width = `${dist.current}px`;
      pipe.current!.style.top = `${r.top - rowTop + r.height / 2}px`;
      bandLayout.current = measureJourneyBand(row.current!, first, slots.current[0]!);
      if (band.current) {
        band.current.style.top = `${bandLayout.current.top}px`;
        band.current.style.height = `${bandLayout.current.height}px`;
      }
    };

    const syncViews = () => {
      if (!band.current || !bandLayout.current) return;
      driver.setViews(computeJourneyViews(pos.current, entry.current, band.current, cards.current, slots.current, bandLayout.current));
    };

    const update = (p: number) => {
      pos.current = p * (N - 1);
      // flex-row-reverse: 1-р карт мөрийн эхэнд (баруун padding-ийн дараа) тул p = 0 үед голд; явах тусам мөр
      // баруун тийш гулсаж, зүүн талын (дараагийн) карт гол руу ирнэ
      row.current!.style.transform = `translate3d(${(p * dist.current).toFixed(1)}px, 0, 0)`;
      pipeFill.current!.style.clipPath = `inset(0 0 0 ${((1 - p) * 100).toFixed(2)}%)`;
      // гол карт тод, хажуугийнх нь жижиг, бүдэг
      cards.current.forEach((c, i) => {
        const a = Math.min(Math.abs(pos.current - i), 1);
        c!.style.transform = `scale(${(1 - 0.1 * a).toFixed(3)})`;
        c!.style.opacity = (1 - 0.6 * a).toFixed(3);
      });
      hint.current!.style.opacity = gsap.utils.clamp(0, 1, 1 - pos.current * 2.5).toFixed(2);
      const i = Math.round(pos.current);
      if (i !== activeRef.current) {
        activeRef.current = i;
        setActive(i);
      }
      syncViews();
    };

    measure();
    const st = ScrollTrigger.create({
      trigger: track.current,
      start: "top top",
      end: () => `+=${travel.current}`,
      onUpdate: (self) => update(self.progress),
      onRefresh: (self) => update(self.progress),
    });
    // эхний карт хэсэг рүү орж ирэх scroll-оор босно
    const onEntry = (self: ScrollTrigger) => {
      entry.current = self.progress;
      syncViews();
    };
    const entrySt = ScrollTrigger.create({ trigger: track.current, start: "top bottom", end: "top top", onUpdate: onEntry, onRefresh: onEntry });
    const refresh = () => {
      measure();
      ScrollTrigger.refresh();
    };
    let t = 0;
    const onResize = () => {
      clearTimeout(t);
      t = window.setTimeout(refresh, 150);
    };
    window.addEventListener("resize", onResize);
    let alive = true;
    document.fonts.ready.then(() => alive && refresh());
    return () => {
      alive = false;
      clearTimeout(t);
      window.removeEventListener("resize", onResize);
      st.kill();
      entrySt.kill();
    };
  }, [driver]);

  return (
    <section
      id="sewage"
      ref={root}
      data-journey-3d={threeReady ? "on" : svgFallback ? undefined : "loading"}
      // дэвсгэр: ирмэгээрээ хөрш хэсгүүдийн өнгө (#eef6fb, заагшгүй), голдоо арай гүн цэнхэр
      className="relative bg-[linear-gradient(#eef6fb,#d8ebf7_30%,#d8ebf7_70%,#eef6fb)] pt-20 sm:pt-28"
    >
      {/* арын усны урсгал: хэсгийг бүтэн хамарсан давхарга дотор sticky — дэлгэцэнд тогтоод хэсэгтэй хамт гүйнэ,
          дээд/доод ирмэгээрээ уусна (Services.tsx-тэй ижил) */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="svc-flow sticky top-0 h-[100svh] overflow-hidden">
          {flow && <WaterSurface running={near} reduced={flow.reduced} strength={0.5} speed={0.9} even ink />}
        </div>
      </div>

      <div className="relative mx-auto max-w-7xl px-4 sm:px-8">
        <SectionHeading
          eyebrow={sewageIntro.eyebrow}
          align="center"
          title={
            <>
              {sewageIntro.title} <span className="text-water">{sewageIntro.accent}</span>
            </>
          }
          lead={sewageIntro.lead}
        />
      </div>

      {/* Босоо scroll → хэвтээ аялал; өндрийг measure() тооцно */}
      <div ref={track} className="relative" style={{ height: `calc(100svh + ${(N - 1) * 90}vw)` }}>
        {sewageJourney.map((st, i) => (
          <span
            key={st.id}
            id={`stage-${st.id}`}
            ref={(el) => {
              anchors.current[i] = el;
            }}
            aria-hidden
            className="absolute left-0 w-px"
          />
        ))}

        <div className="journey-stage sticky top-0 flex h-[100svh] flex-col justify-center overflow-hidden pb-24 pt-14 sm:pt-20">
          <div
            ref={row}
            className="relative flex flex-row-reverse items-stretch gap-[12vw] px-[calc((100%-var(--card))/2)] will-change-transform [--card:84vw] md:gap-[10vw] md:[--card:72vw] lg:[--card:min(70vw,920px)]"
          >
            {/* картуудыг холбох хоолой: баруунаас зүүн тийш бохир (хүрэн) → цэвэр (цэнхэр) ус урсаж дүүрнэ */}
            <div ref={pipe} aria-hidden className="journey-pipe">
              <div ref={pipeFill} className="journey-pipe__fill journey-pipe__fill--sewage" />
            </div>

            {sewageJourney.map((s, i) => {
              const Visual = sewageVisuals[s.id];
              const steps = "steps" in s ? s.steps : null;
              return (
                <article
                  key={s.id}
                  ref={(el) => {
                    cards.current[i] = el;
                  }}
                  aria-label={`${pad(i + 1)} / ${pad(N)} ${s.label}`}
                  className="relative flex w-(--card) shrink-0 origin-[50%_7px] flex-col"
                >
                  {i !== active && <a href={`#stage-${s.id}`} tabIndex={-1} aria-hidden className="absolute inset-0 z-10 cursor-pointer" />}
                  <header className="mb-4 flex flex-col items-center text-center sm:mb-6">
                    <span className="stage-node" data-lit={i <= active} />
                    <p className="mt-3 font-display text-[11px] tracking-[0.3em] text-mist">
                      {pad(i + 1)} / {pad(N)}
                    </p>
                    <h3 className="mt-1 text-center text-h3 tracking-[0.08em]">{s.label}</h3>
                  </header>

                  <div className="glass grid flex-1 grid-rows-[auto_1fr] overflow-hidden rounded-3xl border-water/30! [--vis:min(400px,50svh)] lg:grid-cols-[var(--vis)_1fr] lg:grid-rows-[1fr]">
                    <div
                      ref={(el) => {
                        slots.current[i] = el;
                      }}
                      className="journey-visual relative h-[clamp(7.5rem,20svh,13rem)] overflow-hidden border-b border-abyss/10 bg-[#0b2e4c] lg:h-auto lg:min-h-(--vis) lg:border-b-0 lg:border-r [&>svg]:absolute [&>svg]:inset-0"
                    >
                      <Visual />
                    </div>
                    <div className="flex flex-col justify-center p-5 sm:p-8 lg:px-10 lg:py-7">
                      <p className="font-display text-h4 font-bold text-deep">{s.title}</p>
                      <p className="mt-2 line-clamp-3 text-justify text-sm leading-relaxed text-abyss/75 sm:mt-3 sm:line-clamp-none sm:text-base lg:text-[1.0625rem]">
                        {s.lead}
                      </p>
                      {steps ? (
                        // Төв цэвэрлэх байгууламжийн 7 үе шат
                        <ol className="mt-4 flex flex-wrap gap-1.5 sm:mt-5 sm:gap-2">
                          {steps.map((name, k) => (
                            <li
                              key={name}
                              className="flex items-center gap-1.5 rounded-full border border-abyss/10 bg-white py-1 pl-1 pr-2.5 text-xs text-abyss sm:text-[13px]"
                            >
                              <span className="grid h-5 w-5 place-items-center rounded-full bg-water/10 font-display text-[11px] font-semibold text-water">
                                {k + 1}
                              </span>
                              {name}
                            </li>
                          ))}
                        </ol>
                      ) : (
                        <dl className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-abyss/10 bg-abyss/10 sm:mt-5 lg:mt-4">
                          {s.facts.map((f) => (
                            <div key={f.k} className="bg-white px-3 py-2.5 sm:px-4 sm:py-3 lg:py-2.5">
                              <dt className="text-[10px] uppercase tracking-widest text-mist sm:text-[11px]">{f.k}</dt>
                              <dd className="mt-1 font-display text-sm text-abyss">{f.v}</dd>
                            </div>
                          ))}
                        </dl>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          {/* НЭГ 3D canvas: харагдаж буй картуудын зургийн хэсэгт */}
          <JourneyStage3D
            driver={driver}
            tier={mode}
            onReadyChange={onThreeReady}
            onFallbackChange={setSvgFallback}
            bandRef={band}
            Scene3D={SewageScene3D}
            slotId="sewage-3d"
          />

          <p
            ref={hint}
            aria-hidden
            className="journey-hint pointer-events-none absolute bottom-16 left-1/2 flex -translate-x-1/2 items-center gap-2 whitespace-nowrap font-display text-[11px] uppercase tracking-[0.25em] text-mist"
          >
            {/* сум зүүн тийш: гадна талын span толин тусгана, дотор нь түлхэгдэх хөдөлгөөн */}
            <span className="inline-block -scale-x-100">
              <span className="journey-hint__arrow inline-block">→</span>
            </span>
            Гүйлгээд үзээрэй
          </p>
          <DripDots items={sewageJourney} active={active} label="Бохир ус цэвэршүүлэх шатууд" reverse />
        </div>
      </div>
    </section>
  );
}
