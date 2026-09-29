"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { journey } from "@/lib/content";
import SectionHeading from "../ui/SectionHeading";
import DripDots from "./journey/DripDots";
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
/** Нэг шатанд ногдох scroll (svh) */
const STAGE_SVH = 80;

/**
 * Усны аялал — нэг бүхэл хэсэг: самбар дэлгэц дээр тогтож (sticky), scroll хийх тусам 6 шат
 * нэг картан дотор солигдоно. Шат солигдоход ус картыг доороос угааж өнгөрнө, баруун талд дусал дусна.
 */
export default function WaterJourney() {
  const root = useRef<HTMLElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const wave = useRef<HTMLDivElement>(null);
  // active: scroll-оор тодорхойлогдох шат (цэгүүд); shown: картан дээр харагдаж буй шат (усан шилжилтийн дараа)
  const [active, setActive] = useState(0);
  const [shown, setShown] = useState(0);
  const progress = useRef(0);
  const activeRef = useRef(0);
  const shownRef = useRef(0);
  const busy = useRef(false);
  const visualTl = useRef<gsap.core.Timeline | null>(null);
  // арын усны гадаргуу: зөвхөн хэсэг дэлгэцэн дээр байхад л зурна
  const [surface, setSurface] = useState<{ reduced: boolean } | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    setSurface({ reduced: window.matchMedia("(prefers-reduced-motion: reduce)").matches });
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting));
    io.observe(root.current!);
    return () => io.disconnect();
  }, []);

  // Харагдаж буй шатны зураг: тухайн шатны эхний 75%-д анимац нь дуусна
  const visualTarget = () => gsap.utils.clamp(0, 1, (progress.current * N - shownRef.current) / 0.75);
  const drive = useCallback((tl: gsap.core.Timeline) => {
    visualTl.current = tl;
    gsap.to(tl, { progress: visualTarget(), duration: 1.2, ease: "power2.out", overwrite: true });
    return () => {
      gsap.killTweensOf(tl);
      if (visualTl.current === tl) visualTl.current = null;
    };
  }, []);

  useEffect(() => {
    const st = ScrollTrigger.create({
      trigger: track.current,
      start: "top top",
      end: "bottom bottom",
      onUpdate: (self) => {
        progress.current = self.progress;
        const i = Math.min(N - 1, Math.floor(self.progress * N + 1e-6));
        if (i !== activeRef.current) {
          activeRef.current = i;
          setActive(i);
        }
        if (visualTl.current) gsap.to(visualTl.current, { progress: visualTarget(), duration: 0.6, ease: "power1.out", overwrite: true });
      },
    });

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
      st.kill();
      mm.revert();
    };
  }, []);

  // Шат солигдоход: ус картыг бүрхэх агшинд агуулга солигдоно. Хурдан гүйлгэвэл сүүлийн шат руу шууд очно.
  useEffect(() => {
    const run = () => {
      const target = activeRef.current;
      if (target === shownRef.current) return;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        shownRef.current = target;
        setShown(target);
        return;
      }
      busy.current = true;
      const down = target > shownRef.current;
      gsap
        .timeline({
          onComplete: () => {
            busy.current = false;
            run();
          },
        })
        // y: 0 — CSS-ийн translateY(105%)-ийг GSAP px болгож хадгалдаг тул цэвэрлэнэ (зөвхөн yPercent-ээр хөдөлнө)
        .set(wave.current, { y: 0, yPercent: down ? 105 : -105, scaleY: down ? 1 : -1 })
        .to(wave.current, { yPercent: 0, duration: 0.45, ease: "power2.in" })
        .add(() => {
          shownRef.current = activeRef.current;
          setShown(activeRef.current);
        })
        .to(wave.current, { yPercent: down ? -105 : 105, duration: 0.6, ease: "power2.out" }, "+=0.06");
    };
    if (!busy.current) run();
  }, [active]);

  // Шинэ шатны нэр үсэг үсгээр, агуулга дараалан гарна
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = gsap.context(() => {
      gsap
        .timeline()
        .fromTo(".stage-char", { yPercent: 110 }, { yPercent: 0, duration: 0.8, ease: "expo.out", stagger: 0.03 })
        .fromTo(".stage-reveal", { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.6, ease: "power3.out", stagger: 0.06 }, 0.1);
    }, root);
    return () => ctx.revert();
  }, [shown]);

  const s = journey[shown];
  const Visual = visuals[s.id];

  return (
    // motion-safe:-mt-[100svh]: Hero-ийн шумбах замын ард байрлана (Hero.tsx)
    <section id="journey" ref={root} className="relative bg-foam pt-24 [clip-path:inset(0)] motion-safe:-mt-[100svh] sm:pt-32">
      {/* арын бүдэг усны гадаргуу (Hero-гийн усны бүдэг хувилбар): caustic тор, давалгаа, хулганы долгио */}
      <div aria-hidden className="water-pattern">
        {surface && <WaterSurface running={inView} reduced={surface.reduced} />}
      </div>
      <svg aria-hidden className="absolute h-0 w-0">
        <filter id="journey-water">
          <feTurbulence type="fractalNoise" baseFrequency="0.008 0.04" numOctaves={2} seed={3} />
          <feDisplacementMap in="SourceGraphic" scale={0} xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </svg>
      <div className="journey-head mx-auto max-w-7xl px-4 sm:px-8">
        <SectionHeading
          index="02"
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

      {/* Шат бүрт STAGE_SVH scroll; самбар нь энэ замын турш тогтоно */}
      <div ref={track} className="relative" style={{ height: `calc(${N} * ${STAGE_SVH}svh + 100svh)` }}>
        {journey.map((st, i) => (
          <span key={st.id} id={`stage-${st.id}`} aria-hidden className="absolute left-0 w-px" style={{ top: `calc(${i + 0.3} * ${STAGE_SVH}svh)` }} />
        ))}

        <div className="sticky top-0 flex h-[100svh] flex-col items-center justify-center px-4 pt-16 sm:px-8 sm:pt-20">
          <header className="mb-3 text-center sm:mb-6">
            <p className="stage-count font-display text-[11px] tracking-[0.3em] text-mist">
              {pad(shown + 1)} / {pad(N)}
            </p>
            <h3 aria-label={s.label} aria-live="polite" className="mt-2 text-h3 tracking-[0.08em]">
              <span aria-hidden className="inline-block overflow-hidden pb-1 align-bottom">
                {Array.from(s.label).map((c, ci) => (
                  <span key={`${shown}-${ci}`} className="stage-char inline-block whitespace-pre">
                    {c}
                  </span>
                ))}
              </span>
            </h3>
          </header>

          <div className="glass relative w-full max-w-5xl overflow-hidden rounded-3xl border-water/30!">
            <div className="grid md:grid-cols-[min(420px,46svh)_1fr]">
              <div className="relative h-[clamp(8.5rem,23svh,15rem)] w-full overflow-hidden border-b border-abyss/10 md:aspect-square md:h-auto md:border-b-0 md:border-r">
                <ScrubDriver.Provider value={drive}>
                  <Visual key={s.id} />
                </ScrubDriver.Provider>
              </div>
              <div className="flex flex-col justify-center p-4 sm:p-10">
                <p className="stage-reveal line-clamp-4 text-sm leading-relaxed text-abyss/80 sm:line-clamp-none sm:text-lg">{s.lead}</p>
                <dl className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-abyss/10 bg-abyss/10 sm:mt-8">
                  {s.facts.map((f, fi) => (
                    <div
                      key={`${shown}-${f.k}`}
                      className={`stage-reveal bg-white px-3 py-2.5 sm:p-4 ${s.facts.length % 2 && fi === s.facts.length - 1 ? "col-span-2" : ""}`}
                    >
                      <dt className="text-[11px] uppercase tracking-widest text-mist">{f.k}</dt>
                      <dd className="mt-1 font-display text-sm text-abyss">{f.v}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </div>
            <div className="stage-reveal border-t border-abyss/10 bg-white/60 px-6 py-2.5 text-center sm:py-6">
              <p className="text-h4 font-bold">{s.title}</p>
            </div>

            {/* Шат солигдоход картыг угаах ус: долгиолсон орой + гүн цэнхэр бие */}
            <div ref={wave} aria-hidden className="stage-wave">
              <svg viewBox="0 0 1200 28" preserveAspectRatio="none" className="stage-wave__crest">
                <path d="M0 14q50-14 100 0t100 0 100 0 100 0 100 0 100 0 100 0 100 0 100 0 100 0 100 0 100 0V28H0Z" fill="#2aa3e0" />
                <path d="M0 14q50-14 100 0t100 0 100 0 100 0 100 0 100 0 100 0 100 0 100 0 100 0 100 0 100 0" fill="none" stroke="#bfeaff" strokeOpacity=".7" strokeWidth="2" />
              </svg>
              <div className="stage-wave__body" />
            </div>
          </div>

          <DripDots items={journey} active={active} />
        </div>
      </div>
    </section>
  );
}
