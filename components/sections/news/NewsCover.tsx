import { useId } from "react";
import type { NewsKind } from "@/lib/content";

/** Мэдээний зураг байхгүй үед төрлөөр нь өнгө, дүрс тэмдэгтэй cover. Бодит зураг ирвэл News.tsx дээр солино. */
const theme: Record<NewsKind, { from: string; to: string; icon: React.ReactNode }> = {
  МЭДЭЭ: {
    from: "#c4e8f9",
    to: "#2f9bd6",
    icon: <path d="M4 5h13v14H6a2 2 0 01-2-2zM17 9h3v8a2 2 0 01-2 2M7 9h7M7 13h7M7 16h4" />,
  },
  ЗАРЛАЛ: {
    from: "#d3e9f6",
    to: "#005b92",
    icon: <path d="M3 10v4a1 1 0 001 1h3l6 4V5L7 9H4a1 1 0 00-1 1zM17 8a5 5 0 010 8M19.5 5.5a9 9 0 010 13" />,
  },
  ЗӨВЛӨМЖ: {
    from: "#d6f2e4",
    to: "#1fa37a",
    icon: <path d="M9 18h6M10 21h4M12 3a6 6 0 00-3.5 10.9c.6.5 1 1.2 1 2V16h5v-.1c0-.8.4-1.5 1-2A6 6 0 0012 3z" />,
  },
  ЗАСВАР: {
    from: "#fde2e5",
    to: "#d7263d",
    icon: (
      <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94z" />
    ),
  },
};

export default function NewsCover({ kind, className = "" }: { kind: NewsKind; className?: string }) {
  const id = useId();
  const t = theme[kind];
  return (
    <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" className={className} aria-hidden>
      <defs>
        <linearGradient id={`${id}g`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={t.from} />
          <stop offset="1" stopColor={t.to} />
        </linearGradient>
      </defs>
      <rect width="400" height="300" fill={`url(#${id}g)`} />
      <g fill="#fff">
        <circle cx="330" cy="70" r="120" opacity=".12" />
        <circle cx="40" cy="40" r="60" opacity=".1" />
      </g>
      {/* дүрс тэмдэг — hover үед бага зэрэг эргэнэ */}
      <g className="transition-transform duration-700 ease-out group-hover:-rotate-6 group-hover:scale-105" style={{ transformOrigin: "318px 82px" }}>
        <g transform="translate(270 34) scale(4)" fill="none" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" opacity=".95">
          {t.icon}
        </g>
      </g>
      {/* долгио */}
      <g className="animate-[wave-x_6s_linear_infinite]">
        <path d="M-60 230q15-10 30 0t30 0 30 0 30 0 30 0 30 0 30 0 30 0 30 0 30 0 30 0 30 0 30 0 30 0 30 0 30 0 30 0V300H-60z" fill="#fff" opacity=".18" />
      </g>
      <g className="animate-[wave-x_4s_linear_infinite]">
        <path d="M-60 250q15-8 30 0t30 0 30 0 30 0 30 0 30 0 30 0 30 0 30 0 30 0 30 0 30 0 30 0 30 0 30 0 30 0 30 0V300H-60z" fill="#fff" opacity=".22" />
      </g>
    </svg>
  );
}
