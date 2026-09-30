"use client";

import { useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { stageProgress, type JourneyRuntime } from "./runtime";
import { LABELS, type StageLabel } from "./stages";
import { seg } from "./utils/ease";

/**
 * 3D цэгт наалдсан DOM шошго (Ubuntu фонт, тод үсэг). Canvas-ийн дээр pointer-events-гүй давхарга.
 * Байрлалыг LabelProjector кадр бүр transform-оор бичнэ — React re-render хийхгүй.
 * Картын текст контент хэвээр тул шошго нь aria-hidden (давхардуулахгүй).
 */
export function JourneyLabelLayer({ rt }: { rt: JourneyRuntime }) {
  return (
    <div aria-hidden className="@container pointer-events-none absolute inset-0 overflow-hidden">
      {LABELS.map((l) => (
        <div
          key={l.id}
          ref={(el) => {
            if (el) rt.labelEls.set(l.id, el);
            else rt.labelEls.delete(l.id);
          }}
          className={`absolute left-0 top-0 will-change-transform ${l.minor ? "hidden @min-[360px]:block" : ""}`}
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
          className="font-display text-2xl font-bold leading-none text-abyss drop-shadow-[0_2px_12px_rgba(4,26,46,.95)] @min-[360px]:text-[2rem]"
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
        <span className="flex items-center gap-1.5 whitespace-nowrap rounded-full border border-water/30 bg-foam/75 px-1.5 py-0.5 text-[10px] backdrop-blur-sm @min-[520px]:px-2.5">
          <span className="font-display font-semibold text-water">{l.index}</span>
          <span data-text className="hidden text-abyss @min-[520px]:inline">
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
        className="whitespace-nowrap rounded-full border border-water/30 bg-foam/75 px-2.5 py-1 font-display text-[9px] font-medium uppercase tracking-[0.22em] text-abyss backdrop-blur-sm @min-[420px]:text-[10px]"
      >
        {l.text}
      </span>
      <span className="h-3 w-px bg-water/50" />
      <span className="h-1 w-1 rounded-full bg-aqua shadow-[0_0_6px_var(--color-aqua)]" />
    </div>
  );
}

/** Canvas дотор: идэвхтэй шошгын 3D цэгийг дэлгэцийн координат руу проекцлоод DOM-д бичнэ */
export function LabelProjector({ rt }: { rt: JourneyRuntime }) {
  const v = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ camera, size }) => {
    for (const l of LABELS) {
      const el = rt.labelEls.get(l.id);
      if (!el) continue;
      const o = seg(stageProgress(rt, l.stage), 0.6, 0.95);
      if (o <= 0) {
        if (el.dataset.on) {
          el.style.visibility = "hidden";
          delete el.dataset.on;
        }
        continue;
      }
      v.set(l.anchor[0], l.anchor[1], l.anchor[2]).project(camera);
      const x = ((v.x + 1) / 2) * size.width;
      const y = ((1 - v.y) / 2) * size.height;
      el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
      el.style.opacity = o.toFixed(2);
      if (!el.dataset.on) {
        el.style.visibility = "visible";
        el.dataset.on = "1";
      }
    }
  });
  return null;
}
