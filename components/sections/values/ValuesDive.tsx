import { values } from "@/lib/content";
import { Icon, missionIcon, valueIcons, valuesIcon, visionIcon } from "./icons";

const label = "font-display text-[11px] font-medium tracking-[0.28em] text-aqua uppercase sm:text-xs";
/** [@media(max-height:720px)] — намхан утас: бүгд нэг дэлгэцэд багтахын тулд нягт */
const card =
  "vd-card relative flex flex-col overflow-hidden rounded-[1.5rem] border border-abyss/10 bg-white/55 p-4 opacity-0 shadow-[0_24px_60px_-30px_rgba(0,0,0,.7)] sm:p-6 lg:rounded-[1.75rem] lg:p-7 [@media(max-height:720px)]:p-3.5";

/** Хэсгийн тэмдэг: гэрэлтсэн дугуй */
function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-aqua/30 bg-aqua/10 text-aqua shadow-[0_0_36px_-8px_rgba(95,211,247,.65)] sm:h-12 sm:w-12">
      <Icon className="h-5 w-5 sm:h-6 sm:w-6">{children}</Icon>
    </span>
  );
}

function CardHead({ n, text, icon }: { n: string; text: string; icon: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <Badge>{icon}</Badge>
      <h3 className={label}>
        <span className="text-mist">{n} —</span> {text}
      </h3>
    </div>
  );
}

const pillars = [
  { n: "01", icon: visionIcon, ...values.vision },
  { n: "02", icon: missionIcon, ...values.mission },
];

/**
 * Hero-ийн шумбалтын дараах усан доорх хэсэг: нэг дэлгэцэд Алсын хараа, Эрхэм зорилго, Үнэт зүйлс зэрэгцэн гарна
 * (desktop — 3 багана, утсан дээр дээрээс доош). Hero-ийн sticky section дотор, усны (WebGL) дээгүүр; Hero.tsx-ийн
 * timeline .vd-* классуудыг анимацлана. Текст нь dus.mn-ийн албан ёсны (lib/content.ts).
 * webgl=false — усны WebGL байхгүй/ачаалж байхад дэвсгэр нь өөрөө бараан усан доорх градиент.
 */
export default function ValuesDive({ webgl }: { webgl: boolean }) {
  return (
    <div className="theme-dark pointer-events-none absolute inset-0 text-abyss motion-reduce:hidden">
      {/* усан доорх дэвсгэр: WebGL-тэй үед текстийн ард бүдэг сүүдэр, үгүй бол бүтэн бараан ус */}
      <div aria-hidden className="vd-backdrop absolute inset-0 opacity-0">
        <div
          className={`absolute inset-0 bg-[radial-gradient(ellipse_at_50%_-10%,#1b5d8c_0%,#0a3354_45%,#041a2e_100%)] transition-opacity duration-[1200ms] ${
            webgl ? "opacity-0" : "opacity-100"
          }`}
        />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_70%_at_50%_55%,rgba(4,26,46,.6),rgba(4,26,46,0))]" />
      </div>

      <div className="vd-stage absolute inset-0 flex flex-col items-center justify-center px-4 pb-6 pt-[5.5rem] sm:px-8 sm:pt-24 lg:pb-10 lg:pt-28">
        <div className="w-full max-w-7xl">
          {/* гарчиг */}
          <div className="vd-head text-center opacity-0">
            <p className={`${label} hidden sm:block`}>{values.eyebrow}</p>
            <h2 className="font-display text-[clamp(1.35rem,0.9rem+2vw,2.75rem)] font-bold leading-[1.1] tracking-tight text-balance sm:mt-3">
              Алсын хараа, эрхэм зорилго, <span className="text-water">үнэт зүйлс</span>
            </h2>
            <p className="mx-auto mt-3 hidden max-w-2xl text-sm leading-relaxed text-mist sm:block lg:text-base">{values.lead}</p>
          </div>

          {/* гурван багана: алсын хараа | эрхэм зорилго | үнэт зүйлс */}
          <div className={`mt-4 grid gap-2.5 sm:mt-8 sm:gap-4 lg:mt-10 lg:grid-cols-3 lg:gap-5 [@media(max-height:720px)]:mt-3 [@media(max-height:720px)]:gap-2`}>
            {pillars.map((p) => (
              <article key={p.n} aria-label={p.label} className={card}>
                {/* чимэглэл: доод буланд бүдэг том тэмдэг, долгионт цагираг (desktop-ийн хоосон зайд) */}
                <span aria-hidden className="pointer-events-none absolute -bottom-10 -right-10 hidden h-56 w-56 text-aqua/[0.07] lg:block">
                  <svg viewBox="0 0 200 200" className="absolute inset-0 h-full w-full">
                    {[40, 65, 90].map((r) => (
                      <circle key={r} cx="100" cy="100" r={r} fill="none" stroke="currentColor" strokeWidth="2" />
                    ))}
                  </svg>
                  <Icon className="absolute inset-[34%] h-[32%] w-[32%] text-aqua/25">{p.icon}</Icon>
                </span>
                <CardHead n={p.n} text={p.label} icon={p.icon} />
                <p className={`mt-3 text-[15px] font-medium leading-snug text-abyss sm:mt-5 sm:text-lg lg:font-display lg:text-[1.35rem] lg:font-semibold lg:leading-[1.3] [@media(max-height:720px)]:mt-2 [@media(max-height:720px)]:text-sm`}>
                  {p.text}
                </p>
              </article>
            ))}

            <article aria-label="Үнэт зүйлс" className={card}>
              <CardHead n="03" text="Үнэт зүйлс" icon={valuesIcon} />
              {/* утсан дээр 2×2 нэр; том дэлгэцэнд нэр + тайлбар */}
              <ul className={`mt-3 grid grid-cols-2 gap-x-3 gap-y-2 sm:mt-5 sm:grid-cols-1 sm:gap-3.5 [@media(max-height:720px)]:mt-2`}>
                {values.items.map((v) => (
                  <li key={v.id} className="flex gap-2.5 sm:gap-3">
                    <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-aqua/12 text-aqua sm:h-8 sm:w-8">
                      <Icon className="h-4 w-4">{valueIcons[v.id]}</Icon>
                    </span>
                    <div className="min-w-0">
                      <h4 className="text-[13px] font-semibold leading-snug sm:text-[15px]">{v.title}</h4>
                      <p className="mt-0.5 hidden text-[13px] leading-snug text-mist sm:block">{v.text}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </article>
          </div>
        </div>
      </div>
    </div>
  );
}
