"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { seeded } from "@/lib/seeded";

gsap.registerPlugin(ScrollTrigger);

/** Visual-ийн scroll-д холбогдсон timeline үүсгэнэ. */
function useScrub<T extends Element>(build: (tl: gsap.core.Timeline, q: (s: string) => Element[]) => void) {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        // Карт дэлгэцийн голд ирэхэд анимац дуусна
        scrollTrigger: { trigger: el, start: "top 90%", end: "center 55%", scrub: 0.8 },
      });
      build(tl, gsap.utils.selector(el));
    }, el);
    return () => ctx.revert();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return ref;
}

const W = "#0078be";
const INK = "#04213a";
const MIST = "#56758d";
const LINE = "#9cc7e0";

/* 2.1 — Эх үүсвэр: terrain + гол + гүний уст давхарга */
export function SourceVisual() {
  const ref = useScrub<SVGSVGElement>((tl, q) => {
    tl.from(q(".mtn"), { y: 60, opacity: 0, stagger: 0.1 })
      .fromTo(q(".river"), { strokeDashoffset: 1 }, { strokeDashoffset: 0 }, 0.1)
      .from(q(".zone"), { scale: 0, opacity: 0, transformOrigin: "50% 50%", stagger: 0.12 }, 0.3)
      .from(q(".aq"), { opacity: 0, x: -40 }, 0.35);
  });
  return (
    <svg ref={ref} viewBox="0 0 400 400" className="h-full w-full">
      <defs>
        <linearGradient id="sv-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#d6eefb" />
          <stop offset="1" stopColor="#f5fbff" />
        </linearGradient>
        <linearGradient id="sv-aq" x1="0" x2="1">
          <stop offset="0" stopColor={W} stopOpacity="0" />
          <stop offset=".5" stopColor={W} stopOpacity=".7" />
          <stop offset="1" stopColor={W} stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect width="400" height="400" fill="url(#sv-sky)" />
      <path className="mtn" d="M0 210 L70 120 L130 180 L200 90 L270 170 L330 110 L400 190 V260 H0Z" fill="#b7d9ec" />
      <path className="mtn" d="M0 240 L90 170 L160 220 L240 150 L320 215 L400 180 V270 H0Z" fill="#94c3de" />
      <rect y="255" width="400" height="145" fill="#e2eef4" />
      <rect y="255" width="400" height="2" fill={LINE} opacity=".8" />
      {/* Хамгаалалтын бүс */}
      {[70, 50, 30].map((r, i) => (
        <circle
          key={r}
          className="zone"
          cx="250"
          cy="256"
          r={r}
          fill="none"
          stroke={W}
          strokeOpacity={0.25 + i * 0.2}
          strokeDasharray="3 5"
        />
      ))}
      <path
        className="river"
        d="M40 262 C120 250 160 275 250 258 S360 262 400 250"
        fill="none"
        stroke={W}
        strokeWidth="5"
        strokeLinecap="round"
        pathLength={1}
        strokeDasharray="1"
      />
      <path
        className="flow"
        d="M40 262 C120 250 160 275 250 258 S360 262 400 250"
        fill="none"
        stroke="#ffffff"
        strokeWidth="1.5"
        strokeOpacity=".85"
      />
      <g className="aq">
        <rect x="0" y="320" width="400" height="34" fill="url(#sv-aq)" opacity=".5" />
        <text x="20" y="342" fill={MIST} fontSize="11" letterSpacing="2">
          ГҮНИЙ УСТ ҮЕ
        </text>
      </g>
      <text x="250" y="200" fill={INK} fontSize="11" textAnchor="middle" letterSpacing="2">
        ХАМГААЛАЛТЫН БҮС
      </text>
      <text x="20" y="385" fill={W} fontSize="10" letterSpacing="3">
        SOURCE · ХАРАА
      </text>
    </svg>
  );
}

