"use client";

import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { C } from "../journey/materials/palette";
import { createFlowMaterial, densityFor } from "../journey/materials/flow";
import { pipePath } from "../journey/utils/geometry";
import { useDisposable } from "../journey/utils/useDisposable";
import type { TierSettings } from "../journey/quality";

/*
 * Ухаалаг усны тоолуур (SmartServices): шугамд суурилуулсан их бие, дээрээ тоолох механизм ба дэлгэц (заалт тоологдоно),
 * хажуудаа утасгүй холбооны модуль, антенаас заалт дохио болж цацагдана (BILL center апп руу). Шугамаар ус урсана.
 * Бүх хөдөлгөөн ambient цагаас; reduced үед нэг хөдөлгөөнгүй кадр.
 */

/** эхлэх заалт — BILL center-ийн "сүүлийн заалт" (smart/BillScreen.tsx) */
export const METER_START = 1234.21;
const START = METER_START;
/** заалт (м³) — секундэд нэмэгдэх хэмжээ (харагдахуйц хурдан) */
const RATE = 0.037;
const RINGS = 3;
const PERIOD = 2.4;

const pipe = pipePath([
  [-1.75, 0, 0],
  [1.75, 0, 0],
]);

/** Дэлгэцийн бичвэр (LCD): заалт, нэгж, холболтын тэмдэг */
function drawDisplay(ctx: CanvasRenderingContext2D, value: number, link: boolean) {
  const S = ctx.canvas.width;
  ctx.clearRect(0, 0, S, S);
  const g = ctx.createRadialGradient(S / 2, S * 0.4, S * 0.05, S / 2, S / 2, S * 0.5);
  g.addColorStop(0, "#123b52");
  g.addColorStop(1, "#071c2b");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(S / 2, S / 2, S / 2, 0, Math.PI * 2);
  ctx.fill();
  // LCD хэсэг
  ctx.fillStyle = "#b9f3e6";
  ctx.globalAlpha = 0.08;
  ctx.fillRect(S * 0.12, S * 0.36, S * 0.76, S * 0.28);
  ctx.globalAlpha = 1;
  ctx.fillStyle = "#9ff5dc";
  ctx.shadowColor = "#5fe8c4";
  ctx.shadowBlur = S * 0.02;
  ctx.font = `700 ${Math.round(S * 0.15)}px ui-monospace, Menlo, Consolas, monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(value.toFixed(2).padStart(8, "0"), S / 2, S * 0.5);
  ctx.shadowBlur = 0;
  ctx.font = `600 ${Math.round(S * 0.07)}px system-ui, sans-serif`;
  ctx.fillStyle = "#8fb3c9";
  ctx.fillText("м³", S / 2, S * 0.72);
  // утасгүй холбооны тэмдэг (дамжуулах агшинд тод)
  ctx.strokeStyle = link ? "#5fd3f7" : "#2a5470";
  ctx.lineWidth = S * 0.012;
  ctx.lineCap = "round";
  for (let i = 1; i <= 3; i++) {
    ctx.beginPath();
    ctx.arc(S / 2, S * 0.3, S * 0.035 * i, Math.PI * 1.25, Math.PI * 1.75);
    ctx.stroke();
  }
}

type MeterProps = {
  reduced: boolean;
  tier: TierSettings;
  onReady: () => void;
  /** 0–1: дохио (цагираг, LED) хэр хүчтэй — заалт илгээх алхамд 1 */
  boost?: number;
  /** дэлгэцийн заалт солигдох бүрт (м³) — апп-ын дэлгэцэд ижил тоо харуулна */
  onReading?: (value: number) => void;
};

function Meter({ reduced, tier, onReady, boost = 0, onReading }: MeterProps) {
  const camera = useThree((s) => s.camera);
  const canvas = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = c.height = 512;
    return c;
  }, []);
  const screen = useDisposable(() => {
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  }, [canvas]);
  const pipeGeo = useDisposable(() => new THREE.TubeGeometry(pipe, 64, 0.13, 20, false), []);
  const pipeMat = useDisposable(
    () => createFlowMaterial({ color: "#1b7fc0", glow: C.foam, density: densityFor(pipe.getLength(), 2.2), speed: 0.6 }),
    [],
  );
  const ringMats = useDisposable(() => {
    const list = Array.from({ length: RINGS }, () => new THREE.MeshBasicMaterial({ color: C.aqua, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
    return { list, dispose: () => list.forEach((m) => m.dispose()) };
  }, []);
  const led = useDisposable(() => new THREE.MeshStandardMaterial({ color: "#0b3a2c", emissive: C.green, emissiveIntensity: 0.2 }), []);

  const body = useRef<THREE.Group>(null);
  const rings = useRef<(THREE.Mesh | null)[]>([]);
  const signal = useRef<THREE.Group>(null);
  const t = useRef(0);
  const shown = useRef("");
  const ready = useRef(false);

  useEffect(() => {
    drawDisplay(canvas.getContext("2d")!, START, false);
    screen.needsUpdate = true;
  }, [canvas, screen]);

  useFrame((_, delta) => {
    if (!reduced) t.current += Math.min(delta, 0.05);
    const time = t.current;
    pipeMat.uniforms.uPhase.value = time * 0.9;

    // заалт тоологдоно; дэлгэцийг утга солигдох үед л дахин зурна
    const value = START + time * RATE;
    const k = (time % PERIOD) / PERIOD;
    const link = k < 0.35;
    const key = `${value.toFixed(2)}|${link}`;
    if (key !== shown.current) {
      const changed = !shown.current.startsWith(`${value.toFixed(2)}|`);
      shown.current = key;
      drawDisplay(canvas.getContext("2d")!, value, link);
      screen.needsUpdate = true;
      if (changed) onReading?.(value);
    }

    // дохио: антенаас гадагш тэлж бүдгэрнэ; камер руу харна
    signal.current?.quaternion.copy(camera.quaternion);
    rings.current.forEach((r, i) => {
      if (!r) return;
      const p = (k + i / RINGS) % 1;
      r.scale.setScalar(0.25 + p * 1.4);
      ringMats.list[i].opacity = (reduced ? 0.35 : 0.85) * (1 - p) * (tier.fx ? 1 : 0.7) * (0.45 + 0.55 * boost);
      r.scale.multiplyScalar(1 + 0.35 * boost);
    });
    led.emissiveIntensity = link || boost > 0.5 ? 2.2 : 0.25;
    // зөөлөн "амьсгал" — анхаарал сарниулахгүй
    if (body.current) body.current.rotation.y = -0.32 + Math.sin(time * 0.35) * 0.06;

    if (!ready.current) {
      ready.current = true;
      onReady();
    }
  });

  return (
    <group ref={body} position={[0, -0.25, 0]}>
      {/* шугам (ус урсана), холболтын самар */}
      <mesh geometry={pipeGeo} material={pipeMat} />
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.98, 0, 0]} rotation-z={Math.PI / 2}>
          <cylinderGeometry args={[0.2, 0.2, 0.18, 6]} />
          <meshStandardMaterial color={C.metal} roughness={0.35} metalness={0.6} />
        </mesh>
      ))}

      {/* их бие (шугамын дагуу) */}
      <mesh rotation-z={Math.PI / 2}>
        <cylinderGeometry args={[0.3, 0.3, 1.5, 32]} />
        <meshStandardMaterial color="#1f5f8f" roughness={0.35} metalness={0.45} />
      </mesh>
      {[-0.77, 0.77].map((x) => (
        <mesh key={x} position={[x, 0, 0]} rotation-z={Math.PI / 2}>
          <cylinderGeometry args={[0.24, 0.24, 0.06, 28]} />
          <meshStandardMaterial color={C.metalDark} roughness={0.4} metalness={0.5} />
        </mesh>
      ))}
      {/* тоолох механизмын орон сууц */}
      <mesh position={[0, 0.3, 0]}>
        <cylinderGeometry args={[0.44, 0.4, 0.26, 40]} />
        <meshStandardMaterial color="#e3edf4" roughness={0.45} />
      </mesh>
      <mesh position={[0, 0.44, 0]} rotation-x={Math.PI / 2}>
        <torusGeometry args={[0.43, 0.035, 12, 48]} />
        <meshStandardMaterial color={C.metal} roughness={0.3} metalness={0.6} />
      </mesh>
      {/* дэлгэц */}
      <mesh position={[0, 0.432, 0]} rotation-x={-Math.PI / 2}>
        <circleGeometry args={[0.4, 48]} />
        <meshBasicMaterial map={screen} toneMapped={false} />
      </mesh>

      {/* утасгүй холбооны модуль, антен, LED */}
      <group position={[0, 0.22, -0.46]}>
        <mesh>
          <boxGeometry args={[0.46, 0.3, 0.16]} />
          <meshStandardMaterial color="#d6e2ea" roughness={0.5} />
        </mesh>
        <mesh position={[0.14, 0.04, 0.081]} material={led}>
          <circleGeometry args={[0.03, 16]} />
        </mesh>
        <mesh position={[-0.14, 0.42, 0]}>
          <cylinderGeometry args={[0.018, 0.024, 0.55, 10]} />
          <meshStandardMaterial color={C.metalDark} roughness={0.5} metalness={0.3} />
        </mesh>
        <mesh position={[-0.14, 0.71, 0]} material={led}>
          <sphereGeometry args={[0.04, 14, 10]} />
        </mesh>
        {/* дохионы цагирагууд */}
        <group ref={signal} position={[-0.14, 0.71, 0]}>
          {ringMats.list.map((m, i) => (
            <mesh
              key={i}
              material={m}
              ref={(el) => {
                rings.current[i] = el;
              }}
            >
              <ringGeometry args={[0.3, 0.33, 48]} />
            </mesh>
          ))}
        </group>
      </group>
    </group>
  );
}

/**
 * Canvas: тунгалаг (картын CSS дэвсгэр харагдана). running=false — бүрэн зогсоно; continuous=false — demand (нэг кадр).
 */
export default function MeterScene3D({
  tier,
  running,
  continuous,
  reduced,
  onReady,
  onFail,
  boost,
  onReading,
}: {
  tier: TierSettings;
  running: boolean;
  continuous: boolean;
  reduced: boolean;
  onReady: () => void;
  onFail: () => void;
  boost?: number;
  onReading?: (value: number) => void;
}) {
  return (
    <Canvas
      dpr={[1, tier.dpr]}
      flat
      frameloop={!running ? "never" : continuous ? "always" : "demand"}
      gl={{ antialias: tier.antialias, alpha: true, premultipliedAlpha: true, powerPreference: "high-performance" }}
      camera={{ fov: 30, near: 0.1, far: 40, position: [0.9, 2.0, 5.0] }}
      onCreated={({ gl, camera }) => {
        gl.setClearColor(0x000000, 0);
        camera.lookAt(0, 0.15, 0);
        gl.domElement.addEventListener("webglcontextlost", (e) => {
          e.preventDefault();
          onFail();
        });
      }}
      style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
    >
      <hemisphereLight args={["#cfeeff", "#0a2238", 1.3]} />
      <directionalLight position={[3.5, 6, 5]} intensity={2.2} color="#f2f9ff" />
      <directionalLight position={[-5, 2.5, -4]} intensity={1.1} color="#38b6f0" />
      <Meter reduced={reduced} tier={tier} onReady={onReady} boost={boost} onReading={onReading} />
    </Canvas>
  );
}
