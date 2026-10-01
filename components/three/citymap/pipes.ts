import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { PIPES, terrainHeight, type Network } from "./layout";

/**
 * Шугам сүлжээ: хоолой бүр TubeGeometry (булан нь бөөрөнхий), газраас бага зэрэг дээгүүр — гүн нь уншигдахуйц.
 * Атрибут: aD (сүлжээний зай — урсгалын фронт ба импульсийн чиглэл), aKind (0 цэвэр, 1 бохир, 2 цэвэршсэн → гол),
 * aAlong (хоолойн дагуух 0..1 — гаргалгааны фронт).
 */
export const PIPE_Y = 0.042;
const KIND = { clean: 0, sewer: 1, outfall: 2 } as const;

function pathFor(pts: [number, number][], y: (x: number, z: number) => number) {
  const path = new THREE.CurvePath<THREE.Vector3>();
  const v = pts.map(([x, z]) => new THREE.Vector3(x, y(x, z), z));
  const R = 0.05;
  let prev = v[0].clone();
  for (let i = 1; i < v.length; i++) {
    const cur = v[i];
    if (i < v.length - 1) {
      const next = v[i + 1];
      const d0 = cur.clone().sub(v[i - 1]);
      const d1 = next.clone().sub(cur);
      const l0 = d0.length();
      const l1 = d1.length();
      const turn = 1 - d0.dot(d1) / (l0 * l1 || 1);
      if (turn > 0.02 && l0 > 0.02 && l1 > 0.02) {
        const r = Math.min(R, l0 / 2, l1 / 2);
        const a = cur.clone().addScaledVector(d0.normalize(), -r);
        const b = cur.clone().addScaledVector(d1.normalize(), r);
        if (a.distanceTo(prev) > 1e-4) path.add(new THREE.LineCurve3(prev, a));
        path.add(new THREE.QuadraticBezierCurve3(a, cur.clone(), b));
        prev = b;
        continue;
      }
    }
    if (cur.distanceTo(prev) > 1e-4) path.add(new THREE.LineCurve3(prev, cur.clone()));
    prev = cur.clone();
  }
  return path;
}

/** Хоолойн дагуух зай s → сүлжээний зай D (зангилааны утгаас шугаман интерполяц) */
function sampleD(dist: { s: number[]; d: number[] }, s: number) {
  const { s: S, d: D } = dist;
  if (s <= S[0]) return D[0];
  if (s >= S[S.length - 1]) return D[D.length - 1];
  let lo = 0;
  let hi = S.length - 1;
  while (hi - lo > 1) {
    const m = (lo + hi) >> 1;
    if (S[m] <= s) lo = m;
    else hi = m;
  }
  const t = (s - S[lo]) / (S[hi] - S[lo] || 1);
  return D[lo] + (D[hi] - D[lo]) * t;
}

export function pipeGeometry(net: Network, radialSegments: number, radiusScale = 1) {
  const parts: THREE.BufferGeometry[] = [];
  PIPES.forEach((p, i) => {
    const outfall = p.kind === "outfall";
    const y = outfall ? (x: number, z: number) => Math.max(terrainHeight(x, z), -0.035) + 0.03 : () => (p.trunk ? PIPE_Y + 0.008 : PIPE_Y);
    // гаргалгааг эргийн налуугаар дагуулж олон цэгтэй болгоно
    const pts = outfall
      ? Array.from({ length: 9 }, (_, k) => {
          const t = k / 8;
          return [p.pts[0][0] + (p.pts[1][0] - p.pts[0][0]) * t, p.pts[0][1] + (p.pts[1][1] - p.pts[0][1]) * t] as [number, number];
        })
      : p.pts;
    const path = pathFor(pts, y);
    const len = path.getLength();
    const seg = Math.max(4, Math.ceil(len / 0.06));
    const g = new THREE.TubeGeometry(path, seg, p.r * radiusScale, radialSegments, false);
    const uv = g.attributes.uv;
    const n = uv.count;
    const aD = new Float32Array(n);
    const aAlong = new Float32Array(n);
    const dist = net.perPipe.get(i);
    for (let k = 0; k < n; k++) {
      const u = uv.getX(k);
      aAlong[k] = u;
      // TubeGeometry нь өөрийн уртаар жигд — хоолойн анхны цэгүүдийн s-тэй ойролцоо тохирно
      aD[k] = dist ? sampleD(dist, u * dist.len) : 0;
    }
    g.setAttribute("aD", new THREE.BufferAttribute(aD, 1));
    g.setAttribute("aAlong", new THREE.BufferAttribute(aAlong, 1));
    const kind = new Float32Array(n).fill(KIND[p.kind]);
    g.setAttribute("aKind", new THREE.BufferAttribute(kind, 1));
    const trunk = new Float32Array(n).fill(p.trunk ? 1 : 0);
    g.setAttribute("aTrunk", new THREE.BufferAttribute(trunk, 1));
    parts.push(g);
  });
  const merged = mergeGeometries(parts, false)!;
  parts.forEach((g) => g.dispose());
  return merged;
}

/** Холбоос/зангилаа: хоолойн булан, салаа, төгсгөл — instanced богино цилиндр (aD, aKind) */
export function pipeJoints(net: Network) {
  const out: { x: number; y: number; z: number; r: number; d: number; kind: number }[] = [];
  PIPES.forEach((p, i) => {
    if (p.kind === "outfall") return;
    const dist = net.perPipe.get(i);
    let s = 0;
    for (let k = 0; k < p.pts.length; k++) {
      if (k > 0) s += Math.hypot(p.pts[k][0] - p.pts[k - 1][0], p.pts[k][1] - p.pts[k - 1][1]);
      const isEnd = k === 0 || k === p.pts.length - 1;
      let corner = false;
      if (!isEnd) {
        const [ax, az] = p.pts[k - 1];
        const [bx, bz] = p.pts[k];
        const [cx, cz] = p.pts[k + 1];
        // жинхэнэ булан (sin > 0.3 ≈ 17°) — муруй магистралийн завсрын цэгүүд биш
        const cross = Math.abs((bx - ax) * (cz - bz) - (bz - az) * (cx - bx));
        corner = cross > 0.3 * Math.hypot(bx - ax, bz - az) * Math.hypot(cx - bx, cz - bz);
      }
      if (!isEnd && !corner) continue;
      const [x, z] = p.pts[k];
      if (out.some((o) => Math.hypot(o.x - x, o.z - z) < 0.05)) continue;
      out.push({ x, y: p.trunk ? PIPE_Y + 0.008 : PIPE_Y, z, r: p.r * 1.75, d: dist ? sampleD(dist, s) : 0, kind: KIND[p.kind] });
    }
  });
  return out;
}
