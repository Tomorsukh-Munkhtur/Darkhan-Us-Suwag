/**
 * Дархан хотын 3D газрын зургийн өгөгдөл ба цэвэр функцүүд (three.js import хийхгүй).
 *
 * Координат: одоогийн SVG схемийн (DarkhanMap.tsx, 1600×900) px → дэлхийн нэгж: x = (sx − 800) / 100, z = (sy − 450) / 100.
 * Бүх объект (гол, худаг, насос, усан сан, хороолол, шугам, засвар) схемийн байрлалаа хадгална — бодит GIS биш.
 */
export type P2 = [number, number];

export const toW = (sx: number, sy: number): P2 => [(sx - 800) / 100, (sy - 450) / 100];
const ptsW = (pts: number[][]) => pts.map(([x, y]) => toW(x, y));

// ---------------------------------------------------------------------------------------------
// Хараа гол: SVG-ийн cubic bezier (S командыг C болгож задалсан), x-ээр монотон

const RIVER_SVG: number[][][] = [
  [[-900, 120], [-600, 60], [-300, 170], [-40, 130]],
  [[-40, 130], [160, 90], [360, 185], [600, 150]],
  [[600, 150], [840, 115], [1010, 85], [1220, 135]],
  [[1220, 135], [1430, 185], [1520, 190], [1640, 150]],
  [[1640, 150], [1760, 110], [2100, 90], [2500, 140]],
];
/** Харагдах усны хагас өргөн (газрын налуу усны түвшинг огтлох зай) */
export const RIVER_HALF = 0.27;

function cubic(p: number[][], t: number): P2 {
  const u = 1 - t;
  const a = u * u * u;
  const b = 3 * u * u * t;
  const c = 3 * u * t * t;
  const d = t * t * t;
  return [a * p[0][0] + b * p[1][0] + c * p[2][0] + d * p[3][0], a * p[0][1] + b * p[1][1] + c * p[2][1] + d * p[3][1]];
}

/** Голын төв шугам (дэлхийн координат), x өсөх дарааллаар */
export const RIVER: P2[] = (() => {
  const out: P2[] = [];
  RIVER_SVG.forEach((seg, k) => {
    for (let i = k === 0 ? 0 : 1; i <= 60; i++) {
      const [sx, sy] = cubic(seg, i / 60);
      out.push(toW(sx, sy));
    }
  });
  return out;
})();

/** x дээрх голын төв z ба чиглэлийн cos (x-ээр монотон тул хайлт хялбар) */
export function riverAt(x: number): { z: number; cos: number } {
  const r = RIVER;
  if (x <= r[0][0]) return { z: r[0][1], cos: 1 };
  if (x >= r[r.length - 1][0]) return { z: r[r.length - 1][1], cos: 1 };
  let lo = 0;
  let hi = r.length - 1;
  while (hi - lo > 1) {
    const m = (lo + hi) >> 1;
    if (r[m][0] <= x) lo = m;
    else hi = m;
  }
  const [x0, z0] = r[lo];
  const [x1, z1] = r[hi];
  const t = (x - x0) / (x1 - x0);
  const dx = x1 - x0;
  const dz = z1 - z0;
  return { z: z0 + (z1 - z0) * t, cos: dx / Math.hypot(dx, dz) };
}

/** Голын төв шугам хүртэлх (ойролцоо) зай */
export function riverDist(x: number, z: number) {
  const r = riverAt(x);
  return Math.abs(z - r.z) * r.cos;
}

// ---------------------------------------------------------------------------------------------
// Газрын өндөр (детерминистик value noise) — terrain, мод, гэрэлд хуваалцана

function hash2(x: number, y: number) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}
function vnoise(x: number, y: number) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const a = hash2(ix, iy);
  const b = hash2(ix + 1, iy);
  const c = hash2(ix, iy + 1);
  const d = hash2(ix + 1, iy + 1);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}
export function fbm(x: number, y: number) {
  return vnoise(x, y) * 0.55 + vnoise(x * 2.1 + 3.1, y * 2.1 + 7.3) * 0.3 + vnoise(x * 4.3 + 11.7, y * 4.3 + 1.9) * 0.15;
}
const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
};

