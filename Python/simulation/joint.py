import pygame
from config import *

class Joint:
    def __init__(self, x, y, is_anchor=False):
        self.x = x
        self.y = y
        self.is_anchor = is_anchor
        self.load = [0.0, 0.0]
        self.problematic = False

    def draw(self, surface, world_to_screen_func, tiny_font, is_selected_for_load=False):
        screen_x, screen_y = world_to_screen_func((self.x, self.y))
        color = ANCHOR_COLOR if self.is_anchor else JOINT_COLOR
        pygame.draw.circle(surface, color, (screen_x, screen_y), JOINT_RADIUS)

        if self.is_anchor:
            rect_width = JOINT_RADIUS * 2
            rect_height = JOINT_RADIUS
            pygame.draw.rect(surface, ANCHOR_COLOR, (screen_x - JOINT_RADIUS, screen_y + JOINT_RADIUS - 2, rect_width, rect_height))

        if is_selected_for_load:
            pygame.draw.circle(surface, SELECTED_FOR_LOAD_HIGHLIGHT_COLOR, (screen_x, screen_y), HIGHLIGHT_RADIUS + 2, 3)

        fx, fy = self.load
        arrow_screen_len = 25
        text_offset_x = JOINT_RADIUS + 5
        text_offset_y = -JOINT_RADIUS - 8

        if abs(fy) > FLOAT_TOLERANCE:
            direction_y = -1 if fy > 0 else 1
            arrow_start_y = (JOINT_RADIUS + 2) * direction_y
            arrow_end_y = arrow_start_y + (arrow_screen_len * direction_y)
            pygame.draw.line(surface, LOAD_COLOR, (screen_x, screen_y + arrow_start_y), (screen_x, screen_y + arrow_end_y), 3)
            tip_y = screen_y + arrow_end_y
            arrow_tip = [(screen_x, tip_y - 3), (screen_x - 4, tip_y + 3), (screen_x + 4, tip_y + 3)] if fy > 0 else [(screen_x, tip_y + 3), (screen_x - 4, tip_y - 3), (screen_x + 4, tip_y - 3)]
            pygame.draw.polygon(surface, LOAD_COLOR, arrow_tip)
            load_text = f"{abs(fy):.0f} N {'↑' if fy > 0 else '↓'}"
            text_pos_y = screen_y + text_offset_y - 10 if fy > 0 else screen_y + text_offset_y
            text_surf = tiny_font.render(load_text, True, LOAD_TEXT_COLOR)
            text_rect = text_surf.get_rect(bottomleft=(screen_x + text_offset_x, text_pos_y if fy < 0 else screen_y - text_offset_y + 20))
            surface.blit(text_surf, text_rect)

        if abs(fx) > FLOAT_TOLERANCE:
            direction_x = -1 if fx > 0 else 1
            arrow_start_x = (JOINT_RADIUS + 2) * direction_x
            arrow_end_x = arrow_start_x + (arrow_screen_len * direction_x)
            pygame.draw.line(surface, LOAD_COLOR, (screen_x + arrow_start_x, screen_y), (screen_x + arrow_end_x, screen_y), 3)
            tip_x = screen_x + arrow_end_x
            arrow_tip = [(tip_x - 3, screen_y), (tip_x + 3, screen_y - 4), (tip_x + 3, screen_y + 4)] if fx > 0 else [(tip_x + 3, screen_y), (tip_x - 3, screen_y - 4), (tip_x - 3, screen_y + 4)]
            pygame.draw.polygon(surface, LOAD_COLOR, arrow_tip)
            load_text = f"{abs(fx):.0f} N {'→' if fx > 0 else '←'}"
            text_anchor_x = screen_x + text_offset_x + 60 if abs(fy) > FLOAT_TOLERANCE and fy < 0 else screen_x + text_offset_x if fx > 0 else screen_x - text_offset_x - 60
            text_surf = tiny_font.render(load_text, True, LOAD_TEXT_COLOR)
            text_rect = text_surf.get_rect()
            if fx > 0:
                text_rect.bottomleft = (text_anchor_x, screen_y + text_offset_y if abs(fy) <= FLOAT_TOLERANCE else text_rect.top - 2 if fy < 0 else text_rect.bottom + 15)
            else:
                text_rect.bottomright = (text_anchor_x, screen_y + text_offset_y if abs(fy) <= FLOAT_TOLERANCE else text_rect.top - 2 if fy < 0 else text_rect.bottom + 15)
            surface.blit(text_surf, text_rect)

        if self.problematic and (pygame.time.get_ticks() // 250) % 2 == 0:
            pygame.draw.circle(surface, HIGHLIGHT_COLOR, (screen_x, screen_y), HIGHLIGHT_RADIUS, 2)