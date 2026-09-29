import { useId } from "react";

/**
 * Үйлчилгээ бүрийн зураглал (16:11). Бодит зураг ирвэл Services.tsx дээр солино.
 * "slice" — parallax-ийн өндөр wrapper-ийг дүүргэнэ.
 */
type Props = { className?: string };

const GLASS = "M236 190h112l-12 112a8 8 0 01-8 7h-72a8 8 0 01-8-7z";

/* 01 — Ус хангамж: цоргоноос аяга руу ус урсана */
export function SupplyArt({ className }: Props) {
  const id = useId();
  const chrome = `url(#${id}c)`;
  const water = `url(#${id}w)`;
  return (
    <svg viewBox="0 0 480 330" preserveAspectRatio="xMidYMid slice" className={className} aria-hidden>
      <defs>
        <linearGradient id={`${id}b`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#e9f6fd" />
          <stop offset="1" stopColor="#cbe8f8" />
        </linearGradient>
        <linearGradient id={`${id}c`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f4f8fb" />
          <stop offset=".5" stopColor="#c3d3de" />
          <stop offset="1" stopColor="#8fa6b6" />
        </linearGradient>
        <linearGradient id={`${id}w`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7fd0f3" />
          <stop offset="1" stopColor="#1f8fd0" />
        </linearGradient>
        <clipPath id={`${id}g`}>
          <path d={GLASS} />
        </clipPath>
      </defs>

      <rect width="480" height="330" fill={`url(#${id}b)`} />
      <g fill="#fff" opacity=".55">
        <circle cx="70" cy="240" r="28" />
        <circle cx="118" cy="190" r="12" />
        <circle cx="420" cy="92" r="32" />
        <circle cx="446" cy="164" r="10" />
      </g>
      <rect y="306" width="480" height="24" fill="#b9dcef" />

      {/* цорго */}
      <rect x="-10" y="56" width="210" height="28" rx="10" fill={chrome} />
      <rect x="176" y="40" width="74" height="60" rx="16" fill={chrome} />
      <rect x="203" y="18" width="20" height="24" rx="4" fill="#9fb4c3" />
      <rect x="180" y="10" width="66" height="14" rx="7" fill={chrome} />
      <path d="M244 58h40a18 18 0 0118 18v28h-26V84h-32z" fill={chrome} />
      <rect x="274" y="100" width="30" height="8" rx="3" fill="#8fa6b6" />

      {/* урсгал */}
      <rect x="281" y="108" width="16" height="140" rx="8" fill={water} opacity=".85" />
      <path className="flow" d="M289 112V244" stroke="#fff" strokeWidth="3" strokeLinecap="round" opacity=".8" />

      {/* аяга */}
      <g clipPath={`url(#${id}g)`}>
        <rect x="230" y="190" width="130" height="130" fill="#fff" opacity=".45" />
        <g className="animate-[wave-x_3s_linear_infinite]">
          <path d="M200 238q15-8 30 0t30 0 30 0 30 0 30 0 30 0 30 0 30 0V320H200z" fill={water} opacity=".85" />
        </g>
        {[252, 300, 324].map((x, i) => (
          <circle key={x} className="bubble" cx={x} cy="298" r={2.5 + i} fill="#fff" opacity=".85" style={{ animationDelay: `${i * 0.7}s` }} />
        ))}
      </g>
      <path d={GLASS} fill="none" stroke="#fff" strokeWidth="5" />
      <path d={GLASS} fill="none" stroke="#8fc3e0" strokeWidth="2" />
      <path d="M252 206l-6 70" stroke="#fff" strokeWidth="5" strokeLinecap="round" opacity=".7" />
      <g fill="#3aa3dc">
        <path d="M262 222s-5 7-5 10a5 5 0 0010 0c0-3-5-10-5-10z" />
        <path d="M318 216s-4 6-4 8a4 4 0 008 0c0-2-4-8-4-8z" />
      </g>
    </svg>
  );
}

/* 02 — Ариутгах татуурга: гудамжны хөндлөн огтлол, газар доогуур бохир ус урсана */
export function SewerArt({ className }: Props) {
  const id = useId();
  const houses = [
    { x: 40, w: 90, h: 60 },
    { x: 170, w: 70, h: 48 },
    { x: 290, w: 96, h: 66 },
  ];
  return (
    <svg viewBox="0 0 480 330" preserveAspectRatio="xMidYMid slice" className={className} aria-hidden>
      <defs>
        <linearGradient id={`${id}s`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#eef8fe" />
          <stop offset="1" stopColor="#d8eefa" />
        </linearGradient>
        <linearGradient id={`${id}g`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#efe5d3" />
          <stop offset="1" stopColor="#dccaa8" />
        </linearGradient>
        <linearGradient id={`${id}p`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#b6c4cd" />
          <stop offset="1" stopColor="#7d8f9c" />
        </linearGradient>
      </defs>

      <rect width="480" height="120" fill={`url(#${id}s)`} />
      {houses.map((h) => (
        <g key={h.x}>
          <rect x={h.x} y={118 - h.h} width={h.w} height={h.h} fill="#fff" stroke="#cfe3ef" strokeWidth="2" />
          <path d={`M${h.x - 8} ${118 - h.h}L${h.x + h.w / 2} ${90 - h.h}L${h.x + h.w + 8} ${118 - h.h}Z`} fill="#6aaed8" />
          <rect x={h.x + h.w / 2 - 10} y={136 - h.h} width="20" height="16" rx="2" fill="#bfe3f5" />
        </g>
      ))}

      {/* зам */}
      <rect y="116" width="480" height="14" fill="#cfd9df" />
      <path d="M0 123h480" stroke="#fff" strokeWidth="2" strokeDasharray="18 14" />

      {/* хөрс */}
      <rect y="130" width="480" height="200" fill={`url(#${id}g)`} />
      <g fill="#c8b288" opacity=".5">
        <circle cx="40" cy="170" r="4" />
        <circle cx="150" cy="300" r="5" />
        <circle cx="260" cy="180" r="3" />
        <circle cx="330" cy="310" r="4" />
        <circle cx="450" cy="290" r="3" />
      </g>

      {/* айлын гаргалгаа → гол шугам */}
      {houses.map((h) => {
        const x = h.x + h.w / 2;
        return (
          <g key={h.x}>
            <path d={`M${x} 130V226`} stroke="#9aabb7" strokeWidth="10" strokeLinecap="round" />
            <path className="flow-slow" d={`M${x} 132V224`} stroke="#3aa981" strokeWidth="3" />
          </g>
        );
      })}
      <rect x="-10" y="222" width="500" height="44" rx="22" fill={`url(#${id}p)`} />
      <rect x="-10" y="230" width="500" height="28" rx="14" fill="#4a6070" opacity=".35" />
      <path className="flow" d="M0 244H480" stroke="#3aa981" strokeWidth="10" strokeLinecap="round" opacity=".85" />

      {/* худаг */}
      <rect x="404" y="128" width="36" height="96" fill="#b8c6cf" />
      <path d="M410 146h24M410 166h24M410 186h24M410 206h24" stroke="#8fa0ab" strokeWidth="3" />
      <ellipse cx="422" cy="121" rx="26" ry="6" fill="#7d8f9c" />
    </svg>
  );
}

/* 03 — Цэвэрлэх байгууламж: тунгаагуурын гүүр эргэлдэж, цэвэр ус гол руу урсана */
export function TreatmentArt({ className }: Props) {
  const id = useId();
  const tanks = [
    { cx: 150, cy: 170, r: 98, fill: `url(#${id}m)`, speed: "16s" },
    { cx: 350, cy: 150, r: 74, fill: `url(#${id}c)`, speed: "11s" },
  ];
  return (
    <svg viewBox="0 0 480 330" preserveAspectRatio="xMidYMid slice" className={className} aria-hidden>
      <defs>
        <linearGradient id={`${id}g`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#eef7f2" />
          <stop offset="1" stopColor="#d9eae1" />
        </linearGradient>
        <radialGradient id={`${id}m`}>
          <stop offset="0" stopColor="#c3dccd" />
          <stop offset="1" stopColor="#8db5a1" />
        </radialGradient>
        <radialGradient id={`${id}c`}>
          <stop offset="0" stopColor="#c6ecfc" />
          <stop offset="1" stopColor="#4fb3e6" />
        </radialGradient>
      </defs>

      <rect width="480" height="330" fill={`url(#${id}g)`} />
      <g fill="#6fd8a6" opacity=".7">
        <circle cx="30" cy="300" r="14" />
        <circle cx="52" cy="312" r="10" />
        <circle cx="262" cy="36" r="12" />
        <circle cx="452" cy="40" r="14" />
        <circle cx="440" cy="222" r="10" />
      </g>

      {/* удирдлагын байр */}
      <rect x="24" y="18" width="64" height="40" rx="4" fill="#fff" stroke="#cfe3ef" strokeWidth="2" />
      <rect x="24" y="18" width="64" height="8" rx="3" fill="#6aaed8" />

      {/* савнуудыг холбох суваг ба гол руу гарах шугам */}
      <path d="M150 170H350" stroke="#cdd8de" strokeWidth="22" />
      <path className="flow-slow" d="M160 170H340" stroke="#7cc7ec" strokeWidth="8" />
      <path d="M300 330Q380 294 480 298V330Z" fill="#7cc7ec" opacity=".85" />
      <path d="M350 222v46q0 22 22 22h108" stroke="#cdd8de" strokeWidth="18" fill="none" />
      <path className="flow" d="M350 226v42q0 22 22 22h108" stroke="#4fb3e6" strokeWidth="6" fill="none" />

      {tanks.map((t, i) => (
        <g key={t.cx}>
          <circle cx={t.cx} cy={t.cy} r={t.r} fill="#cdd8de" />
          <circle cx={t.cx} cy={t.cy} r={t.r - 10} fill={t.fill} />
          {[0, 1.6].map((d) => (
            <circle
              key={d}
              className="ripple"
              cx={t.cx}
              cy={t.cy}
              r={t.r - 18}
              fill="none"
              stroke="#fff"
              strokeWidth="2"
              style={{ animationDelay: `${d + i * 0.8}s` }}
            />
          ))}
          <g style={{ transformOrigin: `${t.cx}px ${t.cy}px`, animation: `turn ${t.speed} linear infinite` }}>
            <rect x={t.cx - 4} y={t.cy - t.r + 10} width="8" height={t.r - 10} fill="#6f8593" />
            <rect x={t.cx - 10} y={t.cy - t.r + 12} width="20" height="10" rx="3" fill="#4d6574" />
          </g>
          <circle cx={t.cx} cy={t.cy} r="12" fill="#fff" stroke="#9fb3bf" strokeWidth="3" />
        </g>
      ))}
    </svg>
  );
}
