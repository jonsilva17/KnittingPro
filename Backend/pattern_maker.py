from PIL import Image
import numpy as np
import os
from io import BytesIO

YARN_COLORS = [
    {"name": "Branco", "hex": "#FFFFFF"},
    {"name": "Preto", "hex": "#1A1A1A"},
    {"name": "Vermelho", "hex": "#CC0000"},
    {"name": "Vermelho Escuro", "hex": "#8B0000"},
    {"name": "Rosa Bebé", "hex": "#FFB6C1"},
    {"name": "Rosa Forte", "hex": "#FF69B4"},
    {"name": "Rosa", "hex": "#FF6699"},
    {"name": "Roxo", "hex": "#660099"},
    {"name": "Lavanda", "hex": "#B19CD9"},
    {"name": "Azul Escuro", "hex": "#003366"},
    {"name": "Azul Claro", "hex": "#6699CC"},
    {"name": "Azul Bebé", "hex": "#ADD8E6"},
    {"name": "Marinho", "hex": "#000033"},
    {"name": "Verde Escuro", "hex": "#006600"},
    {"name": "Verde Claro", "hex": "#66CC66"},
    {"name": "Verde Mentol", "hex": "#98FB98"},
    {"name": "Verde Lima", "hex": "#32CD32"},
    {"name": "Amarelo", "hex": "#FFCC00"},
    {"name": "Amarelo Claro", "hex": "#FFFACD"},
    {"name": "Laranja", "hex": "#FF6600"},
    {"name": "Laranja Claro", "hex": "#FFA500"},
    {"name": "Castanho", "hex": "#663300"},
    {"name": "Castanho Claro", "hex": "#A0522D"},
    {"name": "Bege", "hex": "#F5E6CC"},
    {"name": "Cinzento Claro", "hex": "#CCCCCC"},
    {"name": "Cinzento", "hex": "#999999"},
    {"name": "Cinzento Escuro", "hex": "#666666"},
    {"name": "Cinza Chumbo", "hex": "#333333"},
    {"name": "Creme", "hex": "#FFFDD0"},
    {"name": "Coral", "hex": "#FF7F50"},
    {"name": "Turquesa", "hex": "#40E0D0"},
    {"name": "Salmão", "hex": "#FA8072"},
]

def hex_to_rgb(hex_color):
    h = hex_color.lstrip('#')
    return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))

YARN_RGB = [hex_to_rgb(c["hex"]) for c in YARN_COLORS]


def closest_color(pixel_rgb):
    pixel_np = np.array(pixel_rgb, dtype=np.float64)
    colors_np = np.array(YARN_RGB, dtype=np.float64)
    distances = np.sqrt(np.sum((colors_np - pixel_np) ** 2, axis=1))
    return int(np.argmin(distances))


def reduce_colors_kmeans(image, n_colors):
    img_array = np.array(image)
    h, w = img_array.shape[:2]
    pixels = img_array.reshape(-1, 3).astype(np.float64)

    if len(pixels) < n_colors:
        n_colors = max(2, len(pixels))

    indices = np.random.choice(len(pixels), n_colors, replace=False)
    centroids = pixels[indices].copy()

    for _ in range(20):
        distances = np.array([
            np.sqrt(np.sum((pixels - c) ** 2, axis=1))
            for c in centroids
        ])
        labels = np.argmin(distances, axis=0)

        new_centroids = []
        for i in range(n_colors):
            mask = labels == i
            if mask.any():
                new_centroids.append(pixels[mask].mean(axis=0))
            else:
                new_centroids.append(centroids[i])
        centroids = np.array(new_centroids)

    quantized = centroids[labels].reshape(h, w, 3).astype(np.uint8)
    return Image.fromarray(quantized), centroids, labels.reshape(h, w)


def process_image_to_pattern(input_path, num_colors=6, chart_width=40, chart_height=50):
    img = Image.open(input_path).convert('RGB')

    img_resized = img.resize((chart_width, chart_height), Image.LANCZOS)

    quantized, centroids_np, labels_2d = reduce_colors_kmeans(img_resized, num_colors)

    centroids_rgb = [tuple(c.astype(int)) for c in centroids_np]

    chart = labels_2d.tolist()

    color_palette = []
    for idx, rgb in enumerate(centroids_rgb):
        yarn_idx = closest_color(rgb)
        color_palette.append({
            "index": idx,
            "name": YARN_COLORS[yarn_idx]["name"],
            "hex": '#%02X%02X%02X' % rgb,
        })

    preview = Image.new('RGB', (chart_width * 20, chart_height * 20))
    for y in range(chart_height):
        for x in range(chart_width):
            color_idx = chart[y][x]
            rgb = centroids_rgb[color_idx]
            for dy in range(20):
                for dx in range(20):
                    preview.putpixel((x * 20 + dx, y * 20 + dy), rgb)

    base_name = os.path.splitext(input_path)[0]
    preview_path = base_name + '_processed.png'
    preview.save(preview_path)

    unique_colors = len(color_palette)
    stitches = chart_width * chart_height
    estimated_yarn = max(50, round(stitches * 0.3))

    materials = {
        "yarn_colors": unique_colors,
        "estimated_yarn_grams": estimated_yarn,
        "needle_size": "3.5mm - 4.5mm",
        "gauge": "22 stitches x 30 rows = 10cm",
        "finished_size_cm": f"{round(chart_width * 0.45)}cm x {round(chart_height * 0.45)}cm",
        "yarn_types": ["Lã merino", "Algodão", "Acrílico"],
        "tools": ["Agulhas de tricô", "Tesoura", "Fita métrica", "Agulha de tapeçaria"],
    }

    return {
        "chart": chart,
        "colors": color_palette,
        "width": chart_width,
        "height": chart_height,
        "materials": materials,
        "preview_path": preview_path,
        "all_yarn_colors": [{"name": c["name"], "hex": c["hex"]} for c in YARN_COLORS],
    }


