"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { AnimatePresence, motion, useInView } from "framer-motion";
import { qualityParams, qualityStats } from "@/lib/content";
import { hasWebGL2 } from "@/components/three/journey/utils/browser";
import SectionHeading from "../ui/SectionHeading";
import DropReveal from "./DropReveal";

const WaterSurface = dynamic(() => import("@/components/three/WaterSurface"), { ssr: false });

function Counter({ to, suffix }: { to: number; suffix: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const [v, setV] = useState(0);

  useEffect(() => {
    if (!inView) return;
    let raf = 0;
    const start = performance.now();
    const dur = 1600;
    const step = (t: number) => {
      const p = Math.min((t - start) / dur, 1);
      setV(Math.round(to * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [inView, to]);

  return (
    <span ref={ref}>
      {v.toLocaleString("en-US")}
      <span className="text-water">{suffix}</span>
    </span>
  );
}

/**
 * Усны чанар — цайвар хэсгүүдийн дундах dark хэсэг (.theme-dark). Доош гүйлгэхэд урвуу дусал (DropReveal invert):
 * өмнөх цайвар хэсэг дэлгэц дүүрэн тойрог дотор үлдэж cursor руу жижгэрнэ, тойргоос гадна энэ хэсэг усны цаанаас
 * бүдэг, хугарч харагдаад тодорно; төгсгөлд тойрог cursor-ын дусал болно.
 * Ард нь бүдэг усны долгио; дараагийн Хотын мап мөн dark тул шилжилтгүй үргэлжилнэ.
 * Navbar: тойрог бүрхсэн үеэс бараан (DropReveal nav="dark" → data-nav-dark).
 */
export default function WaterQuality() {
  const [sel, setSel] = useState(qualityParams[0].id);
  const current = qualityParams.find((p) => p.id === sel)!;
  const root = useRef<HTMLElement>(null);
  // арын бүдэг усны долгио: WebGL2 байвал, хэсэг дэлгэцэн дээр байхад л зурна
  const [flow, setFlow] = useState<{ reduced: boolean } | null>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    if (hasWebGL2()) setFlow({ reduced: window.matchMedia("(prefers-reduced-motion: reduce)").matches });
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting));
    io.observe(root.current!);
    return () => io.disconnect();
  }, []);

  return (
    <>
      {/* шилжилтийн үед хэсэг дэлгэцийн дээд ирмэгт зөөгдөх тул анхны байрлал нь хоосорно —
          тэнд Бидний үйл ажиллагааны доод өнгө (#d9ecf8) үргэлжилнэ (цагаан зурвас гарахгүй) */}
      <div className="bg-[#d9ecf8]">
        <DropReveal
          id="quality-zone"
          className="theme-dark relative bg-foam text-abyss"
          origin="cursor"
          invert
          pull={false}
          start={1}
          surfacing={false}
          caustics={false}
          nav="dark"
        >
          {/* overflow-x-clip: доторх sticky дэвсгэр ажиллана (overflow-hidden бол ажиллахгүй).
              min-h 100svh: шилжилтийн үед хэсэг дэлгэцийн дээд ирмэгт зөөгдөхөд доор нь хоосон зурвас ил гарахгүй;
              агуулга босоо тэнхлэгт голлоно */}
          <section id="quality" ref={root} className="relative flex min-h-[100svh] flex-col justify-center overflow-x-clip bg-foam py-20 sm:py-24">
            {/* арын бүдэг усны долгио (Усны аяллын дэвсгэр шиг): дэлгэцэнд тогтоод хэсэгтэй хамт гүйнэ */}
            <div aria-hidden className="pointer-events-none absolute inset-0">
              <div className="quality-flow sticky top-0 h-[100svh] overflow-hidden">
                {flow && <WaterSurface running={inView} reduced={flow.reduced} strength={0.3} />}
              </div>
            </div>
            <div className="pointer-events-none absolute -right-40 top-20 h-[520px] w-[520px] rounded-full bg-aqua/20 blur-[120px]" />
            <div className="relative mx-auto max-w-6xl px-4 sm:px-8">
              {/* desktop: гарчиг зүүн, 4 үзүүлэлт баруун (2×2) — тусдаа том мөр болж эзлэхгүй */}
              <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-end lg:gap-14">
                <SectionHeading
                  eyebrow="Water Quality"
                  title={
                    <>
                      УСНЫ <span className="text-water">ЧАНАР</span>
                    </>
                  }
                  lead="Цэвэр ус бол бидний хамгийн чухал хариуцлага."
                />

                <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-abyss/10 bg-abyss/10">
                  {qualityStats.map((s) => (
                    <div key={s.label} className="bg-white px-5 py-4 sm:px-6 sm:py-5">
                      <div className="font-display text-3xl font-bold leading-none sm:text-4xl">
                        <Counter to={s.value} suffix={s.suffix} />
                      </div>
                      <p className="mt-2 text-[10px] uppercase tracking-[0.18em] text-mist">{s.label}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-10 grid gap-5 sm:mt-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
                <div className="flex flex-col gap-2" role="tablist" aria-label="Усны чанарын үзүүлэлт">
                  {qualityParams.map((p) => (
                    <button
                      key={p.id}
                      role="tab"
                      aria-selected={sel === p.id}
                      onClick={() => setSel(p.id)}
                      className={`flex items-center justify-between rounded-xl border px-4 py-3 text-left transition sm:px-5 sm:py-3.5 ${
                        sel === p.id
                          ? "border-water/60 bg-water/10"
                          : "border-abyss/10 bg-white/60 hover:border-abyss/25 hover:bg-white"
                      }`}
                    >
                      <span className="font-display text-[13px] tracking-wider">{p.name}</span>
                      <span className={`font-display text-base ${sel === p.id ? "text-water" : "text-abyss/70"}`}>
                        {p.value}
                      </span>
                    </button>
                  ))}
                </div>

                <div className="glass relative overflow-hidden rounded-2xl p-6 sm:p-8">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={current.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      transition={{ duration: 0.4 }}
                    >
                      <p className="eyebrow">{current.name}</p>
                      <p className="mt-3 font-display text-4xl font-bold leading-none text-glow sm:text-5xl">{current.value}</p>
                      <p className="mt-2 text-xs text-mist">Стандарт: {current.norm}</p>

                      <div className="mt-5">
                        <div className="relative h-2 rounded-full bg-abyss/10">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.max(current.ratio * 100, 3)}%` }}
                            transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
                            className="h-full rounded-full bg-gradient-to-r from-leaf to-water"
                          />
                        </div>
                        <div className="mt-2 flex justify-between text-[10px] tracking-widest text-mist">
                          <span>0</span>
                          <span>ЗӨВШӨӨРӨГДӨХ ДЭЭД ХЯЗГААР</span>
                        </div>
                      </div>

                      <p className="mt-5 text-sm leading-relaxed text-abyss/85">{current.text}</p>
                      <p className="mt-5 inline-flex items-center gap-2 rounded-full bg-leaf/10 px-3.5 py-1.5 text-xs text-leaf">
                        <span className="h-2 w-2 rounded-full bg-leaf" /> Стандартын шаардлага хангасан
                      </p>
                    </motion.div>
                  </AnimatePresence>
                  <p className="mt-6 text-[11px] text-mist/70">
                    * Үзүүлэлтүүд нь MNS 0900:2018 стандартын дагуу. Бодит хэмжилтийн утгаар шинэчилнэ.
                  </p>
                </div>
              </div>
            </div>
          </section>
        </DropReveal>
      </div>
    </>
  );
}
