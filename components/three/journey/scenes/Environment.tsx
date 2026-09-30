"use client";

import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { JourneyRuntime } from "../runtime";
import { TIERS } from "../quality";
import { STAGES } from "../stages";
import { createBackdropMaterial, createFloorMaterial } from "../materials/fx";
import { useDisposable } from "../utils/useDisposable";

/** Бүтэн дэлгэцийн градиент дэвсгэр (хамгийн түрүүнд зурагдана, depth бичихгүй) */
export function Backdrop() {
  const mat = useDisposable(createBackdropMaterial, []);
  return (
    <mesh frustumCulled={false} renderOrder={-1000} material={mat}>
      <planeGeometry args={[2, 2]} />
    </mesh>
  );
}

/** Гэрэл: зөөлөн тэнгэр/газар + гол гэрэл + ардаас цэнхэр хүрээ гэрэл. Бодит цагийн сүүдэр ашиглахгүй. */
export function Lights() {
  return (
    <>
      <hemisphereLight args={["#cfeeff", "#0a2238", 1.3]} />
      <directionalLight position={[3.5, 6, 5]} intensity={2.2} color="#f2f9ff" />
      <directionalLight position={[-5, 2.5, -4]} intensity={1.1} color="#38b6f0" />
    </>
  );
}

/**
 * Үе шат бүрт ижил тавцан: техникийн цагираг + зөөлөн гэрэл (LOW-д шугамгүй).
 * Өндрийг view бүрт ViewRenderer тухайн хавтангийн ёроолд тааруулна (rt.floor).
 */
export function StageFloor({ rt }: { rt: JourneyRuntime }) {
  const mat = useDisposable(createFloorMaterial, []);
  const ref = useRef<THREE.Mesh>(null);
  useEffect(() => {
    rt.floor = ref.current;
    return () => {
      if (rt.floor === ref.current) rt.floor = null;
    };
  }, [rt]);
  useFrame(() => {
    mat.uniforms.uLines.value = TIERS[rt.tier].fx ? 1 : 0;
  });
  return (
    <mesh ref={ref} rotation-x={-Math.PI / 2} position-y={STAGES[0].floorY} material={mat} renderOrder={-1}>
      <circleGeometry args={[4.8, 96]} />
    </mesh>
  );
}
