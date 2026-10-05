import SmoothScroll from "@/components/SmoothScroll";
import DropCursor from "@/components/DropCursor";
import Navbar from "@/components/Navbar";
import Hero from "@/components/sections/Hero";
import WaterJourney from "@/components/sections/WaterJourney";
import DropReveal from "@/components/sections/DropReveal";
import About from "@/components/sections/About";
import Services from "@/components/sections/Services";
import WaterQuality from "@/components/sections/WaterQuality";
import CityMap from "@/components/sections/CityMap";
import Values from "@/components/sections/Values";
import Contact from "@/components/sections/Contact";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Танилцуулга — “Дархан Ус Суваг” ХК",
  description: "Усны аялал: эх үүсвэрээс таны гэр хүртэл. Дархан хотын 3D мап, бидний үйл ажиллагаа, усны чанар.",
};

/** Танилцуулга (усны аяллын storytelling) — нүүр хуудаснаас (/) орно */
export default function Intro() {
  return (
    <>
      <SmoothScroll />
      <Navbar />
      <main>
        <Hero />
        <WaterJourney />
        {/* Аяллын дусал томорч цайвар (light) хэсгүүдийг нээнэ — уснаас гарахад эхлээд дроны бичлэг (Бидний тухай) */}
        <DropReveal>
          <About />
          <Services />
          <WaterQuality />
          <CityMap />
          <Values />
        </DropReveal>
      </main>
      <div className="theme-light bg-foam text-abyss">
        <Contact />
      </div>
      <DropCursor />
    </>
  );
}
