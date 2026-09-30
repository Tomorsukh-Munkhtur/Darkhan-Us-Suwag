import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import {
  BUILDING,
  BUSHES,
  CH_DIR,
  CHANNEL,
  G,
  LAMPS,
  OUTLET,
  PLINTH,
  RIVER,
  TANK_L,
  TANK_R,
  type Tank,
} from "./layout";

/**
 * Цэвэрлэх байгууламжийн procedural geometry. Материал бүрт нэг merged geometry (draw call цөөн):
 * body (бетон, металл, байр, бут — гүүр нь vertex shader-т эргэнэ), emissive (цонх, гэрэл, LED),
 * water (хоёр сав, суваг, гол, гаргалгааны урсгал), glow. Бүгд index-гүй, атрибут нь ижил.
 */
type V3 = [number, number, number];

function prep(g: THREE.BufferGeometry, keep: string[] = ["position", "normal"]) {
  const out = g.index ? g.toNonIndexed() : g;
  if (out !== g) g.dispose();
  for (const name of Object.keys(out.attributes)) if (!keep.includes(name)) out.deleteAttribute(name);
  return out;
}

function fill(g: THREE.BufferGeometry, name: string, value: number | readonly number[]) {
  const n = g.attributes.position.count;
  const size = typeof value === "number" ? 1 : value.length;
  const arr = new Float32Array(n * size);
  for (let i = 0; i < n; i++) {
    if (typeof value === "number") arr[i] = value;
    else for (let k = 0; k < size; k++) arr[i * size + k] = value[k];
  }
  g.setAttribute(name, new THREE.BufferAttribute(arr, size));
  return g;
}

const rgb = (hex: string): V3 => {
  const c = new THREE.Color(hex);
  return [c.r, c.g, c.b];
};

/** body shader-ийн гадаргуугийн төрөл */
export const MAT = {
  concrete: 0,
  rim: 1,
  inner: 2,
  floor: 3,
  metal: 4,
  darkMetal: 5,
  grating: 6,
  wall: 7,
  roof: 8,
  foliage: 9,
  pipe: 10,
} as const;

/** Эргэх бүлэг (aSpin): 0 — үгүй, 1 — зүүн савны гүүр, 2 — баруун савны гүүр */
type BodyOpts = { color: string; group: number; base: V3; mat: number; spin?: number };

function body(g: THREE.BufferGeometry, o: BodyOpts, along?: THREE.BufferAttribute) {
  const out = prep(g, along ? ["position", "normal", "uv"] : ["position", "normal"]);
  fill(out, "aColor", rgb(o.color));
  fill(out, "aGroup", o.group);
  fill(out, "aBase", o.base);
  fill(out, "aMat", o.mat);
  fill(out, "aSpin", o.spin ?? 0);
  if (along) {
    // TubeGeometry uv.x — хоолойн дагуух байрлал (0 → 1); 0 нь "хоолой биш" гэсэн утга тул бага зэрэг шилжүүлнэ
    const uv = out.attributes.uv;
    const a = new Float32Array(uv.count);
    for (let i = 0; i < uv.count; i++) a[i] = 0.001 + uv.getX(i) * 0.999;
    out.setAttribute("aAlong", new THREE.BufferAttribute(a, 1));
    out.deleteAttribute("uv");
  } else fill(out, "aAlong", 0);
  return out;
}

/** Орон нутгийн (x — тангенс, z — радиал гадагш) хэсгийг савны хананд φ өнцгөөр байрлуулна */
function onWall(g: THREE.BufferGeometry, t: Tank, phi: number, radius: number) {
  return g.rotateY(Math.PI / 2 - phi).translate(t.x + Math.cos(phi) * radius, 0, t.z + Math.sin(phi) * radius);
}

