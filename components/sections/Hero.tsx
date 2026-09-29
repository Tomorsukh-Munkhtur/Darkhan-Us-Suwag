"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { FarSkyline, NearSkyline } from "./hero/Skyline";
import HQBuilding from "./hero/HQBuilding";
import Tree from "./hero/Tree";

gsap.registerPlugin(ScrollTrigger);

const words = ["ДАРХАН", "ХОТ"];
const clouds = [
  { top: "13%", w: 18, dur: 95, delay: -20 },
  { top: "24%", w: 11, dur: 70, delay: -50 },
  { top: "7%", w: 24, dur: 125, delay: -95 },
];

function Cloud({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 200 80" className={className} style={style} aria-hidden>
      <g fill="#fff">
        <ellipse cx="60" cy="52" rx="50" ry="24" />
        <ellipse cx="102" cy="38" rx="46" ry="34" />
        <ellipse cx="146" cy="52" rx="44" ry="22" />
        <rect x="18" y="50" width="164" height="26" rx="13" />
      </g>
    </svg>
  );
}

/**
 * Давхаргууд (араас урагш): тэнгэр → ард хот → ДАРХАН ХОТ → урд хот → талбай + байр → мод.
 * .hero-p-* — scroll parallax, [data-depth] — хулганы parallax, дотор талын элемент — intro.
 */
