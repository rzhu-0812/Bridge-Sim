"use client";

import React, { useRef, useEffect, useCallback } from "react";
import {
  Tool,
  DisplayOptions,
  SimulationState,
  AnchorType,
  Joint,
} from "@/lib/types";
import {
  GRID_SIZE,
  JOINT_RADIUS,
  HIGHLIGHT_RADIUS,
  ANCHOR_Y_WORLD_THRESHOLD,
  FLOAT_TOLERANCE,
  MAX_FORCE_VIS,
  BEAM_HOVER_THRESHOLD,
  MIN_CAMERA_ZOOM,
  MAX_CAMERA_ZOOM,
  DEFAULT_CAMERA_ZOOM,
  ANCHOR_COLOR_PIN,
  ANCHOR_COLOR_ROLLER_VERTICAL,
  ANCHOR_COLOR_ROLLER_HORIZONTAL,
  ANCHOR_SECONDARY_PIN,
  ANCHOR_GLOW_PIN,
  ANCHOR_SECONDARY_ROLLER_VERTICAL,
  ANCHOR_GLOW_ROLLER_VERTICAL,
  ANCHOR_SECONDARY_ROLLER_HORIZONTAL,
  ANCHOR_GLOW_ROLLER_HORIZONTAL,
} from "@/lib/constants";
import { snapToGrid, getClosestJoint, getClosestBeam } from "@/lib/utils";

interface BridgeCanvasProps {
  simulationState: SimulationState;
  currentTool: Tool;
  displayOptions: DisplayOptions;
  isDarkMode: boolean;
  onAddJoint: (
    x: number,
    y: number,
    isAnchor: boolean,
    anchorTypeIfAnchor?: AnchorType | null
  ) => void;
  onAddBeam: (joint1_idx: number, joint2_idx: number) => void;
  onToggleAnchor: (joint_idx: number) => void;
  onJointSelectedForLoad: (joint_idx: number | null) => void;
  selectedElement: { type: "joint" | "beam"; id: number } | null;
  onElementSelected: (
    element: { type: "joint" | "beam"; id: number } | null
  ) => void;
  updateZoomLevel: (level: number) => void;
  reportStatus: (message: string, success?: boolean) => void;
}

const getColors = (darkMode: boolean) => ({
  BACKGROUND_APP: darkMode ? "#0f172a" : "#f8fafc",
  CANVAS_BACKGROUND_START: darkMode ? "#1e293b" : "#ffffff",
  CANVAS_BACKGROUND_END: darkMode ? "#334155" : "#f1f5f9",
  GRID: darkMode ? "rgba(148, 163, 184, 0.3)" : "rgba(100, 116, 139, 0.2)",
  JOINT: darkMode ? "#3b82f6" : "#2563eb",
  JOINT_SECONDARY: darkMode ? "#1e40af" : "#1d4ed8",
  JOINT_GLOW: darkMode ? "rgba(59, 130, 246, 0.4)" : "rgba(37, 99, 235, 0.3)",
  JOINT_HIGHLIGHT: darkMode
    ? "rgba(255, 255, 255, 0.3)"
    : "rgba(255, 255, 255, 0.8)",

  ANCHOR_BASE_GROUND_LINES: darkMode ? "#064e3b" : "#047857",

  ANCHOR_PIN_PRIMARY: ANCHOR_COLOR_PIN,
  ANCHOR_PIN_SECONDARY: ANCHOR_SECONDARY_PIN,
  ANCHOR_PIN_GLOW: ANCHOR_GLOW_PIN,

  ANCHOR_ROLLER_VERTICAL_PRIMARY: ANCHOR_COLOR_ROLLER_VERTICAL,
  ANCHOR_ROLLER_VERTICAL_SECONDARY: ANCHOR_SECONDARY_ROLLER_VERTICAL,
  ANCHOR_ROLLER_VERTICAL_GLOW: ANCHOR_GLOW_ROLLER_VERTICAL,

  ANCHOR_ROLLER_HORIZONTAL_PRIMARY: ANCHOR_COLOR_ROLLER_HORIZONTAL,
  ANCHOR_ROLLER_HORIZONTAL_SECONDARY: ANCHOR_SECONDARY_ROLLER_HORIZONTAL,
  ANCHOR_ROLLER_HORIZONTAL_GLOW: ANCHOR_GLOW_ROLLER_HORIZONTAL,

  BEAM_MATERIAL_LIGHT: darkMode ? "#a8a29e" : "#d6d3d1",
  BEAM_MATERIAL_DARK: darkMode ? "#57534e" : "#78716c",
  BEAM_GLOW: darkMode ? "rgba(139, 92, 246, 0.3)" : "rgba(124, 58, 237, 0.2)",
  HIGHLIGHT_PROBLEM: "#ef4444",
  SELECTION_BEAM_START: darkMode ? "#06b6d4" : "#0891b2",
  SELECTED_FOR_LOAD_HIGHLIGHT: "#f59e0b",
  SELECTED_ELEMENT: "#22c55e",
  TEMP_BEAM: darkMode ? "rgba(148, 163, 184, 0.6)" : "rgba(100, 116, 139, 0.5)",
  LOAD_ARROW: "#f59e0b",
  LOAD_TEXT: darkMode ? "#fbbf24" : "#d97706",
  REACTION_ARROW: darkMode ? "#06b6d4" : "#0891b2",
  REACTION_TEXT: darkMode ? "#0891b2" : "#0e7490",
  HOVER_TEXT: darkMode ? "#e2e8f0" : "#1e293b",
  HOVER_BACKGROUND: darkMode
    ? "rgba(30, 41, 59, 0.9)"
    : "rgba(241, 245, 249, 0.9)",
});

