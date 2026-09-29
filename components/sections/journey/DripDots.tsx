"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";

/** Цэг хоорондын зай (px) */
const GAP = 34;

/**
 * Усны аяллын хуудаслалт: шат солигдоход идэвхтэй цэгээс дусал сунаж тасраад дараагийн цэг рүү унана,
 * унасан газарт долгион тарж цэг дүүрнэ. Буцахад бөмбөлөг найгасаар дээш хөөрнө.
 */
export default function DripDots({ items, active }: { items: { id: string; label: string }[]; active: number }) {
  const box = useRef<HTMLDivElement>(null);
  const drop = useRef<SVGSVGElement>(null);
  const bubble = useRef<HTMLSpanElement>(null);
  const fills = useRef<(HTMLSpanElement | null)[]>([]);
  const prev = useRef(active);

  useEffect(() => {
    fills.current.forEach((f, i) => gsap.set(f, { scale: i === prev.current ? 1 : 0 }));
  }, []);

  useEffect(() => {
    const from = prev.current;
    const to = active;
    prev.current = to;
    if (from === to) return;
    const fromFill = fills.current[from];
    const toFill = fills.current[to];
    gsap.killTweensOf([drop.current, bubble.current]);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      gsap.set(fills.current, { scale: 0 });
      gsap.set(toFill, { scale: 1 });
      return;
    }

    // унасан/хөөрсөн газарт долгион тарж, цэг уян хатан дүүрнэ
    const land = () => {
      gsap.fromTo(toFill, { scale: 0 }, { scale: 1, duration: 0.7, ease: "elastic.out(1, 0.45)", overwrite: true });
      const ring = document.createElement("span");
      ring.className = "drip-ripple";
      ring.style.top = `${to * GAP + 8}px`;
      box.current!.append(ring);
      ring.animate(
        [
          { transform: "scale(0.4)", opacity: 0.9 },
          { transform: "scale(2.6)", opacity: 0 },
        ],
        { duration: 700, easing: "cubic-bezier(.2, .7, .3, 1)" },
      ).onfinish = () => ring.remove();
    };

    gsap.set(fills.current.filter((f, i) => i !== from && i !== to), { scale: 0 });
    gsap.to(fromFill, { scale: 0, duration: 0.3, ease: "power2.in", overwrite: true });
    const y0 = from * GAP;
    const y1 = to * GAP;
    const dist = Math.abs(to - from);
    if (to > from) {
      // дусал: доош сунаж тасраад таталцлаар унана
      gsap
        .timeline()
        .set(drop.current, { y: y0, opacity: 1, scaleX: 1, scaleY: 0.4, transformOrigin: "50% 0%" })
        .to(drop.current, { scaleY: 1.5, scaleX: 0.75, duration: 0.2, ease: "power2.in" })
        .to(drop.current, { y: y1 - 10, scaleY: 1.2, scaleX: 0.85, duration: 0.2 + 0.06 * dist, ease: "power2.in" })
        .set(drop.current, { opacity: 0 })
        .add(land);
    } else {
      // бөмбөлөг: найгасаар дээш хөөрнө
      gsap
        .timeline()
        .set(bubble.current, { y: y0, x: 0, opacity: 1, scale: 0.4 })
        .to(bubble.current, { y: y1, scale: 1, duration: 0.4 + 0.08 * dist, ease: "sine.inOut" })
        .to(bubble.current, { x: 3, duration: 0.1, yoyo: true, repeat: 3, ease: "sine.inOut" }, "<")
        .set(bubble.current, { opacity: 0 })
        .add(land);
    }
  }, [active]);

  return (
    <nav aria-label="Усны аяллын шатууд" className="absolute right-4 top-1/2 z-20 hidden -translate-y-1/2 md:block lg:right-8">
      <div ref={box} className="relative w-4" style={{ height: (items.length - 1) * GAP + 16 }}>
        {items.map((s, i) => (
          <a
            key={s.id}
            href={`#stage-${s.id}`}
            aria-label={s.label}
            aria-current={i === active ? "step" : undefined}
            className="drip-dot group absolute left-0 h-4 w-4"
            style={{ top: i * GAP }}
          >
            <span className="drip-dot__ring" />
            <span
              ref={(el) => {
                fills.current[i] = el;
              }}
              className="drip-dot__fill"
            />
            <span className="pointer-events-none absolute right-7 top-1/2 -translate-y-1/2 whitespace-nowrap rounded-full border border-abyss/10 bg-white/90 px-3 py-1 font-display text-[10px] tracking-[0.2em] text-abyss opacity-0 shadow-md backdrop-blur transition group-hover:opacity-100">
              {s.label}
            </span>
          </a>
        ))}
        <svg ref={drop} viewBox="0 0 12 16" className="drip-drop" aria-hidden>
          <path d="M6 0C6 0 0 7.5 0 10.5a6 6 0 0012 0C12 7.5 6 0 6 0Z" fill="url(#drip-g)" />
          <defs>
            <radialGradient id="drip-g" cx=".35" cy=".6" r=".7">
              <stop offset="0" stopColor="#fff" />
              <stop offset=".45" stopColor="#5fd3f7" />
              <stop offset="1" stopColor="#1f8fd0" />
            </radialGradient>
          </defs>
        </svg>
        <span ref={bubble} className="drip-bubble" aria-hidden />
      </div>
    </nav>
  );
}
