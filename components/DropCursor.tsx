"use client";

import { useEffect, useRef } from "react";

const INTERACTIVE = "a, button, [role='button'], label, summary, select, input[type='checkbox'], input[type='radio']";
const TEXT = "input:not([type='checkbox'], [type='radio'], [type='button'], [type='submit']), textarea, [contenteditable='true']";

/**
 * Хулганы заагч — усны дусал: хөдлөхөд чиглэлдээ сунаж, зогсоход чичирч дугуйрна,
 * холбоос дээр томорно, дарахад цацарна. Зөвхөн хулганатай төхөөрөмжид; бусад үед хөтчийн заагч.
 */
export default function DropCursor() {
  const drop = useRef<HTMLDivElement>(null);
  const tail = useRef<HTMLDivElement>(null);
  const splash = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!window.matchMedia("(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)").matches) return;
    const el = drop.current!;
    const tl = tail.current!;
    const root = document.documentElement;
    root.classList.add("drop-cursor");

    let x = 0;
    let y = 0;
    let px = 0;
    let py = 0;
    let tx = 0;
    let ty = 0;
    let angle = 0;
    // хурдыг тэгшилнэ: хулганы үйл явдалгүй кадрт 0 болж тасрахгүй
    let vx = 0;
    let vy = 0;
    // сунах хэмжээ, томролт — хоёулаа пүршээр (зогсоход хэтэрч чичирнэ)
    let s = 0;
    let vs = 0;
    let k = 1;
    let vk = 0;
    let kTarget = 1;
    let pressed = false;
    let visible = false;
    let raf = 0;

    const show = (on: boolean) => {
      visible = on;
      el.style.opacity = on ? "1" : "0";
      if (!on) tl.style.opacity = "0";
    };

    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      x = e.clientX;
      y = e.clientY;
      if (!visible) {
        px = tx = x;
        py = ty = y;
        show(true);
      }
    };
    const onOver = (e: PointerEvent) => {
      const t = e.target as Element;
      kTarget = t.closest(TEXT) ? 0 : t.closest(INTERACTIVE) ? 2.2 : 1;
    };
    const onDown = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      pressed = true;
      burst(e.clientX, e.clientY);
    };
    const onUp = () => {
      pressed = false;
    };
    const onLeave = () => show(false);

    // Цацрал: цагираг тэлж, жижиг дуслууд тал бүр тийш үсэрч унана
    const burst = (cx: number, cy: number) => {
      const part = (cls: string, frames: Keyframe[], duration: number, easing: string) => {
        const n = document.createElement("span");
        n.className = cls;
        n.style.left = `${cx}px`;
        n.style.top = `${cy}px`;
        splash.current!.append(n);
        n.animate(frames, { duration, easing }).onfinish = () => n.remove();
      };
      part(
        "drop-cursor-ring",
        [
          { transform: "translate(-50%, -50%) scale(0.2)", opacity: 0.9 },
          { transform: "translate(-50%, -50%) scale(1)", opacity: 0 },
        ],
        650,
        "cubic-bezier(.2, .7, .3, 1)",
      );
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + Math.random() * 0.6;
        const d = 16 + Math.random() * 22;
        part(
          "drop-cursor-bead",
          [
            { transform: "translate(-50%, -50%) scale(1)", opacity: 1 },
            { transform: `translate(-50%, -50%) translate(${Math.cos(a) * d}px, ${Math.sin(a) * d + 14}px) scale(0.3)`, opacity: 0 },
          ],
          500 + Math.random() * 250,
          "cubic-bezier(.15, .6, .4, 1)",
        );
      }
    };

    const frame = () => {
      vx += (x - px - vx) * 0.3;
      vy += (y - py - vy) * 0.3;
      px = x;
      py = y;
      const speed = Math.hypot(vx, vy);
      if (speed > 1) {
        const turn = Math.atan2(vy, vx) - angle;
        angle += Math.atan2(Math.sin(turn), Math.cos(turn)) * 0.35;
      }
      vs += (Math.min(speed * 0.035, 0.7) - s) * 0.22;
      vs *= 0.7;
      s += vs;
      vk += ((pressed ? 0.75 : 1) * kTarget - k) * 0.18;
      vk *= 0.68;
      k += vk;

      // rotate → scale → буцааж rotate: хөдөлгөөний чиглэлд сунана, гэрлийн тусгал байрандаа үлдэнэ
      const size = Math.max(k, 0);
      el.style.transform = `translate3d(${x}px, ${y}px, 0) rotate(${angle}rad) scale(${size * (1 + s)}, ${size * (1 - s * 0.4)}) rotate(${-angle}rad)`;

      // араас дагах жижиг дусал — хурдан хөдлөхөд л харагдана
      tx += (x - tx) * 0.22;
      ty += (y - ty) * 0.22;
      const lag = Math.hypot(x - tx, y - ty);
      tl.style.transform = `translate3d(${tx}px, ${ty}px, 0) scale(${Math.min(lag / 30, 1)})`;
      tl.style.opacity = visible && kTarget === 1 ? String(Math.min(lag / 25, 0.9)) : "0";

      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", onDown, { passive: true });
    window.addEventListener("pointerup", onUp, { passive: true });
    document.addEventListener("pointerover", onOver, { passive: true });
    root.addEventListener("mouseleave", onLeave);
    return () => {
      cancelAnimationFrame(raf);
      root.classList.remove("drop-cursor");
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
      document.removeEventListener("pointerover", onOver);
      root.removeEventListener("mouseleave", onLeave);
    };
  }, []);

  return (
    <div aria-hidden>
      <div ref={tail} className="drop-cursor-drop drop-cursor-tail" />
      <div ref={drop} className="drop-cursor-drop" />
      <div ref={splash} />
    </div>
  );
}
