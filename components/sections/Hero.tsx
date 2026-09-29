"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const HeroWater = dynamic(() => import("@/components/three/HeroWater"), { ssr: false });

const words = ["ДАРХАН", "ХОТ"];

/**
 * Давхаргууд: тунгалаг ус (WebGL) → УС БҮХНИЙ ЭХЛЭЛ.
 * WebGL бэлэн болмогц HTML гарчиг нуугдаж, яг тэр байрлалд усан доор зурагдана.
 * WebGL ачаалагдах хүртэл (эсвэл дэмжихгүй бол) HTML гарчиг харагдана.
 */
export default function Hero() {
  const root = useRef<HTMLElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const scroll = useRef(0);
  const [webgl, setWebgl] = useState<{ reduced: boolean } | null>(null);
  const [ready, setReady] = useState(false);
  const [running, setRunning] = useState(true);

  useEffect(() => {
    setWebgl({ reduced: window.matchMedia("(prefers-reduced-motion: reduce)").matches });
    // Дэлгэцээс гарвал WebGL-ийг зогсооно
    const io = new IntersectionObserver(([e]) => setRunning(e.isIntersecting));
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

      // Scroll: бичиг дээш гарч бүдгэрнэ; ус руу шумбах нь scroll ref-ээр shader-т очно
      gsap
        .timeline({
          defaults: { ease: "none" },
          scrollTrigger: {
            trigger: root.current,
            start: "top top",
            end: "bottom top",
            scrub: true,
            onUpdate: (self) => {
              scroll.current = self.progress;
            },
          },
        })
        .to(".hero-p-title", { yPercent: 80, opacity: 0 }, 0);
    });
    mm.add("(prefers-reduced-motion: reduce)", () => {
      gsap.set(".hero-pre", { opacity: 1 });
    });
    return () => mm.revert();
  }, []);

  return (
    <section
      id="top"
      ref={root}
      className="hero-scene grain relative h-[100svh] min-h-[640px] overflow-hidden bg-[radial-gradient(ellipse_at_50%_40%,#e3f5fd_0%,#a9dcf5_55%,#6fbde6_100%)]"
    >
      {webgl && (
        <div aria-hidden className={`pointer-events-none absolute inset-0 transition-opacity duration-[1200ms] ${ready ? "opacity-100" : "opacity-0"}`}>
          <HeroWater title={title} scroll={scroll} reduced={webgl.reduced} running={running} onReady={() => setReady(true)} />
        </div>
      )}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[12%] bg-gradient-to-b from-transparent to-foam" />

      {/* УС БҮХНИЙ ЭХЛЭЛ / ДАРХАН ХОТ — WebGL үед гарчиг усан доор зурагдана */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-4 pb-[6svh] text-center">
        <div className="hero-p-title">
          <div className="hero-title hero-pre">
            <p className="hero-eyebrow mb-[calc(var(--u)*1.2)] font-display text-[11px] tracking-[0.4em] text-deep drop-shadow-[0_1px_12px_rgba(245,251,255,.9)] sm:text-sm">
              УС БҮХНИЙ ЭХЛЭЛ
            </p>
            <h1
              ref={title}
              aria-label="Дархан хот — Дархан Ус Суваг ОНӨААТҮГ"
              className={`font-display text-[length:min(calc(var(--u)*6.8),15vw)] font-bold leading-[0.95] tracking-tight transition-opacity duration-700 lg:text-[length:calc(var(--u)*9.5)] ${ready ? "opacity-0" : ""}`}
            >
              {words.map((w) => (
                <span key={w} aria-hidden className="block overflow-hidden whitespace-nowrap pt-[0.06em] lg:mx-[0.2em] lg:inline-block">
                  {Array.from(w).map((c, i) => (
                    <span key={i} className="hero-char inline-block bg-gradient-to-b from-abyss to-deep bg-clip-text text-transparent">
                      {c}
                    </span>
                  ))}
                </span>
              ))}
            </h1>
          </div>
        </div>
      </div>
    </section>
  );
}
