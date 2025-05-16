import pygame
import sys

from config import *
from simulation.joint import Joint
from simulation.beam import Beam
from simulation.physics import calculate_forces
from simulation.camera import Camera
from ui import components as ui_components
from ui.rendering import main_renderer
from ui.rendering import chrome_renderer
from ui.rendering import overlays_renderer
from ui import input_handler
from ui.settings import *

pygame.init()
screen = pygame.display.set_mode((WIDTH, HEIGHT))
pygame.display.set_caption("Bridge Physics Simulator")
clock = pygame.time.Clock()

fonts = {
    "title": pygame.font.SysFont("Arial", 28, bold=True),
    "heading": pygame.font.SysFont("Arial", 20, bold=True),
    "main": pygame.font.SysFont("Arial", 18),
    "small": pygame.font.SysFont("Arial", 16),
    "tiny": pygame.font.SysFont("Arial", 14),
}

ui_components.ui_elements["help_button"].font_override = fonts['title']
for key in ["grid_toggle", "forces_toggle", "reactions_toggle", "tooltip_toggle",
            "zoom_in_button", "zoom_out_button", "reset_view_button"]:
    ui_components.ui_elements[key].font_override = fonts['small']

state = {
    "joints": [],
    "beams": [],
    "calculated_reactions": {},
    "current_tool": "joint",
    "selected_joint_idx": -1,
    "selected_joint_for_load_idx": -1,
    "needs_recalc": False,
    "calculation_done": False,
    "calculation_success": False,
    "last_failure_reason": "System ready. Start building or load a structure.",
    "problematic_joint_indices": [],
    "show_grid": True,
    "show_forces": True,
    "show_reactions": True,
    "show_help": False,
    "show_tooltip": True,
    "hover_beam_idx": -1,
    "help_scroll_y_offset": 0,
    "mouse_screen_pos": (0, 0),
    "mouse_pos_in_sim_area": (0, 0),
    "mouse_world_pos": (0, 0),
    "fx_plus_button": None,
    "fx_minus_button": None,
    "fy_plus_button": None,
    "fy_minus_button": None,
    "clear_load_button": None,
}

SIM_AREA_X = 0
SIM_AREA_Y = TOOLBAR_HEIGHT
SIM_AREA_WIDTH = WIDTH - SIDEBAR_WIDTH
SIM_AREA_HEIGHT = HEIGHT - TOOLBAR_HEIGHT - STATUSBAR_HEIGHT

sim_display_surface = pygame.Surface((SIM_AREA_WIDTH, SIM_AREA_HEIGHT))
camera = Camera(SIM_AREA_WIDTH, SIM_AREA_HEIGHT)

help_dialog_rect = pygame.Rect(
    (WIDTH - HELP_DIALOG_HW) // 2,
    (HEIGHT - HELP_DIALOG_HH) // 2,
    HELP_DIALOG_HW,
    HELP_DIALOG_HH,
)

ui_elements_for_input_handler = ui_components.ui_elements.copy()
ui_elements_for_input_handler["sidebar_width"] = SIDEBAR_WIDTH
ui_elements_for_input_handler["toolbar_height"] = TOOLBAR_HEIGHT
ui_elements_for_input_handler["statusbar_height"] = STATUSBAR_HEIGHT

SIM_TITLE_TEXT = "Bridge Physics Simulator" 

