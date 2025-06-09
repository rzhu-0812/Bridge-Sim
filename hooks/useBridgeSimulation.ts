import { useState, useCallback, useRef } from "react";
import { Joint, Beam, SimulationState, AnchorType } from "@/lib/types";
import { solveLinearSystem } from "@/lib/utils";
import { FLOAT_TOLERANCE } from "@/lib/constants";

function isStructureFullyConnected(numJoints: number, beams: Beam[]): boolean {
  if (numJoints <= 1) return true;
  if (numJoints > 1 && beams.length === 0) return false;
  const visited = new Set<number>();
  const adj: Record<number, number[]> = {};
  for (let i = 0; i < numJoints; i++) adj[i] = [];
  beams.forEach(({ joint1_idx, joint2_idx }) => {
    if (joint1_idx < numJoints && joint2_idx < numJoints) {
      adj[joint1_idx].push(joint2_idx);
      adj[joint2_idx].push(joint1_idx);
    }
  });

  let startNode = 0;
  if (numJoints > 0) {
    if (!adj[0] || adj[0].length === 0) {
      let foundStartable = false;
      for (let i = 0; i < numJoints; i++) {
        if (adj[i] && adj[i].length > 0) {
          startNode = i;
          foundStartable = true;
          break;
        }
      }
      if (!foundStartable && numJoints > 0) {
      } else if (!foundStartable && numJoints === 0) {
        return true;
      }
    }
  } else {
    return true;
  }

  const stack: number[] = [];
  if (numJoints > 0) {
    stack.push(startNode);
    visited.add(startNode);
  }

  let head = 0;
  while (head < stack.length) {
    const current = stack[head++];
    (adj[current] || []).forEach((neighbor) => {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        stack.push(neighbor);
      }
    });
  }
  return visited.size === numJoints;
}

function areAllJointsReachableFromAnchors(
  joints: Joint[],
  beams: Beam[]
): { reachable: boolean; problematicUnreachable?: number[] } {
  const numJoints = joints.length;
  if (numJoints === 0) return { reachable: true };

  const anchorIndices = joints
    .map((j, i) => (j.anchor_type !== null ? i : -1))
    .filter((i) => i !== -1);

  if (anchorIndices.length === 0 && numJoints > 0) {
    return {
      reachable: false,
      problematicUnreachable: Array.from({ length: numJoints }, (_, i) => i),
    };
  }

  const allJointsAreAnchors = joints.every((j) => j.anchor_type !== null);
  if (allJointsAreAnchors) {
    return { reachable: true };
  }

  const adj: Record<number, number[]> = {};
  for (let i = 0; i < numJoints; i++) adj[i] = [];
  beams.forEach(({ joint1_idx, joint2_idx }) => {
    if (joint1_idx < numJoints && joint2_idx < numJoints) {
      adj[joint1_idx].push(joint2_idx);
      adj[joint2_idx].push(joint1_idx);
    }
  });

  const visitedFromAnchors = new Set<number>();
  const queue: number[] = [];
  anchorIndices.forEach((anchorIdx) => {
    if (anchorIdx < numJoints) {
      if (!visitedFromAnchors.has(anchorIdx)) {
        visitedFromAnchors.add(anchorIdx);
        queue.push(anchorIdx);
      }
    }
  });

  let head = 0;
  while (head < queue.length) {
    const current = queue[head++];
    (adj[current] || []).forEach((neighbor) => {
      if (!visitedFromAnchors.has(neighbor)) {
        visitedFromAnchors.add(neighbor);
        queue.push(neighbor);
      }
    });
  }

  if (visitedFromAnchors.size === numJoints) {
    return { reachable: true };
  } else {
    const problematicUnreachable: number[] = [];
    for (let i = 0; i < numJoints; i++) {
      if (!visitedFromAnchors.has(i)) {
        problematicUnreachable.push(i);
      }
    }
    return { reachable: false, problematicUnreachable };
  }
}

