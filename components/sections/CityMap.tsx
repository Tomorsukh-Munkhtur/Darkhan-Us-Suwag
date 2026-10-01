"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { cityFlow, type CityStep } from "@/lib/content";
import CityMap3D from "@/components/three/citymap/CityMap3D";
import { createCityRuntime } from "@/components/three/citymap/runtime";
import DarkhanMap from "./map/DarkhanMap";

gsap.registerPlugin(ScrollTrigger);

const N = cityFlow.length;
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
  return (
    <div
      className={`rounded-3xl border border-white/10 bg-white/50 shadow-[0_18px_50px_-24px_rgba(4,33,58,.4)] backdrop-blur-[3px] [text-shadow:0_1px_6px_rgba(4,26,46,.85)] ${compact ? "p-4" : "p-6"}`}
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
    </div>
  );
}

/**
 * Pin хийгдсэн scene: scroll хийхэд гинжний шугамаар ус урсаж алхам бүрийг гэрэлтүүлнэ,
 * газрын зураг дээр камер тухайн объект руу ойртож, тэр давхарга нь сэргэнэ.
 * Desktop: алхмууд ба мэдээлэл зүүн талын нэг самбарт (мап баруун талд чөлөөтэй); mobile: гинж зүүн, карт доор.
 * Dark (.theme-dark): Усны чанараас шилжилтгүй үргэлжилнэ; доор нь Хэрэглэгчийн үйлчилгээ усны долгиотой ирмэгтэйгээ мапын дээгүүр бүрхэж гарна (map-inner parallax).
 * Navbar: хэсэг дор нь байхад бараан (data-nav-dark).
 */
