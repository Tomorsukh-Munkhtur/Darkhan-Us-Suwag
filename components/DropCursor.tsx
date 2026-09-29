"use client";

import { useEffect, useRef } from "react";

/** Линз томрох газар: текст, зураг, SVG, холбоос ба [data-lens] (Hero) */
const CONTENT =
  "h1, h2, h3, h4, h5, h6, p, li, dt, dd, time, blockquote, figcaption, img, picture, svg, canvas, video, a, button, label, summary, [data-lens]";
const TEXT = "input:not([type='checkbox'], [type='radio'], [type='button'], [type='submit']), textarea, [contenteditable='true']";

/** Линзний диаметр (px): хоосон зайд жижиг, агуулга дээр томорно */
const SIZE = { base: 56, content: 104, text: 0 } as const;

type Spray = { x: number; y: number; vx: number; vy: number; r: number; el: SVGCircleElement };

/**
 * Усан дуслын displacement map: R/G = x/y шилжилт (0.5 = шилжихгүй).
 * Төв нь ~1.7x томорч, ирмэг рүүгээ илүү өргөн хүрээг шахаж харуулна (fisheye) — жинхэнэ дусал шиг.
 */
function lensMap(size = 256) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(size, size);
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const u = ((px + 0.5) / size) * 2 - 1;
      const v = ((py + 0.5) / size) * 2 - 1;
      const r = Math.hypot(u, v);
      let k = 0;
      if (r > 0 && r < 1) {
        const t = Math.min(Math.max((r - 0.7) / 0.3, 0), 1);
        const src = Math.pow(r, 1.45) + 0.22 * t * t * (3 - 2 * t);
        k = (src - r) / r / 2;
      }
      const i = (py * size + px) * 4;
      img.data[i] = Math.round(128 + k * u * 255);
      img.data[i + 1] = Math.round(128 + k * v * 255);
      img.data[i + 2] = 128;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas.toDataURL();
}

/**
 * Хулганы заагч — усан дусал линз: доторх бүх зүйл хугарч томорно (Chrome/Edge; бусад хөтөчид энгийн шил),
 * төвд нь дарах цэгийг заах жижиг гэрэлтэй цэг. Дарахад шингэн цацрал. Зөвхөн хулганатай төхөөрөмжид.
 */
