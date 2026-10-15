/**
 * Бохир усны аяллын картын хөдөлгөөнгүй SVG зураг — зөвхөн 3D ажиллах боломжгүй үед (WebGL2 байхгүй, алдаа,
 * ?sewage3d=off) харагдана (SewageJourney.tsx, [data-journey-3d] CSS). Өнгө: бохир (хүрэн) → цэвэр (цэнхэр).
 */

const BROWN = "#8a6a3a";
const MID = "#5e7d6e";
const BLUE = "#1f8fd0";
const LINE = "#3f78a0";
const SURFACE = "#0f3a5e";
const INK = "#e4f2fb";
const WIN = "#ffc94d";

const Frame = ({ children }: { children: React.ReactNode }) => (
  <svg viewBox="0 0 400 400" className="h-full w-full" aria-hidden>
    <rect width="400" height="400" fill="#0b2e4c" />
    {children}
  </svg>
);

/* 01 — орон сууцнаас гаргалгаагаар газар доорх татуурга руу */
function HomesVisual() {
  const blds = [
    { x: 60, w: 90, h: 170 },
    { x: 170, w: 80, h: 130 },
    { x: 270, w: 70, h: 100 },
  ];
  return (
    <Frame>
      <rect x="0" y="260" width="400" height="140" fill="#123a3f" />
      <rect x="0" y="260" width="400" height="6" fill="#1f5a46" />
      {blds.map((b) => (
        <g key={b.x}>
          <rect x={b.x} y={260 - b.h} width={b.w} height={b.h} fill="#1b4a70" stroke={LINE} />
          {Array.from({ length: Math.floor(b.h / 22) * 3 }, (_, k) => (
            <rect key={k} x={b.x + 10 + (k % 3) * (b.w / 3.4)} y={260 - b.h + 10 + Math.floor(k / 3) * 22} width="10" height="9" fill={k % 4 ? WIN : "#10263b"} />
          ))}
          <path d={`M${b.x + b.w - 8} ${270 - b.h} V330`} stroke={BROWN} strokeWidth="5" fill="none" />
        </g>
      ))}
      <path d="M30 330 H380" stroke={BROWN} strokeWidth="12" strokeLinecap="round" />
      <path className="flow" d="M30 330 H380" stroke="#e3c48e" strokeOpacity=".7" strokeWidth="3" fill="none" />
    </Frame>
  );
}

/* 02 — гурван салаа шугам нэг гол шугамд нийлнэ */
function CollectorVisual() {
  return (
    <Frame>
      {[90, 200, 310].map((y) => (
        <path key={y} d={`M40 ${y} C130 ${y} 150 200 220 200`} stroke={BROWN} strokeWidth="7" fill="none" strokeLinecap="round" />
      ))}
      <path d="M220 200 H370" stroke={BROWN} strokeWidth="16" strokeLinecap="round" />
      <path className="flow" d="M220 200 H370" stroke="#e3c48e" strokeOpacity=".7" strokeWidth="4" fill="none" />
      <circle cx="220" cy="200" r="18" fill={SURFACE} stroke="#e3c48e" strokeWidth="3" />
    </Frame>
  );
}

/* 03 — суваг, сараалж, насос станц, даралттай шугам */
function StationVisual() {
  return (
    <Frame>
      <rect x="30" y="215" width="170" height="30" rx="4" fill={BROWN} opacity=".85" />
      {Array.from({ length: 7 }, (_, i) => (
        <line key={i} x1={112 + i * 3} y1="200" x2={100 + i * 3} y2="255" stroke="#9fb4c4" strokeWidth="2" />
      ))}
      <rect x="200" y="160" width="110" height="100" fill="#1d4c72" stroke={LINE} />
      <rect x="194" y="150" width="122" height="12" fill="#123a5c" />
      <circle cx="255" cy="215" r="22" fill="none" stroke="#5fd3f7" strokeWidth="4" />
      <path d="M310 200 H340 V150 H380" stroke={BROWN} strokeWidth="10" fill="none" strokeLinejoin="round" />
    </Frame>
  );
}

/* 04 — 7 үе шат: сараалж, элс баригч, тунгаагуур, агааржуулах, тунгаагуур, 3 шүүлтүүр, халдваргүйжүүлэх */
function PlantVisual() {
  const c = [BROWN, "#7f6c42", "#73714f", MID, "#3f7f96", "#2b8bbf", BLUE];
  return (
    <Frame>
      <path d="M20 220 H380" stroke={LINE} strokeWidth="4" />
      <rect x="25" y="200" width="30" height="40" fill={c[0]} />
      <rect x="65" y="195" width="35" height="50" fill={c[1]} />
      <ellipse cx="135" cy="220" rx="28" ry="28" fill={c[2]} stroke={LINE} />
      <rect x="175" y="190" width="55" height="60" fill={c[3]} />
      {[0, 1, 2, 3, 4].map((i) => (
        <circle key={i} cx={185 + i * 9} cy={205 + (i % 2) * 12} r="3" fill={INK} opacity=".8" />
      ))}
      <ellipse cx="265" cy="220" rx="28" ry="28" fill={c[4]} stroke={LINE} />
      {[180, 220, 260].map((y) => (
        <rect key={y} x="305" y={y - 15} width="18" height="30" rx="5" fill="#c9d9e5" stroke={c[5]} strokeWidth="3" />
      ))}
      <rect x="340" y="205" width="35" height="30" fill={c[6]} />
      {[348, 357, 366].map((x) => (
        <line key={x} x1={x} y1="200" x2={x} y2="240" stroke="#bff0ff" strokeWidth="2" />
      ))}
    </Frame>
  );
}

/* 05 — цэвэр ус гол руу, 98% */
function OutfallVisual() {
  return (
    <Frame>
      <rect x="0" y="0" width="400" height="400" fill="#16413f" />
      <path d="M0 290 C100 270 160 310 260 290 S360 280 400 295 V400 H0Z" fill="#2aa7e6" opacity=".85" />
      <path d="M40 200 H190 V280" stroke={BLUE} strokeWidth="12" fill="none" strokeLinejoin="round" />
      <path className="flow" d="M40 200 H190 V280" stroke="#bff0ff" strokeOpacity=".7" strokeWidth="3" fill="none" />
      {[70, 300, 340, 120].map((x, i) => (
        <path key={x} d={`M${x} ${150 + (i % 2) * 20} l14 -40 l14 40Z`} fill="#1f6b55" />
      ))}
      <text x="270" y="190" fill={INK} fontSize="44" fontWeight="700" textAnchor="middle">
        98%
      </text>
    </Frame>
  );
}

export const sewageVisuals: Record<string, React.FC> = {
  homes: HomesVisual,
  collector: CollectorVisual,
  station: StationVisual,
  plant: PlantVisual,
  outfall: OutfallVisual,
};