/* 2.2 — Ус олборлолт: гүнээс дээш дусал хөдөлнө */
export function ExtractionVisual() {
  const ref = useScrub<SVGSVGElement>((tl, q) => {
    tl.fromTo(q(".lift"), { y: 0, opacity: 0 }, { y: -300, opacity: 1, stagger: 0.12, ease: "none" })
      .fromTo(q(".shaft-fill"), { scaleY: 0 }, { scaleY: 1, transformOrigin: "50% 100%", ease: "none" }, 0)
      .fromTo(q(".out"), { strokeDashoffset: 1 }, { strokeDashoffset: 0 }, 0.5);
  });
  return (
    <svg ref={ref} viewBox="0 0 400 400" className="h-full w-full">
      <rect width="400" height="120" fill="#e6f5fd" />
      <rect y="120" width="400" height="80" fill="#e4d6b8" opacity=".6" />
      <rect y="200" width="400" height="90" fill="#d3bf98" opacity=".6" />
      <rect y="290" width="400" height="110" fill="#c3e5f6" />
      <text x="16" y="112" fill={MIST} fontSize="10" letterSpacing="3">
        GROUND
      </text>
      <line x1="0" y1="120" x2="400" y2="120" stroke={MIST} strokeOpacity=".5" strokeDasharray="4 6" />
      <text x="16" y="385" fill={W} fontSize="10" letterSpacing="3">
        ГҮНИЙ УС
      </text>
      {/* худгийн хоолой */}
      <rect x="185" y="95" width="30" height="265" rx="4" fill="#ffffff" stroke={LINE} />
      <rect className="shaft-fill" x="191" y="100" width="18" height="255" rx="3" fill={W} opacity=".25" />
      {/* насос байшин */}
      <rect x="160" y="55" width="80" height="45" rx="6" fill="#ffffff" stroke={W} strokeOpacity=".5" />
      <text x="200" y="83" fill={INK} fontSize="11" textAnchor="middle" letterSpacing="3">
        PUMP
      </text>
      <g style={{ transformOrigin: "200px 318px" }} className="animate-[spin_2s_linear_infinite]">
        <path d="M200 305 L205 318 L200 331 L195 318Z M187 318 L200 313 L213 318 L200 323Z" fill={W} opacity=".8" />
      </g>
      {[0, 1, 2, 3, 4].map((i) => (
        <g key={i} transform={`translate(${190 + (i % 2) * 6} ${326 - i * 4}) scale(.7)`}>
          <path className="lift" d="M7 0C7 0 0 8 0 11.5C0 15.1 3.1 18 7 18S14 15.1 14 11.5C14 8 7 0 7 0Z" fill={W} />
        </g>
      ))}
      <path
        className="out"
        d="M240 78 H380"
        stroke={W}
        strokeWidth="6"
        strokeLinecap="round"
        pathLength={1}
        strokeDasharray="1"
      />
      <text x="370" y="60" fill={MIST} fontSize="10" textAnchor="end">
        → цуглуулах шугам
      </text>
    </svg>
  );
}

