"use client";

import { useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

const vertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

// Бараан дэвсгэр дээрх бүдэг усны гадаргуу: caustic гэрлийн тор + давалгаа + хулганы орчимд долгио.
// Тунгалаг (premultiplied) гаралт — зөвхөн гэрэл нь харагдана, дэвсгэр нь section-ийнх.
const fragment = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform float uTime;
  uniform vec2 uMouse;
  uniform vec2 uRes;
  uniform float uStrength;
  uniform float uEven;
  uniform float uInk;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x),
               mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
  }
  float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 3; i++) { v += a * noise(p); p *= 2.02; a *= 0.5; }
    return v;
  }
  // soft: их байх тусам зураас өргөн, тархмал (blur) болно
  float caustic(vec2 p, float t, float soft) {
    vec2 q = p;
    float c = 0.0;
    for (int i = 0; i < 3; i++) {
      float fi = float(i);
      q += vec2(sin(q.y * 1.7 + t * 0.6 + fi), cos(q.x * 1.5 - t * 0.5 + fi)) * 0.35;
      c += 0.02 / (abs(sin(q.x * 2.1 + q.y * 1.3 + t * 0.4)) + soft);
    }
    return clamp(c * 0.35, 0.0, 1.0);
  }

  void main() {
    vec2 uv = vUv;
    float aspect = uRes.x / uRes.y;
    // аажим ойртож холдоно
    vec2 p = (uv - 0.5) * vec2(aspect, 1.0) * (1.0 - 0.06 * sin(uTime * 0.05));

    // хулганы орчимд долгио
    vec2 m = uMouse * 0.5 * vec2(aspect, 1.0);
    float d = length(p - m);
    p += normalize(p - m + 1e-4) * sin(d * 38.0 - uTime * 3.2) * exp(-d * 5.0) * 0.035;

    float t = uTime * 0.35;
    float n = fbm(p * 2.2 + vec2(t * 0.4, -t * 0.25));
    // голд зураас тархмал, бүдэг (анхаарал татахгүй); захаар зөөлөн нимгэн зураас. uEven: хаа сайгүй ижил тод
    float edge = mix(smoothstep(0.2, 0.9, length((uv - 0.5) * vec2(aspect, 1.0))), 1.0, uEven);
    float c = caustic(p * 3.2 + n * 0.8, uTime, mix(0.3, 0.05, edge)) * mix(0.45, 1.0, edge);

    // давалгааны зөөлөн гэрэл + caustic тор + хулганы гэрэл — бүгд бүдэг
    float swell = smoothstep(0.35, 0.8, n) * 0.25;
    float light = (c + swell + exp(-d * 2.4) * 0.15) * uStrength;
    // uInk: цайвар (цагаан) дэвсгэр дээр харагдахаар гэрэл нь цэнхэр (бараан дээр цайвар)
    vec3 col = mix(mix(vec3(0.22, 0.71, 0.94), vec3(0.75, 0.93, 1.0), c), mix(vec3(0.1, 0.5, 0.82), vec3(0.3, 0.7, 0.94), c), uInk);
    gl_FragColor = vec4(col * light, light);
  }
`;

function Plane({ strength, speed, even, ink }: { strength: number; speed: number; even: boolean; ink: boolean }) {
  const mat = useRef<THREE.ShaderMaterial>(null);
  const { size } = useThree();
  const mouse = useRef(new THREE.Vector2());

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uMouse: { value: new THREE.Vector2() },
      uRes: { value: new THREE.Vector2(1, 1) },
      uStrength: { value: strength },
      uEven: { value: even ? 1 : 0 },
      uInk: { value: ink ? 1 : 0 },
    }),
    [strength, even, ink],
  );

  useFrame((state, delta) => {
    if (!mat.current) return;
    const u = mat.current.uniforms;
    // удаан хөдөлгөөн — дэвсгэр анхаарал татах ёсгүй
    u.uTime.value += Math.min(delta, 0.05) * 0.4 * speed;
    mouse.current.lerp(state.pointer, 0.06);
    u.uMouse.value.copy(mouse.current);
    u.uRes.value.set(size.width, size.height);
  });

  return (
    <mesh frustumCulled={false}>
      <planeGeometry args={[2, 2]} />
      {/* NoBlending: premultiplied өнгийг canvas руу шууд бичнэ */}
      <shaderMaterial ref={mat} vertexShader={vertex} fragmentShader={fragment} uniforms={uniforms} blending={THREE.NoBlending} depthTest={false} />
    </mesh>
  );
}

/**
 * Бараан хэсгийн ард бүдэг усны гадаргуу (Hero-гийн усны бүдэг хувилбар). Бага нягтралаар зурна — зөөлөн дэвсгэр.
 * speed: хөдөлгөөний хурдны үржүүлэгч; even: голыг бүдгэрүүлэхгүй (DropReveal-ийн дусал дотор);
 * ink: цайвар дэвсгэр дээр цэнхэр гэрлээр зурна (Бидний үйл ажиллагаа).
 */
export default function WaterSurface({
  running = true,
  reduced = false,
  strength = 0.2125,
  speed = 1,
  even = false,
  ink = false,
}: {
  running?: boolean;
  reduced?: boolean;
  strength?: number;
  speed?: number;
  even?: boolean;
  ink?: boolean;
}) {
  return (
    <Canvas
      dpr={0.5}
      frameloop={reduced ? "demand" : running ? "always" : "never"}
      gl={{ antialias: false, alpha: true, premultipliedAlpha: true, powerPreference: "low-power" }}
      eventSource={document.body}
      eventPrefix="client"
      style={{ position: "absolute", inset: 0 }}
    >
      <Plane strength={strength} speed={speed} even={even} ink={ink} />
    </Canvas>
  );
}
