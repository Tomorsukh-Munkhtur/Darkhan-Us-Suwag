export default function Logo() {
  return (
    <span className="flex items-center gap-3">
      <svg width="30" height="36" viewBox="0 0 30 36" fill="none" aria-hidden>
        <path
          d="M15 1C15 1 2 15.5 2 23.5C2 30.4 7.8 35 15 35C22.2 35 28 30.4 28 23.5C28 15.5 15 1 15 1Z"
          fill="url(#lg)"
        />
        <path d="M8 24c2.5 2 4.5 2 7 0s4.5-2 7 0" stroke="#020b14" strokeWidth="1.6" strokeLinecap="round" />
        <defs>
          <linearGradient id="lg" x1="15" y1="1" x2="15" y2="35">
            <stop stopColor="#7fe7ff" />
            <stop offset="1" stopColor="#1590d6" />
          </linearGradient>
        </defs>
      </svg>
      <span className="leading-tight">
        <span className="block font-display text-[13px] font-semibold tracking-wide">ДАРХАН</span>
        <span className="block text-[10px] tracking-[0.3em] text-mist">УС СУВАГ</span>
      </span>
    </span>
  );
}
