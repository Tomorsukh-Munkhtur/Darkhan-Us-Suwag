"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import { app } from "@/lib/content";
import { LogoMark } from "../ui/Logo";

type P = [number, number];

/** public/images/app-phone.png-ийн тунгалаг дэлгэцийн өнцгүүд (зургийн хэмжээний хувиар; шулуун ирмэгүүдийн огтлолцол) */
const SCREEN: [P, P, P, P] = [
  [571.6 / 1857, 190 / 3096],
  [1684.2 / 1857, 225.5 / 3096],
  [1213.5 / 1857, 2895.2 / 3096],
  [138 / 1857, 2649.6 / 3096],
];
/** Аппын дэлгэцийн логик хэмжээ (iPhone) */
const SW = 393;
const SH = 852;

/**
 * Тэгш өнцөгт (w×h) → дөрвөн өнцөгт (дээд-зүүн, дээд-баруун, доод-баруун, доод-зүүн) перспектив хувиргалт
 * (CSS matrix3d, transform-origin 0 0). Heckbert-ийн square-to-quad.
 */
function quadMatrix(w: number, h: number, [p0, p1, p2, p3]: [P, P, P, P]) {
  const [x0, y0] = p0;
  const [x1, y1] = p1;
  const [x2, y2] = p2;
  const [x3, y3] = p3;
  const sx = x0 - x1 + x2 - x3;
  const sy = y0 - y1 + y2 - y3;
  const dx1 = x1 - x2;
  const dx2 = x3 - x2;
  const dy1 = y1 - y2;
  const dy2 = y3 - y2;
  const den = dx1 * dy2 - dx2 * dy1;
  const g = (sx * dy2 - dx2 * sy) / den;
  const k = (dx1 * sy - sx * dy1) / den;
  const a = x1 - x0 + g * x1;
  const b = x3 - x0 + k * x3;
  const d = y1 - y0 + g * y1;
  const e = y3 - y0 + k * y3;
  const m = [a / w, d / w, 0, g / w, b / h, e / h, 0, k / h, 0, 0, 1, 0, x0, y0, 0, 1];
  return `matrix3d(${m.map((v) => +v.toFixed(8)).join(",")})`;
}

const ico = (d: React.ReactNode, size = 22) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    {d}
  </svg>
);