/* 2.3 — Цэвэршүүлэлт: бохирдуулагч багасаж, ус тунгалаг болно */
export function TreatmentVisual() {
  const rand = seeded(7);
  const dots = Array.from({ length: 46 }, () => ({
    x: 70 + rand() * 150,
    y: 70 + rand() * 270,
    r: 1.5 + rand() * 3.5,
  }));
  const steps = ["Түүхий ус", "Шүүх", "Цэвэршүүлэх", "Халдваргүйжүүлэх", "Бэлэн ус"];
  const ref = useScrub<SVGSVGElement>((tl, q) => {
    tl.fromTo(q(".murk"), { attr: { fill: "#6d5a36" } }, { attr: { fill: W }, ease: "none" }, 0)
      .to(q(".dirt"), { opacity: 0, scale: 0, transformOrigin: "50% 50%", stagger: { each: 0.01, from: "random" } }, 0)
      .fromTo(q(".step"), { opacity: 0.2 }, { opacity: 1, stagger: 0.18 }, 0)
      .fromTo(q(".step-dot"), { attr: { fill: LINE } }, { attr: { fill: W }, stagger: 0.18 }, 0);
  });
  return (
    <svg ref={ref} viewBox="0 0 400 400" className="h-full w-full">
      <rect x="60" y="50" width="170" height="300" rx="22" fill="#ffffff" stroke={LINE} />
      <rect className="murk" x="64" y="70" width="162" height="276" rx="18" fill="#6d5a36" opacity=".35" />
      {dots.map((d, i) => (
        <circle key={i} className="dirt" cx={d.x} cy={d.y} r={d.r} fill="#a68a55" opacity=".8" />
      ))}
      <path className="flow-slow" d="M80 70 Q145 60 210 70" stroke={W} strokeOpacity=".4" fill="none" />
      <line x1="270" y1="80" x2="270" y2="320" stroke={LINE} />
      {steps.map((s, i) => (
        <g key={s} className="step">
          <circle className="step-dot" cx="270" cy={80 + i * 60} r="6" fill={LINE} />
          <text x="286" y={84 + i * 60} fill={INK} fontSize="12">
            {s}
          </text>
        </g>
      ))}
      <text x="60" y="380" fill={W} fontSize="10" letterSpacing="3">
        RAW → TREATMENT → CLEAN
      </text>
    </svg>
  );
}

/* 2.4 — Усан сан: scroll хийхэд усны түвшин дээшилнэ */
export function ReservoirVisual() {
  const pct = useRef<SVGTextElement>(null);
  const ref = useScrub<SVGSVGElement>((tl, q) => {
    const state = { v: 12 };
    tl.fromTo(q(".level"), { y: 220 }, { y: 30, ease: "none" }, 0).to(
      state,
      {
        v: 86,
        ease: "none",
        onUpdate: () => {
          if (pct.current) pct.current.textContent = `${Math.round(state.v)}%`;
        },
      },
      0,
    );
  });
  return (
    <svg ref={ref} viewBox="0 0 400 400" className="h-full w-full">
      <defs>
        <clipPath id="tank-clip">
          <path d="M90 90 A110 26 0 0 0 310 90 V310 A110 26 0 0 1 90 310Z" />
        </clipPath>
        <linearGradient id="tank-w" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7dd6f5" stopOpacity=".9" />
          <stop offset="1" stopColor={W} stopOpacity=".9" />
        </linearGradient>
      </defs>
      <path d="M90 90 V310 A110 26 0 0 0 310 310 V90" fill="#ffffff" stroke={LINE} strokeWidth="2" />
      <g clipPath="url(#tank-clip)">
        <g className="level" transform="translate(0 220)">
          <g className="animate-[wave_4s_linear_infinite]">
            <path
              d="M0 100 Q25 88 50 100 T100 100 T150 100 T200 100 T250 100 T300 100 T350 100 T400 100 T450 100 T500 100 V400 H0Z"
              fill="url(#tank-w)"
            />
          </g>
        </g>
      </g>
      <ellipse cx="200" cy="90" rx="110" ry="26" fill="#eaf6fd" stroke={LINE} strokeWidth="2" />
      {[150, 200, 250].map((y) => (
        <line key={y} x1="300" y1={y} x2="312" y2={y} stroke={MIST} strokeOpacity=".6" />
      ))}
      <text ref={pct} x="200" y="220" fill={INK} fontSize="42" textAnchor="middle" fontWeight="700">
        12%
      </text>
      <text x="200" y="245" fill={INK} fillOpacity=".7" fontSize="10" textAnchor="middle" letterSpacing="3">
        НӨӨЦ
      </text>
      <style>{`@keyframes wave{from{transform:translateX(0)}to{transform:translateX(-100px)}}`}</style>
    </svg>
  );
}

