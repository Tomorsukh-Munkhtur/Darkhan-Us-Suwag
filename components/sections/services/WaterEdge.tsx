"use client";

import { useEffect, useId, useRef } from "react";
import { gsap } from "gsap";

/** Долгионы бүрэлдэхүүн: A — өндөр (px), L — долгионы урт (px), c — хурд (px/s, хасах нь эсрэг чиглэл), Q — оргилын хурц (Gerstner), p — фаз */
type Comp = { A: number; L: number; c: number; Q: number; p: number };

// Урд давалгаа: урт, богино долгионууд өөр өөр чиглэл, хурдтай нийлж давтагдахгүй; ΣQ < 1 тул оргил хурц, хонхор нь хавтгай
const FRONT: Comp[] = [
  { A: 11, L: 560, c: 46, Q: 0.34, p: 0 },
  { A: 6.5, L: 330, c: -34, Q: 0.24, p: 1.7 },
  { A: 3.4, L: 170, c: 28, Q: 0.16, p: 3.1 },
  { A: 1.6, L: 76, c: -20, Q: 0.1, p: 0.6 },
  { A: 0.8, L: 38, c: 15, Q: 0.05, p: 2.2 },
];
// Ард (холын) давалгаа: урт, удаан
const BACK: Comp[] = [
  { A: 12, L: 720, c: -30, Q: 0.3, p: 2.4 },
  { A: 6, L: 410, c: 22, Q: 0.22, p: 0.9 },
  { A: 2.6, L: 190, c: -16, Q: 0.14, p: 4.2 },
];
// Тайван ус: урт, намхан, гөлгөр долгион — оргил нь дугуй (Q бага), удаан
const CALM_FRONT: Comp[] = [
  { A: 6.5, L: 940, c: 20, Q: 0.1, p: 0 },
  { A: 3.6, L: 540, c: -14, Q: 0.07, p: 1.9 },
  { A: 1.4, L: 250, c: 11, Q: 0.04, p: 3.3 },
  { A: 0.5, L: 120, c: -8, Q: 0.02, p: 0.7 },
];
const CALM_BACK: Comp[] = [
  { A: 7, L: 1150, c: -12, Q: 0.06, p: 2.2 },
  { A: 3, L: 620, c: 9, Q: 0.04, p: 0.4 },
];
const WAVES = {
  lively: { front: FRONT, back: BACK, base: 0.56, backLift: 12 },
  calm: { front: CALM_FRONT, back: CALM_BACK, base: 0.62, backLift: 7 },
};
type Variant = keyof typeof WAVES;

/** Гадаргуу дагуу гүйх гялбааны давтамж (px) */
const GLINT = 420;

/** Gerstner гадаргуу: s цэг дээрх [x шилжилт, y өндөр] (y < 0 — дээш) */
function surface(comps: Comp[], s: number, t: number, seed: number): [number, number] {
  let x = s;
  let y = 0;
  for (const c of comps) {
    const k = (2 * Math.PI) / c.L;
    const th = k * (s - c.c * t) + c.p + seed;
    x -= (c.Q / k) * Math.sin(th);
    y -= c.A * Math.cos(th);
  }
  return [x, y];
}

type Edge = {
  svg: SVGSVGElement;
  back: SVGPathElement;
  front: SVGPathElement;
  under: SVGPathElement;
  glow: SVGPathElement;
  crest: SVGPathElement;
  glint: SVGLinearGradientElement;
  w: number;
  h: number;
  seed: number;
  on: boolean;
  wave: (typeof WAVES)[Variant];
};

function draw(e: Edge, t: number) {
  const { w, h } = e;
  if (!w || !h) return;
  // өндрийн масштаб: ирмэгийн өндөрт (утсан дээр намхан) тааруулна
  const f = (h / 96) * 1.25;
  const { front, back: backComps, base: baseRatio, backLift } = e.wave;
  const base = h * baseRatio;
  let top = "";
  let under = "";
  let back = "";
  let first = true;
  for (let s = -140; s <= w + 140; s += 10) {
    const [x, y] = surface(front, s, t, e.seed);
    const [bx, by] = surface(backComps, s, t, e.seed * 1.7);
    const X = x.toFixed(1);
    const c = first ? "M" : "L";
    top += `${c}${X} ${(base + y * f).toFixed(1)}`;
    // гадаргуугийн доорх хугарсан гэрлийн зурвас: гадаргууг сулавтар дагана
    under += `${c}${X} ${(base + 17 * f + y * f * 0.45).toFixed(1)}`;
    back += `${c}${bx.toFixed(1)} ${(base - backLift * f + by * f).toFixed(1)}`;
    first = false;
  }
  const close = `L${w + 200} ${h}L-200 ${h}Z`;
  e.back.setAttribute("d", back + close);
  e.front.setAttribute("d", top + close);
  e.under.setAttribute("d", under);
  e.glow.setAttribute("d", top);
  e.crest.setAttribute("d", top);
  e.glint.setAttribute("gradientTransform", `translate(${(-(t * 70) % GLINT).toFixed(1)} 0)`);
}

