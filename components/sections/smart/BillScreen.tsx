import { forwardRef } from "react";
import { app } from "@/lib/content";
import { LogoMark } from "../../ui/Logo";

const ico = (d: React.ReactNode, size = 20) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    {d}
  </svg>
);
const bell = (
  <>
    <path d="M6 16V11a6 6 0 0112 0v5l2 2H4z" />
    <path d="M10 20a2 2 0 004 0" />
  </>
);
const check = <path d="M20 6L9 17l-5-5" />;

/** Сарын хэрэглээ (м³) — сүүлийнх нь энэ сарынх, заалт ирэхэд өснө */
const USAGE = [52, 64, 48, 70, 58];
const fade = "transition-[opacity,transform] duration-500 ease-[cubic-bezier(.22,1,.36,1)]";

/**
 * BILL center аппын жишээ дэлгэц (393×852, AppPhone дотор перспективээр). step — SmartServices-ийн алхам:
 * 0 — сүүлийн заалт, төлбөр хүлээгдэж байна; 1 — тоолуураас шинэ заалт ирж (мэдэгдэл), хэрэглээ шинэчлэгдэнэ;
 * 2 — төлбөр төлөгдсөн. Заалтын тоог (ref) тоолуурын 3D дэлгэцтэй ижил байлгахаар хост шууд бичнэ.
 * TODO: аппын бодит screenshot гарвал зургаар солих.
 */