/** Хотын хавтгай бүс (дэлхийн координат) — энд газар тэгш */
export const CORE = { x0: -7.9, x1: 8.6, z0: -2.62, z1: 4.6 } as const;
export const RIVER_BED = -0.1;

export function terrainHeight(x: number, z: number) {
  // хотоос гадагш: хойд талын толгод (голын цаана), зүүн/баруун/өмнөд захын дов
  const dxOut = Math.max(CORE.x0 - x, x - CORE.x1, 0);
  const dzOut = Math.max(z - CORE.z1, 0);
  const north = Math.max(riverAt(x).z - z - 0.75, 0);
  const out = Math.max(smooth(0, 4.5, north), smooth(0.4, 6, dxOut), smooth(0.4, 5, dzOut));
  let h = out * (0.25 + 0.75 * fbm(x * 0.22 + 4, z * 0.22 - 2)) * 1.1;
  // хотын захад бага зэргийн долгион
  const nearCore = 1 - smooth(0.2, 1.2, Math.max(dxOut, dzOut, north * 0.5));
  h += (fbm(x * 0.7, z * 0.7) - 0.5) * 0.05 * (1 - nearCore * 0.85);
  // голын хөндий
  const d = riverDist(x, z);
  // усны ирмэг ≈ 0.27 (усны түвшин −0.035-ыг газар огтлох зай)
  const bank = smooth(0.15, 0.36, d);
  return RIVER_BED + (h - RIVER_BED) * bank;
}

// ---------------------------------------------------------------------------------------------
// Хороолол, гудамж

export type DistrictKind = "old" | "new" | "ind";
export type District = { id: DistrictKind; name: string; label: P2; xs: number[]; ys: number[] };

/** Гудамжны тор (SVG px) — шугамууд эдгээр гудамжны дагуу */
const DISTRICTS_SVG = [
  { id: "old", name: "ХУУЧИН ДАРХАН", label: [330, 418], xs: [80, 200, 330, 460, 580], ys: [450, 620, 790] },
  { id: "new", name: "ШИНЭ ДАРХАН", label: [1270, 268], xs: [1040, 1160, 1310, 1500], ys: [300, 410, 515] },
  { id: "ind", name: "ҮЙЛДВЭРИЙН РАЙОН", label: [1290, 578], xs: [1040, 1140, 1290, 1430, 1540], ys: [610, 730, 845] },
] as const;

export const DISTRICTS: District[] = DISTRICTS_SVG.map((d) => ({
  id: d.id,
  name: d.name,
  label: toW(d.label[0], d.label[1]),
  xs: d.xs.map((x) => (x - 800) / 100),
  ys: d.ys.map((y) => (y - 450) / 100),
}));

export type Road = { a: P2; b: P2; w: number; major: boolean };
export const STREET_W = 0.1;
export const AVENUE_W = 0.16;

/** Гудамж, гол зам: тэнхлэгтэй параллель хэрчмүүд (SVG px) */
export const ROADS: Road[] = (() => {
  const roads: Road[] = [];
  const add = (a: number[], b: number[], major = false) =>
    roads.push({ a: toW(a[0], a[1]), b: toW(b[0], b[1]), w: major ? AVENUE_W : STREET_W, major });
  for (const d of DISTRICTS_SVG) {
    const x0 = d.xs[0];
    const x1 = d.xs[d.xs.length - 1];
    const y0 = d.ys[0];
    const y1 = d.ys[d.ys.length - 1];
    for (const y of d.ys) add([x0, y], [x1, y], y === y0);
    for (const x of d.xs) add([x, y0], [x, y1]);
  }
  add([580, 560], [1610, 560], true); // төв өргөн чөлөө (Хуучин → Шинэ / Үйлдвэр)
  add([1040, 515], [1040, 610]); // Шинэ ↔ Үйлдвэрийн
  add([720, 330], [720, 560], true); // насос станц руу
  add([60, 330], [720, 330]); // эх үүсвэрийн үйлчилгээний зам
  add([80, 330], [80, 450]);
  add([-1200, 885], [2700, 885], true); // өмнөд тойруу зам
  add([330, 790], [330, 885]);
  add([1290, 845], [1290, 885]);
  add([1610, 885], [1610, 560], true);
  add([1610, 560], [1610, 190]);
  add([1610, 190], [1470, 190]); // цэвэрлэх байгууламжийн орц
  add([720, 560], [720, 885]);
  return roads;
})();

