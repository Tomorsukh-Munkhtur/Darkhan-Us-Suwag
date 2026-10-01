"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { ambientOn, stageProgress, type JourneyRuntime } from "./runtime";
import { STAGES } from "./stages";
import { poseCamera } from "./JourneyCamera";
import { hideUnseenLabels, projectLabels } from "./JourneyLabels";
import { createViewMaskMaterial } from "./materials/fx";
import { useDisposable } from "./utils/useDisposable";

const { damp } = THREE.MathUtils;

/**
 * Нэг canvas / нэг WebGL context-оор олон view зурна (useFrame priority 1 — R3F-ийн автомат render-ийг орлоно).
 * View бүрт: scissor → зөвхөн тухайн үе шатын group → тавцангийн өндөр → камер (stage, progress, aspect) →
 * render → шошго → mask (хөрш картын бүдэгрэлт + картын бөөрөнхий булан). View-ээс гадна canvas тунгалаг.
 *
 * Production: харагдаж буй карт бүр (идэвхтэй + цухуйж буй хөрш) өөрийн 3D-г авна — зургийн хэсэгт хуучин SVG харагдахгүй.
 * Лаб: нэг view бүтэн canvas-д.
 */
export default function ViewRenderer({ rt, onRendered }: { rt: JourneyRuntime; onRendered: () => void }) {
  const mask = useDisposable(createViewMaskMaterial, []);
  const quad = useDisposable(() => new THREE.PlaneGeometry(2, 2), []);
  const maskScene = useMemo(() => {
    const s = new THREE.Scene();
    const m = new THREE.Mesh(quad, mask);
    m.frustumCulled = false;
    s.add(m);
    return s;
  }, [quad, mask]);
  const seen = useMemo(() => new Set<string>(), []);
  const done = useRef(false);
  const cb = useRef(onRendered);
  useEffect(() => {
    cb.current = onRendered;
  });

  // чимэглэл: хулганы parallax (нарийн заагч, ambient үед л) — scene-ийн төлөвт нөлөөлөхгүй
  const ptr = useRef({ x: 0, y: 0, tx: 0, ty: 0 });
  useEffect(() => {
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    const onMove = (e: PointerEvent) => {
      ptr.current.tx = (e.clientX / window.innerWidth) * 2 - 1;
      ptr.current.ty = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  useFrame((state, delta) => {
    const { gl, scene, size } = state;
    const cam = state.camera as THREE.PerspectiveCamera;
    const dpr = gl.getPixelRatio();
    gl.autoClear = false;
    gl.info.autoReset = false;
    gl.info.reset();
    gl.setScissorTest(false);
    gl.setViewport(0, 0, size.width, size.height);
    gl.clear(true, true, true);

    // чимэглэлийн "амьсгал" ба parallax (ambient асаалттай үед л, ±1–3°)
    let extraAz = 0;
    let extraEl = 0;
    const p0 = ptr.current;
    if (ambientOn(rt)) {
      const dt = Math.min(delta, 1 / 20);
      p0.x = damp(p0.x, p0.tx, 2.5, dt);
      p0.y = damp(p0.y, p0.ty, 2.5, dt);
      extraAz = Math.sin(rt.ambientTime * 0.35) * 1 + p0.x * 2.5;
      extraEl = Math.sin(rt.ambientTime * 0.23) * 0.5 + p0.y * 1.5;
    } else {
      p0.x = p0.y = 0;
    }

    seen.clear();
    let drawn = 0;
    for (const view of rt.views) {
      const r = view.rect ?? { x: 0, y: 0, w: size.width, h: size.height };
      const clip = {
        x0: Math.max(0, r.x),
        y0: Math.max(0, r.y),
        x1: Math.min(size.width, r.x + r.w),
        y1: Math.min(size.height, r.y + r.h),
      };
      if (clip.x1 - clip.x0 < 1 || clip.y1 - clip.y0 < 1 || view.opacity <= 0.01 || r.w < 2 || r.h < 2) continue;
      const p = stageProgress(rt, view.stage);

      // viewport — бүтэн view (хэсэгчлэн харагдаж байсан ч камерын харьцаа хэвээр), scissor — харагдах хэсэг
      const vy = size.height - r.y - r.h;
      gl.setViewport(r.x, vy, r.w, r.h);
      gl.setScissor(clip.x0, size.height - clip.y1, clip.x1 - clip.x0, clip.y1 - clip.y0);
      gl.setScissorTest(true);
      gl.clear(false, true, false);

      for (let k = 0; k < rt.roots.length; k++) {
        const g = rt.roots[k];
        if (g) g.visible = k === view.stage && p > 0.001;
      }
      if (rt.floor) rt.floor.position.y = STAGES[view.stage].floorY;
      poseCamera(cam, view.stage, p, r.w / r.h, extraAz, extraEl);
      gl.render(scene, cam);
      projectLabels(rt, cam, view, r, clip, p, seen);

      if (view.opacity < 0.999 || view.radius > 0) {
        const u = mask.uniforms;
        u.uOrigin.value.set(r.x * dpr, vy * dpr);
        u.uSize.value.set(r.w * dpr, r.h * dpr);
        u.uRadius.value = view.radius * dpr;
        u.uCorners.value.set(+view.corners[0], +view.corners[1], +view.corners[2], +view.corners[3]);
        u.uOpacity.value = view.opacity;
        gl.render(maskScene, cam);
      }
      drawn++;
    }
    gl.setScissorTest(false);
    hideUnseenLabels(rt, seen);

    if (drawn > 0 && !done.current) {
      done.current = true;
      cb.current();
    }
  }, 1);

  return null;
}
