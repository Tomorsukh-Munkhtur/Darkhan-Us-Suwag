"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";

/** Цэг хоорондын зай (px) */
const GAP = 40;

/**
 * Усны аяллын хэвтээ хуудаслалт: шат солигдоход идэвхтэй цэгээс дусал нуман замаар дараагийн цэг рүү
 * үсэрч, буусан газарт долгион тарж цэг дүүрнэ.
 */
export default function DripDots({ items, active }: { items: { id: string; label: string }[]; active: number }) {
  const box = useRef<HTMLDivElement>(null);
  const drop = useRef<HTMLSpanElement>(null);
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
    const toFill = fills.current[to];
    gsap.killTweensOf(drop.current);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      gsap.set(fills.current, { scale: 0 });
      gsap.set(toFill, { scale: 1 });
      return;
    }

    // буусан газарт долгион тарж, цэг уян хатан дүүрнэ
    const land = () => {
      gsap.fromTo(toFill, { scale: 0 }, { scale: 1, duration: 0.7, ease: "elastic.out(1, 0.45)", overwrite: true });
      const ring = document.createElement("span");
      ring.className = "drip-ripple";
      ring.style.left = `${to * GAP + 8}px`;
      ring.style.top = "8px";
      box.current!.append(ring);
      ring.animate(
        [
          { transform: "scale(0.4)", opacity: 0.9 },
          { transform: "scale(2.6)", opacity: 0 },
        ],
        { duration: 700, easing: "cubic-bezier(.2, .7, .3, 1)" },
      ).onfinish = () => ring.remove();
    };

    gsap.set(fills.current.filter((_, i) => i !== from && i !== to), { scale: 0 });
    gsap.to(fills.current[from], { scale: 0, duration: 0.25, ease: "power2.in", overwrite: true });
    // дусал: нуман замаар үсэрнэ, нисэхдээ хөдлөх чиглэлдээ сунана
    const dist = Math.abs(to - from);
    const dur = 0.42 + 0.08 * dist;
    gsap
      .timeline()
      .set(drop.current, { x: from * GAP, y: 0, opacity: 1, scaleX: 1, scaleY: 1 })
      .to(drop.current, { x: to * GAP, duration: dur, ease: "power1.inOut" }, 0)
      .to(drop.current, { y: -18 - 4 * dist, duration: dur / 2, ease: "sine.out" }, 0)
      .to(drop.current, { y: 0, duration: dur / 2, ease: "sine.in" }, dur / 2)
      .to(drop.current, { scaleX: 1.5, scaleY: 0.8, duration: dur / 2, ease: "sine.inOut", yoyo: true, repeat: 1 }, 0)
      .set(drop.current, { opacity: 0 })
      .add(land);
  }, [active]);

  return (
    <nav aria-label="Усны аяллын шатууд" className="drip-nav absolute bottom-8 left-1/2 z-20 -translate-x-1/2">
      <div ref={box} className="relative h-4" style={{ width: (items.length - 1) * GAP + 16 }}>
        {items.map((s, i) => (
          <a
            key={s.id}
            href={`#stage-${s.id}`}
            aria-label={s.label}
            aria-current={i === active ? "step" : undefined}
            className="drip-dot group absolute top-0 h-4 w-4"
            style={{ left: i * GAP }}
          >
            <span className="drip-dot__ring" />
            <span
              ref={(el) => {
                fills.current[i] = el;
              }}
              className="drip-dot__fill"
            />
            <span className="pointer-events-none absolute bottom-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border border-abyss/10 bg-white/90 px-3 py-1 font-display text-[10px] tracking-[0.2em] text-abyss opacity-0 shadow-md backdrop-blur transition group-hover:opacity-100">
              {s.label}
            </span>
          </a>
        ))}
        <span ref={drop} className="drip-hop" aria-hidden />
      </div>
    </nav>
  );
}
