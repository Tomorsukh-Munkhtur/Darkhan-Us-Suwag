"use client";

import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { journey } from "@/lib/content";
import SectionHeading from "../ui/SectionHeading";
import {
  SourceVisual,
  ExtractionVisual,
  TreatmentVisual,
  ReservoirVisual,
  NetworkVisual,
  HomeVisual,
} from "./journey/Visuals";

gsap.registerPlugin(ScrollTrigger);

const visuals: Record<string, React.FC> = {
  source: SourceVisual,
  extraction: ExtractionVisual,
  treatment: TreatmentVisual,
  reservoir: ReservoirVisual,
  network: NetworkVisual,
  home: HomeVisual,
};

const pad = (n: number) => String(n).padStart(2, "0");

export default function WaterJourney() {
  const root = useRef<HTMLElement>(null);
  const [active, setActive] = useState(0);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const ctx = gsap.context(() => {
      // Баруун талын цэгүүд: харагдах эсэх + идэвхтэй шат
      ScrollTrigger.create({
        trigger: ".journey-stages",
        start: "top center",
        end: "bottom center",
        onToggle: (self) => setInView(self.isActive),
      });
      gsap.utils.toArray<HTMLElement>(".journey-stage").forEach((el, i) => {
        ScrollTrigger.create({
          trigger: el,
          start: "top center",
          end: "bottom center",
          onToggle: (self) => self.isActive && setActive(i),
        });
      });
    }, root);

    const mm = gsap.matchMedia();
    mm.add(
      "(prefers-reduced-motion: no-preference)",
      () => {
        gsap.utils.toArray<HTMLElement>(".journey-stage").forEach((el) => {
          const q = gsap.utils.selector(el);

          // Шатны нэр үсэг үсгээр гарч, дараа нь картын агуулга дараалан гарна
          gsap
            .timeline({ scrollTrigger: { trigger: el, start: "top 70%", toggleActions: "play none none reverse" } })
            .from(q(".stage-char"), { yPercent: 110, duration: 0.9, ease: "expo.out", stagger: 0.035 })
            .from(q(".stage-count"), { opacity: 0, y: 10, duration: 0.6 }, 0)
            .from(q(".stage-reveal"), { opacity: 0, y: 24, duration: 0.8, ease: "power3.out", stagger: 0.07 }, 0.25)
            .from(q(".stage-next"), { opacity: 0, y: -12, duration: 0.6 }, 0.6);

          // Карт доороос 3D-ээр өргөгдөж голд тодорно, гарахдаа бага зэрэг холдоно
          gsap
            .timeline({ scrollTrigger: { trigger: el, start: "top bottom", end: "bottom top", scrub: 0.6 } })
            .fromTo(
              q(".stage-card"),
              { y: 120, scale: 0.9, rotationX: 14, opacity: 0.25, transformPerspective: 1200 },
              { y: 0, scale: 1, rotationX: 0, opacity: 1, ease: "power2.out", duration: 1 },
            )
            .to({}, { duration: 0.5 })
            .to(q(".stage-card"), { y: -40, scale: 0.96, opacity: 0.55, ease: "power1.in", duration: 1 });
        });
      },
      root,
    );

    return () => {
      mm.revert();
      ctx.revert();
    };
  }, []);

  return (
    <section id="journey" ref={root} className="relative bg-foam pt-24 sm:pt-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-8">
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

      {/* Баруун талын шатны цэгүүд */}
      <nav
        aria-label="Усны аяллын шатууд"
        className={`fixed right-4 top-1/2 z-30 hidden -translate-y-1/2 flex-col items-end gap-3.5 transition-opacity duration-500 md:flex lg:right-8 ${
          inView ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        {journey.map((s, i) => (
          <a
            key={s.id}
            href={`#stage-${s.id}`}
            aria-label={s.label}
            aria-current={i === active ? "step" : undefined}
            className="group relative flex h-4 w-4 items-center justify-center"
          >
            <span className="pointer-events-none absolute right-7 whitespace-nowrap rounded-full bg-white px-3 py-1 font-display text-[10px] tracking-[0.2em] text-abyss opacity-0 shadow-md shadow-abyss/10 transition group-hover:opacity-100">
              {s.label}
            </span>
            <span
              className={`block rounded-full transition-all duration-500 ${
                i === active
                  ? "h-4 w-4 bg-water shadow-[0_0_0_5px_rgba(0,120,190,.15)]"
                  : "h-3 w-3 bg-abyss/15 group-hover:bg-abyss/35"
              }`}
            />
          </a>
        ))}
      </nav>

      <div className="journey-stages">
        {journey.map((s, i) => {
          const Visual = visuals[s.id];
          const next = journey[i + 1];
          return (
            <article
              key={s.id}
              id={`stage-${s.id}`}
              className="journey-stage flex min-h-[100svh] flex-col items-center justify-center px-4 py-24 sm:px-8"
            >
              <header className="mb-6 text-center sm:mb-8">
                <p className="stage-count font-display text-[11px] tracking-[0.3em] text-mist">
                  {pad(i + 1)} / {pad(journey.length)}
                </p>
                <h3 aria-label={s.label} className="mt-2 font-display text-2xl font-semibold tracking-[0.12em] sm:text-4xl">
                  <span aria-hidden className="inline-block overflow-hidden pb-1 align-bottom">
                    {Array.from(s.label).map((c, ci) => (
                      <span key={ci} className="stage-char inline-block whitespace-pre">
                        {c}
                      </span>
                    ))}
                  </span>
                </h3>
              </header>

              <div className="stage-card glass w-full max-w-5xl overflow-hidden rounded-3xl border-water/30!">
                <div className="grid md:grid-cols-[min(420px,48svh)_1fr]">
                  <div className="relative aspect-square w-full overflow-hidden border-b border-abyss/10 md:border-b-0 md:border-r">
                    <Visual />
                  </div>
                  <div className="flex flex-col justify-center p-6 sm:p-10">
                    <p className="stage-reveal leading-relaxed text-abyss/80 sm:text-lg">{s.lead}</p>
                    <dl className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-abyss/10 bg-abyss/10 sm:mt-8">
                      {s.facts.map((f, fi) => (
                        <div
                          key={f.k}
                          className={`stage-reveal bg-white p-4 ${
                            s.facts.length % 2 && fi === s.facts.length - 1 ? "col-span-2" : ""
                          }`}
                        >
                          <dt className="text-[11px] uppercase tracking-widest text-mist">{f.k}</dt>
                          <dd className="mt-1 font-display text-sm text-abyss">{f.v}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                </div>
                <div className="stage-reveal border-t border-abyss/10 bg-white/60 px-6 py-5 text-center sm:py-7">
                  <p className="font-display text-xl font-semibold sm:text-3xl">{s.title}</p>
                </div>
              </div>

              <a
                href={next ? `#stage-${next.id}` : "#services"}
                aria-label={next ? `Дараагийн шат: ${next.label}` : "Дараагийн хэсэг"}
                className="stage-next mt-8 grid h-14 w-14 place-items-center rounded-full text-water transition-colors hover:bg-water/10"
              >
                <svg width="28" height="24" viewBox="0 0 28 24" className="animate-nudge" aria-hidden>
                  <path
                    d="M3 3h22L14 21Z"
                    fill="currentColor"
                    fillOpacity=".12"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinejoin="round"
                  />
                </svg>
              </a>
            </article>
          );
        })}
      </div>
    </section>
  );
}
