import type { Metadata, Viewport } from "next";
import { Manrope, Unbounded } from "next/font/google";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin", "cyrillic", "cyrillic-ext"],
  variable: "--font-manrope",
  display: "swap",
});

// Unbounded-д Ү ү Ө ө үсэг байхгүй → Arial fallback-ын оронд Manrope-оор харагдуулна (globals.css --font-display)
const unbounded = Unbounded({
  subsets: ["latin", "cyrillic", "cyrillic-ext"],
  variable: "--font-unbounded",
  display: "swap",
  adjustFontFallback: false,
});

export const metadata: Metadata = {
  title: "Дархан Ус Суваг — Ус бүхний эхлэл",
  description:
    "Дархан хотын ус хангамж, ариутгах татуургын цогц үйлчилгээ. Цэвэр усны эх үүсвэрээс таны гэр хүртэл.",
};

export const viewport: Viewport = {
  themeColor: "#f5fbff",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="mn" className={`${manrope.variable} ${unbounded.variable}`}>
      <body>{children}</body>
    </html>
  );
}