function findCoincidentAnchors(joints: Joint[]): {
  hasCoincident: boolean;
  problematicCoincident?: number[];
} {
  const anchorJointsWithIndices = joints
    .map((j, i) => ({ joint: j, index: i }))
    .filter((item) => item.joint.anchor_type !== null);

  if (anchorJointsWithIndices.length < 2) return { hasCoincident: false };

  const anchorCoords = new Map<string, number[]>();
  for (const { joint, index } of anchorJointsWithIndices) {
    const coordKey = `${joint.x.toFixed(3)},${joint.y.toFixed(3)}`;
    if (!anchorCoords.has(coordKey)) {
      anchorCoords.set(coordKey, []);
    }
    anchorCoords.get(coordKey)!.push(index);
  }

  const problematicCoincident: number[] = [];
  for (const indicesAtCoord of anchorCoords.values()) {
    if (indicesAtCoord.length > 1) {
      problematicCoincident.push(...indicesAtCoord);
    }
  }
  return {
    hasCoincident: problematicCoincident.length > 0,
    problematicCoincident:
      problematicCoincident.length > 0 ? problematicCoincident : undefined,
  };
}

const initialSimulationState: SimulationState = {
  joints: [],
  beams: [],
  calculated_reactions: {},
  calculation_success: false,
  last_failure_reason: "System ready. Start building.",
  problematic_joint_indices: [],
};