/* 2.5 — Шугам сүлжээ: хот руу шугам гэрэлтэнэ */
export function NetworkVisual() {
  const rand = seeded(21);
  const blocks = Array.from({ length: 30 }, (_, i) => ({
    x: 120 + (i % 6) * 44 + rand() * 6,
    y: 150 + Math.floor(i / 6) * 44 + rand() * 6,
    h: 10 + rand() * 20,
  }));
  const pipes = [
    "M30 60 C90 60 100 120 140 140",
    "M140 140 H380",
    "M140 140 V360",
    "M140 228 H380",
    "M140 316 H380",
    "M272 140 V360",
  ];
  const ref = useScrub<SVGSVGElement>((tl, q) => {
    tl.fromTo(q(".pipe"), { strokeDashoffset: 1 }, { strokeDashoffset: 0, stagger: 0.12, ease: "none" }, 0).fromTo(
      q(".bld"),
      { fill: "#d5e6f0" },
      { fill: "#5bb8e8", stagger: { each: 0.02, from: "start" } },
      0.3,
    );
  });
  return (
    <svg ref={ref} viewBox="0 0 400 400" className="h-full w-full">
      <circle cx="30" cy="60" r="10" fill={W} />
      <circle cx="30" cy="60" r="10" fill={W} className="pulse-ring" />
      <text x="46" y="45" fill={MIST} fontSize="10" letterSpacing="2">
        WATER SOURCE
      </text>
      {blocks.map((b, i) => (
        <rect key={i} className="bld" x={b.x} y={b.y} width="26" height={b.h} rx="3" fill="#d5e6f0" />
      ))}
      {pipes.map((d) => (
        <g key={d}>
          <path d={d} stroke="#d3e5ef" strokeWidth="4" fill="none" />
          <path
            className="pipe"
            d={d}
            stroke={W}
            strokeWidth="3"
            fill="none"
            pathLength={1}
            strokeDasharray="1"
            style={{ filter: "drop-shadow(0 0 5px rgba(0, 120, 190, 0.45))" }}
          />
        </g>
      ))}
      <text x="380" y="388" fill={W} fontSize="11" textAnchor="end" letterSpacing="3">
        DARHAN CITY
      </text>
    </svg>
  );
}

/* 2.6 — Хэрэглэгч: ус таны гэрт хүрнэ */
export function HomeVisual() {
  const ref = useScrub<SVGSVGElement>((tl, q) => {
    tl.fromTo(q(".hp"), { strokeDashoffset: 1 }, { strokeDashoffset: 0, stagger: 0.2, ease: "none" })
      .fromTo(q(".house"), { opacity: 0.25 }, { opacity: 1 }, 0.5)
      .fromTo(q(".win"), { fill: "#d5e3ec" }, { fill: "#ffc94d" }, 0.7);
  });
  return (
    <svg ref={ref} viewBox="0 0 400 400" className="h-full w-full">
      <text x="200" y="50" fill={INK} fontSize="16" textAnchor="middle" letterSpacing="6" fontWeight="700">
        DARHAN
      </text>
      <path className="hp" d="M200 62 V170" stroke={W} strokeWidth="4" pathLength={1} strokeDasharray="1" />
      <path className="hp" d="M200 130 H70 M200 130 H330" stroke={W} strokeWidth="3" pathLength={1} strokeDasharray="1" />
      <text x="215" y="120" fill={W} fontSize="10" letterSpacing="4">
        WATER
      </text>
      <g className="house">
        <path d="M110 250 L200 180 L290 250" fill="none" stroke={INK} strokeWidth="3" strokeLinejoin="round" />
        <rect x="125" y="245" width="150" height="110" fill="#ffffff" stroke={INK} strokeWidth="3" />
        <rect className="win" x="145" y="265" width="36" height="30" fill="#d5e3ec" />
        <rect className="win" x="219" y="265" width="36" height="30" fill="#d5e3ec" />
        <text x="200" y="335" fill={INK} fontSize="12" textAnchor="middle" letterSpacing="4">
          HOME
        </text>
      </g>
      {/* цорго + дусал */}
      <path d="M300 300 H330 V312" stroke={MIST} strokeWidth="4" fill="none" />
      <path
        d="M323 318c0 0-4 5-4 7a4 4 0 008 0c0-2-4-7-4-7z"
        fill={W}
        style={{ animation: "drip 1.6s ease-in infinite", transformBox: "fill-box" }}
      />
    </svg>
  );
}