function tankParts(t: Tank, group: number, parts: THREE.BufferGeometry[], ladderPhi: number, weir: boolean) {
  const rOut = t.r + t.wall;
  const base: V3 = [t.x, 0, t.z];
  const o = (color: string, mat: number) => ({ color, group, base, mat });
  parts.push(body(new THREE.CylinderGeometry(rOut, rOut, t.top, 80, 1, true).translate(t.x, t.top / 2, t.z), o("#6d7780", MAT.concrete)));
  parts.push(body(new THREE.RingGeometry(t.r, rOut, 80, 1).rotateX(-Math.PI / 2).translate(t.x, t.top, t.z), o("#8a949c", MAT.rim)));
  parts.push(body(new THREE.CylinderGeometry(t.r, t.r, t.top - t.floor, 80, 1, true).translate(t.x, (t.top + t.floor) / 2, t.z), o("#56606a", MAT.inner)));
  parts.push(body(new THREE.CircleGeometry(t.r, 80).rotateX(-Math.PI / 2).translate(t.x, t.floor, t.z), o("#2a3138", MAT.floor)));
  // ирмэгийн хашлага: багана + дээд төмөр
  const railR = rOut - 0.012;
  const posts = Math.round(t.r * 30);
  for (let k = 0; k < posts; k++) {
    const a = (k / posts) * Math.PI * 2;
    parts.push(body(new THREE.BoxGeometry(0.008, 0.085, 0.008).translate(t.x + Math.cos(a) * railR, t.top + 0.0425, t.z + Math.sin(a) * railR), o("#aab6c0", MAT.metal)));
  }
  parts.push(body(new THREE.TorusGeometry(railR, 0.004, 4, 120).rotateX(Math.PI / 2).translate(t.x, t.top + 0.085, t.z), o("#aab6c0", MAT.metal)));
  // гадна хананы шат
  const ladder: THREE.BufferGeometry[] = [];
  for (const sx of [-0.028, 0.028]) ladder.push(new THREE.BoxGeometry(0.008, t.top + 0.1, 0.008).translate(sx, (t.top + 0.1) / 2, 0));
  for (let y = 0.03; y < t.top + 0.08; y += 0.04) ladder.push(new THREE.BoxGeometry(0.056, 0.006, 0.006).translate(0, y, 0));
  for (const g of ladder) parts.push(body(onWall(g, t, ladderPhi, rOut + 0.016), o("#9aa6b1", MAT.metal)));
  // баруун сав: хананы дагуух хальх (overflow weir) — цэвэр ус цуглуулах суваг
  if (weir) {
    const wr = t.r - 0.07;
    parts.push(body(new THREE.CylinderGeometry(wr, wr, 0.06, 80, 1, true).translate(t.x, t.level + 0.012, t.z), o("#7b858e", MAT.rim)));
    parts.push(body(new THREE.RingGeometry(wr, wr + 0.012, 80, 1).rotateX(-Math.PI / 2).translate(t.x, t.level + 0.042, t.z), o("#8a949c", MAT.rim)));
  }
}

function pivotParts(t: Tank, group: number, parts: THREE.BufferGeometry[], feedWell: boolean) {
  const base: V3 = [t.x, t.floor, t.z];
  const o = (color: string, mat: number) => ({ color, group, base, mat });
  const h = t.top + 0.12 - t.floor;
  parts.push(body(new THREE.CylinderGeometry(0.05, 0.065, h, 16, 1, true).translate(t.x, t.floor + h / 2, t.z), o("#7d8892", MAT.metal)));
  parts.push(body(new THREE.CylinderGeometry(0.16, 0.16, 0.014, 28).translate(t.x, t.top + 0.115, t.z), o("#5d6872", MAT.grating)));
  parts.push(body(new THREE.CylinderGeometry(0.085, 0.1, 0.07, 20).translate(t.x, t.top + 0.16, t.z), o("#34414d", MAT.darkMetal)));
  parts.push(body(new THREE.CylinderGeometry(0.05, 0.05, 0.03, 16).translate(t.x, t.top + 0.21, t.z), o("#2a6f8f", MAT.darkMetal)));
  parts.push(body(new THREE.TorusGeometry(0.155, 0.004, 4, 40).rotateX(Math.PI / 2).translate(t.x, t.top + 0.2, t.z), o("#aab6c0", MAT.metal)));
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2 + 0.2;
    parts.push(body(new THREE.BoxGeometry(0.007, 0.085, 0.007).translate(t.x + Math.cos(a) * 0.155, t.top + 0.16, t.z + Math.sin(a) * 0.155), o("#aab6c0", MAT.metal)));
  }
  if (feedWell) {
    // төвийн тайвшруулах цилиндр (feed well)
    parts.push(body(new THREE.CylinderGeometry(0.3, 0.3, 0.17, 56, 1, true).translate(t.x, 0.105, t.z), o("#5f6b75", MAT.darkMetal)));
    parts.push(body(new THREE.TorusGeometry(0.3, 0.006, 4, 56).rotateX(Math.PI / 2).translate(t.x, 0.19, t.z), o("#8793a0", MAT.metal)));
  }
}

