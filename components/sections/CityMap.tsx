"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { mapNodes, mapPipes, mapSewers, outages, type MapNode } from "@/lib/content";
import SectionHeading from "../ui/SectionHeading";

const kindStyle: Record<MapNode["kind"], { color: string; label: string }> = {
  source: { color: "#3fd0ff", label: "Усны эх үүсвэр" },
  pump: { color: "#7fe7ff", label: "Насос станц" },
  reservoir: { color: "#1ea4e6", label: "Усан сан" },
  treatment: { color: "#4ee6a6", label: "Цэвэрлэх байгууламж" },
  district: { color: "#e8f7ff", label: "Хэрэглэгчид" },
};

const byId = Object.fromEntries(mapNodes.map((n) => [n.id, n]));

function curve(a: MapNode, b: MapNode) {
  const mx = (a.x + b.x) / 2;
  return `M${a.x} ${a.y} C${mx} ${a.y} ${mx} ${b.y} ${b.x} ${b.y}`;
}

type Selected = { type: "node"; node: MapNode } | { type: "outage"; idx: number } | null;

export default function CityMap() {
  const [sel, setSel] = useState<Selected>(null);
  const [showSewer, setShowSewer] = useState(true);

  return (
    <section id="map" className="relative bg-deep/40 py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-8">
        <SectionHeading
          index="05"
          eyebrow="Darkhan City Map"
          title={
            <>
              УС <span className="text-water">ДАРХАН ХОТООР</span>
            </>
          }
          lead="Цэг дээр дарж дэлгэрэнгүй мэдээлэл аваарай. Улаан цэг — одоо явагдаж буй засварын ажил."
        />

        <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 text-xs text-mist">
          {Object.entries(kindStyle).map(([k, v]) => (
            <span key={k} className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: v.color }} /> {v.label}
            </span>
          ))}
          <span className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-alert" /> Засвар
          </span>
          <label className="ml-auto flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={showSewer}
              onChange={(e) => setShowSewer(e.target.checked)}
              className="accent-leaf"
            />
            Бохир усны шугам
          </label>
        </div>

        <div className="glass relative mt-6 overflow-hidden rounded-3xl">
          <div className="overflow-x-auto" data-lenis-prevent-horizontal>
          <svg viewBox="0 0 1000 600" className="block h-auto w-full min-w-[720px]" role="img" aria-label="Дархан хотын усны сүлжээний схем">
            <defs>
              <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M40 0H0V40" fill="none" stroke="#3fd0ff" strokeOpacity=".05" />
              </pattern>
              <filter id="glow">
                <feGaussianBlur stdDeviation="4" result="b" />
                <feMerge>
                  <feMergeNode in="b" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            <rect width="1000" height="600" fill="url(#grid)" />
            {/* Хараа гол */}
            <path
              d="M0 90 C120 60 200 140 320 110 S520 60 640 90 S880 160 1000 120"
              fill="none"
              stroke="#1ea4e6"
              strokeOpacity=".25"
              strokeWidth="18"
              strokeLinecap="round"
            />
            <text x="880" y="105" fill="#8fb3c9" fontSize="12" letterSpacing="3">
              ХАРАА ГОЛ
            </text>
            {/* районы хүрээ */}
            {mapNodes
              .filter((n) => n.kind === "district")
              .map((n) => (
                <ellipse key={n.id} cx={n.x} cy={n.y} rx="110" ry="70" fill="#e8f7ff" fillOpacity=".03" stroke="#e8f7ff" strokeOpacity=".08" />
              ))}

            {showSewer &&
              mapSewers.map(([a, b]) => (
                <path key={a + b} d={curve(byId[a], byId[b])} stroke="#4ee6a6" strokeOpacity=".7" strokeWidth="2" fill="none" className="flow-slow" />
              ))}
            {mapPipes.map(([a, b]) => (
              <g key={a + b}>
                <path d={curve(byId[a], byId[b])} stroke="#3fd0ff" strokeOpacity=".2" strokeWidth="6" fill="none" />
                <path d={curve(byId[a], byId[b])} stroke="#7fe7ff" strokeWidth="2.5" fill="none" className="flow" filter="url(#glow)" />
              </g>
            ))}

            {mapNodes.map((n) => {
              const c = kindStyle[n.kind].color;
              const active = sel?.type === "node" && sel.node.id === n.id;
              return (
                <g
                  key={n.id}
                  onClick={() => setSel({ type: "node", node: n })}
                  className="cursor-pointer"
                  role="button"
                  tabIndex={0}
                  aria-label={n.name}
                  onKeyDown={(e) => e.key === "Enter" && setSel({ type: "node", node: n })}
                >
                  <circle cx={n.x} cy={n.y} r="22" fill="transparent" />
                  <circle cx={n.x} cy={n.y} r={n.kind === "district" ? 8 : 10} fill={c} className="pulse-ring" opacity=".5" />
                  <circle
                    cx={n.x}
                    cy={n.y}
                    r={n.kind === "district" ? 7 : 9}
                    fill={active ? "#020b14" : c}
                    stroke={c}
                    strokeWidth="3"
                  />
                  <text
                    x={n.x}
                    y={n.y - 20}
                    fill="#e8f7ff"
                    fontSize="13"
                    textAnchor="middle"
                    stroke="#04182a"
                    strokeWidth="5"
                    strokeLinejoin="round"
                    paintOrder="stroke"
                  >
                    {n.name}
                  </text>
                </g>
              );
            })}

            {outages.map((o, i) => (
              <g key={o.id} onClick={() => setSel({ type: "outage", idx: i })} className="cursor-pointer" role="button" aria-label={`Засвар: ${o.area}`}>
                <circle cx={o.mapPoint.x} cy={o.mapPoint.y} r="12" fill="#ff4d5e" className="pulse-ring" />
                <circle cx={o.mapPoint.x} cy={o.mapPoint.y} r="8" fill="#ff4d5e" />
                <text x={o.mapPoint.x + 16} y={o.mapPoint.y + 4} fill="#ff4d5e" fontSize="12" fontWeight="700">
                  ЗАСВАР
                </text>
              </g>
            ))}
          </svg>
          </div>

          <AnimatePresence>
            {sel && (
              <motion.div
                key={sel.type === "node" ? sel.node.id : `o${sel.idx}`}
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 30 }}
                transition={{ duration: 0.35 }}
                className="relative m-3 rounded-2xl border border-white/10 bg-abyss/90 p-6 backdrop-blur-xl md:absolute md:right-4 md:top-4 md:m-0 md:w-80"
              >
                <button onClick={() => setSel(null)} className="absolute right-4 top-3 text-xl text-mist hover:text-foam" aria-label="Хаах">
                  ×
                </button>
                {sel.type === "node" ? (
                  <>
                    <p className="eyebrow" style={{ color: kindStyle[sel.node.kind].color }}>
                      {kindStyle[sel.node.kind].label}
                    </p>
                    <h3 className="mt-2 font-display text-xl">{sel.node.name}</h3>
                    <dl className="mt-5 space-y-3">
                      {sel.node.info.map((i) => (
                        <div key={i.k} className="flex justify-between gap-4 border-b border-white/5 pb-2 text-sm">
                          <dt className="text-mist">{i.k}</dt>
                          <dd className="text-right">{i.v}</dd>
                        </div>
                      ))}
                    </dl>
                  </>
                ) : (
                  <>
                    <p className="eyebrow text-alert!">🔴 Засвар</p>
                    <h3 className="mt-2 font-display text-xl">{outages[sel.idx].area}</h3>
                    <p className="mt-3 text-sm">{outages[sel.idx].title}</p>
                    <dl className="mt-5 space-y-2 text-sm">
                      <div className="flex justify-between">
                        <dt className="text-mist">Шалтгаан</dt>
                        <dd>{outages[sel.idx].reason}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-mist">Хугацаа</dt>
                        <dd>{outages[sel.idx].time}</dd>
                      </div>
                    </dl>
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <p className="mt-3 text-[11px] text-mist/70">
          <span className="md:hidden">← Хажуу тийш гүйлгэж харна уу. </span>* Схем нь бодит газарзүйн байршлыг харуулахгүй, ерөнхий бүтцийг илэрхийлнэ.</p>
      </div>
    </section>
  );
}
