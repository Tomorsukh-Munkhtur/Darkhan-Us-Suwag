"use client";

import { motion } from "framer-motion";

export default function SectionHeading({
  index,
  eyebrow,
  title,
  lead,
  align = "left",
}: {
  index: string;
  eyebrow: string;
  title: React.ReactNode;
  lead?: string;
  align?: "left" | "center";
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
      className={align === "center" ? "mx-auto max-w-3xl text-center" : "max-w-3xl"}
    >
      <p className="eyebrow mb-5">
        <span className="text-mist">{index}</span> — {eyebrow}
      </p>
      <h2 className="font-display text-3xl font-semibold leading-[1.1] sm:text-5xl md:text-6xl">{title}</h2>
      {lead && <p className="mt-6 text-base text-mist sm:text-lg">{lead}</p>}
    </motion.div>
  );
}
