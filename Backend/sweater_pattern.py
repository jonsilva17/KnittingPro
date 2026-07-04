import math
from stitch_patterns import STITCH_PATTERNS


def _tile_pattern(chart, target_w, target_h):
    src_h = len(chart)
    src_w = len(chart[0]) if chart else 1
    result = []
    for y in range(target_h):
        row = []
        src_y = y % src_h
        for x in range(target_w):
            src_x = x % src_w
            row.append(chart[src_y][src_x])
        result.append(row)
    return result


def _center_motif(motif_chart, target_w, target_h, bg_color=0):
    """Place motif centered on a background-colored panel."""
    m_h = len(motif_chart)
    m_w = len(motif_chart[0]) if motif_chart else 0

    scale = min(target_w / max(m_w, 1), target_h / max(m_h, 1))
    if scale < 1:
        m_w = round(m_w * scale)
        m_h = round(m_h * scale)
        scaled = []
        for y in range(m_h):
            row = []
            src_y = round(y / scale) % len(motif_chart)
            for x in range(m_w):
                src_x = round(x / scale) % len(motif_chart[0])
                row.append(motif_chart[src_y][src_x])
            scaled.append(row)
        motif_chart = scaled

    offset_x = (target_w - m_w) // 2
    offset_y = (target_h - m_h) // 2

    result = []
    for y in range(target_h):
        row = []
        for x in range(target_w):
            if offset_y <= y < offset_y + m_h and offset_x <= x < offset_x + m_w:
                row.append(motif_chart[y - offset_y][x - offset_x])
            else:
                row.append(bg_color)
        result.append(row)
    return result


def _stitch_panel(pattern_key, target_w, target_h):
    """Generate a knit/purl stitch pattern panel (0=knit, 1=purl)."""
    if pattern_key not in STITCH_PATTERNS:
        pattern_key = "stockinette"
    p = STITCH_PATTERNS[pattern_key]
    chart = p["chart"]
    pw = p["repeat_w"]
    ph = p["repeat_h"]

    result = []
    for y in range(target_h):
        row = []
        src_row = chart[y % ph]
        for x in range(target_w):
            row.append(src_row[x % pw])
        result.append(row)
    return result


