"use client";

import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { journey } from "@/lib/content";
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

export default function WaterJourney() {
  const root = useRef<HTMLElement>(null);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const ctx = gsap.context(() => {
      // Зүүн талын усны хоолой scroll-оор дүүрнэ
      gsap.to(".journey-fill", {
        scaleY: 1,
        ease: "none",
        scrollTrigger: { trigger: ".journey-stages", start: "top 60%", end: "bottom 60%", scrub: true },
      });

      gsap.utils.toArray<HTMLElement>(".journey-stage").forEach((el, i) => {
        ScrollTrigger.create({
          trigger: el,
          start: "top 55%",
          end: "bottom 55%",
          onToggle: (self) => self.isActive && setActive(i),
        });
        gsap.from(el.querySelectorAll(".stage-reveal"), {
          opacity: 0,
          y: 40,
          stagger: 0.08,
          duration: 1,
          ease: "power3.out",
          scrollTrigger: { trigger: el, start: "top 75%" },
        });
      });
    }, root);
    return () => ctx.revert();
  }, []);

  return (
    <section id="journey" ref={root} className="relative bg-abyss py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-8">
        <div className="mb-20 max-w-3xl">
          <p className="eyebrow mb-5">
            <span className="text-mist">02</span> — Water Journey
          </p>
          <h2 className="font-display text-4xl font-semibold leading-[1.05] sm:text-6xl md:text-7xl">
            УСНЫ <span className="text-water">АЯЛАЛ</span>
          </h2>
          <p className="mt-6 max-w-xl text-lg text-mist">
            Нэг дусал ус эх үүсвэрээс таны гэрийн цорго хүртэл хэрхэн аялдгийг дагаж яваарай.
          </p>
        </div>

        <div className="grid gap-10 lg:grid-cols-[220px_1fr]">
          {/* Sticky progress rail */}
          <aside className="hidden lg:block">
            <div className="sticky top-32 flex gap-6">
              <div className="relative w-[3px] rounded-full bg-white/5" style={{ height: 360 }}>
                <div className="journey-fill absolute inset-0 origin-top scale-y-0 rounded-full bg-gradient-to-b from-aqua to-water shadow-[0_0_16px_#3fd0ff]" />
              </div>
              <ol className="flex flex-col justify-between" style={{ height: 360 }}>
                {journey.map((s, i) => (
                  <li key={s.id}>
                    <a
                      href={`#stage-${s.id}`}
                      className={`block text-xs tracking-[0.2em] transition-all duration-500 ${
                        i === active ? "translate-x-1 text-water" : i < active ? "text-foam/60" : "text-foam/25"
                      }`}
                    >
                      <span className="mr-2 font-display">{String(i + 1).padStart(2, "0")}</span>
                      {s.label}
                    </a>
                  </li>
                ))}
              </ol>
            </div>
          </aside>

          <div className="journey-stages space-y-28 sm:space-y-40">
            {journey.map((s, i) => {
              const Visual = visuals[s.id];
              return (
                <article
                  key={s.id}
                  id={`stage-${s.id}`}
                  className="journey-stage grid items-center gap-10 md:grid-cols-2 md:gap-14"
                >
                  <div className={i % 2 ? "md:order-2" : ""}>
                    <p className="stage-reveal eyebrow mb-4">
                      {s.step} · {s.label}
                    </p>
                    <h3 className="stage-reveal font-display text-3xl font-semibold leading-tight sm:text-4xl">
                      {s.title}
                    </h3>
                    <p className="stage-reveal mt-5 text-mist">{s.lead}</p>
                    <dl className="stage-reveal mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-white/5">
                      {s.facts.map((f, fi) => (
                        <div
                          key={f.k}
                          className={`bg-deep/80 p-4 ${
                            s.facts.length % 2 && fi === s.facts.length - 1 ? "col-span-2" : ""
                          }`}
                        >
                          <dt className="text-[11px] uppercase tracking-widest text-mist">{f.k}</dt>
                          <dd className="mt-1 font-display text-sm text-foam">{f.v}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                  <div className="stage-reveal glass relative aspect-square w-full overflow-hidden rounded-3xl">
                    <Visual />
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
