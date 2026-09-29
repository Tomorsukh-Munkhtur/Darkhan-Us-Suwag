"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { news, type NewsKind } from "@/lib/content";
import SectionHeading from "../ui/SectionHeading";
import NewsCover from "./news/NewsCover";

const filters: ("БҮГД" | NewsKind)[] = ["БҮГД", "МЭДЭЭ", "ЗАРЛАЛ", "ЗӨВЛӨМЖ", "ЗАСВАР"];

const kindColor: Record<NewsKind, string> = {
  МЭДЭЭ: "text-water border-water/40",
  ЗАРЛАЛ: "text-deep border-deep/40",
  ЗӨВЛӨМЖ: "text-leaf border-leaf/40",
  ЗАСВАР: "text-alert border-alert/40",
};

type Item = (typeof news)[number];

const grid = { show: { transition: { staggerChildren: 0.08 } } };
const card = {
  hidden: { opacity: 0, y: 30 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as const } },
};

function NewsCard({ n, big = false, className = "" }: { n: Item; big?: boolean; className?: string }) {
  return (
    <motion.a
      variants={card}
      href="#news"
      className={`group relative block overflow-hidden rounded-3xl border bg-white shadow-[0_20px_50px_-30px_rgba(4,33,58,.35)] ${
        n.urgent ? "border-alert/40" : "border-abyss/10"
      } ${className}`}
    >
      <NewsCover kind={n.kind} className="absolute inset-0 h-full w-full transition-transform duration-700 ease-out group-hover:scale-105" />
      {n.urgent && (
        <span className="absolute right-4 top-4 flex h-3 w-3">
          <span className="absolute inset-0 animate-ping rounded-full bg-white/80" />
          <span className="relative h-3 w-3 rounded-full bg-white" />
        </span>
      )}
      <div
        className={`absolute rounded-2xl bg-white/92 backdrop-blur transition-transform duration-500 ease-out group-hover:-translate-y-1 ${
          big ? "inset-x-4 bottom-4 p-5 sm:inset-x-5 sm:bottom-5 sm:p-7" : "inset-x-3 bottom-3 p-4"
        }`}
      >
        <div className="flex items-center justify-between gap-3">
          <span className={`rounded-full border px-3 py-1 text-[10px] font-bold tracking-[0.2em] ${kindColor[n.kind]}`}>{n.kind}</span>
          <time className="text-xs text-mist">{n.date}</time>
        </div>
        <h3 className={`font-bold leading-snug ${big ? "mt-4 text-xl sm:text-2xl" : "mt-3 line-clamp-2 text-[15px]"}`}>{n.title}</h3>
        {big && (
          <>
            <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-abyss/75">{n.excerpt}</p>
            <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-water transition-[gap] group-hover:gap-2.5">
              Унших <span aria-hidden>→</span>
            </span>
          </>
        )}
      </div>
    </motion.a>
  );
}

export default function News() {
  const [f, setF] = useState<(typeof filters)[number]>("БҮГД");
  const list = (f === "БҮГД" ? news : news.filter((n) => n.kind === f)).slice(0, 5);
  const [featured, ...rest] = list;

  return (
    <section id="news" className="relative bg-shallow py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-8">
        <div className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
          <SectionHeading
            index="07"
            eyebrow="News"
            title={
              <>
                МЭДЭЭ / <span className="text-water">МЭДЭЭЛЭЛ</span>
              </>
            }
          />
          {/* нэг мөрөнд: desktop дээр шахагдахгүй, mobile дээр хажуу тийш гүйлгэнэ */}
          <div
            role="tablist"
            aria-label="Мэдээний төрөл"
            data-lenis-prevent-horizontal
            className="-mx-4 flex shrink-0 items-center gap-x-1 overflow-x-auto px-4 text-xs font-bold tracking-[0.08em] [scrollbar-width:none] sm:tracking-[0.15em] md:mx-0 md:px-0"
          >
            {filters.map((k, i) => (
              <span key={k} className="flex shrink-0 items-center gap-x-1">
                {i > 0 && (
                  <span aria-hidden className="text-abyss/20">
                    |
                  </span>
                )}
                <button
                  role="tab"
                  aria-selected={f === k}
                  onClick={() => setF(k)}
                  className={`relative px-2 py-2 transition-colors ${f === k ? "text-water" : "text-abyss/60 hover:text-abyss"}`}
                >
                  {k}
                  {f === k && (
                    <motion.span
                      layoutId="news-tab"
                      className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-water"
                      transition={{ type: "spring", damping: 30, stiffness: 320 }}
                    />
                  )}
                </button>
              </span>
            ))}
          </div>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={f}
            variants={grid}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-80px" }}
            exit={{ opacity: 0, y: -12, transition: { duration: 0.2 } }}
            className={`mt-10 grid gap-5 lg:gap-6 ${rest.length ? "lg:grid-cols-[1.15fr_1fr]" : ""}`}
          >
            {featured && (
              <NewsCard
                n={featured}
                big
                className={`aspect-[4/5] sm:aspect-[16/10] ${rest.length ? "lg:aspect-[3/2]" : "lg:aspect-[21/9]"}`}
              />
            )}
            {/* lg: том картын өндрийг 2×2 жижиг карт дүүргэнэ; цөөн бол баруун баганыг бүтнээр нь эзэлнэ */}
            {rest.length > 0 && (
              <div className={`grid gap-5 sm:grid-cols-2 lg:grid-rows-2 lg:gap-6 ${rest.length < 3 ? "lg:grid-cols-1" : ""}`}>
                {rest.map((n, i) => (
                  <NewsCard
                    key={n.id}
                    n={n}
                    className={`aspect-[4/3] sm:aspect-[3/2] lg:aspect-auto ${rest.length === 1 ? "lg:row-span-2" : ""} ${
                      rest.length === 3 && i === 2 ? "sm:col-span-2" : ""
                    }`}
                  />
                ))}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}
