"use client";

import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { gsap } from "gsap";

type Props = {
  /** HTML гарчиг — байрлал, фонтыг нь хуулж усан доор зурна */
  title: React.RefObject<HTMLElement | null>;
  /** Hero-ийн scroll progress (0–1) */
  scroll: React.RefObject<number>;
  reduced: boolean;
  running: boolean;
  onReady: () => void;
};

type Drop = { x: number; y: number; r: number; s: number };

const vertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

// Долгионы тэгшитгэл: R — өндөр, G — хурд
const updateFrag = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uState;
  uniform vec2 uTexel;
  void main() {
    vec4 s = texture2D(uState, vUv);
    float avg = (
      texture2D(uState, vUv + vec2(uTexel.x, 0.0)).r +
      texture2D(uState, vUv - vec2(uTexel.x, 0.0)).r +
      texture2D(uState, vUv + vec2(0.0, uTexel.y)).r +
      texture2D(uState, vUv - vec2(0.0, uTexel.y)).r
    ) * 0.25;
    s.g += (avg - s.r) * 2.0;
    s.g *= 0.993;
    s.r += s.g;
    s.r *= 0.998;
    gl_FragColor = s;
  }
`;

// Дусал: cos хэлбэрийн товгор. uSize-ээр texel-ийн харьцааг засна.
const dropFrag = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uState;
  uniform vec2 uCenter;
  uniform vec2 uSize;
  uniform float uRadius;
  uniform float uStrength;
  void main() {
    vec4 s = texture2D(uState, vUv);
    float k = max(0.0, 1.0 - length((vUv - uCenter) * uSize / uSize.x) / uRadius);
    s.r += (0.5 - 0.5 * cos(k * 3.14159265)) * uStrength;
    gl_FragColor = s;
  }
`;