export default function CityMap() {
  const root = useRef<HTMLElement>(null);
  const [active, setActive] = useState(0);
  // 3D газрын зураг: pin-ий progress-ийг шууд уншина (React re-render-гүй); бэлэн болоход SVG давхарга нуугдана
  const [rt] = useState(createCityRuntime);
  const [live3d, setLive3d] = useState(false);
  // хуучин SVG мап зөвхөн 3D ажиллах боломжгүй үед (ачаалж байхад хальт харагдахгүй)
  const [mapFallback, setMapFallback] = useState(false);

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

      // pin дууссаны дараа: дараагийн хэсэг (усны долгиотой ирмэгтэй) мапын дээгүүр доороос бүрхэж гарна —
      // мап хэсгийнхээ хүрээнд удаан гүйж (доош шилжинэ), бараанна. Хүрээ (stage) overflow-hidden тул доошоо тасарна.
      if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        gsap
          .timeline({
            scrollTrigger: { trigger: root.current, start: "bottom bottom", end: "bottom top", scrub: true, invalidateOnRefresh: true },
          })
          .fromTo(".map-inner", { y: 0 }, { y: () => window.innerHeight * 0.35, ease: "none" }, 0)
          .fromTo(".map-dim", { opacity: 0 }, { opacity: 0.45, ease: "none" }, 0);
      }
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

  return (
    <section id="map" ref={root} data-nav-dark className="theme-dark relative bg-foam text-abyss">
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
        {/* .map-inner: pin дууссаны дараа Хэрэглэгчийн үйлчилгээ усны долгиотойгоо дээгүүр нь бүрхэж гарахад мап удаан гүйнэ (parallax) */}
        <div className="map-inner absolute inset-0">
          {/* газрын зураг: cover + камер (SVG — 3D бэлэн болох хүртэл ба fallback) */}
          <div
            className={`pointer-events-none absolute left-1/2 top-1/2 aspect-[16/9] w-[max(100%,calc(100svh*16/9))] -translate-x-1/2 -translate-y-1/2 transition-opacity duration-700 ${
              !live3d && mapFallback ? "opacity-100" : "invisible opacity-0"
            }`}
          >
            <div
              className="absolute inset-0 transition-[transform,transform-origin] duration-[1600ms] ease-[cubic-bezier(.22,1,.36,1)] [--vx:0.2] [--vy:-0.08] lg:[--vx:0.15] lg:[--vy:0.04]"
              style={cam}
            >
              <DarkhanMap active={active} className="h-full w-full" />
            </div>
          </div>
          {/* 3D хот: алхам/progress-оор удирдагдана, UI ба бүрхүүлийн ард */}
          {/* засварын (тасалдлын) тэмдэг харуулахгүй — сайтаас анхааруулгуудыг хассан */}
          <CityMap3D rt={rt} onLive={setLive3d} onFallback={setMapFallback} outage={null} />

          {/* уншигдахуйц байлгах бүрхүүл (desktop дээр самбар өөрийн дэвсгэртэй — мапын төв чөлөөтэй) */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-60 bg-gradient-to-b from-foam via-foam/75 to-transparent" />
          {/* доод ирмэг бараан өнгөнд уусна — доороос гарах усны долгионы ард */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-foam via-foam/60 to-transparent" />
          <div className="pointer-events-none absolute inset-y-0 left-0 w-3/4 bg-gradient-to-r from-foam/60 via-foam/25 to-transparent lg:hidden" />

          <div className="absolute inset-x-0 top-24 z-10 px-4 text-center sm:top-28 lg:left-8 lg:right-auto lg:px-0 lg:text-left xl:left-12">
            <p className="eyebrow">Darkhan City Map</p>
            <h2 className="mt-3 text-h2">
              ДАРХАН ХОТЫН <span className="text-water">МАП</span>
            </h2>
          </div>

          {/* mobile: гинж зүүн талд, карт доор */}
          <div className="absolute bottom-[19.5rem] left-4 top-40 z-10 sm:top-52 lg:hidden">
            <div className="relative h-full">
              <div className="absolute inset-y-[18px] left-[16px] w-1 rounded-full bg-abyss/10">
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
                        className={`flex items-center gap-3 rounded-full border py-1 pl-1 pr-3 text-[13px] font-semibold shadow-sm transition-colors duration-500 ${
                          state === "active"
                            ? "border-water bg-water text-white shadow-[0_10px_30px_-10px_rgba(0,120,190,.7)]"
                            : state === "done"
                              ? "border-water/40 bg-white/60 text-abyss backdrop-blur-[3px]"
                              : "border-abyss/10 bg-white/40 text-abyss/70 backdrop-blur-[3px]"
                        }`}
                      >
                        <span
                          className={`grid h-7 w-7 shrink-0 place-items-center rounded-full transition-colors duration-500 ${
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
            </div>
          </div>

          {/* mobile: доод карт */}
          <div className="absolute inset-x-4 bottom-10 z-20 lg:hidden">
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

          {/* desktop: зүүн талын нэг самбар — алхмууд, идэвхтэй алхмын мэдээлэл нь доор нь нээгдэнэ.
              Мап баруун талд чөлөөтэй; камер обьектыг тэнд авчирна (state.ts FOCUS_NDC) */}
          <div className="absolute left-8 top-56 z-10 hidden w-[22rem] lg:block xl:left-12 xl:w-[24rem]">
            <ol className="relative rounded-3xl border border-white/10 bg-white/40 p-2 shadow-[0_18px_50px_-24px_rgba(4,33,58,.5)] backdrop-blur-[3px] [text-shadow:0_1px_6px_rgba(4,26,46,.85)]">
              {/* шугам: идэвхтэй алхам хүртэл ус дүүрнэ (мөр бүр 2.75rem, идэвхтэйгээс дээших нь хаалттай) */}
              <span aria-hidden className="absolute left-[29px] top-[30px] h-[13.75rem] w-0.5 rounded-full bg-abyss/10" />
              <span
                aria-hidden
                className="absolute left-[29px] top-[30px] w-0.5 rounded-full bg-gradient-to-b from-aqua to-water transition-[height] duration-700 ease-[cubic-bezier(.22,1,.36,1)]"
                style={{ height: `calc(${active} * 2.75rem)` }}
              />
              {cityFlow.map((s, i) => {
                const state = i === active ? "active" : i < active ? "done" : "todo";
                return (
                  <li key={s.id} className="map-pill relative">
                    <a
                      href={`#map-step-${i}`}
                      aria-current={i === active ? "step" : undefined}
                      className={`flex h-11 items-center gap-3 rounded-2xl px-2 text-sm font-semibold transition-colors duration-500 ${
                        state === "active" ? "bg-water/15 text-abyss" : state === "done" ? "text-abyss hover:bg-abyss/5" : "text-abyss/55 hover:bg-abyss/5"
                      }`}
                    >
                      <span
                        className={`relative grid h-7 w-7 shrink-0 place-items-center rounded-full transition-colors duration-500 ${
                          state === "active"
                            ? "bg-water text-white shadow-[0_6px_18px_-6px_rgba(56,182,240,.9)]"
                            : state === "done"
                              ? "bg-water/80 text-white"
                              : "bg-abyss/10 text-abyss/60"
                        }`}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                          {icons[s.id]}
                        </svg>
                      </span>
                      {s.label}
                      {state === "active" && (
                        <span className="ml-auto pr-1 font-display text-[11px] tracking-[0.2em] text-mist">
                          {pad(i + 1)} / {pad(N)}
                        </span>
                      )}
                    </a>
                    <AnimatePresence initial={false}>
                      {i === active && (
                        <motion.div
                          key="info"
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                          className="overflow-hidden"
                        >
                          <div className="pb-3 pl-12 pr-3 pt-1">
                            <p className="text-[13px] leading-relaxed text-abyss/90">{s.text}</p>
                            <dl className="mt-3 grid gap-y-1.5 text-xs">
                              {s.facts.map((f) => (
                                <div key={f.k} className="flex justify-between gap-4 border-t border-abyss/10 pt-1.5">
                                  <dt className="text-mist">{f.k}</dt>
                                  <dd className="text-right font-semibold">{f.v}</dd>
                                </div>
                              ))}
                            </dl>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </li>
                );
              })}
            </ol>
          </div>

          {/* тайлбар: баруун доор жижиг; доороос гарах усны долгионд (≈60px) дарагдахгүйн тулд доод ирмэгээс зайтай */}
          <div className="absolute bottom-28 right-8 z-10 hidden max-w-[19rem] flex-col gap-1.5 rounded-2xl border border-white/10 bg-white/40 px-4 py-2.5 text-xs text-abyss/90 shadow-sm backdrop-blur-[3px] [text-shadow:0_1px_6px_rgba(4,26,46,.85)] lg:flex xl:right-12">
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              <span className="flex items-center gap-2">
                <span className="h-1 w-6 rounded-full bg-[#38b6f0]" /> Цэвэр усны шугам
              </span>
              <span className="flex items-center gap-2">
                <span className="h-1 w-6 rounded-full bg-[#1fa37a]" /> Бохир усны шугам
              </span>
            </div>
            <p className="text-[10px] leading-snug text-mist/80">* Схем нь бодит газарзүйн байршлыг харуулахгүй, ерөнхий бүтцийг илэрхийлнэ.</p>
          </div>
        </div>
        {/* бүрхэгдэх тусам мап гүн рүү бараанна */}
        <div aria-hidden className="map-dim pointer-events-none absolute inset-0 z-30 bg-[#041a2e] opacity-0" />
      </div>
    </section>
  );
}
