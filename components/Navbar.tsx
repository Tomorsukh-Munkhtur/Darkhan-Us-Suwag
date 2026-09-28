"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { nav } from "@/lib/content";
import Logo from "./ui/Logo";

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-500 ${
        scrolled ? "bg-abyss/70 backdrop-blur-xl border-b border-white/5" : ""
      }`}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-8 md:h-20">
        <a href="#top" aria-label="Нүүр хуудас">
          <Logo />
        </a>

        <nav className="hidden items-center gap-8 lg:flex">
          {nav.map((n) => (
            <a
              key={n.href}
              href={n.href}
              className="group relative text-sm text-foam/80 transition hover:text-foam"
            >
              {n.label}
              <span className="absolute -bottom-1 left-0 h-px w-0 bg-water transition-all duration-300 group-hover:w-full" />
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <a
            href="#customer"
            className="hidden rounded-full border border-water/40 px-5 py-2 text-sm text-water transition hover:bg-water hover:text-abyss sm:inline-block"
          >
            Хэрэглэгчийн хэсэг
          </a>
          <button
            onClick={() => setOpen((v) => !v)}
            className="flex h-10 w-10 flex-col items-center justify-center gap-1.5 lg:hidden"
            aria-label="Цэс"
            aria-expanded={open}
          >
            <span className={`h-px w-6 bg-foam transition ${open ? "translate-y-[3.5px] rotate-45" : ""}`} />
            <span className={`h-px w-6 bg-foam transition ${open ? "-translate-y-[3.5px] -rotate-45" : ""}`} />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <motion.nav
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="border-t border-white/5 bg-abyss/95 px-4 pb-8 pt-4 backdrop-blur-xl lg:hidden"
          >
            {[...nav, { label: "Хэрэглэгчийн хэсэг", href: "#customer" }].map((n, i) => (
              <motion.a
                key={n.label}
                href={n.href}
                onClick={() => setOpen(false)}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="block border-b border-white/5 py-4 font-display text-lg"
              >
                {n.label}
              </motion.a>
            ))}
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}
