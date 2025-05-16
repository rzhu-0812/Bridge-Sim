import pygame
import math
from config import JOINT_COLOR, BEAM_COLOR, ANCHOR_COLOR, LOAD_COLOR
from .settings import (
    ICON_SIZE, TOOLBAR_BUTTON_SIZE, HELP_BUTTON_WIDTH, SIDEBAR_TOGGLE_HEIGHT, ZOOM_BUTTON_HEIGHT,
    COLOR_BUTTON_NORMAL, COLOR_BUTTON_HOVER, COLOR_BUTTON_ACTIVE, COLOR_BUTTON_TEXT,
    COLOR_BORDER_DARK, COLOR_TEXT_LIGHT
)

class Button:
    def __init__(self, x, y, width, height, text, icon=None, tooltip="", font_override=None):
        self.rect = pygame.Rect(x, y, width, height)
        self.text = text
        self.icon = icon
        self.tooltip = tooltip
        self.hovered = False
        self.active = False
        self.font_override = font_override

    def draw(self, surface, fonts):
        font = self.font_override or fonts['main']
        tiny_font = fonts['tiny']
        bg_color = COLOR_BUTTON_ACTIVE if self.active else COLOR_BUTTON_HOVER if self.hovered else COLOR_BUTTON_NORMAL
        pygame.draw.rect(surface, bg_color, self.rect, border_radius=5)
        pygame.draw.rect(surface, COLOR_BORDER_DARK, self.rect, width=1, border_radius=5)

        if self.icon:
            icon_rect = self.icon.get_rect(center=(self.rect.centerx, self.rect.centery - self.rect.height * 0.12))
            surface.blit(self.icon, icon_rect)
            text_surf = tiny_font.render(self.text, True, COLOR_BUTTON_TEXT)
            text_rect = text_surf.get_rect(center=(self.rect.centerx, self.rect.centery + self.rect.height * 0.22))
        else:
            text_surf = font.render(self.text, True, COLOR_BUTTON_TEXT)
            text_rect = text_surf.get_rect(center=self.rect.center)

        surface.blit(text_surf, text_rect)

    def check_hover(self, pos):
        self.hovered = self.rect.collidepoint(pos)
        return self.hovered

    def check_click(self, pos):
        return self.rect.collidepoint(pos)

class ToggleButton(Button):
    def __init__(self, x, y, width, height, text, icon=None, tooltip="", is_on=False, font_override=None):
        super().__init__(x, y, width, height, text, icon, tooltip, font_override)
        self.is_on = is_on

    def draw(self, surface, fonts):
        font = self.font_override or fonts['main']
        bg_color = COLOR_BUTTON_ACTIVE if self.is_on else COLOR_BUTTON_HOVER if self.hovered else COLOR_BUTTON_NORMAL
        pygame.draw.rect(surface, bg_color, self.rect, border_radius=5)
        pygame.draw.rect(surface, COLOR_BORDER_DARK, self.rect, width=1, border_radius=5)

        if self.is_on and not self.icon:
            indicator_rect = pygame.Rect(self.rect.x + 5, self.rect.centery - 3, 6, 6)
            pygame.draw.rect(surface, COLOR_TEXT_LIGHT, indicator_rect, border_radius=2)

        text_surf = font.render(self.text, True, COLOR_BUTTON_TEXT)
        text_rect = text_surf.get_rect(center=self.rect.center)
        if self.is_on and not self.icon:
            text_rect.centerx += 8

        surface.blit(text_surf, text_rect)

    def toggle(self):
        self.is_on = not self.is_on
        return self.is_on

def create_joint_icon_toolbar():
    surf = pygame.Surface((24, 24), pygame.SRCALPHA)
    pygame.draw.circle(surf, JOINT_COLOR, (12, 12), 7)
    return surf

def create_beam_icon_toolbar():
    surf = pygame.Surface((24, 24), pygame.SRCALPHA)
    pygame.draw.line(surf, BEAM_COLOR, (4, 20), (20, 4), 5)
    return surf

def create_anchor_icon_toolbar():
    surf = pygame.Surface((24, 24), pygame.SRCALPHA)
    pygame.draw.rect(surf, ANCHOR_COLOR, (5, 18, 14, 4), border_radius=1)
    pygame.draw.polygon(surf, ANCHOR_COLOR, [(12, 3), (7, 18), (17, 18)])
    return surf

