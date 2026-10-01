import { useId } from "react";
import { seeded } from "@/lib/seeded";

/**
 * Дархан хотын схем газрын зураг (1600×900). Бодит газарзүйн байршил биш, ерөнхий бүтэц.
 * `active` — cityFlow-ийн идэвхтэй алхам: 0 эх үүсвэр … 5 хэрэглэгчид.
 * Газар, гол viewBox-оос хальж зурагдсан тул камер ойртоход ирмэг ил гарахгүй.
 */

type Bld = { x: number; y: number; w: number; h: number; d: number };

/** Хорооллын барилгууд; d — гэрэл асах саатал (шугам орж ирэх цэгээс холдох тусам). */
function district(seed: number, [x0, y0, x1, y1]: number[], [sx, sy]: number[], [w0, w1, h0, h1]: number[], [cx, cy]: number[]) {
  const r = seeded(seed);
  const out: Bld[] = [];
  for (let y = y0; y < y1; y += sy)
    for (let x = x0; x < x1; x += sx) {
      if (r() < 0.14) continue;
      out.push({ x, y, w: w0 + r() * (w1 - w0), h: h0 + r() * (h1 - h0), d: Math.min(1800, Math.round(Math.hypot(x - cx, y - cy) * 1.6)) });
    }
  return out;
}

const districts = [
  { name: "ХУУЧИН ДАРХАН", lx: 330, ly: 438, b: district(3, [96, 470, 560, 780], [60, 56], [34, 48, 26, 40], [460, 450]) },
  { name: "ШИНЭ ДАРХАН", lx: 1270, ly: 288, b: district(7, [1050, 322, 1490, 500], [62, 58], [34, 50, 26, 42], [1040, 300]) },
  { name: "ҮЙЛДВЭРИЙН РАЙОН", lx: 1285, ly: 598, b: district(9, [1060, 632, 1520, 830], [112, 84], [60, 96, 40, 60], [1040, 610]) },
];

const RIVER = "M-900 120C-600 60-300 170-40 130C160 90 360 185 600 150S1010 85 1220 135S1520 190 1640 150S2100 90 2500 140";
const WELLS = [
  [170, 214],
  [250, 236],
  [330, 210],
  [410, 238],
];

// Цэвэр усны шугам: [алхам, path]
const WATER: [number, string][] = [
  [1, "M170 262H520V282M170 226V262M250 248V262M330 222V262M410 250V262"],
  [1, "M538 300H552V240H566"],
  [2, "M600 274V360H622"],
  [3, "M640 378C620 430 540 450 460 450H110M200 450V780M330 450V780M460 450V780M110 620H560"],
  [3, "M658 356C780 330 920 300 1040 300H1500M1160 300V510M1310 300V510M1040 410H1500"],
  [3, "M650 378C700 520 860 600 1040 610H1530M1140 610V840M1290 610V840M1430 610V840M1040 730H1530"],
];
const SEWER = "M110 860H1580V232H1480M330 780V860M1290 840V860M1500 410H1580";

const LABEL = { fontFamily: "var(--font-sans)", fontWeight: 700, letterSpacing: 3 } as const;