export default function DropCursor() {
  const lens = useRef<HTMLDivElement>(null);
  const dot = useRef<HTMLDivElement>(null);
  const filter = useRef<SVGFilterElement>(null);
  const group = useRef<SVGGElement>(null);
  const rings = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!window.matchMedia("(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)").matches) return;
    const L = lens.current!;
    const P = dot.current!;
    const g = group.current!;
    const root = document.documentElement;
    root.classList.add("drop-cursor");

    // SVG шүүлтүүр: map нь линзний хэмжээгээр сунана; R/G/B-г бага зэрэг өөр хүчээр хугалж солонгон зурвас гаргана
    const img = filter.current!.querySelector("feImage")!;
    img.setAttribute("href", lensMap());
    const maps = [...filter.current!.querySelectorAll("feDisplacementMap")];
    let applied = -1;
    const applySize = (d: number) => {
      if (Math.abs(d - applied) < 0.5) return;
      applied = d;
      img.setAttribute("width", d.toFixed(1));
      img.setAttribute("height", d.toFixed(1));
      maps.forEach((m, i) => m.setAttribute("scale", (d * (1 + i * 0.05)).toFixed(1)));
      L.style.width = L.style.height = `${d.toFixed(1)}px`;
    };

    const ns = "http://www.w3.org/2000/svg";
    const spray: Spray[] = [];

    let x = -200;
    let y = -200;
    // линз: байрлал нь зөөлөн дагана, диаметр нь пүршээр, хөдлөхөд бага зэрэг хавтайна
    let hx = -200;
    let hy = -200;
    let d: number = SIZE.base;
    let vd = 0;
    let angle = 0;
    let squash = 0;
    // цэгийн хэмжээ
    let k = 1;
    let vk = 0;
    let mode: keyof typeof SIZE = "base";
    let pressed = false;
    let visible = false;
    let raf = 0;
    let last = 0;
    let idle = false;

    const show = (on: boolean) => {
      visible = on;
      L.style.opacity = P.style.opacity = on ? "1" : "0";
    };

    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      x = e.clientX;
      y = e.clientY;
      if (!visible) {
        hx = x;
        hy = y;
        show(true);
      }
    };
    const onOver = (e: PointerEvent) => {
      const t = e.target as Element;
      mode = t.closest(TEXT) ? "text" : t.closest(CONTENT) ? "content" : "base";
    };
    const onDown = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      pressed = true;
      splash(e.clientX, e.clientY);
    };
    const onUp = () => {
      pressed = false;
    };
    const onLeave = () => show(false);

    // Цацрал: долгионы цагираг + дээш үсэрч таталцлаар унах шингэн дуслууд
    const splash = (cx: number, cy: number) => {
      const ring = document.createElement("span");
      ring.className = "drop-cursor-ring";
      ring.style.left = `${cx}px`;
      ring.style.top = `${cy}px`;
      rings.current!.append(ring);
      ring.animate(
        [
          { transform: "translate(-50%, -50%) scale(0.2)", opacity: 0.9 },
          { transform: "translate(-50%, -50%) scale(1)", opacity: 0 },
        ],
        { duration: 700, easing: "cubic-bezier(.2, .7, .3, 1)" },
      ).onfinish = () => ring.remove();
      for (let i = 0; i < 6; i++) {
        const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.4;
        const v = 2.5 + Math.random() * 3;
        const r = 4 + Math.random() * 2.5;
        const el = document.createElementNS(ns, "circle");
        g.append(el);
        spray.push({ x: cx, y: cy, vx: Math.cos(a) * v, vy: Math.sin(a) * v, r, el });
      }
    };

    const frame = (now: number) => {
      // 60Hz-ийн кадрын нэгжээр: 120/144Hz дэлгэц дээр ч ижил хурдтай
      const n = Math.min((now - (last || now)) / (1000 / 60), 3) || 1;
      last = now;

      // линз
      const f = 1 - Math.pow(0.66, n);
      const dx = (x - hx) * f;
      const dy = (y - hy) * f;
      hx += dx;
      hy += dy;
      const speed = Math.hypot(dx, dy) / n;
      if (speed > 0.5) angle = Math.atan2(dy, dx);
      squash += (Math.min(speed * 0.008, 0.1) - squash) * (1 - Math.pow(0.75, n));
      const target = SIZE[mode] * (pressed ? 0.88 : 1);
      vd = (vd + (target - d) * 0.14 * n) * Math.pow(0.72, n);
      d += vd * n;
      const dotTarget = mode === "text" ? 0 : pressed ? 0.6 : 1;
      vk = (vk + (dotTarget - k) * 0.2 * n) * Math.pow(0.7, n);
      k += vk * n;

      const settled =
        !spray.length &&
        Math.abs(vd) < 0.01 &&
        Math.abs(vk) < 1e-3 &&
        squash < 1e-3 &&
        Math.abs(x - hx) < 0.05 &&
        Math.abs(y - hy) < 0.05;
      if (settled && idle) {
        raf = requestAnimationFrame(frame);
        return;
      }
      idle = settled;

      const size = Math.max(d, 0);
      applySize(size);
      // rotate → scale → буцааж rotate: чиглэлдээ бага зэрэг хавтайна, гэрлийн тусгал байрандаа
      L.style.transform = `translate3d(${(hx - size / 2).toFixed(1)}px, ${(hy - size / 2).toFixed(1)}px, 0) rotate(${angle}rad) scale(${(1 + squash).toFixed(3)}, ${(1 - squash * 0.6).toFixed(3)}) rotate(${-angle}rad)`;
      P.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${Math.max(k, 0).toFixed(3)})`;

      for (let i = spray.length - 1; i >= 0; i--) {
        const s = spray[i];
        s.vy += 0.22 * n;
        s.vx *= Math.pow(0.98, n);
        s.x += s.vx * n;
        s.y += s.vy * n;
        s.r *= Math.pow(0.985, n);
        if (s.r < 2.5) {
          s.el.remove();
          spray.splice(i, 1);
          continue;
        }
        s.el.setAttribute("cx", s.x.toFixed(1));
        s.el.setAttribute("cy", s.y.toFixed(1));
        s.el.setAttribute("r", s.r.toFixed(2));
      }
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
      g.replaceChildren();
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
      document.removeEventListener("pointerover", onOver);
      root.removeEventListener("mouseleave", onLeave);
    };
  }, []);

  return (
    <div aria-hidden>
      <div ref={lens} className="cursor-lens" />
      <svg className="drop-cursor-svg">
        <defs>
          {/* Линз (backdrop-filter): map-аар хугалж томруулна; R/G/B өөр хүчээр → ирмэгт солонгон зурвас */}
          <filter ref={filter} id="drop-lens" x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
            <feImage x="0" y="0" width="56" height="56" preserveAspectRatio="none" result="map" />
            <feDisplacementMap in="SourceGraphic" in2="map" scale="56" xChannelSelector="R" yChannelSelector="G" result="dr" />
            <feColorMatrix in="dr" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="r" />
            <feDisplacementMap in="SourceGraphic" in2="map" scale="59" xChannelSelector="R" yChannelSelector="G" result="dg" />
            <feColorMatrix in="dg" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="g" />
            <feDisplacementMap in="SourceGraphic" in2="map" scale="62" xChannelSelector="R" yChannelSelector="G" result="db" />
            <feColorMatrix in="db" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="b" />
            <feBlend in="r" in2="g" mode="screen" result="rg" />
            <feBlend in="rg" in2="b" mode="screen" />
          </filter>
          {/* Цацралын дуслууд: goo — ойрхон дуслууд нийлнэ; тунгалаг бие, ирмэг, гэрлийн тусгал, сүүдэр */}
          <filter id="drop-liquid" x="-60%" y="-60%" width="220%" height="220%" colorInterpolationFilters="sRGB">
            <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
            <feColorMatrix in="blur" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 20 -8" result="goo" />
            <feGaussianBlur in="goo" stdDeviation="1.8" result="bump" />
            <feSpecularLighting in="bump" surfaceScale="4" specularConstant="1.2" specularExponent="26" lightingColor="#ffffff" result="spec">
              <feDistantLight azimuth="235" elevation="48" />
            </feSpecularLighting>
            <feComposite in="spec" in2="goo" operator="in" result="shine" />
            <feFlood floodColor="#5fd3f7" floodOpacity="0.5" />
            <feComposite in2="goo" operator="in" result="body" />
            <feMorphology in="goo" operator="erode" radius="1" result="inner" />
            <feComposite in="goo" in2="inner" operator="out" result="edge" />
            <feFlood floodColor="#38b6f0" floodOpacity="0.7" />
            <feComposite in2="edge" operator="in" result="rim" />
            <feMerge>
              <feMergeNode in="body" />
              <feMergeNode in="rim" />
              <feMergeNode in="shine" />
            </feMerge>
          </filter>
        </defs>
        <g ref={group} filter="url(#drop-liquid)" />
      </svg>
      <div ref={dot} className="cursor-dot" />
      <div ref={rings} />
    </div>
  );
}
