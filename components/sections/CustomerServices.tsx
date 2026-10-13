"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { customerServices, requestTypes } from "@/lib/content";
import SectionHeading from "../ui/SectionHeading";
import WaterEdge from "./services/WaterEdge";

/**
 * Хэрэглэгчийн үйлчилгээ: дээд ирмэг нь урсаж буй усны гадаргуу (WaterEdge, Бидний тухайн доод ирмэг шиг).
 * Хотын мапаас доош гүйлгэхэд усныхаа хамт мапын дээгүүр доороос бүрхэж гарна (мап нь удаан гүйнэ — CityMap.tsx).
 * Бичвэрүүд үргэлж тод.
 */
export default function CustomerServices() {
  const [type, setType] = useState(requestTypes[0]);
  const [sent, setSent] = useState(false);

  return (
    <section id="customer" className="relative z-30 bg-foam py-20 sm:py-24">
      {/* дээд ирмэг: урсаж буй ус — мапын дээгүүр гарна (өнгө нь хэсгийн дэвсгэр, заагшгүй) */}
      <div aria-hidden className="absolute inset-x-0 top-0 h-0" style={{ "--svc-top": "#f5fbff" } as React.CSSProperties}>
        <WaterEdge variant="calm" />
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-8">
        <SectionHeading
          still
          eyebrow="Хэрэглэгчийн үйлчилгээ"
          title={
            <>
              Онлайн <span className="text-water">үйлчилгээ</span>
            </>
          }
          lead="Төлбөрөө шалгах, тоолуурын заалт өгөх, хүсэлт гомдлоо гэрээсээ илгээх боломжтой."
        />

        {/* утас/таблет дээр авсаархан мөр (дугаар зүүн талд), desktop дээр 5 багана */}
        <div className="mt-10 grid gap-2 sm:mt-12 sm:grid-cols-2 sm:gap-3 lg:grid-cols-5">
          {customerServices.map((s, i) => (
            <a
              key={s.title}
              href="#request"
              className="group flex items-baseline gap-3 rounded-2xl border border-abyss/10 bg-white/70 px-4 py-3.5 transition hover:border-water/50 hover:bg-white sm:last:col-span-2 lg:block lg:p-4 lg:last:col-span-1"
            >
              <span className="block shrink-0 font-display text-xs text-mist">
                0{i + 1}
              </span>
              <div className="min-w-0 lg:mt-2.5">
                <h3 className="text-[15px] font-medium leading-snug group-hover:text-water">
                  {s.title}
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-mist">
                  {s.text}
                </p>
              </div>
            </a>
          ))}
        </div>

        <div id="request" className="glass mt-6 grid gap-6 rounded-3xl p-5 sm:mt-8 sm:p-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)] lg:gap-12">
          <div>
            <p className="eyebrow">
              Онлайн хүсэлт
            </p>
            <h3 className="mt-2 text-xl font-bold leading-tight sm:text-2xl">
              Хүсэлтийн төрлөө сонгоно уу
            </h3>
            <div className="mt-4 flex flex-col gap-1.5 sm:mt-5">
              {requestTypes.map((r) => (
                <button
                  key={r}
                 
                  type="button"
                  onClick={() => {
                    setType(r);
                    setSent(false);
                  }}
                  className={`rounded-xl border px-4 py-2.5 text-left text-sm transition-colors ${
                    type === r ? "border-water bg-water/10 text-water" : "border-abyss/10 bg-white/60 hover:border-abyss/30"
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
                className="flex flex-col items-center justify-center rounded-2xl border border-leaf/30 bg-leaf/5 p-8 text-center"
              >
                <span className="text-4xl">💧</span>
                <p className="mt-4 text-h4">Хүсэлт хүлээн авлаа</p>
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
                className="grid grid-cols-2 content-start gap-3 sm:gap-x-4"
              >
                <p className="col-span-2 text-[13px] text-mist">
                  Сонгосон: <span className="text-abyss">{type}</span>
                </p>
                {[
                  // утсан дээр нэр, утас зэрэгцэнэ; бусад нь бүтэн мөр
                  { n: "name", l: "Овог нэр", t: "text" },
                  { n: "phone", l: "Утас", t: "tel" },
                  { n: "code", l: "Хэрэглэгчийн код", t: "text", optional: true, wide: true },
                  { n: "address", l: "Хаяг (баг, байр, тоот)", t: "text", wide: true },
                ].map((f) => (
                  <label key={f.n} className={`block min-w-0 ${f.wide ? "col-span-2 sm:col-span-1" : ""}`}>
                    <span className="text-xs text-mist">
                      {f.l} {f.optional && <span className="opacity-60">(заавал биш)</span>}
                    </span>
                    <input
                      name={f.n}
                      type={f.t}
                      required={!f.optional}
                      className="mt-1 w-full rounded-xl border border-abyss/15 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-water"
                    />
                  </label>
                ))}
                <label className="col-span-2 block">
                  <span className="text-xs text-mist">Дэлгэрэнгүй</span>
                  <textarea
                    name="message"
                    rows={3}
                    required
                    className="mt-1 w-full resize-none rounded-xl border border-abyss/15 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-water"
                  />
                </label>
                <button
                 
                  type="submit"
                  className="rounded-full bg-water px-6 py-3 font-display text-sm font-semibold text-white transition-colors hover:bg-deep col-span-2 sm:justify-self-start"
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
