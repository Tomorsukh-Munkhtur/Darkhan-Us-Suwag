"use client";

import { memo } from "react";
import JourneyCanvas, { type JourneyScene3DProps } from "./JourneyCanvas";
import SourceScene from "./scenes/SourceScene";
import PumpScene from "./scenes/PumpScene";
import TreatmentScene from "./scenes/TreatmentScene";
import ReservoirScene from "./scenes/ReservoirScene";
import NetworkScene from "./scenes/NetworkScene";
import HomeScene from "./scenes/HomeScene";

export type { JourneyScene3DProps };

/** Усны аяллын 6 үе шат (НЭГ canvas — JourneyCanvas) */
function JourneyScene3D(props: JourneyScene3DProps) {
  const rt = props.driver.rt;
  return (
    <JourneyCanvas {...props}>
      <SourceScene rt={rt} index={0} />
      <PumpScene rt={rt} index={1} />
      <TreatmentScene rt={rt} index={2} />
      <ReservoirScene rt={rt} index={3} />
      <NetworkScene rt={rt} index={4} />
      <HomeScene rt={rt} index={5} />
    </JourneyCanvas>
  );
}

export default memo(JourneyScene3D);
