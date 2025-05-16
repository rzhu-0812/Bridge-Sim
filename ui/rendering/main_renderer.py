import pygame
import math
import numpy as np
from config import (
    FLOAT_TOLERANCE, REACTION_TEXT_COLOR, TEMP_BEAM_COLOR, SELECTION_COLOR, JOINT_RADIUS, GRID_COLOR,
    GRID_SIZE
)

def draw_simulation_elements(surface, game_state, camera, fonts):
    if game_state["show_grid"]:
        world_top_left = camera.screen_to_world((0, 0))
        world_bottom_right = camera.screen_to_world((camera.sim_area_width, camera.sim_area_height))

        x_start = math.floor(world_top_left[0] / GRID_SIZE) * GRID_SIZE
        x_end = math.ceil(world_bottom_right[0] / GRID_SIZE) * GRID_SIZE
        for x in np.arange(x_start, x_end + GRID_SIZE * 0.5, GRID_SIZE):
            screen_x, _ = camera.world_to_screen((x, world_top_left[1]))
            pygame.draw.line(surface, GRID_COLOR, (screen_x, 0), (screen_x, camera.sim_area_height))

        y_start = math.floor(world_top_left[1] / GRID_SIZE) * GRID_SIZE
        y_end = math.ceil(world_bottom_right[1] / GRID_SIZE) * GRID_SIZE
        for y in np.arange(y_start, y_end + GRID_SIZE * 0.5, GRID_SIZE):
            _, screen_y = camera.world_to_screen((world_top_left[0], y))
            pygame.draw.line(surface, GRID_COLOR, (0, screen_y), (camera.sim_area_width, screen_y))

    for beam in game_state["beams"]:
        beam.draw(surface, game_state["joints"], camera.world_to_screen, game_state["show_forces"])

    if game_state["current_tool"] == "beam" and game_state["selected_joint_idx"] != -1 and \
       game_state["selected_joint_idx"] < len(game_state["joints"]):
        start_joint = game_state["joints"][game_state["selected_joint_idx"]]
        screen_start = camera.world_to_screen((start_joint.x, start_joint.y))
        screen_end = game_state["mouse_pos_in_sim_area"]

        pygame.draw.line(surface, TEMP_BEAM_COLOR, screen_start, screen_end, 3)
        pygame.draw.circle(surface, SELECTION_COLOR, screen_start, JOINT_RADIUS + 4, 2)

    for i, joint in enumerate(game_state["joints"]):
        is_selected = (i == game_state["selected_joint_for_load_idx"] and game_state["current_tool"] == "load")
        joint.draw(surface, camera.world_to_screen, fonts['tiny'], is_selected)

    if game_state["calculation_success"] and game_state["calculated_reactions"] and game_state["show_reactions"]:
        arrow_length = 30
        text_offset = 5

        for joint_idx, (rx, ry) in game_state["calculated_reactions"].items():
            if joint_idx < len(game_state["joints"]):
                joint = game_state["joints"][joint_idx]
                screen_x, screen_y = camera.world_to_screen((joint.x, joint.y))

                if abs(rx) > FLOAT_TOLERANCE:
                    direction = 1 if rx > 0 else -1
                    arrow_end_x = screen_x + direction * arrow_length
                    pygame.draw.line(surface, REACTION_TEXT_COLOR, (screen_x, screen_y), (arrow_end_x, screen_y), 4)
                    pygame.draw.polygon(surface, REACTION_TEXT_COLOR, [
                        (arrow_end_x, screen_y),
                        (arrow_end_x - direction * 6, screen_y - 4),
                        (arrow_end_x - direction * 6, screen_y + 4)
                    ])
                    rx_text = f"Rx: {rx:.0f}"
                    rx_surf = fonts['tiny'].render(rx_text, True, REACTION_TEXT_COLOR)
                    rx_rect = rx_surf.get_rect()
                    if direction > 0:
                        rx_rect.midleft = (arrow_end_x + text_offset, screen_y)
                    else:
                        rx_rect.midright = (arrow_end_x - text_offset, screen_y)
                    surface.blit(rx_surf, rx_rect)

                if abs(ry) > FLOAT_TOLERANCE:
                    direction = -1 if ry > 0 else 1
                    arrow_end_y = screen_y + direction * arrow_length
                    pygame.draw.line(surface, REACTION_TEXT_COLOR, (screen_x, screen_y), (screen_x, arrow_end_y), 4)
                    pygame.draw.polygon(surface, REACTION_TEXT_COLOR, [
                        (screen_x, arrow_end_y),
                        (screen_x - 4, arrow_end_y - direction * 6),
                        (screen_x + 4, arrow_end_y - direction * 6)
                    ])
                    ry_text = f"Ry: {ry:.0f}"
                    ry_surf = fonts['tiny'].render(ry_text, True, REACTION_TEXT_COLOR)
                    ry_rect = ry_surf.get_rect()
                    if direction < 0:
                        ry_rect.midbottom = (screen_x, arrow_end_y - text_offset)
                    else:
                        ry_rect.midtop = (screen_x, arrow_end_y + text_offset)
                    surface.blit(ry_surf, ry_rect)