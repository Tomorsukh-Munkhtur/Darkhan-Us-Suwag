import { useId } from "react";
import { seeded } from "@/lib/seeded";

type Bld = { x: number; w: number; h: number; antenna?: boolean };

/** viewBox. "slice" + доод талд бэхэлсэн тул өргөн дэлгэцэнд ч өндрөөр нь масштабална. */
const W = 4000;
const H = 700;

// 1000–3000 нь дэлгэцэнд харагдах гол хэсэг. h > ~480 барилгууд "ДАРХАН ХОТ" бичгийн доод хэсгийг далдална.
const core: Bld[] = [
  { x: 1000, w: 110, h: 400 },
  { x: 1122, w: 84, h: 300 },
  { x: 1218, w: 120, h: 470, antenna: true },
  { x: 1350, w: 92, h: 360 },
  { x: 1455, w: 150, h: 530 },
  { x: 1618, w: 96, h: 330 },
  { x: 1726, w: 112, h: 420 },
  { x: 1850, w: 104, h: 505 },
  { x: 1966, w: 84, h: 280 },
  { x: 2062, w: 110, h: 390 },
  { x: 2184, w: 70, h: 300 },
  { x: 2266, w: 130, h: 540, antenna: true },
  { x: 2408, w: 90, h: 350 },
  { x: 2510, w: 120, h: 515 },
  { x: 2642, w: 80, h: 300 },
  { x: 2866, w: 134, h: 430 },
];

function fill(rand: () => number, from: number, to: number, minH: number, maxH: number, minW = 80, maxW = 170) {
  const out: Bld[] = [];
  let x = from;
  while (x < to) {
    const w = Math.min(minW + rand() * (maxW - minW), to - x);
    if (w > 30) out.push({ x, w, h: minH + rand() * (maxH - minH) });
    x += w + 8 + rand() * 18;
  }
  return out;
}

const rand = seeded(11);
const near = [...fill(rand, 0, 990, 260, 520), ...core, ...fill(rand, 3010, W, 260, 520)];
const far = fill(seeded(5), 0, W, 380, 640, 90, 210);

/** Цонхны тор: баганын 26, мөрийн 38 алхамтай, барилгын дотор голлуулсан. */
function windows(b: Bld) {
  const cols = Math.floor((b.w - 16) / 26);
  const rows = Math.floor((b.h - 60) / 38);
  const gw = cols * 26 - 14;
  return { cols, rows, x: b.x + (b.w - gw) / 2, y: H - b.h + 24, w: gw, h: rows * 38 - 20 };
}

const glintRand = seeded(3);
const glints = near.map((b) => {
  if (b.w < 70 || b.x < 1000 || b.x > 3000) return [];
  const g = windows(b);
  return Array.from({ length: 2 }, () => ({
    x: g.x + Math.floor(glintRand() * g.cols) * 26,
    y: g.y + Math.floor(glintRand() * g.rows) * 38,
  }));
});

export function FarSkyline({ className }: { className?: string }) {
  const id = useId();
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMax slice" className={className} aria-hidden>
      <defs>
        <linearGradient id={`${id}f`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#c3e1f2" />
          <stop offset="1" stopColor="#dcedf7" />
        </linearGradient>
      </defs>
      {far.map((b, i) => (
        <g key={i} className="bld-far">
          <rect x={b.x} y={H - b.h} width={b.w} height={b.h} fill={`url(#${id}f)`} />
          <rect x={b.x} y={H - b.h} width={b.w} height="6" fill="#b3d7ec" />
        </g>
      ))}
    </svg>
  );
}

export function NearSkyline({ className }: { className?: string }) {
  const id = useId();
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMax slice" className={className} aria-hidden>
      <defs>
        <linearGradient id={`${id}n`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7fbde3" />
          <stop offset="1" stopColor="#b3daf0" />
        </linearGradient>
        {near.map((b, i) => {
          if (b.w < 70) return null;
          const g = windows(b);
          return (
            <pattern key={i} id={`${id}w${i}`} x={g.x} y={g.y} width="26" height="38" patternUnits="userSpaceOnUse">
              <rect width="12" height="18" rx="1.5" fill="#fff" fillOpacity=".5" />
            </pattern>
          );
        })}
      </defs>

      {near.map((b, i) => {
        const top = H - b.h;
        const g = windows(b);
        return (
          <g key={i} className="bld-near">
            {b.antenna && <path d={`M${b.x + b.w / 2} ${top - 6}v-64`} stroke="#6aaed8" strokeWidth="4" />}
            <rect x={b.x} y={top} width={b.w} height={b.h} fill={`url(#${id}n)`} />
            {/* нар тусах тал */}
            <rect x={b.x} y={top} width={Math.min(10, b.w * 0.12)} height={b.h} fill="#fff" fillOpacity=".22" />
            <rect x={b.x - 3} y={top - 6} width={b.w + 6} height="8" rx="2" fill="#6aaed8" />
            {b.w >= 70 && <rect x={g.x} y={g.y} width={g.w} height={g.h} fill={`url(#${id}w${i})`} />}
            {glints[i].map((p, j) => (
              <rect key={j} className="hero-glint" x={p.x} y={p.y} width="12" height="18" rx="1.5" fill="#fffbe6" opacity="0" />
            ))}
          </g>
        );
      })}

      {/* усан цамхаг */}
      <g className="bld-near">
        <path d="M2760 700 2775 340M2830 700 2815 340M2765 600h60M2770 480h50" stroke="#6aaed8" strokeWidth="6" fill="none" />
        <rect x="2740" y="250" width="110" height="92" rx="14" fill={`url(#${id}n)`} />
        <path d="M2736 254 2795 214 2854 254Z" fill="#6aaed8" />
        <path d="M2795 270s-16 20-16 30a16 16 0 0032 0c0-10-16-30-16-30z" fill="#fff" fillOpacity=".85" />
      </g>

      {/* газар доорх шугам — ус хот руу урсана */}
      <rect y="684" width={W} height="16" fill="#d7ebf6" />
      {["M2000 693H600", "M2000 693H3400"].map((d) => (
        <g key={d}>
          <path className="hero-pipe" d={d} stroke="#0078be" strokeWidth="4" pathLength={1} strokeDasharray="1" fill="none" />
          <path className="hero-flow flow" d={d} stroke="#fff" strokeWidth="2" opacity="0" fill="none" />
        </g>
      ))}
    </svg>
  );
}
