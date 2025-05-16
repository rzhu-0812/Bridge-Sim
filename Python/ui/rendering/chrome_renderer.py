import pygame

from config import FLOAT_TOLERANCE
from ..settings import *
from ..components import Button

def draw_toolbar(screen, screen_width, fonts, ui_elems, sim_title_text):
    pygame.draw.rect(screen, COLOR_TOOLBAR_BG, (0, 0, screen_width, TOOLBAR_HEIGHT))
    pygame.draw.line(screen, COLOR_BORDER_DARK, (0, TOOLBAR_HEIGHT), (screen_width, TOOLBAR_HEIGHT), 1)

    sim_title_surf = fonts['title'].render(sim_title_text, True, COLOR_TEXT_LIGHT)
    screen.blit(sim_title_surf, (TOOLBAR_PADDING_X, TOOLBAR_HEIGHT // 2 - sim_title_surf.get_height() // 2))

    toolbar_button_y = (TOOLBAR_HEIGHT - TOOLBAR_BUTTON_SIZE) // 2
    btn_x_left = TOOLBAR_PADDING_X + sim_title_surf.get_width() + TOOLBAR_ITEM_SPACING * 3

    tool_buttons_keys = ["joint_button", "beam_button", "anchor_button", "load_button"]
    for key in tool_buttons_keys:
        btn = ui_elems[key]
        btn.rect.topleft = (btn_x_left, toolbar_button_y)
        btn.draw(screen, fonts)
        btn_x_left += btn.rect.width + TOOLBAR_ITEM_SPACING

    btn_x_right = screen_width - TOOLBAR_PADDING_X
    action_buttons_keys = ["help_button", "undo_button", "reset_button", "calc_button"]
    for key in action_buttons_keys:
        btn = ui_elems[key]
        btn.rect.topright = (btn_x_right, toolbar_button_y)
        btn.draw(screen, fonts)
        btn_x_right -= (btn.rect.width + TOOLBAR_ITEM_SPACING)

def draw_sidebar(screen, screen_width, screen_height, fonts, ui_elems, game_state, camera):
    sidebar_x_abs = screen_width - SIDEBAR_WIDTH
    section_box_x_abs = sidebar_x_abs + SECTION_BOX_X_START_REL

    pygame.draw.rect(screen, COLOR_SIDEBAR_BG, (sidebar_x_abs, TOOLBAR_HEIGHT, SIDEBAR_WIDTH, screen_height - TOOLBAR_HEIGHT - STATUSBAR_HEIGHT))
    pygame.draw.line(screen, COLOR_BORDER_DARK, (sidebar_x_abs, TOOLBAR_HEIGHT), (sidebar_x_abs, screen_height - STATUSBAR_HEIGHT), 1)

    current_sidebar_y = TOOLBAR_HEIGHT + SIDEBAR_PADDING_Y
    section_icon_text_spacing = 8

    def _draw_section_box(y_offset, title_text, icon_key, content_height_func, draw_content_func, context_args_tuple):
        nonlocal current_sidebar_y
        
        title_surf = fonts['heading'].render(title_text, True, COLOR_TEXT_DARK)
        
        actual_content_height = content_height_func(*context_args_tuple)
        
        total_section_height = (SECTION_VERTICAL_PADDING_INTERNAL * 2 + 
                                title_surf.get_height() + 
                                SECTION_TITLE_BOTTOM_MARGIN + 
                                actual_content_height)

        pygame.draw.rect(screen, COLOR_SECTION_BG, (section_box_x_abs, y_offset, SECTION_BOX_WIDTH_REL, total_section_height), border_radius=6)
        pygame.draw.rect(screen, COLOR_BORDER_NORMAL, (section_box_x_abs, y_offset, SECTION_BOX_WIDTH_REL, total_section_height), 1, border_radius=6)

        icon_surf = ui_elems["icons"][icon_key]
        content_render_x_start = sidebar_x_abs + SIDEBAR_CONTENT_X_START_REL
        
        icon_y_adj = (title_surf.get_height() - icon_surf.get_height()) // 2
        screen.blit(icon_surf, (content_render_x_start + 2, y_offset + SECTION_VERTICAL_PADDING_INTERNAL + icon_y_adj))
        screen.blit(title_surf, (content_render_x_start + icon_surf.get_width() + section_icon_text_spacing, y_offset + SECTION_VERTICAL_PADDING_INTERNAL))

        content_render_y_start = y_offset + SECTION_VERTICAL_PADDING_INTERNAL + title_surf.get_height() + SECTION_TITLE_BOTTOM_MARGIN
        draw_content_func(content_render_x_start, content_render_y_start, *context_args_tuple)
        
        current_sidebar_y = y_offset + total_section_height + INTER_SECTION_SPACING_Y

    def get_info_content_height(game_state_local, fonts_local):
        num_loads_applied = sum(1 for j_item in game_state_local["joints"] if abs(j_item.load[0]) > FLOAT_TOLERANCE or abs(j_item.load[1]) > FLOAT_TOLERANCE)
        num_anchors = sum(1 for j_item in game_state_local["joints"] if j_item.is_anchor)
        info_texts_list_h = [
            f"Joints: {len(game_state_local['joints'])}", f"Beams: {len(game_state_local['beams'])}",
            f"Anchors: {num_anchors}", f"Loads: {num_loads_applied}",
            f"Status: {'Stable' if game_state_local['calculation_success'] else ('Not Calculated' if not game_state_local['calculation_done'] else 'Unstable')}"
        ]
        return sum(fonts_local['main'].get_height() + ITEM_VERTICAL_SPACING for _ in info_texts_list_h) - ITEM_VERTICAL_SPACING
    
    def draw_info_content(x_pos, y_pos, game_state_local, fonts_local):
        num_loads_applied = sum(1 for j_item in game_state_local["joints"] if abs(j_item.load[0]) > FLOAT_TOLERANCE or abs(j_item.load[1]) > FLOAT_TOLERANCE)
        num_anchors = sum(1 for j_item in game_state_local["joints"] if j_item.is_anchor)
        info_texts_list_c = [
            f"Joints: {len(game_state_local['joints'])}", f"Beams: {len(game_state_local['beams'])}",
            f"Anchors: {num_anchors}", f"Loads: {num_loads_applied}",
            f"Status: {'Stable' if game_state_local['calculation_success'] else ('Not Calculated' if not game_state_local['calculation_done'] else 'Unstable')}"
        ]
        current_y = y_pos
        for txt_line in info_texts_list_c:
            text_render_surf = fonts_local['main'].render(txt_line, True, COLOR_TEXT_DARK)
            screen.blit(text_render_surf, (x_pos + 5, current_y))
            current_y += text_render_surf.get_height() + ITEM_VERTICAL_SPACING
            
    _draw_section_box(current_sidebar_y, "Structure Info", "info_sec", 
                      get_info_content_height, draw_info_content, (game_state, fonts))

    sel_joint_idx_load = game_state["selected_joint_for_load_idx"]
    if game_state["current_tool"] == "load" and sel_joint_idx_load != -1 and sel_joint_idx_load < len(game_state["joints"]):
        
        def get_load_modify_content_height(game_state_local, fonts_local):
            sel_joint_local_h = game_state_local["joints"][game_state_local["selected_joint_for_load_idx"]]
            fx_text_s_h = fonts_local['small'].render(f"Fx: {sel_joint_local_h.load[0]:.0f} N", True, COLOR_TEXT_DARK)
            fy_text_s_h = fonts_local['small'].render(f"Fy: {sel_joint_local_h.load[1]:.0f} N", True, COLOR_TEXT_DARK)
            joint_info_s_h = fonts_local['small'].render(f"Selected Joint: {game_state_local['selected_joint_for_load_idx']}", True, COLOR_TEXT_DARK)
            return (joint_info_s_h.get_height() + ITEM_VERTICAL_SPACING +
                    fx_text_s_h.get_height() + ITEM_VERTICAL_SPACING + LOAD_MODIFY_BUTTON_HEIGHT + ITEM_VERTICAL_SPACING +
                    fy_text_s_h.get_height() + ITEM_VERTICAL_SPACING + LOAD_MODIFY_BUTTON_HEIGHT + ITEM_VERTICAL_SPACING +
                    LOAD_MODIFY_BUTTON_HEIGHT)

        def draw_load_modify_content(x_pos, y_pos, game_state_local, fonts_local):
            current_y = y_pos
            sel_joint_local_c = game_state_local["joints"][game_state_local["selected_joint_for_load_idx"]]
            mod_button_w = (SECTION_BOX_WIDTH_REL - (x_pos - section_box_x_abs) * 2 - ITEM_HORIZONTAL_SPACING) // 2
            clear_button_w = SECTION_BOX_WIDTH_REL - (x_pos - section_box_x_abs) * 2

            joint_info_s_c = fonts_local['small'].render(f"Selected Joint: {game_state_local['selected_joint_for_load_idx']}", True, COLOR_TEXT_DARK)
            screen.blit(joint_info_s_c, (x_pos + 5, current_y))
            current_y += joint_info_s_c.get_height() + ITEM_VERTICAL_SPACING

            fx_text_s_c = fonts_local['small'].render(f"Fx: {sel_joint_local_c.load[0]:.0f} N", True, COLOR_TEXT_DARK)
            screen.blit(fx_text_s_c, (x_pos + 5, current_y))
            current_y += fx_text_s_c.get_height() + ITEM_VERTICAL_SPACING // 2
            
            game_state_local["fx_minus_button"] = Button(x_pos + 5, current_y, mod_button_w, LOAD_MODIFY_BUTTON_HEIGHT, "Fx -", font_override=fonts_local['small'])
            game_state_local["fx_plus_button"] = Button(x_pos + 5 + mod_button_w + ITEM_HORIZONTAL_SPACING, current_y, mod_button_w, LOAD_MODIFY_BUTTON_HEIGHT, "Fx +", font_override=fonts_local['small'])
            game_state_local["fx_minus_button"].draw(screen, fonts_local); game_state_local["fx_plus_button"].draw(screen, fonts_local)
            current_y += LOAD_MODIFY_BUTTON_HEIGHT + ITEM_VERTICAL_SPACING

            fy_text_s_c = fonts_local['small'].render(f"Fy: {sel_joint_local_c.load[1]:.0f} N", True, COLOR_TEXT_DARK)
            screen.blit(fy_text_s_c, (x_pos + 5, current_y))
            current_y += fy_text_s_c.get_height() + ITEM_VERTICAL_SPACING // 2

            game_state_local["fy_minus_button"] = Button(x_pos + 5, current_y, mod_button_w, LOAD_MODIFY_BUTTON_HEIGHT, "Fy -", font_override=fonts_local['small'])
            game_state_local["fy_plus_button"] = Button(x_pos + 5 + mod_button_w + ITEM_HORIZONTAL_SPACING, current_y, mod_button_w, LOAD_MODIFY_BUTTON_HEIGHT, "Fy +", font_override=fonts_local['small'])
            game_state_local["fy_minus_button"].draw(screen, fonts_local); game_state_local["fy_plus_button"].draw(screen, fonts_local)
            current_y += LOAD_MODIFY_BUTTON_HEIGHT + ITEM_VERTICAL_SPACING

            game_state_local["clear_load_button"] = Button(x_pos + 5, current_y, clear_button_w, LOAD_MODIFY_BUTTON_HEIGHT, "Clear Load", font_override=fonts_local['small'])
            game_state_local["clear_load_button"].draw(screen, fonts_local)

        _draw_section_box(current_sidebar_y, "Modify Load", "load_modify_sec",
                          get_load_modify_content_height, draw_load_modify_content, (game_state, fonts))
    else:
        game_state["fx_plus_button"], game_state["fx_minus_button"] = None, None
        game_state["fy_plus_button"], game_state["fy_minus_button"] = None, None
        game_state["clear_load_button"] = None

    def get_display_options_content_height(ui_elems_local, game_state_local, fonts_local):
        toggles_keys_disp_h = ["grid_toggle", "forces_toggle", "reactions_toggle", "tooltip_toggle"]
        height = 0
        for key in toggles_keys_disp_h:
            height += SIDEBAR_TOGGLE_HEIGHT + ITEM_VERTICAL_SPACING
        return height - ITEM_VERTICAL_SPACING if height > 0 else 0

    def draw_display_options_content(x_pos, y_pos, ui_elems_local, game_state_local, fonts_local):
        current_y = y_pos
        toggles_keys_disp_c = ["grid_toggle", "forces_toggle", "reactions_toggle", "tooltip_toggle"]
        for key in toggles_keys_disp_c: 
            btn_item = ui_elems_local[key]
            btn_item.rect.width = SIDEBAR_CONTENT_WIDTH_REL
            btn_item.rect.topleft = (x_pos, current_y)
            if key == "grid_toggle": btn_item.is_on = game_state_local["show_grid"]
            elif key == "forces_toggle": btn_item.is_on = game_state_local["show_forces"]
            elif key == "reactions_toggle": btn_item.is_on = game_state_local["show_reactions"]
            elif key == "tooltip_toggle": btn_item.is_on = game_state_local["show_tooltip"]
            btn_item.draw(screen, fonts_local)
            current_y += btn_item.rect.height + ITEM_VERTICAL_SPACING
            
    _draw_section_box(current_sidebar_y, "Display Options", "display_sec",
                      get_display_options_content_height, draw_display_options_content, (ui_elems, game_state, fonts))

    def get_view_controls_content_height(ui_elems_local, camera_local, fonts_local):
        zoom_s_h = fonts_local['small'].render(f"Zoom: {int(camera_local.zoom_level*100)}%", True, COLOR_TEXT_DARK)
        return ZOOM_BUTTON_HEIGHT + ITEM_VERTICAL_SPACING + zoom_s_h.get_height()

    def draw_view_controls_content(x_pos, y_pos, ui_elems_local, camera_local, fonts_local):
        current_y = y_pos
        zoom_s_c = fonts_local['small'].render(f"Zoom: {int(camera_local.zoom_level*100)}%", True, COLOR_TEXT_DARK)
        zoom_button_width_actual = (SIDEBAR_CONTENT_WIDTH_REL - 2 * ITEM_HORIZONTAL_SPACING) // 3
        zoom_buttons_keys_view = ["zoom_in_button", "zoom_out_button", "reset_view_button"]
        
        zoom_btn_x_start = x_pos
        for key in zoom_buttons_keys_view: 
            btn_item = ui_elems_local[key]
            btn_item.rect.width = zoom_button_width_actual
            btn_item.rect.topleft = (zoom_btn_x_start, current_y)
            btn_item.draw(screen, fonts_local)
            zoom_btn_x_start += zoom_button_width_actual + ITEM_HORIZONTAL_SPACING
        screen.blit(zoom_s_c, (x_pos + 5, current_y + ZOOM_BUTTON_HEIGHT + ITEM_VERTICAL_SPACING))

    _draw_section_box(current_sidebar_y, "View Controls", "view_sec",
                      get_view_controls_content_height, draw_view_controls_content, (ui_elems, camera, fonts))

def draw_status_bar(screen, screen_width, screen_height, fonts, game_state):
    pygame.draw.rect(screen, COLOR_STATUSBAR_BG, (0, screen_height - STATUSBAR_HEIGHT, screen_width, STATUSBAR_HEIGHT))
    pygame.draw.line(screen, COLOR_BORDER_NORMAL, (0, screen_height - STATUSBAR_HEIGHT), (screen_width, screen_height - STATUSBAR_HEIGHT), 1)

    status_text_color_val = COLOR_SUCCESS if game_state["calculation_success"] else \
                           (COLOR_ERROR if game_state["calculation_done"] else COLOR_INFO_STATUS)

    max_status_width = screen_width - SIDEBAR_WIDTH - 20
    status_s_text = game_state["last_failure_reason"]
    status_s = fonts['small'].render(status_s_text, True, status_text_color_val)

    if status_s.get_width() > max_status_width:
        avg_char_width = status_s.get_width() / len(status_s_text) if len(status_s_text) > 0 else 10
        est_chars = int(max_status_width / avg_char_width) if avg_char_width > 0 else 10
        status_s_text = status_s_text[:max(10, est_chars - 3)] + "..."
        status_s = fonts['small'].render(status_s_text, True, status_text_color_val)

    screen.blit(status_s, (10, screen_height - STATUSBAR_HEIGHT + (STATUSBAR_HEIGHT - status_s.get_height()) // 2))
