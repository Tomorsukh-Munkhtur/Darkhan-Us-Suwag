"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { journey } from "@/lib/content";
import { RENDER_PRIORITY, useRenderSlot } from "@/components/three/renderCoordinator";
import JourneyStage3D from "@/components/three/journey/JourneyStage3D";
import { createJourneyDriver } from "@/components/three/journey/runtime";
import { detectTier, readTierSignals, type QualityTier } from "@/components/three/journey/quality";
import { hasWebGL2 } from "@/components/three/journey/utils/browser";
import { computeJourneyViews, measureJourneyBand, type JourneyBand } from "@/components/three/journey/stageLayout";
import SectionHeading from "../ui/SectionHeading";
import DripDots from "./journey/DripDots";
import { REVEAL } from "./DropReveal";
import {
  ScrubDriver,
  SourceVisual,
  ExtractionVisual,
  TreatmentVisual,
  ReservoirVisual,
  NetworkVisual,
  HomeVisual,
} from "./journey/Visuals";

gsap.registerPlugin(ScrollTrigger);

const WaterSurface = dynamic(() => import("@/components/three/WaterSurface"), { ssr: false });

const visuals: Record<string, React.FC> = {
  source: SourceVisual,
  extraction: ExtractionVisual,
  treatment: TreatmentVisual,
  reservoir: ReservoirVisual,
  network: NetworkVisual,
  home: HomeVisual,
};

const pad = (n: number) => String(n).padStart(2, "0");
const N = journey.length;

/** ?journey3d=off|low|medium|high — QA ба статик (SVG) горим; бусад үед төхөөрөмжөөс тодорхойлно */
function journeyMode(): QualityTier | "off" {
  const q = new URLSearchParams(window.location.search).get("journey3d");
  if (q === "off") return "off";
  if (q === "high" || q === "medium" || q === "low") return q.toUpperCase() as QualityTier;
  return detectTier(readTierSignals());
}

/**
 * Усны аялал — хэвтээ аялал: самбар дэлгэц дээр тогтож (sticky), доош scroll хийхэд 6 шатны карт
 * нэг эгнээгээр зүүн тийш гулсана (бид баруун тийш аялна). Картуудын дээгүүр усны хоолой гүйж,
 * scroll хийх тусам ус урсаж дүүрнэ. Сүүлийн шатны дараа хуудаслалтын дусал томорч дараагийн (цайвар)
 * хэсгийг нээнэ (DropReveal.tsx), тэгээд хэвийн доош гүйлгэгдэнэ.
 */
