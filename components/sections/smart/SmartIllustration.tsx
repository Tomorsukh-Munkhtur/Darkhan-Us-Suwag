import { AppPhone } from "../AppPromo";

/**
 * Ухаалаг тоолуур → утасгүй дохио → BILL center апп (SmartServices.tsx).
 * Тоолуур: айл өрхөд суурилуулдаг гуулин усны тоолуур (SVG) — ган шугамд гуулин самраар холбогдсон, дээрээ шилэн
 * нүүртэй тоолох механизм (тоот хүрд, улаан заагуур), онгорхой хөх таг, хажуудаа утасгүй модуль (антен, LED).
 * Утас: footer-ийн бодит утасны зураг (AppPromo.tsx — AppPhone). 1–3 дугаар нь доорх алхмын карттай таарна.
 * Хөдөлгөөн: LED анивчиж, антенаас дохио цацагдаж, цэгүүд утас руу нисэнэ (SMIL — JS-гүй).
 */
const SIGNAL = "M321 92 C 382 18, 452 6, 520 58";

function Badge({ x, y, n }: { x: number; y: number; n: number }) {
  return (
    <g>
      <circle cx={x} cy={y} r="18" fill="none" stroke="#0078be" strokeOpacity=".22" strokeWidth="3" />
      <circle cx={x} cy={y} r="14" fill="#0078be" />
      <text x={x} y={y + 4.5} fill="#fff" fontSize="13" fontWeight="700" textAnchor="middle">
        {n}
      </text>
    </g>
  );
}

/** Гуулин гадаргуу: хэвтээ ирмэгтэй цилиндрийн гэрэл (дээрээ гэрэлтэй, доороо бараан) */
function BrassDefs() {
  return (
    <>
      <linearGradient id="sm-brass" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#f6dc93" />
        <stop offset=".22" stopColor="#fff2c4" />
        <stop offset=".5" stopColor="#d6a43e" />
        <stop offset=".82" stopColor="#9c6e1c" />
        <stop offset="1" stopColor="#6e4b10" />
      </linearGradient>
      {/* самар (зургаан өнцөгт): босоо нүүрнүүд — голдоо гэрэлтэй */}
      <linearGradient id="sm-nut" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#8a5f17" />
        <stop offset=".3" stopColor="#e7c46e" />
        <stop offset=".5" stopColor="#fbe7ad" />
        <stop offset=".7" stopColor="#d7a849" />
        <stop offset="1" stopColor="#7a5312" />
      </linearGradient>
      <linearGradient id="sm-ring" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#7d5814" />
        <stop offset=".35" stopColor="#e9c56e" />
        <stop offset=".55" stopColor="#fff0bf" />
        <stop offset="1" stopColor="#8d6419" />
      </linearGradient>
      <linearGradient id="sm-steel" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#c9d2d9" />
        <stop offset=".25" stopColor="#f4f7f9" />
        <stop offset=".6" stopColor="#a7b3bd" />
        <stop offset="1" stopColor="#6f7d89" />
      </linearGradient>
      <linearGradient id="sm-lid" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#3f86d1" />
        <stop offset="1" stopColor="#164a8a" />
      </linearGradient>
      <radialGradient id="sm-dial" cx=".45" cy=".35" r=".75">
        <stop offset="0" stopColor="#ffffff" />
        <stop offset=".75" stopColor="#eef1f0" />
        <stop offset="1" stopColor="#cfd6d6" />
      </radialGradient>
      <linearGradient id="sm-module" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#ffffff" />
        <stop offset="1" stopColor="#c8d3dc" />
      </linearGradient>
      <filter id="sm-blur" x="-50%" y="-200%" width="200%" height="500%">
        <feGaussianBlur stdDeviation="7" />
      </filter>
    </>
  );
}

/** Тоот хүрд: 5 хар (м³) + 2 улаан (бутархай) цонх */
function Odometer() {
  const digits = ["0", "1", "2", "3", "4", "5", "4"];
  return (
    <g>
      <rect x="-40" y="-12" width="80" height="20" rx="3" fill="#202428" />
      {digits.map((d, i) => (
        <g key={i} transform={`translate(${-36 + i * 11} -10)`}>
          <rect width="9.5" height="16" rx="1.5" fill={i < 5 ? "#f4f4f2" : "#c8262e"} />
          <text x="4.75" y="12.3" fontSize="11.5" fontWeight="700" textAnchor="middle" fill={i < 5 ? "#1b1f24" : "#fff"} fontFamily="ui-monospace, Consolas, monospace">
            {d}
          </text>
        </g>
      ))}
    </g>
  );
}

