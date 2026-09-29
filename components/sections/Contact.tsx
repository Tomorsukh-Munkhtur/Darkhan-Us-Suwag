"use client";

import { motion } from "framer-motion";
import { contact, nav } from "@/lib/content";
import Logo from "../ui/Logo";

export default function Contact() {
  const items = [
    { k: "Утас", v: contact.phone, href: `tel:${contact.phone}` },
    { k: "И-мэйл", v: contact.email, href: `mailto:${contact.email}` },
    { k: "Хаяг", v: contact.address },
    { k: "Ажлын цаг", v: contact.hours },
  ];

  return (
    <footer id="contact" className="relative overflow-hidden pt-24 sm:pt-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-8">
        <p className="eyebrow mb-6">
          <span className="text-mist">08</span> — Холбоо барих
        </p>
        <motion.h2
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.9 }}
          className="font-display text-4xl font-semibold leading-[1.05] sm:text-6xl lg:text-7xl"
        >
          УСНЫ АСУУДАЛ
          <br />
          БАЙНА УУ?
          <br />
          <span className="text-water text-glow">БИД ТУСАЛЪЯ.</span>
        </motion.h2>

        <div className="mt-16 grid gap-10 lg:grid-cols-[1.4fr_1fr]">
          <dl className="grid gap-px overflow-hidden rounded-3xl border border-abyss/10 bg-abyss/10 sm:grid-cols-2">
            {items.map((i) => (
              <div key={i.k} className="bg-white p-7">
                <dt className="text-[11px] uppercase tracking-[0.25em] text-mist">{i.k}</dt>
                <dd className="mt-2 font-display text-lg">
                  {i.href ? (
                    <a href={i.href} className="transition hover:text-water">
                      {i.v}
                    </a>
                  ) : (
                    i.v
                  )}
                </dd>
              </div>
            ))}
          </dl>

          <a
            href={`tel:${contact.emergency}`}
            className="group relative flex flex-col justify-between overflow-hidden rounded-3xl bg-alert p-8 text-white"
          >
            <span className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/20 transition-transform duration-700 group-hover:scale-[4]" />
            <span className="relative flex items-center gap-2 text-xs tracking-[0.3em]">
              <span className="h-2 w-2 animate-pulse rounded-full bg-white" /> ЯАРАЛТАЙ ХОЛБОО
            </span>
            <span className="relative mt-10 font-display text-3xl font-bold leading-tight sm:text-4xl">
              24/7 ЯАРАЛТАЙ
              <br />
              ДУУДЛАГА
            </span>
            <span className="relative mt-6 font-display text-xl">{contact.emergency} →</span>
          </a>
        </div>
      </div>

      {/* Footer дээр дахин усны долгион болж төгсөнө — усны цикл дахин эхэлнэ */}
      <div className="relative mt-24">
        <svg viewBox="0 0 1440 120" preserveAspectRatio="none" className="block h-20 w-full sm:h-28" aria-hidden>
          <path fill="#3cc3f0" fillOpacity=".3">
            <animate
              attributeName="d"
              dur="9s"
              repeatCount="indefinite"
              values="M0 60 C240 20 480 100 720 60 S1200 20 1440 60 V120 H0Z;M0 50 C240 90 480 30 720 70 S1200 90 1440 50 V120 H0Z;M0 60 C240 20 480 100 720 60 S1200 20 1440 60 V120 H0Z"
            />
          </path>
          <path fill="#e3f2fb">
            <animate
              attributeName="d"
              dur="7s"
              repeatCount="indefinite"
              values="M0 80 C360 50 720 110 1080 70 S1440 80 1440 80 V120 H0Z;M0 75 C360 105 720 55 1080 90 S1440 70 1440 70 V120 H0Z;M0 80 C360 50 720 110 1080 70 S1440 80 1440 80 V120 H0Z"
            />
          </path>
        </svg>
        <div className="bg-shallow">
          <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-12 sm:px-8 md:flex-row md:items-center md:justify-between">
            <Logo />
            <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-mist">
              {nav.map((n) => (
                <a key={n.href} href={n.href} className="hover:text-abyss">
                  {n.label}
                </a>
              ))}
            </nav>
            <p className="text-xs text-mist">
              УС ЭХЭЛНЭ → ЦЭВЭРШИНЭ → ХОТ РУУ ХҮРНЭ → БУЦНА → ДАХИН ЭХЭЛНЭ
              <br />© {new Date().getFullYear()} Дархан Ус Суваг ОНӨААТҮГ
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