def _calc_shaping(panel_width, panel_height, armhole_cm, neckline, neckline_cm, gauge_rows, gauge_st):
    st_per_cm = gauge_st / 10
    rows_per_cm = gauge_rows / 10

    armhole_height_rows = round(armhole_cm * rows_per_cm)
    armhole_decrease_total = round(panel_width * 0.15)
    armhole_decrease_side = armhole_decrease_total // 2
    armhole_decrease_rate = max(1, armhole_decrease_side // (armhole_height_rows // 4))

    neck_width_st = round(neckline_cm * st_per_cm)
    _NECKLINE_DEPTHS = {"crew": 8, "vneck": 18, "scoop": 12}
    neck_depth_rows = round(_NECKLINE_DEPTHS[neckline] * rows_per_cm)
    shoulder_st = (panel_width - neck_width_st) // 2

    shaping = f"Diminuir {armhole_decrease_side} pts de cada lado a cada 2 carreiras, {armhole_decrease_rate} pt(s) de cada vez, durante {armhole_height_rows} carreiras."

    neck_info = f"Arrematar {neck_width_st} pts centrais. Diminuir 1 pt de cada lado do decote a cada 2 carreiras, {neck_depth_rows} carreiras."
    shoulder_info = f"Restam {shoulder_st} pts para cada ombro."

    return {
        "armhole_decrease": armhole_decrease_side,
        "armhole_rows": armhole_height_rows,
        "neck_center_sts": neck_width_st,
        "neck_depth_rows": neck_depth_rows,
        "shoulder_sts": shoulder_st,
        "instructions": [shaping, neck_info, shoulder_info],
    }


def _stitch_materials_yarn(stitch_chart):
    total = 0
    for row in stitch_chart:
        for val in row:
            total += val
    return total


def generate_sweater_pattern(
    base_chart, base_colors, size, gauge_st, gauge_rows,
    sleeve_style, neckline,
    motif_placement="center",
    sleeve_pattern=None,
    back_pattern=None,
    bg_color_index=0,
):
    """Generate all panels of a sweater pattern.
    
    - front: always uses the image motif (centered or tiled)
    - back: "plain" (stockinette), a stitch pattern key, or "motif" (tiled)
    - sleeves: "motif" (tiled) or a stitch pattern key
    """
    _SIZE_MEASUREMENTS = {
        "S":  {"chest_cm": 86,  "length_cm": 56, "sleeve_cm": 44, "armhole_cm": 18},
        "M":  {"chest_cm": 91,  "length_cm": 58, "sleeve_cm": 45, "armhole_cm": 19},
        "L":  {"chest_cm": 97,  "length_cm": 60, "sleeve_cm": 46, "armhole_cm": 20},
        "XL": {"chest_cm": 102, "length_cm": 62, "sleeve_cm": 47, "armhole_cm": 21},
    }
    m = _SIZE_MEASUREMENTS[size]

    front_w = round(m["chest_cm"] / 2 * gauge_st / 10)
    body_rows = round(m["length_cm"] * gauge_rows / 10)
    front_h = body_rows

    # Front panel — centered motif or tiled
    if motif_placement == "center":
        front_chart = _center_motif(base_chart, front_w, front_h, bg_color_index)
        front_style = "colorwork"
    else:
        front_chart = _tile_pattern(base_chart, front_w, front_h)
        front_style = "colorwork"

    # Back panel
    if back_pattern and back_pattern != "motif":
        back_chart = _stitch_panel(back_pattern, front_w, front_h)
        back_style = "stitch"
        back_pattern_name = STITCH_PATTERNS.get(back_pattern, {}).get("name", back_pattern)
    elif back_pattern == "motif":
        back_chart = _tile_pattern(base_chart, front_w, front_h)
        back_style = "colorwork"
        back_pattern_name = "Motivo"
    else:
        back_chart = _stitch_panel("stockinette", front_w, front_h)
        back_style = "stitch"
        back_pattern_name = "Ponto Meia"

    # Sleeve measurements
    sleeve_cm_width_at_top = m["armhole_cm"] * 2
    sleeve_top_st = round(sleeve_cm_width_at_top * gauge_st / 10)
    sleeve_cuff_cm = 20
    sleeve_cuff_st = round(sleeve_cuff_cm * gauge_st / 10)
    sleeve_len = round(m["sleeve_cm"] * gauge_rows / 10)
    sleeve_increases = (sleeve_top_st - sleeve_cuff_st) // 2
    inc_every = max(1, sleeve_len // (sleeve_increases + 1)) if sleeve_increases > 0 else 999

    # Sleeves
    if sleeve_pattern and sleeve_pattern != "motif":
        sleeve_chart = _stitch_panel(sleeve_pattern, sleeve_top_st, sleeve_len)
        sleeve_style_type = "stitch"
        sleeve_pattern_name = STITCH_PATTERNS.get(sleeve_pattern, {}).get("name", sleeve_pattern)
    else:
        sleeve_chart = _tile_pattern(base_chart, sleeve_top_st, sleeve_len)
        sleeve_style_type = "colorwork"
        sleeve_pattern_name = "Motivo"

    front_shaping = _calc_shaping(front_w, front_h, m["armhole_cm"], neckline, 15, gauge_rows, gauge_st)
    back_shaping = _calc_shaping(front_w, front_h, m["armhole_cm"], "crew", 12, gauge_rows, gauge_st)

    sleeve_notes = f"Aumentar 1 pt de cada lado a cada {inc_every} carreiras ({sleeve_increases} aumentos de cada lado). De {sleeve_cuff_st} pts para {sleeve_top_st} pts."

    # Materials
    bw = front_w
    bh = front_h
    sw = sleeve_top_st
    sh = sleeve_len

    total_materials_grams = max(150, round((bw * bh * 0.3 + bw * bh * 0.3 + sw * sh * 0.3 * 2) * 0.1))
    unique_colors = len(base_colors) if isinstance(base_colors, list) else base_colors

    result = {
        "size": size,
        "motif_placement": motif_placement,
        "gauge": {"stitches_per_10cm": gauge_st, "rows_per_10cm": gauge_rows},
        "measurements": m,
        "front": {
            "chart": front_chart,
            "width_sts": front_w,
            "height_rows": front_h,
            "stitch_count": front_w * front_h,
            "shaping": front_shaping,
            "style": front_style,
        },
        "back": {
            "chart": back_chart,
            "width_sts": front_w,
            "height_rows": front_h,
            "stitch_count": front_w * front_h,
            "shaping": back_shaping,
            "style": back_style,
            "pattern_name": back_pattern_name,
        },
        "sleeve": {
            "chart": sleeve_chart,
            "width_sts": sleeve_top_st,
            "height_rows": sleeve_len,
            "cuff_sts": sleeve_cuff_st,
            "top_sts": sleeve_top_st,
            "increases_every": inc_every,
            "total_increases": sleeve_increases,
            "shaping_notes": sleeve_notes,
            "style": sleeve_style_type,
            "pattern_name": sleeve_pattern_name,
        },
        "materials": {
            "yarn_colors": unique_colors,
            "estimated_yarn_grams": total_materials_grams,
            "needle_size": "3.5mm - 4.5mm",
            "gauge": f"{gauge_st} pts x {gauge_rows} carreiras = 10cm",
            "finished_chest_cm": m["chest_cm"],
            "finished_length_cm": m["length_cm"],
            "finished_sleeve_cm": m["sleeve_cm"],
            "yarn_types": ["Lã merino", "Algodão", "Acrílico"],
            "tools": ["Agulhas de tricô", "Tesoura", "Fita métrica", "Agulha de tapeçaria", "Marcadores"],
        },
        "assembly": [
            "1. Costurar os ombros (left shoulder sts de cada lado).",
            "2. Unir as mangas às cavas (center the sleeve at the shoulder seam).",
            "3. Costurar as laterais do corpo e das mangas.",
            "4. Levantar pontos à volta do decote e fazer o remate (ou gola).",
            "5. Bloquear a peça final para assentar o padrão.",
        ],
    }

    return result
