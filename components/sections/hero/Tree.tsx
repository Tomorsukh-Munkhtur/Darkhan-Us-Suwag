import { useId } from "react";

/** Бөөрөнхий титэмтэй мод. Навчны бөөгнөрөл тус бүр (.crown-blob) тусдаа хөдөлнө. */
export default function Tree({ className = "" }: { className?: string }) {
  const id = useId();
  const crown = `url(#${id}c)`;

  return (
    <svg viewBox="0 0 400 480" className={className} aria-hidden>
      <defs>
        <radialGradient id={`${id}c`} cx=".35" cy=".3" r=".8">
          <stop offset="0" stopColor="#6fd8a6" />
          <stop offset="1" stopColor="#178a62" />
        </radialGradient>
      </defs>
      <g className="hero-sway">
        <path
          d="M180 480 186 330Q170 300 140 285L146 278Q176 290 194 312 205 280 238 262L243 270Q214 290 206 330L214 480Z"
          fill="#7a6552"
        />
        <circle className="crown-blob" cx="200" cy="205" r="150" fill={crown} />
        <circle className="crown-blob" cx="115" cy="245" r="96" fill="#23a073" />
        <circle className="crown-blob" cx="288" cy="235" r="104" fill="#1f9a6c" />
        <circle className="crown-blob" cx="165" cy="130" r="100" fill={crown} />
        <circle className="crown-blob" cx="255" cy="140" r="92" fill="#3dbb88" />
        <circle className="crown-blob" cx="150" cy="105" r="48" fill="#8ee0b5" opacity=".7" />
        <circle className="crown-blob" cx="248" cy="112" r="36" fill="#a5e9c6" opacity=".6" />
        <circle className="crown-blob" cx="95" cy="220" r="34" fill="#6fd8a6" opacity=".55" />
      </g>
    </svg>
  );
}