/** Эргэдэг гүүр-хусуур: орон нутагт +x чиглэлд (төвөөс ирмэг хүртэл), vertex shader өнцгөөр эргүүлнэ */
function armParts(t: Tank, group: number, spin: number, parts: THREE.BufferGeometry[]) {
  const r0 = 0.13;
  const r1 = t.r + 0.02;
  const L = r1 - r0;
  const xm = t.x + (r0 + r1) / 2;
  const y = t.top;
  const base: V3 = [t.x, t.top, t.z];
  const o = (color: string, mat: number) => ({ color, group, base, mat, spin });
  parts.push(body(new THREE.BoxGeometry(L, 0.008, 0.09).translate(xm, y + 0.04, t.z), o("#56626d", MAT.grating)));
  for (const sz of [-0.048, 0.048]) {
    parts.push(body(new THREE.BoxGeometry(L, 0.032, 0.012).translate(xm, y + 0.03, t.z + sz), o("#8c98a3", MAT.metal)));
    parts.push(body(new THREE.BoxGeometry(L, 0.006, 0.006).translate(xm, y + 0.125, t.z + sz), o("#b6c1ca", MAT.metal)));
    for (let x = r0 + 0.04; x < r1; x += 0.16)
      parts.push(body(new THREE.BoxGeometry(0.006, 0.085, 0.006).translate(t.x + x, y + 0.083, t.z + sz), o("#b6c1ca", MAT.metal)));
  }
  // хусуурын ир (усанд хагас живсэн) + өлгүүр
  const bladeX0 = r0 + 0.12;
  const bladeL = r1 - 0.08 - bladeX0;
  const bladeTop = t.level + 0.035;
  parts.push(body(new THREE.BoxGeometry(bladeL, 0.14, 0.008).translate(t.x + bladeX0 + bladeL / 2, bladeTop - 0.07, t.z - 0.07), o("#3f4b56", MAT.darkMetal)));
  for (const x of [bladeX0 + 0.05, bladeX0 + bladeL / 2, bladeX0 + bladeL - 0.05])
    parts.push(body(new THREE.BoxGeometry(0.006, y + 0.03 - bladeTop, 0.006).translate(t.x + x, (y + 0.03 + bladeTop) / 2, t.z - 0.06), o("#8c98a3", MAT.metal)));
  // ирмэг дээрх тэрэг (дугуйтай хөтлүүр) + мотор
  parts.push(body(new THREE.BoxGeometry(0.06, 0.07, 0.13).translate(t.x + t.r + 0.02, y + 0.035, t.z), o("#34414d", MAT.darkMetal)));
  parts.push(body(new THREE.BoxGeometry(0.045, 0.045, 0.06).translate(t.x + t.r - 0.005, y + 0.09, t.z + 0.02), o("#2a6f8f", MAT.darkMetal)));
}

