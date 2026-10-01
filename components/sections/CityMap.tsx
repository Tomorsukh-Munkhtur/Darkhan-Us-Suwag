"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { cityFlow, outages, type CityStep } from "@/lib/content";
import CityMap3D from "@/components/three/citymap/CityMap3D";
import { createCityRuntime } from "@/components/three/citymap/runtime";
import DarkhanMap from "./map/DarkhanMap";

gsap.registerPlugin(ScrollTrigger);

const N = cityFlow.length;
/** 3D газрын зургийн засварын тэмдэг (SVG-тэй ижил mapPoint) — тогтмол reference */
const OUTAGE_3D = outages[0] ? { x: outages[0].mapPoint.x, y: outages[0].mapPoint.y, area: outages[0].area } : null;
const PIN = 250; // pin-ий scroll урт, дэлгэцийн өндрийн %
const STEP = (PIN * 0.9) / (N - 1); // алхам хоорондын scroll (vh); сүүлийн 10% нь эцсийн төлөвийг барина
const pad = (n: number) => String(n).padStart(2, "0");

/** Камер: алхам бүрт газрын зургийн аль цэг (1600×900) рүү, хэр ойртох. null — бүхэлд нь. */
const focus: ({ fx: number; fy: number; s: number } | null)[] = [
  { fx: 300, fy: 230, s: 1.7 },
  { fx: 580, fy: 320, s: 1.8 },
  { fx: 600, fy: 250, s: 1.9 },
  null,
  { fx: 1420, fy: 220, s: 1.7 },
  null,
];

const icons: Record<CityStep["id"], React.ReactNode> = {
  source: <path d="M12 3s-6 7-6 11a6 6 0 0012 0c0-4-6-11-6-11z" />,
  pump: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v4M12 18v4M2 12h4M18 12h4M5 5l3 3M16 16l3 3M5 19l3-3M16 8l3-3" />
    </>
  ),
  reservoir: (
    <>
      <ellipse cx="12" cy="6" rx="7" ry="3" />
      <path d="M5 6v12c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12c0 1.7 3.1 3 7 3s7-1.3 7-3" />
    </>
  ),
  pipe: <path d="M2 9h9a5 5 0 015 5v8M2 6v6M13 22h6" />,
  treatment: (
    <>
      <circle cx="8" cy="12" r="5" />
      <circle cx="17.5" cy="12" r="3.5" />
      <path d="M8 12l3-3" />
    </>
  ),
  consumers: <path d="M3 11l9-7 9 7M5 10v10h14V10M10 20v-5h4v5" />,
};

/** compact — mobile: нэр нь идэвхтэй pill дээр харагдаж байгаа тул гарчиггүй, текст 3 мөр. */
function StepCard({ s, i, compact = false }: { s: CityStep; i: number; compact?: boolean }) {
  const o = outages[0];
  return (
    <div
      className={`rounded-3xl border border-abyss/10 bg-white/95 shadow-[0_18px_50px_-24px_rgba(4,33,58,.3)] backdrop-blur ${compact ? "p-4" : "p-6"}`}
    >
      <p className="font-display text-[11px] tracking-[0.3em] text-mist">
        {pad(i + 1)} / {pad(N)}
      </p>
      {!compact && <h3 className="mt-1.5 text-h4 font-bold">{s.label}</h3>}
      <p className={`mt-2 text-sm leading-relaxed text-abyss/80 ${compact ? "line-clamp-3" : ""}`}>{s.text}</p>
      <dl className={`grid gap-x-4 gap-y-2 ${compact ? "mt-3 grid-cols-2 text-xs" : "mt-4 grid-cols-1 text-sm"}`}>
        {s.facts.map((f) => (
          <div key={f.k} className={`flex border-t border-abyss/10 pt-2 ${compact ? "flex-col" : "justify-between gap-4"}`}>
            <dt className="text-mist">{f.k}</dt>
            <dd className={`font-semibold ${compact ? "" : "text-right"}`}>{f.v}</dd>
          </div>
        ))}
      </dl>
      {s.id === "consumers" && o && (
        // намхан утсанд картыг богиносгоно — засвар газрын зураг дээр улаан тэмдгээр харагдсаар байна
        <p
          className={`mt-4 items-center gap-2 rounded-xl bg-alert/5 px-3 py-2 text-xs font-medium text-alert ${
            compact ? "hidden [@media(min-height:740px)]:flex" : "flex"
          }`}
        >
          <span className="h-2 w-2 animate-pulse rounded-full bg-alert" /> Одоо: {o.area} — {o.title}
        </p>
      )}
    </div>
  );
}