// ---------------------------------------------------------------------------------------------
// Байгууламж

export const WELLS: P2[] = ptsW([
  [170, 214],
  [250, 236],
  [330, 210],
  [410, 238],
]);
/** Эх үүсвэрийн ариун цэврийн хамгаалалтын бүс (тэгш өнцөгт) */
export const SOURCE_ZONE = { x0: -6.75, x1: -3.5, z0: -2.62, z1: -1.92 } as const;
export const PUMPS: P2[] = ptsW([
  [520, 300],
  [640, 360],
]);
export const RESERVOIR = { c: toW(600, 240), r: 0.36, h: 0.16 } as const;
/** Цэвэрлэх байгууламж: SVG-ийн хоёр дугуй сав + тэгш өнцөгт сав, барилга */
export const PLANT = {
  pad: { x0: 5.45, x1: 7.2, z0: -2.5, z1: -1.55 },
  clarifiers: [
    { c: toW(1400, 238), r: 0.28 },
    { c: toW(1456, 244), r: 0.21 },
  ],
  inlet: toW(1480, 232),
  outfall: [toW(1400, 205), toW(1400, 160)] as [P2, P2],
} as const;

/** Засвар (lib/content outages[0].mapPoint-ийг scene хүлээн авна) */
export const svgToWorld = toW;

// ---------------------------------------------------------------------------------------------
// Шугам сүлжээ (SVG-ийн замуудаас; хороолол дотор гудамжнаас 8 px зайтай — замын хажуугийн зурвас)

export type Pipe = { pts: P2[]; r: number; kind: "clean" | "sewer" | "outfall"; trunk: boolean };

function cubicPts(p0: number[], p1: number[], p2: number[], p3: number[], n = 14) {
  const out: number[][] = [];
  for (let i = 0; i <= n; i++) out.push(cubic([p0, p1, p2, p3], i / n));
  return out;
}

export const PIPES: Pipe[] = (() => {
  const P: Pipe[] = [];
  const add = (pts: number[][], kind: Pipe["kind"], trunk = false) =>
    P.push({ pts: ptsW(pts), r: trunk ? 0.034 : kind === "sewer" ? 0.026 : 0.022, kind, trunk });
  // эх үүсвэр
  for (const [x, y] of [
    [170, 214],
    [250, 236],
    [330, 210],
    [410, 238],
  ])
    add([[x, y + 8], [x, 262]], "clean");
  add([[170, 262], [520, 262], [520, 282]], "clean", true);
  add([[538, 300], [552, 300], [552, 240], [566, 240]], "clean", true);
  add([[600, 274], [600, 360], [622, 360]], "clean", true);
  // Хуучин Дархан
  add([...cubicPts([640, 378], [620, 430], [540, 458], [460, 458]), [88, 458]], "clean", true);
  for (const x of [208, 338, 468]) add([[x, 458], [x, 782]], "clean");
  add([[110, 628], [560, 628]], "clean");
  // Шинэ Дархан
  add([...cubicPts([658, 356], [780, 330], [920, 308], [1040, 308]), [1500, 308]], "clean", true);
  for (const x of [1168, 1318]) add([[x, 308], [x, 507]], "clean");
  add([[1040, 418], [1500, 418]], "clean");
  // Үйлдвэрийн район
  add([...cubicPts([650, 378], [700, 520], [860, 618], [1040, 618]), [1530, 618]], "clean", true);
  for (const x of [1148, 1298, 1438]) add([[x, 618], [x, 837]], "clean");
  add([[1040, 738], [1530, 738]], "clean");
  // бохир ус: хорооллоос → өмнөд коллектор → зүүн → цэвэрлэх байгууламж
  add([[100, 866], [1582, 866], [1582, 232], [1480, 232]], "sewer", true);
  add([[338, 782], [338, 866]], "sewer");
  add([[88, 798], [568, 798]], "sewer");
  add([[1298, 837], [1298, 866]], "sewer");
  add([[1500, 418], [1582, 418]], "sewer");
  add([[1500, 523], [1582, 523]], "sewer");
  add([[1040, 523], [1500, 523]], "sewer");
  // цэвэршсэн ус → гол
  add([[1400, 205], [1400, 160]], "outfall", true);
  return P;
})();

