import type { Metadata } from "next";
import { notFound } from "next/navigation";
import JourneyLab from "@/components/three/journey/lab/JourneyLab";

export const metadata: Metadata = {
  title: "Усны аялал — 3D лаб",
  robots: { index: false, follow: false },
};

/** Туршилтын хуудас: production build-д NEXT_PUBLIC_ENABLE_LAB=1 байхгүй бол 404 */
export default function JourneyLabPage() {
  if (process.env.NODE_ENV === "production" && process.env.NEXT_PUBLIC_ENABLE_LAB !== "1") notFound();
  return <JourneyLab />;
}
