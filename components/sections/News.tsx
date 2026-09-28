"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { news, type NewsKind } from "@/lib/content";
import SectionHeading from "../ui/SectionHeading";

const filters: ("БҮГД" | NewsKind)[] = ["БҮГД", "МЭДЭЭ", "ЗАРЛАЛ", "ЗӨВЛӨМЖ", "ЗАСВАР"];

const kindColor: Record<NewsKind, string> = {
  МЭДЭЭ: "text-water border-water/40",
  ЗАРЛАЛ: "text-aqua border-aqua/40",
  ЗӨВЛӨМЖ: "text-leaf border-leaf/40",
  ЗАСВАР: "text-alert border-alert/40",
};

export default function News() {
  const [f, setF] = useState<(typeof filters)[number]>("БҮГД");
  const list = f === "БҮГД" ? news : news.filter((n) => n.kind === f);

  return (
    <section id="news" className="relative bg-deep/40 py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-8">
        <SectionHeading index="07" eyebrow="Мэдээ / Мэдээлэл" title={<>МЭДЭЭ, <span className="text-water">МЭДЭЭЛЭЛ</span></>} />

        <div className="mt-12 flex flex-wrap gap-2" role="tablist">
          {filters.map((k) => (
            <button
              key={k}
              role="tab"
              aria-selected={f === k}
              onClick={() => setF(k)}
              className={`relative rounded-full px-5 py-2 text-xs tracking-[0.2em] transition ${
                f === k ? "text-abyss" : "text-foam/70 hover:text-foam"
              }`}
            >
              {f === k && (
                <motion.span layoutId="news-pill" className="absolute inset-0 rounded-full bg-water" transition={{ type: "spring", damping: 28, stiffness: 300 }} />
              )}
              <span className="relative">{k}</span>
            </button>
          ))}
        </div>

        <motion.ul layout className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence mode="popLayout">
            {list.map((n) => (
              <motion.li
                layout
                key={n.id}
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.3 }}
              >
                <a
                  href="#news"
                  className={`group flex h-full min-h-[200px] flex-col rounded-3xl border p-7 transition hover:bg-white/[0.03] ${
                    n.urgent ? "border-alert/40 bg-alert/5" : "border-white/10"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`rounded-full border px-3 py-1 text-[10px] tracking-[0.2em] ${kindColor[n.kind]}`}>
                      {n.urgent && "🔴 "}
                      {n.kind}
                    </span>
                    <time className="text-xs text-mist">{n.date}</time>
                  </div>
                  <h3 className="mt-6 font-display text-lg leading-snug">{n.title}</h3>
                  <span className="mt-auto pt-6 text-sm text-water opacity-60 transition group-hover:translate-x-1 group-hover:opacity-100">
                    Унших →
                  </span>
                </a>
              </motion.li>
            ))}
          </AnimatePresence>
        </motion.ul>
      </div>
    </section>
  );
}