// ---------------------------------------------------------------------------------------------
// Сүлжээний зай (Dijkstra): урсгалын фронт ба импульсийн чиглэл

export type NetNode = { x: number; z: number; d: number };
export type PipeDist = { s: number[]; d: number[]; len: number };

/**
 * Хоолой бүрийг ~0.05 нэгжийн зангилаагаар хувааж, огтлолцол/холболтыг (0.03 доторх) нэгтгэнэ.
 * Цэвэр ус: эх үүсвэрийн хэсэг (худаг → I насос) нь "I насос хүртэлх зай"-гаар (урсгал нийлнэ),
 * түгээлт нь "I насосноос авах зай"-гаар; D = srcMax − toPump (эх үүсвэр), srcMax + fromPump (түгээлт) — тасралтгүй, урсгалын дагуу өснө.
 * Бохир ус: D = sewerMax − (байгууламж хүртэлх зай) — дээд урсгалаас байгууламж руу өснө.
 */
export function computeNetwork(pipes: Pipe[]) {
  type Node = { x: number; z: number; adj: { j: number; w: number }[] };
  const build = (filter: (p: Pipe) => boolean) => {
    const nodes: Node[] = [];
    const grid = new Map<string, number[]>();
    const key = (x: number, z: number) => `${Math.round(x / 0.06)},${Math.round(z / 0.06)}`;
    const near = (x: number, z: number) => {
      const kx = Math.round(x / 0.06);
      const kz = Math.round(z / 0.06);
      for (let a = -1; a <= 1; a++)
        for (let b = -1; b <= 1; b++)
          for (const i of grid.get(`${kx + a},${kz + b}`) ?? []) if (Math.hypot(nodes[i].x - x, nodes[i].z - z) < 0.03) return i;
      return -1;
    };
    const nodeAt = (x: number, z: number) => {
      const f = near(x, z);
      if (f >= 0) return f;
      nodes.push({ x, z, adj: [] });
      const k = key(x, z);
      grid.set(k, [...(grid.get(k) ?? []), nodes.length - 1]);
      return nodes.length - 1;
    };
    const paths: { pipe: number; ids: number[]; s: number[] }[] = [];
    pipes.forEach((p, pi) => {
      if (!filter(p)) return;
      const ids: number[] = [];
      const s: number[] = [];
      let acc = 0;
      for (let k = 0; k < p.pts.length - 1; k++) {
        const [x0, z0] = p.pts[k];
        const [x1, z1] = p.pts[k + 1];
        const L = Math.hypot(x1 - x0, z1 - z0);
        const n = Math.max(1, Math.ceil(L / 0.05));
        for (let i = k === 0 ? 0 : 1; i <= n; i++) {
          const t = i / n;
          ids.push(nodeAt(x0 + (x1 - x0) * t, z0 + (z1 - z0) * t));
          s.push(acc + L * t);
        }
        acc += L;
      }
      for (let i = 0; i < ids.length - 1; i++) {
        const a = ids[i];
        const b = ids[i + 1];
        if (a === b) continue;
        const w = Math.hypot(nodes[a].x - nodes[b].x, nodes[a].z - nodes[b].z);
        nodes[a].adj.push({ j: b, w });
        nodes[b].adj.push({ j: a, w });
      }
      paths.push({ pipe: pi, ids, s });
    });
    // огтлолцол: хоолойн дундах зангилаа нөгөө хоолойн зангилаатай давхцаагүй ч ойрхон бол холбоно
    for (let i = 0; i < nodes.length; i++)
      for (let j = i + 1; j < nodes.length; j++) {
        const w = Math.hypot(nodes[i].x - nodes[j].x, nodes[i].z - nodes[j].z);
        if (w < 0.045 && !nodes[i].adj.some((e) => e.j === j)) {
          nodes[i].adj.push({ j, w });
          nodes[j].adj.push({ j: i, w });
        }
      }
    const find = (x: number, z: number) => {
      const i = near(x, z);
      if (i < 0) throw new Error(`citymap: шугамын зангилаа олдсонгүй (${x.toFixed(2)}, ${z.toFixed(2)})`);
      return i;
    };
    return { nodes, paths, find };
  };
  const dijkstra = (nodes: Node[], sources: number[]) => {
    const dist = new Array(nodes.length).fill(Infinity);
    const done = new Array(nodes.length).fill(false);
    for (const s of sources) dist[s] = 0;
    for (;;) {
      let u = -1;
      let best = Infinity;
      for (let i = 0; i < nodes.length; i++) if (!done[i] && dist[i] < best) (best = dist[i]), (u = i);
      if (u < 0) break;
      done[u] = true;
      for (const e of nodes[u].adj) if (dist[u] + e.w < dist[e.j]) dist[e.j] = dist[u] + e.w;
    }
    return dist.map((d) => (Number.isFinite(d) ? d : 0));
  };

  // цэвэр ус
  const clean = build((p) => p.kind === "clean");
  const pump1In = clean.find(...toW(520, 282));
  const pump1Out = clean.find(...toW(538, 300));
  // насос станцын байр: оролт ↔ гаралт (байр дотор) холбоно
  clean.nodes[pump1In].adj.push({ j: pump1Out, w: 0.18 });
  clean.nodes[pump1Out].adj.push({ j: pump1In, w: 0.18 });
  const res0 = clean.find(...toW(566, 240));
  const res1 = clean.find(...toW(600, 274));
  clean.nodes[res0].adj.push({ j: res1, w: 0.45 });
  clean.nodes[res1].adj.push({ j: res0, w: 0.45 });
  const p2In = clean.find(...toW(622, 360));
  const p2Outs = [toW(640, 378), toW(658, 356), toW(650, 378)].map((p) => clean.find(...p));
  for (const o of p2Outs) {
    clean.nodes[p2In].adj.push({ j: o, w: 0.2 });
    clean.nodes[o].adj.push({ j: p2In, w: 0.2 });
  }
  const toPump = dijkstra(clean.nodes, [pump1In]);
  const fromPump = dijkstra(clean.nodes, [pump1Out]);
  // эх үүсвэрийн хэсэг: I насосны оролт хүртэлх зай нь түгээлтийнхээс бага зангилаанууд
  const srcPart = clean.nodes.map((_, i) => toPump[i] < fromPump[i] && toPump[i] < 4.2);
  let srcMax = 0;
  clean.nodes.forEach((_, i) => {
    if (srcPart[i]) srcMax = Math.max(srcMax, toPump[i]);
  });
  const cleanD = clean.nodes.map((_, i) => (srcPart[i] ? srcMax - toPump[i] : srcMax + fromPump[i]));

  // бохир ус
  const sewer = build((p) => p.kind === "sewer");
  const plantIn = sewer.find(...PLANT.inlet);
  const toPlant = dijkstra(sewer.nodes, [plantIn]);
  const sewerMax = Math.max(...toPlant);
  const sewerD = toPlant.map((d) => sewerMax - d);

  const D = {
    stub: 0,
    pump1: srcMax,
    reservoir: cleanD[res0],
    reservoirOut: cleanD[res1],
    pump2: cleanD[p2In],
    cleanMax: Math.max(...cleanD),
    sewerMax,
  };
  // худгийн хоолойн төгсгөл (коллектор) хүртэлх D — эх үүсвэрийн алхмын фронт
  D.stub = Math.max(...WELLS.map(([x]) => cleanD[clean.find(x, toW(0, 262)[1])]));

  const perPipe = new Map<number, PipeDist>();
  const collect = (net: ReturnType<typeof build>, d: number[]) => {
    for (const p of net.paths) perPipe.set(p.pipe, { s: p.s, d: p.ids.map((i) => d[i]), len: p.s[p.s.length - 1] });
  };
  collect(clean, cleanD);
  collect(sewer, sewerD);
  return { perPipe, D, cleanNodes: clean.nodes.map((n, i) => ({ x: n.x, z: n.z, d: cleanD[i] })) };
}

export type Network = ReturnType<typeof computeNetwork>;

/** Цэгээс хамгийн ойрын цэвэр усны зангилааны D (барилга ус хүлээн авах дараалал) */
export function nearestCleanD(nodes: NetNode[], x: number, z: number) {
  let best = Infinity;
  let d = 0;
  for (const n of nodes) {
    const q = (n.x - x) ** 2 + (n.z - z) ** 2;
    if (q < best) {
      best = q;
      d = n.d;
    }
  }
  return d;
}
