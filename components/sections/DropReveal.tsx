"use client";

import { useEffect, useId, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { hasWebGL2 } from "@/components/three/journey/utils/browser";

gsap.registerPlugin(ScrollTrigger);

const WaterSurface = dynamic(() => import("@/components/three/WaterSurface"), { ssr: false });

/** WaterJourney сүүлийн шатан дээрээ тогтож, энэ шилжилт явагдах хугацаа (дэлгэцийн өндрийн хувь). WaterJourney.tsx ашиглана */
export const REVEAL = 1.2;
/** Cursor-гүй (хуруугаар) үед дуслын эхлэх радиус (px); cursor-той бол cursor-ын дуслын хэмжээнээс эхэлнэ */
const R0 = 10;
/** Явцын энэ хэсэгт дусал дэлгэцийг усаар дүүргэнэ; үлдсэнд нь хэсэг гүнээс хөвж гарна */
const FLOOD = 0.62;
/** Дуслын ирмэгийн цэгийн тоо */
const PTS = 72;
const RINGS = 3;
/** Хугарлын noise-ийн давтамжийн хавтан (px) — stitchTiles тул offset нь үүгээр давтагдахад заагшгүй */
const TILE = 480;
const smooth = (a: number, b: number, x: number) => {
  const k = gsap.utils.clamp(0, 1, (x - a) / (b - a));
  return k * k * (3 - 2 * k);
};

/**
 * Усны аяллын дараах цайвар (light) хэсгүүд — дараагийн хэсэг уснаас хөвж гарч ирнэ:
 * 1) cursor-ын усан дусал өөрөө (утсан дээр — хуруугаар сүүлд хүрсэн цэгээс) урсгал ус шиг долгиолон томорч,
 *    cursor-ыг зөөлөн дагаж урсан, урдаа долгион тарааж дэлгэцийг усаар дүүргэнэ;
 * 2) хэсэг усны гүнд жижиг, бүдэг, хугарч долгиолсон байснаа дээш хөвж ойртон томорч, ус гэгээтэй болно;
 * 3) гялалзсан усны гадаргуу дээрээс доош гүйж, хэсэг уснаас гарч тод болно.
 * Хугарал: Chromium desktop дээр backdrop-filter SVG displacement (урсаж хөдөлнө), бусад дээр хөнгөн найгалт.
 *
 * Wrapper -100svh-ээр дээш татагдсан тул WaterJourney тогтсон сүүлийн REVEAL дэлгэцийн турш доороос
 * дээш гүйнэ — transform-оор дэлгэцийн дээд ирмэгт барина. Дууссаны дараа transform/clip арилж, хэвийн scroll.
 * data-nav-light: navbar-ын хэсэг уснаас гарсан эсэх (Navbar.tsx цайвар болно).
 *
 * Тохиргоогоор бусад газар дахин ашиглана (жишээ нь Усны чанар: доод төвөөс, dark, pin-гүй, гадаргуугүй).
 */
type Props = {
  children: React.ReactNode;
  /** wrapper-ийн id (Navbar цайвар хэсгийг "light-zone"-оор олно) */
  id?: string;
  /** wrapper-ийн өнгө/давхаргын класс */
  className?: string;
  /** дусал хаанаас эхлэх: cursor — cursor-ын дусал (cursor-ыг дагана); bottom — дэлгэцийн доод төв */
  origin?: "cursor" | "bottom";
  /** өмнөх хэсэг шилжилтийн турш тогтсон (pin) бол -100svh дээш татна (WaterJourney); үгүй бол ердийн урсгалд */
  pull?: boolean;
  /** шилжилт эхлэх цэг: wrapper-ийн дээд ирмэг дэлгэцийн энэ хувьд (1 = доод ирмэг) */
  start?: number;
  /** төгсгөлд усны гадаргуу дээрээс доош гүйж уснаас гарах үе шат; false бол ус аажим тунгалаг болно */
  surfacing?: boolean;
  /** дусал дотор caustic урсгал (тусдаа WebGL canvas) */
  caustics?: boolean;
  /** navbar: light — дусал бүрхсэн үед цайвар (data-nav-light), dark — бараан (data-nav-dark) */
  nav?: "light" | "dark";
  /**
   * урвуу: тойрог томрохын оронд дэлгэц дүүрэн тойрог cursor руу жижгэрнэ — өмнөх хэсэг тойрог дотор үлдэж,
   * шинэ хэсэг тойргоос гадна талд гарна; төгсгөлд тойрог cursor-ын дусал болно
   */
  invert?: boolean;
};

export default function DropReveal({
  children,
  id = "light-zone",
  className = "theme-light relative bg-foam text-abyss",
  origin = "cursor",
  pull = true,
  start = REVEAL,
  surfacing = true,
  caustics = true,
  nav = "light",
  invert = false,
}: Props) {
  // давхар хэрэглэхэд SVG шүүлтүүрийн id давхцахгүй (url(#…)-д тусгай тэмдэгтгүй)
  const filterId = `reveal-refract-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const root = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const fx = useRef<HTMLDivElement>(null);
  const rim = useRef<SVGPathElement[]>([]);
  const rings = useRef<SVGCircleElement[]>([]);
  const surf = useRef<SVGPathElement[]>([]);
  const veil = useRef<HTMLDivElement>(null);
  const flowBox = useRef<HTMLDivElement>(null);
  const fill = useRef<HTMLDivElement>(null);
  const refract = useRef<SVGFilterElement>(null);
  const flowOffset = useRef<SVGFEOffsetElement>(null);
  const disp = useRef<SVGFEDisplacementMapElement>(null);
  const [surface, setSurface] = useState(false);
  // эхэндээ хэдэн кадр зурж shader-ийг урьдчилан бэлдэнэ (шилжилт эхлэхэд гацахгүй)
  const [flowing, setFlowing] = useState(true);

  useEffect(() => {
    // cleanup үед (StrictMode) ref-үүд null болдог тул элементүүдийг эндээс барина
    const el = root.current!;
    const inner = content.current!;
    const lit = (on: boolean) => {
      if (nav === "dark") el.dataset.navDark = String(on);
      else el.dataset.navLight = String(on);
    };
    const mm = gsap.matchMedia();

    mm.add("(prefers-reduced-motion: no-preference)", () => {
      // WebGL2 байхгүй бол WaterSurface үүсгэхгүй (R3F алдаа хуудсыг унагахаас сэргийлнэ)
      setSurface(hasWebGL2());
      // Жинхэнэ хугарал: backdrop-filter дотор SVG шүүлтүүр зөвхөн Chromium-д ажиллана, хүнд тул desktop дээр л
      const heavy =
        "userAgentData" in navigator && window.matchMedia("(pointer: fine) and (min-width: 768px)").matches;
      // дуслын төв (дэлгэцийн координат) ба эхлэх радиус
      let cx = 0;
      let cy = 0;
      let r0 = R0;
      let vw = 0;
      let vh = 0;
      let q = 0;
      let on = false;
      let last = 0;
      const t0 = performance.now();

      // Хулгангүй төхөөрөмж: хуруугаар сүүлд хүрсэн (гүйлгэсэн) цэг
      let touch: { x: number; y: number } | null = null;
      const onTouch = (e: TouchEvent) => {
        const p = e.touches[0];
        if (p) touch = { x: p.clientX, y: p.clientY };
      };
      window.addEventListener("touchstart", onTouch, { passive: true });
      window.addEventListener("touchmove", onTouch, { passive: true });

      // Дусал хаанаас эхэлж, юуг дагах вэ: cursor-ын усан дусал (DropCursor) → сүүлд хүрсэн цэг → дэлгэцийн гол
      const lens = () =>
        document.documentElement.classList.contains("drop-cursor") ? document.querySelector<HTMLElement>(".cursor-lens") : null;
      // линз харагдаж байх үеийн (хулгана цонхонд) сүүлийн байрлал
      let cursor: { x: number; y: number } | null = null;
      const target = () => {
        // доод төвөөс: усны гадаргуу доороос дэлгэц рүү тэлнэ
        if (origin === "bottom") return { x: vw / 2, y: vh };
        const l = lens();
        if (l && l.style.opacity === "1") {
          const r = l.getBoundingClientRect();
          cursor = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
        }
        return cursor ?? touch ?? { x: vw / 2, y: vh / 2 };
      };

      const measure = () => {
        vw = window.innerWidth;
        vh = window.innerHeight;
        // хугарлын шүүлтүүрийн муж: offset-оор хөдлөхөд хоосон зурвас гарахгүйн тулд дэлгэцээс TILE-аар том
        const f = refract.current!;
        f.setAttribute("x", String(-TILE));
        f.setAttribute("y", String(-TILE));
        f.setAttribute("width", String(vw + 2 * TILE));
        f.setAttribute("height", String(vh + 2 * TILE));
      };

      const render = () => {
        const now = performance.now();
        const t = (now - t0) / 1000;
        const dt = Math.min((now - last) / 1000, 0.05);
        last = now;

        // дусал cursor-ыг зөөлөн дагаж урсана (усны инерц: cursor-оос бага зэрэг хоцорно)
        const tg = target();
        const follow = 1 - Math.exp(-dt * 5);
        cx += (tg.x - cx) * follow;
        cy += (tg.y - cy) * follow;
        const rMax = Math.hypot(Math.max(cx, vw - cx), Math.max(cy, vh - cy)) + 40;

        // 1) дусал урсгал ус шиг долгиолон томорно (урвуу: cursor руу жижгэрнэ) — эхэнд, төгсгөлд дугуй, дундуур нь хамгийн их долгиолно
        const g = invert ? q : gsap.utils.clamp(0, 1, q / FLOOD);
        const R = invert ? r0 + (rMax - r0) * (1 - q) ** 1.5 : r0 + (rMax - r0) * g ** 1.6;
        const w = 0.08 * Math.sin(Math.PI * g) ** 0.7;
        const poly: string[] = [];
        let d = "";
        for (let i = 0; i < PTS; i++) {
          const a = (i / PTS) * Math.PI * 2;
          const k = 1 + w * (0.5 * Math.sin(3 * a + 1.1 * t) + 0.3 * Math.sin(5 * a - 1.7 * t + 1) + 0.2 * Math.sin(9 * a + 2.4 * t + 2));
          const x = (cx + Math.cos(a) * R * k).toFixed(1);
          const y = (cy + Math.sin(a) * R * k).toFixed(1);
          poly.push(`${x}px ${y}px`);
          d += `${i ? "L" : "M"}${x} ${y}`;
        }
        if (invert) {
          // тасалгаатай clip (evenodd): дэлгэцийн тэгш өнцөгт — тойрог = тойргоос гадна л харагдана
          const m = 60;
          const o = `${-m}px ${-m}px`;
          el.style.clipPath = `polygon(evenodd, ${o}, ${vw + m}px ${-m}px, ${vw + m}px ${vh + m}px, ${-m}px ${vh + m}px, ${o}, ${poly.join(",")}, ${poly[0]}, ${o})`;
        } else el.style.clipPath = `polygon(${poly.join(",")})`;
        rim.current.forEach((p) => p.setAttribute("d", `${d}Z`));

        // дуслаас урагш тархах долгион (бараан дэвсгэр дээр); урвуу үед тойрог дотор cursor руу төвлөрнө
        const ringAmt = invert
          ? smooth(0.05, 0.2, q) * (1 - smooth(0.85, 1, q))
          : smooth(0, 0.06, q) * (1 - smooth(FLOOD * 0.8, FLOOD, q));
        rings.current.forEach((c, i) => {
          const f = (t * 0.55 + i / RINGS) % 1;
          c.setAttribute("cx", cx.toFixed(1));
          c.setAttribute("cy", cy.toFixed(1));
          const rr = invert ? Math.max(0, R - 14 - f * (40 + R * 0.3)) : R + 14 + f * (50 + R * 0.35);
          c.setAttribute("r", rr.toFixed(1));
          c.style.opacity = ((1 - f) * 0.55 * ringAmt).toFixed(3);
        });

        // эхэндээ cursor-ын дусал шиг гэрэлтэй дусал → томрох тусам тунгалаг ус болно
        const fl = fill.current!;
        fl.style.width = fl.style.height = `${(2 * R).toFixed(1)}px`;
        fl.style.transform = `translate3d(${(cx - R).toFixed(1)}px, ${(cy - R).toFixed(1)}px, 0)`;
        fl.style.opacity = invert ? "0" : (0.6 * (1 - gsap.utils.clamp(0, 1, (R - r0) / 110))).toFixed(3);

        // 2) гүнээс хөвж гарна: жижиг, доор байснаа дээш хөвж ойртон томорно
        const rise = smooth(0.06, 0.96, q);
        const s = 0.84 + 0.16 * rise;
        const sway = heavy ? 0 : Math.sin(t * 1.4) * 6 * (1 - rise);
        inner.style.transformOrigin = `50% ${(0.45 * vh).toFixed(0)}px`;
        inner.style.transform = `translate3d(${sway.toFixed(1)}px, ${((1 - rise) * 0.18 * vh).toFixed(1)}px, 0) scale(${s.toFixed(4)})`;

        // гүнд: өнгө тод, бүдэг, хүчтэй хугарна → гадаргуу руу ойртох тусам ус гэгээтэй, тунгалаг болно
        const depth = 1 - smooth(0.08, 0.74, q);
        const a = (0.5 + 0.35 * depth).toFixed(3);
        const v = veil.current!;
        v.style.backgroundImage = `linear-gradient(rgb(40 150 212 / ${a}), rgb(6 48 92 / ${a}))`;
        // гадаргуугүй үед: ус аажим тунгалаг болж, бичиг бүдгээс тод болно
        if (!surfacing) v.style.opacity = (1 - smooth(0.5, 0.97, q)).toFixed(3);
        const blur = `blur(${(1.5 + 6 * depth).toFixed(1)}px)`;
        const bf = heavy ? `url(#${filterId}) ${blur}` : blur;
        v.style.backdropFilter = bf;
        v.style.setProperty("-webkit-backdrop-filter", blur);
        if (heavy) {
          disp.current!.setAttribute("scale", (16 + 38 * depth).toFixed(1));
          flowOffset.current!.setAttribute("dx", String(-((t * 12) % TILE)));
          flowOffset.current!.setAttribute("dy", String(-((t * 34) % TILE)));
        }

        // 3) гадаргуу дээрээс доош гүйнэ: шугамаас дээш — уснаас гарсан (тод), доош — усан доор
        const up = surfacing ? smooth(FLOOD + 0.1, 0.97, q) : 0;
        const line = -30 + up * (vh + 70);
        const mask = up > 0 ? `linear-gradient(transparent ${(line - 4).toFixed(1)}px, #000 ${(line + 22).toFixed(1)}px)` : "none";
        v.style.maskImage = mask;
        v.style.setProperty("-webkit-mask-image", mask);
        let sd = "";
        for (let x = -20; x <= vw + 20; x += 24) {
          const y = line + Math.sin(x * 0.011 + t * 2.6) * 7 + Math.sin(x * 0.029 - t * 3.3) * 3;
          sd += `${x === -20 ? "M" : "L"}${x} ${y.toFixed(1)}`;
        }
        const so = (Math.sin(Math.PI * up) ** 0.4).toFixed(3);
        surf.current.forEach((p) => {
          p.setAttribute("d", sd);
          p.style.opacity = so;
        });
        flowBox.current!.style.opacity = (1 - smooth(0.8, 1, q)).toFixed(3);
        // navbar: гадаргуу түүнийг давсан (surfacing) эсвэл дусал navbar-ыг бүрхсэн үед
        const navIn = Math.hypot(cx - vw / 2, cy - 40) < R;
        lit(surfacing ? line > 70 : invert ? !navIn : navIn);
      };

      const setVis = (v: boolean) => {
        for (const n of [fx.current!, veil.current!, fill.current!]) n.style.visibility = v ? "visible" : "hidden";
      };
      const set = (p: number, dist: number) => {
        q = p;
        const was = on;
        on = q > 0 && q < 1;
        if (on !== was) {
          if (on) {
            // cursor-ын дусал өөрөө томорно: яг түүний байрлал, хэмжээнээс эхэлж, шилжилтийн үед cursor нуугдана
            const tg = target();
            cx = tg.x;
            cy = tg.y;
            const l = origin === "cursor" ? lens() : null;
            r0 = l?.offsetWidth ? l.offsetWidth / 2 : R0;
            last = performance.now();
          }
          if (origin === "cursor") document.documentElement.classList.toggle("reveal-cursor", on);
          // хөвж гарах үед агуулга жижгэрсэн тул эргэн тойрон нь цайвар биш гүн усны өнгө харагдана
          el.style.backgroundColor = on ? "#0a3553" : "";
          setVis(on);
          setFlowing(on);
          if (on) gsap.ticker.add(render);
          else gsap.ticker.remove(render);
        }
        if (!on) {
          // өмнө нь бүрэн нуугдана, дараа нь хэвийн
          el.style.clipPath = q <= 0 ? "circle(0px at 50% 0px)" : "";
          el.style.transform = "";
          inner.style.transform = "";
          lit(q >= 1);
          return;
        }
        // scroll-той нэг кадрт: wrapper-ийг дэлгэцийн дээд ирмэгт барина
        el.style.transform = `translate3d(0, ${(-(1 - q) * dist).toFixed(1)}px, 0)`;
        render();
      };

      measure();
      const st = ScrollTrigger.create({
        trigger: el,
        start: `top ${start * 100}%`,
        end: "top top",
        onUpdate: (self) => set(self.progress, self.end - self.start),
      });
      // transform-тай үед бусад trigger-ийн байрлал буруу хэмжигдэх тул refresh-ийн өмнө арилгаад, дараа нь сэргээнэ
      const before = () => {
        el.style.transform = "";
        inner.style.transform = "";
        measure();
      };
      const after = () => set(st.progress, st.end - st.start);
      ScrollTrigger.addEventListener("refreshInit", before);
      ScrollTrigger.addEventListener("refresh", after);
      after();
      const warm = window.setTimeout(() => !on && setFlowing(false), 1500);

      return () => {
        clearTimeout(warm);
        window.removeEventListener("touchstart", onTouch);
        window.removeEventListener("touchmove", onTouch);
        document.documentElement.classList.remove("reveal-cursor");
        ScrollTrigger.removeEventListener("refreshInit", before);
        ScrollTrigger.removeEventListener("refresh", after);
        gsap.ticker.remove(render);
        st.kill();
        el.style.clipPath = "";
        el.style.transform = "";
        el.style.backgroundColor = "";
        inner.style.transform = "";
      };
    });

    // reduced motion: шилжилтгүй, хэсгийн дээд ирмэг navbar-т хүрэхэд цайвар болно
    mm.add("(prefers-reduced-motion: reduce)", () => {
      const st = ScrollTrigger.create({ trigger: el, start: "top 60px", onEnter: () => lit(true), onLeaveBack: () => lit(false) });
      return () => st.kill();
    });

    return () => mm.revert();
  }, []);

  return (
    <>
      {/* дуслын ирмэг, долгион, усны гадаргуу: дуслын clip-ээс гадуур тул дэлгэцэн дээр тогтсон давхарга */}
      <div ref={fx} aria-hidden className="reveal-fx">
        <svg className="h-full w-full">
          {Array.from({ length: RINGS }, (_, i) => (
            <circle
              key={i}
              ref={(c) => {
                if (c) rings.current[i] = c;
              }}
              className="reveal-ring"
            />
          ))}
          {["reveal-rim reveal-rim--glow", "reveal-rim reveal-rim--soft", "reveal-rim"].map((c, i) => (
            <path
              key={c}
              ref={(p) => {
                if (p) rim.current[i] = p;
              }}
              className={c}
            />
          ))}
          {["reveal-surface reveal-surface--glow", "reveal-surface"].map((c, i) => (
            <path
              key={c}
              ref={(p) => {
                if (p) surf.current[i] = p;
              }}
              className={c}
            />
          ))}
        </svg>
      </div>

      <div
        id={id}
        ref={root}
        // navbar-ын mount үед элемент олдохын тулд атрибутыг эхнээс нь тавина (утгыг effect шинэчилнэ)
        data-nav-light={nav === "light" ? "false" : undefined}
        data-nav-dark={nav === "dark" ? "false" : undefined}
        className={`${className}${pull ? " motion-safe:-mt-[100svh]" : ""}`}
      >
        {/* урсаж хөдлөх хугарал: давтагдах noise хавтанг (stitch) дэлгэц дүүргэж, offset-оор гүйлгэнэ */}
        <svg aria-hidden className="absolute h-0 w-0">
          <filter ref={refract} id={filterId} filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
            <feTurbulence type="fractalNoise" baseFrequency="0.008 0.013" numOctaves={2} seed={7} stitchTiles="stitch" x="0" y="0" width={TILE} height={TILE} />
            <feTile />
            <feOffset ref={flowOffset} dx="0" dy="0" result="flow" />
            <feDisplacementMap ref={disp} in="SourceGraphic" in2="flow" scale="30" xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </svg>
        {/* усны цаанаас харах мэт: өнгө, blur, хугарал, caustic урсгал */}
        <div ref={veil} aria-hidden className="reveal-veil">
          <div ref={flowBox} className="absolute inset-0">
            {surface && caustics && <WaterSurface running={flowing} strength={1.5} speed={2.2} even />}
          </div>
        </div>
        <div ref={fill} aria-hidden className="reveal-drop" />
        <div ref={content}>{children}</div>
      </div>
    </>
  );
}
