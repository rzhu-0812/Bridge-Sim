import pygame
import math
from config import *

class Beam:
    def __init__(self, joint1_idx, joint2_idx):
        self.joint1_idx = joint1_idx
        self.joint2_idx = joint2_idx
        self.force = 0.0
        self.cross_sectional_area = BEAM_DEFAULT_AREA
        self.stress = 0.0

    def draw(self, screen, joints, world_to_screen_func, show_forces):
        if self.joint1_idx >= len(joints) or self.joint2_idx >= len(joints):
            return

        joint1 = joints[self.joint1_idx]
        joint2 = joints[self.joint2_idx]
        screen_joint1 = world_to_screen_func((joint1.x, joint1.y))
        screen_joint2 = world_to_screen_func((joint2.x, joint2.y))

        if show_forces and abs(self.force) > FLOAT_TOLERANCE:
            ratio = min(abs(self.force) / MAX_FORCE_VIS, 1.0)
            color = (255, int(255 * (1 - ratio)), int(255 * (1 - ratio))) if self.force > 0 else (int(255 * (1 - ratio)), int(255 * (1 - ratio)), 255)
        else:
            color = BEAM_COLOR

        pygame.draw.line(screen, color, screen_joint1, screen_joint2, 5)

    def get_length(self, joints):
        if self.joint1_idx >= len(joints) or self.joint2_idx >= len(joints):
            return 0
        joint1 = joints[self.joint1_idx]
        joint2 = joints[self.joint2_idx]
        return math.hypot(joint1.x - joint2.x, joint1.y - joint2.y)

    def get_angle_rad_relative_to(self, joint_idx, joints):
        if self.joint1_idx >= len(joints) or self.joint2_idx >= len(joints):
            return None
        if self.joint1_idx == joint_idx:
            start_joint, end_joint = joints[self.joint1_idx], joints[self.joint2_idx]
        elif self.joint2_idx == joint_idx:
            start_joint, end_joint = joints[self.joint2_idx], joints[self.joint1_idx]
        else:
            return None
        return math.atan2(end_joint.y - start_joint.y, end_joint.x - start_joint.x)