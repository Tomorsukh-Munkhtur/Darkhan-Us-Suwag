import { values } from "@/lib/content";
import SectionHeading from "../ui/SectionHeading";
import WaterEdge from "./services/WaterEdge";
import { Icon, missionIcon, valueIcons, visionIcon } from "./values/icons";

/**
 * Алсын хараа, эрхэм зорилго, үнэт зүйлс (dus.mn-ий албан ёсны текст — lib/content.ts) — хөдөлгөөнгүй хувилбар.
 * Ердийн үед энэ агуулга Hero-ийн шумбалтын үед усан доор гарна (values/ValuesDive.tsx); энэ хэсэг зөвхөн
 * хөдөлгөөн багасгах горимд (lib/motion.ts → RESPECT_REDUCED_MOTION) Hero-ийн доор харагдана (app/intro/page.tsx).
 */
export default function Values() {
  const pillars = [
    { ...values.vision, icon: visionIcon },
    { ...values.mission, icon: missionIcon },
  ];

  return (
    <section id="values" className="relative z-30 bg-foam py-20 sm:py-24">
      {/* дээд ирмэг: урсаж буй ус — Hero-ийн дээгүүр гарна (өнгө нь хэсгийн дэвсгэр, заагшгүй) */}
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
              <p className="relative mt-6 text-justify text-lg font-medium leading-relaxed text-abyss sm:text-xl lg:text-[1.4rem] lg:leading-snug">{p.text}</p>
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
                <p className="mt-2 text-justify text-sm leading-relaxed text-mist">{v.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
