"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { customerServices, requestTypes } from "@/lib/content";
import SectionHeading from "../ui/SectionHeading";

export default function CustomerServices() {
  const [type, setType] = useState(requestTypes[0]);
  const [sent, setSent] = useState(false);

  return (
    <section id="customer" className="relative py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-8">
        <SectionHeading
          index="✦"
          eyebrow="Хэрэглэгчийн үйлчилгээ"
          title={
            <>
              Онлайн <span className="text-water">үйлчилгээ</span>
            </>
          }
          lead="Төлбөрөө шалгах, тоолуурын заалт өгөх, хүсэлт гомдлоо гэрээсээ илгээх боломжтой."
        />

        <div className="mt-14 grid grid-cols-2 gap-3 md:grid-cols-5">
          {customerServices.map((s, i) => (
            <motion.a
              key={s.title}
              href="#request"
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.06 }}
              className="group rounded-2xl border border-white/10 p-5 transition hover:border-water/50 hover:bg-water/5"
            >
              <span className="font-display text-xs text-mist">0{i + 1}</span>
              <h3 className="mt-6 font-display text-base group-hover:text-water">{s.title}</h3>
              <p className="mt-2 text-xs leading-relaxed text-mist">{s.text}</p>
            </motion.a>
          ))}
        </div>

        <div id="request" className="glass mt-10 grid gap-10 rounded-3xl p-6 sm:p-10 lg:grid-cols-[1fr_1.4fr]">
          <div>
            <p className="eyebrow">Онлайн хүсэлт</p>
            <h3 className="mt-3 font-display text-2xl sm:text-3xl">Хүсэлтийн төрлөө сонгоно уу</h3>
            <div className="mt-6 flex flex-col gap-2">
              {requestTypes.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => {
                    setType(r);
                    setSent(false);
                  }}
                  className={`rounded-xl border px-4 py-3 text-left text-sm transition ${
                    type === r ? "border-water bg-water/10 text-water" : "border-white/10 hover:border-white/30"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          <AnimatePresence mode="wait">
            {sent ? (
              <motion.div
                key="ok"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center rounded-2xl border border-leaf/30 bg-leaf/5 p-10 text-center"
              >
                <span className="text-4xl">💧</span>
                <p className="mt-4 font-display text-xl">Хүсэлт хүлээн авлаа</p>
                <p className="mt-2 text-sm text-mist">Ажлын 1–3 өдөрт холбогдох болно.</p>
                <button onClick={() => setSent(false)} className="mt-6 text-sm text-water">
                  Шинэ хүсэлт →
                </button>
              </motion.div>
            ) : (
              <motion.form
                key="form"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onSubmit={(e) => {
                  e.preventDefault();
                  // TODO: backend API холбох
                  setSent(true);
                }}
                className="grid gap-4 sm:grid-cols-2"
              >
                <p className="text-sm text-mist sm:col-span-2">
                  Сонгосон: <span className="text-foam">{type}</span>
                </p>
                {[
                  { n: "name", l: "Овог нэр", t: "text" },
                  { n: "phone", l: "Утас", t: "tel" },
                  { n: "code", l: "Хэрэглэгчийн код", t: "text", optional: true },
                  { n: "address", l: "Хаяг (баг, байр, тоот)", t: "text" },
                ].map((f) => (
                  <label key={f.n} className="block">
                    <span className="text-xs text-mist">
                      {f.l} {f.optional && <span className="opacity-60">(заавал биш)</span>}
                    </span>
                    <input
                      name={f.n}
                      type={f.t}
                      required={!f.optional}
                      className="mt-1.5 w-full rounded-xl border border-white/10 bg-abyss/60 px-4 py-3 text-sm outline-none transition focus:border-water"
                    />
                  </label>
                ))}
                <label className="block sm:col-span-2">
                  <span className="text-xs text-mist">Дэлгэрэнгүй</span>
                  <textarea
                    name="message"
                    rows={4}
                    required
                    className="mt-1.5 w-full resize-none rounded-xl border border-white/10 bg-abyss/60 px-4 py-3 text-sm outline-none transition focus:border-water"
                  />
                </label>
                <button
                  type="submit"
                  className="rounded-full bg-water px-7 py-3.5 font-display text-sm font-semibold text-abyss transition hover:bg-aqua sm:col-span-2 sm:justify-self-start"
                >
                  Илгээх
                </button>
              </motion.form>
            )}
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