// Дээрээс харсан тунгалаг ус: caustic гэрэлтэй ёроол, усан доорх гарчиг, долгион/дуслаар хугарал.
const fragment = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uTitle;
  uniform sampler2D uRipple;
  uniform vec2 uRes;
  uniform vec2 uSimTexel;
  uniform vec2 uMouse;
  uniform float uTime;
  uniform float uIntro;
  uniform float uScroll;
  uniform float uTitleShift;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x),
               mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
  }
  float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; }
    return v;
  }
  float caustic(vec2 p, float t) {
    vec2 q = p;
    float c = 0.0;
    for (int i = 0; i < 3; i++) {
      float fi = float(i);
      q += vec2(sin(q.y * 1.7 + t * 0.6 + fi), cos(q.x * 1.5 - t * 0.5 + fi)) * 0.35;
      c += 0.02 / abs(sin(q.x * 2.1 + q.y * 1.3 + t * 0.4));
    }
    return clamp(c * 0.35, 0.0, 1.0);
  }

  void main() {
    vec2 uv = vUv;
    float aspect = uRes.x / uRes.y;
    float t = uTime;

    // хулгана, дуслын долгион (өндрийн градиент)
    vec2 rip = vec2(
      texture2D(uRipple, uv + vec2(uSimTexel.x, 0.0)).r - texture2D(uRipple, uv - vec2(uSimTexel.x, 0.0)).r,
      texture2D(uRipple, uv + vec2(0.0, uSimTexel.y)).r - texture2D(uRipple, uv - vec2(0.0, uSimTexel.y)).r
    );

    // scroll хийхэд ус руу шумбах мэт ойртоно
    vec2 p = (uv - 0.5) * vec2(aspect, 1.0) * (1.0 - uScroll * 0.35);
    vec2 wave = vec2(
      fbm(p * 2.6 + vec2(t * 0.11, -t * 0.07)),
      fbm(p * 2.6 + vec2(5.2 - t * 0.09, 1.7 + t * 0.12))
    ) - 0.5;
    // эхэндээ ус долгиотой, аажмаар тогтоно
    float rough = mix(4.0, 1.0, uIntro);
    vec2 off = wave * 0.01 * rough + rip * 0.25;

    // ёроол: гүн, гүехэн өнгө
    vec2 fp = p + off * vec2(aspect, 1.0);
    float n = fbm(fp * 2.2 + vec2(t * 0.14, -t * 0.09));
    float depth = smoothstep(-0.7, 0.7, fp.y + n * 0.4);
    vec3 col = mix(vec3(0.29, 0.67, 0.89), vec3(0.80, 0.93, 0.99), depth);

    // усан доорх гарчиг: хугарна, ёроолд бүдэг сүүдэр тусгана
    vec2 tuv = uv + off + vec2(0.0, uScroll * uTitleShift);
    float show = uIntro * (1.0 - uScroll);
    col *= 1.0 - texture2D(uTitle, tuv + vec2(-0.004, 0.012)).a * 0.18 * show;
    vec4 title = texture2D(uTitle, tuv);
    col = mix(col, title.rgb, title.a * show);

    // caustic гэрэл гарчиг дээгүүр ч тоглоно
    float c = caustic(fp * 3.2 + n * 0.8, t);
    col = mix(col, vec3(1.0), c * (0.6 - 0.3 * depth) * (1.0 - 0.55 * title.a * show));

    // гадаргуу: долгионы налуу, гялбаа, хулганы гэрэл
    col *= 1.0 + dot(rip, vec2(-0.8, 2.4));
    vec3 nrm = normalize(vec3(-(wave * rough * 0.5 + rip * 10.0), 1.0));
    col += pow(max(dot(nrm, normalize(vec3(0.15, 0.5, 0.85))), 0.0), 90.0);
    col += smoothstep(0.93, 0.995, noise(p * vec2(28.0, 34.0) + wave * 6.0 + t * 0.6)) * 0.3;
    col = mix(col, vec3(1.0), exp(-length(p - uMouse * vec2(aspect, 1.0)) * 2.6) * 0.18);

    // ирмэг, scroll → хуудасны дэвсгэр рүү уусна
    vec3 foam = vec3(0.961, 0.984, 1.0);
    float vig = smoothstep(1.25, 0.2, length((uv - 0.5) * vec2(aspect, 1.0)));
    col = mix(foam, col, mix(0.7, 1.0, vig));
    col = mix(col, foam, smoothstep(0.35, 1.0, uScroll));
    gl_FragColor = vec4(col, 1.0);
  }
`;

function offsetIn(el: HTMLElement, root: HTMLElement) {
  let x = 0;
  let y = 0;
  for (let n: HTMLElement | null = el; n && n !== root; n = n.offsetParent as HTMLElement | null) {
    x += n.offsetLeft;
    y += n.offsetTop;
  }
  return { x, y };
}

const fontOf = (el: HTMLElement) => {
  const cs = getComputedStyle(el);
  return `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
};

/** HTML гарчгийн үсэг бүрийг transform-гүй байрлалаар нь canvas-д зурна (HTML-тэй яг давхцана) */
function drawTitle(h1: HTMLElement, root: HTMLElement, dpr: number) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(root.clientWidth * dpr);
  canvas.height = Math.round(root.clientHeight * dpr);
  const ctx = canvas.getContext("2d")!;
  ctx.scale(dpr, dpr);
  ctx.font = fontOf(h1);
  const m = ctx.measureText("Д");
  const asc = m.fontBoundingBoxAscent;
  const desc = m.fontBoundingBoxDescent;
  for (const el of h1.querySelectorAll<HTMLElement>(".hero-char")) {
    const { x, y } = offsetIn(el, root);
    const h = el.offsetHeight;
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, "#04213a");
    g.addColorStop(1, "#005b92");
    ctx.fillStyle = g;
    ctx.fillText(el.textContent ?? "", x, y + (h - asc - desc) / 2 + asc);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  return tex;
}

