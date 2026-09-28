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

// Усны гадаргуу: caustic гэрэл + хулганы дагуу долгион + аажим zoom.
const fragment = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform float uTime;
  uniform vec2 uMouse;
  uniform vec2 uRes;
  uniform float uScroll;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x),
               mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
  }
  float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.02; a *= 0.5; }
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
    vec2 p = (uv - 0.5) * vec2(aspect, 1.0);

    // background slow zoom
    float zoom = 1.0 - 0.06 * sin(uTime * 0.05) - uScroll * 0.25;
    p *= zoom;

    vec2 m = (uMouse * 0.5) * vec2(aspect, 1.0);
    float d = length(p - m);
    // хулганы орчимд ripple
    float ripple = sin(d * 38.0 - uTime * 3.2) * exp(-d * 5.0) * 0.035;
    p += normalize(p - m + 1e-4) * ripple;

    float t = uTime * 0.35;
    float n = fbm(p * 2.2 + vec2(t * 0.4, -t * 0.25));
    float c = caustic(p * 3.2 + n * 0.8, uTime);

    vec3 deep = vec3(0.008, 0.043, 0.078);
    vec3 mid = vec3(0.02, 0.16, 0.27);
    vec3 light = vec3(0.35, 0.85, 1.0);

    float depth = smoothstep(-0.7, 0.7, p.y + n * 0.4);
    vec3 col = mix(deep, mid, depth * 0.9);
    col += light * c * (0.35 + 0.4 * depth);

    // гэрэл усан дээр тусах (mouse spotlight)
    float spot = exp(-d * 2.4);
    col += light * spot * 0.22 * (0.6 + 0.4 * n);

    // vignette + scroll үед харанхуй болох
    float vig = smoothstep(1.25, 0.2, length((uv - 0.5) * vec2(aspect, 1.0)));
    col *= mix(0.35, 1.0, vig);
    col = mix(col, deep, uScroll * 0.7);

    gl_FragColor = vec4(col, 1.0);
  }
`;

function Plane({ scrollRef }: { scrollRef: React.RefObject<number> }) {
  const mat = useRef<THREE.ShaderMaterial>(null);
  const { size } = useThree();
  const mouse = useRef(new THREE.Vector2());

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uMouse: { value: new THREE.Vector2() },
      uRes: { value: new THREE.Vector2(1, 1) },
      uScroll: { value: 0 },
    }),
    [],
  );

  useFrame((state, delta) => {
    if (!mat.current) return;
    const u = mat.current.uniforms;
    u.uTime.value += Math.min(delta, 0.05);
    mouse.current.lerp(state.pointer, 0.06);
    u.uMouse.value.copy(mouse.current);
    u.uRes.value.set(size.width, size.height);
    u.uScroll.value = scrollRef.current ?? 0;
  });

  return (
    <mesh frustumCulled={false}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial ref={mat} vertexShader={vertex} fragmentShader={fragment} uniforms={uniforms} />
    </mesh>
  );
}

export default function WaterSurface({ scrollRef }: { scrollRef: React.RefObject<number> }) {
  return (
    <Canvas
      dpr={[1, 1.5]}
      gl={{ antialias: false, powerPreference: "high-performance" }}
      eventSource={document.body}
      eventPrefix="client"
      style={{ position: "absolute", inset: 0 }}
    >
      <Plane scrollRef={scrollRef} />
    </Canvas>
  );
}
