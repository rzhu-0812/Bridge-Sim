"use client"

import { useEffect, useRef, useState } from "react"
import {
  Circle,
  Minus,
  Anchor,
  Download,
  Undo,
  RotateCcw,
  Info,
  Eye,
  Search,
  ZoomIn,
  ZoomOut,
  ExpandIcon,
  Sliders,
  CheckCircle,
  AlertTriangle,
  DraftingCompass,
  Sun,
  Moon,
  MousePointer,
  Trash2,
} from "lucide-react"

interface Joint {
  x: number
  y: number
  is_anchor: boolean
  load: [number, number]
  problematic: boolean
}

interface Beam {
  joint1_idx: number
  joint2_idx: number
  force: number
  stress: number
}

interface State {
  joints: Joint[]
  beams: Beam[]
  calculated_reactions: Record<number, [number, number]>
  selected_joint_idx: number
  selected_joint_for_load_idx: number
  selected_beam_idx: number
  calculation_success: boolean
  last_failure_reason: string
  problematic_joint_indices: number[]
  mouse_screen_pos: { x: number; y: number }
  mouse_world_pos: { x: number; y: number }
  camera_zoom: number
  camera_pan_offset: { x: number; y: number }
  is_panning: boolean
  pan_start_screen: { x: number; y: number }
  hovered_beam_idx: number
  hovered_beam_tooltip_pos: { x: number; y: number } | null
}

function solveLinearSystem(A_orig: number[][], b_orig: number[]): number[] | null {
  const n = A_orig.length
  if (n === 0 || A_orig[0].length !== n) {
    console.error("Invalid matrix dimensions for solver.")
    return null
  }

  const A = A_orig.map((row) => [...row])
  const b = [...b_orig]

  for (let i = 0; i < n; i++) {
    let maxRow = i
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(A[k][i]) > Math.abs(A[maxRow][i])) {
        maxRow = k
      }
    }
    ;[A[i], A[maxRow]] = [A[maxRow], A[i]]
    ;[b[i], b[maxRow]] = [b[maxRow], b[i]]

    if (Math.abs(A[i][i]) < 1e-9) {
      console.warn(`Singular matrix or near-singular at row ${i}, pivot: ${A[i][i]}`)
      return null
    }

    const pivot = A[i][i]
    for (let j = i; j < n; j++) {
      A[i][j] /= pivot
    }
    b[i] /= pivot

    for (let k = 0; k < n; k++) {
      if (k !== i) {
        const factor = A[k][i]
        for (let j = i; j < n; j++) {
          A[k][j] -= factor * A[i][j]
        }
        b[k] -= factor * b[i]
      }
    }
  }
  return b
}

function distToSegmentSquared(p: { x: number; y: number }, v: { x: number; y: number }, w: { x: number; y: number }) {
  const l2 = (v.x - w.x) ** 2 + (v.y - w.y) ** 2
  if (l2 === 0) return (p.x - v.x) ** 2 + (p.y - v.y) ** 2
  let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2
  t = Math.max(0, Math.min(1, t))
  const projX = v.x + t * (w.x - v.x)
  const projY = v.y + t * (w.y - v.y)
  return (p.x - projX) ** 2 + (p.y - projY) ** 2
}