running = True
while running:
    state["mouse_screen_pos"] = pygame.mouse.get_pos()
    state["mouse_pos_in_sim_area"] = (
        state["mouse_screen_pos"][0] - SIM_AREA_X,
        state["mouse_screen_pos"][1] - SIM_AREA_Y,
    )
    state["mouse_world_pos"] = camera.screen_to_world(state["mouse_pos_in_sim_area"])

    events = pygame.event.get()
    if not input_handler.handle_input(events, state, camera, ui_elements_for_input_handler, fonts, (WIDTH, HEIGHT), help_dialog_rect):
        running = False
        continue

    ui_components.ui_elements["joint_button"].active = state["current_tool"] == "joint"
    ui_components.ui_elements["beam_button"].active = state["current_tool"] == "beam"
    ui_components.ui_elements["anchor_button"].active = state["current_tool"] == "anchor"
    ui_components.ui_elements["load_button"].active = state["current_tool"] == "load"

    buttons_to_hover_check = [
        b for b in ui_components.ui_elements.values() if isinstance(b, (ui_components.Button, ui_components.ToggleButton))
    ]
    for key in ["fx_plus_button", "fx_minus_button", "fy_plus_button", "fy_minus_button", "clear_load_button"]:
        if state.get(key):
            buttons_to_hover_check.append(state[key])

    for btn in buttons_to_hover_check:
        btn.check_hover(state["mouse_screen_pos"])

    if state["needs_recalc"]:
        if state["joints"] or state["beams"]:
            for beam in state["beams"]:
                beam.force = 0.0
                beam.stress = 0.0

            calc_success, reason, prob_indices, _, calc_reactions = calculate_forces(state["joints"], state["beams"])

            state.update({
                "calculation_done": True,
                "calculation_success": calc_success,
                "last_failure_reason": reason,
                "problematic_joint_indices": prob_indices or [],
                "calculated_reactions": calc_reactions if calc_success else {},
            })
        else:
            state.update({
                "last_failure_reason": "Cannot calculate: Structure is empty.",
                "calculation_done": True,
                "calculation_success": False,
                "problematic_joint_indices": [],
                "calculated_reactions": {},
            })
        state["needs_recalc"] = False

    state["hover_beam_idx"] = -1
    sim_area_rect_on_screen = pygame.Rect(SIM_AREA_X, SIM_AREA_Y, SIM_AREA_WIDTH, SIM_AREA_HEIGHT)
    if state["calculation_success"] and state["show_tooltip"] and \
       sim_area_rect_on_screen.collidepoint(state["mouse_screen_pos"]) and not state["show_help"]:

        hover_dist_screen_pixels = 8
        min_dist_sq_world = (hover_dist_screen_pixels / camera.zoom_level) ** 2 if camera.zoom_level > 0 else float('inf')

        for i, beam in enumerate(state["beams"]):
            if beam.joint1_idx >= len(state["joints"]) or beam.joint2_idx >= len(state["joints"]):
                continue

            j1, j2 = state["joints"][beam.joint1_idx], state["joints"][beam.joint2_idx]
            dx, dy = j2.x - j1.x, j2.y - j1.y
            len_sq = dx * dx + dy * dy
            if len_sq < FLOAT_TOLERANCE**2:
                continue

            t = max(0, min(1, ((state["mouse_world_pos"][0] - j1.x) * dx + (state["mouse_world_pos"][1] - j1.y) * dy) / len_sq))
            closest_x, closest_y = j1.x + t * dx, j1.y + t * dy
            dist_sq = (state["mouse_world_pos"][0] - closest_x)**2 + (state["mouse_world_pos"][1] - closest_y)**2

            if dist_sq < min_dist_sq_world:
                min_dist_sq_world = dist_sq
                state["hover_beam_idx"] = i

    screen.fill(COLOR_BACKGROUND_APP)
    sim_display_surface.fill(COLOR_BACKGROUND_APP)

    main_renderer.draw_simulation_elements(sim_display_surface, state, camera, fonts)
    screen.blit(sim_display_surface, (SIM_AREA_X, SIM_AREA_Y))

    chrome_renderer.draw_toolbar(screen, WIDTH, fonts, ui_components.ui_elements, SIM_TITLE_TEXT)
    chrome_renderer.draw_sidebar(screen, WIDTH, HEIGHT, fonts, ui_components.ui_elements, state, camera)
    chrome_renderer.draw_status_bar(screen, WIDTH, HEIGHT, fonts, state)

    if state["show_tooltip"]:
        overlays_renderer.draw_tooltip(screen, WIDTH, HEIGHT, fonts, state)

    if state["show_help"]:
        overlays_renderer.draw_help_dialog(screen, WIDTH, HEIGHT, fonts, state, help_dialog_rect)

    pygame.display.flip()
    clock.tick(60)

pygame.quit()
sys.exit()