def _denoise_grid_preserve_pattern(grid):
    """Remove only isolated noise pixels while preserving patterns.
    A pixel is noise if it differs from ALL its 8 neighbors (isolated).
    Also removes single-pixel 'holes' (a pixel surrounded by the same value).
    """
    h = len(grid)
    w = len(grid[0])
    changed = True
    while changed:
        changed = False
        for y in range(1, h - 1):
            for x in range(1, w - 1):
                cell = grid[y][x]
                if cell == '_':
                    continue
                # 8 neighbors
                n = [
                    grid[y-1][x-1], grid[y-1][x], grid[y-1][x+1],
                    grid[y][x-1],                    grid[y][x+1],
                    grid[y+1][x-1], grid[y+1][x], grid[y+1][x+1],
                ]
                # If this cell is different from ALL neighbors → noise
                if all(c != cell for c in n):
                    # Replace with the most common neighbor value
                    from collections import Counter
                    counts = Counter(n)
                    most_common = counts.most_common(1)[0][0]
                    grid[y][x] = most_common
                    changed = True
        # Second pass: remove single-cell 'l' holes surrounded by 'm'
        for y in range(1, h - 1):
            for x in range(1, w - 1):
                if grid[y][x] == 'l':
                    n = [grid[y-1][x], grid[y+1][x], grid[y][x-1], grid[y][x+1]]
                    if sum(1 for c in n if c == 'm') >= 4:
                        grid[y][x] = 'm'
                        changed = True
    return grid


def _detect_neckline(binary, height, width):
    """Detect neckline/shoulder area from binary silhouette.
    Returns set of (row, col) to mark as _.
    """
    neck = set()
    if height < 10:
        return neck
    # Find leftmost and rightmost white pixel per row
    lefts = np.full(height, -1, dtype=int)
    rights = np.full(height, -1, dtype=int)
    for y in range(height):
        white = np.where(binary[y] > 0)[0]
        if len(white) > 0:
            lefts[y] = white[0]
            rights[y] = white[-1]
    widths = np.where(lefts >= 0, rights - lefts, 0)
    max_w = widths.max()
    if max_w == 0:
        return neck

    # Find the first body row (where width >= 50% of max)
    body_start = None
    for y in range(height):
        if widths[y] >= max_w * 0.5:
            body_start = y
            break
    if body_start is None:
        return neck

    # Shoulder row: where width drops below 75% of max (scanning upward from body_start)
    shoulder_row = None
    for y in range(body_start, min(height, body_start + max(8, height // 6))):
        if widths[y] < max_w * 0.75:
            shoulder_row = y
            break
    if shoulder_row is None:
        return neck

    # Neck area: from top of body to shoulder row, center portion
    neck_end = min(shoulder_row + max(4, height // 12), height)
    for y in range(body_start, neck_end):
        if lefts[y] >= 0 and rights[y] >= 0:
            sw = rights[y] - lefts[y]
            neck_st = max(4, int(sw * 0.35))
            center = (lefts[y] + rights[y]) // 2
            ns = center - neck_st // 2
            ne = center + neck_st // 2
            for x in range(max(0, ns), min(width, ne + 1)):
                neck.add((y, x))
        else:
            for x in range(width):
                neck.add((y, x))

    # Also mark rows above body (if there's gap at top) as neck
    for y in range(0, max(0, body_start - 2)):
        for x in range(width):
            neck.add((y, x))

    return neck


def convert_image_to_stitch_grid(image_data, width, height, threshold=None):
    """Convert an image to a knit/purl grid with silhouette detection.
    Body interior → m (meia), outline edges → l (liga), outside/neckline → _ (fora).
    Caller can then apply a stitch pattern via stitch_library.
    """
    import cv2
    img = Image.open(BytesIO(image_data)).convert('L')
    img_resized = img.resize((width, height), Image.LANCZOS)
    img_arr = np.array(img_resized, dtype=np.uint8)

    # 1. Gaussian blur to reduce noise
    blurred = cv2.GaussianBlur(img_arr, (5, 5), 1)

    # 2. Otsu adaptive threshold → binary
    if threshold is None:
        _, binary = cv2.threshold(blurred, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    else:
        _, binary = cv2.threshold(blurred, threshold, 255, cv2.THRESH_BINARY)

    # 3. Morphological cleanup → clean silhouette
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
    binary = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, kernel)
    binary = cv2.morphologyEx(binary, cv2.MORPH_OPEN, kernel)

    # 4. Silhouette outline: body interior = m, border = l
    kernel_small = np.ones((3, 3), np.uint8)
    eroded = cv2.erode(binary, kernel_small, iterations=1)
    outline = cv2.subtract(binary, eroded)

    # 5. Build grid
    #  - background → _
    #  - neckline → _
    #  - body interior → m (pattern applied later via stitch_library)
    #  - outline border → l
    neck_cells = _detect_neckline(binary, height, width)
    grid = []
    for y in range(height):
        row = []
        for x in range(width):
            if binary[y][x] == 0:
                row.append('_')
            elif (y, x) in neck_cells:
                row.append('_')
            elif outline[y][x] > 0:
                row.append('l')
            else:
                row.append('m')
        grid.append(row)

    # 6. Denoise
    grid = _denoise_grid_preserve_pattern(grid)

    return grid
