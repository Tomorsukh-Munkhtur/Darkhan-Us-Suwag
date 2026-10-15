"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import { app, smart } from "@/lib/content";
import { hasWebGL2 } from "@/components/three/journey/utils/browser";
import { prefersReducedMotion } from "@/lib/motion";
import SectionHeading from "../ui/SectionHeading";
import { StoreButton, apple, play } from "./AppPromo";
import { Icon } from "./values/icons";
import SmartIllustration from "./smart/SmartIllustration";

const WaterSurface = dynamic(() => import("@/components/three/WaterSurface"), { ssr: false });

type StepId = (typeof smart.steps)[number]["id"];
const pad = (n: number) => String(n).padStart(2, "0");

const stepIcons: Record<StepId, React.ReactNode> = {
  // тоолуур — хэмжүүр
  read: (
    <>
      <circle cx="12" cy="13" r="8" />
      <path d="M12 13l3.5-3.5M9 3h6" />
    </>
  ),
  // утасгүй дамжуулалт
  send: (
    <>
      <path d="M5 12.5a10 10 0 0114 0M8 15.5a5.5 5.5 0 018 0" />
      <circle cx="12" cy="19" r="1.3" />
    </>
  ),
  // төлбөр — шалгагдсан
  pay: (
    <>
      <rect x="3" y="6" width="18" height="13" rx="2.5" />
      <path d="M3 10h18M8.5 15l2 2 4-4" />
    </>
  ),
};

/**
 * Ухаалаг үйлчилгээ — цайвар, тогтохгүй (ердийн гүйлгэлт). Дээр нь энгийн дүрслэл (тоолуур → дохио → BILL center апп,
 * smart/SmartIllustration.tsx), доор нь дүрслэлийн 1–3 дугаартай таарах 3 алхмын карт — дэлгэцэнд орж ирэхэд дараалан
 * гарна. Ард нь бусад цайвар хэсгүүдийнх шиг усны урсгалын хээ (WaterSurface). Дээд ирмэг нь бичлэгийн (About) доод
 * ирмэгийн усны гадаргуу, доод өнгө (#d9ecf8) нь дараагийн Усны чанар хэсгийн шилжилтийн дэвсгэртэй ижил.
 */
export default function SmartServices() {
  const root = useRef<HTMLElement>(null);
  const [flow, setFlow] = useState<{ reduced: boolean } | null>(null);
  const [near, setNear] = useState(false);

  useEffect(() => {
    const webgl = hasWebGL2();
    const io = new IntersectionObserver(
      ([e]) => {
        setNear(e.isIntersecting);
        if (e.isIntersecting && webgl) setFlow((f) => f ?? { reduced: prefersReducedMotion() });
      },
      { rootMargin: "200px 0px" },
    );
    io.observe(root.current!);
    return () => io.disconnect();
  }, []);

  return (
    <section id="services" ref={root} className="relative bg-[linear-gradient(#eef6fb,#d9ecf8_45%)] pb-24 pt-24 sm:pb-32 sm:pt-32">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="svc-flow sticky top-0 h-[100svh] overflow-hidden">
          {flow && <WaterSurface running={near} reduced={flow.reduced} strength={0.5} speed={0.9} even ink />}
        </div>
      </div>

      <div className="relative mx-auto max-w-6xl px-4 sm:px-8">
        <SectionHeading
          eyebrow={smart.eyebrow}
          align="center"
          title={
            <>
              {smart.title} <span className="text-water">{smart.accent}</span>
            </>
          }
          lead={smart.lead}
        />

        {/* дүрслэл */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="mt-12 rounded-[2rem] bg-white/70 px-4 py-6 shadow-[0_30px_80px_-50px_rgba(4,33,58,.45)] ring-1 ring-abyss/10 backdrop-blur-sm sm:mt-16 sm:px-10 sm:py-10"
        >
          <SmartIllustration className="mx-auto block h-auto w-full max-w-3xl" />
        </motion.div>

        {/* 3 алхам */}
        <ol className="mt-5 grid gap-4 sm:mt-6 lg:grid-cols-3 lg:gap-5">
          {smart.steps.map((s, i) => (
            <motion.li
              key={s.id}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.7, delay: i * 0.12, ease: [0.22, 1, 0.36, 1] }}
              className="relative rounded-[1.5rem] bg-white/80 p-6 shadow-[0_20px_50px_-35px_rgba(4,33,58,.4)] ring-1 ring-abyss/10 sm:p-7"
            >
              <div className="flex items-center gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-water/10 text-water">
                  <Icon className="h-6 w-6">{stepIcons[s.id]}</Icon>
                </span>
                <div className="leading-tight">
                  <p className="font-display text-[11px] tracking-[0.25em] text-mist uppercase">
                    <span className="text-water">{pad(i + 1)}</span> · {s.label}
                  </p>
                  <h3 className="mt-1 font-display text-lg font-bold sm:text-xl">{s.title}</h3>
                </div>
              </div>
              <p className="mt-4 text-sm leading-relaxed text-mist sm:text-base">{s.text}</p>
            </motion.li>
          ))}
        </ol>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3 sm:mt-10">
          <span className="w-full text-center font-display text-sm font-semibold sm:w-auto sm:pr-2">{app.name} татах:</span>
          <StoreButton href={app.ios} label="App Store" icon={apple} />
          <StoreButton href={app.android} label="Google Play" icon={play} />
        </div>
      </div>
    </section>
  );
}