const BillScreen = forwardRef<HTMLSpanElement, { step: number; reading: string }>(function BillScreen({ step, reading }, readingRef) {
  const live = step >= 1;
  const paid = step >= 2;
  return (
    // theme-light: бараан хэсэг (SmartServices) дотор ч аппын өнгө (bg-white г.м.) цайвар хэвээр
    <div className="theme-light relative flex h-full flex-col overflow-hidden bg-[#f3f8fc] font-sans text-[#04213a]">
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
          </svg>
        </span>
      </div>

      {/* толгой */}
      <div className="flex items-center gap-3 px-6 pt-4">
        <LogoMark size={44} className="h-11 w-11" />
        <div className="leading-tight">
          <p className="text-[13px] text-[#56758d]">Сайн байна уу</p>
          <p className="text-[18px] font-bold">{app.name}</p>
        </div>
        <span className="relative ml-auto grid h-11 w-11 place-items-center rounded-full bg-white text-[#0078be] shadow-sm">
          {ico(bell)}
          <span className={`absolute right-2.5 top-2.5 h-2.5 w-2.5 rounded-full bg-[#d7263d] ring-2 ring-white ${fade} ${live ? "scale-100 opacity-100" : "scale-0 opacity-0"}`} />
        </span>
      </div>

      {/* төлбөр */}
      <div
        className={`mx-6 mt-5 rounded-[28px] p-6 text-white shadow-[0_18px_40px_-18px_rgba(0,91,146,.8)] transition-[background] duration-700 ${
          paid ? "bg-[linear-gradient(135deg,#0b8458,#1fae78)]" : "bg-[linear-gradient(135deg,#005b92,#0078be_55%,#3cc3f0)]"
        }`}
      >
        <p className="text-[13px] opacity-85">Төлбөрийн үлдэгдэл</p>
        <div className="relative mt-1 h-[40px]">
          <p className={`absolute inset-0 font-display text-[38px] font-bold leading-none ${fade} ${paid ? "-translate-y-3 opacity-0" : ""}`}>24,500₮</p>
          <p className={`absolute inset-0 font-display text-[38px] font-bold leading-none ${fade} ${paid ? "" : "translate-y-3 opacity-0"}`}>0₮</p>
        </div>
        <div className="mt-5 flex items-center justify-between">
          <span className="text-[12px] opacity-85">Хэрэглэгчийн код · 102345</span>
          <span
            className={`flex items-center gap-1.5 rounded-full px-5 py-2.5 text-[14px] font-semibold transition-colors duration-500 ${
              paid ? "bg-white/20 text-white" : "bg-white text-[#0078be]"
            }`}
          >
            {paid && ico(check, 16)}
            {paid ? "Төлөгдсөн" : "Төлөх"}
          </span>
        </div>
      </div>

      {/* тоолуурын заалт */}
      <div className="mx-6 mt-4 rounded-[26px] bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <p className="text-[15px] font-semibold">Тоолуурын заалт</p>
          <span
            className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors duration-500 ${
              live ? "bg-[#e7f6ef] text-[#0b8458]" : "bg-[#eef3f7] text-[#56758d]"
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${live ? "animate-pulse bg-[#0b8458]" : "bg-[#9fb4c4]"}`} />
            {live ? "Шууд" : "Сүүлийн"}
          </span>
        </div>
        <p className="mt-2 font-display text-[34px] font-bold leading-none tracking-tight">
          <span ref={readingRef}>{reading}</span>
          <span className="ml-1.5 text-[16px] font-semibold text-[#56758d]">м³</span>
        </p>
        <p className="mt-1.5 text-[12px] text-[#56758d]">{live ? "Ухаалаг тоолуураас автоматаар · дөнгөж сая" : "Тоолуураас ирсэн сүүлийн заалт"}</p>
      </div>

      {/* хэрэглээ */}
      <div className="mx-6 mt-4 rounded-[26px] bg-white p-5 shadow-sm">
        <div className="flex items-baseline justify-between">
          <p className="text-[15px] font-semibold">Усны хэрэглээ</p>
          <p className="text-[12px] text-[#56758d]">м³ / сар</p>
        </div>
        <div className="mt-4 flex h-[96px] items-end gap-3">
          {[...USAGE, null].map((v, i) => {
            const now = v === null;
            const h = now ? (live ? 62 : 26) : v;
            return (
              <div key={i} className="flex flex-1 flex-col items-center gap-2">
                <div
                  className={`w-full rounded-t-[10px] rounded-b-[4px] transition-[height,background-color] duration-700 ease-[cubic-bezier(.22,1,.36,1)] ${now ? "bg-[#0078be]" : "bg-[#bfe3f7]"}`}
                  style={{ height: `${h + 10}px` }}
                />
                <span className={`text-[11px] ${now ? "font-semibold text-[#0078be]" : "text-[#56758d]"}`}>{i + 5}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* доод цэс */}
      <div className="mt-auto flex h-[84px] shrink-0 justify-around border-t border-[#04213a]/5 bg-white/95 px-4 pt-3">
        {[
          { l: "Нүүр", on: true, i: <path d="M3 11l9-7 9 7M5 10v10h14V10" /> },
          { l: "Төлбөр", i: <><rect x="3" y="6" width="18" height="13" rx="2" /><path d="M3 10h18" /></> },
          { l: "Хэрэглээ", i: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /> },
          { l: "Профайл", i: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0116 0" /></> },
        ].map((t) => (
          <span key={t.l} className={`flex flex-col items-center gap-1 text-[11px] font-medium ${t.on ? "text-[#0078be]" : "text-[#56758d]"}`}>
            {ico(t.i, 22)}
            {t.l}
          </span>
        ))}
      </div>
      <span className="absolute bottom-2 left-1/2 h-[5px] w-[134px] -translate-x-1/2 rounded-full bg-[#04213a]" />

      {/* мэдэгдэл: дээрээс гулсаж орно — 1: шинэ заалт, 2: төлбөр амжилттай */}
      {[
        { on: step === 1, tone: "bg-[#e3f2fb] text-[#0078be]", i: <><circle cx="12" cy="13" r="7" /><path d="M12 13l3-3M9 3h6" /></>, t: "Шинэ заалт ирлээ", s: "Ухаалаг тоолуураас автоматаар" },
        { on: step === 2, tone: "bg-[#e7f6ef] text-[#0b8458]", i: check, t: "Төлбөр амжилттай", s: "24,500₮ · баярлалаа!" },
      ].map((n) => (
        <div
          key={n.t}
          className={`absolute inset-x-4 top-[58px] flex items-center gap-3 rounded-[22px] bg-white/95 p-3.5 shadow-[0_18px_40px_-14px_rgba(4,33,58,.45)] backdrop-blur ${fade} ${
            n.on ? "translate-y-0 opacity-100" : "-translate-y-[130%] opacity-0"
          }`}
        >
          <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${n.tone}`}>{ico(n.i)}</span>
          <div className="min-w-0 leading-snug">
            <p className="text-[14px] font-semibold">{n.t}</p>
            <p className="text-[12px] text-[#56758d]">{n.s}</p>
          </div>
          <span className="ml-auto self-start text-[11px] text-[#56758d]">одоо</span>
        </div>
      ))}
    </div>
  );
});

export default BillScreen;
