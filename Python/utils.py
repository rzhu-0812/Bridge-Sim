from config import GRID_SIZE

def snap_to_grid(x, y):
    grid_x = round(x / GRID_SIZE) * GRID_SIZE
    grid_y = round(y / GRID_SIZE) * GRID_SIZE
    return grid_x, grid_y

def get_closest_joint(position, joints, max_distance=GRID_SIZE // 2):
    x, y = position
    closest_index = -1
    max_distance_squared = max_distance ** 2

    for index, joint in enumerate(joints):
        distance_squared = (joint.x - x) ** 2 + (joint.y - y) ** 2
        if distance_squared < max_distance_squared:
            max_distance_squared = distance_squared
            closest_index = index

    return closest_index