/** Аппын жишээ дэлгэц (түр орлуулга — бодит screenshot гарахад зургаар солино) */
function AppScreen() {
  const actions = [
    { l: "Тоолуур", i: <><circle cx="12" cy="13" r="7" /><path d="M12 13l3-3M9 3h6" /></> },
    { l: "Хүсэлт", i: <><path d="M14 3H6v18h12V7z" /><path d="M14 3v4h4M9 13h6M9 17h4" /></> },
    { l: "Мэдэгдэл", i: <><path d="M6 16V11a6 6 0 0112 0v5l2 2H4z" /><path d="M10 20a2 2 0 004 0" /></> },
    { l: "Түүх", i: <><path d="M3 12a9 9 0 109-9 9 9 0 00-7 3.3" /><path d="M3 4v4h4M12 7v5l3 2" /></> },
  ];
  const usage = [52, 64, 48, 70, 58, 44];
  return (
    <div className="relative flex h-full flex-col bg-[#f3f8fc] font-sans text-[#04213a]">
      {/* статус мөр */}
      <div className="flex h-[54px] shrink-0 items-end justify-between px-9 pb-1.5 text-[15px] font-semibold">
        <span>9:41</span>
        <span className="flex items-center gap-1.5">
          <svg width="18" height="12" viewBox="0 0 18 12" aria-hidden>
            {[0, 1, 2, 3].map((i) => (
              <rect key={i} x={i * 5} y={9 - i * 3} width="3.4" height={3 + i * 3} rx="1" fill="#04213a" />
            ))}
          </svg>
          <svg width="26" height="12" viewBox="0 0 26 12" aria-hidden>
            <rect x="0.5" y="0.5" width="22" height="11" rx="3" fill="none" stroke="#04213a" opacity=".4" />
            <rect x="2" y="2" width="17" height="8" rx="2" fill="#04213a" />
            <rect x="23.5" y="4" width="2" height="4" rx="1" fill="#04213a" opacity=".4" />
          </svg>
        </span>
      </div>

      {/* толгой */}
      <div className="flex items-center gap-3 px-6 pt-5">
        <LogoMark size={46} className="h-[46px] w-[46px]" />
        <div className="leading-tight">
          <p className="text-[13px] text-[#56758d]">Сайн байна уу</p>
          <p className="text-[18px] font-bold">Дархан Ус Суваг</p>
        </div>
        <span className="ml-auto grid h-11 w-11 place-items-center rounded-full bg-white text-[#0078be] shadow-sm">
          {ico(<><path d="M6 16V11a6 6 0 0112 0v5l2 2H4z" /><path d="M10 20a2 2 0 004 0" /></>, 20)}
        </span>
      </div>

      {/* төлбөрийн үлдэгдэл */}
      <div className="mx-6 mt-6 rounded-[28px] bg-gradient-to-br from-[#005b92] via-[#0078be] to-[#3cc3f0] p-6 text-white shadow-[0_18px_40px_-18px_rgba(0,91,146,.8)]">
        <p className="text-[13px] opacity-85">Төлбөрийн үлдэгдэл</p>
        <p className="mt-1 font-display text-[38px] font-bold leading-none">24,500₮</p>
        <div className="mt-6 flex items-center justify-between">
          <span className="text-[12px] opacity-85">Хэрэглэгчийн код · 102345</span>
          <span className="rounded-full bg-white px-5 py-2.5 text-[14px] font-semibold text-[#0078be]">Төлөх</span>
        </div>
      </div>

      {/* түргэн үйлдэл */}
      <div className="mx-6 mt-5 grid grid-cols-4 gap-3">
        {actions.map((a) => (
          <div key={a.l} className="flex flex-col items-center gap-2 rounded-[22px] bg-white py-4 shadow-sm">
            <span className="grid h-11 w-11 place-items-center rounded-full bg-[#e3f2fb] text-[#0078be]">{ico(a.i)}</span>
            <span className="text-[12px] font-medium">{a.l}</span>
          </div>
        ))}
      </div>

      {/* усны хэрэглээ */}
      <div className="mx-6 mt-5 rounded-[26px] bg-white p-5 shadow-sm">
        <div className="flex items-baseline justify-between">
          <p className="text-[15px] font-semibold">Усны хэрэглээ</p>
          <p className="text-[12px] text-[#56758d]">м³ / сар</p>
        </div>
        <div className="mt-4 flex h-[110px] items-end gap-3">
          {usage.map((v, i) => (
            <div key={i} className="flex flex-1 flex-col items-center gap-2">
              <div
                className={`w-full rounded-t-[10px] rounded-b-[4px] ${i === usage.length - 1 ? "bg-[#0078be]" : "bg-[#bfe3f7]"}`}
                style={{ height: `${v + 20}px` }}
              />
              <span className="text-[11px] text-[#56758d]">{i + 4}</span>
            </div>
          ))}
        </div>
      </div>

      {/* мэдэгдэл */}
      <div className="mx-6 mt-4 flex items-center gap-3 rounded-[22px] bg-white p-4 shadow-sm">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#e7f6ef] text-[#0b8458]">
          {ico(<path d="M20 6L9 17l-5-5" />, 20)}
        </span>
        <div className="min-w-0 leading-snug">
          <p className="text-[14px] font-semibold">Тоолуурын заалт</p>
          <p className="text-[12px] text-[#56758d]">Сарын 25-ны дотор илгээнэ үү</p>
        </div>
      </div>

      {/* доод цэс */}
      <div className="mt-auto flex h-[88px] shrink-0 justify-around border-t border-[#04213a]/5 bg-white/95 px-4 pt-3">
        {[
          { l: "Нүүр", on: true, i: <path d="M3 11l9-7 9 7M5 10v10h14V10" /> },
          { l: "Төлбөр", i: <><rect x="3" y="6" width="18" height="13" rx="2" /><path d="M3 10h18" /></> },
          { l: "Хүсэлт", i: <><path d="M14 3H6v18h12V7z" /><path d="M14 3v4h4" /></> },
          { l: "Профайл", i: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0116 0" /></> },
        ].map((t) => (
          <span key={t.l} className={`flex flex-col items-center gap-1 text-[11px] font-medium ${t.on ? "text-[#0078be]" : "text-[#56758d]"}`}>
            {ico(t.i)}
            {t.l}
          </span>
        ))}
      </div>
      <span className="absolute bottom-2 left-1/2 h-[5px] w-[134px] -translate-x-1/2 rounded-full bg-[#04213a]" />
    </div>
  );
}

/** Хазгай утас: тунгалаг дэлгэцийн ард аппын дэлгэцийг перспективээр тааруулж зурна, утасны хүрээ дээр нь */
function AppPhone({ className = "" }: { className?: string }) {
  const box = useRef<HTMLDivElement>(null);
  const screen = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = box.current!;
    const sc = screen.current!;
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (!w || !h) return;
      // ирмэгийн anti-alias зурвас гарахгүйн тулд төвөөс бага зэрэг тэлнэ (хүрээ дээр нь давхарлана)
      const cx = SCREEN.reduce((s, p) => s + p[0], 0) / 4;
      const cy = SCREEN.reduce((s, p) => s + p[1], 0) / 4;
      const quad = SCREEN.map(([x, y]) => [(cx + (x - cx) * 1.006) * w, (cy + (y - cy) * 1.006) * h] as P) as [P, P, P, P];
      sc.style.transform = quadMatrix(SW, SH, quad);
      sc.style.visibility = "visible";
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={box} className={`relative aspect-[1000/1667] ${className}`}>
      <div
        ref={screen}
        aria-hidden
        className="invisible absolute left-0 top-0 origin-top-left overflow-hidden rounded-[58px]"
        style={{ width: SW, height: SH }}
      >
        <AppScreen />
      </div>
      <Image
        src="/images/app-phone.png"
        alt="Дархан Ус Суваг мобайл апп"
        width={1000}
        height={1667}
        sizes="(min-width: 1024px) 280px, 220px"
        className="pointer-events-none relative h-full w-full select-none"
      />
    </div>
  );
}