function Meter() {
  return (
    <g>
      {/* шалан дээрх зөөлөн сүүдэр */}
      <ellipse cx="190" cy="270" rx="185" ry="11" fill="#04213a" opacity=".22" filter="url(#sm-blur)" />

      {/* ган шугам */}
      <rect x="14" y="214" width="352" height="30" rx="3" fill="url(#sm-steel)" />
      {[14, 366].map((x) => (
        <ellipse key={x} cx={x} cy="229" rx="5" ry="15" fill={x < 100 ? "#8d99a3" : "#dfe6eb"} />
      ))}

      {/* гуулин самар, оёдол */}
      {[78, 270].map((x) => (
        <g key={x}>
          <rect x={x} y="203" width="32" height="52" rx="4" fill="url(#sm-nut)" />
          <path d={`M${x + 10.5} 203 V255 M${x + 21.5} 203 V255`} stroke="#6e4b10" strokeOpacity=".35" />
          {[0, 1, 2].map((k) => (
            <rect key={k} x={x + (x < 200 ? 32 : -8) + k * 2.6 * (x < 200 ? 1 : -1)} y="209" width="1.6" height="40" fill="#7a5312" opacity=".45" />
          ))}
        </g>
      ))}

      {/* их бие */}
      <path d="M110 205 Q110 190 128 188 H252 Q270 190 270 205 V250 Q270 262 255 263 H125 Q110 262 110 250 Z" fill="url(#sm-brass)" />
      <ellipse cx="190" cy="226" rx="56" ry="36" fill="url(#sm-brass)" />
      <path d="M148 206 Q190 192 232 206" stroke="#fff6d6" strokeOpacity=".7" strokeWidth="3" fill="none" strokeLinecap="round" />
      {/* урсгалын чиглэлийн сум (их бие дээр цутгасан) */}
      <path d="M168 244 H206 M198 238 L208 244 L198 250" stroke="#7a5312" strokeOpacity=".55" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />

      {/* онгорхой хөх таг (ард) */}
      <g>
        <path d="M134 150 Q132 98 190 92 Q248 98 246 150 Z" fill="url(#sm-lid)" />
        <path d="M144 146 Q144 106 190 101 Q236 106 236 146" fill="none" stroke="#9cc6f0" strokeOpacity=".45" strokeWidth="2" />
        <rect x="176" y="146" width="28" height="8" rx="3" fill="#123a6c" />
      </g>

      {/* тоолох механизмын цилиндр */}
      <path d="M128 150 V182 Q190 214 252 182 V150 Z" fill="url(#sm-ring)" />
      <ellipse cx="190" cy="150" rx="62" ry="31" fill="url(#sm-ring)" />
      {/* шилэн нүүр: тоот хүрд, улаан заагуур (дээрээс бага зэрэг хазгай харагдана) */}
      <g transform="translate(190 150) scale(1 .52)">
        <circle r="54" fill="url(#sm-dial)" />
        <circle r="54" fill="none" stroke="#9aa3a8" strokeWidth="2" />
        <g transform="translate(0 -14)">
          <Odometer />
        </g>
        {[-24, 24].map((x, i) => (
          <g key={x} transform={`translate(${x} 26)`}>
            <circle r="10" fill="#fff" stroke="#c8262e" strokeWidth="1.5" />
            <path d={i ? "M0 0 L5 -7" : "M0 0 L-6 4"} stroke="#c8262e" strokeWidth="2.4" strokeLinecap="round" />
          </g>
        ))}
        <circle cx="0" cy="30" r="5" fill="#c8262e" />
      </g>
      {/* шилний гялбаа */}
      <path d="M144 140 Q168 126 206 128" stroke="#fff" strokeOpacity=".85" strokeWidth="3" fill="none" strokeLinecap="round" />
      <text x="190" y="175" fill="#56758d" fontSize="8" fontWeight="700" textAnchor="middle" letterSpacing=".5">
        м³
      </text>

      {/* утасгүй модуль (хажуудаа хавчуулсан), LED, антен */}
      <g>
        <rect x="246" y="150" width="56" height="42" rx="9" fill="url(#sm-module)" stroke="#aebbc6" />
        <rect x="254" y="160" width="26" height="3" rx="1.5" fill="#9fb0bd" />
        <rect x="254" y="167" width="18" height="3" rx="1.5" fill="#9fb0bd" />
        <circle cx="290" cy="164" r="4.5" fill="#21b26f">
          <animate attributeName="opacity" values="1;.25;1" dur="1.6s" repeatCount="indefinite" />
        </circle>
        <path d="M298 152 L319 96" stroke="#3a4752" strokeWidth="4.5" strokeLinecap="round" />
        <circle cx="321" cy="92" r="5" fill="#3a4752" />
      </g>
    </g>
  );
}

export default function SmartIllustration({ className = "" }: { className?: string }) {
  return (
    <div className={`relative aspect-[700/300] ${className}`} role="img" aria-label="Ухаалаг тоолуур заалтаа BILL center апп руу илгээнэ">
      {/* BILL center: бодит утасны зураг (ард) — дохионы цэгүүд дээгүүр нь нисэнэ */}
      <div className="absolute right-[3%] top-[-6%] w-[24%] [filter:drop-shadow(0_18px_24px_rgba(4,33,58,.22))]">
        <AppPhone className="w-full" />
      </div>

      <svg viewBox="0 0 700 300" overflow="visible" aria-hidden className="pointer-events-none absolute inset-0 h-full w-full">
        <defs>
          <BrassDefs />
        </defs>

        <Meter />

        {/* дохио: антенаас гадагш тархана */}
        {[0, 0.6, 1.2].map((b) => (
          <circle key={b} cx="321" cy="92" r="8" fill="none" stroke="#3cc3f0" strokeWidth="2">
            <animate attributeName="r" values="8;34" dur="1.8s" begin={`${b}s`} repeatCount="indefinite" />
            <animate attributeName="opacity" values=".9;0" dur="1.8s" begin={`${b}s`} repeatCount="indefinite" />
          </circle>
        ))}
        <path d={SIGNAL} fill="none" stroke="#3cc3f0" strokeOpacity=".6" strokeWidth="2.5" strokeDasharray="2 9" strokeLinecap="round" />
        {[0, 0.8, 1.6].map((b) => (
          <circle key={b} r="5" fill="#0078be">
            <animateMotion dur="2.4s" begin={`${b}s`} repeatCount="indefinite" path={SIGNAL} />
          </circle>
        ))}

        <Badge x={108} y={120} n={1} />
        <Badge x={420} y={24} n={2} />
        <Badge x={536} y={18} n={3} />
      </svg>
    </div>
  );
}
