import { useEffect, useState } from "react";
import { MQ_MOTION_REDUCED } from "@/lib/motion";

/** three.js r163+ зөвхөн WebGL2 дэмждэг. Туршилтын context-ыг шууд чөлөөлнө. */
export function hasWebGL2() {
  try {
    const gl = document.createElement("canvas").getContext("webgl2");
    if (!gl) return false;
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return true;
  } catch {
    return false;
  }
}

/** prefers-reduced-motion; SSR болон анхны render-т false */
export function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(MQ_MOTION_REDUCED);
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return reduced;
}
