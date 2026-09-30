"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { ambientOn, stageProgress, type JourneyRuntime } from "./runtime";
import { STAGES, type CameraPreset } from "./stages";

const { damp, degToRad } = THREE.MathUtils;
/** Фрэймийн ирмэгээс үлдээх зай (1 = яг ирмэгт) */
const MARGIN = 0.9;

/** az/el-ээс target → камер чиглэл */
function direction(azDeg: number, elDeg: number, out: THREE.Vector3) {
  const a = degToRad(azDeg);
  const e = degToRad(elDeg);
  return out.set(Math.sin(a) * Math.cos(e), Math.sin(e), Math.cos(a) * Math.cos(e));
}

/**
 * bounds-ийн 8 орой бүгд харагдах хамгийн бага зай (target = bounds-ийн төв).
 * Камерын орон зайд орой бүрийн x, y-г tan(fov/2)-д багтаана — aspect бүрт зөв (квадрат, өргөн зурвас).
 */
export function fitDistance(preset: CameraPreset, fovDeg: number, aspect: number) {
  const [x0, y0, z0, x1, y1, z1] = preset.bounds;
  const center = new THREE.Vector3((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  const back = direction(preset.azimuth, preset.elevation, new THREE.Vector3());
  const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), back).normalize();
  const up = new THREE.Vector3().crossVectors(back, right);
  const tanV = Math.tan(degToRad(fovDeg) / 2) * MARGIN;
  const tanH = tanV * aspect;
  const v = new THREE.Vector3();
  let d = 0;
  for (const x of [x0, x1])
    for (const y of [y0, y1])
      for (const z of [z0, z1]) {
        v.set(x, y, z).sub(center);
        const depth = v.dot(back);
        d = Math.max(d, depth + Math.abs(v.dot(right)) / tanH, depth + Math.abs(v.dot(up)) / tanV);
      }
  return { distance: d, center };
}

/**
 * Камерын цорын ганц бичигч. Байрлал нь (stage, progress, aspect)-ийн цэвэр функц:
 * scroll-той холбоотой бага зэргийн тойрох (±4°) ба доош суух (3°), бага зэрэг ойртох (5%).
 * Damping, цаг ашиглахгүй — progress-ийг буцаахад камер яг урвуу явна.
 * Хулганы parallax (±3°) нь зөвхөн ambient асаалттай, нарийн заагчтай үед нэмэгдэх чимэглэл.
 */
export default function JourneyCamera({ rt }: { rt: JourneyRuntime }) {
  const gl = useThree((s) => s.gl);
  const fit = useRef({ stage: -1, aspect: 0, distance: 0, center: new THREE.Vector3() });
  const dir = useMemo(() => new THREE.Vector3(), []);
  const pointer = useRef({ x: 0, y: 0, tx: 0, ty: 0, fine: false });

  useEffect(() => {
    pointer.current.fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    if (!pointer.current.fine) return;
    const el = gl.domElement;
    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      pointer.current.tx = ((e.clientX - r.left) / r.width) * 2 - 1;
      pointer.current.ty = ((e.clientY - r.top) / r.height) * 2 - 1;
    };
    const onLeave = () => {
      pointer.current.tx = 0;
      pointer.current.ty = 0;
    };
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", onLeave);
    return () => {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
    };
  }, [gl]);

  useFrame((state, delta) => {
    const cam = state.camera as THREE.PerspectiveCamera;
    const preset = STAGES[rt.stage].camera;
    const aspect = state.size.width / Math.max(state.size.height, 1);

    // зай: үе шат эсвэл харьцаа өөрчлөгдсөн үед л дахин тооцно
    const f = fit.current;
    if (f.stage !== rt.stage || Math.abs(f.aspect - aspect) > 1e-3) {
      const r = fitDistance(preset, cam.fov, aspect);
      f.stage = rt.stage;
      f.aspect = aspect;
      f.distance = r.distance;
      f.center.copy(r.center);
    }

    const p = stageProgress(rt, rt.stage);
    let az = preset.azimuth + (p - 0.5) * 8;
    let el = preset.elevation + (1 - p) * 3;
    const dist = f.distance * (1 + (1 - p) * 0.05);

    // чимэглэл: хулганы parallax (scene-ийн төлөвийн нэг хэсэг биш)
    const ptr = pointer.current;
    if (ambientOn(rt) && ptr.fine) {
      const dt = Math.min(delta, 1 / 20);
      ptr.x = damp(ptr.x, ptr.tx, 2.5, dt);
      ptr.y = damp(ptr.y, ptr.ty, 2.5, dt);
      az += ptr.x * 3;
      el += ptr.y * 1.8;
    } else {
      ptr.x = 0;
      ptr.y = 0;
    }

    direction(az, el, dir);
    cam.position.copy(f.center).addScaledVector(dir, dist);
    cam.lookAt(f.center);
    // Матрицыг одоо шинэчилнэ: renderer render хийхдээ л шинэчилдэг тул үгүй бол LabelProjector
    // (энэ кадрт, render-ээс өмнө) өмнөх кадрын камераар проекцлоно → demand горимд шошго нэг алхам хоцорно.
    cam.updateMatrixWorld();
  });

  return null;
}
