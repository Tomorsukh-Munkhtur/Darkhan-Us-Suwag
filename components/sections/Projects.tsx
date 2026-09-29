"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { projects, type Project } from "@/lib/content";
import SectionHeading from "../ui/SectionHeading";

function Progress({ value }: { value: number }) {
  return (
    <div>
      <div className="flex justify-between text-[11px] tracking-widest text-mist">
        <span>PROJECT STATUS</span>
        <span className="text-water">{value}%</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-abyss/10">
        <motion.div
          initial={{ width: 0 }}
          whileInView={{ width: `${value}%` }}
          viewport={{ once: true }}
          transition={{ duration: 1.4, ease: [0.22, 1, 0.36, 1] }}
          className="h-full rounded-full bg-gradient-to-r from-water to-aqua"
        />
      </div>
      <p className="mt-2 text-xs text-abyss/70">{value >= 100 ? "Дууссан" : "Хэрэгжиж байна"}</p>
    </div>
  );
}

export default function Projects() {
  const [open, setOpen] = useState<Project | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <section id="projects" className="relative py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-8">
        <SectionHeading
          index="06"
          eyebrow="Төсөл / Бүтээн байгуулалт"
          title={
            <>
              ИРЭЭДҮЙГ БИД
              <br />
              <span className="text-water">ӨНӨӨДӨР БҮТЭЭНЭ</span>
            </>
          }
        />

        <div className="mt-16 grid gap-5 md:grid-cols-3">
          {projects.map((p, i) => (
            <motion.button
              key={p.id}
              onClick={() => setOpen(p)}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, duration: 0.8 }}
              whileHover={{ y: -6 }}
              className="glass group flex min-h-[340px] flex-col rounded-3xl p-8 text-left"
            >
              <div className="flex items-center justify-between">
                <span className="font-display text-xs tracking-[0.3em] text-mist">PROJECT {p.n}</span>
                <span className="font-display text-sm text-water">{p.year}</span>
              </div>
              <h3 className="mt-8 text-h4 font-bold">{p.title}</h3>
              <p className="mt-3 text-sm text-mist">{p.location}</p>
              <div className="mt-auto pt-10">
                <Progress value={p.progress} />
              </div>
              <span className="mt-6 text-sm text-water opacity-0 transition group-hover:opacity-100">Дэлгэрэнгүй →</span>
            </motion.button>
          ))}
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-[60] flex items-end justify-center bg-abyss/35 p-4 backdrop-blur-md sm:items-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(null)}
            data-lenis-prevent
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label={open.title}
              initial={{ y: 60, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 60, opacity: 0, transition: { duration: 0.2 } }}
              transition={{ type: "spring", damping: 26 }}
              onClick={(e) => e.stopPropagation()}
              className="relative max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-abyss/10 bg-white p-8 shadow-2xl shadow-abyss/20 sm:p-10"
            >
              <button onClick={() => setOpen(null)} className="absolute right-6 top-5 text-2xl text-mist hover:text-abyss" aria-label="Хаах">
                ×
              </button>
              <p className="eyebrow">PROJECT {open.n}</p>
              <h3 className="mt-3 text-h3">{open.title}</h3>
              {/* TODO: төслийн зураг */}
              <div className="mt-6 flex aspect-[16/7] items-center justify-center rounded-2xl bg-gradient-to-br from-shallow to-aqua/30 text-xs tracking-widest text-mist">
                ЗУРАГ
              </div>
              <dl className="mt-8 grid grid-cols-2 gap-6 text-sm">
                {[
                  ["Байршил", open.location],
                  ["Хугацаа", open.period],
                  ["Хөрөнгө оруулалт", open.investment],
                  ["Үр дүн", open.result],
                ].map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-[11px] uppercase tracking-widest text-mist">{k}</dt>
                    <dd className="mt-1">{v}</dd>
                  </div>
                ))}
                <div className="col-span-2">
                  <dt className="text-[11px] uppercase tracking-widest text-mist">Зорилго</dt>
                  <dd className="mt-1">{open.goal}</dd>
                </div>
              </dl>
              <div className="mt-8">
                <Progress value={open.progress} />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
