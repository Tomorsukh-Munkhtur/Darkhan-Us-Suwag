"use client";

import { useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const WaterSurface = dynamic(() => import("../three/WaterSurface"), { ssr: false });

const lines = ["УС БҮХНИЙ", "ЭХЛЭЛ"];

export default function Hero() {
  const root = useRef<HTMLElement>(null);
  const scroll = useRef(0);

  useEffect(() => {
    const ctx = gsap.context(() => {
      // typography fade-in
      gsap.from(".hero-char", {
        yPercent: 60,
        opacity: 0,
        filter: "blur(12px)",
        duration: 1.2,
        ease: "expo.out",
        stagger: 0.035,
        delay: 0.2,
      });
      gsap.from(".hero-fade", { opacity: 0, y: 20, duration: 1, stagger: 0.12, delay: 0.9, ease: "power3.out" });

      // scroll хийхэд ус доош урсана
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: root.current,
          start: "top top",
          end: "bottom top",
          scrub: true,
          onUpdate: (self) => (scroll.current = self.progress),
        },
      });
      tl.to(".hero-content", { yPercent: -30, opacity: 0, ease: "none" }, 0)
        .to(".hero-drop", { y: "55vh", scale: 1.4, ease: "power1.in" }, 0)
        .to(".hero-stream", { scaleY: 1, ease: "none" }, 0.1);
    }, root);
    return () => ctx.revert();
  }, []);

  return (
    <section id="top" ref={root} className="grain relative h-[100svh] min-h-[640px] overflow-hidden">
      <div className="absolute inset-0 bg-abyss">
        <WaterSurface scrollRef={scroll} />
      </div>
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-abyss/40 via-transparent to-abyss" />

      <div className="hero-content relative z-10 mx-auto flex h-full max-w-7xl flex-col justify-center px-4 sm:px-8">
        <p className="hero-fade eyebrow mb-6">Дархан Ус Суваг ОНӨААТҮГ</p>
        <h1 className="font-display text-[12.5vw] font-bold leading-[1] tracking-tight text-glow sm:text-[10vw] lg:text-[8.5rem]">
          {lines.map((l) => (
            <span key={l} className="block whitespace-nowrap pb-2">
              {Array.from(l).map((c, i) => (
                <span key={i} className="hero-char inline-block whitespace-pre">
                  {c}
                </span>
              ))}
            </span>
          ))}
        </h1>
        <p className="hero-fade mt-8 max-w-xl text-lg text-foam/80 sm:text-xl">
          Цэвэр усны эх үүсвэрээс таны гэр хүртэл.
          <span className="mt-2 block text-base text-mist">
            Дархан хотын ус хангамж, ариутгах татуургын цогц үйлчилгээ
          </span>
        </p>
        <div className="hero-fade mt-10 flex flex-wrap gap-4">
          <a
            href="#journey"
            className="rounded-full bg-water px-7 py-3.5 font-display text-sm font-semibold text-abyss transition hover:bg-aqua hover:shadow-[0_0_40px_rgba(63,208,255,.5)]"
          >
            EXPLORE ↓
          </a>
          <a
            href="#customer"
            className="rounded-full border border-foam/20 px-7 py-3.5 text-sm transition hover:border-water hover:text-water"
          >
            Онлайн үйлчилгээ
          </a>
        </div>
      </div>

      {/* Scroll хийхэд доош урсах усны дусал — Water Journey руу холбоно */}
      <div className="pointer-events-none absolute bottom-10 left-1/2 z-10 flex -translate-x-1/2 flex-col items-center">
        <span className="hero-fade mb-3 text-[10px] tracking-[0.4em] text-mist">SCROLL TO EXPLORE</span>
        <div className="hero-stream h-16 w-px origin-top scale-y-[0.3] bg-gradient-to-b from-water to-transparent" />
        <svg className="hero-drop mt-1" width="14" height="18" viewBox="0 0 14 18" aria-hidden>
          <path d="M7 0C7 0 0 8 0 11.5C0 15.1 3.1 18 7 18S14 15.1 14 11.5C14 8 7 0 7 0Z" fill="#3fd0ff" />
        </svg>
      </div>
    </section>
  );
}
