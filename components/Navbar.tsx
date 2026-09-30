"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, LayoutGroup, MotionConfig, motion } from "framer-motion";
import { contact, nav } from "@/lib/content";
import { LogoMark } from "./ui/Logo";

const items = [{ label: "Нүүр", href: "#top" }, ...nav];
// Лого голд: хоёр талд тэнцүү
const left = items.slice(0, 3);
const right = items.slice(3);
const pad = (n: number) => String(n).padStart(2, "0");
const spring = { type: "spring", stiffness: 420, damping: 34 } as const;

type Item = (typeof items)[number];

/** Холбоос: идэвхтэй/hover үед ард нь гялгар усан дусал (layoutId) пүршээр гулсаж ирнэ */
function NavLink({ item, lit, current, onHover }: { item: Item; lit: boolean; current: boolean; onHover: (h: string) => void }) {
  return (
    <a
      href={item.href}
      onMouseEnter={() => onHover(item.href)}
      onFocus={() => onHover(item.href)}
      aria-current={current ? "location" : undefined}
      className={`relative isolate whitespace-nowrap rounded-full px-3.5 py-2 text-sm transition-colors duration-300 xl:px-4 ${
        lit ? "text-abyss" : "text-abyss/65 hover:text-abyss"
      }`}
    >
      {lit && <motion.span layoutId="nav-drop" className="nav-drop absolute inset-0 -z-10" style={{ borderRadius: 999 }} transition={spring} />}
      {item.label}
    </a>
  );
}

// TODO: i18n — одоогоор зөвхөн UI, англи контент хараахан байхгүй.
function LangSwitch({ lang, onChange, id }: { lang: "en" | "mn"; onChange: (l: "en" | "mn") => void; id: string }) {
  return (
    <div role="group" aria-label="Хэл сонгох" className="flex items-center rounded-full border border-abyss/10 bg-abyss/5 p-0.5 text-xs">
      {(["en", "mn"] as const).map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => onChange(l)}
          aria-pressed={lang === l}
          className={`relative isolate rounded-full px-3 py-1.5 font-medium transition-colors ${lang === l ? "text-abyss" : "text-abyss/55 hover:text-abyss"}`}
        >
          {lang === l && <motion.span layoutId={id} className="nav-drop absolute inset-0 -z-10" style={{ borderRadius: 999 }} transition={spring} />}
          {l === "en" ? "Eng" : "Mgl"}
        </button>
      ))}
    </div>
  );
}

