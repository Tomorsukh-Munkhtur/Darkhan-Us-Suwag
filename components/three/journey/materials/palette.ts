/**
 * Усны аяллын 3D диорамын өнгө. Одоогийн SVG зураглал (components/sections/journey/Visuals.tsx)
 * болон app/globals.css-ийн dark token-оос авсан: цэнхэр = цэвэр ус, ногоон = цэвэршүүлэлт,
 * шар = гэрийн гэрэл.
 */
export const C = {
  // ус, тодотгол
  water: "#38b6f0",
  aqua: "#5fd3f7",
  foam: "#bff0ff",
  waterDeep: "#1c86c6",
  ink: "#e4f2fb",
  mist: "#8fb3c9",
  line: "#3f78a0",
  // дэвсгэр, гадаргуу
  surface: "#0f3a5e",
  deep: "#0b2e4c",
  abyss: "#041a2e",
  night: "#0a2a45",
  // газар, уул
  mountainA: "#2c68a3",
  mountainB: "#3a86c4",
  ground: "#16384f",
  lawn: "#123d4a",
  soilA: "#4a4331",
  soilB: "#3a3427",
  clay: "#2b3240",
  bedrock: "#10263b",
  aquiferBase: "#0f4670",
  plate: "#15395a",
  foundation: "#0c2740",
  // цэвэршүүлэлт
  murk: "#6d5a36",
  dirt: "#a68a55",
  sand: "#8c7b52",
  gravel: "#5e5646",
  carbon: "#1d2733",
  green: "#34c28a",
  // барилга, гэр
  wall: "#1d4c72",
  roof: "#123a5c",
  buildingDark: "#16405f",
  window: "#10263b",
  warm: "#ffc94d",
  metal: "#9fb4c4",
  metalDark: "#3e5669",
} as const;