def create_load_icon_toolbar():
    surf = pygame.Surface((24, 24), pygame.SRCALPHA)
    pygame.draw.line(surf, LOAD_COLOR, (12, 2), (12, 18), 3)
    pygame.draw.polygon(surf, LOAD_COLOR, [(7, 15), (12, 22), (17, 15)])
    return surf

def create_calc_icon_toolbar():
    surf = pygame.Surface((24, 24), pygame.SRCALPHA)
    pygame.draw.rect(surf, (210, 210, 210), (3, 3, 18, 18), border_radius=3)
    pygame.draw.rect(surf, (60, 60, 60), (5, 5, 14, 6), border_radius=2)
    for i in range(3):
        pygame.draw.rect(surf, (160, 160, 160), (6 + i * 4, 13, 3, 3), border_radius=1)
    return surf

def create_reset_icon_toolbar():
    surf = pygame.Surface((24, 24), pygame.SRCALPHA)
    pygame.draw.arc(surf, (220, 80, 80), (4, 4, 16, 16), 0.5, 5.8, 3)
    pygame.draw.polygon(surf, (220, 80, 80), [(18, 7), (21, 12), (16, 12)])
    return surf

def create_undo_icon_toolbar():
    surf = pygame.Surface((24, 24), pygame.SRCALPHA)
    pygame.draw.arc(surf, (80, 150, 220), (5, 7, 14, 10), math.pi / 2 * 0.8, math.pi * 1.2, 3)
    pygame.draw.polygon(surf, (80, 150, 220), [(5, 11), (9, 7), (9, 15)])
    return surf