export default function BridgeCanvas({
  simulationState,
  currentTool,
  displayOptions,
  isDarkMode,
  onAddJoint,
  onAddBeam,
  onToggleAnchor,
  onJointSelectedForLoad,
  selectedElement,
  onElementSelected,
  updateZoomLevel,
  reportStatus,
}: BridgeCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const COLORS = getColors(isDarkMode);

  const cameraZoomRef = useRef(DEFAULT_CAMERA_ZOOM);
  const cameraPanOffsetRef = useRef({ x: 0, y: 0 });
  const isPanningRef = useRef(false);
  const panStartScreenRef = useRef({ x: 0, y: 0 });
  const mouseScreenPosRef = useRef({ x: 0, y: 0 });

  const tempBeamStartJointIdxRef = useRef<number | null>(null);
  const locallySelectedJointForLoadRef = useRef<number | null>(null);
  const hoveredBeamIdxRef = useRef<number>(-1);
  const hoveredBeamTooltipPosRef = useRef<{ x: number; y: number } | null>(
    null
  );
  const requestRedrawRef = useRef<() => void>(() => {});

  const worldToScreen = useCallback(
    (worldPos: { x: number; y: number }) => {
      const x =
        worldPos.x * cameraZoomRef.current + cameraPanOffsetRef.current.x;
      const y =
        worldPos.y * cameraZoomRef.current + cameraPanOffsetRef.current.y;
      return { x, y };
    },
    [cameraZoomRef, cameraPanOffsetRef]
  );

  const screenToWorld = useCallback(
    (screenPos: { x: number; y: number }) => {
      if (cameraZoomRef.current === 0) return { x: 0, y: 0 };
      const x =
        (screenPos.x - cameraPanOffsetRef.current.x) / cameraZoomRef.current;
      const y =
        (screenPos.y - cameraPanOffsetRef.current.y) / cameraZoomRef.current;
      return { x, y };
    },
    [cameraZoomRef, cameraPanOffsetRef]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number | null = null;
    let canvasWidth = 0,
      canvasHeight = 0;

    const resizeCanvas = () => {
      const container = canvas.parentElement;
      if (!container) return;
      canvasWidth = container.clientWidth;
      canvasHeight = container.clientHeight;
      canvas.width = canvasWidth;
      canvas.height = canvasHeight;
      if (
        cameraPanOffsetRef.current.x === 0 &&
        cameraPanOffsetRef.current.y === 0 &&
        canvasWidth > 0
      ) {
        cameraPanOffsetRef.current = {
          x: canvasWidth / 2,
          y: canvasHeight / 2,
        };
      }
      requestRedrawRef.current();
    };
    const drawGrid = () => {
      if (!displayOptions.grid) return;
      ctx.strokeStyle = COLORS.GRID;
      ctx.lineWidth = Math.min(1, Math.max(0.2, 0.5 / cameraZoomRef.current));
      const worldTopLeft = screenToWorld({ x: 0, y: 0 });
      const worldBottomRight = screenToWorld({
        x: canvasWidth,
        y: canvasHeight,
      });
      const x_start = Math.floor(worldTopLeft.x / GRID_SIZE) * GRID_SIZE;
      const x_end = Math.ceil(worldBottomRight.x / GRID_SIZE) * GRID_SIZE;
      for (let x_w = x_start; x_w <= x_end; x_w += GRID_SIZE) {
        const sx = Math.round(worldToScreen({ x: x_w, y: 0 }).x);
        ctx.beginPath();
        ctx.moveTo(sx + 0.5, 0);
        ctx.lineTo(sx + 0.5, canvasHeight);
        ctx.stroke();
      }
      const y_start = Math.floor(worldTopLeft.y / GRID_SIZE) * GRID_SIZE;
      const y_end = Math.ceil(worldBottomRight.y / GRID_SIZE) * GRID_SIZE;
      for (let y_w = y_start; y_w <= y_end; y_w += GRID_SIZE) {
        const sy = Math.round(worldToScreen({ x: 0, y: y_w }).y);
        ctx.beginPath();
        ctx.moveTo(0, sy + 0.5);
        ctx.lineTo(canvasWidth, sy + 0.5);
        ctx.stroke();
      }
    };

    const drawArrow = (
      startScreenPos: { x: number; y: number },
      vector: { rx?: number; ry?: number },
      color: string,
      textColor: string,
      isReaction = false
    ) => {
      const arrowScreenLen =
        25 * Math.min(1.5, Math.max(0.5, cameraZoomRef.current));
      const textOffset = 5;
      const baseFontSize = 10;
      const scaledFontSize = Math.max(
        8,
        baseFontSize * Math.min(1.2, Math.max(0.7, cameraZoomRef.current))
      );
      ctx.font = `${scaledFontSize}px Arial`;
      ctx.fillStyle = textColor;
      ctx.strokeStyle = color;
      ctx.lineWidth = isReaction
        ? Math.max(1.5, 2.5 * cameraZoomRef.current)
        : Math.max(1, 2 * cameraZoomRef.current);
      const sX = Math.round(startScreenPos.x);
      const sY = Math.round(startScreenPos.y);
      const effectiveJointRadius =
        JOINT_RADIUS *
        1.8 *
        Math.min(1.5, Math.max(0.5, cameraZoomRef.current));

      if (vector.ry !== undefined && Math.abs(vector.ry) > FLOAT_TOLERANCE) {
        const valY = vector.ry;
        const arrowDirY = isReaction ? (valY > 0 ? -1 : 1) : valY > 0 ? 1 : -1;
        const startY = sY + (effectiveJointRadius * 0.6 + 2) * arrowDirY;
        const endY = startY + arrowScreenLen * arrowDirY;
        ctx.beginPath();
        ctx.moveTo(sX, startY);
        ctx.lineTo(sX, endY);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(sX, endY);
        ctx.lineTo(sX - 4, endY - arrowDirY * 6);
        ctx.lineTo(sX + 4, endY - arrowDirY * 6);
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill();
        const text = (isReaction ? "Ry:" : "Fy:") + `${valY.toFixed(0)}`;
        ctx.fillStyle = textColor;
        ctx.textAlign = "center";
        ctx.fillText(
          text,
          sX,
          arrowDirY > 0
            ? endY + scaledFontSize * 1.2
            : endY - scaledFontSize * 0.5
        );
      }
      if (vector.rx !== undefined && Math.abs(vector.rx) > FLOAT_TOLERANCE) {
        const valX = vector.rx;
        const arrowDirX = isReaction ? (valX > 0 ? -1 : 1) : valX > 0 ? 1 : -1;
        const startX = sX + (effectiveJointRadius * 0.6 + 2) * arrowDirX;
        const endX = startX + arrowScreenLen * arrowDirX;
        ctx.beginPath();
        ctx.moveTo(startX, sY);
        ctx.lineTo(endX, sY);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(endX, sY);
        ctx.lineTo(endX - arrowDirX * 6, sY - 4);
        ctx.lineTo(endX - arrowDirX * 6, sY + 4);
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill();
        const text = (isReaction ? "Rx:" : "Fx:") + `${valX.toFixed(0)}`;
        ctx.fillStyle = textColor;
        ctx.textAlign = arrowDirX > 0 ? "left" : "right";
        ctx.textBaseline = "middle";
        ctx.fillText(
          text,
          arrowDirX > 0 ? endX + textOffset : endX - textOffset,
          sY
        );
      }
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
    };

    const drawCircularJoint = (
      sX: number,
      sY: number,
      radius: number,
      isSelectedBySelectTool = false,
      isSelectedForLoad = false
    ) => {
      ctx.shadowColor = COLORS.JOINT_GLOW;
      ctx.shadowBlur = 12;
      const gradient = ctx.createRadialGradient(sX, sY, 0, sX, sY, radius);
      gradient.addColorStop(0, COLORS.JOINT);
      gradient.addColorStop(1, COLORS.JOINT_SECONDARY);
      ctx.beginPath();
      ctx.arc(sX, sY, radius, 0, 2 * Math.PI);
      ctx.fillStyle = gradient;
      ctx.fill();
      ctx.shadowBlur = 0;
      const innerRadius = radius * 0.4;
      const innerGradient = ctx.createRadialGradient(
        sX - radius * 0.2,
        sY - radius * 0.2,
        0,
        sX,
        sY,
        innerRadius
      );
      innerGradient.addColorStop(0, COLORS.JOINT_HIGHLIGHT);
      innerGradient.addColorStop(1, "transparent");
      ctx.beginPath();
      ctx.arc(sX, sY, innerRadius, 0, 2 * Math.PI);
      ctx.fillStyle = innerGradient;
      ctx.fill();
      let borderColor = COLORS.JOINT_SECONDARY;
      let borderWidth = 2;
      if (isSelectedBySelectTool) {
        borderColor = COLORS.SELECTED_ELEMENT;
        borderWidth = 3;
      } else if (isSelectedForLoad) {
        borderColor = COLORS.SELECTED_FOR_LOAD_HIGHLIGHT;
        borderWidth = 3;
      }
      ctx.beginPath();
      ctx.arc(sX, sY, radius, 0, 2 * Math.PI);
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = borderWidth;
      ctx.stroke();
    };

    const drawAnchor = (
      joint: Joint,
      sX: number,
      sY: number,
      size: number,
      isSelectedBySelectTool = false
    ) => {
      const anchorType = joint.anchor_type;
      if (!anchorType) return;
      let primaryColor: string, secondaryColor: string, glowColor: string;
      switch (anchorType) {
        case "pin":
          primaryColor = COLORS.ANCHOR_PIN_PRIMARY;
          secondaryColor = COLORS.ANCHOR_PIN_SECONDARY;
          glowColor = COLORS.ANCHOR_PIN_GLOW;
          break;
        case "roller_x":
          primaryColor = COLORS.ANCHOR_ROLLER_VERTICAL_PRIMARY;
          secondaryColor = COLORS.ANCHOR_ROLLER_VERTICAL_SECONDARY;
          glowColor = COLORS.ANCHOR_ROLLER_VERTICAL_GLOW;
          break;
        case "roller_y":
          primaryColor = COLORS.ANCHOR_ROLLER_HORIZONTAL_PRIMARY;
          secondaryColor = COLORS.ANCHOR_ROLLER_HORIZONTAL_SECONDARY;
          glowColor = COLORS.ANCHOR_ROLLER_HORIZONTAL_GLOW;
          break;
        default:
          return;
      }

      ctx.shadowColor = glowColor;
      ctx.shadowBlur = 10;
      const triangleBaseWidth = size * 1.7;
      const triangleHeight = size * 1.5;

      ctx.beginPath();
      ctx.moveTo(sX, sY - triangleHeight * 0.6);
      ctx.lineTo(sX - triangleBaseWidth / 2, sY + triangleHeight * 0.4);
      ctx.lineTo(sX + triangleBaseWidth / 2, sY + triangleHeight * 0.4);
      ctx.closePath();

      const gradient = ctx.createLinearGradient(
        sX,
        sY - triangleHeight * 0.6,
        sX,
        sY + triangleHeight * 0.4
      );
      gradient.addColorStop(0, primaryColor);
      gradient.addColorStop(1, secondaryColor);
      ctx.fillStyle = gradient;
      ctx.fill();

      if (isSelectedBySelectTool) {
        ctx.strokeStyle = COLORS.SELECTED_ELEMENT;
        ctx.lineWidth = 3;
      } else {
        ctx.strokeStyle = secondaryColor;
        ctx.lineWidth = 2;
      }
      ctx.stroke();
      ctx.shadowBlur = 0;

      const groundY = sY + triangleHeight * 0.4 + 3;
      const groundLineWidth = triangleBaseWidth * 0.8;
      ctx.strokeStyle = COLORS.ANCHOR_BASE_GROUND_LINES;
      ctx.lineWidth = 2;

      if (anchorType === "pin") {
        for (let i = 0; i < 3; i++) {
          ctx.beginPath();
          ctx.moveTo(sX - groundLineWidth * 0.5 + i * 2, groundY + i * 2);
          ctx.lineTo(sX + groundLineWidth * 0.5 - i * 2, groundY + i * 2);
          ctx.lineWidth = 2.5 - i * 0.7;
          ctx.stroke();
        }
      } else {
        ctx.beginPath();
        ctx.moveTo(sX - groundLineWidth * 0.6, groundY);
        ctx.lineTo(sX + groundLineWidth * 0.6, groundY);
        ctx.stroke();
        const rollerRadius = size * 0.25;
        const rollerY = groundY + rollerRadius + 1;
        ctx.fillStyle = secondaryColor;
        ctx.beginPath();
        ctx.arc(
          sX - triangleBaseWidth * 0.3,
          rollerY,
          rollerRadius,
          0,
          2 * Math.PI
        );
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(
          sX + triangleBaseWidth * 0.3,
          rollerY,
          rollerRadius,
          0,
          2 * Math.PI
        );
        ctx.fill();
        ctx.stroke();

        if (anchorType === "roller_y") {
          ctx.save();
          ctx.strokeStyle = primaryColor;
          ctx.lineWidth = 1;
          ctx.setLineDash([2, 3]);
          ctx.beginPath();
          ctx.moveTo(sX - triangleBaseWidth * 0.3, rollerY - rollerRadius - 2);
          ctx.lineTo(sX - triangleBaseWidth * 0.3, rollerY + rollerRadius + 2);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(sX + triangleBaseWidth * 0.3, rollerY - rollerRadius - 2);
          ctx.lineTo(sX + triangleBaseWidth * 0.3, rollerY + rollerRadius + 2);
          ctx.stroke();
          ctx.restore();
        }
      }
    };

    const drawJoints = () => {
      simulationState.joints.forEach((joint, i) => {
        const screenPos = worldToScreen({ x: joint.x, y: joint.y });
        const sX = Math.round(screenPos.x);
        const sY = Math.round(screenPos.y);
        const isSelectedBySelectTool =
          selectedElement?.type === "joint" && selectedElement.id === i;
        const isSelectedForLoad =
          currentTool === "load" &&
          locallySelectedJointForLoadRef.current === i;

        if (joint.anchor_type) {
          const anchorSize =
            JOINT_RADIUS *
            1.8 *
            Math.min(1.2, Math.max(0.8, cameraZoomRef.current));
          drawAnchor(joint, sX, sY, anchorSize, isSelectedBySelectTool);
        } else {
          const radius =
            JOINT_RADIUS * Math.min(1.3, Math.max(0.7, cameraZoomRef.current));
          drawCircularJoint(
            sX,
            sY,
            radius,
            isSelectedBySelectTool,
            isSelectedForLoad
          );
        }

        if (joint.problematic) {
          ctx.shadowColor = COLORS.HIGHLIGHT_PROBLEM;
          ctx.shadowBlur = 15;
          const highlightRadius = joint.anchor_type
            ? JOINT_RADIUS * 2.5
            : HIGHLIGHT_RADIUS;
          ctx.beginPath();
          ctx.arc(sX, sY, highlightRadius, 0, 2 * Math.PI);
          ctx.strokeStyle = COLORS.HIGHLIGHT_PROBLEM;
          ctx.lineWidth = 3;
          ctx.stroke();
          ctx.shadowBlur = 0;
        }
        if (
          Math.abs(joint.load[0]) > FLOAT_TOLERANCE ||
          Math.abs(joint.load[1]) > FLOAT_TOLERANCE
        ) {
          drawArrow(
            screenPos,
            { rx: joint.load[0], ry: joint.load[1] },
            COLORS.LOAD_ARROW,
            COLORS.LOAD_TEXT
          );
        }
      });
    };

    const drawBeams = () => {
      simulationState.beams.forEach((beam, beamIdx) => {
        if (
          beam.joint1_idx >= simulationState.joints.length ||
          beam.joint2_idx >= simulationState.joints.length
        )
          return;
        const j1 = simulationState.joints[beam.joint1_idx];
        const j2 = simulationState.joints[beam.joint2_idx];
        const screen_j1 = worldToScreen({ x: j1.x, y: j1.y });
        const screen_j2 = worldToScreen({ x: j2.x, y: j2.y });
        const isSelectedBySelectTool =
          selectedElement?.type === "beam" && selectedElement.id === beamIdx;
        const dx = screen_j2.x - screen_j1.x;
        const dy = screen_j2.y - screen_j1.y;
        const length = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx);
        const beamWidth = Math.max(6, 10 * cameraZoomRef.current);
        let baseColor = COLORS.BEAM_MATERIAL_LIGHT;
        let shadowColor = COLORS.BEAM_MATERIAL_DARK;
        let glowColor = COLORS.BEAM_GLOW;

        if (
          displayOptions.forces &&
          Math.abs(beam.force) > FLOAT_TOLERANCE &&
          simulationState.calculation_success
        ) {
          const ratio = Math.min(Math.abs(beam.force) / MAX_FORCE_VIS, 1.0);
          if (beam.force > 0) {
            baseColor = `rgb(${Math.round(120 * (1 - ratio))}, ${Math.round(
              120 * (1 - ratio)
            )}, ${Math.round(200 + 55 * ratio)})`;
            shadowColor = `rgb(${Math.round(80 * (1 - ratio))}, ${Math.round(
              80 * (1 - ratio)
            )}, ${Math.round(150 + 50 * ratio)})`;
            glowColor = `rgba(${Math.round(120 * (1 - ratio))}, ${Math.round(
              120 * (1 - ratio)
            )}, ${Math.round(200 + 55 * ratio)}, 0.4)`;
          } else {
            baseColor = `rgb(${Math.round(200 + 55 * ratio)}, ${Math.round(
              120 * (1 - ratio)
            )}, ${Math.round(120 * (1 - ratio))})`;
            shadowColor = `rgb(${Math.round(150 + 50 * ratio)}, ${Math.round(
              80 * (1 - ratio)
            )}, ${Math.round(80 * (1 - ratio))})`;
            glowColor = `rgba(${Math.round(200 + 55 * ratio)}, ${Math.round(
              120 * (1 - ratio)
            )}, ${Math.round(120 * (1 - ratio))}, 0.4)`;
          }
        }
        ctx.save();
        ctx.translate(screen_j1.x, screen_j1.y);
        ctx.rotate(angle);
        ctx.shadowColor = glowColor;
        ctx.shadowBlur = isSelectedBySelectTool ? 15 : 8;
        const gradient = ctx.createLinearGradient(
          0,
          -beamWidth / 2,
          0,
          beamWidth / 2
        );
        gradient.addColorStop(0, shadowColor);
        gradient.addColorStop(0.3, baseColor);
        gradient.addColorStop(0.7, baseColor);
        gradient.addColorStop(1, shadowColor);
        ctx.beginPath();
        ctx.roundRect(0, -beamWidth / 2, length, beamWidth, beamWidth / 4);
        ctx.fillStyle = gradient;
        ctx.fill();
        const highlightGradient = ctx.createLinearGradient(
          0,
          -beamWidth / 2,
          0,
          -beamWidth / 4
        );
        highlightGradient.addColorStop(0, "rgba(255, 255, 255, 0.3)");
        highlightGradient.addColorStop(1, "rgba(255, 255, 255, 0.1)");
        ctx.beginPath();
        ctx.roundRect(0, -beamWidth / 2, length, beamWidth / 4, beamWidth / 8);
        ctx.fillStyle = highlightGradient;
        ctx.fill();
        if (isSelectedBySelectTool) {
          ctx.beginPath();
          ctx.roundRect(
            -2,
            -beamWidth / 2 - 2,
            length + 4,
            beamWidth + 4,
            beamWidth / 4
          );
          ctx.strokeStyle = COLORS.SELECTED_ELEMENT;
          ctx.lineWidth = 3;
          ctx.stroke();
        }
        ctx.shadowBlur = 0;
        ctx.restore();
      });
    };
    const drawTemporaryBeam = () => {
      if (
        currentTool === "beam" &&
        tempBeamStartJointIdxRef.current !== null &&
        tempBeamStartJointIdxRef.current < simulationState.joints.length
      ) {
        const start_joint =
          simulationState.joints[tempBeamStartJointIdxRef.current];
        const screen_start = worldToScreen({
          x: start_joint.x,
          y: start_joint.y,
        });
        const screen_end = mouseScreenPosRef.current;
        const dashOffset = (Date.now() * 0.01) % 20;
        ctx.beginPath();
        ctx.moveTo(Math.round(screen_start.x), Math.round(screen_start.y));
        ctx.lineTo(Math.round(screen_end.x), Math.round(screen_end.y));
        ctx.strokeStyle = COLORS.TEMP_BEAM;
        ctx.lineWidth = 3;
        ctx.setLineDash([10, 10]);
        ctx.lineDashOffset = dashOffset;
        ctx.stroke();
        ctx.setLineDash([]);
        const pulseIntensity = 0.7 + 0.3 * Math.sin(Date.now() * 0.008);
        ctx.shadowColor = COLORS.SELECTION_BEAM_START;
        ctx.shadowBlur = 15 * pulseIntensity;
        ctx.beginPath();
        ctx.arc(
          Math.round(screen_start.x),
          Math.round(screen_start.y),
          (JOINT_RADIUS + 5) * pulseIntensity,
          0,
          2 * Math.PI
        );
        ctx.strokeStyle = COLORS.SELECTION_BEAM_START;
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.shadowBlur = 0;
      }
    };

    const drawReactions = () => {
      if (!simulationState.calculation_success || !displayOptions.reactions)
        return;
      for (const jointIdxStr in simulationState.calculated_reactions) {
        const jointIdx = Number.parseInt(jointIdxStr);
        if (jointIdx < simulationState.joints.length) {
          const joint = simulationState.joints[jointIdx];
          if (joint.anchor_type) {
            const screenPos = worldToScreen({ x: joint.x, y: joint.y });
            const reaction = simulationState.calculated_reactions[jointIdx];
            drawArrow(
              screenPos,
              reaction,
              COLORS.REACTION_ARROW,
              COLORS.REACTION_TEXT,
              true
            );
          }
        }
      }
    };

    const drawHoverTooltip = () => {
      if (
        hoveredBeamIdxRef.current !== -1 &&
        hoveredBeamTooltipPosRef.current &&
        hoveredBeamIdxRef.current < simulationState.beams.length
      ) {
        const beam = simulationState.beams[hoveredBeamIdxRef.current];
        if (beam && simulationState.calculation_success) {
          const forceText = `Force: ${beam.force.toFixed(1)} N ${
            beam.force > FLOAT_TOLERANCE
              ? "(T)"
              : beam.force < -FLOAT_TOLERANCE
              ? "(C)"
              : ""
          }`;
          ctx.font = "12px Arial";
          const textMetrics = ctx.measureText(forceText);
          const padding = 8;
          const rectWidth = textMetrics.width + 2 * padding;
          const rectHeight = 12 + 2 * padding;
          let x = hoveredBeamTooltipPosRef.current.x + 15;
          let y = hoveredBeamTooltipPosRef.current.y + 15;
          if (x + rectWidth > canvasWidth) x -= rectWidth + 30;
          if (y + rectHeight > canvasHeight) y -= rectHeight + 30;
          ctx.fillStyle = COLORS.HOVER_BACKGROUND;
          ctx.strokeStyle = isDarkMode
            ? "rgba(100,116,139,0.7)"
            : "rgba(148,163,184,0.7)";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.roundRect(x, y, rectWidth, rectHeight, 6);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = COLORS.HOVER_TEXT;
          ctx.textAlign = "left";
          ctx.textBaseline = "middle";
          ctx.fillText(forceText, x + padding, y + rectHeight / 2);
        }
      }
    };
    const renderLoop = () => {
      const gradient = ctx.createLinearGradient(
        0,
        0,
        canvasWidth,
        canvasHeight
      );
      gradient.addColorStop(0, COLORS.CANVAS_BACKGROUND_START);
      gradient.addColorStop(1, COLORS.CANVAS_BACKGROUND_END);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);
      drawGrid();
      drawBeams();
      drawTemporaryBeam();
      drawJoints();
      drawReactions();
      drawHoverTooltip();
      animationFrameId = null;
    };

    requestRedrawRef.current = () => {
      if (!animationFrameId)
        animationFrameId = requestAnimationFrame(renderLoop);
    };

    const zoomCameraLocal = (
      factor: number,
      mouseScreenPos?: { x: number; y: number }
    ) => {
      const oldZoom = cameraZoomRef.current;
      cameraZoomRef.current = Math.min(
        MAX_CAMERA_ZOOM,
        Math.max(MIN_CAMERA_ZOOM, cameraZoomRef.current * factor)
      );
      const focalPointScreen = mouseScreenPos || {
        x: canvasWidth / 2,
        y: canvasHeight / 2,
      };
      const worldMouseX =
        (focalPointScreen.x - cameraPanOffsetRef.current.x) / oldZoom;
      const worldMouseY =
        (focalPointScreen.y - cameraPanOffsetRef.current.y) / oldZoom;
      cameraPanOffsetRef.current.x =
        focalPointScreen.x - worldMouseX * cameraZoomRef.current;
      cameraPanOffsetRef.current.y =
        focalPointScreen.y - worldMouseY * cameraZoomRef.current;
      updateZoomLevel(Math.round(cameraZoomRef.current * 100));
      requestRedrawRef.current();
    };
    const resetCameraViewLocal = () => {
      cameraZoomRef.current = DEFAULT_CAMERA_ZOOM;
      if (canvasWidth > 0 && canvasHeight > 0)
        cameraPanOffsetRef.current = {
          x: canvasWidth / 2,
          y: canvasHeight / 2,
        };
      else
        cameraPanOffsetRef.current = {
          x: window.innerWidth / 2,
          y: window.innerHeight / 2,
        };
      updateZoomLevel(100);
      requestRedrawRef.current();
    };

    (window as any).canvasZoomIn = () => zoomCameraLocal(1.2);
    (window as any).canvasZoomOut = () => zoomCameraLocal(1 / 1.2);
    (window as any).canvasResetView = resetCameraViewLocal;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const newMouseScreenPos = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
      mouseScreenPosRef.current = newMouseScreenPos;
      let needsRedraw = false;
      let cursorStyle = "crosshair";

      if (isPanningRef.current) {
        const dx = newMouseScreenPos.x - panStartScreenRef.current.x;
        const dy = newMouseScreenPos.y - panStartScreenRef.current.y;
        cameraPanOffsetRef.current.x += dx;
        cameraPanOffsetRef.current.y += dy;
        panStartScreenRef.current = { ...newMouseScreenPos };
        needsRedraw = true;
        cursorStyle = "grabbing";
      } else {
        const beamsScreenData = simulationState.beams.map((beam, idx) => ({
          beam_idx: idx,
          screen_j1: worldToScreen(simulationState.joints[beam.joint1_idx]),
          screen_j2: worldToScreen(simulationState.joints[beam.joint2_idx]),
        }));
        const closestBeamIdx = getClosestBeam(
          newMouseScreenPos,
          beamsScreenData,
          BEAM_HOVER_THRESHOLD / cameraZoomRef.current
        );
        if (hoveredBeamIdxRef.current !== closestBeamIdx) {
          hoveredBeamIdxRef.current = closestBeamIdx;
          needsRedraw = true;
        }
        if (closestBeamIdx !== -1) {
          hoveredBeamTooltipPosRef.current = { ...newMouseScreenPos };
          if (currentTool === "select" || displayOptions.forces)
            cursorStyle = "pointer";
          needsRedraw = true;
        } else {
          hoveredBeamTooltipPosRef.current = null;
          const worldMousePos = screenToWorld(newMouseScreenPos);
          const jointHitRadiusWorld =
            (JOINT_RADIUS * 2.0) / cameraZoomRef.current;
          const closestJointIdxForCursor = getClosestJoint(
            worldMousePos,
            simulationState.joints,
            jointHitRadiusWorld
          );
          if (closestJointIdxForCursor !== -1) {
            if (
              currentTool === "select" ||
              currentTool === "load" ||
              currentTool === "anchor" ||
              (currentTool === "beam" &&
                tempBeamStartJointIdxRef.current === null)
            ) {
              cursorStyle = "pointer";
            }
          }
        }
        if (
          currentTool === "beam" &&
          tempBeamStartJointIdxRef.current !== null
        ) {
          needsRedraw = true;
          cursorStyle = "crosshair";
        }
      }
      if (canvas.style.cursor !== cursorStyle)
        canvas.style.cursor = cursorStyle;
      if (needsRedraw) requestRedrawRef.current();
    };

    const handleMouseDown = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseScreenPosRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
      const worldPos = screenToWorld(mouseScreenPosRef.current);

      if (e.button === 1 || e.button === 2) {
        isPanningRef.current = true;
        panStartScreenRef.current = { ...mouseScreenPosRef.current };
        canvas.style.cursor = "grabbing";
        if (e.button === 2) e.preventDefault();
        return;
      }

      if (e.button === 0) {
        let actionTakenByTool = false;
        const snappedPos = snapToGrid(worldPos.x, worldPos.y, GRID_SIZE);
        const jointHitRadiusWorld =
          (JOINT_RADIUS * 2.0) / cameraZoomRef.current;
        const closest_joint_idx = getClosestJoint(
          worldPos,
          simulationState.joints,
          jointHitRadiusWorld
        );

        const beamsScreenData = simulationState.beams.map((beam, idx) => ({
          beam_idx: idx,
          screen_j1: worldToScreen(simulationState.joints[beam.joint1_idx]),
          screen_j2: worldToScreen(simulationState.joints[beam.joint2_idx]),
        }));
        const closest_beam_idx_screen = getClosestBeam(
          mouseScreenPosRef.current,
          beamsScreenData,
          BEAM_HOVER_THRESHOLD
        );

        if (currentTool === "joint") {
          const isAnchorCandidate =
            snappedPos.y >= ANCHOR_Y_WORLD_THRESHOLD &&
            simulationState.joints.filter((j) => j.anchor_type !== null)
              .length < 2;
          onAddJoint(
            snappedPos.x,
            snappedPos.y,
            isAnchorCandidate,
            isAnchorCandidate ? "pin" : null
          );
          actionTakenByTool = true;
        } else if (currentTool === "anchor") {
          if (closest_joint_idx !== -1) {
            onToggleAnchor(closest_joint_idx);
            const jointAfterToggle = simulationState.joints[closest_joint_idx];
            if (
              jointAfterToggle &&
              jointAfterToggle.anchor_type === null &&
              locallySelectedJointForLoadRef.current === closest_joint_idx
            ) {
              onJointSelectedForLoad(null);
              locallySelectedJointForLoadRef.current = null;
            }
            actionTakenByTool = true;
          } else {
            onAddJoint(snappedPos.x, snappedPos.y, true, "pin");
            actionTakenByTool = true;
          }
        } else if (currentTool === "beam") {
          if (
            closest_joint_idx !== -1 &&
            closest_joint_idx < simulationState.joints.length
          ) {
            actionTakenByTool = true;
            if (tempBeamStartJointIdxRef.current === null)
              tempBeamStartJointIdxRef.current = closest_joint_idx;
            else {
              if (tempBeamStartJointIdxRef.current !== closest_joint_idx)
                onAddBeam(tempBeamStartJointIdxRef.current, closest_joint_idx);
              tempBeamStartJointIdxRef.current = null;
            }
          } else if (tempBeamStartJointIdxRef.current !== null) {
            tempBeamStartJointIdxRef.current = null;
            actionTakenByTool = true;
          }
        } else if (currentTool === "load") {
          actionTakenByTool = true;
          if (
            closest_joint_idx !== -1 &&
            closest_joint_idx < simulationState.joints.length
          ) {
            if (
              simulationState.joints[closest_joint_idx].anchor_type === null
            ) {
              onJointSelectedForLoad(closest_joint_idx);
              locallySelectedJointForLoadRef.current = closest_joint_idx;
            } else {
              onJointSelectedForLoad(null);
              locallySelectedJointForLoadRef.current = null;
              reportStatus("Anchors cannot have direct loads.");
            }
          } else {
            onJointSelectedForLoad(null);
            locallySelectedJointForLoadRef.current = null;
          }
        } else if (currentTool === "select") {
          actionTakenByTool = true;
          if (closest_joint_idx !== -1)
            onElementSelected({ type: "joint", id: closest_joint_idx });
          else if (closest_beam_idx_screen !== -1)
            onElementSelected({ type: "beam", id: closest_beam_idx_screen });
          else onElementSelected(null);
        }
        if (!actionTakenByTool && tempBeamStartJointIdxRef.current === null) {
          isPanningRef.current = true;
          panStartScreenRef.current = { ...mouseScreenPosRef.current };
          canvas.style.cursor = "grabbing";
        }
      }
      requestRedrawRef.current();
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (isPanningRef.current) {
        isPanningRef.current = false;
        let newCursor = "crosshair";
        if (
          hoveredBeamIdxRef.current !== -1 &&
          (currentTool === "select" || displayOptions.forces)
        )
          newCursor = "pointer";
        else {
          const worldMousePos = screenToWorld(mouseScreenPosRef.current);
          const jointHitRadiusWorld =
            (JOINT_RADIUS * 2.0) / cameraZoomRef.current;
          const closestJointIdxForCursor = getClosestJoint(
            worldMousePos,
            simulationState.joints,
            jointHitRadiusWorld
          );
          if (
            closestJointIdxForCursor !== -1 &&
            (currentTool === "select" ||
              currentTool === "load" ||
              currentTool === "anchor" ||
              (currentTool === "beam" &&
                tempBeamStartJointIdxRef.current === null))
          ) {
            newCursor = "pointer";
          }
        }
        canvas.style.cursor = newCursor;
      }
    };
    const handleMouseLeave = () => {
      if (isPanningRef.current) isPanningRef.current = false;
      if (hoveredBeamIdxRef.current !== -1) {
        hoveredBeamIdxRef.current = -1;
        hoveredBeamTooltipPosRef.current = null;
        requestRedrawRef.current();
      }
      canvas.style.cursor = "default";
    };
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const mouseScreenPos = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
      const zoomFactor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
      zoomCameraLocal(zoomFactor, mouseScreenPos);
    };
    const handleContextMenu = (e: MouseEvent) => e.preventDefault();

    resizeCanvas();
    requestRedrawRef.current();
    window.addEventListener("resize", resizeCanvas);
    canvas.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("mousedown", handleMouseDown);
    canvas.addEventListener("mouseup", handleMouseUp);
    canvas.addEventListener("mouseleave", handleMouseLeave);
    canvas.addEventListener("wheel", handleWheel, { passive: false });
    canvas.addEventListener("contextmenu", handleContextMenu);

    return () => {
      window.removeEventListener("resize", resizeCanvas);
      canvas.removeEventListener("mousemove", handleMouseMove);
      canvas.removeEventListener("mousedown", handleMouseDown);
      canvas.removeEventListener("mouseup", handleMouseUp);
      canvas.removeEventListener("mouseleave", handleMouseLeave);
      canvas.removeEventListener("wheel", handleWheel);
      canvas.removeEventListener("contextmenu", handleContextMenu);
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      delete (window as any).canvasZoomIn;
      delete (window as any).canvasZoomOut;
      delete (window as any).canvasResetView;
    };
  }, [
    simulationState,
    currentTool,
    displayOptions,
    isDarkMode,
    COLORS,
    onAddJoint,
    onAddBeam,
    onToggleAnchor,
    onJointSelectedForLoad,
    onElementSelected,
    updateZoomLevel,
    reportStatus,
    screenToWorld,
    worldToScreen,
    selectedElement,
    cameraZoomRef,
    cameraPanOffsetRef,
  ]);

  useEffect(() => {
    if (currentTool !== "beam") tempBeamStartJointIdxRef.current = null;
    if (currentTool !== "load") {
      locallySelectedJointForLoadRef.current = null;
    }
    if (currentTool !== "select" && selectedElement !== null) {
      onElementSelected(null);
    }
    requestRedrawRef.current();
  }, [currentTool, onElementSelected, selectedElement]);

  useEffect(() => {
    requestRedrawRef.current();
  }, [
    selectedElement,
    simulationState.joints,
    simulationState.beams,
    simulationState.calculated_reactions,
    displayOptions,
    isDarkMode,
  ]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full"
      style={{ imageRendering: "pixelated" }}
    />
  );
}
