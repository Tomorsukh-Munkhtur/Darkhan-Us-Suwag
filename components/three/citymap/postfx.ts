import { useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";

/**
 * Эцсийн нэг pass (HDR → дэлгэц): линзийн захын хроматик аберрац → ACES tone mapping → sRGB → vignette,
 * кино ширхэгжилт (grain; бараан хэсэгт илүү). OutputPass + тусдаа "фото" pass-ийн оронд — нэг бүтэн дэлгэцийн
 * зурагт хэмнэнэ.
 */
const FinalShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    toneMappingExposure: { value: 1.05 },
    uTime: { value: 0 },
    uRes: { value: new THREE.Vector2(1, 1) },
    uGrain: { value: 0.032 },
    uVignette: { value: 0.32 },
    uCA: { value: 0.0022 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform vec2 uRes;
    uniform float uGrain;
    uniform float uVignette;
    uniform float uCA;
    varying vec2 vUv;
    #include <tonemapping_pars_fragment>
    float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main() {
      vec2 c = vUv - 0.5;
      float r2 = dot(c, c);
      vec2 off = c * uCA * r2 * 4.0;
      vec3 col = vec3(
        texture2D(tDiffuse, vUv + off).r,
        texture2D(tDiffuse, vUv).g,
        texture2D(tDiffuse, vUv - off).b
      );
      col = ACESFilmicToneMapping(col);
      col = sRGBTransferOETF(vec4(col, 1.0)).rgb;
      col *= 1.0 - uVignette * smoothstep(0.08, 0.6, r2 * 1.5);
      float lum = dot(col, vec3(0.299, 0.587, 0.114));
      float g = hash(floor(vUv * uRes) + fract(uTime * 7.13) * 91.7) - 0.5;
      col += g * uGrain * (1.0 - 0.7 * lum);
      gl_FragColor = vec4(col, 1.0);
    }
  `,
};

type FX = { composer: EffectComposer; bloom: UnrealBloomPass; final: ShaderPass; passes: { dispose: () => void }[] };

/**
 * Хотын мапын бодит (фото мэт) дүрслэл: MSAA-тай HDR render target → гэрлийн туяа (bloom: цонх, гудамжны гэрэл,
 * хоолой, голын гялбаа) → эцсийн pass (ACES, sRGB, линз, кино ширхэг).
 * enabled=false (сул төхөөрөмж) үед R3F өөрөө шууд зурна (өмнөх шиг). still — хөдөлгөөн багасгах үед grain зогсоно.
 */
export function useCityPostFX(enabled: boolean, still: boolean, samples = 4) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);

  const fx = useMemo<FX | null>(() => {
    // HDR (HalfFloat) render target-д бичих боломжгүй GPU дээр шууд зурна (хар дэлгэц гаргахгүй)
    if (!enabled || !(gl.extensions.has("EXT_color_buffer_float") || gl.extensions.has("EXT_color_buffer_half_float"))) return null;
    // canvas-ийн MSAA render target-д үйлчлэхгүй тул ирмэгийн гөлгөр байдлыг энд хадгална
    const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples });
    const composer = new EffectComposer(gl, target);
    const render = new RenderPass(scene, camera);
    // зөвхөн гэрэл (шугаман гэрэлтэлт ≳ 0.3: цонх, дэнлүү, cyan хоолой, голын гялбаа) туяарна
    const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.62, 0.5, 0.3);
    (bloom.highPassUniforms as { smoothWidth: { value: number } }).smoothWidth.value = 0.18;
    const final = new ShaderPass(FinalShader);
    // three автоматаар tone mapping хийхгүй — shader дотроо ACES-ийг нэг удаа хийнэ
    final.material.toneMapped = false;
    composer.addPass(render);
    composer.addPass(bloom);
    composer.addPass(final);
    return { composer, bloom, final, passes: [render, bloom, final] };
  }, [enabled, gl, scene, camera, samples]);

  useEffect(() => {
    if (!fx) return;
    return () => {
      fx.passes.forEach((p) => p.dispose());
      fx.composer.dispose();
    };
  }, [fx]);

  useEffect(() => {
    if (!fx) return;
    const dpr = gl.getPixelRatio();
    fx.composer.setPixelRatio(dpr);
    fx.composer.setSize(size.width, size.height);
    // туяа зөөлөн тул хагас нягтралаар хангалттай (GPU-ийн ачаалал ~4 дахин бага)
    fx.bloom.setSize(Math.round(size.width * dpr * 0.5), Math.round(size.height * dpr * 0.5));
    fx.final.uniforms.uRes.value.set(size.width * dpr, size.height * dpr);
  }, [fx, gl, size.width, size.height]);

  // priority 1: R3F-ийн автомат render-ийг орлоно (Stage-ийн useFrame (0) камер, uniform-оо шинэчилсний дараа)
  useFrame(
    (_, delta) => {
      if (!fx) return;
      if (!still) fx.final.uniforms.uTime.value += delta;
      fx.composer.render(delta);
    },
    fx ? 1 : 0,
  );
}
