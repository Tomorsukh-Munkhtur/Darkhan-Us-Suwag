import SmoothScroll from "@/components/SmoothScroll";
import DropCursor from "@/components/DropCursor";
import Navbar from "@/components/Navbar";
import Hero from "@/components/sections/Hero";
import WaterJourney from "@/components/sections/WaterJourney";
import DropReveal from "@/components/sections/DropReveal";
import About from "@/components/sections/About";
import SmartServices from "@/components/sections/SmartServices";
import WaterQuality from "@/components/sections/WaterQuality";
import CityMap from "@/components/sections/CityMap";
import Values from "@/components/sections/Values";
import Contact from "@/components/sections/Contact";
import WaterEdge from "@/components/sections/services/WaterEdge";
import { RESPECT_REDUCED_MOTION } from "@/lib/motion";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Танилцуулга — “Дархан Ус Суваг” ХК",
  description: "Усны аялал: эх үүсвэрээс таны гэр хүртэл. Дархан хотын 3D зураглал, бидний үйл ажиллагаа, усны чанар.",
};

/** Танилцуулга (усны аяллын storytelling) — нүүр хуудаснаас (/) орно */
export default function Intro() {
  return (
    <>
      <SmoothScroll />
      <Navbar />
      <main>
        {/* шумбалт: усан доор Алсын хараа → Эрхэм зорилго → Үнэт зүйлс (Hero.tsx, values/ValuesDive.tsx) */}
        <Hero />
        {/* хөдөлгөөн багасгах горимд шумбалтгүй — тэр агуулга энд энгийн хэсэг болно */}
        {RESPECT_REDUCED_MOTION && (
          <div className="theme-light hidden bg-foam text-abyss motion-reduce:block">
            <Values />
          </div>
        )}
        <WaterJourney />
        {/* Аяллын дусал томорч цайвар (light) хэсгүүдийг нээнэ — уснаас гарахад эхлээд бохир усны аялал, дараа нь дроны бичлэг (About.tsx) */}
        <DropReveal>
          <About />
          <SmartServices />
          <WaterQuality />
          <CityMap />
        </DropReveal>
      </main>
      <div className="theme-light relative z-30 bg-foam text-abyss">
        {/* дээд ирмэг: тайван усны гадаргуу хотын мапын дээгүүр доороос бүрхэж гарна (мап удаан гүйж бараанна — CityMap.tsx) */}
        <div aria-hidden className="absolute inset-x-0 top-0 h-0" style={{ "--svc-top": "#f5fbff" } as React.CSSProperties}>
          <WaterEdge variant="calm" />
        </div>
        <Contact />
      </div>
      <DropCursor />
    </>
  );
}