export default function BridgeSim() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [currentTool, setCurrentTool] = useState("joint")
  const [isDarkMode, setIsDarkMode] = useState(true)
  const [structureInfo, setStructureInfo] = useState({
    joints: 0,
    beams: 0,
    anchors: 0,
    loads: 0,
  })
  const [showLoadPanel, setShowLoadPanel] = useState(false)
  const [selectedLoadJoint, setSelectedLoadJoint] = useState(-1)
  const [loadValues, setLoadValues] = useState({ fx: 0, fy: 0 })
  const [displayOptions, setDisplayOptions] = useState({
    grid: true,
    forces: true,
    reactions: true,
  })
  const [zoomLevel, setZoomLevel] = useState(100)
  const [statusMessage, setStatusMessage] = useState("System ready. Start building.")
  const [calculationSuccess, setCalculationSuccess] = useState(true)

  const [selectedJointIdx, setSelectedJointIdx] = useState(-1)
  const [selectedBeamIdx, setSelectedBeamIdx] = useState(-1)

  const updateSidebarInfoRef = useRef<() => void>(() => {})

  const stateRef = useRef<State>({
    joints: [],
    beams: [],
    calculated_reactions: {},
    selected_joint_idx: -1,
    selected_joint_for_load_idx: -1,
    selected_beam_idx: -1,
    calculation_success: false,
    last_failure_reason: "System ready. Start building.",
    problematic_joint_indices: [],
    mouse_screen_pos: { x: 0, y: 0 },
    mouse_world_pos: { x: 0, y: 0 },
    camera_zoom: 1.0,
    camera_pan_offset: { x: 0, y: 0 },
    is_panning: false,
    pan_start_screen: { x: 0, y: 0 },
    hovered_beam_idx: -1,
    hovered_beam_tooltip_pos: null,
  })

  const GRID_SIZE = 50
  const JOINT_RADIUS = 8
  const HIGHLIGHT_RADIUS = 16
  const ANCHOR_Y_WORLD_THRESHOLD = 300
  const LOAD_INCREMENT_STEP = 100.0
  const FLOAT_TOLERANCE = 1e-6
  const MAX_FORCE_VIS = 2500
  const BEAM_HOVER_THRESHOLD = 8

  const getColors = (darkMode: boolean) => ({
    BACKGROUND_APP: darkMode ? "#0f172a" : "#f8fafc",
    CANVAS_BACKGROUND_START: darkMode ? "#1e293b" : "#ffffff",
    CANVAS_BACKGROUND_END: darkMode ? "#334155" : "#f1f5f9",
    GRID: darkMode ? "rgba(148, 163, 184, 0.3)" : "rgba(100, 116, 139, 0.2)",
    JOINT: darkMode ? "#3b82f6" : "#2563eb",
    JOINT_SECONDARY: darkMode ? "#1e40af" : "#1d4ed8",
    JOINT_GLOW: darkMode ? "rgba(59, 130, 246, 0.4)" : "rgba(37, 99, 235, 0.3)",
    JOINT_HIGHLIGHT: darkMode ? "rgba(255, 255, 255, 0.3)" : "rgba(255, 255, 255, 0.8)",
    ANCHOR: darkMode ? "#10b981" : "#059669",
    ANCHOR_SECONDARY: darkMode ? "#047857" : "#065f46",
    ANCHOR_GLOW: darkMode ? "rgba(16, 185, 129, 0.4)" : "rgba(5, 150, 105, 0.3)",
    ANCHOR_BASE: darkMode ? "#064e3b" : "#047857",
    BEAM: darkMode ? "#8b5cf6" : "#7c3aed",
    BEAM_GLOW: darkMode ? "rgba(139, 92, 246, 0.3)" : "rgba(124, 58, 237, 0.2)",
    BEAM_MATERIAL_LIGHT: darkMode ? "#a8a29e" : "#d6d3d1",
    BEAM_MATERIAL_DARK: darkMode ? "#57534e" : "#78716c",
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
    HOVER_BACKGROUND: darkMode ? "rgba(30, 41, 59, 0.9)" : "rgba(241, 245, 249, 0.9)",
  })

  let COLORS = getColors(isDarkMode)

  useEffect(() => {
    COLORS = getColors(isDarkMode)
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    let canvasWidth = 0,
      canvasHeight = 0
    let animationFrameId: number | null = null

    const resizeCanvas = () => {
      const container = canvas.parentElement
      if (!container) return

      canvasWidth = container.clientWidth
      canvasHeight = container.clientHeight
      canvas.width = canvasWidth
      canvas.height = canvasHeight

      if (stateRef.current.camera_pan_offset.x === 0 && stateRef.current.camera_pan_offset.y === 0 && canvasWidth > 0) {
        stateRef.current.camera_pan_offset = { x: canvasWidth / 2, y: canvasHeight / 2 }
      }
      requestRedraw()
    }

    const worldToScreen = (worldPos: { x: number; y: number }) => {
      const x = worldPos.x * stateRef.current.camera_zoom + stateRef.current.camera_pan_offset.x
      const y = worldPos.y * stateRef.current.camera_zoom + stateRef.current.camera_pan_offset.y
      return { x, y }
    }
    const screenToWorld = (screenPos: { x: number; y: number }) => {
      if (stateRef.current.camera_zoom === 0) return { x: 0, y: 0 }
      const x = (screenPos.x - stateRef.current.camera_pan_offset.x) / stateRef.current.camera_zoom
      const y = (screenPos.y - stateRef.current.camera_pan_offset.y) / stateRef.current.camera_zoom
      return { x, y }
    }
    const snapToGrid = (x: number, y: number) => {
      return {
        x: Math.round(x / GRID_SIZE) * GRID_SIZE,
        y: Math.round(y / GRID_SIZE) * GRID_SIZE,
      }
    }
    const distance = (p1: { x: number; y: number }, p2: { x: number; y: number }) => {
      return Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2)
    }
    const getClosestJoint = (position: { x: number; y: number }, joints: Joint[], maxDistance: number) => {
      let closestIndex = -1
      let minDistSq = maxDistance ** 2
      joints.forEach((joint, index) => {
        const distSq = (joint.x - position.x) ** 2 + (joint.y - position.y) ** 2
        if (distSq < minDistSq) {
          minDistSq = distSq
          closestIndex = index
        }
      })
      return closestIndex
    }
    const getClosestBeam = (
      position: { x: number; y: number },
      beams: Beam[],
      joints: Joint[],
      maxDistance: number,
    ) => {
      let closestIndex = -1
      let minDistSq = maxDistance ** 2
      beams.forEach((beam, index) => {
        if (beam.joint1_idx >= joints.length || beam.joint2_idx >= joints.length) return
        const j1 = joints[beam.joint1_idx]
        const j2 = joints[beam.joint2_idx]
        const distSq = distToSegmentSquared(position, j1, j2)
        if (distSq < minDistSq) {
          minDistSq = distSq
          closestIndex = index
        }
      })
      return closestIndex
    }
    const zoomCamera = (factor: number, mouseScreenPos?: { x: number; y: number }) => {
      const oldZoom = stateRef.current.camera_zoom
      stateRef.current.camera_zoom = Math.min(5.0, Math.max(0.1, stateRef.current.camera_zoom * factor))

      const focalPointScreen = mouseScreenPos || { x: canvasWidth / 2, y: canvasHeight / 2 }

      const worldMouseX = (focalPointScreen.x - stateRef.current.camera_pan_offset.x) / oldZoom
      const worldMouseY = (focalPointScreen.y - stateRef.current.camera_pan_offset.y) / oldZoom

      stateRef.current.camera_pan_offset.x = focalPointScreen.x - worldMouseX * stateRef.current.camera_zoom
      stateRef.current.camera_pan_offset.y = focalPointScreen.y - worldMouseY * stateRef.current.camera_zoom

      setZoomLevel(Math.round(stateRef.current.camera_zoom * 100))
      requestRedraw()
    }
    const resetCameraView = () => {
      stateRef.current.camera_zoom = 1.0
      stateRef.current.camera_pan_offset = { x: canvasWidth / 2, y: canvasHeight / 2 }
      setZoomLevel(100)
      requestRedraw()
    }

    const drawGrid = () => {
      if (!displayOptions.grid) return

      ctx.strokeStyle = COLORS.GRID
      ctx.lineWidth = 0.5 / stateRef.current.camera_zoom
      ctx.lineWidth = Math.min(1, Math.max(0.2, 0.5 / stateRef.current.camera_zoom))

      const worldTopLeft = screenToWorld({ x: 0, y: 0 })
      const worldBottomRight = screenToWorld({ x: canvasWidth, y: canvasHeight })

      const x_start_world = Math.floor(worldTopLeft.x / GRID_SIZE) * GRID_SIZE
      const x_end_world = Math.ceil(worldBottomRight.x / GRID_SIZE) * GRID_SIZE

      for (let x_world = x_start_world; x_world <= x_end_world; x_world += GRID_SIZE) {
        const screen_x = Math.round(worldToScreen({ x: x_world, y: worldTopLeft.y }).x)
        ctx.beginPath()
        ctx.moveTo(screen_x + 0.5, 0)
        ctx.lineTo(screen_x + 0.5, canvasHeight)
        ctx.stroke()
      }

      const y_start_world = Math.floor(worldTopLeft.y / GRID_SIZE) * GRID_SIZE
      const y_end_world = Math.ceil(worldBottomRight.y / GRID_SIZE) * GRID_SIZE

      for (let y_world = y_start_world; y_world <= y_end_world; y_world += GRID_SIZE) {
        const screen_y = Math.round(worldToScreen({ x: worldTopLeft.x, y: y_world }).y)
        ctx.beginPath()
        ctx.moveTo(0, screen_y + 0.5)
        ctx.lineTo(canvasWidth, screen_y + 0.5)
        ctx.stroke()
      }
    }
    const drawArrow = (
      startScreenPos: { x: number; y: number },
      vector: [number, number],
      color: string,
      textColor: string,
      isReaction = false,
    ) => {
      const arrowScreenLen = 25 * Math.min(1.5, Math.max(0.5, stateRef.current.camera_zoom))
      const textOffset = 5
      const baseFontSize = 10
      const scaledFontSize = Math.max(8, baseFontSize * Math.min(1.2, Math.max(0.7, stateRef.current.camera_zoom)))

      ctx.font = `${scaledFontSize}px Arial`
      ctx.fillStyle = textColor
      ctx.strokeStyle = color
      ctx.lineWidth = isReaction
        ? Math.max(1.5, 2.5 * stateRef.current.camera_zoom)
        : Math.max(1, 2 * stateRef.current.camera_zoom)

      const sX = Math.round(startScreenPos.x)
      const sY = Math.round(startScreenPos.y)
      const effectiveJointRadius = JOINT_RADIUS * Math.min(1.5, Math.max(0.5, stateRef.current.camera_zoom))

      if (Math.abs(vector[1]) > FLOAT_TOLERANCE) {
        const arrowDirY = isReaction ? (vector[1] > 0 ? -1 : 1) : vector[1] > 0 ? 1 : -1
        const startY = sY + (effectiveJointRadius + 2) * arrowDirY
        const endY = startY + arrowScreenLen * arrowDirY

        ctx.beginPath()
        ctx.moveTo(sX, startY)
        ctx.lineTo(sX, endY)
        ctx.stroke()

        ctx.beginPath()
        ctx.moveTo(sX, endY)
        ctx.lineTo(sX - 4, endY - arrowDirY * 6)
        ctx.lineTo(sX + 4, endY - arrowDirY * 6)
        ctx.closePath()
        ctx.fillStyle = color
        ctx.fill()

        const text = (isReaction ? "Ry:" : "Fy:") + `${vector[1].toFixed(0)}`
        ctx.fillStyle = textColor
        ctx.textAlign = "center"
        ctx.fillText(text, sX, arrowDirY > 0 ? endY + scaledFontSize * 1.2 : endY - scaledFontSize * 0.5)
      }

      if (Math.abs(vector[0]) > FLOAT_TOLERANCE) {
        const arrowDirX = isReaction ? (vector[0] > 0 ? -1 : 1) : vector[0] > 0 ? 1 : -1
        const startX = sX + (effectiveJointRadius + 2) * arrowDirX
        const endX = startX + arrowScreenLen * arrowDirX

        ctx.beginPath()
        ctx.moveTo(startX, sY)
        ctx.lineTo(endX, sY)
        ctx.stroke()

        ctx.beginPath()
        ctx.moveTo(endX, sY)
        ctx.lineTo(endX - arrowDirX * 6, sY - 4)
        ctx.lineTo(endX - arrowDirX * 6, sY + 4)
        ctx.closePath()
        ctx.fillStyle = color
        ctx.fill()

        const text = (isReaction ? "Rx:" : "Fx:") + `${vector[0].toFixed(0)}`
        ctx.fillStyle = textColor
        ctx.textAlign = arrowDirX > 0 ? "left" : "right"
        ctx.textBaseline = "middle"
        ctx.fillText(text, arrowDirX > 0 ? endX + textOffset : endX - textOffset, sY)
      }

      ctx.textAlign = "left"
      ctx.textBaseline = "alphabetic"
    }

    const drawCircularJoint = (sX: number, sY: number, radius: number, isSelected = false) => {
      ctx.shadowColor = COLORS.JOINT_GLOW
      ctx.shadowBlur = 12

      const gradient = ctx.createRadialGradient(sX, sY, 0, sX, sY, radius)
      gradient.addColorStop(0, COLORS.JOINT)
      gradient.addColorStop(1, COLORS.JOINT_SECONDARY)

      ctx.beginPath()
      ctx.arc(sX, sY, radius, 0, 2 * Math.PI)
      ctx.fillStyle = gradient
      ctx.fill()

      ctx.shadowBlur = 0

      const innerRadius = radius * 0.4
      const innerGradient = ctx.createRadialGradient(sX - radius * 0.2, sY - radius * 0.2, 0, sX, sY, innerRadius)
      innerGradient.addColorStop(0, COLORS.JOINT_HIGHLIGHT)
      innerGradient.addColorStop(1, "transparent")

      ctx.beginPath()
      ctx.arc(sX, sY, innerRadius, 0, 2 * Math.PI)
      ctx.fillStyle = innerGradient
      ctx.fill()

      ctx.beginPath()
      ctx.arc(sX, sY, radius, 0, 2 * Math.PI)
      ctx.strokeStyle = isSelected ? COLORS.SELECTED_ELEMENT : COLORS.JOINT_SECONDARY
      ctx.lineWidth = isSelected ? 3 : 2
      ctx.stroke()
    }

    const drawCircularAnchor = (sX: number, sY: number, size: number, isSelected = false) => {
      ctx.shadowColor = COLORS.ANCHOR_GLOW
      ctx.shadowBlur = 15

      const gradient = ctx.createRadialGradient(sX, sY, 0, sX, sY, size)
      gradient.addColorStop(0, COLORS.ANCHOR)
      gradient.addColorStop(1, COLORS.ANCHOR_SECONDARY)

      ctx.beginPath()
      ctx.arc(sX, sY, size, 0, 2 * Math.PI)
      ctx.fillStyle = gradient
      ctx.fill()

      ctx.shadowBlur = 0

      const innerRadius = size * 0.4
      const innerGradient = ctx.createRadialGradient(sX - size * 0.2, sY - size * 0.2, 0, sX, sY, innerRadius)
      innerGradient.addColorStop(0, COLORS.JOINT_HIGHLIGHT)
      innerGradient.addColorStop(1, "transparent")

      ctx.beginPath()
      ctx.arc(sX, sY, innerRadius, 0, 2 * Math.PI)
      ctx.fillStyle = innerGradient
      ctx.fill()

      ctx.beginPath()
      ctx.arc(sX, sY, size, 0, 2 * Math.PI)
      ctx.strokeStyle = isSelected ? COLORS.SELECTED_ELEMENT : COLORS.ANCHOR_SECONDARY
      ctx.lineWidth = isSelected ? 3 : 2
      ctx.stroke()

      ctx.shadowBlur = 8
      const baseY = sY + size + 4
      for (let i = 0; i < 3; i++) {
        ctx.beginPath()
        ctx.moveTo(sX - size * 0.8 + i * 3, baseY + i * 2)
        ctx.lineTo(sX + size * 0.8 - i * 3, baseY + i * 2)
        ctx.strokeStyle = COLORS.ANCHOR_BASE
        ctx.lineWidth = 3 - i
        ctx.lineCap = "round"
        ctx.stroke()
      }
      ctx.shadowBlur = 0
    }

    const drawJoints = () => {
      stateRef.current.joints.forEach((joint: Joint, i: number) => {
        const screenPos = worldToScreen({ x: joint.x, y: joint.y })
        const sX = Math.round(screenPos.x)
        const sY = Math.round(screenPos.y)

        const isSelected = currentTool === "select" && selectedJointIdx === i

        if (joint.is_anchor) {
          const anchorSize = JOINT_RADIUS * 1.5 * Math.min(1.2, Math.max(0.8, stateRef.current.camera_zoom))
          drawCircularAnchor(sX, sY, anchorSize, isSelected)
        } else {
          const radius = JOINT_RADIUS * Math.min(1.3, Math.max(0.7, stateRef.current.camera_zoom))
          drawCircularJoint(sX, sY, radius, isSelected)
        }

        if (stateRef.current.selected_joint_for_load_idx === i && currentTool === "load") {
          const pulseIntensity = 0.5 + 0.5 * Math.sin(Date.now() * 0.005)
          ctx.shadowColor = COLORS.SELECTED_FOR_LOAD_HIGHLIGHT
          ctx.shadowBlur = 20 * pulseIntensity
          ctx.beginPath()
          ctx.arc(sX, sY, HIGHLIGHT_RADIUS * (0.8 + 0.2 * pulseIntensity), 0, 2 * Math.PI)
          ctx.strokeStyle = COLORS.SELECTED_FOR_LOAD_HIGHLIGHT
          ctx.lineWidth = 3
          ctx.stroke()
          ctx.shadowBlur = 0
        }

        if (joint.problematic && Math.floor(Date.now() / 400) % 2 === 0) {
          ctx.shadowColor = COLORS.HIGHLIGHT_PROBLEM
          ctx.shadowBlur = 15
          ctx.beginPath()
          ctx.arc(sX, sY, HIGHLIGHT_RADIUS, 0, 2 * Math.PI)
          ctx.strokeStyle = COLORS.HIGHLIGHT_PROBLEM
          ctx.lineWidth = 3
          ctx.stroke()
          ctx.shadowBlur = 0
        }

        if (Math.abs(joint.load[0]) > FLOAT_TOLERANCE || Math.abs(joint.load[1]) > FLOAT_TOLERANCE) {
          drawArrow(screenPos, joint.load, COLORS.LOAD_ARROW, COLORS.LOAD_TEXT)
        }
      })
    }

    const drawBeams = () => {
      stateRef.current.beams.forEach((beam: Beam, beamIdx: number) => {
        if (beam.joint1_idx >= stateRef.current.joints.length || beam.joint2_idx >= stateRef.current.joints.length)
          return

        const j1 = stateRef.current.joints[beam.joint1_idx]
        const j2 = stateRef.current.joints[beam.joint2_idx]
        const screen_j1 = worldToScreen({ x: j1.x, y: j1.y })
        const screen_j2 = worldToScreen({ x: j2.x, y: j2.y })

        const isSelected = currentTool === "select" && selectedBeamIdx === beamIdx

        const dx = screen_j2.x - screen_j1.x
        const dy = screen_j2.y - screen_j1.y
        const length = Math.sqrt(dx * dx + dy * dy)
        const angle = Math.atan2(dy, dx)

        const beamWidth = Math.max(6, 10 * stateRef.current.camera_zoom)

        let baseColor = COLORS.BEAM_MATERIAL_LIGHT
        let shadowColor = COLORS.BEAM_MATERIAL_DARK
        let glowColor = COLORS.BEAM_GLOW

        if (displayOptions.forces && Math.abs(beam.force) > FLOAT_TOLERANCE && stateRef.current.calculation_success) {
          const ratio = Math.min(Math.abs(beam.force) / MAX_FORCE_VIS, 1.0)
          if (beam.force > 0) {
            baseColor = `rgb(${Math.round(200 + 55 * ratio)}, ${Math.round(120 * (1 - ratio))}, ${Math.round(120 * (1 - ratio))})`
            shadowColor = `rgb(${Math.round(150 + 50 * ratio)}, ${Math.round(80 * (1 - ratio))}, ${Math.round(80 * (1 - ratio))})`
            glowColor = `rgba(${Math.round(200 + 55 * ratio)}, ${Math.round(120 * (1 - ratio))}, ${Math.round(120 * (1 - ratio))}, 0.4)`
          } else {
            baseColor = `rgb(${Math.round(120 * (1 - ratio))}, ${Math.round(120 * (1 - ratio))}, ${Math.round(200 + 55 * ratio)})`
            shadowColor = `rgb(${Math.round(80 * (1 - ratio))}, ${Math.round(80 * (1 - ratio))}, ${Math.round(150 + 50 * ratio)})`
            glowColor = `rgba(${Math.round(120 * (1 - ratio))}, ${Math.round(120 * (1 - ratio))}, ${Math.round(200 + 55 * ratio)}, 0.4)`
          }
        }

        ctx.save()
        ctx.translate(screen_j1.x, screen_j1.y)
        ctx.rotate(angle)

        ctx.shadowColor = glowColor
        ctx.shadowBlur = isSelected ? 15 : 8

        const gradient = ctx.createLinearGradient(0, -beamWidth / 2, 0, beamWidth / 2)
        gradient.addColorStop(0, shadowColor)
        gradient.addColorStop(0.3, baseColor)
        gradient.addColorStop(0.7, baseColor)
        gradient.addColorStop(1, shadowColor)

        ctx.beginPath()
        ctx.roundRect(0, -beamWidth / 2, length, beamWidth, beamWidth / 4)
        ctx.fillStyle = gradient
        ctx.fill()

        const highlightGradient = ctx.createLinearGradient(0, -beamWidth / 2, 0, -beamWidth / 4)
        highlightGradient.addColorStop(0, "rgba(255, 255, 255, 0.3)")
        highlightGradient.addColorStop(1, "rgba(255, 255, 255, 0.1)")

        ctx.beginPath()
        ctx.roundRect(0, -beamWidth / 2, length, beamWidth / 4, beamWidth / 8)
        ctx.fillStyle = highlightGradient
        ctx.fill()

        if (isSelected) {
          ctx.beginPath()
          ctx.roundRect(-2, -beamWidth / 2 - 2, length + 4, beamWidth + 4, beamWidth / 4)
          ctx.strokeStyle = COLORS.SELECTED_ELEMENT
          ctx.lineWidth = 3
          ctx.stroke()
        }

        ctx.shadowBlur = 0
        ctx.restore()
      })
    }

    const drawTemporaryBeam = () => {
      if (
        currentTool === "beam" &&
        stateRef.current.selected_joint_idx !== -1 &&
        stateRef.current.selected_joint_idx < stateRef.current.joints.length
      ) {
        const start_joint = stateRef.current.joints[stateRef.current.selected_joint_idx]
        const screen_start = worldToScreen({ x: start_joint.x, y: start_joint.y })
        const screen_end = stateRef.current.mouse_screen_pos

        const dashOffset = (Date.now() * 0.01) % 20

        ctx.beginPath()
        ctx.moveTo(Math.round(screen_start.x), Math.round(screen_start.y))
        ctx.lineTo(Math.round(screen_end.x), Math.round(screen_end.y))
        ctx.strokeStyle = COLORS.TEMP_BEAM
        ctx.lineWidth = 3
        ctx.setLineDash([10, 10])
        ctx.lineDashOffset = dashOffset
        ctx.stroke()
        ctx.setLineDash([])

        const pulseIntensity = 0.7 + 0.3 * Math.sin(Date.now() * 0.008)
        ctx.shadowColor = COLORS.SELECTION_BEAM_START
        ctx.shadowBlur = 15 * pulseIntensity
        ctx.beginPath()
        ctx.arc(
          Math.round(screen_start.x),
          Math.round(screen_start.y),
          (JOINT_RADIUS + 5) * pulseIntensity,
          0,
          2 * Math.PI,
        )
        ctx.strokeStyle = COLORS.SELECTION_BEAM_START
        ctx.lineWidth = 3
        ctx.stroke()
        ctx.shadowBlur = 0
      }
    }
    const drawReactions = () => {
      if (!stateRef.current.calculation_success || !displayOptions.reactions) return

      for (const jointIdxStr in stateRef.current.calculated_reactions) {
        const jointIdx = Number.parseInt(jointIdxStr)
        if (jointIdx < stateRef.current.joints.length) {
          const joint = stateRef.current.joints[jointIdx]
          if (joint.is_anchor) {
            const screenPos = worldToScreen({ x: joint.x, y: joint.y })
            const reaction = stateRef.current.calculated_reactions[jointIdx]
            drawArrow(screenPos, reaction, COLORS.REACTION_ARROW, COLORS.REACTION_TEXT, true)
          }
        }
      }
    }

    const drawHoverTooltip = () => {
      if (stateRef.current.hovered_beam_idx !== -1 && stateRef.current.hovered_beam_tooltip_pos) {
        const beam = stateRef.current.beams[stateRef.current.hovered_beam_idx]
        if (beam && stateRef.current.calculation_success) {
          const forceText = `Force: ${beam.force.toFixed(1)} N ${beam.force > FLOAT_TOLERANCE ? "(T)" : beam.force < -FLOAT_TOLERANCE ? "(C)" : ""}`
          ctx.font = "12px Arial"
          const textMetrics = ctx.measureText(forceText)
          const padding = 8
          const rectWidth = textMetrics.width + 2 * padding
          const rectHeight = 12 + 2 * padding

          let x = stateRef.current.hovered_beam_tooltip_pos.x + 15
          let y = stateRef.current.hovered_beam_tooltip_pos.y + 15

          if (x + rectWidth > canvasWidth) x -= rectWidth + 30
          if (y + rectHeight > canvasHeight) y -= rectHeight + 30

          ctx.fillStyle = COLORS.HOVER_BACKGROUND
          ctx.strokeStyle = isDarkMode ? "rgba(100,116,139,0.7)" : "rgba(148,163,184,0.7)"
          ctx.lineWidth = 1
          ctx.beginPath()
          ctx.roundRect(x, y, rectWidth, rectHeight, 6)
          ctx.fill()
          ctx.stroke()

          ctx.fillStyle = COLORS.HOVER_TEXT
          ctx.textAlign = "left"
          ctx.textBaseline = "middle"
          ctx.fillText(forceText, x + padding, y + rectHeight / 2)
        }
      }
    }

    const renderLoop = () => {
      const gradient = ctx.createLinearGradient(0, 0, canvasWidth, canvasHeight)
      gradient.addColorStop(0, COLORS.CANVAS_BACKGROUND_START)
      gradient.addColorStop(1, COLORS.CANVAS_BACKGROUND_END)

      ctx.fillStyle = gradient
      ctx.fillRect(0, 0, canvasWidth, canvasHeight)

      drawGrid()
      drawBeams()
      drawTemporaryBeam()
      drawJoints()
      drawReactions()
      drawHoverTooltip()

      animationFrameId = null
    }
    const requestRedraw = () => {
      if (!animationFrameId) {
        animationFrameId = requestAnimationFrame(renderLoop)
      }
    }
    const updateSidebarInfo = () => {
      setStructureInfo({
        joints: stateRef.current.joints.length,
        beams: stateRef.current.beams.length,
        anchors: stateRef.current.joints.filter((j: Joint) => j.is_anchor).length,
        loads: stateRef.current.joints.reduce((count: number, j: Joint) => {
          return count + (Math.abs(j.load[0]) > FLOAT_TOLERANCE || Math.abs(j.load[1]) > FLOAT_TOLERANCE ? 1 : 0)
        }, 0),
      })

      setStatusMessage(stateRef.current.last_failure_reason)
      setCalculationSuccess(stateRef.current.calculation_success)

      if (
        currentTool === "load" &&
        stateRef.current.selected_joint_for_load_idx !== -1 &&
        stateRef.current.selected_joint_for_load_idx < stateRef.current.joints.length
      ) {
        const joint = stateRef.current.joints[stateRef.current.selected_joint_for_load_idx]
        if (joint && !joint.is_anchor) {
          setShowLoadPanel(true)
          setSelectedLoadJoint(stateRef.current.selected_joint_for_load_idx)
          setLoadValues({ fx: joint.load[0], fy: joint.load[1] })
        } else {
          setShowLoadPanel(false)
          if (stateRef.current.selected_joint_for_load_idx !== -1) {
            stateRef.current.selected_joint_for_load_idx = -1
          }
        }
      } else {
        setShowLoadPanel(false)
      }
    }
    updateSidebarInfoRef.current = updateSidebarInfo

    const runCalculations = () => {
      const { joints, beams } = stateRef.current
      const numJoints = joints.length
      const numBeams = beams.length

      stateRef.current.calculation_success = false
      stateRef.current.calculated_reactions = {}
      stateRef.current.problematic_joint_indices = []
      beams.forEach((beam) => (beam.force = 0))
      joints.forEach((joint) => (joint.problematic = false))

      if (numJoints === 0) {
        stateRef.current.last_failure_reason = "System ready. Start building."
        updateSidebarInfo()
        requestRedraw()
        return
      }

      const anchorJointIndices = joints.map((j, i) => (j.is_anchor ? i : -1)).filter((i) => i !== -1)
      const numAnchors = anchorJointIndices.length

      if (numBeams === 0) {
        if (numAnchors > 0) {
          const allAnchors = joints.every((j) => j.is_anchor)
          if (allAnchors && numAnchors === numJoints) {
            joints.forEach((joint, idx) => {
              if (joint.is_anchor) {
                stateRef.current.calculated_reactions[idx] = [-joint.load[0], -joint.load[1]]
              }
            })
            stateRef.current.last_failure_reason = "Reactions calculated for isolated anchors."
            stateRef.current.calculation_success = true
          } else {
            stateRef.current.last_failure_reason = "Structure has no beams. Unstable or isolated joints."
          }
        } else {
          stateRef.current.last_failure_reason = "No beams and no anchors. Structure is floating."
        }
        updateSidebarInfo()
        requestRedraw()
        return
      }

      const numReactionUnknowns = numAnchors * 2
      const totalUnknowns = numBeams + numReactionUnknowns
      const totalEquations = numJoints * 2

      if (totalUnknowns !== totalEquations) {
        let reason = `System is not statically determinate. Equations: ${totalEquations}, Unknowns: ${totalUnknowns}.`
        if (totalUnknowns < totalEquations) reason += " (Likely a mechanism)."
        else reason += " (Likely statically indeterminate)."
        stateRef.current.last_failure_reason = reason
        joints.forEach((j) => (j.problematic = true))
        updateSidebarInfo()
        requestRedraw()
        return
      }
      if (numAnchors === 0 && numBeams > 0) {
        stateRef.current.last_failure_reason = "Structure has no anchors and cannot resist loads."
        joints.forEach((j) => (j.problematic = true))
        updateSidebarInfo()
        requestRedraw()
        return
      }

      const A: number[][] = Array(totalEquations)
        .fill(null)
        .map(() => Array(totalUnknowns).fill(0))
      const b: number[] = Array(totalEquations).fill(0)

      const anchorReactionIndices: Record<number, { rx: number; ry: number }> = {}
      let currentReactionUnknownIdx = numBeams
      anchorJointIndices.forEach((anchorIdx) => {
        anchorReactionIndices[anchorIdx] = {
          rx: currentReactionUnknownIdx++,
          ry: currentReactionUnknownIdx++,
        }
      })

      for (let i = 0; i < numJoints; i++) {
        const joint = joints[i]
        const eqX = 2 * i
        const eqY = 2 * i + 1

        b[eqX] = -joint.load[0]
        b[eqY] = -joint.load[1]

        if (joint.is_anchor) {
          const reactionIdx = anchorReactionIndices[i]
          if (reactionIdx) {
            A[eqX][reactionIdx.rx] = 1
            A[eqY][reactionIdx.ry] = 1
          }
        }

        beams.forEach((beam, beamIdx) => {
          let otherJointIdx = -1
          if (beam.joint1_idx === i) {
            otherJointIdx = beam.joint2_idx
          } else if (beam.joint2_idx === i) {
            otherJointIdx = beam.joint1_idx
          }

          if (otherJointIdx !== -1) {
            const otherJoint = joints[otherJointIdx]
            const dx = otherJoint.x - joint.x
            const dy = otherJoint.y - joint.y
            const length = Math.sqrt(dx * dx + dy * dy)

            if (length < FLOAT_TOLERANCE) {
              console.warn(`Beam ${beamIdx} connected to joint ${i} and ${otherJointIdx} has zero length.`)
              return
            }

            const cosTheta = dx / length
            const sinTheta = dy / length

            A[eqX][beamIdx] = cosTheta
            A[eqY][beamIdx] = sinTheta
          }
        })
      }

      const solution = solveLinearSystem(A, b)

      if (solution) {
        stateRef.current.calculation_success = true
        stateRef.current.last_failure_reason = "Structural analysis successful."

        for (let i = 0; i < numBeams; i++) {
          beams[i].force = solution[i]
        }

        anchorJointIndices.forEach((anchorIdx) => {
          const reactionMap = anchorReactionIndices[anchorIdx]
          stateRef.current.calculated_reactions[anchorIdx] = [
            solution[reactionMap.rx],
            solution[reactionMap.ry],
          ]
        })
      } else {
        stateRef.current.calculation_success = false
        stateRef.current.last_failure_reason =
          "Analysis failed: Structure may be unstable, indeterminate, or calculation error."
        joints.forEach((j) => (j.problematic = true))
      }

      updateSidebarInfo()
      requestRedraw()
    }

    const structureChanged = () => {
      runCalculations()
    }

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect()
      const newMouseScreenPos = { x: e.clientX - rect.left, y: e.clientY - rect.top }
      stateRef.current.mouse_screen_pos = newMouseScreenPos
      stateRef.current.mouse_world_pos = screenToWorld(newMouseScreenPos)

      let needsRedraw = false
      let cursorStyle = "crosshair"

      if (stateRef.current.is_panning) {
        const dx = newMouseScreenPos.x - stateRef.current.pan_start_screen.x
        const dy = newMouseScreenPos.y - stateRef.current.pan_start_screen.y
        stateRef.current.camera_pan_offset.x += dx
        stateRef.current.camera_pan_offset.y += dy
        stateRef.current.pan_start_screen = { ...newMouseScreenPos }
        needsRedraw = true
        cursorStyle = "grabbing"
      } else {
        let closestBeamIdx = -1
        let minDistSqToBeam = BEAM_HOVER_THRESHOLD ** 2

        stateRef.current.beams.forEach((beam, index) => {
          if (beam.joint1_idx >= stateRef.current.joints.length || beam.joint2_idx >= stateRef.current.joints.length)
            return
          const j1 = stateRef.current.joints[beam.joint1_idx]
          const j2 = stateRef.current.joints[beam.joint2_idx]
          const screen_j1 = worldToScreen({ x: j1.x, y: j1.y })
          const screen_j2 = worldToScreen({ x: j2.x, y: j2.y })

          const distSq = distToSegmentSquared(newMouseScreenPos, screen_j1, screen_j2)

          if (distSq < minDistSqToBeam) {
            minDistSqToBeam = distSq
            closestBeamIdx = index
          }
        })

        if (stateRef.current.hovered_beam_idx !== closestBeamIdx) {
          stateRef.current.hovered_beam_idx = closestBeamIdx
          needsRedraw = true
        }
        if (closestBeamIdx !== -1) {
          stateRef.current.hovered_beam_tooltip_pos = { ...newMouseScreenPos }
          cursorStyle = "pointer"
          needsRedraw = true
        } else {
          stateRef.current.hovered_beam_tooltip_pos = null
        }

        if (currentTool === "beam" && stateRef.current.selected_joint_idx !== -1) {
          needsRedraw = true
        }
      }

      if (canvas.style.cursor !== cursorStyle) {
        canvas.style.cursor = cursorStyle
      }
      if (needsRedraw) {
        requestRedraw()
      }
    }

    const handleMouseDown = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect()
      stateRef.current.mouse_screen_pos = { x: e.clientX - rect.left, y: e.clientY - rect.top }
      const worldPos = screenToWorld(stateRef.current.mouse_screen_pos)

      if (e.button === 1) {
        stateRef.current.is_panning = true
        stateRef.current.pan_start_screen = { ...stateRef.current.mouse_screen_pos }
        canvas.style.cursor = "grabbing"
        return
      }

      if (e.button !== 0) return

      const snappedPos = snapToGrid(worldPos.x, worldPos.y)
      const joint_hit_radius_world = (JOINT_RADIUS * 1.5) / stateRef.current.camera_zoom
      const closest_joint_idx = getClosestJoint(worldPos, stateRef.current.joints, joint_hit_radius_world)
      const closest_beam_idx = getClosestBeam(
        worldPos,
        stateRef.current.beams,
        stateRef.current.joints,
        joint_hit_radius_world,
      )

      let changeOccurred = false
      let visualChangeOnly = false

      if (currentTool === "joint") {
        const exists = stateRef.current.joints.some((j: Joint) => distance(j, snappedPos) < GRID_SIZE / 4)
        if (!exists) {
          stateRef.current.joints.push({
            x: snappedPos.x,
            y: snappedPos.y,
            is_anchor:
              snappedPos.y >= ANCHOR_Y_WORLD_THRESHOLD && stateRef.current.joints.filter((j) => j.is_anchor).length < 2,
            load: [0, 0],
            problematic: false,
          })
          changeOccurred = true
        }
      } else if (currentTool === "anchor") {
        if (closest_joint_idx !== -1) {
          const joint = stateRef.current.joints[closest_joint_idx]
          joint.is_anchor = !joint.is_anchor
          if (joint.is_anchor) {
            joint.load = [0, 0]
            if (stateRef.current.selected_joint_for_load_idx === closest_joint_idx) {
              stateRef.current.selected_joint_for_load_idx = -1
            }
          }
          changeOccurred = true
        } else {
          const exists = stateRef.current.joints.some((j: Joint) => distance(j, snappedPos) < GRID_SIZE / 4)
          if (!exists) {
            stateRef.current.joints.push({
              x: snappedPos.x,
              y: snappedPos.y,
              is_anchor: true,
              load: [0, 0],
              problematic: false,
            })
            changeOccurred = true
          }
        }
      } else if (currentTool === "beam") {
        if (closest_joint_idx !== -1 && closest_joint_idx < stateRef.current.joints.length) {
          if (stateRef.current.selected_joint_idx === -1) {
            stateRef.current.selected_joint_idx = closest_joint_idx
            visualChangeOnly = true
          } else {
            if (stateRef.current.selected_joint_idx !== closest_joint_idx) {
              const beam_exists = stateRef.current.beams.some(
                (b: Beam) =>
                  (b.joint1_idx === stateRef.current.selected_joint_idx && b.joint2_idx === closest_joint_idx) ||
                  (b.joint1_idx === closest_joint_idx && b.joint2_idx === stateRef.current.selected_joint_idx),
              )
              if (!beam_exists) {
                stateRef.current.beams.push({
                  joint1_idx: stateRef.current.selected_joint_idx,
                  joint2_idx: closest_joint_idx,
                  force: 0,
                  stress: 0,
                })
                changeOccurred = true
              }
            }
            stateRef.current.selected_joint_idx = -1
            if (!changeOccurred) visualChangeOnly = true
          }
        } else {
          if (stateRef.current.selected_joint_idx !== -1) {
            stateRef.current.selected_joint_idx = -1
            visualChangeOnly = true
          }
        }
      } else if (currentTool === "load") {
        const old_selected_load_joint = stateRef.current.selected_joint_for_load_idx
        if (closest_joint_idx !== -1 && closest_joint_idx < stateRef.current.joints.length) {
          if (!stateRef.current.joints[closest_joint_idx].is_anchor) {
            stateRef.current.selected_joint_for_load_idx = closest_joint_idx
          } else {
            stateRef.current.selected_joint_for_load_idx = -1
            stateRef.current.last_failure_reason = "Anchors typically have reactions, not direct external loads in this panel."
            setCalculationSuccess(false)
          }
        } else {
          stateRef.current.selected_joint_for_load_idx = -1
        }
        if (old_selected_load_joint !== stateRef.current.selected_joint_for_load_idx) {
          updateSidebarInfo()
          visualChangeOnly = true
        }
      } else if (currentTool === "select") {
        stateRef.current.selected_joint_idx = -1
        stateRef.current.selected_beam_idx = -1
        setSelectedJointIdx(-1)
        setSelectedBeamIdx(-1)

        if (closest_joint_idx !== -1) {
          stateRef.current.selected_joint_idx = closest_joint_idx
          setSelectedJointIdx(closest_joint_idx)
          visualChangeOnly = true
        } else if (closest_beam_idx !== -1) {
          stateRef.current.selected_beam_idx = closest_beam_idx
          setSelectedBeamIdx(closest_beam_idx)
          visualChangeOnly = true
        }
      }

      if (changeOccurred) {
        structureChanged()
      } else if (visualChangeOnly) {
        requestRedraw()
      }
    }
    const handleMouseUp = (e: MouseEvent) => {
      if (e.button === 1) {
        stateRef.current.is_panning = false
        canvas.style.cursor = stateRef.current.hovered_beam_idx !== -1 ? "pointer" : "crosshair"
      }
    }
    const handleMouseLeave = () => {
      if (stateRef.current.is_panning) {
        stateRef.current.is_panning = false
      }
      if (stateRef.current.hovered_beam_idx !== -1) {
        stateRef.current.hovered_beam_idx = -1
        stateRef.current.hovered_beam_tooltip_pos = null
        requestRedraw()
      }
      canvas.style.cursor = "crosshair"
    }
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault()
      const rect = canvas.getBoundingClientRect()
      const mouseScreenPos = { x: e.clientX - rect.left, y: e.clientY - rect.top }
      const zoomFactor = e.deltaY < 0 ? 1.1 : 1 / 1.1
      zoomCamera(zoomFactor, mouseScreenPos)
    }

    ;(window as any).zoomIn = () => zoomCamera(1.2)
    ;(window as any).zoomOut = () => zoomCamera(1 / 1.2)
    ;(window as any).resetView = resetCameraView
    ;(window as any).modifyLoad = (type: string, direction: string) => {
      if (
        stateRef.current.selected_joint_for_load_idx !== -1 &&
        stateRef.current.selected_joint_for_load_idx < stateRef.current.joints.length
      ) {
        const joint = stateRef.current.joints[stateRef.current.selected_joint_for_load_idx]
        if (joint && !joint.is_anchor) {
          if (type === "fx") {
            joint.load[0] += direction === "plus" ? LOAD_INCREMENT_STEP : -LOAD_INCREMENT_STEP
          } else if (type === "fy") {
            joint.load[1] += direction === "plus" ? LOAD_INCREMENT_STEP : -LOAD_INCREMENT_STEP
          } else if (type === "clear") {
            joint.load = [0, 0]
          }
          structureChanged()
          setLoadValues({ fx: joint.load[0], fy: joint.load[1] })
        }
      }
    }
    ;(window as any).deleteSelected = () => {
      let changeOccurred = false

      if (stateRef.current.selected_joint_idx !== -1) {
        const jointIdx = stateRef.current.selected_joint_idx
        stateRef.current.beams = stateRef.current.beams.filter(
          (beam: Beam) => beam.joint1_idx !== jointIdx && beam.joint2_idx !== jointIdx,
        )
        stateRef.current.beams.forEach((beam: Beam) => {
          if (beam.joint1_idx > jointIdx) beam.joint1_idx--
          if (beam.joint2_idx > jointIdx) beam.joint2_idx--
        })
        stateRef.current.joints.splice(jointIdx, 1)
        stateRef.current.selected_joint_idx = -1
        setSelectedJointIdx(-1)
        if (stateRef.current.selected_joint_for_load_idx === jointIdx) stateRef.current.selected_joint_for_load_idx = -1
        else if (stateRef.current.selected_joint_for_load_idx > jointIdx) {
          stateRef.current.selected_joint_for_load_idx--
        }
        changeOccurred = true
      } else if (stateRef.current.selected_beam_idx !== -1) {
        stateRef.current.beams.splice(stateRef.current.selected_beam_idx, 1)
        stateRef.current.selected_beam_idx = -1
        setSelectedBeamIdx(-1)
        changeOccurred = true
      }

      if (changeOccurred) {
        structureChanged()
      }
    }
    ;(window as any).resetStructure = () => {
      stateRef.current.joints = []
      stateRef.current.beams = []
      stateRef.current.calculated_reactions = {}
      stateRef.current.selected_joint_idx = -1
      stateRef.current.selected_joint_for_load_idx = -1
      stateRef.current.selected_beam_idx = -1
      setSelectedJointIdx(-1)
      setSelectedBeamIdx(-1)
      stateRef.current.problematic_joint_indices = []
      stateRef.current.hovered_beam_idx = -1
      stateRef.current.hovered_beam_tooltip_pos = null
      resetCameraView()
      structureChanged()
    }
    ;(window as any).undoAction = () => {
      let changeOccurred = false, visualChangeOnly = false;

      if (currentTool === "beam" && stateRef.current.selected_joint_idx !== -1) {
        stateRef.current.selected_joint_idx = -1
        visualChangeOnly = true
      } else if (stateRef.current.selected_joint_for_load_idx !== -1) {
        stateRef.current.selected_joint_for_load_idx = -1
        visualChangeOnly = true
        updateSidebarInfo()
      } else if (stateRef.current.beams.length > 0) {
        stateRef.current.beams.pop()
        changeOccurred = true
      } else if (stateRef.current.joints.length > 0) {
        const removed_joint_idx = stateRef.current.joints.length - 1
        stateRef.current.joints.pop()
        stateRef.current.beams = stateRef.current.beams.filter(
          (b: Beam) => b.joint1_idx !== removed_joint_idx && b.joint2_idx !== removed_joint_idx,
        )

        if (stateRef.current.selected_joint_idx === removed_joint_idx) {
          stateRef.current.selected_joint_idx = -1
        }
        if (stateRef.current.selected_joint_for_load_idx === removed_joint_idx) {
          stateRef.current.selected_joint_for_load_idx = -1
          updateSidebarInfo()
        }
        changeOccurred = true
      }

      if (changeOccurred) {
        structureChanged()
      } else if (visualChangeOnly) {
        requestRedraw()
      }
    }

    if (currentTool !== "load" && stateRef.current.selected_joint_for_load_idx !== -1) {
      stateRef.current.selected_joint_for_load_idx = -1
      updateSidebarInfoRef.current()
    }

    resizeCanvas()
    window.addEventListener("resize", resizeCanvas)
    canvas.addEventListener("mousemove", handleMouseMove)
    canvas.addEventListener("mousedown", handleMouseDown)
    canvas.addEventListener("mouseup", handleMouseUp)
    canvas.addEventListener("mouseleave", handleMouseLeave)
    canvas.addEventListener("wheel", handleWheel, { passive: false })
    runCalculations()

    return () => {
      window.removeEventListener("resize", resizeCanvas)
      canvas.removeEventListener("mousemove", handleMouseMove)
      canvas.removeEventListener("mousedown", handleMouseDown)
      canvas.removeEventListener("mouseup", handleMouseUp)
      canvas.removeEventListener("mouseleave", handleMouseLeave)
      canvas.removeEventListener("wheel", handleWheel)
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId)
      }
    }
  }, [currentTool, displayOptions, isDarkMode])

  const zoomIn = () => (window as any).zoomIn?.()
  const zoomOut = () => (window as any).zoomOut?.()
  const resetView = () => (window as any).resetView?.()
  const modifyLoadFxMinus = () => (window as any).modifyLoad?.("fx", "minus")
  const modifyLoadFxPlus = () => (window as any).modifyLoad?.("fx", "plus")
  const modifyLoadFyMinus = () => (window as any).modifyLoad?.("fy", "minus")
  const modifyLoadFyPlus = () => (window as any).modifyLoad?.("fy", "plus")
  const clearLoad = () => (window as any).modifyLoad?.("clear")
  const undoAction = () => (window as any).undoAction?.()
  const resetStructure = () => (window as any).resetStructure?.()
  const deleteSelected = () => (window as any).deleteSelected?.()

  const tools = [
    { id: "joint", icon: Circle, label: "Joint", shortcut: "J" },
    { id: "beam", icon: Minus, label: "Beam", shortcut: "B" },
    { id: "anchor", icon: Anchor, label: "Anchor", shortcut: "A" },
    { id: "load", icon: Download, label: "Load", shortcut: "L" },
    { id: "select", icon: MousePointer, label: "Select", shortcut: "S" },
  ]

  return (
    <div className={`${isDarkMode ? "bg-slate-900" : "bg-gray-50"} flex flex-col h-screen overflow-hidden antialiased`}>
      <div
        className={`${
          isDarkMode
            ? "bg-gradient-to-r from-slate-800 to-slate-700 border-slate-600"
            : "bg-gradient-to-r from-white to-gray-50 border-gray-200"
        } border-b shadow-xl`}
      >
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center space-x-6">
            <div className="flex items-center space-x-3">
              <div className="relative">
                <DraftingCompass className={`w-8 h-8 ${isDarkMode ? "text-blue-400" : "text-blue-600"}`} />
                <div
                  className={`absolute inset-0 ${isDarkMode ? "bg-blue-400" : "bg-blue-600"} rounded-full blur-lg opacity-20`}
                ></div>
              </div>
              <div>
                <h1
                  className={`text-2xl font-bold bg-gradient-to-r ${
                    isDarkMode ? "from-blue-400 to-purple-400" : "from-blue-600 to-purple-600"
                  } bg-clip-text text-transparent`}
                >
                  BridgeSim
                </h1>
                <p className={`text-xs ${isDarkMode ? "text-slate-400" : "text-gray-500"}`}>Structural Simulator</p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              {tools.map((tool) => {
                const Icon = tool.icon
                return (
                  <button
                    key={tool.id}
                    onClick={() => {
                      setCurrentTool(tool.id)
                      if (tool.id !== "beam" && stateRef.current.selected_joint_idx !== -1) {
                        stateRef.current.selected_joint_idx = -1
                        requestRedraw()
                      }
                      if (tool.id !== "load" && stateRef.current.selected_joint_for_load_idx !== -1) {
                        stateRef.current.selected_joint_for_load_idx = -1
                        updateSidebarInfoRef.current()
                      }
                      if (tool.id !== "select") {
                        stateRef.current.selected_joint_idx = -1
                        stateRef.current.selected_beam_idx = -1
                        setSelectedJointIdx(-1)
                        setSelectedBeamIdx(-1)
                      }
                    }}
                    className={`
                      group relative flex items-center space-x-2 px-4 py-2.5 rounded-xl font-medium text-sm
                      transition-all duration-200 ease-out transform hover:scale-105
                      ${
                        currentTool === tool.id
                          ? "bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg shadow-blue-500/25"
                          : isDarkMode
                            ? "bg-slate-700/50 text-slate-300 hover:bg-slate-600/70 hover:text-white"
                            : "bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-800"
                      }
                    `}
                    title={`${tool.label} (${tool.shortcut})`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{tool.label}</span>
                    {currentTool === tool.id && (
                      <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl blur opacity-30 -z-10"></div>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {(selectedJointIdx !== -1 || selectedBeamIdx !== -1) && (
              <button
                onClick={deleteSelected}
                className="flex items-center space-x-2 px-4 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl font-medium text-sm transition-all duration-200 transform hover:scale-105 shadow-lg shadow-red-500/25"
              >
                <Trash2 className="w-4 h-4" />
                <span>Delete</span>
              </button>
            )}

            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all duration-200 transform hover:scale-105 shadow-lg ${
                isDarkMode
                  ? "bg-yellow-500 hover:bg-yellow-600 text-white shadow-yellow-500/25"
                  : "bg-slate-700 hover:bg-slate-800 text-white shadow-slate-700/25"
              }`}
            >
              {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              <span>{isDarkMode ? "Light" : "Dark"}</span>
            </button>

            <button
              onClick={undoAction}
              className="flex items-center space-x-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-medium text-sm transition-all duration-200 transform hover:scale-105 shadow-lg shadow-amber-500/25"
            >
              <Undo className="w-4 h-4" />
              <span>Undo</span>
            </button>
            <button
              onClick={resetStructure}
              className="flex items-center space-x-2 px-4 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl font-medium text-sm transition-all duration-200 transform hover:scale-105 shadow-lg shadow-red-500/25"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Reset</span>
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-grow overflow-hidden">
        <div
          className={`flex-grow relative ${
            isDarkMode ? "bg-gradient-to-br from-slate-800 to-slate-900" : "bg-gradient-to-br from-gray-100 to-gray-200"
          }`}
        >
          <canvas
            ref={canvasRef}
            className="w-full h-full"
            style={{ imageRendering: "crisp-edges" }}
          />
          <div
            className={`absolute top-4 left-4 ${
              isDarkMode ? "bg-slate-800/90 border-slate-700" : "bg-white/90 border-gray-200"
            } backdrop-blur-sm rounded-xl p-3 shadow-xl border`}
          >
            <div className={`text-xs ${isDarkMode ? "text-slate-400" : "text-gray-500"} mb-1`}>Current Tool</div>
            <div className={`text-sm font-medium ${isDarkMode ? "text-white" : "text-gray-800"} capitalize`}>
              {currentTool}
            </div>
          </div>
        </div>

        <div
          className={`w-80 ${
            isDarkMode ? "bg-slate-800 border-slate-700" : "bg-white border-gray-200"
          } border-l shadow-2xl`}
        >
          <div className="h-full overflow-y-auto p-6 space-y-6">
            <div
              className={`${
                isDarkMode
                  ? "bg-gradient-to-br from-slate-700 to-slate-800 border-slate-600"
                  : "bg-gradient-to-br from-gray-50 to-gray-100 border-gray-200"
              } rounded-xl p-4 border`}
            >
              <div className="flex items-center space-x-2 mb-4">
                <Info className={`w-5 h-5 ${isDarkMode ? "text-blue-400" : "text-blue-600"}`} />
                <h2 className={`text-lg font-semibold ${isDarkMode ? "text-white" : "text-gray-800"}`}>
                  Structure Info
                </h2>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  {
                    label: "Joints",
                    value: structureInfo.joints,
                    colorClass: isDarkMode ? "text-blue-400" : "text-blue-600",
                  },
                  {
                    label: "Beams",
                    value: structureInfo.beams,
                    colorClass: isDarkMode ? "text-purple-400" : "text-purple-600",
                  },
                  {
                    label: "Anchors",
                    value: structureInfo.anchors,
                    colorClass: isDarkMode ? "text-green-400" : "text-green-600",
                  },
                  {
                    label: "Loads",
                    value: structureInfo.loads,
                    colorClass: isDarkMode ? "text-amber-400" : "text-amber-600",
                  },
                ].map((item) => (
                  <div key={item.label} className={`${isDarkMode ? "bg-slate-900/50" : "bg-white/50"} rounded-lg p-3`}>
                    <div className={`text-xs ${isDarkMode ? "text-slate-400" : "text-gray-500"}`}>{item.label}</div>
                    <div className={`text-xl font-bold ${item.colorClass}`}>{item.value}</div>
                  </div>
                ))}
              </div>
            </div>

            {showLoadPanel && (
              <div
                className={`${
                  isDarkMode
                    ? "bg-gradient-to-br from-amber-900/20 to-orange-900/20 border-amber-500/30"
                    : "bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200"
                } rounded-xl p-4 border`}
              >
                <div className="flex items-center space-x-2 mb-4">
                  <Sliders className={`w-5 h-5 ${isDarkMode ? "text-amber-400" : "text-amber-600"}`} />
                  <h2 className={`text-lg font-semibold ${isDarkMode ? "text-white" : "text-gray-800"}`}>
                    Modify Load: Joint {selectedLoadJoint}
                  </h2>
                </div>

                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <label className={`text-sm font-medium ${isDarkMode ? "text-slate-300" : "text-gray-700"}`}>
                        Force X (Fx)
                      </label>
                      <span className={`text-sm font-mono ${isDarkMode ? "text-amber-400" : "text-amber-600"}`}>
                        {loadValues.fx.toFixed(0)} N
                      </span>
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={modifyLoadFxMinus}
                        className={`flex-1 ${
                          isDarkMode
                            ? "bg-slate-700 hover:bg-slate-600 text-white"
                            : "bg-gray-200 hover:bg-gray-300 text-gray-800"
                        } py-2 px-3 rounded-lg text-sm transition-colors`}
                      >
                        -{LOAD_INCREMENT_STEP}
                      </button>
                      <button
                        onClick={modifyLoadFxPlus}
                        className={`flex-1 ${
                          isDarkMode
                            ? "bg-slate-700 hover:bg-slate-600 text-white"
                            : "bg-gray-200 hover:bg-gray-300 text-gray-800"
                        } py-2 px-3 rounded-lg text-sm transition-colors`}
                      >
                        +{LOAD_INCREMENT_STEP}
                      </button>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <label className={`text-sm font-medium ${isDarkMode ? "text-slate-300" : "text-gray-700"}`}>
                        Force Y (Fy)
                      </label>
                      <span className={`text-sm font-mono ${isDarkMode ? "text-amber-400" : "text-amber-600"}`}>
                        {loadValues.fy.toFixed(0)} N
                      </span>
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={modifyLoadFyMinus}
                        className={`flex-1 ${
                          isDarkMode
                            ? "bg-slate-700 hover:bg-slate-600 text-white"
                            : "bg-gray-200 hover:bg-gray-300 text-gray-800"
                        } py-2 px-3 rounded-lg text-sm transition-colors`}
                      >
                        -{LOAD_INCREMENT_STEP}
                      </button>
                      <button
                        onClick={modifyLoadFyPlus}
                        className={`flex-1 ${
                          isDarkMode
                            ? "bg-slate-700 hover:bg-slate-600 text-white"
                            : "bg-gray-200 hover:bg-gray-300 text-gray-800"
                        } py-2 px-3 rounded-lg text-sm transition-colors`}
                      >
                        +{LOAD_INCREMENT_STEP}
                      </button>
                    </div>
                  </div>

                  <button
                    onClick={clearLoad}
                    className="w-full bg-red-500 hover:bg-red-600 text-white py-2 rounded-lg text-sm transition-colors"
                  >
                    Clear Load
                  </button>
                </div>
              </div>
            )}

            <div
              className={`${
                isDarkMode
                  ? "bg-gradient-to-br from-slate-700 to-slate-800 border-slate-600"
                  : "bg-gradient-to-br from-gray-50 to-gray-100 border-gray-200"
              } rounded-xl p-4 border`}
            >
              <div className="flex items-center space-x-2 mb-4">
                <Eye className={`w-5 h-5 ${isDarkMode ? "text-green-400" : "text-green-600"}`} />
                <h2 className={`text-lg font-semibold ${isDarkMode ? "text-white" : "text-gray-800"}`}>
                  Display Options
                </h2>
              </div>

              <div className="space-y-3">
                {[
                  { key: "grid", label: "Show Grid" },
                  { key: "forces", label: "Color Beams by Force" },
                  { key: "reactions", label: "Show Reaction Forces" },
                ].map((option) => (
                  <label key={option.key} className="flex items-center space-x-3 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={displayOptions[option.key as keyof typeof displayOptions]}
                      onChange={(e) => {
                        const newDisplayOptions = {
                          ...displayOptions,
                          [option.key]: e.target.checked,
                        }
                        setDisplayOptions(newDisplayOptions)
                      }}
                      className={`w-4 h-4 text-blue-500 ${
                        isDarkMode ? "bg-slate-700 border-slate-600" : "bg-white border-gray-300"
                      } rounded focus:ring-blue-500 focus:ring-2`}
                    />
                    <span
                      className={`text-sm ${
                        isDarkMode ? "text-slate-300 group-hover:text-white" : "text-gray-600 group-hover:text-gray-800"
                      } transition-colors`}
                    >
                      {option.label}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div
              className={`${
                isDarkMode
                  ? "bg-gradient-to-br from-slate-700 to-slate-800 border-slate-600"
                  : "bg-gradient-to-br from-gray-50 to-gray-100 border-gray-200"
              } rounded-xl p-4 border`}
            >
              <div className="flex items-center space-x-2 mb-4">
                <Search className={`w-5 h-5 ${isDarkMode ? "text-purple-400" : "text-purple-600"}`} />
                <h2 className={`text-lg font-semibold ${isDarkMode ? "text-white" : "text-gray-800"}`}>
                  View Controls
                </h2>
              </div>

              <div className="space-y-3">
                <div className="flex space-x-2">
                  <button
                    onClick={zoomIn}
                    className={`flex-1 flex items-center justify-center space-x-2 ${
                      isDarkMode
                        ? "bg-slate-700 hover:bg-slate-600 text-white"
                        : "bg-gray-200 hover:bg-gray-300 text-gray-800"
                    } py-2 px-3 rounded-lg text-sm transition-colors`}
                  >
                    <ZoomIn className="w-4 h-4" />
                    <span>Zoom In</span>
                  </button>
                  <button
                    onClick={zoomOut}
                    className={`flex-1 flex items-center justify-center space-x-2 ${
                      isDarkMode
                        ? "bg-slate-700 hover:bg-slate-600 text-white"
                        : "bg-gray-200 hover:bg-gray-300 text-gray-800"
                    } py-2 px-3 rounded-lg text-sm transition-colors`}
                  >
                    <ZoomOut className="w-4 h-4" />
                    <span>Zoom Out</span>
                  </button>
                </div>

                <button
                  onClick={resetView}
                  className={`w-full flex items-center justify-center space-x-2 ${
                    isDarkMode
                      ? "bg-slate-700 hover:bg-slate-600 text-white"
                      : "bg-gray-200 hover:bg-gray-300 text-gray-800"
                  } py-2 px-3 rounded-lg text-sm transition-colors`}
                >
                  <ExpandIcon className="w-4 h-4" />
                  <span>Reset View</span>
                </button>

                <div className={`text-sm ${isDarkMode ? "text-slate-400" : "text-gray-500"}`}>
                  Zoom:{" "}
                  <span className={`font-mono ${isDarkMode ? "text-purple-400" : "text-purple-600"}`}>
                    {zoomLevel}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div
        className={`${
          isDarkMode ? "bg-slate-800 border-slate-700" : "bg-white border-gray-200"
        } border-t px-6 py-3 shadow-xl`}
      >
        <div className="flex items-center space-x-3">
          {calculationSuccess ? (
            <CheckCircle className="w-5 h-5 text-green-400" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-red-400" />
          )}
          <span
            className={`text-sm ${
              calculationSuccess
                ? isDarkMode
                  ? "text-slate-300"
                  : "text-gray-600"
                : isDarkMode
                  ? "text-red-400"
                  : "text-red-500"
            }`}
          >
            {statusMessage}
          </span>
        </div>
      </div>
    </div>
  )
}