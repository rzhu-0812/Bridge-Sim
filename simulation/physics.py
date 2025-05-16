import math
import numpy as np
from collections import deque
from config import *

def check_stability(joints, beams, num_reactions):
    num_joints = len(joints)
    num_beams = len(beams)

    if num_joints < 2:
        return False, "Error: At least 2 joints are required.", list(range(num_joints))

    anchor_indices = [i for i, j in enumerate(joints) if j.is_anchor]

    if len(anchor_indices) < 2:
        return False, "Error: At least 2 anchor points are needed for a pin-roller setup.", anchor_indices

    equations = 2 * num_joints
    unknowns = num_beams + num_reactions

    if equations > unknowns:
        return False, f"Stability Error: Structure is likely a mechanism (2j={equations} > m+r={unknowns}).", []

    adj = {i: [] for i in range(num_joints)}
    for beam in beams:
        if beam.joint1_idx < num_joints and beam.joint2_idx < num_joints:
            adj[beam.joint1_idx].append(beam.joint2_idx)
            adj[beam.joint2_idx].append(beam.joint1_idx)

    visited = set()
    queue = deque([anchor_indices[0]])
    visited.add(anchor_indices[0])

    while queue:
        u = queue.popleft()
        for v_idx in adj[u]:
            if v_idx not in visited:
                visited.add(v_idx)
                queue.append(v_idx)

    if len(visited) != num_joints:
        unvisited = sorted(list(set(range(num_joints)) - visited))
        return False, f"Stability Error: Disconnected parts. Joints {unvisited} not connected to anchor {anchor_indices[0]}.", unvisited

    problematic_joints = []
    for i, joint in enumerate(joints):
        if joint.is_anchor:
            continue

        connected_beams_indices = [
            idx for idx, beam in enumerate(beams) if beam.joint1_idx == i or beam.joint2_idx == i
        ]
        num_connected = len(connected_beams_indices)

        if num_connected < 2:
            problematic_joints.append(i)
        elif num_connected == 2:
            angle1 = beams[connected_beams_indices[0]].get_angle_rad_relative_to(i, joints)
            angle2 = beams[connected_beams_indices[1]].get_angle_rad_relative_to(i, joints)
            if angle1 is not None and angle2 is not None:
                angle_diff = abs(angle1 - angle2)
                if (
                    angle_diff < FLOAT_TOLERANCE
                    or abs(angle_diff - math.pi) < FLOAT_TOLERANCE
                    or abs(angle_diff - 2 * math.pi) < FLOAT_TOLERANCE
                ):
                    problematic_joints.append(i)

    if problematic_joints:
        return False, f"Stability Error: Joint(s) {sorted(set(problematic_joints))} unstable.", problematic_joints

    return True, "Structure appears stable for calculation.", []

def calculate_forces(joints, beams):
    num_joints = len(joints)
    num_beams = len(beams)
    num_reactions = 3

    for joint in joints:
        joint.problematic = False
    for beam_obj in beams:
        beam_obj.force = 0.0
        beam_obj.stress = 0.0

    is_stable, failure_reason, problematic_indices = check_stability(joints, beams, num_reactions)

    if not is_stable:
        for idx in problematic_indices:
            if idx < len(joints):
                joints[idx].problematic = True
        return False, failure_reason, problematic_indices, None, None

    anchor_indices = sorted(
        [i for i, j in enumerate(joints) if j.is_anchor],
        key=lambda i: (joints[i].x, joints[i].y)
    )

    if len(anchor_indices) < 2:
        return False, "Internal Error: Not enough anchors despite stability check.", [], None, None

    left_anchor_idx = anchor_indices[0]
    right_anchor_idx = anchor_indices[-1]

    dist_sq = (joints[left_anchor_idx].x - joints[right_anchor_idx].x)**2 + \
              (joints[left_anchor_idx].y - joints[right_anchor_idx].y)**2
    if dist_sq < FLOAT_TOLERANCE**2 and left_anchor_idx != right_anchor_idx:
        for idx in [left_anchor_idx, right_anchor_idx]:
            if idx < len(joints):
                joints[idx].problematic = True
        return False, "Calculation Error: Pin and Roller anchors are at the same location.", [left_anchor_idx, right_anchor_idx], None, None

    num_unknowns = num_beams + num_reactions
    num_equations = 2 * num_joints

    A = np.zeros((num_equations, num_unknowns))
    B = np.zeros(num_equations)

    for i in range(num_joints):
        B[2 * i] = -joints[i].load[0]
        B[2 * i + 1] = -joints[i].load[1]

    for beam_idx, beam_obj in enumerate(beams):
        if beam_obj.joint1_idx >= num_joints or beam_obj.joint2_idx >= num_joints:
            for idx_j in range(num_joints):
                joints[idx_j].problematic = True
            return False, "Internal Error: Invalid beam data.", list(range(num_joints)), None, None

        j1_idx, j2_idx = beam_obj.joint1_idx, beam_obj.joint2_idx
        j1, j2 = joints[j1_idx], joints[j2_idx]

        length = beam_obj.get_length(joints)
        if length < FLOAT_TOLERANCE:
            joints[j1_idx].problematic = True
            joints[j2_idx].problematic = True
            continue

        cos_a = (j2.x - j1.x) / length
        sin_a = (j2.y - j1.y) / length

        A[2 * j1_idx, beam_idx] = cos_a
        A[2 * j1_idx + 1, beam_idx] = sin_a
        A[2 * j2_idx, beam_idx] = -cos_a
        A[2 * j2_idx + 1, beam_idx] = -sin_a

    A[2 * left_anchor_idx, num_beams] = 1
    A[2 * left_anchor_idx + 1, num_beams + 1] = 1
    A[2 * right_anchor_idx + 1, num_beams + 2] = 1

    try:
        if np.linalg.matrix_rank(A) < num_unknowns:
            for idx_j in range(num_joints):
                joints[idx_j].problematic = True
            return False, "Calculation Failed: Unstable structure (matrix rank deficient).", list(range(num_joints)), None, None

        solution, residuals, rank, s_values = np.linalg.lstsq(A, B, rcond=None)

        if rank < num_unknowns:
            problematic_joints_final = []
            check_B = A @ solution
            for i in range(num_joints):
                if abs(check_B[2 * i] - B[2 * i]) > FLOAT_TOLERANCE * 100 or \
                   abs(check_B[2 * i + 1] - B[2 * i + 1]) > FLOAT_TOLERANCE * 100:
                    problematic_joints_final.append(i)
            if not problematic_joints_final:
                problematic_joints_final = list(range(num_joints))

            for idx_j in problematic_joints_final:
                if idx_j < len(joints):
                    joints[idx_j].problematic = True
            return False, "Calculation Failed: Unstable structure or singular matrix.", problematic_joints_final, None, None

        beam_forces_sol = solution[:num_beams]
        reactions_vector = solution[num_beams:]

        for i, force in enumerate(beam_forces_sol):
            beams[i].force = force
            beams[i].stress = force / beams[i].cross_sectional_area if beams[i].cross_sectional_area > FLOAT_TOLERANCE else 0

        calculated_reactions = {
            left_anchor_idx: (reactions_vector[0], reactions_vector[1]),
            right_anchor_idx: (0, reactions_vector[2]),
        }

        return True, "Calculation OK.", [], beam_forces_sol, calculated_reactions

    except np.linalg.LinAlgError as e:
        for idx_j in range(num_joints):
            joints[idx_j].problematic = True
        return False, f"Calculation Failed: Linear algebra error ({e}).", list(range(num_joints)), None, None