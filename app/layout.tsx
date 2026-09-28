import type { Metadata, Viewport } from "next";
import { Manrope, Unbounded } from "next/font/google";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin", "cyrillic", "cyrillic-ext"],
  variable: "--font-manrope",
  display: "swap",
});

const unbounded = Unbounded({
  subsets: ["latin", "cyrillic", "cyrillic-ext"],
  variable: "--font-unbounded",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Дархан Ус Суваг — Ус бүхний эхлэл",
  description:
    "Дархан хотын ус хангамж, ариутгах татуургын цогц үйлчилгээ. Цэвэр усны эх үүсвэрээс таны гэр хүртэл.",
};

export const viewport: Viewport = {
  themeColor: "#020b14",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="mn" className={`${manrope.variable} ${unbounded.variable}`}>
      <body>{children}</body>
    </html>
  );
}
