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


def convert_image_to_stitch_grid(image_data, width, height, threshold=128):
    """Convert an image to a binary knit/purl grid (m=light, l=dark)."""
    img = Image.open(BytesIO(image_data)).convert('L')
    img_resized = img.resize((width, height), Image.LANCZOS)
    pixels = np.array(img_resized)
    grid = []
    for y in range(height):
        row = []
        for x in range(width):
            row.append('m' if pixels[y][x] >= threshold else 'l')
        grid.append(row)
    return grid
