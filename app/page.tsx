import SmoothScroll from "@/components/SmoothScroll";
import Navbar from "@/components/Navbar";
import OutageBanner from "@/components/OutageBanner";
import Hero from "@/components/sections/Hero";
import WaterJourney from "@/components/sections/WaterJourney";
import Services from "@/components/sections/Services";
import WaterQuality from "@/components/sections/WaterQuality";
import CityMap from "@/components/sections/CityMap";
import Projects from "@/components/sections/Projects";
import News from "@/components/sections/News";
import CustomerServices from "@/components/sections/CustomerServices";
import Contact from "@/components/sections/Contact";

export default function Home() {
  return (
    <>
      <SmoothScroll />
      <Navbar />
      <main>
        <Hero />
        <WaterJourney />
        <Services />
        <WaterQuality />
        <CityMap />
        <Projects />
        <News />
        <CustomerServices />
      </main>
      <Contact />
      <OutageBanner />
    </>
  );
}
