"use client";

import { motion } from "framer-motion";
import { contact, nav } from "@/lib/content";
import Logo from "../ui/Logo";
import AppPromo from "./AppPromo";

/** Холбоо барих мэдээллийн жижиг тэмдэг (24×24, stroke) */
const icons = {
  phone: <path d="M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z" />,
  mail: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 7l9 6 9-6" />
    </>
  ),
  pin: (
    <>
      <path d="M12 21s-7-6.2-7-11.5a7 7 0 0114 0C19 14.8 12 21 12 21z" />
      <circle cx="12" cy="9.5" r="2.5" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
};

/**
 * Холбоо барих + footer. Desktop: зүүн талд гарчиг, баруун талд яаралтай дуудлагын мөр ба 2×2 мэдээлэл
 * (авсаархан — нэг дэлгэцэнд footer-тойгоо багтана); утсан дээр дараалан.
 */
export default function Contact() {
  const items = [
    { k: "Утас", v: contact.phone, href: `tel:${contact.phone}`, icon: icons.phone },
    { k: "И-мэйл", v: contact.email, href: `mailto:${contact.email}`, icon: icons.mail },
    { k: "Хаяг", v: contact.address, icon: icons.pin },
    { k: "Ажлын цаг", v: contact.hours, icon: icons.clock },
  ];

  return (
    <footer id="contact" className="relative overflow-hidden pt-20 sm:pt-24">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 sm:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:items-end lg:gap-14">
        <div>
          <p className="eyebrow mb-4">Холбоо барих</p>
          <motion.h2
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="text-h2"
          >
            УСНЫ АСУУДАЛ БАЙНА УУ?
            <br />
            <span className="text-water text-glow">БИД ТУСАЛЪЯ.</span>
          </motion.h2>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-mist sm:text-base">
            Асуулт, санал хүсэлтээ бидэнд илгээгээрэй. Яаралтай үед 24 цагийн дугаар руу залгана уу.
          </p>
        </div>

        <div className="grid gap-3">
          {/* яаралтай дуудлага: нэг мөр, дугаар нь шууд залгана */}
          <a
            href={`tel:${contact.emergency}`}
            className="group relative flex items-center justify-between gap-4 overflow-hidden rounded-2xl bg-alert px-5 py-4 text-[#fff] sm:px-6"
          >
            <span className="absolute -right-8 -top-10 h-28 w-28 rounded-full bg-[#fff]/15 transition-transform duration-700 group-hover:scale-[5]" />
            <span className="relative">
              <span className="flex items-center gap-2 text-[10px] tracking-[0.3em] text-[#fff]/85">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#fff]" /> ЯАРАЛТАЙ ХОЛБОО
              </span>
              <span className="mt-1 block font-display text-base font-bold sm:text-lg">24/7 яаралтай дуудлага</span>
            </span>
            <span className="relative shrink-0 font-display text-lg font-semibold sm:text-xl">
              {contact.emergency} <span className="inline-block transition-transform group-hover:translate-x-1">→</span>
            </span>
          </a>

          <dl className="grid gap-px overflow-hidden rounded-2xl border border-abyss/10 bg-abyss/10 sm:grid-cols-2">
            {items.map((i) => (
              <div key={i.k} className="flex gap-3 bg-white px-4 py-3.5 sm:px-5">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0 text-water" aria-hidden>
                  {i.icon}
                </svg>
                <div className="min-w-0">
                  <dt className="text-[10px] uppercase tracking-[0.2em] text-mist">{i.k}</dt>
                  <dd className="mt-0.5 break-words text-sm font-medium leading-snug">
                    {i.href ? (
                      <a href={i.href} className="transition hover:text-water">
                        {i.v}
                      </a>
                    ) : (
                      i.v
                    )}
                  </dd>
                </div>
              </div>
            ))}
          </dl>
        </div>
      </div>

      {/* Footer дээр дахин усны долгион болж төгсөнө — усны цикл дахин эхэлнэ */}
      <div className="relative mt-14 sm:mt-20">
        <svg viewBox="0 0 1440 120" preserveAspectRatio="none" className="block h-14 w-full sm:h-20" aria-hidden>
          <path fill="#3cc3f0" fillOpacity=".3">
            <animate
              attributeName="d"
              dur="9s"
              repeatCount="indefinite"
              values="M0 60 C240 20 480 100 720 60 S1200 20 1440 60 V120 H0Z;M0 50 C240 90 480 30 720 70 S1200 90 1440 50 V120 H0Z;M0 60 C240 20 480 100 720 60 S1200 20 1440 60 V120 H0Z"
            />
          </path>
          <path className="fill-shallow">
            <animate
              attributeName="d"
              dur="7s"
              repeatCount="indefinite"
              values="M0 80 C360 50 720 110 1080 70 S1440 80 1440 80 V120 H0Z;M0 75 C360 105 720 55 1080 90 S1440 70 1440 70 V120 H0Z;M0 80 C360 50 720 110 1080 70 S1440 80 1440 80 V120 H0Z"
            />
          </path>
        </svg>
        <div className="bg-shallow">
          {/* мобайл аппын танилцуулга: утас долгионы дээгүүр гарч хөвнө */}
          <div className="relative z-10 pb-10 sm:pb-12">
            <AppPromo />
          </div>
          <div className="mx-auto max-w-7xl px-4 sm:px-8">
            <div className="flex flex-col gap-5 border-t border-abyss/10 py-8 lg:flex-row lg:items-center lg:justify-between">
              <Logo />
              <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-mist">
                {nav.map((n) => (
                  <a key={n.href} href={n.href} className="hover:text-abyss">
                    {n.label}
                  </a>
                ))}
              </nav>
              <p className="text-xs leading-relaxed text-mist">
                УС ЭХЭЛНЭ → ЦЭВЭРШИНЭ → ХОТ РУУ ХҮРНЭ → БУЦНА → ДАХИН ЭХЭЛНЭ
                <br />© {new Date().getFullYear()} Дархан Ус Суваг ОНӨААТҮГ
              </p>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
