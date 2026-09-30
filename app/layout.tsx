import type { Metadata, Viewport } from "next";
import { Ubuntu } from "next/font/google";
import "./globals.css";

// Ubuntu: гарчиг, үндсэн текст хоёуланд. cyrillic-ext-д Ү ү Ө ө орно.
const ubuntu = Ubuntu({
  weight: ["300", "400", "500", "700"],
  subsets: ["latin", "cyrillic", "cyrillic-ext"],
  variable: "--font-ubuntu",
  display: "swap",
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
    <html lang="mn" className={ubuntu.variable}>
      <body>{children}</body>
    </html>
  );
}
