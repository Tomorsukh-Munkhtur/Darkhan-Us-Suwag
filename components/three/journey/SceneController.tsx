"use client";

import { useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import type * as THREE from "three";
import { ambientOn, type JourneyRuntime } from "./runtime";

/**
 * Canvas-ийн хамгийн эхэнд mount хийнэ:
 * 1) driver.set() дуудагдахад кадр хүсэх (demand горим) invalidate-ийг runtime-д холбоно;
 * 2) бүх үе шатын shader-ийг урьдчилан compile хийнэ → идэвхтэй карт солигдоход гацахгүй;
 * 3) чимэглэлийн ambient цагийг зөвхөн зөвшөөрөгдсөн үед урагшлуулна (scene-ийн төлөвт нөлөөлөхгүй).
 *
 * Үе шат, progress-ийг энд өөрчлөхгүй — тэдгээрийг зөвхөн хост (driver.set) бичнэ.
 */
export default function SceneController({ rt, running }: { rt: JourneyRuntime; running: boolean }) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const invalidate = useThree((s) => s.invalidate);

  useEffect(() => {
    rt.invalidate = () => invalidate();
    return () => {
      rt.invalidate = () => {};
    };
  }, [rt, invalidate]);

  useEffect(() => {
    const hidden: THREE.Object3D[] = [];
    scene.traverse((o) => {
      if (!o.visible) {
        hidden.push(o);
        o.visible = true;
      }
    });
    gl.compile(scene, camera);
    hidden.forEach((o) => (o.visible = false));
    invalidate(3);
  }, [gl, scene, camera, invalidate]);

  // "never" → "demand" болоход сүүлийн төлөвийг дахин зурна
  useEffect(() => {
    if (running) invalidate(2);
  }, [running, invalidate]);

  useFrame((_, delta) => {
    if (ambientOn(rt)) rt.ambientTime += Math.min(delta, 1 / 20);
  });

  return null;
}