function channelParts(parts: THREE.BufferGeometry[]) {
  const { a, b, half, wall, bottom, top } = CHANNEL;
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const theta = Math.atan2(-CH_DIR[1], CH_DIR[0]);
  const mx = (a[0] + b[0]) / 2;
  const mz = (a[1] + b[1]) / 2;
  const base: V3 = [mx, 0, mz];
  const place = (g: THREE.BufferGeometry) => g.rotateY(theta).translate(mx, 0, mz);
  const o = (color: string, mat: number) => ({ color, group: G.channel, base, mat });
  const W = 2 * (half + wall);
  parts.push(body(place(new THREE.BoxGeometry(L, 0.02, W).translate(0, bottom - 0.01, 0)), o("#6d7780", MAT.concrete)));
  for (const s of [-1, 1])
    parts.push(body(place(new THREE.BoxGeometry(L, top - bottom + 0.02, wall).translate(0, (top + bottom - 0.02) / 2, s * (half + wall / 2))), o("#7a848d", MAT.concrete)));
  parts.push(body(place(new THREE.BoxGeometry(0.08, bottom - 0.02, W).translate(0, (bottom - 0.02) / 2, 0)), o("#5f6973", MAT.concrete)));
  // засвар үйлчилгээний гүүр (сараалжтай), гадна талын хашлага
  const fz = -(half + wall + 0.055);
  parts.push(body(place(new THREE.BoxGeometry(L + 0.16, 0.012, 0.09).translate(0, top + 0.006, fz)), o("#56626d", MAT.grating)));
  parts.push(body(place(new THREE.BoxGeometry(L + 0.16, 0.006, 0.006).translate(0, top + 0.09, fz - 0.042)), o("#b6c1ca", MAT.metal)));
  for (const x of [-(L + 0.16) / 2 + 0.01, 0, (L + 0.16) / 2 - 0.01])
    parts.push(body(place(new THREE.BoxGeometry(0.006, 0.085, 0.006).translate(x, top + 0.047, fz - 0.042)), o("#b6c1ca", MAT.metal)));
  // хаалт (slide gate) — сувгийн эхэнд
  parts.push(body(place(new THREE.BoxGeometry(0.014, 0.1, W + 0.02).translate(-L / 2 + 0.06, top + 0.02, 0)), o("#34414d", MAT.darkMetal)));
  parts.push(body(place(new THREE.TorusGeometry(0.025, 0.004, 4, 16).rotateX(Math.PI / 2).translate(-L / 2 + 0.06, top + 0.085, 0)), o("#3e6f8f", MAT.darkMetal)));
}

/** Гаргалгааны хоолойн зам (урсгалын импульс, flange-ийн байрлалд ашиглана) */
export function outletPath() {
  const { x, y, chamberZ, zRun, bend, xEnd } = OUTLET;
  const path = new THREE.CurvePath<THREE.Vector3>();
  path.add(new THREE.LineCurve3(new THREE.Vector3(x, y, chamberZ + 0.1), new THREE.Vector3(x, y, zRun - bend)));
  path.add(new THREE.QuadraticBezierCurve3(new THREE.Vector3(x, y, zRun - bend), new THREE.Vector3(x, y, zRun), new THREE.Vector3(x + bend, y, zRun)));
  path.add(new THREE.LineCurve3(new THREE.Vector3(x + bend, y, zRun), new THREE.Vector3(xEnd, y, zRun)));
  return path;
}

function outletParts(parts: THREE.BufferGeometry[]) {
  const { x, y, r, chamberZ, zRun, xBank } = OUTLET;
  const base: V3 = [x, 0, chamberZ];
  const o = (color: string, mat: number) => ({ color, group: G.outlet, base, mat });
  // гаргалгааны худаг (бетон) + сараалжин таг
  parts.push(body(new THREE.BoxGeometry(0.22, 0.2, 0.2).translate(x, 0.1, chamberZ), o("#6d7780", MAT.concrete)));
  parts.push(body(new THREE.BoxGeometry(0.18, 0.01, 0.16).translate(x, 0.205, chamberZ), o("#56626d", MAT.grating)));
  // хоолой (TubeGeometry, uv.x → aAlong)
  const path = outletPath();
  const tube = new THREE.TubeGeometry(path, 90, r, 14, false);
  const tubeAlong = tube.attributes.uv as THREE.BufferAttribute;
  parts.push(body(tube, o("#3a4550", MAT.pipe), tubeAlong));
  // flange, тулгуур
  const q = new THREE.Quaternion();
  const zAxis = new THREE.Vector3(0, 0, 1);
  for (const u of [0.02, 0.3, 0.62, 0.88, 0.985]) {
    const p = path.getPointAt(u);
    const tg = path.getTangentAt(u);
    q.setFromUnitVectors(zAxis, tg);
    const fl = new THREE.TorusGeometry(r + 0.006, 0.009, 6, 18).applyQuaternion(q).translate(p.x, p.y, p.z);
    parts.push(body(fl, o("#56636f", MAT.darkMetal)));
  }
  for (const u of [0.16, 0.46, 0.75]) {
    const p = path.getPointAt(u);
    const tg = path.getTangentAt(u);
    const saddle = new THREE.BoxGeometry(0.1, y - r * 0.6, 0.05).rotateY(Math.atan2(tg.x, tg.z)).translate(p.x, (y - r * 0.6) / 2, p.z);
    parts.push(body(saddle, o("#646e78", MAT.concrete)));
  }
  // хаалт (valve): их бие, иш, гар дугуй
  const vp = path.getPointAt(0.1);
  parts.push(body(new THREE.BoxGeometry(0.075, 0.075, 0.06).translate(vp.x, vp.y, vp.z), o("#2f3b46", MAT.darkMetal)));
  parts.push(body(new THREE.CylinderGeometry(0.007, 0.007, 0.07, 6).translate(vp.x, vp.y + 0.07, vp.z), o("#8c98a3", MAT.metal)));
  parts.push(body(new THREE.TorusGeometry(0.03, 0.005, 4, 18).rotateX(Math.PI / 2).translate(vp.x, vp.y + 0.105, vp.z), o("#3e6f8f", MAT.darkMetal)));
  // голын эргийн толгой хана
  const hw = new THREE.BoxGeometry(0.09, 0.14 - RIVER.bed, 0.34).translate(xBank - 0.045, (0.14 + RIVER.bed) / 2, zRun);
  parts.push(body(hw, o("#6d7780", MAT.concrete)));
  // баруун савны дэргэдэх цахилгааны шүүгээ
  parts.push(body(new THREE.BoxGeometry(0.14, 0.17, 0.08).translate(TANK_R.x + 0.62, 0.085, TANK_R.z + 0.8), o("#34414d", MAT.darkMetal)));
}