/**
 * Pin хийгдсэн scene: scroll хийхэд гинжний шугамаар ус урсаж алхам бүрийг гэрэлтүүлнэ,
 * газрын зураг дээр камер тухайн объект руу ойртож, тэр давхарга нь сэргэнэ.
 */
export default function CityMap() {
  const root = useRef<HTMLElement>(null);
  const [active, setActive] = useState(0);
  // 3D газрын зураг: pin-ий progress-ийг шууд уншина (React re-render-гүй); бэлэн болоход SVG давхарга нуугдана
  const [rt] = useState(createCityRuntime);
  const [live3d, setLive3d] = useState(false);

  useEffect(() => {
    const toScene = (self: ScrollTrigger) => {
      rt.progress = self.progress;
      rt.invalidate();
    };
    const ctx = gsap.context(() => {
      gsap
        .timeline({
          scrollTrigger: {
            trigger: ".map-stage",
            start: "top top",
            end: () => `+=${(window.innerHeight * PIN) / 100}`,
            pin: true,
            scrub: 0.5,
            invalidateOnRefresh: true,
            onRefresh: toScene,
            onUpdate: (self) => {
              toScene(self);
              setActive(Math.min(N - 1, Math.floor(Math.min(self.progress / 0.9, 1) * (N - 1) + 0.001)));
            },
          },
        })
        .fromTo(".spine-fill", { scaleY: 0 }, { scaleY: 1, ease: "none", duration: 0.9 }, 0)
        .fromTo(".spine-drop", { top: "0%" }, { top: "100%", ease: "none", duration: 0.9 }, 0)
        .to({}, { duration: 0.1 });

      gsap.fromTo(
        ".map-pill",
        { opacity: 0, scale: 0.6 },
        {
          opacity: 1,
          scale: 1,
          duration: 0.7,
          ease: "back.out(1.6)",
          stagger: 0.07,
          scrollTrigger: { trigger: ".map-stage", start: "top 70%", once: true },
        },
      );
    }, root);
    return () => ctx.revert();
  }, [rt]);

  const f = focus[active];
  const cam: React.CSSProperties = f
    ? {
        transformOrigin: `${f.fx / 16}% ${f.fy / 9}%`,
        transform: `translate(calc(50% - ${f.fx / 16}% + var(--vx) * 100vw), calc(50% - ${f.fy / 9}% + var(--vy) * 100svh)) scale(${f.s})`,
      }
    : { transformOrigin: "50% 50%", transform: "translate(0px, 0px) scale(1)" };
  const t = (active / (N - 1)) * 100;

  return (
    <section id="map" ref={root} className="relative bg-foam">
      {/* Гинжний алхам бүрийн scroll байрлал — pill дарахад энд гулсана */}
      {cityFlow.map((s, i) => (
        <span
          key={s.id}
          id={`map-step-${i}`}
          aria-hidden
          className="pointer-events-none absolute left-0"
          style={{ top: `calc(${i * STEP}vh + 40px)` }}
        />
      ))}

      <div className="map-stage relative h-[100svh] min-h-[600px] overflow-hidden">
        {/* газрын зураг: cover + камер (SVG — 3D бэлэн болох хүртэл ба fallback) */}
        <div
          className={`pointer-events-none absolute left-1/2 top-1/2 aspect-[16/9] w-[max(100%,calc(100svh*16/9))] -translate-x-1/2 -translate-y-1/2 transition-opacity duration-700 ${
            live3d ? "invisible opacity-0" : "opacity-100"
          }`}
        >
          <div
            className="absolute inset-0 transition-[transform,transform-origin] duration-[1600ms] ease-[cubic-bezier(.22,1,.36,1)] [--vx:0.2] [--vy:-0.08] lg:[--vx:-0.26] lg:[--vy:0.06]"
            style={cam}
          >
            <DarkhanMap active={active} className="h-full w-full" />
          </div>
        </div>
        {/* 3D хот: алхам/progress-оор удирдагдана, UI ба бүрхүүлийн ард */}
        <CityMap3D rt={rt} onLive={setLive3d} outage={OUTAGE_3D} />

        {/* уншигдахуйц байлгах бүрхүүл */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-60 bg-gradient-to-b from-foam via-foam/75 to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 left-0 w-3/4 bg-gradient-to-r from-foam/90 via-foam/60 to-transparent lg:hidden" />
        <div className="pointer-events-none absolute inset-y-0 left-1/2 hidden w-[36rem] -translate-x-1/2 bg-[radial-gradient(closest-side,rgba(4,26,46,.9),rgba(4,26,46,0))] lg:block" />

        <div className="absolute inset-x-0 top-24 z-10 px-4 text-center sm:top-28">
          <p className="eyebrow">
            <span className="text-mist">05</span> — Darkhan City Map
          </p>
          <h2 className="mt-3 text-h2">
            ДАРХАН ХОТЫН <span className="text-water">МАП</span>
          </h2>
        </div>

        {/* гинж */}
        <div className="absolute bottom-72 left-4 top-40 z-10 sm:top-52 lg:bottom-16 lg:left-1/2 lg:top-56 lg:w-60 lg:-translate-x-1/2">
          <div className="relative h-full">
            <div className="absolute inset-y-[18px] left-[16px] w-1 lg:inset-y-[22px] rounded-full bg-abyss/10 lg:left-1/2 lg:-ml-0.5">
              <div className="spine-fill absolute inset-0 origin-top rounded-full bg-gradient-to-b from-aqua to-water" />
              <div className="spine-drop absolute left-1/2 -translate-x-1/2 -translate-y-1/2">
                <svg width="14" height="18" viewBox="0 0 14 18" className="drop-shadow-[0_2px_6px_rgba(0,120,190,.5)]" aria-hidden>
                  <path d="M7 0C7 0 0 8 0 11.5C0 15.1 3.1 18 7 18S14 15.1 14 11.5C14 8 7 0 7 0Z" fill="#38b6f0" />
                </svg>
              </div>
            </div>

            <ol className="relative flex h-full flex-col justify-between">
              {cityFlow.map((s, i) => {
                const state = i === active ? "active" : i < active ? "done" : "todo";
                return (
                  <li key={s.id} className="map-pill">
                    <a
                      href={`#map-step-${i}`}
                      aria-current={i === active ? "step" : undefined}
                      className={`flex items-center gap-3 rounded-full border py-1 pl-1 pr-3 text-[13px] font-semibold lg:py-1.5 lg:pl-1.5 lg:pr-4 lg:text-sm shadow-sm transition-colors duration-500 lg:w-60 ${
                        state === "active"
                          ? "border-water bg-water text-white shadow-[0_10px_30px_-10px_rgba(0,120,190,.7)]"
                          : state === "done"
                            ? "border-water/40 bg-white text-abyss"
                            : "border-abyss/10 bg-white/80 text-abyss/55 backdrop-blur"
                      }`}
                    >
                      <span
                        className={`grid h-7 w-7 shrink-0 place-items-center rounded-full lg:h-8 lg:w-8 transition-colors duration-500 ${
                          state === "active" ? "bg-white text-water" : state === "done" ? "bg-water text-white" : "bg-abyss/5 text-abyss/50"
                        }`}
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                          {icons[s.id]}
                        </svg>
                      </span>
                      {s.label}
                    </a>
                  </li>
                );
              })}
            </ol>

            {/* desktop: карт идэвхтэй алхмын хажууд явна */}
            <div
              className="absolute left-full ml-10 hidden w-[19rem] transition-[top,transform] duration-700 ease-[cubic-bezier(.22,1,.36,1)] lg:block xl:ml-12 xl:w-[22rem]"
              style={{ top: `${t}%`, transform: `translateY(-${t}%)` }}
            >
              <AnimatePresence mode="wait">
                <motion.div
                  key={active}
                  initial={{ opacity: 0, x: 24 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -12 }}
                  transition={{ duration: 0.35 }}
                >
                  <StepCard s={cityFlow[active]} i={active} />
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* mobile: доод карт */}
        <div className="absolute inset-x-4 bottom-4 z-20 lg:hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={active}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
            >
              <StepCard s={cityFlow[active]} i={active} compact />
            </motion.div>
          </AnimatePresence>
        </div>

        {/* тайлбар */}
        <div className="absolute bottom-6 left-8 z-10 hidden flex-col gap-2 rounded-2xl bg-white/80 px-4 py-3 text-xs text-abyss/80 shadow-sm backdrop-blur lg:flex">
          <span className="flex items-center gap-2">
            <span className="h-1 w-6 rounded-full bg-[#38b6f0]" /> Цэвэр усны шугам
          </span>
          <span className="flex items-center gap-2">
            <span className="h-1 w-6 rounded-full bg-[#1fa37a]" /> Бохир усны шугам
          </span>
          <span className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-alert" /> Засвар
          </span>
        </div>
        <p className="absolute bottom-6 right-8 z-10 hidden max-w-xs text-right text-[11px] text-mist/80 lg:block">
          * Схем нь бодит газарзүйн байршлыг харуулахгүй, ерөнхий бүтцийг илэрхийлнэ.
        </p>
      </div>
    </section>
  );
}
