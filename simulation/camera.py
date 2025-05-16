class Camera:
    def __init__(self, sim_area_width, sim_area_height):
        self.zoom_level = 1.0
        self.pan_offset = [sim_area_width / 2, sim_area_height / 2]
        self.is_panning = False
        self.pan_start_screen = (0, 0)
        self.sim_area_width = sim_area_width
        self.sim_area_height = sim_area_height

    def world_to_screen(self, world_pos):
        x = world_pos[0] * self.zoom_level + self.pan_offset[0]
        y = world_pos[1] * self.zoom_level + self.pan_offset[1]
        return int(x), int(y)

    def screen_to_world(self, screen_pos):
        if self.zoom_level == 0:
            return 0, 0
        x = (screen_pos[0] - self.pan_offset[0]) / self.zoom_level
        y = (screen_pos[1] - self.pan_offset[1]) / self.zoom_level
        return x, y

    def start_pan(self, screen_pos):
        self.is_panning = True
        self.pan_start_screen = screen_pos

    def update_pan(self, screen_pos):
        if not self.is_panning:
            return
        dx = screen_pos[0] - self.pan_start_screen[0]
        dy = screen_pos[1] - self.pan_start_screen[1]
        self.pan_offset[0] += dx
        self.pan_offset[1] += dy
        self.pan_start_screen = screen_pos

    def end_pan(self):
        self.is_panning = False

    def zoom(self, factor, mouse_pos=None):
        old_zoom = self.zoom_level
        self.zoom_level = min(3.0, max(0.2, self.zoom_level * factor))
        if mouse_pos:
            world_pos = self.screen_to_world(mouse_pos)
            self.pan_offset[0] = mouse_pos[0] - world_pos[0] * self.zoom_level
            self.pan_offset[1] = mouse_pos[1] - world_pos[1] * self.zoom_level
        else:
            center_screen = (self.sim_area_width / 2, self.sim_area_height / 2)
            center_world = self.screen_to_world(center_screen)
            self.pan_offset[0] = center_screen[0] - center_world[0] * self.zoom_level
            self.pan_offset[1] = center_screen[1] - center_world[1] * self.zoom_level

    def reset_view(self):
        self.zoom_level = 1.0
        self.pan_offset = [self.sim_area_width / 2, self.sim_area_height / 2]