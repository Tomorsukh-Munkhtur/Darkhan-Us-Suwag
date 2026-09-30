"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { services } from "@/lib/content";
import SectionHeading from "../ui/SectionHeading";
import SupplyVisual3D from "@/components/three/faucet/SupplyVisual3D";
import SewerVisual3D from "@/components/three/sewer/SewerVisual3D";
import TreatmentVisual3D from "@/components/three/treatment/TreatmentVisual3D";

gsap.registerPlugin(ScrollTrigger);

const arts: Record<string, React.FC<{ className?: string }>> = {
  // цорго → шилэн аяга, газар доорх татуургын огтлол, цэвэрлэх байгууламж: 3D (SVG нь зөвхөн fallback)
  supply: SupplyVisual3D,
  sewer: SewerVisual3D,
  treatment: TreatmentVisual3D,
};

function Drop() {
  return (
    <svg width="12" height="15" viewBox="0 0 14 18" className="shrink-0" aria-hidden>
      <path d="M7 0C7 0 0 8 0 11.5C0 15.1 3.1 18 7 18S14 15.1 14 11.5C14 8 7 0 7 0Z" fill="#38b6f0" />
    </svg>
  );
}

/** Зигзаг мөрүүд: зураг ↔ текст ээлжилнэ. Зураг хажуунаас нээгдэж, текст зураг руу чиглэн орж ирнэ. */
export default function Services() {
  const root = useRef<HTMLElement>(null);

  useEffect(() => {
    const mm = gsap.matchMedia();
    mm.add(
      "(prefers-reduced-motion: no-preference)",
      () => {
        gsap.utils.toArray<HTMLElement>(".svc-row").forEach((row) => {
          const q = gsap.utils.selector(row);
          const flip = row.dataset.flip === "true";
          const dir = flip ? 1 : -1;

          gsap
            .timeline({ scrollTrigger: { trigger: row, start: "top 78%", once: true } })
            .fromTo(
              q(".svc-img"),
              { clipPath: flip ? "inset(0% 0% 0% 100%)" : "inset(0% 100% 0% 0%)" },
              { clipPath: "inset(0% 0% 0% 0%)", duration: 1.3, ease: "expo.inOut" },
            )
            // Эцсийн утгыг тодорхой заана: .svc-num дээр scroll parallax (y) давхар ажилладаг
            .fromTo(q(".svc-zoom"), { scale: 1.3 }, { scale: 1, duration: 1.8, ease: "expo.out" }, 0)
            .fromTo(q(".svc-label"), { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, ease: "power3.out" }, 0.9)
            .fromTo(q(".svc-num"), { opacity: 0, x: 80 * dir }, { opacity: 1, x: 0, duration: 1.4, ease: "expo.out" }, 0.2)
            .fromTo(
              q(".svc-reveal"),
              { opacity: 0, x: 40 * dir },
              { opacity: 1, x: 0, duration: 0.9, ease: "power3.out", stagger: 0.08 },
              0.4,
            );

          // Parallax: зураг доторх дүрслэл ба том дугаар өөр хурдаар хөдөлнө
          const scrub = { trigger: row, start: "top bottom", end: "bottom top", scrub: true };
          gsap.fromTo(q(".svc-par"), { yPercent: -6 }, { yPercent: 6, ease: "none", scrollTrigger: scrub });
          gsap.fromTo(q(".svc-num"), { y: 60 }, { y: -60, ease: "none", scrollTrigger: scrub });
        });
      },
      root,
    );
    return () => mm.revert();
  }, []);

  return (
    <section id="services" ref={root} className="relative overflow-hidden bg-shallow py-24 sm:py-32">
      <div className="mx-auto max-w-6xl px-4 sm:px-8">
        <SectionHeading
          index="03"
          eyebrow="Ус эхэлнэ · Ус буцна · Бид цэвэршүүлнэ"
          align="center"
          title={
            <>
              БИДНИЙ <span className="text-water">ҮЙЛ АЖИЛЛАГАА</span>
            </>
          }
          lead="Дархан Ус Суваг нь хотын усны бүтэн циклийг — эх үүсвэрээс хэрэглэгч хүртэл, хэрэглэгчээс байгаль руу — хариуцан ажилладаг."
        />

        <div className="mt-16 space-y-20 sm:mt-24 sm:space-y-32">
          {services.map((s, i) => {
            const Art = arts[s.id];
            const flip = i % 2 === 1;
            return (
              <article
                key={s.id}
                data-flip={flip}
                className={`svc-row grid items-center gap-8 md:gap-14 ${
                  flip ? "md:grid-cols-[1fr_1.25fr]" : "md:grid-cols-[1.25fr_1fr]"
                }`}
              >
                <div
                  className={`svc-img group relative aspect-[16/11] overflow-hidden rounded-3xl border border-abyss/10 bg-white shadow-[0_24px_60px_-30px_rgba(4,33,58,.35)] ${
                    flip ? "md:order-2" : ""
                  }`}
                >
                  <div className="svc-par absolute inset-x-0 -inset-y-[8%]">
                    <div className="svc-zoom h-full w-full">
                      <Art className="block h-full w-full transition-transform duration-700 ease-out group-hover:scale-105" />
                    </div>
                  </div>
                  {/* hover үед доороос ус дүүрнэ */}
                  <div className="pointer-events-none absolute inset-0 translate-y-full bg-gradient-to-t from-aqua/35 via-aqua/10 to-transparent transition-transform duration-700 ease-[cubic-bezier(.22,1,.36,1)] group-hover:translate-y-0" />
                  <span className="svc-label absolute bottom-4 left-4 rounded-full bg-white/85 px-4 py-2 font-display text-xs font-semibold tracking-[0.15em] shadow-sm backdrop-blur sm:bottom-6 sm:left-6 sm:text-sm">
                    {s.title}
                  </span>
                </div>

                <div className={`relative ${flip ? "md:order-1 md:text-right" : ""}`}>
                  <span
                    aria-hidden
                    className={`svc-num pointer-events-none absolute -top-14 font-display text-[6.5rem] font-bold leading-none text-transparent [-webkit-text-stroke:1.5px_rgba(0,120,190,.2)] sm:-top-20 sm:text-[9rem] ${
                      flip ? "left-0 md:left-auto md:right-0" : "left-0"
                    }`}
                  >
                    {s.n}
                  </span>
                  <p className="svc-reveal relative font-display text-xs tracking-[0.3em] text-water">
                    {s.n} · {s.tag}
                  </p>
                  <p className="svc-reveal relative mt-4 leading-relaxed text-abyss/80">{s.text}</p>
                  <ul className="relative mt-6 space-y-2.5">
                    {s.points.map((p) => (
                      <li key={p} className={`svc-reveal flex items-center gap-3 text-sm font-medium ${flip ? "md:flex-row-reverse" : ""}`}>
                        <Drop />
                        {p}
                      </li>
                    ))}
                  </ul>
                  <a
                    href="#customer"
                    className="svc-reveal relative mt-8 inline-flex items-center gap-2 text-sm font-semibold text-water transition-[gap] hover:gap-3"
                  >
                    Дэлгэрэнгүй <span aria-hidden>→</span>
                  </a>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
