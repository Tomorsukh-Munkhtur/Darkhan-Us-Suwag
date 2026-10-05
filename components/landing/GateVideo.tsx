"use client";

import { useEffect, useRef } from "react";

/** Нүүр хуудасны танилцуулгын хагасын дроны бичлэг: дуугүй давталт; хөдөлгөөн багасгах тохиргоотой үед зогсоод эхний кадр (poster) үлдэнэ */
export default function GateVideo({ src, poster, className = "" }: { src: string; poster: string; className?: string }) {
  const video = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const v = video.current;
    if (!v) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => {
      if (mq.matches) {
        v.pause();
        v.currentTime = 0;
      } else v.play().catch(() => {});
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  return <video ref={video} src={src} poster={poster} muted loop playsInline preload="metadata" aria-hidden className={className} />;
}
