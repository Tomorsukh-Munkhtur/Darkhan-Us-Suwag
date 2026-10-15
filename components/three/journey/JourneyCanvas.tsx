"use client";

import { memo, useCallback, useEffect, useRef, type ReactNode, type RefObject } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import type { JourneyDriver, JourneyStats } from "./runtime";
import { contextCounter } from "./diagnostics";
import SceneController from "./SceneController";
import ViewRenderer from "./ViewRenderer";
import { JourneyLabelLayer } from "./JourneyLabels";
import { Backdrop, Lights, StageFloor } from "./scenes/Environment";

export type JourneyScene3DProps = {
  driver: JourneyDriver;
  /** false — дэлгэцэнд байхгүй / зохицуулагч зөвшөөрөөгүй: render loop бүрэн зогсоно */
  running: boolean;
  /** true — ambient асаалттай: кадр бүр зурна; false — зөвхөн driver.set()/resize үед (demand) */
  continuous: boolean;
  dpr: number;
  /** Зөвхөн context үүсэх үед хэрэглэгдэнэ */
  antialias: boolean;
  onReady: () => void;
  onFail: () => void;
  onStats?: (s: JourneyStats) => void;
};

type Callbacks = Pick<JourneyScene3DProps, "onReady" | "onFail" | "onStats">;

/**
 * Аяллын (Усны аялал, Бохир ус …) бүх үе шатын НЭГ canvas / НЭГ WebGL context. Үе шатын scene-үүд нь children
 * (index-ээр driver.rt.stages-тэй таарна). Бүх scene нэг удаа mount хийгдэж
 * (shader урьдчилан compile), ViewRenderer driver.rt.views-ийн view бүрт тухайн үе шатыг зурна.
 * View, progress өөрчлөгдөхөд React re-render хийгдэхгүй — scene-үүд кадр бүр runtime-аас уншина.
 * Canvas тунгалаг (view-ээс гадна), pointer-events-гүй → touch scroll, картын холбоосыг хаахгүй.
 */
function JourneyCanvas({
  driver,
  running,
  continuous,
  dpr,
  antialias,
  onReady,
  onFail,
  onStats,
  children,
}: JourneyScene3DProps & { children: ReactNode }) {
  const rt = driver.rt;
  const cbs = useRef<Callbacks>({ onReady, onFail, onStats });
  useEffect(() => {
    cbs.current = { onReady, onFail, onStats };
  });
  // view бүхий эхний кадр зурагдсаны дараа → fallback SVG-г нууж болно
  const handleRendered = useCallback(() => cbs.current.onReady(), []);

  return (
    <div className="absolute inset-0">
      <Canvas
        dpr={[1, dpr]}
        flat
        frameloop={!running ? "never" : continuous ? "always" : "demand"}
        gl={{ antialias, alpha: true, premultipliedAlpha: true, powerPreference: "high-performance" }}
        camera={{ fov: 30, near: 0.1, far: 80, position: [4, 3, 10] }}
        onCreated={({ gl }) => {
          contextCounter.created++;
          gl.setClearColor(0x000000, 0);
          gl.domElement.addEventListener("webglcontextlost", (e) => {
            e.preventDefault();
            contextCounter.lost++;
            cbs.current.onFail();
          });
        }}
        style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
      >
        <SceneController rt={rt} running={running} />
        <Backdrop />
        <Lights />
        <StageFloor rt={rt} />
        {/* толин тусгал: сөрөг масштабтай үед three.js нүүрний чиглэлийг өөрөө засна */}
        {rt.mirror ? <group scale={[-1, 1, 1]}>{children}</group> : children}
        <FrameProbe cbs={cbs} />
        <ViewRenderer rt={rt} onRendered={handleRendered} />
      </Canvas>
      <JourneyLabelLayer rt={rt} />
    </div>
  );
}

/** Лабын оношилгоо: FPS, draw call, triangle (өмнөх кадрын бүх view-ийн нийлбэр), нийт кадр */
function FrameProbe({ cbs }: { cbs: RefObject<Callbacks> }) {
  const frames = useRef(0);
  const acc = useRef({ t: 0, n: 0, last: 0 });
  useFrame(({ gl }, delta) => {
    frames.current++;
    const report = cbs.current.onStats;
    if (!report) return;
    const a = acc.current;
    a.t += Math.min(delta, 0.25);
    a.n++;
    const now = performance.now();
    if (now - a.last >= 500) {
      a.last = now;
      report({
        fps: a.n / Math.max(a.t, 1e-3),
        calls: gl.info.render.calls,
        triangles: gl.info.render.triangles,
        dpr: gl.getPixelRatio(),
        frames: frames.current,
      });
      a.t = 0;
      a.n = 0;
    }
  });
  return null;
}

export default memo(JourneyCanvas);
