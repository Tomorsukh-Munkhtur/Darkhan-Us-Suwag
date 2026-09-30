"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { ambientPhase, stageProgress, type JourneyRuntime } from "../runtime";
import { TIERS, type TierSettings } from "../quality";
import { C } from "../materials/palette";
import { easeOutCubic, lerp, seg } from "../utils/ease";
import { rectOutline } from "../utils/geometry";
import { useDisposable } from "../utils/useDisposable";

export type SceneProps = { rt: JourneyRuntime; index: number };

/**
 * Үе шат идэвхтэй, progress > 0 үед л ажиллах useFrame.
 * p — progress (0–1): харагдах БҮХ төлөв үүнээс тооцогдоно (цаг ашиглахгүй).
 * amb — чимэглэлийн ambient фаз (сек); унтраалттай үед 0 → тухайн p-д кадр үргэлж ижил.
 * Callback дотор хуримтлагдах төлөв (dt, өмнөх кадр) ашиглахгүй — p-г буцаахад урвуу явна.
 */
export function useStageFrame(rt: JourneyRuntime, index: number, cb: (p: number, amb: number, tier: TierSettings) => void) {
  useFrame(() => {
    const p = stageProgress(rt, index);
    if (p <= 0.001) return;
    cb(p, ambientPhase(rt), TIERS[rt.tier]);
  });
}

/** Урсгал, долгионы фаз: progress-оор урагшилна (scroll хийхэд ус урсана) + сонголтоор ambient */
export const phase = (p: number, amb: number, perProgress: number, perSecond = 1) => p * perProgress + amb * perSecond;

/** Түвшний бөөмийн тоо (дор хаяж 1) */
export const particleCount = (base: number, tier: TierSettings) => Math.max(1, Math.round(base * tier.particles));

/**
 * Үе шатын үндэс: progress-ийн эхний 40%-д хавтан доороос өргөгдөн томорно.
 * Буцаахад (p → 0) урвуугаар живж алга болно. p ≈ 0 эсвэл идэвхгүй үед бүхэлдээ нуугдана (draw call 0).
 * rt.roots-д бүртгүүлнэ → олон view-тэй үед ViewRenderer view бүрт зөвхөн тухайн үе шатыг харуулна.
 */
export function RevealRoot({ rt, index, children }: SceneProps & { children: ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  useEffect(() => {
    rt.roots[index] = ref.current;
    return () => {
      if (rt.roots[index] === ref.current) rt.roots[index] = null;
    };
  }, [rt, index]);
  useFrame(() => {
    const g = ref.current;
    if (!g) return;
    const r = stageProgress(rt, index);
    g.visible = r > 0.001;
    if (!g.visible) return;
    const e = easeOutCubic(seg(r, 0, 0.4));
    g.position.y = lerp(-0.7, 0, e);
    g.scale.setScalar(lerp(0.78, 1, e));
  });
  return (
    <group ref={ref} visible={false}>
      {children}
    </group>
  );
}

export type Layer = { h: number; color?: string; material?: THREE.Material; roughness?: number };

/**
 * Диорамын хавтан: дээрээс доош давхарга (дээд тал y=0). Урд талын огтлол нь хөрсний давхарга харуулна.
 * Дээд, доод ирмэгт нарийн цэнхэр техникийн хүрээ.
 */
export function Strata({ width, depth, layers }: { width: number; depth: number; layers: Layer[] }) {
  const outline = useDisposable(() => rectOutline(width, depth), [width, depth]);
  let y = 0;
  const boxes = layers.map((l) => {
    const cy = y - l.h / 2;
    y -= l.h;
    return { ...l, cy };
  });
  return (
    <group>
      {boxes.map((l, i) => (
        <mesh key={i} position={[0, l.cy, 0]} material={l.material}>
          <boxGeometry args={[width, l.h, depth]} />
          {!l.material && <meshStandardMaterial color={l.color} roughness={l.roughness ?? 0.92} />}
        </mesh>
      ))}
      <lineLoop geometry={outline} position={[0, 0.003, 0]}>
        <lineBasicMaterial color={C.aqua} transparent opacity={0.55} />
      </lineLoop>
      <lineLoop geometry={outline} position={[0, y, 0]}>
        <lineBasicMaterial color={C.water} transparent opacity={0.3} />
      </lineLoop>
    </group>
  );
}

/** Хавтгай бус хэрэглээний хавтан (усан сан, хот, гэр): нимгэн гадаргуу + техникийн шугамтай суурь */
export function Plinth({ width, depth, top = C.plate }: { width: number; depth: number; top?: string }) {
  return (
    <Strata
      width={width}
      depth={depth}
      layers={[
        { h: 0.08, color: top, roughness: 0.85 },
        { h: 0.04, color: "#1f6b9e", roughness: 0.6 },
        { h: 0.4, color: C.foundation },
      ]}
    />
  );
}
