import Image from "next/image";

/** Зөвхөн сүлд (бичиггүй). Хэмжээг className-ээр өгнө. */
export function LogoMark({ size, preload = false, className }: { size: number; preload?: boolean; className?: string }) {
  return (
    <Image
      src="/logo.png"
      alt="Дархан Ус Суваг ОНӨААТҮГ-ын лого"
      width={size}
      height={size}
      preload={preload}
      className={className}
    />
  );
}

export default function Logo() {
  return (
    <span className="flex items-center gap-3">
      <LogoMark size={52} className="h-11 w-11 md:h-13 md:w-13" />
      <span className="leading-tight">
        <span className="block font-display text-[13px] font-semibold tracking-wide">ДАРХАН</span>
        <span className="block text-[10px] tracking-[0.3em] text-mist">УС СУВАГ</span>
      </span>
    </span>
  );
}
