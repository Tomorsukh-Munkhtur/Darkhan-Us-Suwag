"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { nav } from "@/lib/content";
import { LogoMark } from "./ui/Logo";

const items = [{ label: "Нүүр", href: "#top" }, ...nav];
// Лого голд: зүүн талд 4, баруун талд үлдсэн нь
const left = items.slice(0, 4);
const right = items.slice(4);

function NavLink({ label, href }: { label: string; href: string }) {
  return (
    <a href={href} className="group relative whitespace-nowrap text-sm text-abyss/80 transition hover:text-abyss">
      {label}
      <span className="absolute -bottom-1 left-0 h-px w-0 bg-water transition-all duration-300 group-hover:w-full" />
    </a>
  );
}

// TODO: i18n — одоогоор зөвхөн UI, англи контент хараахан байхгүй.
function LangSwitch({ lang, onChange }: { lang: "en" | "mn"; onChange: (l: "en" | "mn") => void }) {
  return (
    <div role="group" aria-label="Хэл сонгох" className="flex items-center rounded-full border border-abyss/10 bg-white/60 p-0.5 text-xs">
      {(["en", "mn"] as const).map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => onChange(l)}
          aria-pressed={lang === l}
          className={`rounded-full px-3 py-1.5 font-medium transition ${
            lang === l ? "bg-water text-white" : "text-abyss/60 hover:text-abyss"
          }`}
        >
          {l === "en" ? "Eng" : "Mgl"}
        </button>
      ))}
    </div>
  );
}

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [lang, setLang] = useState<"en" | "mn">("mn");

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 px-4 transition-[padding] duration-500 sm:px-8 ${
        scrolled ? "pt-3" : "pt-5 lg:pt-7"
      }`}
    >
      <div
        className={`relative mx-auto grid h-13 max-w-7xl grid-cols-[1fr_auto_1fr] grid-rows-[100%] items-center gap-4 rounded-2xl border px-3 backdrop-blur-xl transition-all duration-500 sm:px-6 lg:h-15 ${
          scrolled
            ? "border-abyss/10 bg-white/90 shadow-[0_12px_40px_-20px_rgba(4,33,58,.35)]"
            : "border-abyss/5 bg-white/60 shadow-[0_12px_40px_-24px_rgba(4,33,58,.25)]"
        }`}
      >
        {/* Зүүн тал */}
        <nav className="hidden items-center gap-6 lg:flex xl:gap-9">
          {left.map((n) => (
            <NavLink key={n.href} {...n} />
          ))}
        </nav>
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex h-10 w-10 flex-col items-center justify-center gap-1.5 lg:hidden"
          aria-label="Цэс"
          aria-expanded={open}
        >
          <span className={`h-px w-6 bg-abyss transition ${open ? "translate-y-[3.5px] rotate-45" : ""}`} />
          <span className={`h-px w-6 bg-abyss transition ${open ? "-translate-y-[3.5px] -rotate-45" : ""}`} />
        </button>

        {/* Голын дугуй лого — самбараас дээш, доош цухуйна */}
        <a
          href="#top"
          aria-label="Нүүр хуудас"
          className={`grid place-items-center rounded-full border border-abyss/10 bg-white shadow-[0_14px_40px_-16px_rgba(4,33,58,.4)] transition-all duration-500 ${
            scrolled ? "h-16 w-16 p-1 lg:h-19 lg:w-19" : "h-20 w-20 p-1.5 lg:h-27 lg:w-27"
          }`}
        >
          <LogoMark size={108} preload className="h-full w-full" />
        </a>

        {/* Баруун тал */}
        <div className="flex items-center justify-end gap-6 xl:gap-9">
          <nav className="hidden items-center gap-6 lg:flex xl:gap-9">
            {right.map((n) => (
              <NavLink key={n.href} {...n} />
            ))}
          </nav>
          <LangSwitch lang={lang} onChange={setLang} />
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
            className="fixed inset-0 -z-10 bg-foam/70 backdrop-blur-sm lg:hidden"
          />
        )}
        {open && (
          <motion.nav
            key="menu"
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="mx-auto mt-5 max-w-7xl rounded-2xl border border-abyss/10 bg-white/95 px-5 pb-4 pt-6 shadow-xl shadow-abyss/10 backdrop-blur-xl lg:hidden"
          >
            {items.map((n, i) => (
              <motion.a
                key={n.href}
                href={n.href}
                onClick={() => setOpen(false)}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="block border-b border-abyss/5 py-4 font-display text-lg last:border-b-0"
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
