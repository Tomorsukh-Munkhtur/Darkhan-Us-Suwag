"use client";

import { motion } from "framer-motion";

export default function SectionHeading({
  eyebrow,
  title,
  lead,
  align = "left",
  still = false,
}: {
  eyebrow: string;
  title: React.ReactNode;
  lead?: string;
  align?: "left" | "center";
  /** true — гарч ирэх (fade) хөдөлгөөнгүй, үргэлж тод (жишээ нь Values — мапын дээгүүр гарах хэсэг) */
  still?: boolean;
}) {
  const box = align === "center" ? "mx-auto max-w-3xl text-center" : "max-w-3xl";
  if (still)
    return (
      <div className={box}>
        <p className="eyebrow mb-5">{eyebrow}</p>
        <h2 className="text-h2">{title}</h2>
        {lead && <p className="mt-6 text-base text-mist sm:text-lg">{lead}</p>}
      </div>
    );
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
      className={box}
    >
      <p className="eyebrow mb-5">{eyebrow}</p>
      <h2 className="text-h2">{title}</h2>
      {lead && <p className="mt-6 text-base text-mist sm:text-lg">{lead}</p>}
    </motion.div>
  );
}
