"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Header from "@/components/Header";
import BridgeCanvas from "@/components/BridgeCanvas";
import Sidebar from "@/components/Sidebar";
import StatusBar from "@/components/StatusBar";
import { useBridgeSimulation } from "@/hooks/useBridgeSimulation";
import {
  Tool,
  DisplayOptions,
  StructureInfo,
  LoadValues,
  Joint,
  AnchorType,
} from "@/lib/types";
import { LOAD_INCREMENT_STEP, FLOAT_TOLERANCE } from "@/lib/constants";

const toolKeyMap: Record<string, Tool> = {
  j: "joint",
  b: "beam",
  l: "load",
  a: "anchor",
  s: "select",
};

export default function BridgeSimPage() {
  const [currentTool, setCurrentTool] = useState<Tool>("joint");
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [displayOptions, setDisplayOptions] = useState<DisplayOptions>({
    grid: true,
    forces: true,
    reactions: true,
  });
  const [zoomLevel, setZoomLevel] = useState(100);

  const {
    simulationState,
    addJoint: simAddJoint,
    addBeam,
    toggleAnchor,
    setLoad,
    deleteJoint,
    deleteBeam,
    resetStructure: simResetStructure,
    undoLastAction: simUndoLastAction,
  } = useBridgeSimulation();

  const [selectedElement, setSelectedElement] = useState<{
    type: "joint" | "beam";
    id: number;
  } | null>(null);
  const [selectedJointForLoad, setSelectedJointForLoad] = useState<
    number | null
  >(null);
  const [loadValues, setLoadValues] = useState<LoadValues>({ fx: 0, fy: 0 });
  const [showLoadPanel, setShowLoadPanel] = useState(false);
  const [statusMessage, setStatusMessage] = useState(
    simulationState.last_failure_reason
  );

  useEffect(() => {
    setStatusMessage(simulationState.last_failure_reason);
  }, [simulationState.last_failure_reason]);

  const handleSetCurrentTool = useCallback((tool: Tool) => {
    setCurrentTool(tool);
    if (tool !== "select") {
      setSelectedElement(null);
    }
    if (tool !== "load") {
      setSelectedJointForLoad(null);
      setShowLoadPanel(false);
    }
  }, []);

  const handleElementSelected = useCallback(
    (element: { type: "joint" | "beam"; id: number } | null) => {
      setSelectedElement(element);
    },
    []
  );

  const handleJointSelectedForLoad = useCallback(
    (jointIdx: number | null) => {
      setSelectedJointForLoad(jointIdx);
      if (
        jointIdx !== null &&
        simulationState.joints[jointIdx] &&
        simulationState.joints[jointIdx].anchor_type === null
      ) {
        setLoadValues({
          fx: simulationState.joints[jointIdx].load[0],
          fy: simulationState.joints[jointIdx].load[1],
        });
        setShowLoadPanel(true);
      } else {
        setShowLoadPanel(false);
        if (
          jointIdx !== null &&
          simulationState.joints[jointIdx]?.anchor_type !== null
        ) {
          setStatusMessage("Anchors cannot have direct external loads.");
        }
      }
    },
    [simulationState.joints]
  );

  const handleAddJoint = useCallback(
    (
      x: number,
      y: number,
      isAnchor: boolean,
      anchorTypeIfAnchor?: AnchorType | null
    ) => {
      simAddJoint(x, y, isAnchor, anchorTypeIfAnchor);
    },
    [simAddJoint]
  );

  const modifyLoad = useCallback(
    (axis: "fx" | "fy", direction: "plus" | "minus") => {
      if (selectedJointForLoad !== null) {
        const joint = simulationState.joints[selectedJointForLoad];
        if (joint && joint.anchor_type === null) {
          let newFx = joint.load[0];
          let newFy = joint.load[1];
          const increment =
            direction === "plus" ? LOAD_INCREMENT_STEP : -LOAD_INCREMENT_STEP;
          if (axis === "fx") newFx += increment;
          else newFy += increment;
          setLoad(selectedJointForLoad, newFx, newFy);
          setLoadValues({ fx: newFx, fy: newFy });
        }
      }
    },
    [selectedJointForLoad, simulationState.joints, setLoad]
  );

  const clearLoad = useCallback(() => {
    if (selectedJointForLoad !== null) {
      setLoad(selectedJointForLoad, 0, 0);
      setLoadValues({ fx: 0, fy: 0 });
    }
  }, [selectedJointForLoad, setLoad]);

  const deleteSelected = useCallback(() => {
    if (selectedElement) {
      if (selectedElement.type === "joint") {
        const jointIdToDelete = selectedElement.id;
        deleteJoint(jointIdToDelete);
        if (selectedJointForLoad === jointIdToDelete) {
          handleJointSelectedForLoad(null);
        }
      } else {
        deleteBeam(selectedElement.id);
      }
      setSelectedElement(null);
    }
  }, [
    selectedElement,
    deleteJoint,
    deleteBeam,
    selectedJointForLoad,
    handleJointSelectedForLoad,
  ]);

  const undoAction = useCallback(() => {
    simUndoLastAction();
    setSelectedElement(null);
    handleJointSelectedForLoad(null);
  }, [simUndoLastAction, handleJointSelectedForLoad]);

  const resetStructure = useCallback(() => {
    simResetStructure();
    setSelectedElement(null);
    handleJointSelectedForLoad(null);
    setZoomLevel(100);
    if (typeof (window as any).canvasResetView === "function") {
      (window as any).canvasResetView();
    }
  }, [simResetStructure, handleJointSelectedForLoad]);

  const resetCanvasView = useCallback(() => {
    if (typeof (window as any).canvasResetView === "function") {
      (window as any).canvasResetView();
      setZoomLevel(100);
    }
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement
      )
        return;
      const tool = toolKeyMap[event.key.toLowerCase()];
      if (tool) {
        event.preventDefault();
        handleSetCurrentTool(tool);
      }
      if (event.key.toLowerCase() === "u") {
        event.preventDefault();
        undoAction();
      }
      if (event.key.toLowerCase() === "r") {
        event.preventDefault();
        resetStructure();
      }
      if (event.key.toLowerCase() === "v") {
        event.preventDefault();
        resetCanvasView();
      }
      if (
        (event.key.toLowerCase() === "delete" ||
          event.key.toLowerCase() === "backspace") &&
        selectedElement
      ) {
        event.preventDefault();
        deleteSelected();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    handleSetCurrentTool,
    selectedElement,
    undoAction,
    resetStructure,
    deleteSelected,
    resetCanvasView,
  ]);

  const structureInfo = useMemo<StructureInfo>(
    () => ({
      joints: simulationState.joints.length,
      beams: simulationState.beams.length,
      anchors: simulationState.joints.filter(
        (j: Joint) => j.anchor_type !== null
      ).length,
      loads: simulationState.joints.reduce((count: number, j: Joint) => {
        return (
          count +
          (Math.abs(j.load[0]) > FLOAT_TOLERANCE ||
          Math.abs(j.load[1]) > FLOAT_TOLERANCE
            ? 1
            : 0)
        );
      }, 0),
    }),
    [simulationState.joints, simulationState.beams]
  );

  const zoomIn = useCallback(() => {
    if (typeof (window as any).canvasZoomIn === "function")
      (window as any).canvasZoomIn();
  }, []);
  const zoomOut = useCallback(() => {
    if (typeof (window as any).canvasZoomOut === "function")
      (window as any).canvasZoomOut();
  }, []);
  const reportCanvasStatus = useCallback(
    (message: string, success?: boolean) => {
      setStatusMessage(message);
    },
    []
  );

  return (
    <div className="bg-gray-50 dark:bg-slate-900 flex flex-col h-screen overflow-hidden antialiased">
      <Header
        currentTool={currentTool}
        setCurrentTool={handleSetCurrentTool}
        isDarkMode={isDarkMode}
        setIsDarkMode={setIsDarkMode}
        undoAction={undoAction}
        resetStructure={resetStructure}
        deleteSelected={deleteSelected}
        selectedElementForDelete={selectedElement}
      />
      <div className="flex flex-grow overflow-hidden">
        <div className="flex-grow relative bg-gradient-to-br from-gray-100 to-gray-200 dark:from-slate-800 dark:to-slate-900">
          <BridgeCanvas
            simulationState={simulationState}
            currentTool={currentTool}
            displayOptions={displayOptions}
            isDarkMode={isDarkMode}
            onAddJoint={handleAddJoint}
            onAddBeam={addBeam}
            onToggleAnchor={toggleAnchor}
            onJointSelectedForLoad={handleJointSelectedForLoad}
            onElementSelected={handleElementSelected}
            updateZoomLevel={setZoomLevel}
            reportStatus={reportCanvasStatus}
            selectedElement={selectedElement}
          />
          <div className="absolute top-4 left-4 bg-white/90 dark:bg-slate-800/90 border-gray-200 dark:border-slate-700 backdrop-blur-sm rounded-xl p-3 shadow-xl border">
            <div className="text-xs text-gray-500 dark:text-slate-400 mb-1">
              Current Tool
            </div>
            <div className="text-sm font-medium text-gray-800 dark:text-white capitalize">
              {currentTool}
            </div>
          </div>
        </div>
        <Sidebar
          structureInfo={structureInfo}
          selectedLoadJoint={selectedJointForLoad}
          loadValues={loadValues}
          modifyLoad={modifyLoad}
          clearLoad={clearLoad}
          showLoadPanel={showLoadPanel}
          displayOptions={displayOptions}
          setDisplayOptions={setDisplayOptions}
          zoomIn={zoomIn}
          zoomOut={zoomOut}
          resetView={resetCanvasView}
          zoomLevel={zoomLevel}
          isDarkMode={isDarkMode}
        />
      </div>
      <StatusBar
        statusMessage={statusMessage}
        calculationSuccess={simulationState.calculation_success}
        isDarkMode={isDarkMode}
      />
    </div>
  );
}