export default function Hero() {
  const root = useRef<HTMLElement>(null);

  useEffect(() => {
    const mm = gsap.matchMedia();
    mm.add(
      { motion: "(prefers-reduced-motion: no-preference)", fine: "(pointer: fine)" },
      (ctx) => {
        const { motion, fine } = ctx.conditions as { motion: boolean; fine: boolean };
        if (!motion) {
          gsap.set(".hero-pre", { opacity: 1 });
          return;
        }

        // Intro: хот газраас ургана → бичиг барилгын цаанаас гарна → байр, мод орж ирнэ
        gsap
          .timeline({ defaults: { ease: "expo.out" } })
          // Зөвхөн дотроо анимацтай wrapper-ууд; бусад нь өөрсдийн fromTo-гоор гарч ирнэ
          .set([".hero-far", ".hero-near", ".hero-title"], { opacity: 1 })
          .fromTo(".bld-far", { y: 160, opacity: 0 }, { y: 0, opacity: 1, duration: 1.6, stagger: { each: 0.01, from: "center" } }, 0)
          .fromTo(".bld-near", { y: 320 }, { y: 0, duration: 1.4, stagger: { each: 0.018, from: "center" } }, 0.2)
          .fromTo(".hero-char", { yPercent: 115 }, { yPercent: 0, duration: 1.3, stagger: 0.06 }, 0.7)
          .fromTo(
            ".hero-eyebrow",
            { opacity: 0, letterSpacing: "0.1em" },
            { opacity: 1, letterSpacing: "0.4em", duration: 1.8, ease: "power3.out" },
            1,
          )
          .fromTo(".hero-plaza", { scale: 0.5, opacity: 0 }, { scale: 1, opacity: 1, duration: 1.2, transformOrigin: "50% 60%" }, 0.9)
          .fromTo(".hero-hq", { y: 90, opacity: 0 }, { y: 0, opacity: 1, duration: 1.4 }, 1.05)
          .fromTo(".hero-pool", { scale: 0, opacity: 0 }, { scale: 1, opacity: 1, duration: 1.1 }, 1.5)
          .fromTo(
            ".hero-tree",
            { xPercent: -80, rotation: -12, opacity: 0 },
            { xPercent: 0, rotation: 0, opacity: 1, duration: 1.8, ease: "back.out(1.2)", transformOrigin: "50% 100%" },
            1.15,
          )
          .fromTo(".hero-pipe", { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 1.6, ease: "power2.inOut" }, 1.8)
          .to(".hero-flow", { opacity: 0.9, duration: 0.6 }, 3.2);

        // Байнгын хөдөлгөөн
        gsap.fromTo(
          ".hero-sway",
          { rotation: -1.2 },
          { rotation: 1.4, duration: 3.4, ease: "sine.inOut", yoyo: true, repeat: -1, transformOrigin: "50% 100%", stagger: 0.8 },
        );
        gsap.to(".crown-blob", {
          scale: 1.035,
          duration: 2.2,
          ease: "sine.inOut",
          yoyo: true,
          repeat: -1,
          transformOrigin: "50% 50%",
          stagger: { each: 0.3, from: "random" },
        });
        gsap.to(".hero-glint", {
          opacity: 1,
          duration: 0.5,
          ease: "sine.inOut",
          delay: 2.5,
          stagger: { each: 0.7, from: "random", repeat: -1, yoyo: true, repeatDelay: 12 },
        });
        gsap.to(".hero-sun", { scale: 1.08, opacity: 0.8, duration: 4, ease: "sine.inOut", yoyo: true, repeat: -1 });
        gsap.fromTo(".hq-sheen", { x: 0 }, { x: 1100, duration: 1.8, ease: "power2.inOut", repeat: -1, repeatDelay: 5, delay: 2.6 });

        // Scroll: давхарга бүр өөр хурдтай, мод хоёр тийш хөшиг шиг нээгдэнэ
        gsap
          .timeline({
            defaults: { ease: "none" },
            scrollTrigger: { trigger: root.current, start: "top top", end: "bottom top", scrub: true },
          })
          .to(".hero-p-sky", { yPercent: 30 }, 0)
          .to(".hero-p-far", { yPercent: 20 }, 0)
          .to(".hero-p-title", { yPercent: 80, opacity: 0 }, 0)
          .to(".hero-p-near", { yPercent: 9 }, 0)
          .to(".hero-p-hq", { yPercent: -6 }, 0)
          .to(".hero-p-tree", { xPercent: -45, yPercent: -10, rotation: -6 }, 0);

        // Хулгана: урд давхарга илүү хөдөлнө
        if (!fine) return;
        const layers = gsap.utils.toArray<HTMLElement>("[data-depth]", root.current).map((el) => ({
          d: Number(el.dataset.depth),
          x: gsap.quickTo(el, "x", { duration: 1.2, ease: "power3" }),
          y: gsap.quickTo(el, "y", { duration: 1.2, ease: "power3" }),
        }));
        const onMove = (e: PointerEvent) => {
          const nx = e.clientX / window.innerWidth - 0.5;
          const ny = e.clientY / window.innerHeight - 0.5;
          for (const l of layers) {
            l.x(-nx * l.d * 24);
            l.y(-ny * l.d * 12);
          }
        };
        window.addEventListener("pointermove", onMove);
        return () => window.removeEventListener("pointermove", onMove);
      },
      root,
    );
    return () => mm.revert();
  }, []);

  return (
    <section
      id="top"
      ref={root}
      className="hero-scene grain relative h-[100svh] min-h-[640px] overflow-hidden bg-[linear-gradient(180deg,#a9dcf5_0%,#d4eefa_45%,#f5fbff_85%)]"
    >
      {/* тэнгэр */}
      <div className="hero-p-sky pointer-events-none absolute inset-0">
        <div data-depth="0.25" className="absolute inset-0">
          <div className="hero-sun absolute right-[8%] top-[10%] h-[calc(var(--u)*36)] w-[calc(var(--u)*36)] rounded-full bg-[radial-gradient(circle,#fff_0%,rgba(255,247,220,.75)_22%,rgba(255,255,255,0)_68%)]" />
          {clouds.map((c, i) => (
            <Cloud
              key={i}
              className="hero-cloud absolute left-0 opacity-90"
              style={{ top: c.top, width: `calc(var(--u) * ${c.w})`, animationDuration: `${c.dur}s`, animationDelay: `${c.delay}s` }}
            />
          ))}
        </div>
      </div>

      {/* ард талын хот */}
      <div className="hero-p-far pointer-events-none absolute -inset-x-[3%] bottom-0 h-[calc(var(--u)*44)]">
        <div data-depth="0.35" className="h-full">
          <FarSkyline className="hero-far hero-pre block h-full w-full" />
        </div>
      </div>

      {/* ДАРХАН ХОТ — урд талын барилгуудын цаана */}
      <div className="hero-p-title absolute inset-x-0 bottom-[calc(var(--u)*33)] px-4 text-center lg:bottom-[calc(var(--u)*30)]">
        <div data-depth="0.6">
          <div className="hero-title hero-pre">
            <p className="hero-eyebrow mb-[calc(var(--u)*1.2)] font-display text-[11px] tracking-[0.4em] text-water sm:text-sm">
              УС БҮХНИЙ ЭХЛЭЛ
            </p>
            <h1
              aria-label="Дархан хот — Дархан Ус Суваг ОНӨААТҮГ"
              className="font-display text-[length:min(calc(var(--u)*6.8),15vw)] font-bold leading-[0.95] tracking-tight lg:text-[length:calc(var(--u)*9.5)]"
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

      {/* урд талын хот */}
      <div className="hero-p-near pointer-events-none absolute -inset-x-[3%] bottom-0 h-[calc(var(--u)*44)]">
        <div data-depth="0.9" className="h-full">
          <NearSkyline className="hero-near hero-pre block h-full w-full" />
        </div>
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[calc(var(--u)*8)] bg-gradient-to-b from-transparent to-foam/80" />

      {/* талбай + Дархан Ус Суваг-ийн байр + усан сан */}
      <div
        data-depth="1.2"
        className="pointer-events-none absolute bottom-[calc(var(--u)*-6)] left-1/2 -ml-[calc(var(--u)*30)] w-[calc(var(--u)*60)] lg:-ml-[calc(var(--u)*36)] lg:w-[calc(var(--u)*72)]"
      >
        <div className="hero-p-hq relative h-[calc(var(--u)*34)]">
          <svg viewBox="0 0 1000 200" className="hero-plaza hero-pre absolute inset-x-0 bottom-0 w-full" aria-hidden>
            <defs>
              <linearGradient id="hero-plaza-g" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#ffffff" />
                <stop offset="1" stopColor="#d9ecf7" />
              </linearGradient>
            </defs>
            <ellipse cx="500" cy="110" rx="490" ry="88" fill="url(#hero-plaza-g)" stroke="#cfe3ef" strokeWidth="2" />
          </svg>
          <HQBuilding className="hero-hq hero-pre absolute bottom-[calc(var(--u)*9)] inset-x-0 mx-auto w-[calc(var(--u)*34)] lg:w-[calc(var(--u)*46)]" />
          <svg
            viewBox="0 0 400 120"
            className="hero-pool hero-pre absolute bottom-[calc(var(--u)*1)] inset-x-0 mx-auto w-[calc(var(--u)*22)]"
            aria-hidden
          >
            <defs>
              <linearGradient id="hero-pool-g" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#9bd9f6" />
                <stop offset="1" stopColor="#2f9bd6" />
              </linearGradient>
            </defs>
            <ellipse cx="200" cy="60" rx="190" ry="52" fill="url(#hero-pool-g)" stroke="#fff" strokeWidth="5" />
            {[0, 1.2, 2.4].map((d) => (
              <ellipse
                key={d}
                className="ripple"
                cx="200"
                cy="60"
                rx="170"
                ry="44"
                fill="none"
                stroke="#fff"
                strokeWidth="2.5"
                style={{ animationDelay: `${d}s` }}
              />
            ))}
          </svg>
        </div>
      </div>

      {/* мод — зүүн, баруун (толин тусгал) */}
      <div
        data-depth="2.2"
        className="pointer-events-none absolute bottom-[calc(var(--u)*-7)] left-[calc(var(--u)*-8)] w-[calc(var(--u)*20)] lg:w-[calc(var(--u)*28)]"
      >
        <div className="hero-p-tree">
          <Tree className="hero-tree hero-pre block h-auto w-full" />
        </div>
      </div>
      <div
        data-depth="2.2"
        className="pointer-events-none absolute bottom-[calc(var(--u)*-7)] right-[calc(var(--u)*-8)] w-[calc(var(--u)*20)] lg:w-[calc(var(--u)*28)]"
      >
        <div className="-scale-x-100">
          <div className="hero-p-tree">
            <Tree className="hero-tree hero-pre block h-auto w-full" />
          </div>
        </div>
      </div>
    </section>
  );
}
