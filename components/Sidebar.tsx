import React from "react";
import StructureInfoPanel from "./sidebar/StructureInfoPanel";
import LoadPanel from "./sidebar/LoadPanel";
import DisplayOptionsPanel from "./sidebar/DisplayOptionsPanel";
import ViewControlsPanel from "./sidebar/ViewControlsPanel";
import { StructureInfo, LoadValues, DisplayOptions } from "@/lib/types";

interface SidebarProps {
  structureInfo: StructureInfo;
  selectedLoadJoint: number | null;
  loadValues: LoadValues;
  modifyLoad: (axis: "fx" | "fy", direction: "plus" | "minus") => void;
  clearLoad: () => void;
  showLoadPanel: boolean;
  displayOptions: DisplayOptions;
  setDisplayOptions: (options: DisplayOptions) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetView: () => void;
  zoomLevel: number;
  isDarkMode: boolean;
}

export default function Sidebar(props: SidebarProps) {
  return (
    <div
      className={`w-80 ${
        props.isDarkMode
          ? "bg-slate-800 border-slate-700"
          : "bg-white border-gray-200"
      } border-l shadow-2xl`}
    >
      <div className="h-full overflow-y-auto p-6 space-y-6">
        <StructureInfoPanel
          structureInfo={props.structureInfo}
          isDarkMode={props.isDarkMode}
        />
        {props.showLoadPanel && (
          <LoadPanel
            selectedLoadJoint={props.selectedLoadJoint}
            loadValues={props.loadValues}
            onModifyLoad={props.modifyLoad}
            onClearLoad={props.clearLoad}
            isDarkMode={props.isDarkMode}
          />
        )}
        <DisplayOptionsPanel
          displayOptions={props.displayOptions}
          setDisplayOptions={props.setDisplayOptions}
          isDarkMode={props.isDarkMode}
        />
        <ViewControlsPanel
          zoomIn={props.zoomIn}
          zoomOut={props.zoomOut}
          resetView={props.resetView}
          zoomLevel={props.zoomLevel}
          isDarkMode={props.isDarkMode}
        />
      </div>
    </div>
  );
}