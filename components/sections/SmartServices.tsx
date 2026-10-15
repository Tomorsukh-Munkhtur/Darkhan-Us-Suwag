"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { app, smart } from "@/lib/content";
import { hasWebGL2 } from "@/components/three/journey/utils/browser";
import SmartMeter3D from "@/components/three/meter/SmartMeter3D";
import { prefersReducedMotion } from "@/lib/motion";
import SectionHeading from "../ui/SectionHeading";
import WaterEdge from "./services/WaterEdge";
import { AppPhone, StoreButton, apple, play } from "./AppPromo";
import BillScreen from "./smart/BillScreen";

gsap.registerPlugin(ScrollTrigger);

const WaterSurface = dynamic(() => import("@/components/three/WaterSurface"), { ssr: false });

const N = smart.steps.length;
/** алхам бүрт ногдох scroll (дэлгэцийн өндрийн хувь) */
const STEP_VH = 80;
/** апп-ын "сүүлийн заалт" (тоолуурын 3D эхлэх заалттай ижил — MeterScene3D METER_START) */
const LAST = "1234.21";
/** 3D ажиллахгүй үед 2-р алхамд харагдах шинэ заалт */
const NEXT = "1234.54";
const BG = "#05182b";
const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Тоолуурын антенаас утасны дэлгэц рүү заалт нисэх зам (stage-ийн 160×110 координатаар — stage aspect 16/11).
 * Дохионы цэгүүд зөвхөн илгээх алхамд (step 1) нисэнэ.
 */
const LINK = "M62 33 C 78 4, 106 2, 124 24";
function SignalPath({ on }: { on: boolean }) {
  return (
    <svg aria-hidden viewBox="0 0 160 110" className="pointer-events-none absolute inset-0 z-[5] h-full w-full overflow-visible">
      <path
        d={LINK}
        fill="none"
        stroke="#5fd3f7"
        strokeWidth="0.5"
        strokeDasharray="1.5 2"
        className={`transition-opacity duration-500 ${on ? "opacity-70" : "opacity-15"}`}
      />
      <g className={`transition-opacity duration-500 ${on ? "opacity-100" : "opacity-0"}`}>
        {[0, 1, 2].map((i) => (
          <circle key={i} r="1.6" fill="#bff0ff" style={{ filter: "drop-shadow(0 0 2px #5fd3f7)" }}>
            <animateMotion dur="1.5s" begin={`${i * 0.5}s`} repeatCount="indefinite" path={LINK} />
          </circle>
        ))}
      </g>
    </svg>
  );
}

/**
 * Ухаалаг үйлчилгээ — бараан, дэлгэцэнд тогтоно (sticky). Гүйлгэх тусам 3 алхам ээлжлэн:
 * 1) ухаалаг тоолуур заалтаа уншина (3D — заалт тоологдоно) → 2) заалт дохио болж BILL center руу нисч, утасны дэлгэцэд
 * мэдэгдэл ирнэ, заалт (тоолуурынхтой ижил тоо) шинэчлэгдэнэ → 3) төлбөр төлөгдөнө. Зүүн талд алхмуудын жагсаалт
 * (идэвхтэй нь дэлгэгдэнэ, дээр нь дарвал тэр алхам руу гулсана), баруун талд тоолуур + утас.
 * Дээд ирмэг нь бараан усны гадаргуу (WaterEdge) — өмнөх цайвар хэсгийн дээгүүр гарна.
 */
