import * as THREE from "three";
import { STAGES, type CameraPreset } from "./stages";

const { degToRad } = THREE.MathUtils;
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

const fits = new Map<string, { distance: number; center: THREE.Vector3 }>();
const dir = new THREE.Vector3();

/**
 * Камерын цорын ганц бичигч (view бүрт ViewRenderer дуудна). Байрлал нь (stage, progress, aspect)-ийн цэвэр функц:
 * scroll-той холбоотой бага зэргийн тойрох (±4°), доош суух (3°), бага зэрэг ойртох (5%).
 * Damping, цаг ашиглахгүй — progress-ийг буцаахад камер яг урвуу явна. Roll, FOV өөрчлөлт үгүй.
 * extraAz/extraEl — зөвхөн ambient үеийн чимэглэл (±1–3°), bounds-ийн MARGIN дотор багтана.
 */
export function poseCamera(cam: THREE.PerspectiveCamera, stage: number, p: number, aspect: number, extraAz = 0, extraEl = 0) {
  const preset = STAGES[stage].camera;
  const key = `${stage}:${aspect.toFixed(3)}:${cam.fov}`;
  let f = fits.get(key);
  if (!f) {
    f = fitDistance(preset, cam.fov, aspect);
    if (fits.size > 64) fits.delete(fits.keys().next().value!);
    fits.set(key, f);
  }
  if (cam.aspect !== aspect) {
    cam.aspect = aspect;
    cam.updateProjectionMatrix();
  }
  const az = preset.azimuth + (p - 0.5) * 8 + extraAz;
  const el = preset.elevation + (1 - p) * 3 + extraEl;
  direction(az, el, dir);
  cam.position.copy(f.center).addScaledVector(dir, f.distance * (1 + (1 - p) * 0.05));
  cam.lookAt(f.center);
  // Матрицыг одоо шинэчилнэ: шошгыг render-ээс өмнө энэ камераар проекцлоно (нэг кадр хоцрохгүй)
  cam.updateMatrixWorld();
}
