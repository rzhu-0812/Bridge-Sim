import pygame
from config import FLOAT_TOLERANCE, ANCHOR_Y_WORLD_THRESHOLD
from ..settings import *

def draw_tooltip(screen, screen_width, screen_height, fonts, game_state):
    hover_beam_idx = game_state["hover_beam_idx"]
    if hover_beam_idx == -1 or hover_beam_idx >= len(game_state["beams"]) or not game_state["show_tooltip"] or game_state["show_help"]:
        return

    beam = game_state["beams"][hover_beam_idx]
    force = beam.force
    stress = beam.stress

    force_type = "Tension" if force > FLOAT_TOLERANCE else "Compression" if force < -FLOAT_TOLERANCE else "Zero Force"
    stress_str = f"{stress:.2e} Pa"
    if abs(stress) > 1e5:
        stress_str = f"{stress / 1e6:.2f} MPa"
    elif abs(stress) > 1e2:
        stress_str = f"{stress / 1e3:.2f} kPa"

    tooltip_lines = [
        f"Beam {hover_beam_idx}",
        f"Force: {abs(force):.1f} N ({force_type})",
        f"Stress: {stress_str}"
    ]

    rendered_lines = [fonts['tiny'].render(line, True, COLOR_TOOLTIP_TEXT) for line in tooltip_lines]
    max_width = max(line.get_width() for line in rendered_lines)
    tooltip_width = max_width + 8
    tooltip_height = sum(line.get_height() for line in rendered_lines) + (len(rendered_lines) - 1) * 2 + 6

    mouse_pos = game_state["mouse_screen_pos"]
    x = mouse_pos[0] + 15
    y = mouse_pos[1] - tooltip_height - 10

    if x + tooltip_width > screen_width:
        x = mouse_pos[0] - tooltip_width - 15
    if y < TOOLBAR_HEIGHT:
        y = mouse_pos[1] + 15
    if y + tooltip_height > screen_height - STATUSBAR_HEIGHT:
        y = screen_height - STATUSBAR_HEIGHT - tooltip_height - 5

    bg_surface = pygame.Surface((tooltip_width, tooltip_height), pygame.SRCALPHA)
    bg_surface.fill(COLOR_TOOLTIP_BG)
    screen.blit(bg_surface, (x, y))
    pygame.draw.rect(screen, COLOR_TOOLTIP_BORDER, (x, y, tooltip_width, tooltip_height), 1, border_radius=3)

    current_y = y + 3
    for line in rendered_lines:
        screen.blit(line, (x + 4, current_y))
        current_y += line.get_height() + 2

