export const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

/** r нь [a, b] завсарт 0→1 шугаман явц */
export const seg = (r: number, a: number, b: number) => clamp01((r - a) / (b - a));

export const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;

export const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

export const easeOutBack = (t: number) => {
  const c1 = 1.5;
  const c3 = c1 + 1;
  return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
};

/** r нь [a, b] завсарт 0→1 зөөлөрсөн (ease-out) явц */
export const ramp = (r: number, a: number, b: number) => easeOutCubic(seg(r, a, b));

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