export default function DarkhanMap({ active, className }: { active: number; className?: string }) {
  const id = useId();
  const on = (k: number) => active >= k;
  const draw = (k: number, delay = 0) => ({
    strokeDashoffset: on(k) ? 0 : 1,
    transition: `stroke-dashoffset 1.6s cubic-bezier(.22,1,.36,1) ${on(k) ? delay : 0}ms`,
  });
  const fade = (k: number) => ({ opacity: on(k) ? 1 : 0, transition: "opacity .8s" });
  const lit = on(5);

  return (
    <svg viewBox="0 0 1600 900" overflow="visible" className={className} aria-hidden>
      <defs>
        <pattern id={`${id}grid`} width="48" height="48" patternUnits="userSpaceOnUse">
          <path d="M48 0H0V48" fill="none" stroke="#38b6f0" strokeOpacity=".07" />
        </pattern>
        <radialGradient id={`${id}res`}>
          <stop offset="0" stopColor="#5fc4f0" />
          <stop offset="1" stopColor="#1f7fbf" />
        </radialGradient>
      </defs>

      {/* газар */}
      <rect x="-900" y="-700" width="3400" height="2300" fill="#06223b" />
      <rect x="-900" y="-700" width="3400" height="2300" fill={`url(#${id}grid)`} />
      <g fill="#0d3a35">
        <ellipse cx="110" cy="860" rx="170" ry="70" />
        <ellipse cx="1580" cy="520" rx="90" ry="130" />
        <ellipse cx="250" cy="340" rx="90" ry="46" />
        <ellipse cx="-200" cy="520" rx="260" ry="160" />
        <ellipse cx="1900" cy="760" rx="240" ry="150" />
      </g>

      {/* Хараа гол */}
      <path d={RIVER} fill="none" stroke="#0f4a73" strokeWidth="54" strokeLinecap="round" />
      <path d={RIVER} fill="none" stroke="#1a6a9c" strokeWidth="22" strokeLinecap="round" />
      <path className="flow-slow" d={RIVER} fill="none" stroke="#fff" strokeWidth="3" />
      <text x="1400" y="104" fill="#8fb3c9" fontSize="16" style={LABEL}>
        ХАРАА ГОЛ
      </text>

      {/* хороолол — хэрэглэгчдийн алхамд гэрэлтэнэ */}
      {districts.map((d) => (
        <g key={d.name}>
          {d.b.map((b, i) => (
            <rect
              key={i}
              x={b.x}
              y={b.y}
              width={b.w}
              height={b.h}
              rx="4"
              style={{ fill: lit ? "#2f8fc8" : "#123a5c", transition: `fill .8s ${lit ? b.d : 0}ms` }}
            />
          ))}
          <text x={d.lx} y={d.ly} textAnchor="middle" fontSize="15" style={{ ...LABEL, fill: lit ? "#e4f2fb" : "#8fb3c9", transition: "fill .8s" }}>
            {d.name}
          </text>
        </g>
      ))}

      {/* бохир усны шугам (цэвэрлэх байгууламжийн алхам) */}
      <path d={SEWER} fill="none" stroke="#173d36" strokeWidth="4" />
      <path d={SEWER} fill="none" stroke="#1fa37a" strokeWidth="4" pathLength={1} strokeDasharray="1" style={draw(4)} />
      <path className="flow-slow" d={SEWER} fill="none" stroke="#fff" strokeWidth="2" style={fade(4)} />

      {/* цэвэр усны шугам */}
      {WATER.map(([k, d], i) => (
        <g key={i}>
          <path d={d} fill="none" stroke="#173f5f" strokeWidth="5" />
          <path d={d} fill="none" stroke="#38b6f0" strokeWidth="5" pathLength={1} strokeDasharray="1" style={draw(k, i * 180)} />
          <path className="flow" d={d} fill="none" stroke="#fff" strokeWidth="2" style={fade(k)} />
        </g>
      ))}

      {/* эх үүсвэр: худгууд */}
      {WELLS.map(([x, y], i) => (
        <g key={i}>
          {active === 0 && <circle className="ripple" cx={x} cy={y} r="26" fill="none" stroke="#38b6f0" strokeWidth="2" style={{ animationDelay: `${i * 0.4}s` }} />}
          <circle cx={x} cy={y} r="10" fill="#0b2e4c" stroke="#38b6f0" strokeWidth="3" />
          <circle cx={x} cy={y} r="4" fill="#38b6f0" />
        </g>
      ))}

      {/* насос станцууд */}
      {[
        [520, 300],
        [640, 360],
      ].map(([x, y]) => (
        <g key={x}>
          {active === 1 && <circle className="ripple" cx={x} cy={y} r="34" fill="none" stroke="#38b6f0" strokeWidth="2" />}
          <rect x={x - 18} y={y - 18} width="36" height="36" rx="8" style={{ fill: on(1) ? "#38b6f0" : "#0b2e4c", transition: "fill .6s" }} stroke="#38b6f0" strokeWidth="3" />
          <circle cx={x} cy={y} r="7" fill="none" style={{ stroke: on(1) ? "#0b2e4c" : "#38b6f0", transition: "stroke .6s" }} strokeWidth="3" />
        </g>
      ))}

      {/* усан сан */}
      <g>
        {active === 2 && <circle className="ripple" cx="600" cy="240" r="60" fill="none" stroke="#38b6f0" strokeWidth="2" />}
        <circle cx="600" cy="240" r="34" fill="#0b2e4c" stroke="#38b6f0" strokeWidth="3" />
        <circle cx="600" cy="240" r="27" fill={`url(#${id}res)`} style={{ transform: `scale(${on(2) ? 1 : 0})`, transformOrigin: "600px 240px", transition: "transform 1.2s cubic-bezier(.22,1,.36,1)" }} />
      </g>

      {/* цэвэрлэх байгууламж */}
      <g>
        <path d="M1400 198V160" stroke="#1fa37a" strokeWidth="4" style={fade(4)} />
        {[
          [1400, 228, 30],
          [1456, 236, 22],
        ].map(([x, y, r]) => (
          <g key={x}>
            {active === 4 && <circle className="ripple" cx={x} cy={y} r={r + 26} fill="none" stroke="#1fa37a" strokeWidth="2" />}
            <circle cx={x} cy={y} r={r} fill="#0b2e4c" stroke="#1fa37a" strokeWidth="3" />
            <circle cx={x} cy={y} r={r - 7} style={{ fill: on(4) ? "#34c28a" : "#123a38", transition: "fill .8s" }} />
          </g>
        ))}
      </g>

    </svg>
  );
}