def draw_help_dialog(screen, screen_width, screen_height, fonts, game_state, help_rect):
    overlay = pygame.Surface((screen_width, screen_height), pygame.SRCALPHA)
    overlay.fill((0, 0, 0, 190))
    screen.blit(overlay, (0, 0))

    pygame.draw.rect(screen, COLOR_SIDEBAR_BG, help_rect, border_radius=10)
    pygame.draw.rect(screen, COLOR_BORDER_DARK, help_rect, 2, border_radius=10)

    title = fonts['title'].render("Bridge Physics Simulator - Help", True, COLOR_TEXT_DARK)
    screen.blit(title, (help_rect.x + (help_rect.width - title.get_width()) // 2, help_rect.y + HELP_DIALOG_PADDING_GENERAL))

    title_height = title.get_height() + HELP_DIALOG_PADDING_GENERAL * 2
    close_msg_height = fonts['small'].get_height() + HELP_DIALOG_PADDING_GENERAL * 2

    content_x = help_rect.x + HELP_CONTENT_HORIZONTAL_PADDING
    content_y = help_rect.y + title_height
    content_width = help_rect.width - (2 * HELP_CONTENT_HORIZONTAL_PADDING) - HELP_SCROLLBAR_WIDTH - HELP_SCROLLBAR_PADDING_FROM_TEXT
    visible_height = help_rect.height - title_height - close_msg_height

    help_sections = [
        ("Tools (Toolbar or Hotkeys)", [
            f"J or Joint button: Place joints. Auto-anchors if Y >= {ANCHOR_Y_WORLD_THRESHOLD}.",
            "B or Beam button: Click two joints to connect them with a beam.",
            "A or Anchor button: Click joint to toggle anchor. Click empty space to place anchor.",
            "L or Load button: Click non-anchor joint to select it. Modify Fx/Fy via sidebar panel."
        ]),
        ("Actions (Toolbar or Hotkeys)", [
            "C or Calc button: Calculate forces in the structure.",
            "R (Key): Soft reset (clears loads/calcs). Reset (Btn): Full structure clear.",
            "Ctrl+Z or Undo button: Remove last added beam/joint, or deselect joint for load.",
            "H or ? button: Toggle this help screen. ESC also closes help."
        ]),
        ("View Controls (Sidebar, Mouse Wheel, Keys)", [
            "Mouse Wheel (in sim area): Zoom in/out (relative to mouse cursor).",
            "Middle Mouse + Drag (in sim area): Pan the view.",
            "+/- Keys: Zoom in/out (centered). 0 Key: Reset view.",
            "Zoom In/Out/Reset View buttons (Sidebar): Control zoom/pan."
        ]),
        ("Display Options (Sidebar)", [
            "Grid: Show/hide background grid.",
            "Forces: Show/hide beam force visualization (Red:Tension, Blue:Compression).",
            "Reactions: Show/hide reaction forces & values at anchors (Blue arrows & text).",
            "Tooltips: Show/hide tooltips for beam forces/stress on hover."
        ]),
        ("Tips", [
            "Build with triangles for stable trusses.",
            "Ensure at least two distinct anchor points for stability (pin-roller assumed).",
            "Applied loads (Orange arrows & text) and their values are shown on joints.",
            "Problematic joints (e.g., collinear beams, disconnected) are highlighted in red.",
            "Check status bar for messages and calculation errors."
        ])
    ]

    lines = []
    current_y = 0
    line_spacing = 3
    section_spacing = 12

    for header, items in help_sections:
        header_surface = fonts['heading'].render(header, True, COLOR_TEXT_DARK)
        lines.append({'surf': header_surface, 'x': 0, 'y': current_y})
        current_y += header_surface.get_height() + line_spacing + 2

        for item in items:
            bullet_width = fonts['small'].render("• ", True, COLOR_TEXT_DARK).get_width()
            space_width = max(fonts['small'].size(" ")[0], 1)
            words = item.split(' ')
            line = "• "
            first_word = True

            for word in words:
                prefix = "" if first_word else " " * (bullet_width // space_width)
                test_line = line + prefix + word + " "
                test_surface = fonts['small'].render(test_line.strip(), True, COLOR_TEXT_DARK)

                if test_surface.get_width() <= content_width:
                    line += prefix + word + " "
                    first_word = False
                else:
                    lines.append({'surf': fonts['small'].render(line.strip(), True, COLOR_TEXT_DARK), 'x': 0, 'y': current_y})
                    current_y += fonts['small'].get_height() + line_spacing
                    line = " " * (bullet_width // space_width) + word + " "
                    first_word = False

            if line.strip():
                lines.append({'surf': fonts['small'].render(line.strip(), True, COLOR_TEXT_DARK), 'x': 0, 'y': current_y})
                current_y += fonts['small'].get_height() + line_spacing

        current_y += section_spacing - line_spacing

    total_height = current_y
    content_surface = pygame.Surface((content_width, max(1, total_height)), pygame.SRCALPHA)
    content_surface.fill(COLOR_SIDEBAR_BG)

    for line in lines:
        content_surface.blit(line['surf'], (line['x'], line['y']))

    scrollable_height = max(0, total_height - visible_height)
    game_state["help_scroll_y_offset"] = max(0, min(game_state["help_scroll_y_offset"], scrollable_height))

    visible_rect = pygame.Rect(0, game_state["help_scroll_y_offset"], content_width, visible_height)
    screen.blit(content_surface, (content_x, content_y), area=visible_rect)

    if scrollable_height > 0:
        scrollbar_x = content_x + content_width + HELP_SCROLLBAR_PADDING_FROM_TEXT
        scrollbar_y = content_y
        scrollbar_height = visible_height
        pygame.draw.rect(screen, COLOR_BORDER_NORMAL, (scrollbar_x, scrollbar_y, HELP_SCROLLBAR_WIDTH, scrollbar_height), border_radius=3)

        thumb_height = max(20, (visible_height / total_height) * scrollbar_height)
        thumb_y = scrollbar_y + (game_state["help_scroll_y_offset"] / scrollable_height) * (scrollbar_height - thumb_height)
        pygame.draw.rect(screen, COLOR_BUTTON_HOVER, (scrollbar_x, thumb_y, HELP_SCROLLBAR_WIDTH, thumb_height), border_radius=3)
        pygame.draw.rect(screen, COLOR_BORDER_DARK, (scrollbar_x, thumb_y, HELP_SCROLLBAR_WIDTH, thumb_height), 1, border_radius=3)

    close_msg = fonts['small'].render("Click outside box, press H, or press ESC to close", True, COLOR_TEXT_DARK)
    screen.blit(close_msg, (help_rect.x + (help_rect.width - close_msg.get_width()) // 2, help_rect.bottom - HELP_DIALOG_PADDING_GENERAL - close_msg.get_height()))