export default function WaterJourney() {
  const root = useRef<HTMLElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const row = useRef<HTMLDivElement>(null);
  const pipe = useRef<HTMLDivElement>(null);
  const pipeFill = useRef<HTMLDivElement>(null);
  const hint = useRef<HTMLParagraphElement>(null);
  const cards = useRef<(HTMLElement | null)[]>([]);
  const anchors = useRef<(HTMLSpanElement | null)[]>([]);
  const dist = useRef(0);
  // хэвтээ аяллын босоо scroll-ын урт (px)
  const travel = useRef(0);
  // pos: 0 … N-1 — аль картын төвд байгаа (бутархай)
  const pos = useRef(0);
  const tls = useRef<(gsap.core.Timeline | null)[]>([]);
  const tlTarget = useRef<number[]>([]);
  const [active, setActive] = useState(0);
  const activeRef = useRef(0);
  // арын усны гадаргуу: зөвхөн хэсэг дэлгэцэн дээр байхад, render зохицуулагч зөвшөөрвөл зурна (LOW-д mount хийхгүй)
  const [surface, setSurface] = useState<{ reduced: boolean; mount: boolean } | null>(null);
  const [inView, setInView] = useState(false);
  const surfaceAllowed = useRenderSlot("water-surface", RENDER_PRIORITY.waterSurface, inView && !!surface?.mount);

  // 3D: НЭГ хуваалцсан canvas; харагдаж буй карт бүрийн зургийн хэсэгт тухайн үе шатыг зурна.
  // Хуучин SVG нь зөвхөн fallback (ачаалж байхад, WebGL байхгүй, алдаа, ?journey3d=off).
  const [driver] = useState(() => createJourneyDriver());
  const [mode, setMode] = useState<QualityTier | "off" | null>(null);
  const [threeReady, setThreeReady] = useState(false);
  // хуучин SVG зөвхөн 3D ажиллах боломжгүй үед; ачаалж байхад "loading" — SVG нуугдаж ачааллын дэвсгэр
  const [svgFallback, setSvgFallback] = useState(false);
  const threeLive = useRef(false);
  const band = useRef<HTMLDivElement | null>(null);
  const bandLayout = useRef<JourneyBand | null>(null);
  const slots = useRef<(HTMLDivElement | null)[]>([]);
  // эхний карт: хэсэг рүү орж ирэх scroll-ын явц (0 → 1)
  const entry = useRef(0);

  useEffect(() => {
    const m = journeyMode();
    setMode(m);
    // WebGL2 байхгүй бол WaterSurface үүсгэхгүй (R3F алдаа хуудсыг унагахаас сэргийлнэ)
    setSurface({ reduced: window.matchMedia("(prefers-reduced-motion: reduce)").matches, mount: m !== "LOW" && hasWebGL2() });
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting));
    io.observe(root.current!);
    return () => io.disconnect();
  }, []);

  // Картын зураг: карт баруунаас орж ирэх үеэс эхэлж, голд ирэхэд анимац нь дуусна.
  // 3D ажиллаж байхад SVG нуугдсан тул tween хийхгүй; fallback болоход бүгдийг дахин тааруулна.
  const driveVisual = (i: number) => {
    const tl = tls.current[i];
    if (!tl || threeLive.current) return;
    const target = gsap.utils.clamp(0, 1, pos.current - (i - 1));
    if (Math.abs(target - (tlTarget.current[i] ?? -1)) < 0.002) return;
    tlTarget.current[i] = target;
    gsap.to(tl, { progress: target, duration: 0.6, ease: "power1.out", overwrite: true });
  };
  const drivers = useMemo(
    () =>
      journey.map((_, i) => (tl: gsap.core.Timeline) => {
        tls.current[i] = tl;
        tlTarget.current[i] = -1;
        driveVisual(i);
        return () => {
          gsap.killTweensOf(tl);
          if (tls.current[i] === tl) tls.current[i] = null;
        };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const onThreeReady = useCallback((ready: boolean) => {
    threeLive.current = ready;
    setThreeReady(ready);
    if (!ready) {
      tlTarget.current = tlTarget.current.map(() => -1);
      for (let k = 0; k < N; k++) driveVisual(k);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // Хэмжээ: эхний картын төвөөс сүүлийн картын төв хүртэлх зай = хэвтээ аялал.
    // Босоо scroll-ын урт нь үүнтэй тэнцүү, гэхдээ шат бүрт дор хаяж 0.8 дэлгэц ногдоно (утсан дээр хэт хурдан биш).
    // Аяллын дараа REVEAL дэлгэцийн турш тогтсон хэвээр — энэ хугацаанд дусал томорч дараагийн хэсгийг нээнэ (DropReveal.tsx)
    const measure = () => {
      const first = cards.current[0]!;
      const last = cards.current[N - 1]!;
      const c0 = first.offsetLeft + first.offsetWidth / 2;
      dist.current = last.offsetLeft + last.offsetWidth / 2 - c0;
      const len = dist.current * Math.max(1, (0.8 * window.innerHeight) / (dist.current / (N - 1)));
      travel.current = len;
      const reveal = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : REVEAL * 100;
      track.current!.style.height = `calc(${100 + reveal}svh + ${len}px)`;
      anchors.current.forEach((a, i) => a && (a.style.top = `${(i / (N - 1)) * len}px`));
      // хоолой: эхний картын цэгээс сүүлийн картын цэг хүртэл
      const node = first.querySelector<HTMLElement>(".stage-node")!;
      const rowTop = row.current!.getBoundingClientRect().top;
      const r = node.getBoundingClientRect();
      pipe.current!.style.left = `${c0}px`;
      pipe.current!.style.width = `${dist.current}px`;
      pipe.current!.style.top = `${r.top - rowTop + r.height / 2}px`;
      // 3D canvas зурвас: картын зургийн хэсгийн өндөр × stage-ийн өргөн
      bandLayout.current = measureJourneyBand(row.current!, first, slots.current[0]!);
      if (band.current) {
        band.current.style.top = `${bandLayout.current.top}px`;
        band.current.style.height = `${bandLayout.current.height}px`;
      }
    };

    // Харагдаж буй карт бүрийн 3D view (байрлал, opacity, progress) — картын transform бичсэний дараа
    const syncViews = () => {
      if (!band.current || !bandLayout.current) return;
      driver.setViews(computeJourneyViews(pos.current, entry.current, band.current, cards.current, slots.current, bandLayout.current));
    };

    const update = (p: number) => {
      pos.current = p * (N - 1);
      row.current!.style.transform = `translate3d(${(-p * dist.current).toFixed(1)}px, 0, 0)`;
      pipeFill.current!.style.clipPath = `inset(0 ${((1 - p) * 100).toFixed(2)}% 0 0)`;
      // гол карт тод, хажуугийнх нь жижиг, бүдэг (цэгийн төвөөр жижгэрэх тул хоолой дээрээ үлдэнэ)
      cards.current.forEach((c, i) => {
        const a = Math.min(Math.abs(pos.current - i), 1);
        c!.style.transform = `scale(${(1 - 0.1 * a).toFixed(3)})`;
        c!.style.opacity = (1 - 0.6 * a).toFixed(3);
      });
      // "гүйлгээд аялаарай" сануулга: аялал эхлэхэд арилна
      hint.current!.style.opacity = gsap.utils.clamp(0, 1, 1 - pos.current * 2.5).toFixed(2);
      const i = Math.round(pos.current);
      if (i !== activeRef.current) {
        activeRef.current = i;
        setActive(i);
      }
      for (let k = 0; k < N; k++) driveVisual(k);
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
    // Эхний карт хэсэг рүү орж ирэх scroll-оор босно (аялал эхлэхэд 1)
    const onEntry = (self: ScrollTrigger) => {
      entry.current = self.progress;
      syncViews();
    };
    const entrySt = ScrollTrigger.create({
      trigger: track.current,
      start: "top bottom",
      end: "top top",
      onUpdate: onEntry,
      onRefresh: onEntry,
    });
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
    // фонт ачаалагдахад хэмжээ өөрчлөгдөнө (энэ үед компонент салсан байж болно — StrictMode)
    let alive = true;
    document.fonts.ready.then(() => alive && refresh());

    const mm = gsap.matchMedia();
    mm.add(
      "(prefers-reduced-motion: no-preference)",
      () => {
        // Hero-ийн ард доороос гарч ирэх үед (Hero шумбаж байхад) гарчиг усаар дамжин
        // долгиолж бүдэг харагдаад, Hero бүдгэрэхийн хэрээр тодорно.
        const head = root.current!.querySelector<HTMLElement>(".journey-head")!;
        const turb = root.current!.querySelector("#journey-water feTurbulence")!;
        const disp = root.current!.querySelector("#journey-water feDisplacementMap")!;
        ScrollTrigger.create({
          trigger: root.current,
          start: "top bottom",
          end: "top top",
          onUpdate: (self) => {
            const e = gsap.utils.clamp(0, 1, (1 - self.progress) / 0.5) ** 2;
            disp.setAttribute("scale", (70 * e).toFixed(1));
            turb.setAttribute("baseFrequency", `0.008 ${(0.02 + 0.02 * e).toFixed(4)}`);
            head.style.filter = e > 0.001 ? `url(#journey-water) blur(${(6 * e).toFixed(2)}px)` : "";
            head.style.opacity = String(1 - 0.4 * e);
          },
        });
      },
      root,
    );

    return () => {
      alive = false;
      clearTimeout(t);
      window.removeEventListener("resize", onResize);
      st.kill();
      entrySt.kill();
      mm.revert();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    // motion-safe:-mt-[100svh]: Hero-ийн шумбах замын ард байрлана (Hero.tsx)
    <section
      id="journey"
      ref={root}
      data-journey-3d={threeReady ? "on" : svgFallback ? undefined : "loading"}
      className="relative bg-foam pt-24 [clip-path:inset(0)] motion-safe:-mt-[100svh] sm:pt-32"
    >
      {/* арын бүдэг усны гадаргуу (Hero-гийн усны бүдэг хувилбар): caustic тор, давалгаа, хулганы долгио.
          3D ажиллаж байхад зохицуулагч зогсооно → demand горимоор нэг кадр зураад хөлдөнө */}
      <div aria-hidden className="water-pattern">
        {surface?.mount && <WaterSurface running={surfaceAllowed} reduced={surface.reduced || !surfaceAllowed} />}
      </div>
      <svg aria-hidden className="absolute h-0 w-0">
        <filter id="journey-water">
          <feTurbulence type="fractalNoise" baseFrequency="0.008 0.04" numOctaves={2} seed={3} />
          <feDisplacementMap in="SourceGraphic" scale={0} xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </svg>
      <div className="journey-head mx-auto max-w-7xl px-4 sm:px-8">
        <SectionHeading
          eyebrow="Water Journey"
          align="center"
          title={
            <>
              УСНЫ <span className="text-water">АЯЛАЛ</span>
            </>
          }
          lead="Нэг дусал ус эх үүсвэрээс таны гэрийн цорго хүртэл хэрхэн аялдгийг дагаж яваарай."
        />
      </div>

      {/* Босоо scroll → хэвтээ аялал; өндрийг measure() тооцно (эхний утга нь ойролцоо) */}
      <div ref={track} className="relative" style={{ height: `calc(100svh + ${(N - 1) * 90}vw)` }}>
        {journey.map((st, i) => (
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
          {/* --card: картын өргөн. Зай нь өргөн тул хөрш картууд хажуугаас бүдэг цухуйна (lg+) */}
          <div
            ref={row}
            className="relative flex items-stretch gap-[12vw] px-[calc((100%-var(--card))/2)] will-change-transform [--card:84vw] md:gap-[10vw] md:[--card:72vw] lg:[--card:min(70vw,920px)]"
          >
            {/* картуудыг холбох усны хоолой: scroll хийх тусам ус урсаж дүүрнэ */}
            <div ref={pipe} aria-hidden className="journey-pipe">
              <div ref={pipeFill} className="journey-pipe__fill" />
            </div>

            {journey.map((s, i) => {
              const Visual = visuals[s.id];
              return (
                <article
                  key={s.id}
                  ref={(el) => {
                    cards.current[i] = el;
                  }}
                  aria-label={`${pad(i + 1)} / ${pad(N)} ${s.label}`}
                  className="relative flex w-(--card) shrink-0 origin-[50%_7px] flex-col"
                >
                  {/* хажуугийн карт дээр дарахад тэр шат руу очно (хуудаслалтын цэгүүд нь үндсэн навигаци) */}
                  {i !== active && (
                    <a href={`#stage-${s.id}`} tabIndex={-1} aria-hidden className="absolute inset-0 z-10 cursor-pointer" />
                  )}
                  <header className="mb-4 flex flex-col items-center text-center sm:mb-6">
                    <span className="stage-node" data-lit={i <= active} />
                    <p className="mt-3 font-display text-[11px] tracking-[0.3em] text-mist">
                      {pad(i + 1)} / {pad(N)}
                    </p>
                    <h3 className="mt-1 text-h3 tracking-[0.08em]">{s.label}</h3>
                  </header>

                  {/* --vis: зургийн баганын өргөн = картын өндрийн доод хязгаар, тэгэхээр дөрвөлжин SVG хоосон зурвасгүй дүүрнэ */}
                  <div className="glass grid flex-1 grid-rows-[auto_1fr] overflow-hidden rounded-3xl border-water/30! [--vis:min(400px,50svh)] lg:grid-cols-[var(--vis)_1fr] lg:grid-rows-[1fr]">
                    <div
                      ref={(el) => {
                        slots.current[i] = el;
                      }}
                      className="journey-visual relative h-[clamp(7.5rem,20svh,13rem)] overflow-hidden border-b border-abyss/10 lg:h-auto lg:min-h-(--vis) lg:border-b-0 lg:border-r [&>svg]:absolute [&>svg]:inset-0"
                    >
                      <ScrubDriver.Provider value={drivers[i]}>
                        <Visual />
                      </ScrubDriver.Provider>
                    </div>
                    <div className="flex flex-col justify-center p-5 sm:p-8 lg:px-10 lg:py-7">
                      <p className="font-display text-h4 font-bold text-deep">{s.title}</p>
                      <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-abyss/75 sm:mt-3 sm:line-clamp-none sm:text-base lg:text-[1.0625rem]">
                        {s.lead}
                      </p>
                      <dl className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-abyss/10 bg-abyss/10 sm:mt-5 lg:mt-4">
                        {s.facts.map((f, fi) => (
                          <div
                            key={f.k}
                            className={`bg-white px-3 py-2.5 sm:px-4 sm:py-3 lg:py-2.5 ${s.facts.length % 2 && fi === s.facts.length - 1 ? "col-span-2" : ""}`}
                          >
                            <dt className="text-[10px] uppercase tracking-widest text-mist sm:text-[11px]">{f.k}</dt>
                            <dd className="mt-1 font-display text-sm text-abyss">{f.v}</dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          {/* НЭГ 3D canvas: харагдаж буй картуудын зүүн (зургийн) хэсэгт; layout-аас гадуур (absolute) */}
          <JourneyStage3D driver={driver} tier={mode} onReadyChange={onThreeReady} onFallbackChange={setSvgFallback} bandRef={band} />

          <p
            ref={hint}
            aria-hidden
            className="journey-hint pointer-events-none absolute bottom-16 left-1/2 flex -translate-x-1/2 items-center gap-2 whitespace-nowrap font-display text-[11px] uppercase tracking-[0.25em] text-mist"
          >
            Гүйлгээд аялаарай <span className="journey-hint__arrow">→</span>
          </p>
          <DripDots items={journey} active={active} />
        </div>
      </div>
    </section>
  );
}
