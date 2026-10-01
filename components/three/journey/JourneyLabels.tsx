"use client";

import * as THREE from "three";
import type { JourneyRuntime, JourneyView } from "./runtime";
import { LABELS, type StageLabel } from "./stages";
import { seg } from "./utils/ease";

/**
 * 3D цэгт наалдсан DOM шошго (Ubuntu фонт, тод үсэг). Canvas-ийн дээр pointer-events-гүй давхарга.
 * Байрлал, хэмжээний ангиллыг projectLabels кадр бүр бичнэ — React re-render хийхгүй.
 * Хэмжээ нь тухайн view-ийн өргөнөөс (data-size: sm < 360px ≤ md < 520px ≤ lg), canvas-ийнхаас биш.
 * Картын текст контент хэвээр тул шошго нь aria-hidden (давхардуулахгүй).
 */
export function JourneyLabelLayer({ rt }: { rt: JourneyRuntime }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {LABELS.map((l) => (
        <div
          key={l.id}
          ref={(el) => {
            if (el) rt.labelEls.set(l.id, el);
            else rt.labelEls.delete(l.id);
          }}
          data-size="lg"
          className={`group absolute left-0 top-0 will-change-transform ${l.minor ? "data-[size=sm]:hidden" : ""}`}
          style={{ visibility: "hidden", opacity: 0 }}
        >
          <LabelBody l={l} />
        </div>
      ))}
    </div>
  );
}

function LabelBody({ l }: { l: StageLabel }) {
  if (l.variant === "metric") {
    return (
      <div className="-translate-x-1/2 -translate-y-full pb-2 text-center">
        <p
          data-text
          className="font-display text-2xl font-bold leading-none text-abyss drop-shadow-[0_2px_12px_rgba(4,26,46,.95)] group-data-[size=lg]:text-[2rem] group-data-[size=md]:text-[2rem]"
        >
          {l.text}
        </p>
        {l.caption && <p className="mt-1 text-[9px] font-medium uppercase tracking-[0.35em] text-mist">{l.caption}</p>}
      </div>
    );
  }
  if (l.variant === "step") {
    return (
      <div className="flex -translate-x-1/2 -translate-y-full flex-col items-center">
        <span className="flex items-center gap-1.5 whitespace-nowrap rounded-full border border-water/30 bg-foam/75 px-1.5 py-0.5 text-[10px] backdrop-blur-sm group-data-[size=lg]:px-2.5">
          <span className="font-display font-semibold text-water">{l.index}</span>
          <span data-text className="hidden text-abyss group-data-[size=lg]:inline">
            {l.text}
          </span>
        </span>
        <span className="h-2.5 w-px bg-water/50" />
        <span className="h-1 w-1 rounded-full bg-aqua" />
      </div>
    );
  }
  return (
    <div className="flex -translate-x-1/2 -translate-y-full flex-col items-center">
      <span
        data-text
        className="whitespace-nowrap rounded-full border border-water/30 bg-foam/75 px-2.5 py-1 font-display text-[9px] font-medium uppercase tracking-[0.22em] text-abyss backdrop-blur-sm group-data-[size=lg]:text-[10px] group-data-[size=md]:text-[10px]"
      >
        {l.text}
      </span>
      <span className="h-3 w-px bg-water/50" />
      <span className="h-1 w-1 rounded-full bg-aqua shadow-[0_0_6px_var(--color-aqua)]" />
    </div>
  );
}

const v = new THREE.Vector3();
/** Шошгын хэмжээ (px) — зөвхөн хэмжээний ангилал солигдох үед хэмжинэ (layout унших нь ховор) */
const sizes = new WeakMap<HTMLElement, { size: string; w: number; h: number }>();
const sizeClass = (w: number) => (w < 360 ? "sm" : w < 520 ? "md" : "lg");

/**
 * Нэг view-ийн шошгуудыг байрлуулна (ViewRenderer дуудна; камер тухайн view-д тохируулагдсан байх ёстой).
 * clip — canvas доторх харагдах хэсэг: шошго бүхэлдээ багтахгүй бол нууна (картаас хальж гарахгүй).
 * Харагдсан шошгын id-г seen-д нэмнэ; бусдыг hideUnseenLabels нууна.
 */
export function projectLabels(
  rt: JourneyRuntime,
  cam: THREE.Camera,
  view: JourneyView,
  rect: { x: number; y: number; w: number; h: number },
  clip: { x0: number; y0: number; x1: number; y1: number },
  p: number,
  seen: Set<string>,
) {
  const fade = seg(view.opacity, 0.6, 0.95);
  const size = sizeClass(rect.w);
  for (const l of LABELS) {
    if (l.stage !== view.stage) continue;
    const el = rt.labelEls.get(l.id);
    if (!el) continue;
    const o = seg(p, 0.6, 0.95) * fade;
    if (o <= 0.01) continue;
    if (el.dataset.size !== size) el.dataset.size = size;
    if (l.minor && size === "sm") continue;
    let m = sizes.get(el);
    if (!m || m.size !== size) {
      const first = el.firstElementChild as HTMLElement | null;
      m = { size, w: first?.offsetWidth ?? 0, h: first?.offsetHeight ?? 0 };
      sizes.set(el, m);
    }
    v.set(l.anchor[0], l.anchor[1], l.anchor[2]).project(cam);
    let x = rect.x + ((v.x + 1) / 2) * rect.w;
    let y = rect.y + ((1 - v.y) / 2) * rect.h;
    // Тоон шошго (86%) заагчгүй тул view дотор шахна (жижиг утасны зурваст ч харагдана)
    if (l.variant === "metric") {
      if (m.w + 4 > clip.x1 - clip.x0 || m.h + 4 > clip.y1 - clip.y0) continue;
      x = Math.min(Math.max(x, clip.x0 + m.w / 2 + 2), clip.x1 - m.w / 2 - 2);
      y = Math.min(Math.max(y, clip.y0 + m.h + 2), clip.y1 - 2);
    }
    // бусад шошго цэгийн дээр төвлөрнө (translate(-50%, -100%)); бүхэлдээ багтахгүй бол нууна
    if (x - m.w / 2 < clip.x0 + 2 || x + m.w / 2 > clip.x1 - 2 || y - m.h < clip.y0 + 2 || y > clip.y1 - 2) continue;
    el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
    el.style.opacity = o.toFixed(2);
    if (!el.dataset.on) {
      el.style.visibility = "visible";
      el.dataset.on = "1";
    }
    seen.add(l.id);
  }
}

export function hideUnseenLabels(rt: JourneyRuntime, seen: Set<string>) {
  for (const [id, el] of rt.labelEls) {
    if (seen.has(id) || !el.dataset.on) continue;
    el.style.visibility = "hidden";
    delete el.dataset.on;
  }
}