export function useBridgeSimulation() {
  const [simulationState, setSimulationState] = useState<SimulationState>(
    initialSimulationState
  );
  const historyRef = useRef<SimulationState[]>([]);

  const runCalculations = useCallback(
    (
      currentJoints: Joint[],
      currentBeams: Beam[]
    ): Partial<SimulationState> => {
      const numJoints = currentJoints.length;
      const numBeams = currentBeams.length;

      let newCalculatedReactions: SimulationState["calculated_reactions"] = {};
      let newCalculationSuccess = false;
      let newLastFailureReason = "System ready. Start building.";
      let newProblematicJointIndices: number[] = [];
      const beamsWithForces = currentBeams.map((b) => ({ ...b, force: 0 }));
      const jointsWithProblematicFlag = currentJoints.map((j) => ({
        ...j,
        problematic: false,
      }));

      const markAllJointsProblematic = () => {
        newProblematicJointIndices = [];
        jointsWithProblematicFlag.forEach((j, idx) => {
          j.problematic = true;
          newProblematicJointIndices.push(idx);
        });
      };
      const markSpecificJointsProblematic = (indices: number[]) => {
        const currentProblematicSet = new Set(newProblematicJointIndices);
        indices.forEach((idx) => {
          if (idx >= 0 && idx < numJoints) {
            jointsWithProblematicFlag[idx].problematic = true;
            currentProblematicSet.add(idx);
          }
        });
        newProblematicJointIndices = Array.from(currentProblematicSet);
      };

      if (numJoints === 0) {
        return {
          joints: [],
          beams: [],
          calculated_reactions: {},
          calculation_success: true,
          last_failure_reason: "System empty. Add joints and beams.",
          problematic_joint_indices: [],
        };
      }

      const anchorsWithType: { index: number; type: AnchorType }[] = [];
      jointsWithProblematicFlag.forEach((j, i) => {
        if (j.anchor_type) {
          anchorsWithType.push({ index: i, type: j.anchor_type });
        }
      });
      const numAnchorJoints = anchorsWithType.length;

      if (numBeams === 0) {
        if (numAnchorJoints > 0) {
          const allJointsAreAnchors = jointsWithProblematicFlag.every(
            (j) => j.anchor_type !== null
          );
          if (allJointsAreAnchors) {
            newLastFailureReason =
              "Structure consists only of anchors (no beams). Static if loads are balanced by reactions.";
            newCalculationSuccess = true;
            jointsWithProblematicFlag.forEach((joint, idx) => {
              if (joint.anchor_type) {
                const reaction: { rx?: number; ry?: number } = {};
                if (
                  Math.abs(joint.load[0]) > FLOAT_TOLERANCE ||
                  Math.abs(joint.load[1]) > FLOAT_TOLERANCE
                ) {
                  if (
                    joint.anchor_type === "pin" ||
                    joint.anchor_type === "roller_y"
                  )
                    reaction.rx = -joint.load[0];
                  if (
                    joint.anchor_type === "pin" ||
                    joint.anchor_type === "roller_x"
                  )
                    reaction.ry = -joint.load[1];
                }
                if (Object.keys(reaction).length > 0)
                  newCalculatedReactions[idx] = reaction;
              }
            });
          } else {
            newLastFailureReason =
              "Structure has anchors but also floating joints (no beams to connect them).";
            markSpecificJointsProblematic(
              jointsWithProblematicFlag
                .map((j, i) => (j.anchor_type === null ? i : -1))
                .filter((i) => i !== -1)
            );
          }
        } else {
          newLastFailureReason =
            "No beams and no anchors. Structure is unstable.";
          markAllJointsProblematic();
        }
        return {
          calculated_reactions: newCalculatedReactions,
          calculation_success: newCalculationSuccess,
          last_failure_reason: newLastFailureReason,
          problematic_joint_indices: newProblematicJointIndices,
          beams: beamsWithForces,
          joints: jointsWithProblematicFlag,
        };
      }

      if (!isStructureFullyConnected(numJoints, beamsWithForces)) {
        newLastFailureReason =
          "Structure is not fully connected. Contains isolated parts or joints.";
        markAllJointsProblematic();
        return {
          calculated_reactions: {},
          calculation_success: false,
          last_failure_reason: newLastFailureReason,
          problematic_joint_indices: newProblematicJointIndices,
          beams: beamsWithForces,
          joints: jointsWithProblematicFlag,
        };
      }

      if (numAnchorJoints === 0) {
        newLastFailureReason =
          "Structure has beams but no anchors. It cannot resist loads and is unstable.";
        markAllJointsProblematic();
        return {
          calculated_reactions: {},
          calculation_success: false,
          last_failure_reason: newLastFailureReason,
          problematic_joint_indices: newProblematicJointIndices,
          beams: beamsWithForces,
          joints: jointsWithProblematicFlag,
        };
      }

      const coincidentCheck = findCoincidentAnchors(jointsWithProblematicFlag);
      if (coincidentCheck.hasCoincident) {
        newLastFailureReason =
          "Multiple anchors are at the exact same location, reducing effective support or causing redundancy.";
        if (coincidentCheck.problematicCoincident) {
          markSpecificJointsProblematic(coincidentCheck.problematicCoincident);
        }
        return {
          calculated_reactions: {},
          calculation_success: false,
          last_failure_reason: newLastFailureReason,
          problematic_joint_indices: newProblematicJointIndices,
          beams: beamsWithForces,
          joints: jointsWithProblematicFlag,
        };
      }

      const reachability = areAllJointsReachableFromAnchors(
        jointsWithProblematicFlag,
        beamsWithForces
      );
      if (!reachability.reachable) {
        newLastFailureReason =
          "Not all parts of the structure are connected to an anchor. Contains floating sections.";
        if (reachability.problematicUnreachable) {
          markSpecificJointsProblematic(reachability.problematicUnreachable);
        } else {
          markAllJointsProblematic();
        }
        return {
          calculated_reactions: {},
          calculation_success: false,
          last_failure_reason: newLastFailureReason,
          problematic_joint_indices: newProblematicJointIndices,
          beams: beamsWithForces,
          joints: jointsWithProblematicFlag,
        };
      }

      let numReactionUnknowns = 0;
      anchorsWithType.forEach((anchor) => {
        if (anchor.type === "pin") numReactionUnknowns += 2;
        else if (anchor.type === "roller_x") numReactionUnknowns += 1;
        else if (anchor.type === "roller_y") numReactionUnknowns += 1;
      });

      let providesGlobalRx = false;
      let providesGlobalRy = false;
      let providesMomentResistance = numAnchorJoints >= 2;

      anchorsWithType.forEach((anchor) => {
        if (anchor.type === "pin" || anchor.type === "roller_y")
          providesGlobalRx = true;
        if (anchor.type === "pin" || anchor.type === "roller_x")
          providesGlobalRy = true;
      });

      if (numReactionUnknowns < 3) {
        newLastFailureReason = `Insufficient reactions (${numReactionUnknowns}) to ensure global stability. Need at least 3 for a general 2D truss (e.g., pin and roller, or 3 rollers not collinear/concurrent).`;
        markSpecificJointsProblematic(anchorsWithType.map((a) => a.index));
        return {
          calculated_reactions: {},
          calculation_success: false,
          last_failure_reason: newLastFailureReason,
          problematic_joint_indices: newProblematicJointIndices,
          beams: beamsWithForces,
          joints: jointsWithProblematicFlag,
        };
      }
      if (!(providesGlobalRx && providesGlobalRy && providesMomentResistance)) {
        let issues = [];
        if (!providesGlobalRx) issues.push("resist X-direction forces");
        if (!providesGlobalRy) issues.push("resist Y-direction forces");
        if (!providesMomentResistance) issues.push("resist rotation (moment)");
        newLastFailureReason = `Structure lacks ability to ${issues.join(
          " and "
        )} globally.`;
        markSpecificJointsProblematic(anchorsWithType.map((a) => a.index));
        return {
          calculated_reactions: {},
          calculation_success: false,
          last_failure_reason: newLastFailureReason,
          problematic_joint_indices: newProblematicJointIndices,
          beams: beamsWithForces,
          joints: jointsWithProblematicFlag,
        };
      }

      const totalUnknowns = numBeams + numReactionUnknowns;
      const totalEquations = numJoints * 2;

      if (totalUnknowns !== totalEquations) {
        newLastFailureReason = `System is not statically determinate by count. Equations: ${totalEquations}, Unknowns (beams + reactions): ${totalUnknowns}.`;
        if (totalUnknowns < totalEquations)
          newLastFailureReason += " (Likely a mechanism / unstable).";
        else
          newLastFailureReason +=
            " (Likely statically indeterminate; this solver handles determinate systems).";
        markAllJointsProblematic();
        return {
          calculated_reactions: newCalculatedReactions,
          calculation_success: false,
          last_failure_reason: newLastFailureReason,
          problematic_joint_indices: newProblematicJointIndices,
          beams: beamsWithForces,
          joints: jointsWithProblematicFlag,
        };
      }

      const A: number[][] = Array(totalEquations)
        .fill(null)
        .map(() => Array(totalUnknowns).fill(0));
      const b_vec: number[] = Array(totalEquations).fill(0);

      const jointToReactionMatrixIndices: Record<
        number,
        { rx?: number; ry?: number }
      > = {};
      let currentReactionUnknownIdx = numBeams;

      anchorsWithType.forEach((anchor) => {
        const jointIdx = anchor.index;
        jointToReactionMatrixIndices[jointIdx] = {};
        if (anchor.type === "pin") {
          jointToReactionMatrixIndices[jointIdx].rx =
            currentReactionUnknownIdx++;
          jointToReactionMatrixIndices[jointIdx].ry =
            currentReactionUnknownIdx++;
        } else if (anchor.type === "roller_x") {
          jointToReactionMatrixIndices[jointIdx].ry =
            currentReactionUnknownIdx++;
        } else if (anchor.type === "roller_y") {
          jointToReactionMatrixIndices[jointIdx].rx =
            currentReactionUnknownIdx++;
        }
      });

      for (let i = 0; i < numJoints; i++) {
        const joint = jointsWithProblematicFlag[i];
        const eqX = 2 * i;
        const eqY = 2 * i + 1;
        b_vec[eqX] = -joint.load[0];
        b_vec[eqY] = -joint.load[1];

        if (joint.anchor_type) {
          const reactionMapping = jointToReactionMatrixIndices[i];
          if (reactionMapping.rx !== undefined) A[eqX][reactionMapping.rx] = 1;
          if (reactionMapping.ry !== undefined) A[eqY][reactionMapping.ry] = 1;
        }

        beamsWithForces.forEach((beam, beamIdx) => {
          let otherJointIdx = -1;
          if (beam.joint1_idx === i) otherJointIdx = beam.joint2_idx;
          else if (beam.joint2_idx === i) otherJointIdx = beam.joint1_idx;

          if (otherJointIdx !== -1) {
            if (otherJointIdx >= numJoints || otherJointIdx < 0) {
              newLastFailureReason = `Beam ${beamIdx} connects to an invalid joint index.`;
              markSpecificJointsProblematic([i]);
              return {};
            }
            const otherJoint = jointsWithProblematicFlag[otherJointIdx];
            const dx = otherJoint.x - joint.x;
            const dy = otherJoint.y - joint.y;
            const length = Math.sqrt(dx * dx + dy * dy);

            if (length < FLOAT_TOLERANCE) {
              newLastFailureReason = `Beam ${beamIdx} (Joints ${i}-${otherJointIdx}) has zero length or connects coincident joints.`;
              markSpecificJointsProblematic([i, otherJointIdx]);

              return {
                calculated_reactions: {},
                calculation_success: false,
                last_failure_reason: newLastFailureReason,
                problematic_joint_indices: newProblematicJointIndices,
                beams: beamsWithForces,
                joints: jointsWithProblematicFlag,
              };
            }
            A[eqX][beamIdx] = dx / length;
            A[eqY][beamIdx] = dy / length;
          }
        });
      }

      if (newLastFailureReason.includes("has zero length")) {
        return {
          calculated_reactions: {},
          calculation_success: false,
          last_failure_reason: newLastFailureReason,
          problematic_joint_indices: newProblematicJointIndices,
          beams: beamsWithForces,
          joints: jointsWithProblematicFlag,
        };
      }

      const solution = solveLinearSystem(A, b_vec);

      if (solution) {
        newCalculationSuccess = true;
        newLastFailureReason = "Structural analysis successful.";
        for (let i = 0; i < numBeams; i++) {
          beamsWithForces[i].force = solution[i];
        }

        anchorsWithType.forEach((anchor) => {
          const jointIdx = anchor.index;
          const reactionMapping = jointToReactionMatrixIndices[jointIdx];
          newCalculatedReactions[jointIdx] = {};
          if (reactionMapping.rx !== undefined) {
            newCalculatedReactions[jointIdx].rx = solution[reactionMapping.rx];
          }
          if (reactionMapping.ry !== undefined) {
            newCalculatedReactions[jointIdx].ry = solution[reactionMapping.ry];
          }
        });
      } else {
        newCalculationSuccess = false;
        newLastFailureReason =
          "Analysis failed: Matrix solution failed. Structure may be unstable (mechanism) or indeterminate due to geometry/support configuration.";
        markAllJointsProblematic();
      }

      return {
        calculated_reactions: newCalculatedReactions,
        calculation_success: newCalculationSuccess,
        last_failure_reason: newLastFailureReason,
        problematic_joint_indices: newProblematicJointIndices,
        beams: beamsWithForces,
        joints: jointsWithProblematicFlag,
      };
    },
    []
  );

  const updateStateAndRecalculate = useCallback(
    (newJoints: Joint[], newBeams: Beam[]) => {
      historyRef.current.push({ ...simulationState });
      if (historyRef.current.length > 20) historyRef.current.shift();

      const calculationResult = runCalculations(newJoints, newBeams);
      setSimulationState((prevState) => ({
        ...prevState,
        joints: calculationResult.joints || newJoints,
        beams: calculationResult.beams || newBeams,
        calculated_reactions: calculationResult.calculated_reactions || {},
        calculation_success: calculationResult.calculation_success || false,
        last_failure_reason:
          calculationResult.last_failure_reason ||
          "Error during recalculation.",
        problematic_joint_indices:
          calculationResult.problematic_joint_indices || [],
      }));
    },
    [runCalculations, simulationState]
  );

  const addJoint = useCallback(
    (
      x: number,
      y: number,
      isAnchorInitially: boolean,
      initialAnchorTypeIfAnchor: AnchorType | null = "pin"
    ) => {
      const existingJointAtLocation = simulationState.joints.find(
        (joint) =>
          Math.abs(joint.x - x) < FLOAT_TOLERANCE &&
          Math.abs(joint.y - y) < FLOAT_TOLERANCE
      );

      if (existingJointAtLocation) {
        setSimulationState((prev) => ({
          ...prev,
          last_failure_reason:
            "Cannot add joint: A joint already exists at this location.",
        }));
        return;
      }

      const newJoint: Joint = {
        x,
        y,
        anchor_type: isAnchorInitially ? initialAnchorTypeIfAnchor : null,
        load: [0, 0],
        problematic: false,
      };
      updateStateAndRecalculate(
        [...simulationState.joints, newJoint],
        simulationState.beams
      );
    },
    [simulationState.joints, simulationState.beams, updateStateAndRecalculate]
  );

  const toggleAnchor = useCallback(
    (joint_idx: number) => {
      if (joint_idx < 0 || joint_idx >= simulationState.joints.length) return;

      const newJoints = simulationState.joints.map((joint, idx) => {
        if (idx === joint_idx) {
          let nextAnchorType: AnchorType | null = null;
          if (joint.anchor_type === null) nextAnchorType = "pin";
          else if (joint.anchor_type === "pin") nextAnchorType = "roller_x";
          else if (joint.anchor_type === "roller_x")
            nextAnchorType = "roller_y";
          else if (joint.anchor_type === "roller_y") nextAnchorType = null;
          return {
            ...joint,
            anchor_type: nextAnchorType,
            load:
              nextAnchorType !== null
                ? ([0, 0] as [number, number])
                : joint.load,
          };
        }
        return joint;
      });
      updateStateAndRecalculate(newJoints, simulationState.beams);
    },
    [simulationState.joints, simulationState.beams, updateStateAndRecalculate]
  );

  const setLoad = useCallback(
    (joint_idx: number, fx: number, fy: number) => {
      if (joint_idx < 0 || joint_idx >= simulationState.joints.length) return;

      let loadChanged = false;
      const currentJoint = simulationState.joints[joint_idx];

      if (currentJoint.anchor_type !== null) {
        setSimulationState((prev) => ({
          ...prev,
          last_failure_reason:
            "Loads cannot be applied directly to anchor joints.",
        }));
        return;
      }

      const newJoints = simulationState.joints.map((joint, idx) => {
        if (idx === joint_idx) {
          if (joint.load[0] !== fx || joint.load[1] !== fy) {
            loadChanged = true;
          }
          return { ...joint, load: [fx, fy] as [number, number] };
        }
        return joint;
      });

      if (loadChanged) {
        updateStateAndRecalculate(newJoints, simulationState.beams);
      }
    },
    [simulationState.joints, simulationState.beams, updateStateAndRecalculate]
  );

  const deleteJoint = useCallback(
    (jointIdxToDelete: number) => {
      if (
        jointIdxToDelete < 0 ||
        jointIdxToDelete >= simulationState.joints.length
      )
        return;

      const newJoints = simulationState.joints.filter(
        (_, idx) => idx !== jointIdxToDelete
      );
      const newBeams = simulationState.beams
        .filter(
          (beam) =>
            beam.joint1_idx !== jointIdxToDelete &&
            beam.joint2_idx !== jointIdxToDelete
        )
        .map((beam) => ({
          ...beam,
          joint1_idx:
            beam.joint1_idx > jointIdxToDelete
              ? beam.joint1_idx - 1
              : beam.joint1_idx,
          joint2_idx:
            beam.joint2_idx > jointIdxToDelete
              ? beam.joint2_idx - 1
              : beam.joint2_idx,
        }));
      updateStateAndRecalculate(newJoints, newBeams);
    },
    [simulationState.joints, simulationState.beams, updateStateAndRecalculate]
  );

  const addBeam = useCallback(
    (joint1_idx: number, joint2_idx: number) => {
      if (
        joint1_idx < 0 ||
        joint1_idx >= simulationState.joints.length ||
        joint2_idx < 0 ||
        joint2_idx >= simulationState.joints.length
      ) {
        setSimulationState((prev) => ({
          ...prev,
          last_failure_reason: "Invalid joint index for beam.",
        }));
        return;
      }

      if (joint1_idx === joint2_idx) {
        setSimulationState((prev) => ({
          ...prev,
          last_failure_reason: "Cannot connect a joint to itself.",
        }));
        return;
      }
      const alreadyExists = simulationState.beams.some(
        (b) =>
          (b.joint1_idx === joint1_idx && b.joint2_idx === joint2_idx) ||
          (b.joint1_idx === joint2_idx && b.joint2_idx === joint1_idx)
      );
      if (alreadyExists) {
        setSimulationState((prev) => ({
          ...prev,
          last_failure_reason: "Beam already exists between these joints.",
        }));
        return;
      }
      const newBeam: Beam = { joint1_idx, joint2_idx, force: 0, stress: 0 };
      updateStateAndRecalculate(simulationState.joints, [
        ...simulationState.beams,
        newBeam,
      ]);
    },
    [simulationState.joints, simulationState.beams, updateStateAndRecalculate]
  );

  const deleteBeam = useCallback(
    (beamIdxToDelete: number) => {
      if (
        beamIdxToDelete < 0 ||
        beamIdxToDelete >= simulationState.beams.length
      )
        return;
      const newBeams = simulationState.beams.filter(
        (_, idx) => idx !== beamIdxToDelete
      );
      updateStateAndRecalculate(simulationState.joints, newBeams);
    },
    [simulationState.joints, simulationState.beams, updateStateAndRecalculate]
  );

  const resetStructure = useCallback(() => {
    historyRef.current.push({ ...simulationState });
    if (historyRef.current.length > 20) historyRef.current.shift();
    setSimulationState(initialSimulationState);
  }, [simulationState]);

  const undoLastAction = useCallback(() => {
    if (historyRef.current.length > 0) {
      const prevStateFromHistory = historyRef.current.pop();
      if (prevStateFromHistory) {
        const calculationResult = runCalculations(
          prevStateFromHistory.joints,
          prevStateFromHistory.beams
        );
        setSimulationState({
          ...prevStateFromHistory,
          joints: calculationResult.joints || prevStateFromHistory.joints,
          beams: calculationResult.beams || prevStateFromHistory.beams,
          calculated_reactions: calculationResult.calculated_reactions || {},
          calculation_success: calculationResult.calculation_success || false,
          last_failure_reason:
            calculationResult.last_failure_reason || "State restored via undo.",
          problematic_joint_indices:
            calculationResult.problematic_joint_indices || [],
        });
      }
    } else {
      setSimulationState((s) => ({
        ...s,
        last_failure_reason: "Nothing to undo.",
      }));
    }
  }, [runCalculations]);

  return {
    simulationState,
    addJoint,
    addBeam,
    toggleAnchor,
    setLoad,
    deleteJoint,
    deleteBeam,
    resetStructure,
    undoLastAction,
    forceRecalculate: () =>
      updateStateAndRecalculate(simulationState.joints, simulationState.beams),
  };
}