const apple = (
  <path
    fill="currentColor"
    d="M16.4 12.6c0-2.4 2-3.6 2.1-3.7-1.1-1.7-2.9-1.9-3.5-1.9-1.5-.2-2.9.9-3.7.9-.8 0-1.9-.9-3.2-.8-1.6 0-3.1 1-4 2.4-1.7 3-.4 7.4 1.2 9.8.8 1.2 1.8 2.5 3 2.4 1.2 0 1.7-.8 3.1-.8s1.9.8 3.2.8c1.3 0 2.1-1.2 2.9-2.4.9-1.4 1.3-2.7 1.3-2.8 0 0-2.4-1-2.4-3.9zM14 5.4c.7-.8 1.1-1.9 1-3-1 0-2.1.7-2.8 1.5-.6.7-1.2 1.8-1 2.9 1.1.1 2.1-.6 2.8-1.4z"
  />
);
const play = <path fill="currentColor" d="M4.6 2.3c-.3.3-.4.7-.4 1.2v17c0 .5.1.9.4 1.2L14 12 4.6 2.3zm10.8 11.1l2.8 2.8-11.1 6.3 8.3-9.1zm0-2.8L7.1 1.5l11.1 6.3-2.8 2.8zm4.1 1.4l-2.6 1.5-3-3 3-3 2.6 1.5c.8.5.8 1.5 0 2z" />;

function StoreButton({ href, label, icon }: { href: string | null; label: string; icon: React.ReactNode }) {
  const inner = (
    <>
      <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden>
        {icon}
      </svg>
      <span className="leading-tight">
        <span className="block text-[10px] opacity-75">{href ? "Татах" : "Тун удахгүй"}</span>
        <span className="block font-display text-sm font-semibold">{label}</span>
      </span>
    </>
  );
  const cls = "flex items-center gap-2.5 rounded-xl bg-abyss px-4 py-2 text-foam transition";
  return href ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className={`${cls} hover:bg-deep`}>
      {inner}
    </a>
  ) : (
    <span aria-disabled="true" className={`${cls} cursor-default opacity-90`}>
      {inner}
    </span>
  );
}

/**
 * Footer дээрх мобайл аппын танилцуулга: зүүн талд текст, баруун талд хазгай утас (долгионы дээгүүр хөвсөн мэт).
 * Апп гараагүй үед дэлгүүрийн товчнууд "Тун удахгүй" (lib/content.ts → app).
 */
export default function AppPromo() {
  return (
    <div className="mx-auto grid max-w-7xl items-center gap-6 px-4 sm:px-8 md:grid-cols-[minmax(0,1fr)_auto] md:gap-12">
      <div className="order-2 md:order-1">
        <p className="flex items-center gap-3">
          <span className="eyebrow">Мобайл апп</span>
          <span className="rounded-full bg-water/15 px-2.5 py-1 text-[10px] font-semibold tracking-[0.15em] text-water">ТУН УДАХГҮЙ</span>
        </p>
        <h3 className="mt-3 text-h3">
          Дархан Ус Суваг — <span className="text-water">гар утсанд тань</span>
        </h3>
        <p className="mt-3 max-w-md text-sm leading-relaxed text-mist sm:text-base">
          Удахгүй манай үйлчилгээг гар утаснаасаа хэдхэн товшилтоор авах боломжтой болно.
        </p>
        <ul className="mt-4 grid gap-2 text-sm">
          {app.features.map((f) => (
            <li key={f} className="flex items-center gap-2.5">
              <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-water/15 text-water">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              </span>
              {f}
            </li>
          ))}
        </ul>
        <div className="mt-6 flex flex-wrap gap-3">
          <StoreButton href={app.ios} label="App Store" icon={apple} />
          <StoreButton href={app.android} label="Google Play" icon={play} />
        </div>
      </div>

      {/* утас: долгионы дээгүүр гарч хөвнө */}
      <div className="relative order-1 -mt-20 justify-self-center md:order-2 md:-mt-40 md:justify-self-end">
        <div className="motion-safe:animate-[app-float_7s_ease-in-out_infinite]">
          <AppPhone className="w-[190px] sm:w-[220px] lg:w-[260px]" />
        </div>
        <span aria-hidden className="absolute bottom-[3%] left-1/2 h-5 w-3/5 -translate-x-1/2 rounded-full bg-abyss/15 blur-lg" />
      </div>
    </div>
  );
}
