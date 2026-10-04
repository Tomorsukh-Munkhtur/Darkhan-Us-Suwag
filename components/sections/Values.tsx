import { values } from "@/lib/content";
import SectionHeading from "../ui/SectionHeading";
import WaterEdge from "./services/WaterEdge";

type ValueId = (typeof values.items)[number]["id"];

/** Үнэт зүйл бүрийн тэмдэг (24×24, зураасан) */
const valueIcons: Record<ValueId, React.ReactNode> = {
  // технологийн шинэчлэл — араа
  tech: (
    <>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1" />
    </>
  ),
  // найдвартай үйлчилгээ — бамбай
  trust: (
    <>
      <path d="M12 3l7.5 3v5.5c0 4.5-3.2 8.2-7.5 9.5-4.3-1.3-7.5-5-7.5-9.5V6z" />
      <path d="M8.6 12.2l2.3 2.3 4.6-4.8" />
    </>
  ),
  // өндөр бүтээмж, төгс чанар — тэмдэг (од)
  quality: <path d="M12 3.2l2.6 5.4 5.9.8-4.3 4.1 1 5.8-5.2-2.8-5.2 2.8 1-5.8-4.3-4.1 5.9-.8z" />,
  // шуурхай, уян хатан — аянга
  agile: <path d="M13.2 2.8L5 13.4h6.2l-1.4 7.8 8.2-10.6h-6.2z" />,
};

function Icon({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden className={className}>
      {children}
    </svg>
  );
}

/**
 * Алсын хараа, эрхэм зорилго, үнэт зүйлс (dus.mn-ий албан ёсны текст — lib/content.ts).
 * Хотын мапаас доош гүйлгэхэд дээд ирмэгийн тайван усны гадаргуу (WaterEdge) мапын дээгүүр доороос бүрхэж гарна
 * (мап удаан гүйж бараанна — CityMap.tsx); бичвэрүүд үргэлж тод (гарч ирэх хөдөлгөөнгүй).
 */
export default function Values() {
  const pillars = [
    {
      ...values.vision,
      // алсын хараа — нүд
      icon: (
        <>
          <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
          <circle cx="12" cy="12" r="3" />
        </>
      ),
    },
    {
      ...values.mission,
      // эрхэм зорилго — бай (дусал төвтэй)
      icon: (
        <>
          <circle cx="12" cy="12" r="8.5" />
          <circle cx="12" cy="12" r="4.8" />
          <path d="M12 9.6s-1.6 1.8-1.6 2.9a1.6 1.6 0 003.2 0c0-1.1-1.6-2.9-1.6-2.9z" />
        </>
      ),
    },
  ];

  return (
    <section id="values" className="relative z-30 bg-foam py-20 sm:py-24">
      {/* дээд ирмэг: урсаж буй ус — мапын дээгүүр гарна (өнгө нь хэсгийн дэвсгэр, заагшгүй) */}
      <div aria-hidden className="absolute inset-x-0 top-0 h-0" style={{ "--svc-top": "#f5fbff" } as React.CSSProperties}>
        <WaterEdge variant="calm" />
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-8">
        <SectionHeading
          still
          eyebrow={values.eyebrow}
          title={
            <>
              Алсын хараа, эрхэм зорилго, <span className="text-water">үнэт зүйлс</span>
            </>
          }
          lead={values.lead}
        />

        {/* алсын хараа, эрхэм зорилго — хоёр том карт */}
        <div className="mt-10 grid gap-4 sm:mt-12 lg:grid-cols-2 lg:gap-6">
          {pillars.map((p, i) => (
            <article
              key={p.label}
              className="relative overflow-hidden rounded-3xl border border-abyss/10 bg-white/75 p-6 shadow-[0_18px_50px_-30px_rgba(4,33,58,.35)] sm:p-8 lg:p-10"
            >
              {/* чимэглэл: дэвсгэрийн бүдэг долгионт цагираг */}
              <svg aria-hidden viewBox="0 0 200 200" className="pointer-events-none absolute -right-10 -top-10 h-48 w-48 text-water/10 sm:h-56 sm:w-56">
                {[30, 55, 80].map((r) => (
                  <circle key={r} cx="100" cy="100" r={r} fill="none" stroke="currentColor" strokeWidth="2" />
                ))}
              </svg>
              <div className="relative flex items-center gap-4">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-water/10 text-water">
                  <Icon className="h-6 w-6">{p.icon}</Icon>
                </span>
                <div>
                  <p className="font-display text-xs tracking-[0.25em] text-mist">0{i + 1}</p>
                  <h3 className="mt-1 text-h4 font-bold">{p.label}</h3>
                </div>
              </div>
              <p className="relative mt-6 text-lg font-medium leading-relaxed text-abyss sm:text-xl lg:text-[1.4rem] lg:leading-snug">{p.text}</p>
            </article>
          ))}
        </div>

        {/* үнэт зүйлс — 4 карт */}
        <div className="mt-12 sm:mt-16">
          <div className="flex items-end justify-between gap-4">
            <h3 className="text-h4 font-bold">Үнэт зүйлс</h3>
            <span aria-hidden className="mb-1 hidden h-px flex-1 bg-abyss/10 sm:block" />
          </div>
          <ol className="mt-6 grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
            {values.items.map((v, i) => (
              <li key={v.id} className="group rounded-2xl border border-abyss/10 bg-white/60 p-5 transition-colors hover:border-water/40 hover:bg-white sm:p-6">
                <div className="flex items-center justify-between">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-water/10 text-water transition-colors group-hover:bg-water group-hover:text-white">
                    <Icon className="h-5 w-5">{valueIcons[v.id]}</Icon>
                  </span>
                  <span className="font-display text-xs text-mist">0{i + 1}</span>
                </div>
                <h4 className="mt-4 text-[15px] font-semibold leading-snug">{v.title}</h4>
                <p className="mt-2 text-sm leading-relaxed text-mist">{v.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
