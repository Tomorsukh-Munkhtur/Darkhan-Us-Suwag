"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useInView } from "framer-motion";
import { qualityParams, qualityStats } from "@/lib/content";
import SectionHeading from "../ui/SectionHeading";

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

export default function WaterQuality() {
  const [sel, setSel] = useState(qualityParams[0].id);
  const current = qualityParams.find((p) => p.id === sel)!;

  return (
    <section id="quality" className="relative overflow-hidden py-24 sm:py-32">
      <div className="pointer-events-none absolute -right-40 top-20 h-[520px] w-[520px] rounded-full bg-aqua/20 blur-[120px]" />
      <div className="mx-auto max-w-7xl px-4 sm:px-8">
        <SectionHeading
          index="04"
          eyebrow="Water Quality"
          title={
            <>
              УСНЫ <span className="text-water">ЧАНАР</span>
            </>
          }
          lead="Цэвэр ус бол бидний хамгийн чухал хариуцлага."
        />

        <div className="mt-16 grid grid-cols-2 gap-px overflow-hidden rounded-3xl border border-abyss/10 bg-abyss/10 lg:grid-cols-4">
          {qualityStats.map((s) => (
            <div key={s.label} className="bg-white p-6 sm:p-10">
              <div className="font-display text-4xl font-bold sm:text-6xl">
                <Counter to={s.value} suffix={s.suffix} />
              </div>
              <p className="mt-3 text-[11px] uppercase tracking-[0.2em] text-mist">{s.label}</p>
            </div>
          ))}
        </div>

        <div className="mt-16 grid gap-8 lg:grid-cols-[1fr_1.2fr]">
          <div className="flex flex-col gap-3" role="tablist" aria-label="Усны чанарын үзүүлэлт">
            {qualityParams.map((p) => (
              <button
                key={p.id}
                role="tab"
                aria-selected={sel === p.id}
                onClick={() => setSel(p.id)}
                className={`flex items-center justify-between rounded-2xl border px-6 py-5 text-left transition ${
                  sel === p.id
                    ? "border-water/60 bg-water/10"
                    : "border-abyss/10 bg-white/60 hover:border-abyss/25 hover:bg-white"
                }`}
              >
                <span className="font-display text-sm tracking-wider">{p.name}</span>
                <span className={`font-display text-lg ${sel === p.id ? "text-water" : "text-abyss/70"}`}>
                  {p.value}
                </span>
              </button>
            ))}
          </div>

          <div className="glass relative overflow-hidden rounded-3xl p-8 sm:p-12">
            <AnimatePresence mode="wait">
              <motion.div
                key={current.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.4 }}
              >
                <p className="eyebrow">{current.name}</p>
                <p className="mt-4 font-display text-6xl font-bold text-glow sm:text-7xl">{current.value}</p>
                <p className="mt-2 text-sm text-mist">Стандарт: {current.norm}</p>

                <div className="mt-8">
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

                <p className="mt-8 leading-relaxed text-abyss/85">{current.text}</p>
                <p className="mt-8 inline-flex items-center gap-2 rounded-full bg-leaf/10 px-4 py-2 text-xs text-leaf">
                  <span className="h-2 w-2 rounded-full bg-leaf" /> Стандартын шаардлага хангасан
                </p>
              </motion.div>
            </AnimatePresence>
            <p className="mt-10 text-[11px] text-mist/70">
              * Үзүүлэлтүүд нь MNS 0900:2018 стандартын дагуу. Бодит хэмжилтийн утгаар шинэчилнэ.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
