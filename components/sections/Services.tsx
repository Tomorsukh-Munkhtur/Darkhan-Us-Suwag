"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { services } from "@/lib/content";
import SectionHeading from "../ui/SectionHeading";
import SupplyVisual3D from "@/components/three/faucet/SupplyVisual3D";
import SewerVisual3D from "@/components/three/sewer/SewerVisual3D";
import TreatmentVisual3D from "@/components/three/treatment/TreatmentVisual3D";
import { hasWebGL2 } from "@/components/three/journey/utils/browser";

const WaterSurface = dynamic(() => import("@/components/three/WaterSurface"), { ssr: false });

gsap.registerPlugin(ScrollTrigger);

type ArtProps = { className?: string; triggerId?: string; active?: boolean };

// цорго → шилэн аяга, газар доорх татуургын огтлол, цэвэрлэх байгууламж: 3D (хамтрагчийн ажил).
// 3D бэлэн болох хүртэл, WebGL байхгүй, алдаа гарвал хуучин SVG зураг (services/Illustrations) харагдана.
const arts: Record<string, React.FC<ArtProps>> = {
  supply: SupplyVisual3D,
  sewer: SewerVisual3D,
  treatment: TreatmentVisual3D,
};

const NUM = /^\d[\d,]*(\.\d+)?$/;
const pad = (n: number) => String(n).padStart(2, "0");
const N = services.length;

function Drop() {
  return (
    <svg width="12" height="15" viewBox="0 0 14 18" className="shrink-0" aria-hidden>
      <path d="M7 0C7 0 0 8 0 11.5C0 15.1 3.1 18 7 18S14 15.1 14 11.5C14 8 7 0 7 0Z" fill="currentColor" />
    </svg>
  );
}

/** Зургийн хүрээн дээрх шошго: дугаар (зүүн дээд), үйлчилгээ (зүүн доод) */
function FrameLabels({ i, tag }: { i: number; tag: string }) {
  return (
    <>
      <span className="absolute left-4 top-4 z-10 rounded-full bg-white/90 px-3 py-1.5 font-display text-[11px] font-semibold tracking-[0.2em] text-abyss shadow-sm backdrop-blur sm:left-5 sm:top-5">
        {pad(i + 1)} / {pad(N)}
      </span>
      <span className="absolute bottom-4 left-4 z-10 rounded-full bg-white/90 px-3.5 py-1.5 font-display text-[11px] font-semibold tracking-[0.15em] text-abyss shadow-sm backdrop-blur sm:bottom-5 sm:left-5 sm:text-xs">
        {tag}
      </span>
    </>
  );
}

const FRAME = "overflow-hidden rounded-[2rem] bg-[#0b2e4c] shadow-[0_40px_90px_-45px_rgba(4,33,58,.55)] ring-1 ring-abyss/10";

/**
 * Бидний үйл ажиллагаа — цайвар усан градиент дэвсгэр, наалттай 3D дэлгэц.
 * Desktop: зүүн талд НЭГ наалттай дэлгэц (3 үйлчилгээний 3D зураг давхар), баруун талд тайлбарууд гүйнэ.
 * Дэлгэцийн голд ирсэн тайлбарын 3D зураг зөөлөн солигдон гарна; идэвхгүй нь зурахгүй (ачаалагдсан хэвээр).
 * 3D зургийн scroll-ын явц (усны түвшин г.м.) нь өөрийн тайлбарын мөрөөс уншигдана (triggerId).
 * Утсан дээр: үйлчилгээ бүр — зураг дээр, тайлбар доор. Төгсгөлд нь Усны чанар (dark) руу гүн рүү шумбах мэт харанхуйлна.
 */