/** Утасны цэс: товчноос ус үерлэх мэт дугуйлан тэлж нээгдэнэ, дотор нь бөмбөлөг хөөрнө */
function MobileMenu({ active, onClose }: { active: string | null; onClose: () => void }) {
  const bubbles = useMemo(
    () =>
      Array.from({ length: 14 }, () => ({
        left: `${Math.random() * 100}%`,
        size: 4 + Math.random() * 14,
        delay: `${-Math.random() * 9}s`,
        dur: `${7 + Math.random() * 7}s`,
      })),
    [],
  );
  const origin = "at 46px 46px";
  return (
    <motion.div
      id="mobile-menu"
      role="dialog"
      aria-modal="true"
      aria-label="Цэс"
      data-lenis-prevent
      className="menu-depths fixed inset-0 z-[45] flex flex-col overflow-y-auto px-6 pb-8 pt-28 lg:hidden"
      initial={{ clipPath: `circle(0% ${origin})` }}
      animate={{ clipPath: `circle(150% ${origin})` }}
      exit={{ clipPath: `circle(0% ${origin})`, transition: { duration: 0.55, ease: [0.76, 0, 0.24, 1], delay: 0.1 } }}
      transition={{ duration: 0.75, ease: [0.76, 0, 0.24, 1] }}
    >
      {bubbles.map((b, i) => (
        <span
          key={i}
          aria-hidden
          className="menu-bubble"
          style={{ left: b.left, width: b.size, height: b.size, animationDelay: b.delay, animationDuration: b.dur }}
        />
      ))}

      <nav aria-label="Үндсэн цэс" className="relative flex flex-col">
        {items.map((n, i) => (
          <div key={n.href} className="overflow-hidden border-b border-abyss/10">
            <motion.a
              href={n.href}
              onClick={onClose}
              aria-current={active === n.href ? "location" : undefined}
              initial={{ y: "110%" }}
              animate={{ y: 0 }}
              exit={{ y: "110%", transition: { duration: 0.25 } }}
              transition={{ delay: 0.2 + i * 0.06, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              className={`group flex items-baseline gap-4 py-4 font-display text-[clamp(1.6rem,8vw,2.6rem)] font-semibold leading-tight transition-colors ${
                active === n.href ? "text-water" : "text-abyss hover:text-water"
              }`}
            >
              <span className="w-7 font-sans text-xs font-medium tracking-widest text-mist">{pad(i + 1)}</span>
              {n.label}
              <span
                aria-hidden
                className={`ml-auto h-2.5 w-2.5 self-center rounded-full bg-water shadow-[0_0_14px_var(--color-water)] transition-transform duration-500 ${
                  active === n.href ? "scale-100" : "scale-0 group-hover:scale-100"
                }`}
              />
            </motion.a>
          </div>
        ))}
      </nav>

      <motion.div
        className="relative mt-auto space-y-1.5 pt-12"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, transition: { duration: 0.2 } }}
        transition={{ delay: 0.6, duration: 0.6 }}
      >
        <p className="eyebrow">Холбоо барих</p>
        <a href={`tel:${contact.phone}`} className="block font-display text-lg">
          {contact.phone}
        </a>
        <a href={`tel:${contact.emergency}`} className="flex items-center gap-2 text-sm text-alert">
          <span className="h-2 w-2 animate-pulse rounded-full bg-alert" /> 24/7 яаралтай: {contact.emergency}
        </a>
      </motion.div>
    </motion.div>
  );
}

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  // Hero-ийн цайвар гадаргуу дээр байхад л цайвар; шумбаж усан доор ороход бараан (сайтын dark)
  const [surface, setSurface] = useState(true);
  // доош гүйлгэхэд нуугдаж, дээш гүйлгэхэд гарна (Hero-ийн шумбалтын үед үргэлж харагдана)
  const [hidden, setHidden] = useState(false);
  const [active, setActive] = useState<string | null>("#top");
  const [hovered, setHovered] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [lang, setLang] = useState<"en" | "mn">("mn");
  const ring = useRef<SVGCircleElement>(null);
  const burger = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const deep = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0.9 : 0.25;
    const targets = items.map((n) => ({ href: n.href, el: document.querySelector<HTMLElement>(n.href) }));
    let lastY = window.scrollY;
    let raf = 0;
    const update = () => {
      raf = 0;
      const y = window.scrollY;
      const vh = window.innerHeight;
      setScrolled(y > 40);
      setSurface(y < vh * deep);
      if (Math.abs(y - lastY) > 6) {
        setHidden(y > lastY && y > vh * 2.2);
        lastY = y;
      }
      // лого тойрох цагираг: хуудсыг хэр гүйлгэсэн
      const max = document.documentElement.scrollHeight - vh;
      ring.current?.style.setProperty("stroke-dashoffset", String(1 - (max > 0 ? Math.min(y / max, 1) : 0)));
      // scroll-spy: дэлгэцийн 40%-ийн шугам аль хэсэгт байна
      const line = vh * 0.4;
      const hit = targets.find(({ el }) => {
        const r = el?.getBoundingClientRect();
        return r && r.top <= line && r.bottom >= line;
      });
      setActive(hit ? hit.href : null);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  // Цэс нээлттэй үед: хуудас гүйлгэхгүй, Esc-ээр хаагдана, desktop болбол хаагдана
  useEffect(() => {
    if (!open) return;
    const root = document.documentElement;
    root.classList.add("menu-open");
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const mq = window.matchMedia("(min-width: 1024px)");
    const onMq = () => mq.matches && setOpen(false);
    window.addEventListener("keydown", onKey);
    mq.addEventListener("change", onMq);
    const btn = burger.current;
    return () => {
      root.classList.remove("menu-open");
      window.removeEventListener("keydown", onKey);
      mq.removeEventListener("change", onMq);
      btn?.focus();
    };
  }, [open]);

  const lit = hovered ?? active;

  return (
    <MotionConfig reducedMotion="user">
      <motion.header
        animate={{ y: hidden && !open ? "-140%" : "0%" }}
        transition={{ type: "spring", stiffness: 260, damping: 30 }}
        className={`fixed inset-x-0 top-0 z-50 px-4 transition-[padding] duration-500 sm:px-8 ${scrolled ? "pt-3" : "pt-5 lg:pt-7"} ${
          surface && !open ? "theme-light" : ""
        }`}
      >
        <div
          className={`nav-glass relative mx-auto grid h-13 max-w-7xl grid-cols-[1fr_auto_1fr] grid-rows-[100%] items-center gap-4 rounded-full px-2 transition-all duration-500 sm:px-3 lg:h-15 ${
            scrolled ? "nav-glass--solid" : ""
          }`}
        >
          {/* Зүүн тал */}
          <LayoutGroup id="nav">
            <nav aria-label="Үндсэн цэс" className="hidden items-center lg:flex" onMouseLeave={() => setHovered(null)}>
              {left.map((n) => (
                <NavLink key={n.href} item={n} lit={lit === n.href} current={active === n.href} onHover={setHovered} />
              ))}
            </nav>
            <button
              ref={burger}
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="relative flex h-10 w-10 items-center justify-center rounded-full transition-colors hover:bg-abyss/5 lg:hidden"
              aria-label={open ? "Цэс хаах" : "Цэс нээх"}
              aria-expanded={open}
              aria-controls="mobile-menu"
            >
              <span className={`absolute h-[1.5px] w-5 rounded-full bg-abyss transition-transform duration-500 ${open ? "rotate-45" : "-translate-y-[4px]"}`} />
              <span className={`absolute h-[1.5px] rounded-full bg-abyss transition-all duration-500 ${open ? "w-5 -rotate-45" : "w-3.5 translate-x-[3px] translate-y-[4px]"}`} />
            </button>

            {/* Голын лого — самбараас дээш, доош цухуйна; тойрог нь хуудсыг хэр гүйлгэснийг харуулна */}
            <a
              href="#top"
              aria-label="Нүүр хуудас"
              className={`nav-logo group relative grid place-items-center rounded-full transition-all duration-500 ${
                scrolled ? "h-16 w-16 p-1.5 lg:h-19 lg:w-19" : "h-20 w-20 p-2 lg:h-27 lg:w-27"
              }`}
            >
              <svg aria-hidden viewBox="0 0 100 100" className="pointer-events-none absolute -inset-[5px] h-[calc(100%+10px)] w-[calc(100%+10px)] -rotate-90">
                <circle cx="50" cy="50" r="48" fill="none" className="stroke-abyss/10" strokeWidth="1.5" />
                <circle
                  ref={ring}
                  cx="50"
                  cy="50"
                  r="48"
                  fill="none"
                  className="stroke-water"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  pathLength={1}
                  strokeDasharray="1"
                  strokeDashoffset="1"
                  style={{ filter: "drop-shadow(0 0 4px var(--color-water))" }}
                />
              </svg>
              <LogoMark size={108} preload className="relative h-full w-full transition-transform duration-700 group-hover:rotate-[8deg] group-hover:scale-105" />
            </a>

            {/* Баруун тал */}
            <div className="flex items-center justify-end gap-2 xl:gap-4">
              <nav aria-label="Үндсэн цэс (үргэлжлэл)" className="hidden items-center lg:flex" onMouseLeave={() => setHovered(null)}>
                {right.map((n) => (
                  <NavLink key={n.href} item={n} lit={lit === n.href} current={active === n.href} onHover={setHovered} />
                ))}
              </nav>
              <LangSwitch lang={lang} onChange={setLang} id="lang-drop" />
            </div>
          </LayoutGroup>
        </div>
      </motion.header>

      <AnimatePresence>{open && <MobileMenu active={active} onClose={() => setOpen(false)} />}</AnimatePresence>
    </MotionConfig>
  );
}
