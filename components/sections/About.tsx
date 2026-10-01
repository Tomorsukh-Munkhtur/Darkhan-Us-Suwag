"use client";

import { useEffect, useRef } from "react";
import { about } from "@/lib/content";
import WaterEdge from "./services/WaterEdge";

/**
 * Бидний тухай — дроны бичлэг бүтэн дэлгэцээр (дуугүй, давтагдана). Аяллын дусал уснаас гарах агшинд
 * (DropReveal) хамгийн түрүүнд энэ хэсэг нээгдэж, хот, гол, байгууламжийг дээрээс харуулна.
 * Бичлэг ойртох үед ачаалж, дэлгэцээс гарахад зогсоно; reduced motion үед зөвхөн эхний кадр (poster).
 * Доод ирмэг нь ус шиг гадаргуугаар дараагийн (Бидний үйл ажиллагаа) хэсэгт шилжинэ.
 */
export default function About() {
  const root = useRef<HTMLElement>(null);
  const video = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const v = video.current!;
    // iOS автоматаар тоглуулахад muted шаардлагатай (React attribute-аар найдвартай гаргадаггүй)
    v.muted = true;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // нэг дэлгэцийн өмнөөс тоглуулж эхэлнэ — дусал нээгдэхэд аль хэдийн хөдөлж байна
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) v.play().catch(() => {});
        else v.pause();
      },
      { rootMargin: "100% 0px" },
    );
    io.observe(root.current!);
    return () => io.disconnect();
  }, []);

  return (
    <section id="about" ref={root} className="relative h-[100svh] min-h-[560px] overflow-hidden bg-[#0b3350] text-white">
      <video
        ref={video}
        src={about.video}
        poster={about.poster}
        muted
        loop
        playsInline
        preload="metadata"
        aria-hidden
        tabIndex={-1}
        className="absolute inset-0 h-full w-full object-cover"
      />
      {/* бичиг уншигдахуйц: доороос бараан; desktop дээр бичиг зүүн талд тул зүүнээс бас */}
      <div
        aria-hidden
        className="absolute inset-0 bg-[linear-gradient(to_top,rgba(3,22,40,.9)_0%,rgba(3,22,40,.45)_42%,rgba(3,22,40,.08)_68%,rgba(3,22,40,.35)_100%)]"
      />
      <div aria-hidden className="absolute inset-0 hidden bg-[linear-gradient(90deg,rgba(3,22,40,.5),transparent_55%)] lg:block" />

      {/* утсан дээр нэг багана; desktop дээр зүүн — гарчиг, тайлбар; баруун — тоонууд (доод ирмэгээрээ тэгшилнэ) */}
      <div className="relative mx-auto grid h-full max-w-6xl content-end gap-8 px-5 pb-28 sm:px-8 sm:pb-36 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] lg:items-end lg:gap-20">
        <div>
          <p className="flex items-center gap-3 font-display text-xs uppercase tracking-[0.32em] text-white/75">
            <span aria-hidden className="h-px w-8 bg-aqua" />
            {about.eyebrow}
          </p>
          <h2 className="mt-5 text-display">
            {about.title} <span className="text-aqua">{about.accent}</span>
          </h2>
          <p className="mt-6 max-w-xl text-base leading-relaxed text-white/85 sm:text-lg">{about.text}</p>
        </div>
        <dl className="grid grid-cols-3 gap-4 border-t border-white/20 pt-6 sm:gap-8 lg:grid-cols-1 lg:gap-0 lg:border-l lg:border-t-0 lg:pl-10 lg:pt-0">
          {about.stats.map((s) => (
            // dt нь dd-ээс өмнө байх ёстой; тоог дээр нь харуулахын тулд flex-col-reverse
            <div key={s.k} className="flex flex-col-reverse border-white/15 lg:py-5 lg:first:pt-0 lg:last:pb-0 lg:[&:not(:last-child)]:border-b">
              <dt className="mt-2 text-[10px] uppercase tracking-[0.15em] text-white/70 sm:text-xs">{s.k}</dt>
              <dd className="font-display text-[1.4rem] font-bold leading-none sm:text-4xl lg:text-5xl">{s.v}</dd>
            </div>
          ))}
        </dl>
      </div>

      {/* доод ирмэг: тайван ус шиг гадаргуу → Бидний үйл ажиллагаа.
          Доод 4px-ийг дараагийн хэсгийн өнгөөр бүрхэнэ — 125% г.м. масштабтай дэлгэцэнд бутархай пикселийн
          ирмэгт бараан бичлэг саарал шугам болж харагдахгүй */}
      <div aria-hidden className="absolute inset-x-0 bottom-0 h-1 bg-[#eef6fb]" />
      <div aria-hidden className="absolute inset-x-0 bottom-0 h-0" style={{ "--svc-top": "#eef6fb" } as React.CSSProperties}>
        <WaterEdge variant="calm" />
      </div>
    </section>
  );
}
