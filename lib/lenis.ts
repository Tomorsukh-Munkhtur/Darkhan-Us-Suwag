import type Lenis from "lenis";
import { gsap } from "gsap";

/** SmoothScroll.tsx үүсгэсэн Lenis — бусад компонент (Hero-ийн шумбалтын snap) программаар гүйлгэхэд ашиглана */
let instance: Lenis | null = null;

export function setLenis(l: Lenis | null) {
  instance = l;
}

const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

/**
 * y (px) руу duration секундэд гулсана (хэрэглэгчийн оролт түгжигдэнэ). Lenis байхгүй бол (reduced motion) GSAP tween.
 * Дуусахад onComplete.
 */
export function glideTo(y: number, duration: number, onComplete: () => void) {
  if (instance) {
    instance.scrollTo(y, { duration, easing: easeInOutCubic, lock: true, force: true, onComplete: () => onComplete() });
    return;
  }
  const o = { y: window.scrollY };
  gsap.to(o, {
    y,
    duration,
    ease: "power2.inOut",
    onUpdate: () => window.scrollTo(0, o.y),
    onComplete,
  });
}
