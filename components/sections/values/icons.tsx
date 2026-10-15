import type { values } from "@/lib/content";

type ValueId = (typeof values.items)[number]["id"];

/** Зураасан тэмдэг (24×24) — currentColor */
export function Icon({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden className={className}>
      {children}
    </svg>
  );
}

/** Алсын хараа — нүд */
export const visionIcon = (
  <>
    <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
    <circle cx="12" cy="12" r="3" />
  </>
);

/** Эрхэм зорилго — бай (дусал төвтэй) */
export const missionIcon = (
  <>
    <circle cx="12" cy="12" r="8.5" />
    <circle cx="12" cy="12" r="4.8" />
    <path d="M12 9.6s-1.6 1.8-1.6 2.9a1.6 1.6 0 003.2 0c0-1.1-1.6-2.9-1.6-2.9z" />
  </>
);

/** Үнэт зүйлс — усан дусал */
export const valuesIcon = (
  <>
    <path d="M12 3.2s-6.2 6.7-6.2 11a6.2 6.2 0 0012.4 0c0-4.3-6.2-11-6.2-11z" />
    <path d="M9.1 14.6a3 3 0 002.7 2.8" />
  </>
);

/** Үнэт зүйл бүрийн тэмдэг */
export const valueIcons: Record<ValueId, React.ReactNode> = {
  // технологийн шинэчлэл — араа
  tech: (
    <>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1" />
    </>
  ),
  // найдвартай үйлчилгээ — бамбай
  trust: (
    <>
      <path d="M12 3l7.5 3v5.5c0 4.5-3.2 8.2-7.5 9.5-4.3-1.3-7.5-5-7.5-9.5V6z" />
      <path d="M8.6 12.2l2.3 2.3 4.6-4.8" />
    </>
  ),
  // өндөр бүтээмж, төгс чанар — од
  quality: <path d="M12 3.2l2.6 5.4 5.9.8-4.3 4.1 1 5.8-5.2-2.8-5.2 2.8 1-5.8-4.3-4.1 5.9-.8z" />,
  // шуурхай, уян хатан — аянга
  agile: <path d="M13.2 2.8L5 13.4h6.2l-1.4 7.8 8.2-10.6h-6.2z" />,
};