export default function SmartServices() {
  const root = useRef<HTMLElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const bars = useRef<(HTMLSpanElement | null)[]>([]);
  const readingEl = useRef<HTMLSpanElement>(null);
  const live = useRef<string | null>(null);
  const [step, setStep] = useState(0);
  const stepRef = useRef(0);
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

    // алхам: track-ийн явцаар; алхам бүрийн дотоод явц — зүүн талын шугам дүүрнэ
    const update = (p: number) => {
      const s = Math.min(N - 1, Math.floor(p * N));
      bars.current.forEach((b, i) => b && (b.style.transform = `scaleY(${gsap.utils.clamp(0, 1, p * N - i).toFixed(3)})`));
      if (s !== stepRef.current) {
        stepRef.current = s;
        setStep(s);
      }
    };
    const st = ScrollTrigger.create({
      trigger: track.current,
      start: "top top",
      end: "bottom bottom",
      onUpdate: (self) => update(self.progress),
      onRefresh: (self) => update(self.progress),
    });
    return () => {
      io.disconnect();
      st.kill();
    };
  }, []);

  // утасны заалт: эхний алхамд сүүлийн заалт, дараа нь тоолуурынхтой ижил (шууд)
  useEffect(() => {
    if (readingEl.current) readingEl.current.textContent = step === 0 ? LAST : (live.current ?? NEXT);
  }, [step]);
  const onReading = useCallback((v: number) => {
    live.current = v.toFixed(2);
    if (stepRef.current > 0 && readingEl.current) readingEl.current.textContent = live.current;
  }, []);

  const cur = smart.steps[step];

  return (
    <section id="services" ref={root} data-nav-dark className="theme-dark relative text-abyss" style={{ backgroundColor: BG }}>
      {/* дээд ирмэг: бараан усны гадаргуу өмнөх (цайвар) хэсгийн дээгүүр гарна */}
      <div aria-hidden className="absolute inset-x-0 top-0 z-30 h-0" style={{ "--svc-top": BG } as React.CSSProperties}>
        <WaterEdge variant="calm" />
      </div>

      {/* дэвсгэр: гэрэлтсэн толбо, нарийн тор (техник), усны урсгал */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(55%_45%_at_72%_42%,rgba(56,182,240,.22),transparent_70%),radial-gradient(40%_35%_at_15%_70%,rgba(52,194,138,.10),transparent_70%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(rgba(143,214,247,.14)_1px,transparent_1px)] [background-size:28px_28px] [mask-image:linear-gradient(transparent,#000_15%,#000_85%,transparent)]" />
        <div className="svc-flow sticky top-0 h-[100svh] overflow-hidden opacity-70">
          {flow && <WaterSurface running={near} reduced={flow.reduced} strength={0.32} speed={0.8} even />}
        </div>
      </div>

      <div className="relative mx-auto max-w-7xl px-4 pt-24 sm:px-8 sm:pt-32">
        <SectionHeading
          eyebrow={smart.eyebrow}
          align="center"
          title={
            <>
              {smart.title} <span className="text-water text-glow">{smart.accent}</span>
            </>
          }
          lead={smart.lead}
        />
      </div>

      {/* алхмууд: гүйлгэх зам — дотор нь дэлгэцэнд тогтох самбар. desktop дээр самбарын дээд хоосон зай гарчигтай давхцана
          (гарчиг ба алхмуудын хооронд хэт их зай гарахгүй) */}
      <div ref={track} className="relative lg:-mt-[16svh]" style={{ height: `calc(100svh + ${N * STEP_VH}svh)` }}>
        {smart.steps.map((s, i) => (
          <span key={s.id} id={`smart-${s.id}`} aria-hidden className="absolute left-0 w-px" style={{ top: `${(i + 0.5) * STEP_VH}svh` }} />
        ))}

        <div className="sticky top-0 flex h-[100svh] items-center overflow-hidden pb-6 pt-20 lg:pt-24">
          <div className="mx-auto grid w-full max-w-7xl items-center gap-6 px-4 sm:px-8 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-14">
            {/* тоолуур + утас (утсан дээр дээр нь) */}
            <div className="relative aspect-[16/11] w-full lg:order-2">
              {/* тоолуурын 3D карт */}
              <div className="absolute left-0 top-[6%] h-[88%] w-[74%] overflow-hidden rounded-[1.75rem] bg-[radial-gradient(ellipse_at_50%_35%,#174d78,#0b2e4c_60%,#06203a)] shadow-[0_40px_90px_-40px_rgba(0,0,0,.8)] ring-1 ring-white/10">
                <SmartMeter3D className="h-full w-full" boost={step === 1 ? 1 : 0} onReading={onReading} />
                {/* төлөв */}
                <span className="absolute left-3 top-3 flex items-center gap-2 rounded-full border border-white/10 bg-[#071f36]/80 px-3 py-1.5 font-display text-[10px] font-semibold tracking-[0.18em] text-abyss backdrop-blur sm:left-4 sm:top-4 sm:text-[11px]">
                  <span className={`h-1.5 w-1.5 rounded-full ${step === 2 ? "bg-leaf" : "animate-pulse bg-aqua"}`} />
                  {cur.chip.toUpperCase()}
                </span>
                <span className="absolute bottom-3 left-3 font-display text-[10px] tracking-[0.25em] text-mist sm:bottom-4 sm:left-4">УХААЛАГ ТООЛУУР</span>
              </div>

              <SignalPath on={step === 1} />

              {/* BILL center апп */}
              <div className="absolute right-0 top-[-1%] z-10 w-[40%]">
                <span aria-hidden className="absolute -inset-[15%] rounded-full bg-[radial-gradient(circle,rgba(56,182,240,.35),transparent_62%)]" />
                <div className="relative motion-safe:animate-[app-float_7s_ease-in-out_infinite]">
                  <AppPhone className="w-full" content={<BillScreen ref={readingEl} step={step} reading={LAST} />} />
                </div>
              </div>
            </div>

            {/* алхмууд */}
            <div className="lg:order-1">
              <ol className="relative">
                {smart.steps.map((s, i) => {
                  const on = i === step;
                  return (
                    <li key={s.id} className="relative pb-4 pl-14 last:pb-0 sm:pb-5">
                      {/* алхмын шугам: дараагийн алхам руу дүүрнэ */}
                      {i < N - 1 && (
                        <span aria-hidden className="absolute bottom-0 left-[19px] top-11 w-[2px] overflow-hidden rounded-full bg-white/10">
                          <span
                            ref={(el) => {
                              bars.current[i] = el;
                            }}
                            className="block h-full origin-top scale-y-0 bg-[linear-gradient(#5fd3f7,#38b6f0)]"
                          />
                        </span>
                      )}
                      <a href={`#smart-${s.id}`} aria-current={on ? "step" : undefined} className="group block">
                        <span
                          className={`absolute left-0 top-0 grid h-10 w-10 place-items-center rounded-full border font-display text-xs font-semibold transition-all duration-500 ${
                            i <= step
                              ? "border-aqua bg-aqua/15 text-aqua shadow-[0_0_24px_-4px_rgba(95,211,247,.7)]"
                              : "border-white/15 text-mist group-hover:border-white/35"
                          }`}
                        >
                          {i < step ? (
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                              <path d="M20 6L9 17l-5-5" />
                            </svg>
                          ) : (
                            pad(i + 1)
                          )}
                        </span>
                        <p className={`font-display text-[11px] tracking-[0.25em] uppercase transition-colors ${on ? "text-aqua" : "text-mist"}`}>{s.label}</p>
                        <h3
                          className={`mt-1 font-display font-bold leading-tight transition-all duration-500 ${
                            on ? "text-h3 text-abyss" : "text-lg text-abyss/55 group-hover:text-abyss/80"
                          }`}
                        >
                          {s.title}
                        </h3>
                        {/* идэвхтэй алхмын тайлбар дэлгэгдэнэ */}
                        <div
                          className={`grid transition-[grid-template-rows,opacity] duration-500 ease-[cubic-bezier(.22,1,.36,1)] ${
                            on ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                          }`}
                        >
                          <p className="overflow-hidden pt-2 text-sm leading-relaxed text-mist sm:text-base">{s.text}</p>
                        </div>
                      </a>
                    </li>
                  );
                })}
              </ol>

              <div className="mt-6 flex flex-wrap items-center gap-3 sm:mt-8 [@media(max-height:720px)]:hidden">
                <StoreButton href={app.ios} label="App Store" icon={apple} />
                <StoreButton href={app.android} label="Google Play" icon={play} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