def create_info_section_icon():
    surf = pygame.Surface(ICON_SIZE, pygame.SRCALPHA)
    pygame.draw.circle(surf, (70, 130, 180), (ICON_SIZE[0] // 2, ICON_SIZE[1] // 2), ICON_SIZE[0] // 2 - 2, 2)
    pygame.draw.rect(surf, (70, 130, 180), (ICON_SIZE[0] // 2 - 1, ICON_SIZE[1] // 2 - 4, 2, 2))
    pygame.draw.rect(surf, (70, 130, 180), (ICON_SIZE[0] // 2 - 1, ICON_SIZE[1] // 2 - 1, 2, 6))
    return surf

def create_display_section_icon():
    surf = pygame.Surface(ICON_SIZE, pygame.SRCALPHA)
    pygame.draw.ellipse(surf, (70, 180, 130), (1, ICON_SIZE[1] // 2 - 4, ICON_SIZE[0] - 2, 8))
    pygame.draw.circle(surf, (50, 50, 50), (ICON_SIZE[0] // 2, ICON_SIZE[1] // 2), 3)
    return surf

def create_view_section_icon():
    surf = pygame.Surface(ICON_SIZE, pygame.SRCALPHA)
    pygame.draw.circle(surf, (180, 130, 70), (ICON_SIZE[0] // 2 - 3, ICON_SIZE[1] // 2 - 3), ICON_SIZE[0] // 3, 2)
    pygame.draw.line(surf, (180, 130, 70), (ICON_SIZE[0] // 2 + 1, ICON_SIZE[1] // 2 + 1), (ICON_SIZE[0] - 3, ICON_SIZE[1] - 3), 2)
    return surf

def create_load_modify_icon():
    surf = pygame.Surface(ICON_SIZE, pygame.SRCALPHA)
    pygame.draw.circle(surf, (100, 100, 100), (ICON_SIZE[0] // 2, ICON_SIZE[1] // 2), ICON_SIZE[0] // 2 - 2, 2)
    pygame.draw.circle(surf, (100, 100, 100), (ICON_SIZE[0] // 2, ICON_SIZE[1] // 2), ICON_SIZE[0] // 5)
    for i in range(6):
        angle = i * (2 * math.pi / 6)
        x1 = ICON_SIZE[0] // 2 + (ICON_SIZE[0] // 2 - 3) * math.cos(angle)
        y1 = ICON_SIZE[1] // 2 + (ICON_SIZE[0] // 2 - 3) * math.sin(angle)
        x2 = ICON_SIZE[0] // 2 + (ICON_SIZE[0] // 2) * math.cos(angle)
        y2 = ICON_SIZE[1] // 2 + (ICON_SIZE[0] // 2) * math.sin(angle)
        pygame.draw.line(surf, (100, 100, 100), (x1, y1), (x2, y2), 2)
    return surf

joint_icon_surf = create_joint_icon_toolbar()
beam_icon_surf = create_beam_icon_toolbar()
anchor_icon_surf = create_anchor_icon_toolbar()
load_icon_surf = create_load_icon_toolbar()
calc_icon_surf = create_calc_icon_toolbar()
reset_icon_surf = create_reset_icon_toolbar()
undo_icon_surf = create_undo_icon_toolbar()
info_sec_icon_surf = create_info_section_icon()
display_sec_icon_surf = create_display_section_icon()
view_sec_icon_surf = create_view_section_icon()
load_modify_sec_icon_surf = create_load_modify_icon()

joint_button = Button(0, 0, TOOLBAR_BUTTON_SIZE, TOOLBAR_BUTTON_SIZE, "Joint", joint_icon_surf, "Place joints (J)")
beam_button = Button(0, 0, TOOLBAR_BUTTON_SIZE, TOOLBAR_BUTTON_SIZE, "Beam", beam_icon_surf, "Connect joints (B)")
anchor_button = Button(0, 0, TOOLBAR_BUTTON_SIZE, TOOLBAR_BUTTON_SIZE, "Anchor", anchor_icon_surf, "Place/toggle anchors (A)")
load_button = Button(0, 0, TOOLBAR_BUTTON_SIZE, TOOLBAR_BUTTON_SIZE, "Load", load_icon_surf, "Select joint to modify load (L)")
calc_button = Button(0, 0, TOOLBAR_BUTTON_SIZE, TOOLBAR_BUTTON_SIZE, "Calc", calc_icon_surf, "Calculate forces (C)")
reset_button = Button(0, 0, TOOLBAR_BUTTON_SIZE, TOOLBAR_BUTTON_SIZE, "Reset", reset_icon_surf, "Reset simulation (R)")
undo_button = Button(0, 0, TOOLBAR_BUTTON_SIZE, TOOLBAR_BUTTON_SIZE, "Undo", undo_icon_surf, "Undo (Ctrl+Z)")
help_button = Button(0, 0, HELP_BUTTON_WIDTH, TOOLBAR_BUTTON_SIZE, "?", None, "Show/hide help (H)")

grid_toggle = ToggleButton(0, 0, 0, SIDEBAR_TOGGLE_HEIGHT, "Grid", None, "Show/hide grid", True)
forces_toggle = ToggleButton(0, 0, 0, SIDEBAR_TOGGLE_HEIGHT, "Forces", None, "Show/hide forces", True)
reactions_toggle = ToggleButton(0, 0, 0, SIDEBAR_TOGGLE_HEIGHT, "Reactions", None, "Show/hide reactions", True)
tooltip_toggle = ToggleButton(0, 0, 0, SIDEBAR_TOGGLE_HEIGHT, "Tooltips", None, "Show/hide tooltips", True)

zoom_in_button = Button(0, 0, 0, ZOOM_BUTTON_HEIGHT, "Zoom In", None, "Increase zoom (+)")
zoom_out_button = Button(0, 0, 0, ZOOM_BUTTON_HEIGHT, "Zoom Out", None, "Decrease zoom (-)")
reset_view_button = Button(0, 0, 0, ZOOM_BUTTON_HEIGHT, "Reset View", None, "Reset zoom and pan (0)")

ui_elements = {
    "joint_button": joint_button, "beam_button": beam_button, "anchor_button": anchor_button,
    "load_button": load_button, "calc_button": calc_button, "reset_button": reset_button,
    "undo_button": undo_button, "help_button": help_button,
    "grid_toggle": grid_toggle, "forces_toggle": forces_toggle,
    "reactions_toggle": reactions_toggle, "tooltip_toggle": tooltip_toggle,
    "zoom_in_button": zoom_in_button, "zoom_out_button": zoom_out_button,
    "reset_view_button": reset_view_button,
    "icons": {
        "info_sec": info_sec_icon_surf,
        "display_sec": display_sec_icon_surf,
        "view_sec": view_sec_icon_surf,
        "load_modify_sec": load_modify_sec_icon_surf,
    }
}