import { useId } from "react";
import { LogoMark } from "../../ui/Logo";

/** Дархан Ус Суваг-ийн байр (зурган хувилбар). Бодит зураг ирвэл энэ компонентыг сольно. */
export default function HQBuilding({ className = "relative" }: { className?: string }) {
  const id = useId();
  const glass = `url(#${id}g)`;
  const mullions = Array.from({ length: 16 }, (_, i) => 124 + i * 40);

  return (
    <div className={className}>
      <svg viewBox="0 0 800 420" className="block h-auto w-full" role="img" aria-label="Дархан Ус Суваг ОНӨААТҮГ-ын байр">
        <defs>
          <linearGradient id={`${id}g`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#9bd9f6" />
            <stop offset=".55" stopColor="#3aa3dc" />
            <stop offset="1" stopColor="#0a6fae" />
          </linearGradient>
          <linearGradient id={`${id}s`} x1="0" x2="1">
            <stop offset="0" stopColor="#fff" stopOpacity="0" />
            <stop offset=".5" stopColor="#fff" stopOpacity=".75" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
          <clipPath id={`${id}c`}>
            <rect x="332" y="40" width="136" height="118" rx="6" />
            <rect x="84" y="222" width="632" height="44" rx="4" />
            <rect x="84" y="284" width="226" height="44" rx="4" />
            <rect x="490" y="284" width="226" height="44" rx="4" />
          </clipPath>
        </defs>

        <ellipse cx="400" cy="404" rx="380" ry="14" fill="#04213a" opacity=".08" />

        {/* цамхаг */}
        <rect x="316" y="24" width="168" height="150" rx="10" fill="#fff" stroke="#cfe3ef" strokeWidth="2" />
        <rect x="332" y="40" width="136" height="118" rx="6" fill={glass} />

        {/* нүүрэн самбар */}
        <rect x="40" y="160" width="720" height="46" rx="8" fill="#fff" stroke="#cfe3ef" strokeWidth="2" />
        <text
          x="400"
          y="192"
          textAnchor="middle"
          fill="#04213a"
          fontSize="24"
          fontWeight="700"
          letterSpacing="6"
          style={{ fontFamily: "var(--font-display)" }}
        >
          ДАРХАН УС СУВАГ
        </text>

        {/* үндсэн их бие */}
        <rect x="60" y="206" width="680" height="186" fill="#fff" stroke="#cfe3ef" strokeWidth="2" />
        <rect x="84" y="222" width="632" height="44" rx="4" fill={glass} />
        <rect x="84" y="284" width="226" height="44" rx="4" fill={glass} />
        <rect x="490" y="284" width="226" height="44" rx="4" fill={glass} />
        <g stroke="#fff" strokeOpacity=".55" strokeWidth="2">
          {mullions.map((x) => (
            <path key={x} d={`M${x} 222v44${x < 310 || x > 490 ? "M" + x + " 284v44" : ""}`} />
          ))}
        </g>

        {/* орц */}
        <rect x="310" y="274" width="180" height="10" rx="3" fill="#e6f2f9" stroke="#cfe3ef" />
        <rect x="336" y="290" width="128" height="102" rx="4" fill="#0a5f95" />
        <path d="M400 290v102M368 290v102M432 290v102" stroke="#fff" strokeOpacity=".35" strokeWidth="2" />

        <rect x="20" y="390" width="760" height="16" rx="4" fill="#e6f2f9" stroke="#cfe3ef" />

        {/* шилэн дээгүүр гялбаа гүйнэ */}
        <g clipPath={`url(#${id}c)`}>
          <rect className="hq-sheen" x="-240" y="0" width="120" height="420" fill={`url(#${id}s)`} transform="skewX(-18)" />
        </g>
      </svg>

      <span className="absolute left-1/2 top-[11%] w-[11%] -translate-x-1/2 rounded-full bg-white p-[0.5%] shadow-md shadow-abyss/15">
        <LogoMark size={96} className="block h-auto w-full" />
      </span>
    </div>
  );
}
