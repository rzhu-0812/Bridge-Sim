import pygame
import math
from config import LOG_INFO, LOAD_INCREMENT_STEP, ANCHOR_Y_WORLD_THRESHOLD, GRID_SIZE, FLOAT_TOLERANCE
from simulation.joint import Joint
from simulation.beam import Beam
from utils import snap_to_grid, get_closest_joint
from .settings import (
    HELP_SCROLL_STEP_FACTOR, HELP_CONTENT_HORIZONTAL_PADDING, HELP_SCROLLBAR_WIDTH,
    HELP_SCROLLBAR_PADDING_FROM_TEXT
)

def handle_input(events, game_state, camera, ui_elems, fonts, screen_dimensions, help_dialog_rect):
    screen_width, screen_height = screen_dimensions
    sim_area_width = screen_width - ui_elems["sidebar_width"]
    sim_area_height = screen_height - ui_elems["toolbar_height"] - ui_elems["statusbar_height"]

    help_dialog_title_height = fonts['title'].get_height() + HELP_CONTENT_HORIZONTAL_PADDING
    help_dialog_close_height = fonts['small'].get_height() + 20
    help_scroll_step = fonts['small'].get_height() * HELP_SCROLL_STEP_FACTOR

    for event in events:
        if event.type == pygame.QUIT:
            return False

        if event.type == pygame.KEYDOWN:
            key = event.key
            if key == pygame.K_ESCAPE and game_state["show_help"]:
                game_state["show_help"] = False
                game_state["help_scroll_y_offset"] = 0
            elif key in [pygame.K_j, pygame.K_b, pygame.K_a, pygame.K_l]:
                game_state["current_tool"] = {
                    pygame.K_j: "joint",
                    pygame.K_b: "beam",
                    pygame.K_a: "anchor",
                    pygame.K_l: "load"
                }[key]
                game_state["selected_joint_idx"] = -1
                game_state["selected_joint_for_load_idx"] = -1
            elif key == pygame.K_c:
                game_state["needs_recalc"] = True
            elif key == pygame.K_r:
                for joint in game_state["joints"]:
                    joint.load = [0.0, 0.0]
                    joint.problematic = False
                for beam in game_state["beams"]:
                    beam.force = 0.0
                    beam.stress = 0.0
                game_state.update({
                    "calculated_reactions": {},
                    "calculation_done": False,
                    "calculation_success": False,
                    "needs_recalc": False,
                    "selected_joint_idx": -1,
                    "selected_joint_for_load_idx": -1,
                    "last_failure_reason": "Structure analysis reset.",
                    "problematic_joint_indices": []
                })
            elif key == pygame.K_h:
                game_state["show_help"] = not game_state["show_help"]
                if not game_state["show_help"]:
                    game_state["help_scroll_y_offset"] = 0
            elif key == pygame.K_z and pygame.key.get_mods() & pygame.KMOD_CTRL:
                if game_state["selected_joint_idx"] != -1 and game_state["current_tool"] == "beam":
                    game_state["selected_joint_idx"] = -1
                elif game_state["selected_joint_for_load_idx"] != -1:
                    game_state["selected_joint_for_load_idx"] = -1
                elif game_state["beams"]:
                    game_state["beams"].pop()
                    game_state["needs_recalc"] = True
                    game_state["calculation_done"] = False
                elif game_state["joints"]:
                    idx = len(game_state["joints"]) - 1
                    game_state["beams"] = [
                        b for b in game_state["beams"]
                        if b.joint1_idx != idx and b.joint2_idx != idx
                    ]
                    for beam in game_state["beams"]:
                        if beam.joint1_idx > idx:
                            beam.joint1_idx -= 1
                        if beam.joint2_idx > idx:
                            beam.joint2_idx -= 1
                    game_state["joints"].pop()
                    game_state["needs_recalc"] = True
                    game_state["calculation_done"] = False
            elif key in [pygame.K_PLUS, pygame.K_EQUALS]:
                camera.zoom(1.15, game_state["mouse_pos_in_sim_area"])
            elif key == pygame.K_MINUS:
                camera.zoom(1 / 1.15, game_state["mouse_pos_in_sim_area"])
            elif key == pygame.K_0:
                camera.reset_view()

        elif event.type == pygame.MOUSEBUTTONDOWN:
            mouse_screen_pos = game_state["mouse_screen_pos"]
            clicked_on_ui_element = False

            if game_state["show_help"]:
                help_content_box_x = help_dialog_rect.x + HELP_CONTENT_HORIZONTAL_PADDING
                help_content_box_y = help_dialog_rect.y + help_dialog_title_height
                help_content_width = help_dialog_rect.width - (2 * HELP_CONTENT_HORIZONTAL_PADDING) - HELP_SCROLLBAR_WIDTH - HELP_SCROLLBAR_PADDING_FROM_TEXT
                help_content_height = help_dialog_rect.height - help_dialog_title_height - help_dialog_close_height

                scroll_interaction_rect = pygame.Rect(
                    help_content_box_x, help_content_box_y,
                    help_content_width + HELP_SCROLLBAR_PADDING_FROM_TEXT + HELP_SCROLLBAR_WIDTH,
                    help_content_height
                )

                if not help_dialog_rect.collidepoint(mouse_screen_pos):
                    game_state["show_help"] = False
                    game_state["help_scroll_y_offset"] = 0
                    clicked_on_ui_element = True
                elif scroll_interaction_rect.collidepoint(mouse_screen_pos):
                    if event.button == 4:
                        game_state["help_scroll_y_offset"] -= help_scroll_step
                    elif event.button == 5:
                        game_state["help_scroll_y_offset"] += help_scroll_step
                    game_state["help_scroll_y_offset"] = max(0, game_state["help_scroll_y_offset"])
                    clicked_on_ui_element = True

            if clicked_on_ui_element:
                if game_state["needs_recalc"]:
                    game_state["calculation_done"] = False
                continue

            buttons_to_check = [
                ui_elems["joint_button"], ui_elems["beam_button"], ui_elems["anchor_button"], ui_elems["load_button"],
                ui_elems["calc_button"], ui_elems["reset_button"], ui_elems["undo_button"], ui_elems["help_button"],
                ui_elems["grid_toggle"], ui_elems["forces_toggle"], ui_elems["reactions_toggle"], ui_elems["tooltip_toggle"],
                ui_elems["zoom_in_button"], ui_elems["zoom_out_button"], ui_elems["reset_view_button"]
            ]

            load_mod_buttons = ["fx_plus_button", "fx_minus_button", "fy_plus_button", "fy_minus_button", "clear_load_button"]
            for btn_key in load_mod_buttons:
                if game_state.get(btn_key):
                    buttons_to_check.append(game_state[btn_key])

            for btn in buttons_to_check:
                if btn and btn.check_click(mouse_screen_pos):
                    clicked_on_ui_element = True
                    if btn == ui_elems["joint_button"]:
                        game_state["current_tool"] = "joint"
                    elif btn == ui_elems["beam_button"]:
                        game_state["current_tool"] = "beam"
                    elif btn == ui_elems["anchor_button"]:
                        game_state["current_tool"] = "anchor"
                    elif btn == ui_elems["load_button"]:
                        game_state["current_tool"] = "load"
                    elif btn == ui_elems["calc_button"]:
                        game_state["needs_recalc"] = True
                    elif btn == ui_elems["reset_button"]:
                        game_state.update({
                            "joints": [], "beams": [], "calculated_reactions": {},
                            "calculation_done": False, "calculation_success": False, "needs_recalc": False,
                            "selected_joint_idx": -1, "selected_joint_for_load_idx": -1,
                            "last_failure_reason": "Full structure reset.", "problematic_joint_indices": []
                        })
                        camera.reset_view()
                    elif btn == ui_elems["undo_button"]:
                        if game_state["selected_joint_idx"] != -1 and game_state["current_tool"] == "beam":
                            game_state["selected_joint_idx"] = -1
                        elif game_state["selected_joint_for_load_idx"] != -1:
                            game_state["selected_joint_for_load_idx"] = -1
                        elif game_state["beams"]:
                            game_state["beams"].pop()
                            game_state["needs_recalc"] = True
                            game_state["calculation_done"] = False
                        elif game_state["joints"]:
                            idx_to_remove = len(game_state["joints"]) - 1
                            game_state["beams"] = [b for b in game_state["beams"] if b.joint1_idx != idx_to_remove and b.joint2_idx != idx_to_remove]
                            for beam in game_state["beams"]:
                                if beam.joint1_idx > idx_to_remove:
                                    beam.joint1_idx -= 1
                                if beam.joint2_idx > idx_to_remove:
                                    beam.joint2_idx -= 1
                            game_state["joints"].pop()
                            game_state["needs_recalc"] = True
                            game_state["calculation_done"] = False
                    elif btn == ui_elems["help_button"]:
                        game_state["show_help"] = not game_state["show_help"]
                        if not game_state["show_help"]:
                            game_state["help_scroll_y_offset"] = 0
                    elif btn == ui_elems["grid_toggle"]:
                        game_state["show_grid"] = btn.toggle()
                    elif btn == ui_elems["forces_toggle"]:
                        game_state["show_forces"] = btn.toggle()
                    elif btn == ui_elems["reactions_toggle"]:
                        game_state["show_reactions"] = btn.toggle()
                    elif btn == ui_elems["tooltip_toggle"]:
                        game_state["show_tooltip"] = btn.toggle()
                    elif btn == ui_elems["zoom_in_button"]:
                        camera.zoom(1.25)
                    elif btn == ui_elems["zoom_out_button"]:
                        camera.zoom(1 / 1.25)
                    elif btn == ui_elems["reset_view_button"]:
                        camera.reset_view()
                    elif game_state["selected_joint_for_load_idx"] != -1:
                        sjl_idx = game_state["selected_joint_for_load_idx"]
                        if sjl_idx < len(game_state["joints"]):
                            joint = game_state["joints"][sjl_idx]
                            if btn == game_state.get("fx_plus_button"):
                                joint.load[0] += LOAD_INCREMENT_STEP
                            elif btn == game_state.get("fx_minus_button"):
                                joint.load[0] -= LOAD_INCREMENT_STEP
                            elif btn == game_state.get("fy_plus_button"):
                                joint.load[1] += LOAD_INCREMENT_STEP
                            elif btn == game_state.get("fy_minus_button"):
                                joint.load[1] -= LOAD_INCREMENT_STEP
                            elif btn == game_state.get("clear_load_button"):
                                joint.load = [0.0, 0.0]
                            game_state["needs_recalc"] = True
                    break

            if clicked_on_ui_element:
                if game_state["needs_recalc"]:
                    game_state["calculation_done"] = False
                continue

            sim_area_x = 0
            sim_area_y = ui_elems["toolbar_height"]
            sim_area_rect = pygame.Rect(sim_area_x, sim_area_y, sim_area_width, sim_area_height)

            if sim_area_rect.collidepoint(mouse_screen_pos):
                mouse_world_pos = game_state["mouse_world_pos"]
                snapped_world_x, snapped_world_y = snap_to_grid(mouse_world_pos[0], mouse_world_pos[1])
                closest_joint_idx = get_closest_joint(mouse_world_pos, game_state["joints"])

                if event.button == 1:
                    if game_state["current_tool"] == "joint":
                        exists = any(
                            math.hypot(j.x - snapped_world_x, j.y - snapped_world_y) < GRID_SIZE / 3
                            for j in game_state["joints"]
                        )
                        if not exists:
                            game_state["joints"].append(Joint(snapped_world_x, snapped_world_y, snapped_world_y >= ANCHOR_Y_WORLD_THRESHOLD))
                            game_state["needs_recalc"] = True
                            game_state["calculation_done"] = False
                    elif game_state["current_tool"] == "anchor":
                        if closest_joint_idx != -1:
                            joint = game_state["joints"][closest_joint_idx]
                            joint.is_anchor = not joint.is_anchor
                            game_state["needs_recalc"] = True
                            game_state["calculation_done"] = False
                        else:
                            exists = any(
                                math.hypot(j.x - snapped_world_x, j.y - snapped_world_y) < GRID_SIZE / 3
                                for j in game_state["joints"]
                            )
                            if not exists:
                                game_state["joints"].append(Joint(snapped_world_x, snapped_world_y, is_anchor=True))
                                game_state["needs_recalc"] = True
                                game_state["calculation_done"] = False
                    elif game_state["current_tool"] == "beam":
                        if closest_joint_idx != -1:
                            if game_state["selected_joint_idx"] == -1:
                                game_state["selected_joint_idx"] = closest_joint_idx
                            elif game_state["selected_joint_idx"] != closest_joint_idx:
                                beam_exists = any(
                                    (b.joint1_idx == game_state["selected_joint_idx"] and b.joint2_idx == closest_joint_idx) or
                                    (b.joint1_idx == closest_joint_idx and b.joint2_idx == game_state["selected_joint_idx"])
                                    for b in game_state["beams"]
                                )
                                if not beam_exists:
                                    game_state["beams"].append(Beam(game_state["selected_joint_idx"], closest_joint_idx))
                                    game_state["needs_recalc"] = True
                                    game_state["calculation_done"] = False
                                game_state["selected_joint_idx"] = -1
                            else:
                                game_state["selected_joint_idx"] = -1
                        else:
                            game_state["selected_joint_idx"] = -1
                    elif game_state["current_tool"] == "load":
                        if closest_joint_idx != -1:
                            if not game_state["joints"][closest_joint_idx].is_anchor:
                                game_state["selected_joint_for_load_idx"] = closest_joint_idx
                            else:
                                game_state["selected_joint_for_load_idx"] = -1
                                print(LOG_INFO + "Anchors cannot have direct external loads applied via this tool.")
                        else:
                            game_state["selected_joint_for_load_idx"] = -1

                elif event.button == 2:
                    camera.start_pan(game_state["mouse_pos_in_sim_area"])
                elif event.button in [4, 5]:
                    if not (game_state["show_help"] and help_dialog_rect.collidepoint(mouse_screen_pos)):
                        zoom_factor = 1.15 if event.button == 4 else 1 / 1.15
                        camera.zoom(zoom_factor, game_state["mouse_pos_in_sim_area"])

        elif event.type == pygame.MOUSEBUTTONUP:
            if event.button == 2:
                camera.end_pan()

        elif event.type == pygame.MOUSEMOTION:
            camera.update_pan(game_state["mouse_pos_in_sim_area"])

    return True