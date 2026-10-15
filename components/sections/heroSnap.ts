import { glideTo } from "@/lib/lenis";

/**
 * Hero-ийн шумбалтын "нэг скролл = нэг алхам": anchors (px, өсөх дараалал) — [гадаргуу, усан доорх агуулга, төгсгөл].
 * Эхний ба сүүлийн anchor-ийн хооронд хулганы дугуй, хуруугаар шударах, гарын товч нэг л удаа хөдөлмөгц
 * дараагийн/өмнөх anchor руу өөрөө гулсана (timeline нь scroll-оор scrub хийгддэг тул анимац өөрөө тоглоно).
 * Төгсгөлөөс доош — ердийн гүйлгэлт. Гүйлгэх мөрөөр (scrollbar, inertia) дунд нь зогсвол хамгийн ойрын
 * чиглэлийн anchor руу гулсана.
 */
export function createHeroSnap(anchors: () => number[]) {
  const EPS = 4;
  let busy = false;
  let cooldownUntil = 0;
  let lastY = window.scrollY;
  let settleTimer = 0;

  /** dir чиглэлд дараагийн anchor; бүсээс гадна бол null */
  const next = (y: number, dir: 1 | -1) => {
    const a = anchors();
    const end = a[a.length - 1];
    if (dir > 0) {
      if (y >= end - EPS) return null;
      return a.find((v) => v > y + EPS) ?? null;
    }
    if (y > end + EPS || y <= a[0] + EPS) return null;
    return [...a].reverse().find((v) => v < y - EPS) ?? null;
  };

  const go = (target: number) => {
    busy = true;
    const dist = Math.abs(target - window.scrollY) / window.innerHeight;
    glideTo(target, Math.min(1.6, 0.7 + dist * 0.55), () => {
      busy = false;
      lastY = window.scrollY;
      // trackpad-ийн inertia-ийн үлдэгдэл дараагийн алхмыг өдөөхгүй
      cooldownUntil = performance.now() + 450;
    });
  };

  /** true — оролтыг бид хариуцна (хөтөч/Lenis гүйлгэхгүй) */
  const step = (dir: 1 | -1) => {
    if (document.documentElement.classList.contains("menu-open")) return false;
    const y = window.scrollY;
    if (busy) return true;
    if (performance.now() < cooldownUntil) {
      // гулсалтын дараах inertia: бүсэд (төгсгөлийг оруулаад) залгина — хэтэрч гүйхгүй
      const a = anchors();
      return y >= a[0] - EPS && y <= a[a.length - 1] + EPS;
    }
    const t = next(y, dir);
    if (t === null) return false;
    go(t);
    return true;
  };

  const swallow = (e: Event) => {
    e.preventDefault();
    e.stopImmediatePropagation();
  };

  const onWheel = (e: WheelEvent) => {
    if (e.ctrlKey || Math.abs(e.deltaY) < 2 || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
    if (step(e.deltaY > 0 ? 1 : -1)) swallow(e);
  };

  // хуруу: эхний мэдэгдэхүйц хөдөлгөөнөөр чиглэлийг тодорхойлж, бүсэд бол тэр шударалтыг бүхэлд нь бид хариуцна
  let touchY: number | null = null;
  let touchMode: "own" | "native" | null = null;
  const onTouchStart = (e: TouchEvent) => {
    touchY = e.touches[0]?.clientY ?? null;
    touchMode = null;
  };
  const onTouchMove = (e: TouchEvent) => {
    if (touchY === null || e.touches.length > 1) return;
    if (touchMode === "own") return swallow(e);
    if (touchMode === "native") return;
    const dy = touchY - e.touches[0].clientY;
    if (Math.abs(dy) < 10) {
      // чиглэл тодорхой болох хүртэл бүсэд хөтөч гүйлгэхгүй
      if (next(window.scrollY, 1) !== null || busy) e.preventDefault();
      return;
    }
    touchMode = step(dy > 0 ? 1 : -1) ? "own" : "native";
    if (touchMode === "own") swallow(e);
  };
  const onTouchEnd = () => {
    touchY = null;
    touchMode = null;
  };

  const onKey = (e: KeyboardEvent) => {
    const el = e.target as HTMLElement | null;
    if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
    const down = e.key === "ArrowDown" || e.key === "PageDown" || (e.key === " " && !e.shiftKey);
    const up = e.key === "ArrowUp" || e.key === "PageUp" || (e.key === " " && e.shiftKey);
    if (!down && !up) return;
    if (step(down ? 1 : -1)) swallow(e);
  };

  // scrollbar, inertia, anchor-оор дунд нь зогсвол — хөдөлсөн чиглэлийн anchor руу
  const onScroll = () => {
    window.clearTimeout(settleTimer);
    if (busy) return;
    settleTimer = window.setTimeout(() => {
      if (busy) return;
      const y = window.scrollY;
      const a = anchors();
      const inside = y > a[0] + EPS && y < a[a.length - 1] - EPS;
      const atAnchor = a.some((v) => Math.abs(v - y) <= EPS);
      if (inside && !atAnchor) {
        // anchor-д ойрхон бол (жишээ нь navbar-ын #journey холбоос offset-тэй ирсэн) тэр рүү; үгүй бол хөдөлсөн чиглэлд
        const near = a.reduce((b, v) => (Math.abs(v - y) < Math.abs(b - y) ? v : b));
        const t = Math.abs(near - y) < window.innerHeight * 0.2 ? near : next(y, y >= lastY ? 1 : -1);
        if (t !== null) go(t);
      } else lastY = y;
    }, 180);
  };

  // эхлэх үед (дахин ачаалах, hydration-аас өмнө гүйлгэсэн) бүсийн дунд байвал хамгийн ойрын anchor руу
  const initial = window.setTimeout(() => {
    const y = window.scrollY;
    const a = anchors();
    if (busy || y <= a[0] + EPS || y >= a[a.length - 1] - EPS || a.some((v) => Math.abs(v - y) <= EPS)) return;
    go(a.reduce((b, v) => (Math.abs(v - y) < Math.abs(b - y) ? v : b)));
  }, 300);

  const opt = { passive: false, capture: true } as const;
  window.addEventListener("wheel", onWheel, opt);
  window.addEventListener("touchstart", onTouchStart, { passive: true, capture: true });
  window.addEventListener("touchmove", onTouchMove, opt);
  window.addEventListener("touchend", onTouchEnd, { capture: true });
  window.addEventListener("keydown", onKey, { capture: true });
  window.addEventListener("scroll", onScroll, { passive: true });

  return () => {
    window.clearTimeout(initial);
    window.clearTimeout(settleTimer);
    window.removeEventListener("wheel", onWheel, opt);
    window.removeEventListener("touchstart", onTouchStart, { capture: true });
    window.removeEventListener("touchmove", onTouchMove, opt);
    window.removeEventListener("touchend", onTouchEnd, { capture: true });
    window.removeEventListener("keydown", onKey, { capture: true });
    window.removeEventListener("scroll", onScroll);
  };
}