function Water({ title, scroll, reduced, onReady }: Omit<Props, "running">) {
  const gl = useThree((s) => s.gl);
  const size = useThree((s) => s.size);
  const invalidate = useThree((s) => s.invalidate);

  const uniforms = useMemo(
    () => ({
      uTitle: { value: null as THREE.Texture | null },
      uRipple: { value: null as THREE.Texture | null },
      uRes: { value: new THREE.Vector2(1, 1) },
      uSimTexel: { value: new THREE.Vector2() },
      uMouse: { value: new THREE.Vector2() },
      uTime: { value: 0 },
      uIntro: { value: reduced ? 1 : 0 },
      uScroll: { value: 0 },
      uTitleShift: { value: 0 },
    }),
    [],
  );
  // R3F <shaderMaterial uniforms> нь uniform бүрийг хуулдаг тул .value солиход material-д очихгүй → өөрсдөө үүсгэнэ
  const material = useMemo(
    () => new THREE.ShaderMaterial({ vertexShader: vertex, fragmentShader: fragment, uniforms, depthTest: false, depthWrite: false }),
    [uniforms],
  );
  useEffect(() => () => material.dispose(), [material]);

  // Долгионы симуляц: босоо тэнхлэгт 1.6 дахин олон texel → цагираг хавтгай (перспектив) харагдана
  const sim = useMemo(() => {
    const w = size.width > 900 ? 320 : 200;
    const h = Math.round(THREE.MathUtils.clamp((w * size.height * 1.6) / size.width, 96, 900));
    const target = () =>
      new THREE.WebGLRenderTarget(w, h, {
        type: THREE.HalfFloatType,
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        depthBuffer: false,
      });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
    quad.frustumCulled = false;
    return {
      w,
      h,
      targets: [target(), target()],
      scene: new THREE.Scene().add(quad),
      quad,
      cam: new THREE.OrthographicCamera(),
      update: new THREE.ShaderMaterial({
        vertexShader: vertex,
        fragmentShader: updateFrag,
        uniforms: { uState: { value: null }, uTexel: { value: new THREE.Vector2(1 / w, 1 / h) } },
      }),
      drop: new THREE.ShaderMaterial({
        vertexShader: vertex,
        fragmentShader: dropFrag,
        uniforms: {
          uState: { value: null },
          uCenter: { value: new THREE.Vector2() },
          uSize: { value: new THREE.Vector2(w, h) },
          uRadius: { value: 0 },
          uStrength: { value: 0 },
        },
      }),
      cur: 0,
      acc: 0,
    };
  }, [size.width, size.height]);

  useEffect(
    () => () => {
      sim.targets.forEach((t) => t.dispose());
      sim.update.dispose();
      sim.drop.dispose();
      sim.quad.geometry.dispose();
    },
    [sim],
  );

  const drops = useRef<Drop[]>([]);
  const mouse = useRef({ x: 0, y: 0, tx: 0, ty: 0 });
  const nextRain = useRef(3);

  // Гарчгийг усан доор зурна: фонт ачаалагдахыг хүлээж, хэмжээ өөрчлөгдөх бүрт дахин зурна
  const titleTex = useRef<THREE.Texture | null>(null);
  const started = useRef(false);
  useEffect(() => {
    const h1 = title.current;
    const root = h1?.closest("section");
    if (!h1 || !root) return;
    let cancelled = false;
    document.fonts.load(fontOf(h1), h1.textContent ?? "").then(() => {
      if (cancelled) return;
      titleTex.current?.dispose();
      titleTex.current = drawTitle(h1, root, Math.min(window.devicePixelRatio, 2));
      uniforms.uTitle.value = titleTex.current;
      // Hero.tsx-ийн scroll: гарчгийн блок өөрийн өндрийн 80%-иар доошилно
      const block = h1.closest<HTMLElement>(".hero-p-title");
      uniforms.uTitleShift.value = block ? (0.8 * block.offsetHeight) / root.clientHeight : 0;
      invalidate();
      if (started.current) return;
      started.current = true;
      onReady();
      // Эхлэл: голд том дусал унаж, ус тогтохын хэрээр гарчиг тодорно
      if (!reduced) {
        gsap.to(uniforms.uIntro, { value: 1, duration: 3.2, ease: "power2.out", delay: 0.2 });
        gsap.delayedCall(0.35, () => drops.current.push({ x: 0.5, y: 0.5, r: 0.08, s: 1.6 }));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [size.width, size.height]);
  useEffect(() => () => titleTex.current?.dispose(), []);

  // Хулгана/хуруу: гүйлгэхэд долгион, товшиход том дусал
  useEffect(() => {
    if (reduced) return;
    const el = gl.domElement;
    let lx = -1e4;
    let ly = -1e4;
    const at = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width;
      const y = 1 - (e.clientY - r.top) / r.height;
      return { x, y, inside: x >= 0 && x <= 1 && y >= 0 && y <= 1 };
    };
    const onMove = (e: PointerEvent) => {
      const p = at(e);
      mouse.current.tx = p.x - 0.5;
      mouse.current.ty = p.y - 0.5;
      const dist = Math.hypot(e.clientX - lx, e.clientY - ly);
      if (!p.inside || dist < 12) return;
      lx = e.clientX;
      ly = e.clientY;
      drops.current.push({ x: p.x, y: p.y, r: 0.02, s: Math.min(dist / 40, 0.9) });
    };
    const onDown = (e: PointerEvent) => {
      const p = at(e);
      if (p.inside) drops.current.push({ x: p.x, y: p.y, r: 0.04, s: 1.6 });
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", onDown, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onDown);
    };
  }, [gl, reduced]);

  useFrame((_, delta) => {
    const u = uniforms;
    const dt = Math.min(delta, 0.05);
    if (!reduced) u.uTime.value += dt;
    const t = u.uTime.value;

    u.uRes.value.set(size.width, size.height);
    u.uScroll.value = scroll.current ?? 0;
    const m = mouse.current;
    m.x += (m.tx - m.x) * 0.05;
    m.y += (m.ty - m.y) * 0.05;
    u.uMouse.value.set(m.x, m.y);

    // хааяа жижиг дусал — ус амьд харагдана
    if (!reduced && t > nextRain.current) {
      drops.current.push({
        x: 0.05 + Math.random() * 0.9,
        y: 0.05 + Math.random() * 0.9,
        r: 0.01 + Math.random() * 0.012,
        s: 0.25 + Math.random() * 0.25,
      });
      nextRain.current = t + 0.8 + Math.random() * 2.2;
    }

    const pass = (mat: THREE.ShaderMaterial) => {
      mat.uniforms.uState.value = sim.targets[sim.cur].texture;
      sim.quad.material = mat;
      sim.cur = 1 - sim.cur;
      gl.setRenderTarget(sim.targets[sim.cur]);
      gl.render(sim.scene, sim.cam);
    };
    for (const d of drops.current.splice(0, 6)) {
      sim.drop.uniforms.uCenter.value.set(d.x, d.y);
      sim.drop.uniforms.uRadius.value = d.r;
      sim.drop.uniforms.uStrength.value = d.s;
      pass(sim.drop);
    }
    // FPS-ээс үл хамааран секундэд ~120 алхам
    sim.acc = Math.min(sim.acc + dt, 3 / 120);
    while (!reduced && sim.acc >= 1 / 120) {
      pass(sim.update);
      sim.acc -= 1 / 120;
    }
    gl.setRenderTarget(null);
    u.uRipple.value = sim.targets[sim.cur].texture;
    u.uSimTexel.value.set(1 / sim.w, 1 / sim.h);
  });

  return (
    <mesh frustumCulled={false} material={material}>
      <planeGeometry args={[2, 2]} />
    </mesh>
  );
}

/** Hero: тунгалаг усан доорх "ДАРХАН ХОТ". Хулгана, дусал, scroll-оор ус хөдөлнө. */
export default function HeroWater({ running, ...props }: Props) {
  return (
    <Canvas
      dpr={[1, 1.5]}
      frameloop={props.reduced ? "demand" : running ? "always" : "never"}
      gl={{ antialias: false, alpha: false, powerPreference: "high-performance" }}
      style={{ position: "absolute", inset: 0 }}
    >
      <Water {...props} />
    </Canvas>
  );
}
