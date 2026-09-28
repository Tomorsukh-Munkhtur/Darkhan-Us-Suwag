"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { outages } from "@/lib/content";

/** Ус тасарсан мэдээлэл — Hero дээр бүтэн, доош scroll хийхэд жижиг товч болно. */
export default function OutageBanner() {
  const [expanded, setExpanded] = useState(true);
  const [pinned, setPinned] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      if (!pinned) setExpanded(window.scrollY < window.innerHeight * 0.6);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [pinned]);

  if (!outages.length) return null;
  const o = outages[0];

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 2.2, duration: 0.6 }}
      className="fixed bottom-4 right-4 z-40"
    >
      <AnimatePresence mode="wait" initial={false}>
        {expanded ? (
          <motion.aside
            key="full"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.25 }}
            className="relative w-[calc(100vw-2rem)] max-w-sm origin-bottom-right rounded-2xl border border-alert/40 bg-abyss/90 p-5 shadow-2xl backdrop-blur-xl"
            role="status"
          >
            <button
              onClick={() => {
                setPinned(true);
                setExpanded(false);
              }}
              className="absolute right-4 top-3 text-lg text-mist hover:text-foam"
              aria-label="Хураах"
            >
              ×
            </button>
            <p className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.25em] text-alert">
              <span className="h-2 w-2 animate-pulse rounded-full bg-alert" /> ОДОО
            </p>
            <p className="mt-2 font-display text-lg">{o.area}</p>
            <p className="text-sm text-foam/85">{o.title}</p>
            <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-mist">
              <span>Шалтгаан: {o.reason}</span>
              <span>Хугацаа: {o.time}</span>
            </div>
            <a href="#map" className="mt-3 inline-block text-xs text-water">
              Газрын зураг дээр харах →
            </a>
          </motion.aside>
        ) : (
          <motion.button
            key="pill"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.2 }}
            onClick={() => {
              setPinned(true);
              setExpanded(true);
            }}
            className="flex items-center gap-2 rounded-full border border-alert/40 bg-abyss/90 px-4 py-2.5 text-xs backdrop-blur-xl"
            aria-label="Ус тасалдлын мэдээлэл"
          >
            <span className="h-2 w-2 animate-pulse rounded-full bg-alert" />
            <span className="text-alert">ЗАСВАР</span>
            <span className="text-foam/80">· {o.area}</span>
          </motion.button>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
