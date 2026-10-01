import * as THREE from "three";

/** XZ хавтгайд муруйг дагасан хавтгай тууз (гол). uv.x — муруйн дагуу 0→1, uv.y — хөндлөн 0→1. */
export function ribbonGeometry(curve: THREE.Curve<THREE.Vector3>, width: number, segments = 96) {
  const pos = new Float32Array((segments + 1) * 6);
  const uv = new Float32Array((segments + 1) * 4);
  const index: number[] = [];
  const p = new THREE.Vector3();
  const t = new THREE.Vector3();
  const side = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i <= segments; i++) {
    const u = i / segments;
    curve.getPointAt(u, p);
    curve.getTangentAt(u, t);
    side.crossVectors(up, t).normalize().multiplyScalar(width / 2);
    pos.set([p.x - side.x, p.y, p.z - side.z, p.x + side.x, p.y, p.z + side.z], i * 6);
    uv.set([u, 0, u, 1], i * 4);
    if (i < segments) {
      const a = i * 2;
      index.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  g.setIndex(index);
  g.computeVertexNormals();
  return g;
}

/** Нам полигон уул: суурь y=0, өндөр 1, радиус 1. Оройдоо тод (vertex color саарал градиент × instance өнгө). */
export function mountainGeometry(sides = 5) {
  const g = new THREE.ConeGeometry(1, 1, sides, 2).toNonIndexed();
  g.translate(0, 0.5, 0);
  const pos = g.getAttribute("position");
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const k = 0.32 + 0.68 * pos.getY(i);
    colors.set([k, k, k], i * 3);
  }
  g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  g.computeVertexNormals();
  return g;
}

/** Дусал: доороо бөөрөнхий, дээшээ шовх. Өндөр 2r, төв нь гарал. */
export function dropletGeometry(r = 1, segments = 14) {
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i <= 16; i++) {
    const t = Math.PI - (i / 16) * Math.PI;
    pts.push(new THREE.Vector2(Math.max(Math.sin(t) * Math.sin(t / 2), 0.0001) * r, Math.cos(t) * r));
  }
  return new THREE.LatheGeometry(pts, segments);
}

/** Гурвалжин призм (дээвэр): нуруу нь X тэнхлэгийн дагуу, суурь y=0 */
export function roofGeometry(width: number, height: number, depth: number) {
  const shape = new THREE.Shape();
  shape.moveTo(-depth / 2, 0);
  shape.lineTo(depth / 2, 0);
  shape.lineTo(0, height);
  shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, { depth: width, bevelEnabled: false });
  g.translate(0, 0, -width / 2);
  g.rotateY(Math.PI / 2);
  return g;
}

/** y=0 хавтгай дахь тэгш өнцөгтийн хүрээ (LineLoop) */
export function rectOutline(width: number, depth: number) {
  const w = width / 2;
  const d = depth / 2;
  return new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-w, 0, -d),
    new THREE.Vector3(w, 0, -d),
    new THREE.Vector3(w, 0, d),
    new THREE.Vector3(-w, 0, d),
  ]);
}

/** Цэгүүдийг шулуун хэрчмээр холбосон зам (TubeGeometry-д хоолой болгоно) */
export function pipePath(points: [number, number, number][]) {
  const path = new THREE.CurvePath<THREE.Vector3>();
  for (let i = 0; i < points.length - 1; i++) {
    path.add(new THREE.LineCurve3(new THREE.Vector3(...points[i]), new THREE.Vector3(...points[i + 1])));
  }
  return path;
}