function buildingParts(parts: THREE.BufferGeometry[]) {
  const { x, z, w, d, h } = BUILDING;
  const base: V3 = [x, 0, z];
  const o = (color: string, mat: number) => ({ color, group: G.building, base, mat });
  parts.push(body(new THREE.BoxGeometry(w, h, d).translate(x, h / 2, z), o("#2d506d", MAT.wall)));
  parts.push(body(new THREE.BoxGeometry(w + 0.04, 0.026, d + 0.04).translate(x, h + 0.013, z), o("#3a4b5a", MAT.roof)));
  // дээврийн хашлага (parapet) — SVG-ийн цайвар цэнхэр зурвас
  for (const s of [-1, 1]) {
    parts.push(body(new THREE.BoxGeometry(w + 0.04, 0.03, 0.014).translate(x, h + 0.04, z + s * (d / 2 + 0.013)), o("#5d8fb3", MAT.rim)));
    parts.push(body(new THREE.BoxGeometry(0.014, 0.03, d + 0.04).translate(x + s * (w / 2 + 0.013), h + 0.04, z), o("#5d8fb3", MAT.rim)));
  }
  parts.push(body(new THREE.BoxGeometry(0.14, 0.06, 0.1).translate(x - 0.12, h + 0.056, z - 0.04), o("#7d8892", MAT.metal)));
  parts.push(body(new THREE.PlaneGeometry(0.08, 0.16).translate(x + 0.18, 0.08, z + d / 2 + 0.002), o("#1c2833", MAT.darkMetal)));
  parts.push(body(new THREE.BoxGeometry(0.16, 0.012, 0.08).translate(x + 0.18, 0.006, z + d / 2 + 0.04), o("#6d7780", MAT.concrete)));
}

export function bodyGeometry() {
  const parts: THREE.BufferGeometry[] = [];
  tankParts(TANK_L, G.tankL, parts, 2.35, false);
  tankParts(TANK_R, G.tankR, parts, 0.95, true);
  pivotParts(TANK_L, G.pivotL, parts, true);
  pivotParts(TANK_R, G.pivotR, parts, false);
  armParts(TANK_L, G.armL, 1, parts);
  armParts(TANK_R, G.armR, 2, parts);
  channelParts(parts);
  outletParts(parts);
  buildingParts(parts);
  for (const l of LAMPS) {
    const o = { color: "#56636f", group: G.lamps, base: [l.x, 0, l.z] as V3, mat: MAT.darkMetal };
    parts.push(body(new THREE.CylinderGeometry(0.008, 0.012, 0.46, 6).translate(l.x, 0.23, l.z), o));
    parts.push(body(new THREE.BoxGeometry(0.05, 0.02, 0.05).translate(l.x, 0.47, l.z), o));
  }
  for (const b of BUSHES) {
    const o = { color: "#2a4d40", group: G.bushes, base: [b.x, 0, b.z] as V3, mat: MAT.foliage };
    parts.push(body(new THREE.IcosahedronGeometry(b.r, 1).scale(1, 0.72, 1).translate(b.x, b.r * 0.55, b.z), o));
    parts.push(body(new THREE.IcosahedronGeometry(b.r * 0.7, 1).scale(1, 0.75, 1).translate(b.x + b.r * 0.7, b.r * 0.4, b.z + b.r * 0.3), { ...o, color: "#325a4b" }));
  }
  return mergeGeometries(parts, false)!;
}

