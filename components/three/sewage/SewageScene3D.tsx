"use client";

import { memo } from "react";
import JourneyCanvas, { type JourneyScene3DProps } from "../journey/JourneyCanvas";
import HomesScene from "./scenes/HomesScene";
import CollectorScene from "./scenes/CollectorScene";
import StationScene from "./scenes/StationScene";
import PlantScene from "./scenes/PlantScene";
import OutfallScene from "./scenes/OutfallScene";

/** Бохир усны аяллын 5 үе шат (НЭГ canvas — JourneyCanvas; тохиргоо нь sewage/stages.ts) */
function SewageScene3D(props: JourneyScene3DProps) {
  const rt = props.driver.rt;
  return (
    <JourneyCanvas {...props}>
      <HomesScene rt={rt} index={0} />
      <CollectorScene rt={rt} index={1} />
      <StationScene rt={rt} index={2} />
      <PlantScene rt={rt} index={3} />
      <OutfallScene rt={rt} index={4} />
    </JourneyCanvas>
  );
}

export default memo(SewageScene3D);
