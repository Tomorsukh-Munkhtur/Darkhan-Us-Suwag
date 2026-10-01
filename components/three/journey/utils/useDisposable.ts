import { useEffect, useMemo, type DependencyList } from "react";

/**
 * Геометр, материалыг нэг удаа үүсгээд unmount (эсвэл deps солигдох) үед GPU нөөцийг чөлөөлнө.
 * JSX-ээр (<boxGeometry />) зарласныг R3F өөрөө чөлөөлдөг; энэ нь useMemo-гоор үүсгэсэн объектод.
 */
export function useDisposable<T extends { dispose(): void }>(create: () => T, deps: DependencyList): T {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const value = useMemo(create, deps);
  useEffect(() => () => value.dispose(), [value]);
  return value;
}
