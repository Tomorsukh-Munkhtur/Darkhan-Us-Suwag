"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { RENDER_PRIORITY, useRenderSlot } from "@/components/three/renderCoordinator";
import { hasWebGL2 } from "@/components/three/journey/utils/browser";

gsap.registerPlugin(ScrollTrigger);

const HeroWater = dynamic(() => import("@/components/three/HeroWater"), { ssr: false });

/** Гарчгийн мөрүүд: утсан дээр мөр бүр тусдаа, desktop дээр бүгд нэг мөрөнд */
const lines = [["ДАРХАН"], ["УС", "СУВАГ"]];

/**
 * Давхаргууд: тунгалаг ус (WebGL) → УС БҮХНИЙ ЭХЛЭЛ.
 * WebGL бэлэн болмогц HTML гарчиг нуугдаж, яг тэр байрлалд усан доор зурагдана.
 * WebGL ачаалагдах хүртэл (эсвэл дэмжихгүй бол) HTML гарчиг харагдана.
 *
 * Шумбалт: Hero 200svh замд sticky тул нэг дэлгэцийн турш тогтож ус руу шумбана.
 * WaterJourney -100svh-ээр дээш татагдсан тул энэ хугацаанд Hero-ийн ард доороос гарч ирээд,
 * Hero бүдгэрэхэд усаар дамжин тодорно (WaterJourney.tsx). Hero цайвар (.theme-light), усан доорх хэсэг dark,
 * аяллын дусал томорч нээсэн (DropReveal.tsx) дараах хэсгүүд дахин цайвар.
 */
export default function Hero() {
  const track = useRef<HTMLDivElement>(null);
  const root = useRef<HTMLElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const dive = useRef(0);
  const [webgl, setWebgl] = useState<{ reduced: boolean } | null>(null);
  const [ready, setReady] = useState(false);
  const [inView, setInView] = useState(true);
  const [dived, setDived] = useState(false);
  // Render зохицуулагч: Hero хамгийн өндөр priority — шумбаж байх хооронд Journey 3D хүлээнэ
  const heroAllowed = useRenderSlot("hero-water", RENDER_PRIORITY.heroWater, inView && !dived);

  useEffect(() => {
    // WebGL2 байхгүй бол canvas үүсгэхгүй (үүсгэвэл R3F алдаа шидэж хуудсыг унагана) — HTML гарчиг хэвээр харагдана
    if (hasWebGL2()) setWebgl({ reduced: window.matchMedia("(prefers-reduced-motion: reduce)").matches });
    // Дэлгэцээс гарвал WebGL-ийг зогсооно
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting));
    io.observe(root.current!);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      gsap
        .timeline({ defaults: { ease: "expo.out" } })
        // Зөвхөн дотроо анимацтай wrapper; бусад нь өөрсдийн fromTo-гоор гарч ирнэ
        .set(".hero-title", { opacity: 1 })
        .fromTo(".hero-char", { yPercent: 115 }, { yPercent: 0, duration: 1.3, stagger: 0.06 }, 0.5)
        .fromTo(
          ".hero-eyebrow",
          { opacity: 0, letterSpacing: "0.1em" },
          { opacity: 1, letterSpacing: "0.4em", duration: 1.8, ease: "power3.out" },
          0.8,
        );

      // Шумбалт: Hero тогтсон байх хугацаанд. Явц нь dive ref-ээр shader-т очно.
      // Бичиг жижгэрч бүдгэрэн живнэ → сүүлийн хагаст Hero бүдгэрч ард нь (мөн бараан) WaterJourney тодорно.
      gsap
        .timeline({
          defaults: { ease: "none" },
          scrollTrigger: {
            trigger: track.current,
            start: "top top",
            end: "bottom bottom",
            scrub: true,
            onUpdate: (self) => {
              dive.current = self.progress;
              setDived(self.progress > 0.995);
            },
          },
        })
        .to(".hero-p-title", { scale: 0.65, yPercent: 25, opacity: 0, filter: "blur(8px)", duration: 0.45 }, 0)
        .to(root.current, { autoAlpha: 0, duration: 0.45 }, 0.55);
    });
    mm.add("(prefers-reduced-motion: reduce)", () => {
      gsap.set(".hero-pre", { opacity: 1 });
    });
    return () => mm.revert();
  }, []);

  return (
    <div ref={track} className="relative z-10 motion-safe:h-[200svh]">
      <section
        id="top"
        ref={root}
        data-lens
        className="hero-scene theme-light grain sticky top-0 h-[100svh] min-h-[640px] overflow-hidden bg-[radial-gradient(ellipse_at_50%_40%,#e3f5fd_0%,#a9dcf5_55%,#6fbde6_100%)]"
      >
        {webgl && (
          <div aria-hidden className={`pointer-events-none absolute inset-0 transition-opacity duration-[1200ms] ${ready ? "opacity-100" : "opacity-0"}`}>
            <HeroWater title={title} dive={dive} reduced={webgl.reduced} running={heroAllowed} onReady={() => setReady(true)} />
          </div>
        )}

        {/* УС БҮХНИЙ ЭХЛЭЛ / ДАРХАН УС СУВАГ — WebGL үед гарчиг усан доор зурагдана */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-4 pb-[6svh] text-center">
          <div className="hero-p-title">
            <div className="hero-title hero-pre">
              <p className="hero-eyebrow mb-[calc(var(--u)*1.2)] font-display text-[11px] tracking-[0.4em] text-deep drop-shadow-[0_1px_12px_rgba(245,251,255,.9)] sm:text-sm">
                УС БҮХНИЙ ЭХЛЭЛ
              </p>
              <h1
                ref={title}
                aria-label="Дархан Ус Суваг ОНӨААТҮГ"
                className={`font-display text-[length:min(calc(var(--u)*6.8),15vw)] font-bold leading-[0.95] tracking-tight transition-opacity duration-700 lg:text-[length:calc(var(--u)*7.4)] ${ready ? "opacity-0" : ""}`}
              >
                {lines.map((ws) => (
                  <span key={ws.join(" ")} aria-hidden className="block whitespace-nowrap lg:inline">
                    {ws.map((w) => (
                      // үг бүр доороос гарч ирэх (overflow-hidden) — үсэг бүр hero-char
                      <span key={w} className="mx-[0.12em] inline-block overflow-hidden pt-[0.06em] lg:mx-[0.18em]">
                        {Array.from(w).map((c, i) => (
                          <span key={i} className="hero-char inline-block bg-gradient-to-b from-abyss to-deep bg-clip-text text-transparent">
                            {c}
                          </span>
                        ))}
                      </span>
                    ))}
                  </span>
                ))}
              </h1>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