// Бүх ирмэгийг нэг ticker зурна; зөвхөн дэлгэцэн дээр байгааг нь
const edges = new Set<Edge>();
const tick = () => {
  const t = performance.now() / 1000;
  edges.forEach((e) => e.on && draw(e, t));
};

/**
 * Жинхэнэ ус шиг гадаргуу (картын дээд ирмэг): Gerstner долгионууд нийлж давтагдахгүй хөдөлнө,
 * ард нь холын цайвар давалгаа, оргил дээр гэрэл тусч гялбаа гүйнэ, гадаргуугийн доор гэрэл хугарна.
 * Өнгө нь эцэг элементийн --svc-top (доод ирмэг нь яг картын өнгөтэй тул заагшгүй).
 * variant: lively — хөдөлгөөнтэй (үйлчилгээний картууд), calm — тайван гөлгөр (бараан бичлэг дээр, About).
 */
export default function WaterEdge({ variant = "lively" }: { variant?: Variant }) {
  const id = useId();
  const svg = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const el = svg.current!;
    const q = <T extends Element>(s: string) => el.querySelector<T>(s)!;
    const e: Edge = {
      svg: el,
      back: q(".svc-wave__back"),
      front: q(".svc-wave__front"),
      under: q(".svc-wave__under"),
      glow: q(".svc-wave__glow"),
      crest: q(".svc-wave__crest"),
      glint: q("linearGradient[data-glint]"),
      w: 0,
      h: 0,
      seed: Math.random() * 100,
      on: false,
      wave: WAVES[variant],
    };
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const ro = new ResizeObserver(() => {
      e.w = el.clientWidth;
      e.h = el.clientHeight;
      el.setAttribute("viewBox", `0 0 ${e.w} ${e.h}`);
      draw(e, reduced ? 0 : performance.now() / 1000);
    });
    ro.observe(el);
    if (reduced) return () => ro.disconnect();

    const io = new IntersectionObserver(([en]) => (e.on = en.isIntersecting));
    io.observe(el);
    if (!edges.size) gsap.ticker.add(tick);
    edges.add(e);
    return () => {
      ro.disconnect();
      io.disconnect();
      edges.delete(e);
      if (!edges.size) gsap.ticker.remove(tick);
    };
  }, []);

  return (
    <svg ref={svg} aria-hidden className="svc-wave" data-variant={variant}>
      <defs>
        {/* оргил нь гэрэлтэй, бага зэрэг тунгалаг → доош картын өнгө рүү гүнзгийрнэ */}
        <linearGradient id={`${id}f`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" className="svc-stop-light" />
          <stop offset="0.55" className="svc-stop" />
          <stop offset="1" className="svc-stop" />
        </linearGradient>
        {/* оргилын шугам дагуу гүйх гялбаа */}
        <linearGradient id={`${id}g`} data-glint gradientUnits="userSpaceOnUse" x1="0" y1="0" x2={GLINT} y2="0" spreadMethod="repeat">
          <stop offset="0" stopColor="#fff" stopOpacity="0.25" />
          <stop offset="0.12" stopColor="#fff" stopOpacity="0.95" />
          <stop offset="0.22" stopColor="#fff" stopOpacity="0.3" />
          <stop offset="0.55" stopColor="#fff" stopOpacity="0.15" />
          <stop offset="0.68" stopColor="#fff" stopOpacity="0.75" />
          <stop offset="0.8" stopColor="#fff" stopOpacity="0.2" />
          <stop offset="1" stopColor="#fff" stopOpacity="0.25" />
        </linearGradient>
      </defs>
      <path className="svc-wave__back" />
      <path className="svc-wave__front" fill={`url(#${id}f)`} />
      <path className="svc-wave__under" />
      <path className="svc-wave__glow" />
      <path className="svc-wave__crest" stroke={`url(#${id}g)`} />
    </svg>
  );
}