/** Цонх (aMat 0), гэрэл (1), хөтлүүрийн LED (2; гүүртэй хамт эргэнэ) */
export function emissiveGeometry() {
  const parts: THREE.BufferGeometry[] = [];
  const add = (g: THREE.BufferGeometry, color: string, lit: number, group: number, base: V3, mat: number, spin = 0) => {
    const out = prep(g, ["position", "normal", "uv"]);
    fill(out, "aColor", rgb(color));
    fill(out, "aLit", lit);
    fill(out, "aGroup", group);
    fill(out, "aBase", base);
    fill(out, "aMat", mat);
    fill(out, "aSpin", spin);
    parts.push(out);
  };
  const { x, z, w, d, h } = BUILDING;
  const bb: V3 = [x, 0, z];
  for (const dx of [-0.16, 0.0]) add(new THREE.PlaneGeometry(0.12, 0.075).translate(x + dx, h * 0.6, z + d / 2 + 0.003), "#dcefff", 0, G.building, bb, 0);
  add(new THREE.PlaneGeometry(0.14, 0.075).rotateY(Math.PI / 2).translate(x + w / 2 + 0.003, h * 0.6, z), "#dcefff", 0, G.building, bb, 0);
  add(new THREE.PlaneGeometry(0.03, 0.02).translate(x + 0.18, 0.2, z + d / 2 + 0.004), "#fff0cf", 1, G.building, bb, 1);
  for (const l of LAMPS) add(new THREE.BoxGeometry(0.036, 0.008, 0.036).translate(l.x, 0.457, l.z), "#fff3da", 1, G.lamps, [l.x, 0, l.z], 1);
  // хөтлүүрийн LED: төвийн толгой (статик) ба ирмэгийн тэрэг (эргэнэ)
  ([TANK_L, TANK_R] as const).forEach((t, i) => {
    add(new THREE.BoxGeometry(0.02, 0.012, 0.02).translate(t.x, t.top + 0.232, t.z), "#5fe3c8", 2, i === 0 ? G.pivotL : G.pivotR, [t.x, t.floor, t.z], 1);
    add(new THREE.BoxGeometry(0.014, 0.014, 0.014).translate(t.x + t.r - 0.005, t.top + 0.12, t.z + 0.02), "#5fe3c8", 2, i === 0 ? G.armL : G.armR, [t.x, t.top, t.z], 1, i + 1);
  });
  return mergeGeometries(parts, false)!;
}

/** Гэрлийн зөөлөн толбо (additive, камер руу харсан quad) — зөвхөн fx түвшинд */
export function glowGeometry(azimuthDeg: number, elevationDeg: number) {
  const parts: THREE.BufferGeometry[] = [];
  const quad = (size: number, pos: V3, color: string, lit: number) => {
    const g = new THREE.PlaneGeometry(size, size);
    g.rotateX(-THREE.MathUtils.degToRad(elevationDeg));
    g.rotateY(THREE.MathUtils.degToRad(azimuthDeg));
    g.translate(...pos);
    const out = prep(g, ["position", "uv"]);
    fill(out, "aColor", rgb(color));
    fill(out, "aLit", lit);
    parts.push(out);
  };
  for (const l of LAMPS) quad(0.36, [l.x, 0.45, l.z], "#ffe2b0", 1);
  const { x, z, d, h } = BUILDING;
  for (const dx of [-0.16, 0.0]) quad(0.26, [x + dx, h * 0.6, z + d / 2 + 0.02], "#bfe4ff", 0);
  return mergeGeometries(parts, false)!;
}

/** water shader-ийн төрөл */
export const WATER = { tankL: 0, tankR: 1, channel: 2, river: 3, cascade: 4 } as const;

