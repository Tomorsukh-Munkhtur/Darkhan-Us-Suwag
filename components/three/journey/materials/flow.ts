import * as THREE from "three";

/**
 * Хоолой, шугам доторх урсгал: гэрэлтэй импульс урсгалын чиглэлээр гүйнэ. Байрлал нь uPhase — цаг биш,
 * progress-оос тооцсон фаз (+ сонголтоор чимэглэлийн ambient).
 * uDraw (0–1) — шугам эхнээсээ хэр "зурагдсан" (SVG-ийн stroke-dashoffset-тэй адил).
 * Тэнхлэг: TubeGeometry-д uv.x уртын дагуу; CylinderGeometry-д uv.y өндрийн дагуу (axis: "y").
 */
export type FlowOptions = {
  color: string;
  glow?: string;
  speed?: number;
  /** Нэгж урт дахь импульсийн тоо × урт */
  density?: number;
  duty?: number;
  opacity?: number;
  axis?: "x" | "y";
};

const vertex = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormalV;
  void main() {
    vUv = uv;
    vNormalV = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragment = /* glsl */ `
  uniform vec3 uColor;
  uniform vec3 uGlow;
  uniform float uPhase;
  uniform float uSpeed;
  uniform float uDensity;
  uniform float uDuty;
  uniform float uDraw;
  uniform float uOpacity;
  varying vec2 vUv;
  varying vec3 vNormalV;
  void main() {
    #ifdef FLOW_AXIS_Y
      float a = vUv.y;
    #else
      float a = vUv.x;
    #endif
    if (a > uDraw) discard;
    float x = fract(a * uDensity - uPhase * uSpeed);
    float pulse = smoothstep(0.0, 0.12, x) * (1.0 - smoothstep(uDuty, uDuty + 0.2, x));
    // цилиндр хэлбэрийн сүүдэр: камер руу харсан тал тод
    float facing = abs(normalize(vNormalV).z);
    // урсгалын толгой: шугам зурагдаж байхад үзүүр нь гэрэлтэнэ
    float head = smoothstep(uDraw - 0.05, uDraw, a) * (1.0 - step(0.999, uDraw));
    vec3 col = uColor * (0.5 + 0.5 * facing) + uGlow * (pulse * 0.5 + head);
    gl_FragColor = vec4(col, uOpacity);
    #include <colorspace_fragment>
  }
`;

export function createFlowMaterial(o: FlowOptions) {
  const opacity = o.opacity ?? 1;
  return new THREE.ShaderMaterial({
    vertexShader: vertex,
    fragmentShader: fragment,
    defines: o.axis === "y" ? { FLOW_AXIS_Y: "" } : {},
    uniforms: {
      uColor: { value: new THREE.Color(o.color) },
      uGlow: { value: new THREE.Color(o.glow ?? "#bff0ff") },
      uPhase: { value: 0 },
      uSpeed: { value: o.speed ?? 0.8 },
      uDensity: { value: o.density ?? 8 },
      uDuty: { value: o.duty ?? 0.3 },
      uDraw: { value: 1 },
      uOpacity: { value: opacity },
    },
    transparent: opacity < 1,
    depthWrite: opacity >= 1,
  });
}

/** Хоолойн урт (нэгж) бүрт ойролцоогоор ижил нягтралтай импульс гарахаар density тооцно */
export const densityFor = (length: number, perUnit = 3) => Math.max(1, Math.round(length * perUnit));
