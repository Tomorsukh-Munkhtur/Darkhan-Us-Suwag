import * as THREE from "three";
import { NOISE } from "../journey/materials/glsl";
import { GLASS } from "./geometry";

/**
 * Орчны гэрэл (reflection/IBL): гадны HDRI-гүй, procedural — гүн цэнхэр бөмбөрцөг + зөөлөн гэрлийн хавтангууд.
 * Хром, шилэнд цагаан/цэнхэр тусгалын зурвас өгнө. PMREM нэг удаа үүсгэнэ.
 */
export function createEnvironment(gl: THREE.WebGLRenderer) {
  const scene = new THREE.Scene();
  const disposables: { dispose(): void }[] = [];
  const add = <T extends THREE.Mesh>(m: T) => {
    scene.add(m);
    disposables.push(m.geometry, m.material as THREE.Material);
    return m;
  };
  add(
    new THREE.Mesh(
      new THREE.SphereGeometry(10, 32, 16),
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        vertexShader: /* glsl */ `
          varying vec3 vDir;
          void main() {
            vDir = normalize(position);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: /* glsl */ `
          varying vec3 vDir;
          void main() {
            float y = vDir.y;
            vec3 col = mix(vec3(0.004, 0.02, 0.045), vec3(0.03, 0.14, 0.26), smoothstep(-0.4, 0.05, y));
            col = mix(col, vec3(0.1, 0.3, 0.5), smoothstep(0.05, 0.9, y));
            gl_FragColor = vec4(col, 1.0);
          }
        `,
      }),
    ),
  );
  const panel = (w: number, h: number, color: string, power: number, pos: [number, number, number]) => {
    const m = add(
      new THREE.Mesh(
        new THREE.PlaneGeometry(w, h),
        new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(power), side: THREE.DoubleSide }),
      ),
    );
    m.position.set(...pos);
    m.lookAt(0, 1, 0);
  };
  panel(6, 2.2, "#ffffff", 5, [0, 7, 2.5]); // дээд зөөлөн гэрэл
  panel(1.2, 7, "#9fe3ff", 3.2, [-6.5, 2.5, 2]); // зүүн нарийн тусгал (хромд босоо цайвар зурвас)
  panel(2.5, 5, "#e8f6ff", 2.2, [6, 3, -1.5]); // баруун-ар
  panel(8, 1.2, "#38b6f0", 1.4, [0, 0.6, -7]); // ардаас цэнхэр туяа
  panel(0.7, 6, "#ffffff", 6, [-3, 3, 6.5]); // урд-зүүн нарийн тод зурвас (хром дээр гялбаа)
  panel(3, 0.6, "#ffffff", 3.5, [2.5, 6, 5]); // урд-дээд (аяганы ирмэгийн гялбаа)

  const pmrem = new THREE.PMREMGenerator(gl);
  const rt = pmrem.fromScene(scene, 0.035);
  pmrem.dispose();
  disposables.forEach((d) => d.dispose());
  return rt;
}

export const chromeMaterial = () =>
  new THREE.MeshStandardMaterial({ color: "#f2f6f9", metalness: 1, roughness: 0.1, envMapIntensity: 1.7 });

export const aeratorMaterial = () => new THREE.MeshStandardMaterial({ color: "#1b2733", metalness: 0.6, roughness: 0.55 });

export const counterMaterial = () =>
  new THREE.MeshPhysicalMaterial({
    color: "#061529",
    roughness: 0.3,
    metalness: 0,
    clearcoat: 0.7,
    clearcoatRoughness: 0.14,
    envMapIntensity: 0.45,
  });

/**
 * Шилэн аяга. transmission — жинхэнэ хугарал (ард нь байгаа ус, дэвсгэрийг хугалж харуулна);
 * LOW түвшинд transmission pass-гүй хөнгөн хувилбар: тунгалаг + орчны тусгал.
 */
export function glassMaterial(transmission: boolean) {
  if (transmission) {
    return new THREE.MeshPhysicalMaterial({
      color: "#e4f6ff",
      metalness: 0,
      roughness: 0.02,
      transmission: 1,
      thickness: 0.3,
      ior: 1.5,
      attenuationColor: new THREE.Color("#bfe9ff"),
      attenuationDistance: 2.2,
      specularIntensity: 1,
      envMapIntensity: 1.9,
    });
  }
  return new THREE.MeshPhysicalMaterial({
    color: "#cfefff",
    metalness: 0,
    roughness: 0.05,
    transparent: true,
    opacity: 0.2,
    depthWrite: false,
    envMapIntensity: 1.6,
  });
}

const TONE = /* glsl */ `
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
`;

/**
 * Аяган доторх ус (хажуу тал): нэгж цилиндрийг vertex shader-т аяганы дотоод конусын дагуу
 * ёроолоос uLevel хүртэл сунгана → түвшин өөрчлөгдөхөд geometry шинэчлэхгүй. Transmission-д
 * харагдахын тулд тунгалаг бус (opaque) — шилээр хугаран харагдана.
 */
export function waterBodyMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uLevel: { value: GLASS.base + 0.05 },
      uPhase: { value: 0 },
      uDeep: { value: new THREE.Color("#052b52") },
      uShallow: { value: new THREE.Color("#136aa8") },
      uEdge: { value: new THREE.Color("#9fe3ff") },
    },
    vertexShader: /* glsl */ `
      uniform float uLevel;
      varying vec3 vN;
      varying vec3 vView;
      varying float vH;
      varying float vAng;
      const float B = ${GLASS.base.toFixed(4)};
      const float H = ${GLASS.h.toFixed(4)};
      const float R0 = ${GLASS.rIn0.toFixed(4)};
      const float R1 = ${GLASS.rIn1.toFixed(4)};
      void main() {
        float t = position.y + 0.5;
        float y = mix(B, uLevel, t);
        float r = R0 + (R1 - R0) * (y - B) / (H - B) - 0.004;
        vec2 d = normalize(position.xz + 1e-6);
        vec4 mv = modelViewMatrix * vec4(d.x * r, y, d.y * r, 1.0);
        vN = normalize(normalMatrix * vec3(d.x, 0.0, d.y));
        vView = normalize(-mv.xyz);
        vH = t;
        vAng = atan(d.y, d.x);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uPhase;
      uniform vec3 uDeep;
      uniform vec3 uShallow;
      uniform vec3 uEdge;
      varying vec3 vN;
      varying vec3 vView;
      varying float vH;
      varying float vAng;
      ${NOISE}
      void main() {
        float f = pow(1.0 - abs(dot(normalize(vN), normalize(vView))), 2.0);
        // төв нь гүн, ирмэг рүүгээ (бүрэн дотоод ойлт) тод; маш бүдэг босоо гэрлийн зурвас
        vec3 col = mix(uDeep, uShallow, pow(smoothstep(0.0, 1.0, vH), 0.8)) * 0.9;
        float n = vnoise(vec2(vAng * 7.0, vH * 1.2 - uPhase * 0.35));
        col += uEdge * smoothstep(0.7, 0.98, n) * 0.05;
        col = mix(col, uEdge, f * 0.55);
        col = mix(col, uEdge, smoothstep(0.93, 1.0, vH) * 0.35);
        gl_FragColor = vec4(col, 1.0);
        ${TONE}
      }
    `,
  });
}

/**
 * Усны гадаргуу (дискний local хавтгай, радиус 1): урсгал унасан төвөөс гадагш цагираг долгио (фаз — progress
 * + ambient), бага зэргийн гялбаа (ambient), ирмэгийн мениск гэрэл.
 */
export function waterSurfaceMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uPhase: { value: 0 },
      uShimmer: { value: 0 },
      uDetail: { value: 1 },
      uDeep: { value: new THREE.Color("#0e5f9a") },
      uShallow: { value: new THREE.Color("#3cc0f2") },
      uGlow: { value: new THREE.Color("#e3f8ff") },
    },
    vertexShader: /* glsl */ `
      varying vec2 vP;
      void main() {
        vP = position.xy;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uPhase;
      uniform float uShimmer;
      uniform float uDetail;
      uniform vec3 uDeep;
      uniform vec3 uShallow;
      uniform vec3 uGlow;
      varying vec2 vP;
      ${NOISE}
      void main() {
        float r = length(vP);
        float rings = sin(r * 30.0 - uPhase * 7.0) * 0.5 + 0.5;
        rings *= exp(-r * 2.2) * smoothstep(0.02, 0.1, r);
        vec2 q = vP * 4.0 + vec2(uShimmer * 0.25, -uShimmer * 0.18);
        float n = uDetail > 0.5 ? vnoise(q) * 0.6 + vnoise(q * 2.4 + 3.0) * 0.4 : vnoise(q);
        vec3 col = mix(uShallow, uDeep, smoothstep(0.0, 1.0, r) * 0.65);
        col += uGlow * (rings * 0.4 + smoothstep(0.62, 0.9, n) * 0.12);
        col += uGlow * (1.0 - smoothstep(0.0, 0.12, r)) * 0.5;
        col = mix(col, uGlow, smoothstep(0.9, 1.0, r) * 0.6);
        gl_FragColor = vec4(col, 1.0);
        ${TONE}
      }
    `,
  });
}

/**
 * Урсгал: ирмэг рүүгээ тод (fresnel), доош урсах зурвас (uPhase), усны гадаргуугаас доош хэсгийг хаяна.
 * Ambient үед маш бага хэлбэлзэл (vertex). Transmission-д харагдахын тулд opaque.
 */
export function streamMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uPhase: { value: 0 },
      uWobble: { value: 0 },
      uLevel: { value: GLASS.base },
      uCore: { value: new THREE.Color("#5fd3f7") },
      uGlow: { value: new THREE.Color("#eafaff") },
    },
    vertexShader: /* glsl */ `
      uniform float uWobble;
      varying vec2 vUv;
      varying vec3 vN;
      varying vec3 vView;
      varying float vWorldY;
      void main() {
        vUv = uv;
        vec3 p = position;
        float fall = 1.0 - uv.y;
        p.x += sin(p.y * 13.0 + uWobble * 7.0) * 0.0035 * fall;
        p.z += cos(p.y * 11.0 + uWobble * 5.0) * 0.0025 * fall;
        vec4 w = modelMatrix * vec4(p, 1.0);
        vWorldY = w.y;
        vec4 mv = viewMatrix * w;
        vN = normalize(normalMatrix * normal);
        vView = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uPhase;
      uniform float uLevel;
      uniform vec3 uCore;
      uniform vec3 uGlow;
      varying vec2 vUv;
      varying vec3 vN;
      varying vec3 vView;
      varying float vWorldY;
      void main() {
        if (vWorldY < uLevel - 0.002) discard;
        float f = pow(1.0 - abs(dot(normalize(vN), normalize(vView))), 1.5);
        float streak = smoothstep(0.55, 1.0, sin(vUv.y * 70.0 + uPhase * 9.0) * 0.5 + 0.5);
        vec3 col = mix(uCore, uGlow, 0.35 + 0.45 * f);
        col += uGlow * streak * 0.18 * (1.0 - f);
        gl_FragColor = vec4(col, 1.0);
        ${TONE}
      }
    `,
  });
}

/** Зөөлөн контакт сүүдэр (хавтгай, радиаль) — бодит цагийн сүүдэргүйгээр газарт суулгана */
export function contactShadowMaterial(strength = 0.55) {
  return new THREE.ShaderMaterial({
    uniforms: { uStrength: { value: strength } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uStrength;
      varying vec2 vUv;
      void main() {
        float r = length(vUv - 0.5) * 2.0;
        float a = pow(max(1.0 - r, 0.0), 1.8) * uStrength;
        gl_FragColor = vec4(0.0, 0.01, 0.03, a);
      }
    `,
    transparent: true,
    depthWrite: false,
  });
}

/** Шилний ирмэгийн гялбаа (fresnel) — бараан дэвсгэр дээр шилийг танигдахуйц болгоно; additive, 1 draw call */
export function glassRimMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color("#cdefff") }, uStrength: { value: 0.55 } },
    vertexShader: /* glsl */ `
      varying vec3 vN;
      varying vec3 vView;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal);
        vView = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uStrength;
      varying vec3 vN;
      varying vec3 vView;
      void main() {
        float f = pow(1.0 - abs(dot(normalize(vN), normalize(vView))), 3.0);
        gl_FragColor = vec4(uColor * f * uStrength, f * uStrength);
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}