export default function Services() {
  const root = useRef<HTMLElement>(null);
  // null — анх (SSR); 3D зургийг desktop эсвэл утасны байрлалд л нэг удаа үүсгэнэ (давхар WebGL-гүй)
  const [desktop, setDesktop] = useState<boolean | null>(null);
  const [active, setActive] = useState(0);
  // арын усны урсгал: WebGL2 байвал, хэсэг дэлгэцэн дээр байхад л зурна
  const [flow, setFlow] = useState<{ reduced: boolean } | null>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    if (hasWebGL2()) setFlow({ reduced: window.matchMedia("(prefers-reduced-motion: reduce)").matches });
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting));
    io.observe(root.current!);
    return () => io.disconnect();
  }, []);
  // 3D scene-үүдийг нэг дор биш, дэс дараалан ачаална: одоогийн ба дараагийн үйлчилгээнийх (нэг агшинд 3 shader хөрвүүлэхгүй)
  const [loaded, setLoaded] = useState(1);
  useEffect(() => setLoaded((n) => Math.max(n, active + 1)), [active]);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const on = () => setDesktop(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  // desktop: аль тайлбар дэлгэцийн голд байна — тэр үйлчилгээний зураг наалттай дэлгэцэд
  useEffect(() => {
    if (!desktop) return;
    const sts = gsap.utils.toArray<HTMLElement>(".svc-row", root.current).map((row, i) =>
      ScrollTrigger.create({ trigger: row, start: "top center", end: "bottom center", onToggle: (self) => self.isActive && setActive(i) }),
    );
    return () => sts.forEach((st) => st.kill());
  }, [desktop]);

  useEffect(() => {
    const mm = gsap.matchMedia();
    mm.add(
      "(prefers-reduced-motion: no-preference)",
      () => {
        gsap.utils.toArray<HTMLElement>(".svc-copy", root.current).forEach((copy) => {
          const q = gsap.utils.selector(copy);
          // тайлбар доороос хөвж гарна; тоо нь бодит тоо бол 0-ээс тоологдоно ("XX" хэвээр)
          gsap
            .timeline({ scrollTrigger: { trigger: copy, start: "top 80%", once: true } })
            .fromTo(q(".svc-reveal"), { y: 28, opacity: 0 }, { y: 0, opacity: 1, duration: 0.9, ease: "power3.out", stagger: 0.07 })
            .add(() => {
              q(".svc-stat").forEach((el) => {
                const v = el.dataset.value ?? "";
                if (!NUM.test(v)) return;
                const n = parseFloat(v.replace(/,/g, ""));
                const dec = v.split(".")[1]?.length ?? 0;
                const o = { n: 0 };
                gsap.to(o, {
                  n,
                  duration: 1.6,
                  ease: "power2.out",
                  onUpdate: () => {
                    el.textContent = o.n.toLocaleString("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec });
                  },
                });
              });
            }, 0.3);
        });
      },
      root,
    );
    return () => mm.revert();
  }, []);

  return (
    // усан градиент: дээрээ маш цайвар, доошлох тусам арай гүн цэнхэр (усанд шумбах мэт)
    <section id="services" ref={root} className="relative bg-[linear-gradient(#eef6fb,#d9ecf8)]">
      {/* арын цэвэрхэн усны урсгал (усан сангийн ёроолд тусах гэрэл шиг): дэлгэцэнд тогтоод хэсэгтэй хамт гүйнэ,
          дээд/доод ирмэгээрээ уусна. Хэсгийг бүтэн хамарсан absolute давхарга дотор sticky — зай эзлэхгүй,
          хэсгийн доод ирмэгээс хэтрэхгүй (сөрөг margin-тай бол хэтэрдэг) */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="svc-flow sticky top-0 h-[100svh] overflow-hidden">
          {flow && <WaterSurface running={inView} reduced={flow.reduced} strength={0.475} speed={0.9} even ink />}
        </div>
      </div>

      <div className="relative mx-auto max-w-6xl px-4 pt-28 sm:px-8 sm:pt-40 lg:pt-44">
        <SectionHeading
          eyebrow="Ус эхэлнэ · Ус буцна · Бид цэвэршүүлнэ"
          align="center"
          title={
            <>
              БИДНИЙ <span className="text-water">ҮЙЛ АЖИЛЛАГАА</span>
            </>
          }
          lead="Дархан Ус Суваг нь хотын усны бүтэн циклийг — эх үүсвэрээс хэрэглэгч хүртэл, хэрэглэгчээс байгаль руу — хариуцан ажилладаг."
        />

        <div className="mt-16 sm:mt-24 lg:mt-20 lg:grid lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-20">
          {/* desktop: НЭГ наалттай 3D дэлгэц — тайлбарууд гүйх хооронд дэлгэцийн голд тогтоно */}
          {desktop && (
            <div className="relative">
              <div className={`sticky top-[calc(50svh-min(38svh,19.5rem))] h-[min(76svh,39rem)] ${FRAME}`}>
                {services.map((s, i) => {
                  const Art = arts[s.id];
                  return (
                    <div
                      key={s.id}
                      aria-hidden={active !== i}
                      className={`absolute inset-0 transition-opacity duration-700 ease-out ${active === i ? "opacity-100" : "pointer-events-none opacity-0"}`}
                    >
                      {i <= loaded && <Art className="block h-full w-full" triggerId={`svc-${s.id}`} active={active === i} />}
                      <FrameLabels i={i} tag={s.tag} />
                    </div>
                  );
                })}
                {/* аль үйлчилгээн дээр байгаа: баруун доод буланд 3 зурвас */}
                <div aria-hidden className="absolute bottom-5 right-5 z-10 flex gap-1.5">
                  {services.map((s, i) => (
                    <span key={s.id} className={`h-1.5 rounded-full transition-all duration-500 ${active === i ? "w-7 bg-white" : "w-1.5 bg-white/45"}`} />
                  ))}
                </div>
              </div>
            </div>
          )}

          <div>
            {services.map((s, i) => {
              const Art = arts[s.id];
              return (
                <article
                  key={s.id}
                  id={`svc-${s.id}`}
                  aria-label={`${s.n} ${s.title}`}
                  // svc-row: утсан дээр 3D зураг scroll-ын явцаа энэ мөрөөс уншина; desktop дээр — дэлгэцийн голд ирэхэд идэвхжинэ
                  className="svc-row py-12 sm:py-16 lg:flex lg:min-h-[100svh] lg:flex-col lg:justify-center lg:py-0"
                >
                  {/* утас: зураг тайлбарын дээр */}
                  {desktop === false && (
                    <div className={`relative mb-8 aspect-[16/11] ${FRAME}`}>
                      <Art className="block h-full w-full" />
                      <FrameLabels i={i} tag={s.tag} />
                    </div>
                  )}

                  <div className="svc-copy">
                    <p className="svc-reveal font-display text-xs tracking-[0.3em] text-water">
                      {s.n} · {s.tag}
                    </p>
                    <h3 className="svc-reveal mt-3 text-h2 leading-[1.05]">{s.title}</h3>
                    <p className="svc-reveal mt-5 text-base leading-relaxed text-abyss/75 lg:text-[1.0625rem]">{s.text}</p>
                    <ul className="mt-7 space-y-3">
                      {s.points.map((p) => (
                        <li key={p} className="svc-reveal flex items-center gap-3 text-sm font-medium text-abyss/85">
                          <span className="text-water">
                            <Drop />
                          </span>
                          {p}
                        </li>
                      ))}
                    </ul>
                    <dl className="svc-reveal mt-9 grid grid-cols-3 gap-4 border-t border-abyss/10 pt-6 sm:gap-6">
                      {s.stats.map((st) => (
                        // dt нь dd-ээс өмнө байх ёстой; тоог дээр нь харуулахын тулд flex-col-reverse
                        <div key={st.k} className="flex flex-col-reverse">
                          <dt className="mt-2 text-[10px] uppercase tracking-[0.15em] text-mist sm:text-xs">{st.k}</dt>
                          {/* нэгж нь багтахгүй бол доош ороно ("м³/хоног" г.м.) */}
                          <dd className="flex flex-wrap items-baseline gap-x-1 font-display text-[1.35rem] font-bold leading-none text-abyss sm:text-3xl">
                            <span className="svc-stat" data-value={st.v}>
                              {st.v}
                            </span>
                            {st.unit && <span className="text-xs font-medium text-mist sm:text-sm">{st.unit}</span>}
                          </dd>
                        </div>
                      ))}
                    </dl>
                    <a
                      href="#contact"
                      className="svc-reveal mt-8 inline-flex items-center gap-2 text-sm font-semibold text-water transition-[gap] hover:gap-3"
                    >
                      Дэлгэрэнгүй <span aria-hidden>→</span>
                    </a>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </div>

      {/* төгсгөлийн зай: доод өнгө (#d9ecf8) нь Усны чанарын шумбах градиентийн эхлэлтэй ижил тул заагшгүй үргэлжилнэ */}
      <div aria-hidden className="h-20 sm:h-32 lg:h-40" />
    </section>
  );
}
