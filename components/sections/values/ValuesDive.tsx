import { values } from "@/lib/content";
import { Icon, missionIcon, valueIcons, valuesIcon, visionIcon } from "./icons";

/** Өгүүлбэрийг үгээр нь салгана — гүйлгэх тусам үг бүр тодорно (Hero.tsx-ийн timeline, .vd-w) */
function Words({ text }: { text: string }) {
  return text.split(" ").map((w, i) => (
    <span key={i} className="vd-w">
      {w}{" "}
    </span>
  ));
}

const stage = "vd-stage pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-5 pb-20 pt-[5.5rem] opacity-0 sm:px-10 sm:pt-24 lg:pb-24 lg:pt-28";
const label = "font-display text-xs font-medium tracking-[0.32em] text-aqua uppercase sm:text-sm";

/** Хэсгийн тэмдэг: гэрэлтсэн дугуй */
function Badge({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={`mx-auto h-14 w-14 place-items-center rounded-full border border-aqua/30 bg-aqua/10 text-aqua shadow-[0_0_44px_-8px_rgba(95,211,247,.65)] sm:h-16 sm:w-16 ${className || "grid"}`}
    >
      <Icon className="h-7 w-7 sm:h-8 sm:w-8">{children}</Icon>
    </span>
  );
}

const pillars = [
  { cls: "vd-vision", n: "01", icon: visionIcon, ...values.vision },
  { cls: "vd-mission", n: "02", icon: missionIcon, ...values.mission },
];

/**
 * Hero-ийн шумбалтын дараах усан доорх хэсэг: оршил → Алсын хараа → Эрхэм зорилго → Үнэт зүйлс дараалан
 * гарч ирнэ (scroll-оор, Hero.tsx-ийн timeline удирдана). Hero-ийн sticky section дотор, усны (WebGL) дээгүүр.
 * Текст нь dus.mn-ийн албан ёсны (lib/content.ts). .vd-* классуудыг Hero.tsx анимацлана.
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
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_50%_52%,rgba(4,26,46,.55),rgba(4,26,46,0))]" />
      </div>

      {/* оршил: гадаргууг нэвтэлмэгц */}
      <div className={`${stage} vd-intro`}>
        <div className="max-w-3xl text-center">
          <p className={label}>{values.eyebrow}</p>
          <h2 className="mt-5 font-display text-[clamp(1.75rem,1rem+3vw,3.75rem)] font-bold leading-[1.08] tracking-tight text-balance">
            Алсын хараа, эрхэм зорилго, <span className="text-water">үнэт зүйлс</span>
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-sm leading-relaxed text-balance text-mist sm:text-base">{values.lead}</p>
        </div>
      </div>

      {/* алсын хараа, эрхэм зорилго: том өгүүлбэр, үг бүр гүйлгэх тусам тодорно */}
      {pillars.map((p) => (
        <section key={p.cls} aria-label={p.label} className={`${stage} ${p.cls}`}>
          <div className="max-w-4xl text-center">
            <Badge>{p.icon}</Badge>
            <h3 className={`${label} mt-5`}>
              <span className="text-mist">{p.n} —</span> {p.label}
            </h3>
            <p className="mt-6 font-display text-[clamp(1.5rem,0.95rem+2.5vw,3.35rem)] font-semibold leading-[1.18] tracking-tight text-balance">
              <Words text={p.text} />
            </p>
          </div>
        </section>
      ))}

      {/* үнэт зүйлс: 4 карт (утсан дээр нэг багана, хэвтээ мөр) */}
      <section aria-label="Үнэт зүйлс" className={`${stage} vd-values [@media(max-height:720px)]:pb-4`}>
        <div className="w-full max-w-6xl">
          <div className="text-center">
            {/* утсан дээр 4 карт багтахын тулд тэмдэггүй */}
            <Badge className="hidden sm:grid">{valuesIcon}</Badge>
            <h3 className={`${label} sm:mt-5`}>
              <span className="text-mist">03 —</span> Үнэт зүйлс
            </h3>
          </div>
          <ol className="mt-4 grid gap-2 sm:mt-8 sm:grid-cols-2 sm:gap-4 lg:mt-10 lg:grid-cols-4">
            {values.items.map((v, i) => (
              <li
                key={v.id}
                className="vd-card flex gap-3 rounded-2xl border border-abyss/10 bg-white/55 p-3.5 shadow-[0_18px_50px_-24px_rgba(0,0,0,.6)] sm:gap-4 sm:p-5 lg:flex-col lg:p-6"
              >
                <div className="flex shrink-0 flex-col items-center gap-2 lg:flex-row lg:justify-between">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-aqua/12 text-aqua">
                    <Icon className="h-5 w-5">{valueIcons[v.id]}</Icon>
                  </span>
                  <span className="font-display text-xs text-mist">0{i + 1}</span>
                </div>
                <div>
                  <h4 className="text-[15px] font-semibold leading-snug sm:text-base">{v.title}</h4>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-mist sm:mt-2 sm:text-sm">{v.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* явц: аль хэсэг дээр байгаа (доод голд); намхан дэлгэцэнд (жижиг утас) үнэт зүйлсийн 4 карт багтахын тулд нуугдана */}
      <div aria-hidden className="vd-progress absolute inset-x-0 bottom-6 flex justify-center gap-3 px-5 opacity-0 sm:bottom-8 sm:gap-5 [@media(max-height:720px)]:hidden">
        {[values.vision.label, values.mission.label, "Үнэт зүйлс"].map((t) => (
          <div key={t} className="w-[6.5rem] sm:w-36">
            <p className="truncate text-center font-display text-[10px] tracking-[0.1em] text-mist uppercase sm:text-[11px] sm:tracking-[0.18em]">{t}</p>
            <div className="mt-2 h-[2px] overflow-hidden rounded-full bg-abyss/15">
              <div className="vd-bar h-full origin-left scale-x-0 rounded-full bg-aqua shadow-[0_0_10px_var(--color-aqua)]" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
