import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/**
 * Цорго + шилэн аяганы procedural geometry (нэгж ≈ дм). Тавцангийн дээд тал y = 0.
 * Аяга X_GLASS дээр, цорго X_FAUCET дээр босож, хошуу нь аяганы төв дээр доош харна.
 */
export const X_GLASS = 0.62;
export const X_FAUCET = -1.0;

/** Шилэн аяга (tumbler): гадна ёроол r 0.40 → ирмэг r 0.50, өндөр 1.25, хана 0.035, ёроол 0.12 */
export const GLASS = { h: 1.25, base: 0.12, rOut0: 0.4, rOut1: 0.5, rIn0: 0.385, rIn1: 0.465 };

/** Аяганы дотоод радиус өндрөөс хамаарна (конус) — ус, гадаргуу үүгээр хэмжигдэнэ */
export const innerRadius = (y: number) => GLASS.rIn0 + ((GLASS.rIn1 - GLASS.rIn0) * (y - GLASS.base)) / (GLASS.h - GLASS.base);

/** Хошууны доод тал (урсгал эндээс эхэлнэ) */
export const NOZZLE_Y = 2.16;

/** Давхар ханатай битүү lathe: гадна хана → бөөрөнхий ирмэг → дотор хана → ёроолын дээд тал */
export function glassGeometry(segments = 64) {
  const { h, base, rOut0, rOut1, rIn0, rIn1 } = GLASS;
  const pts = [
    [0, 0],
    [rOut0 - 0.02, 0],
    [rOut0, 0.02],
    [rOut1, h - 0.012],
    [rOut1 - 0.006, h + 0.004],
    [rIn1 + 0.012, h + 0.008],
    [rIn1, h - 0.004],
    [rIn0, base + 0.012],
    [rIn0 - 0.02, base],
    [0, base],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const g = new THREE.LatheGeometry(pts, segments);
  g.computeVertexNormals();
  return g;
}

/**
 * Урсгал: хурдасч унах тусам нарийсна (урсгалын тасралтгүй байдал: r ∝ v^-½, v² = v0² + 2gd).
 * uv.y: 0 — доод үзүүр, 1 — хошуу. Аяганы ёроол хүртэл урт; усан доорх хэсгийг shader хаяна.
 */
export function streamGeometry(r0 = 0.04, radial = 18) {
  const top = NOZZLE_Y - 0.004;
  const bottom = GLASS.base;
  const L = top - bottom;
  const n = 36;
  const v0 = 1;
  const g = 2.5;
  const pts: THREE.Vector2[] = [];
  for (let i = n; i >= 0; i--) {
    const d = (i / n) * L;
    const r = r0 * Math.pow((v0 * v0) / (v0 * v0 + 2 * g * d), 0.25);
    pts.push(new THREE.Vector2(r, top - d));
  }
  // доод үзүүрийг хаана (ёроолд хүрэх агшин харагдахгүй ч битүү байх)
  pts.unshift(new THREE.Vector2(0.0001, bottom));
  return new THREE.LatheGeometry(pts, radial);
}

/**
 * Хромон цорго: суурь + их бие + нум хэлбэрийн хошуу (gooseneck) + хошууны хошуувч + бариул.
 * Бүгдийг нэг geometry болгож нэгтгэнэ → нэг draw call.
 */
export function faucetGeometry() {
  const parts: THREE.BufferGeometry[] = [];
  const at = (geo: THREE.BufferGeometry, m: THREE.Matrix4) => parts.push(geo.applyMatrix4(m));
  const T = (x: number, y: number, z: number) => new THREE.Matrix4().makeTranslation(x, y, z);

  // суурь (тавцан дээрх фланц) ба их бие
  at(new THREE.CylinderGeometry(0.15, 0.17, 0.05, 48), T(X_FAUCET, 0.025, 0));
  at(new THREE.CylinderGeometry(0.1, 0.12, 0.08, 48), T(X_FAUCET, 0.09, 0));
  at(new THREE.CylinderGeometry(0.08, 0.085, 1.45, 48), T(X_FAUCET, 0.1 + 0.725, 0));

  // хошуу: их биеийн оройгоос дээш, нуман замаар аяганы төв дээр доош харна
  const spout = new THREE.CubicBezierCurve3(
    new THREE.Vector3(X_FAUCET, 1.5, 0),
    new THREE.Vector3(X_FAUCET, 2.66, 0),
    new THREE.Vector3(X_GLASS, 2.66, 0),
    new THREE.Vector3(X_GLASS, 2.27, 0),
  );
  parts.push(new THREE.TubeGeometry(spout, 96, 0.062, 32, false));
  // үеийн цагираг (их бие ↔ хошуу)
  at(new THREE.CylinderGeometry(0.088, 0.088, 0.05, 48), T(X_FAUCET, 1.52, 0));
  // хошуувч (aerator)
  at(new THREE.CylinderGeometry(0.07, 0.066, 0.11, 48), T(X_GLASS, NOZZLE_Y + 0.055, 0));

  // бариул: хажуугийн тэнхлэг + өргөгдсөн хөшүүрэг
  at(new THREE.CylinderGeometry(0.055, 0.055, 0.07, 32).rotateZ(Math.PI / 2), T(X_FAUCET + 0.1, 1.2, 0));
  at(new THREE.CapsuleGeometry(0.026, 0.3, 8, 16).rotateZ(-0.55), T(X_FAUCET + 0.2, 1.36, 0));

  // mergeGeometries: бүх хэсэг ижил атрибуттай (position, normal, uv), бүгд index-тэй
  const merged = mergeGeometries(parts, false);
  parts.forEach((p) => p.dispose());
  if (!merged) throw new Error("faucet geometry merge failed");
  return merged;
}