function waterPiece(g: THREE.BufferGeometry, kind: number, along?: (x: number, y: number, z: number) => number, across?: (x: number, y: number, z: number) => number) {
  const out = prep(g, ["position"]);
  fill(out, "aKind", kind);
  const pos = out.attributes.position;
  const a = new Float32Array(pos.count);
  const c = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i++) {
    a[i] = along ? along(pos.getX(i), pos.getY(i), pos.getZ(i)) : 0;
    c[i] = across ? across(pos.getX(i), pos.getY(i), pos.getZ(i)) : 0;
  }
  out.setAttribute("aAlong", new THREE.BufferAttribute(a, 1));
  out.setAttribute("aAcross", new THREE.BufferAttribute(c, 1));
  return out;
}

export function waterGeometry() {
  const parts: THREE.BufferGeometry[] = [];
  // савны гадаргуу (y-ийг shader түвшнээс тавина)
  parts.push(waterPiece(new THREE.CircleGeometry(TANK_L.r - 0.002, 96).rotateX(-Math.PI / 2).translate(TANK_L.x, 0, TANK_L.z), WATER.tankL));
  parts.push(waterPiece(new THREE.CircleGeometry(TANK_R.r - 0.002, 96).rotateX(-Math.PI / 2).translate(TANK_R.x, 0, TANK_R.z), WATER.tankR));

  // суваг: a → b (along), хөндлөн (across)
  {
    const { a, b, half, level } = CHANNEL;
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const theta = Math.atan2(-CH_DIR[1], CH_DIR[0]);
    const g = new THREE.PlaneGeometry(L, half * 2, 12, 1).rotateX(-Math.PI / 2).rotateY(theta).translate((a[0] + b[0]) / 2, level, (a[1] + b[1]) / 2);
    const nx = -CH_DIR[1];
    const nz = CH_DIR[0];
    parts.push(
      waterPiece(
        g,
        WATER.channel,
        (x, _y, z) => ((x - a[0]) * CH_DIR[0] + (z - a[1]) * CH_DIR[1]) / L,
        (x, _y, z) => ((x - a[0]) * nx + (z - a[1]) * nz) / (half * 2) + 0.5,
      ),
    );
  }

  // гол: нуман тууз (талбайн хилээр shader таслана)
  {
    const inner = RIVER.R - RIVER.half - 0.08;
    const outer = RIVER.R + RIVER.half + 0.08;
    const g = new THREE.RingGeometry(inner, outer, 72, 2, Math.PI * 0.98, Math.PI * 0.62).rotateX(Math.PI / 2).translate(RIVER.cx, RIVER.y, RIVER.cz);
    parts.push(waterPiece(g, WATER.river));
  }

  // гаргалгааны хоолойноос гол руу унах урсгал (xy хавтгай дахь тууз, z-ийн дагуу өргөнтэй)
  {
    const { xEnd, y, r, zRun } = OUTLET;
    const pos: number[] = [];
    const al: number[] = [];
    const n = 12;
    const pt = (t: number) => [xEnd + 0.1 * t, y - r * 0.4 - (y - r * 0.4 - RIVER.y) * t * t] as const;
    for (let i = 0; i < n; i++) {
      const [x0, y0] = pt(i / n);
      const [x1, y1] = pt((i + 1) / n);
      const w0 = 0.028;
      const w1 = 0.028 + 0.012 * ((i + 1) / n);
      const quad = [
        [x0, y0, zRun - w0, i / n],
        [x0, y0, zRun + w0, i / n],
        [x1, y1, zRun + w1, (i + 1) / n],
        [x0, y0, zRun - w0, i / n],
        [x1, y1, zRun + w1, (i + 1) / n],
        [x1, y1, zRun - w1, (i + 1) / n],
      ];
      for (const [qx, qy, qz, qa] of quad) {
        pos.push(qx, qy, qz);
        al.push(qa);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    const out = waterPiece(g, WATER.cascade);
    out.setAttribute("aAlong", new THREE.Float32BufferAttribute(al, 1));
    parts.push(out);
  }
  return mergeGeometries(parts, false)!;
}

/** Талбайн суурь (plinth): дээд тал y = 0 */
export function plinthGeometry() {
  const w = PLINTH.x1 - PLINTH.x0;
  const d = PLINTH.z1 - PLINTH.z0;
  return new THREE.BoxGeometry(w, -PLINTH.y0, d, 1, 1, 1).translate((PLINTH.x0 + PLINTH.x1) / 2, PLINTH.y0 / 2, (PLINTH.z0 + PLINTH.z1) / 2);
}
