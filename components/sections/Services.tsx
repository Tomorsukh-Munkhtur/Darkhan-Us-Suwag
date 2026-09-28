"use client";

import { motion } from "framer-motion";
import { services } from "@/lib/content";
import SectionHeading from "../ui/SectionHeading";

const icons = [
  // Ус хангамж
  <path key="a" d="M24 6s-12 13-12 20a12 12 0 0024 0c0-7-12-20-12-20z" />,
  // Ариутгах татуурга
  <path key="b" d="M6 18h36M6 30h36M14 18v12M34 18v12M6 18a6 6 0 010 12M42 18a6 6 0 000 12" />,
  // Цэвэрлэх байгууламж
  <path key="c" d="M8 36h32M12 36V20l6-6h12l6 6v16M18 26c2 2 4 2 6 0s4-2 6 0" />,
];

export default function Services() {
  return (
    <section id="services" className="relative bg-deep/40 py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-8">
        <SectionHeading
          index="03"
          eyebrow="Бидний үйл ажиллагаа"
          title={
            <>
              Ус эхэлнэ. Ус буцна.
              <br />
              <span className="text-water">Бид цэвэршүүлнэ.</span>
            </>
          }
          lead="Дархан Ус Суваг нь хотын усны бүтэн циклийг — эх үүсвэрээс хэрэглэгч хүртэл, хэрэглэгчээс байгаль руу — хариуцан ажилладаг."
        />

        <div className="mt-16 grid gap-5 md:grid-cols-3">
          {services.map((s, i) => (
            <motion.a
              key={s.n}
              href="#customer"
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ delay: i * 0.12, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
              whileHover="hover"
              className="group glass relative flex min-h-[380px] flex-col overflow-hidden rounded-3xl p-8"
            >
              {/* hover үед доороос ус дүүрнэ */}
              <motion.div
                variants={{ hover: { y: "0%" } }}
                initial={{ y: "101%" }}
                transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                className="absolute inset-0 bg-gradient-to-t from-water/25 via-water/10 to-transparent"
              />
              <div className="relative flex items-start justify-between">
                <span className="font-display text-sm text-mist">{s.n}</span>
                <motion.span
                  variants={{ hover: { opacity: 1, x: 0 } }}
                  initial={{ opacity: 0, x: -10 }}
                  className="font-display text-xs tracking-[0.3em] text-water"
                >
                  ↗ {s.tag}
                </motion.span>
              </div>
              <motion.svg
                variants={{ hover: { scale: 1.1, rotate: -4 } }}
                width="64"
                height="64"
                viewBox="0 0 48 48"
                fill="none"
                stroke="#3fd0ff"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="relative mt-10"
              >
                {icons[i]}
              </motion.svg>
              <h3 className="relative mt-auto font-display text-2xl font-semibold">{s.title}</h3>
              <p className="relative mt-4 text-sm leading-relaxed text-mist">{s.text}</p>
              <motion.span
                variants={{ hover: { opacity: 1, y: 0 } }}
                initial={{ opacity: 0, y: 8 }}
                className="relative mt-6 text-sm text-water"
              >
                Дэлгэрэнгүй →
              </motion.span>
            </motion.a>
          ))}
        </div>
      </div>
    </section>
  );
}
