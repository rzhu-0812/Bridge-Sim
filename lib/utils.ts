import { Joint } from "./types";

export function solveLinearSystem(
  A_orig: number[][],
  b_orig: number[]
): number[] | null {
  const n = A_orig.length;
  if (n === 0 || A_orig[0].length !== n) {
    console.error("Invalid matrix dimensions for solver.");
    return null;
  }

  const A = A_orig.map((row) => [...row]);
  const b = [...b_orig];

  for (let i = 0; i < n; i++) {
    let maxRow = i;
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(A[k][i]) > Math.abs(A[maxRow][i])) {
        maxRow = k;
      }
    }
    [A[i], A[maxRow]] = [A[maxRow], A[i]];
    [b[i], b[maxRow]] = [b[maxRow], b[i]];

    if (Math.abs(A[i][i]) < 1e-9) {
      console.warn(
        `Singular matrix or near-singular at row ${i}, pivot: ${A[i][i]}`
      );
      return null;
    }

    const pivot = A[i][i];
    for (let j = i; j < n; j++) {
      A[i][j] /= pivot;
    }
    b[i] /= pivot;

    for (let k = 0; k < n; k++) {
      if (k !== i) {
        const factor = A[k][i];
        for (let j = i; j < n; j++) {
          A[k][j] -= factor * A[i][j];
        }
        b[k] -= factor * b[i];
      }
    }
  }
  return b;
}

export function distToSegmentSquared(
  p: { x: number; y: number },
  v: { x: number; y: number },
  w: { x: number; y: number }
): number {
  const l2 = (v.x - w.x) ** 2 + (v.y - w.y) ** 2;
  if (l2 === 0) return (p.x - v.x) ** 2 + (p.y - v.y) ** 2;
  let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
  t = Math.max(0, Math.min(1, t));
  const projX = v.x + t * (w.x - v.x);
  const projY = v.y + t * (w.y - v.y);
  return (p.x - projX) ** 2 + (p.y - projY) ** 2;
}

export const snapToGrid = (x: number, y: number, gridSize: number) => {
  return {
    x: Math.round(x / gridSize) * gridSize,
    y: Math.round(y / gridSize) * gridSize,
  };
};

export const distance = (
  p1: { x: number; y: number },
  p2: { x: number; y: number }
) => {
  return Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);
};

export const getClosestJoint = (
  position: { x: number; y: number },
  joints: Joint[],
  maxDistance: number
): number => {
  let closestIndex = -1;
  let minDistSq = maxDistance ** 2;
  joints.forEach((joint, index) => {
    const distSq = (joint.x - position.x) ** 2 + (joint.y - position.y) ** 2;
    if (distSq < minDistSq) {
      minDistSq = distSq;
      closestIndex = index;
    }
  });
  return closestIndex;
};

export const getClosestBeam = (
  screenPos: { x: number; y: number },
  beamsData: {
    beam_idx: number;
    screen_j1: { x: number; y: number };
    screen_j2: { x: number; y: number };
  }[],
  maxScreenDistance: number
): number => {
  let closestIndex = -1;
  let minDistSq = maxScreenDistance ** 2;

  beamsData.forEach(({ beam_idx, screen_j1, screen_j2 }) => {
    const distSq = distToSegmentSquared(screenPos, screen_j1, screen_j2);
    if (distSq < minDistSq) {
      minDistSq = distSq;
      closestIndex = beam_idx;
    }
  });
  return closestIndex;
};