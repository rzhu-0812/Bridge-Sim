export type AnchorType = 'pin' | 'roller_x' | 'roller_y';

export interface Joint {
  x: number;
  y: number;
  anchor_type: AnchorType | null;
  load: [number, number];
  problematic: boolean;
}

export interface Beam {
  joint1_idx: number;
  joint2_idx: number;
  force: number;
  stress: number;
}

export interface SimulationState {
  joints: Joint[];
  beams: Beam[];
  calculated_reactions: Record<number, { rx?: number; ry?: number }>;
  calculation_success: boolean;
  last_failure_reason: string;
  problematic_joint_indices: number[];
}

export type Tool = "joint" | "beam" | "anchor" | "load" | "select";

export interface DisplayOptions {
  grid: boolean;
  forces: boolean;
  reactions: boolean;
}

export interface StructureInfo {
  joints: number;
  beams: number;
  anchors: number;
  loads: number;
}

export interface LoadValues {
  fx: number;
  fy: number;
}

export interface CanvasInteractionState {
  mouse_screen_pos: { x: number; y: number };
  mouse_world_pos: { x: number; y: number };
  camera_zoom: number;
  camera_pan_offset: { x: number; y: number };
  is_panning: boolean;
  pan_start_screen: { x: number; y: number };
  hovered_beam_idx: number;
  hovered_beam_tooltip_pos: { x: number; y: number } | null;
  temp_beam_start_joint_idx: number | null;
  selected_element_for_highlight: { type: 'joint' | 'beam', id: number } | null;
}