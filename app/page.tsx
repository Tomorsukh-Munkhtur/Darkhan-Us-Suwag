import type { Metadata, Viewport } from "next";
import { about, gateway } from "@/lib/content";
import { LogoMark } from "@/components/ui/Logo";
import GateVideo from "@/components/landing/GateVideo";

export const metadata: Metadata = {
  title: "“Дархан Ус Суваг” ХК — Ус бүхний эхлэл",
  description: "Дархан хотын ус хангамж, ариутгах татуурга. Танилцуулга (усны аялал) эсвэл албан ёсны сайт dus.mn.",
};

export const viewport: Viewport = {
  themeColor: "#041a2e",
};

/** Хагас дэлгэц: desktop дээр хулгана аваачсан тал томорно (CSS, JS-гүй), утсан дээр дээш доош дараалсан */
const panel =
  "group/panel relative isolate flex min-h-[50svh] flex-1 flex-col justify-end overflow-hidden px-6 pb-10 outline-none sm:px-10 sm:pb-14 lg:min-h-0 lg:px-14 lg:pb-16 lg:pt-40 lg:transition-[flex-grow] lg:duration-700 lg:ease-[cubic-bezier(.22,1,.36,1)] lg:hover:grow-[1.35] lg:focus-visible:grow-[1.35] motion-reduce:transition-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-aqua";

function PanelText({ p, external }: { p: typeof gateway.intro; external?: boolean }) {
  return (
    <div className="relative z-10 max-w-md transition-transform duration-700 ease-[cubic-bezier(.22,1,.36,1)] lg:group-hover/panel:-translate-y-2 motion-reduce:transition-none">
      <p className="font-display text-xs font-medium tracking-[0.32em] text-aqua uppercase">
        {p.step} · {p.label}
      </p>
      <h2 className="mt-3 font-display text-[clamp(2.25rem,1.2rem+4vw,4.75rem)] font-bold leading-none tracking-tight text-abyss">{p.title}</h2>
      <p className="mt-4 text-sm leading-relaxed text-abyss/80 sm:text-base">{p.text}</p>
      <span className="mt-6 inline-flex items-center gap-3 sm:mt-7 rounded-full border border-abyss/25 bg-abyss/10 px-6 py-3 font-display text-sm font-semibold text-abyss backdrop-blur-sm transition-colors duration-300 group-hover/panel:border-aqua group-hover/panel:bg-aqua group-hover/panel:text-foam group-focus-visible/panel:border-aqua group-focus-visible/panel:bg-aqua group-focus-visible/panel:text-foam">
        {p.cta}
        <span aria-hidden className="transition-transform duration-300 group-hover/panel:translate-x-1">
          {external ? "↗" : "→"}
        </span>
      </span>
    </div>
  );
}

/**
 * Нүүр хуудас: зөвхөн хоёр сонголт — танилцуулга (/intro, усны аяллын storytelling) ба албан ёсны сайт (dus.mn).
 * Дээд голд лого, нэр; хоёр тал бүхэлдээ холбоос (гарын товчлуураар Tab → Enter).
 */
export default function Home() {
  const { intro, site } = gateway;
  return (
    <main className="group/split relative flex min-h-[100svh] flex-col bg-foam text-abyss lg:h-[100svh] lg:flex-row">
      <h1 className="sr-only">{gateway.name}</h1>

      {/* 01 — танилцуулга: дроны бичлэг, бараан хөх бүрхүүл */}
      {/* утсан дээр дээд талын лого, нэрийн доор зай */}
      <a href={intro.href} className={`${panel} pt-48 sm:pt-60`}>
        <GateVideo
          src={about.video}
          poster={about.poster}
          className="absolute inset-0 -z-20 h-full w-full scale-105 object-cover transition-transform duration-[1600ms] ease-out group-hover/panel:scale-100 motion-reduce:transition-none"
        />
        <span aria-hidden className="absolute inset-0 -z-10 bg-[linear-gradient(to_top,rgba(4,26,46,.95)_8%,rgba(4,26,46,.45)_55%,rgba(4,26,46,.7))]" />
        {/* нөгөө тал идэвхтэй үед бүдгэрнэ */}
        <span aria-hidden className="absolute inset-0 z-0 bg-foam/0 transition-[background-color,opacity] duration-700 lg:group-hover/split:bg-foam/45 lg:group-hover/panel:opacity-0" />
        <PanelText p={intro} />
      </a>

      {/* 02 — dus.mn: брэндийн гүн хөх, усны цагираг долгион, бүдэг сүлд */}
      <a href={site.href} className={`${panel} border-t border-abyss/10 pt-16 lg:border-l lg:border-t-0`}>
        <span aria-hidden className="absolute inset-0 -z-20 bg-[radial-gradient(circle_at_72%_28%,#0d5f96,#073157_52%,#041a2e)]" />
        <svg aria-hidden viewBox="0 0 600 600" className="absolute -right-24 -top-24 -z-10 h-[34rem] w-[34rem] text-aqua/15 transition-transform duration-[1600ms] ease-out group-hover/panel:scale-110 motion-reduce:transition-none">
          {[70, 130, 190, 250, 300].map((r) => (
            <circle key={r} cx="300" cy="300" r={r} fill="none" stroke="currentColor" strokeWidth="1.5" />
          ))}
        </svg>
        <LogoMark size={420} className="pointer-events-none absolute -bottom-20 -right-20 -z-10 h-[26rem] w-[26rem] opacity-[0.07] grayscale" />
        <span aria-hidden className="absolute inset-0 z-0 bg-foam/0 transition-[background-color,opacity] duration-700 lg:group-hover/split:bg-foam/45 lg:group-hover/panel:opacity-0" />
        <PanelText p={site} external />
      </a>

      {/* дээд голд: лого, уриа, нэр (хоёр талын дээгүүр) */}
      <header className="pointer-events-none absolute inset-x-0 top-0 z-20 flex flex-col items-center px-4 pt-6 text-center sm:pt-8">
        <span className="grid h-16 w-16 place-items-center rounded-full bg-[#f5fbff] p-1.5 sm:p-2 shadow-[0_10px_40px_-8px_rgba(56,182,240,.55)] ring-1 ring-[#f5fbff]/40 sm:h-24 sm:w-24">
          <LogoMark size={96} preload className="h-full w-full" />
        </span>
        <p className="mt-3 font-display text-[11px] tracking-[0.4em] text-aqua uppercase sm:mt-4">{gateway.eyebrow}</p>
        <p className="mt-1.5 font-display text-base font-semibold tracking-wide text-abyss sm:text-lg">{gateway.name}</p>
      </header>
    </main>
  );
}
