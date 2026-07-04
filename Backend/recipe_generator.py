from stitch_library import STITCH_LIBRARY, CATEGORIES

def _map_chart_to_symbols(chart):
    return [[0 if c == 'm' else 1 for c in row] for row in chart]

def _detect_pattern(grid):
    if not grid or len(grid) == 0 or len(grid[0]) == 0:
        return None
    h = len(grid)
    w = len(grid[0])
    symbol_grid = _map_chart_to_symbols(grid)
    best_match = None
    best_score = 0
    for pid, pdata in STITCH_LIBRARY.items():
        chart = pdata.get("chart", [])
        if not chart:
            continue
        pw = pdata.get("repeat_w", len(chart[0]))
        ph = pdata.get("repeat_h", len(chart))
        if pw > w or ph > h:
            continue
        matches = 0
        total = 0
        for r in range(min(h, ph * 3)):
            for c in range(min(w, pw * 3)):
                sr = r % ph
                sc = c % pw
                if r < len(symbol_grid) and c < len(symbol_grid[r]):
                    if sr < len(chart) and sc < len(chart[sr]):
                        if symbol_grid[r][c] == chart[sr][sc]:
                            matches += 1
                        total += 1
        if total == 0:
            continue
        score = matches / total
        if score > best_score:
            best_score = score
            best_match = pid
    if best_score >= 0.85:
        return best_match
    return None

def _needle_recommendation(gauge_st):
    if gauge_st >= 28:
        return "2.5mm - 3.5mm"
    elif gauge_st >= 24:
        return "3.5mm - 4.5mm"
    elif gauge_st >= 20:
        return "4.5mm - 5.5mm"
    elif gauge_st >= 16:
        return "5.5mm - 6.5mm"
    else:
        return "6.5mm - 8.0mm"

def _yarn_estimate(total_stitches, total_rows, gauge_st, gauge_rows, garment_type):
    area_cm2 = (total_stitches / (gauge_st / 10)) * (total_rows / (gauge_rows / 10))
    factors = {"sweater": 0.08, "jacket": 0.09, "pants": 0.07, "socks": 0.03, "toy": 0.04}
    factor = factors.get(garment_type, 0.06)
    meters = area_cm2 * factor
    return max(50, round(meters / 50) * 50)

def _count_active(grid):
    """Count non-'_' cells per row. Returns list of (row, count)."""
    counts = []
    for r, row in enumerate(grid):
        cnt = sum(1 for cell in row if cell != '_')
        counts.append((r, cnt))
    return counts

SECTION_NAMES = {
    "front": "Frente", "back": "Costas", "sleeve": "Manga",
    "leg": "Perna", "foot": "Pé", "front_left": "Frente Esq.",
    "front_right": "Frente Dir.", "body": "Corpo",
}

def _calc_stitches(cm, gauge_per_10):
    """Calculate number of stitches for a given cm width."""
    return max(1, round(cm * gauge_per_10 / 10))

def _calc_rows(cm, rows_per_10):
    """Calculate number of rows for a given cm height."""
    return max(1, round(cm * rows_per_10 / 10))

def _fmt_armhole(chest_st, gauge_st):
    """Generate armhole bind-off and decrease instructions."""
    bind_off = max(2, round(chest_st * 0.06))
    dec_times = max(1, round(chest_st * 0.03))
    return bind_off, dec_times

def _fmt_neck(chest_st):
    neck_st = max(4, round(chest_st * 0.30))
    shoulder_st = max(2, round((chest_st - neck_st) / 2))
    return neck_st, shoulder_st

GARMENT_TEMPLATES = {
    "sweater": {
        "label": "CAMISOLA",
        "sections": ["back", "front", "sleeve"],
        "section_labels": ["Costas", "Frente", "Mangas (fazer 2)"],
        "description": (
            "Camisola tricotada de baixo para cima em partes separadas, com cavas e decote em V (ou reto). "
            "Montagem final com costuras laterais e de ombros."
        ),
    },
    "pants": {
        "label": "CALÇAS",
        "sections": ["front", "back", "leg"],
        "section_labels": ["Frente", "Costas", "Pernas (fazer 2)"],
        "description": (
            "Calças tricotadas de baixo para cima, em partes separadas (frente e costas) ou em circular. "
            "Entrepernas unidas com costura."
        ),
    },
    "jacket": {
        "label": "CASACO",
        "sections": ["back", "front_left", "front_right", "sleeve"],
        "section_labels": ["Costas", "Frente Esquerda", "Frente Direita", "Mangas (fazer 2)"],
        "description": (
            "Casaco tricotado em partes separadas, com abertura frontal. "
            "Pode incluir bolsos e botões."
        ),
    },
    "toy": {
        "label": "BRINQUEDO",
        "sections": ["body", "limb"],
        "section_labels": ["Corpo", "Braços/Pernas"],
        "description": (
            "Brinquedo tricotado em partes separadas e montado. "
            "Utilizar enchimento de fibra poliéster."
        ),
    },
    "socks": {
        "label": "MEIAS",
        "sections": ["leg", "foot"],
        "section_labels": ["Caninho", "Pé"],
        "description": (
            "Meias tricotadas de cima para baixo em circular, com reforço no calcanhar. "
            "Utilizar agulhas de pontas duplas ou mágic loop."
        ),
    },
}

def _generate_narrative_recipe(sections, garment_type, gauge_st, gauge_rows, is_circular, measurements):
    """Generate a full narrative recipe text."""
    gauge_text = f"{gauge_st} pts × {gauge_rows} carr = 10 cm"
    needle = _needle_recommendation(gauge_st)

    template = GARMENT_TEMPLATES.get(garment_type, GARMENT_TEMPLATES["sweater"])
    lines = []
    lines.append(f"RECEITA: {template['label']}")
    lines.append("=" * 40)
    lines.append(f"Amostra: {gauge_text}")
    lines.append(f"Agulhas recomendadas: {needle}")
    if is_circular:
        lines.append("Tricotado em redondo (circular).")
    lines.append("")

    chest_cm = None
    length_cm = None
    sleeve_cm = None
    if measurements:
        chest_cm = measurements.get("chest_cm")
        length_cm = measurements.get("length_cm")
        sleeve_cm = measurements.get("sleeve_cm")

    if chest_cm or length_cm or sleeve_cm:
        lines.append("MEDIDAS:")
        if chest_cm:
            lines.append(f"  Peito (total): {chest_cm} cm  |  Meio peito: {chest_cm / 2:.0f} cm")
        if length_cm:
            lines.append(f"  Comprimento: {length_cm} cm")
        if sleeve_cm:
            lines.append(f"  Manga: {sleeve_cm} cm")
        lines.append("")

    lines.append("MATERIAL:")
    lines.append(f"  Lã necessária: ~[calcular] metros")
    lines.append("")
    lines.append("INSTRUÇÕES:")
    lines.append("-" * 40)

    total_sts = 0
    total_rows = 0
    section_texts = []

    for sec in sections:
        grid = sec.get("grid", [])
        if not grid or len(grid) == 0:
            continue

        name = sec.get("name", "")
        label = SECTION_NAMES.get(name, name)
        h = len(grid)
        w = len(grid[0]) if len(grid) > 0 else 0
        has_content = any(cell != '_' for row in grid for cell in row)
        if not has_content:
            continue

        incs = sec.get("increases", [])
        decs = sec.get("decreases", [])

        chosen_pid = sec.get("chosen_pattern", None)
        pattern_name = None
        if chosen_pid and chosen_pid in STITCH_LIBRARY:
            pattern_name = STITCH_LIBRARY[chosen_pid]["name"]
        if not pattern_name:
            detected = _detect_pattern(grid)
            if detected and detected in STITCH_LIBRARY:
                pattern_name = STITCH_LIBRARY[detected]["name"]

        first_row_sts = sum(1 for c in grid[0] if c != '_')
        last_row_sts = sum(1 for c in grid[-1] if c != '_')
        row_counts = _count_active(grid)

        sec_lines = []
        sec_lines.append(f"\n  {label}:")
        sec_lines.append(f"  Montar {first_row_sts} pontos.")
        sec_lines.append(f"  Total: {h} carreiras.")

        if is_circular and name == "body":
            sec_lines.append("  Unir em redondo sem torcer. Colocar marcador de início de carreira.")

        pattern_text = pattern_name or "gráfico personalizado"
        sec_lines.append(f"  Carreira 1 a {h}: Seguir o {pattern_text}.")

        inc_by_row = {}
        for inc in incs:
            r = inc.get("r", 0)
            inc_by_row.setdefault(r + 1, 0)
            inc_by_row[r + 1] += 1
        dec_by_row = {}
        for dec in decs:
            r = dec.get("r", 0)
            dec_by_row.setdefault(r + 1, 0)
            dec_by_row[r + 1] += 1

        # Auto-detect changes from shape mask (row-to-row width change)
        auto_changes = {}
        for r in range(1, len(row_counts)):
            prev = row_counts[r - 1][1]
            curr = row_counts[r][1]
            diff = curr - prev
            if diff > 0:
                auto_changes[r + 1] = f"Aumentar {diff} pontos"
            elif diff < 0:
                auto_changes[r + 1] = f"Diminuir {abs(diff)} pontos"

        # Merge manual inc/dec with auto-detected changes
        shown_rows = sorted(set(
            list(inc_by_row.keys()) +
            list(dec_by_row.keys()) +
            list(auto_changes.keys())
        ))
        for row_num in shown_rows:
            parts = []
            if row_num in inc_by_row:
                parts.append(f"Aumentar {inc_by_row[row_num]} ponto(s) (1M no início e 1M no fim)")
            if row_num in dec_by_row:
                parts.append(f"Diminuir {dec_by_row[row_num]} ponto(s) (2pM)")
            if row_num in auto_changes and row_num not in inc_by_row and row_num not in dec_by_row:
                parts.append(auto_changes[row_num])
            if parts:
                sec_lines.append(f"  Carreira {row_num}: {'; '.join(parts)}.")

        total_auto_inc = sum(1 for k, v in auto_changes.items() if 'Aumentar' in v)
        total_auto_dec = sum(1 for k, v in auto_changes.items() if 'Diminuir' in v)
        sec_lines.append(f"  Resumo: {h} carreiras | {first_row_sts} pts montar → {last_row_sts} pts rematar | {total_auto_inc + len(incs)} aumentos, {total_auto_dec + len(decs)} diminuições.")

        total_sts = max(total_sts, last_row_sts)
        total_rows += h
        section_texts.extend(sec_lines)

    # If no real grid content, generate template based on measurements
    if not section_texts and measurements:
        section_texts = _generate_template_sections(garment_type, gauge_st, gauge_rows, measurements, is_circular)

    lines.extend(section_texts)

    if not is_circular:
        lines.append("\n")
        lines.append("MONTAGEM:")
        lines.append("-" * 40)
        if garment_type == "sweater":
            lines.append(" 1. Coser os ombros (cerca de 1/3 da largura total de cada lado).")
            lines.append(" 2. Fechar as laterais do corpo (costas + frente).")
            lines.append(" 3. Montar e coser as mangas às cavas.")
            lines.append(" 4. Rematar todos os fios soltos.")
            lines.append(" 5. Bloquear a peça com vapor (opcional).")
        elif garment_type == "pants":
            lines.append(" 1. Coser a entreperna (frente a costas).")
            lines.append(" 2. Fechar as laterais de cada perna.")
            lines.append(" 3. Dobrar o cós e coser para passar o elástico (se desejado).")
            lines.append(" 4. Rematar todos os fios soltos.")
        elif garment_type == "jacket":
            lines.append(" 1. Coser os ombros das frentes às costas.")
            lines.append(" 2. Fechar as laterais.")
            lines.append(" 3. Montar e coser as mangas.")
            lines.append(" 4. Levantar pontos na orla frontal para a carcela de botões.")
            lines.append(" 5. Rematar todos os fios soltos.")

    if chest_cm and total_stitches > 0:
        yarn = _yarn_estimate(total_sts, total_rows, gauge_st, gauge_rows, garment_type)
        lines = [line.replace("~[calcular]", f"~{yarn}") for line in lines]

    return "\n".join(lines)


def _generate_template_sections(garment_type, gauge_st, gauge_rows, measurements, is_circular):
    """Generate full section instructions from measurements alone (no grid).
    chest_cm = width of front piece (half-chest)."""
    chest_cm = measurements.get("chest_cm", 50)
    length_cm = measurements.get("length_cm", 40)
    sleeve_cm = measurements.get("sleeve_cm", 35)

    lines = []

    if garment_type in ("sweater", "jacket"):
        half_chest_st = _calc_stitches(chest_cm, gauge_st)
        body_rows = _calc_rows(length_cm, gauge_rows)
        sleeve_st = _calc_stitches(round(chest_cm * 0.8), gauge_st)
        sleeve_rows = _calc_rows(sleeve_cm, gauge_rows)
        wrist_st = _calc_stitches(round(chest_cm * 0.5), gauge_st)
        armhole_depth = _calc_stitches(round(length_cm * 0.18), gauge_st)
        armhole_rows = _calc_rows(round(length_cm * 0.18), gauge_rows)
        neck_st = _calc_stitches(round(chest_cm * 0.30), gauge_st)
        shoulder_st = round((half_chest_st - neck_st) / 2)
        bind_off, dec_times = _fmt_armhole(half_chest_st, gauge_st)

        # Back
        lines.append(f"\n  Costas:")
        lines.append(f"  Montar {half_chest_st} pontos.")
        lines.append(f"  Tricotar em ponto meia durante {body_rows - armhole_rows} carreiras (ou até às cavas).")
        lines.append(f"  Cavas: Arrematar {bind_off} pts no início das próximas 2 carreiras.")
        lines.append(f"  Diminuir 1 pt de cada lado a cada 2 carreiras durante {dec_times * 2} carreiras ({dec_times} vezes de cada lado).")

        if garment_type == "sweater":
            neck_rows = max(4, round(armhole_rows * 0.6))
            lines.append(f"  Decote: A {armhole_rows} carreiras das cavas, arrematar os {neck_st} pts centrais.")
            lines.append(f"  Continuar cada lado separadamente, arrematando 2 pts no lado do decote a cada 2 carreiras.")
            lines.append(f"  Restam {shoulder_st} pts para cada ombro. Arrematar.")
        lines.append(f"  Costas — {body_rows} carreiras no total.")

        # Front
        lines.append(f"\n  Frente:")
        lines.append(f"  Montar {half_chest_st} pontos.")
        lines.append(f"  Tricotar em ponto meia durante {body_rows - armhole_rows} carreiras.")
        lines.append(f"  Cavas: Arrematar {bind_off} pts no início das próximas 2 carreiras.")
        lines.append(f"  Diminuir 1 pt de cada lado a cada 2 carreiras durante {dec_times * 2} carreiras.")

        if garment_type == "sweater":
            lines.append(f"  Decote: A {round(armhole_rows * 0.4)} carreiras das cavas, arrematar os {neck_st} pts centrais.")
            lines.append(f"  Continuar cada lado separadamente, arrematando 2-1-1 pts no lado do decote.")
            lines.append(f"  Restam {shoulder_st} pts para cada ombro. Arrematar.")
        lines.append(f"  Frente — {body_rows} carreiras no total.")

        # Sleeves
        lines.append(f"\n  Mangas (fazer 2):")
        lines.append(f"  Montar {wrist_st} pontos.")
        inc_interval = max(2, round(sleeve_rows / max(1, sleeve_st - wrist_st)))
        lines.append(f"  Aumentar 1 pt de cada lado a cada {inc_interval} carreiras até obter {sleeve_st} pontos.")
        lines.append(f"  Tricotar reto até {sleeve_rows} carreiras no total.")
        lines.append(f"  Arrematar sem apertar.")
        lines.append(f"  Manga — {sleeve_rows} carreiras, {sleeve_st} pts no final.")

    elif garment_type == "pants":
        half_waist_st = _calc_stitches(half_chest, gauge_st)
        leg_length_rows = _calc_rows(length_cm, gauge_rows)
        ankle_st = _calc_stitches(round(half_chest * 0.5), gauge_st)

        lines.append(f"\n  Frente (×1):")
        lines.append(f"  Montar {half_waist_st} pontos.")
        lines.append(f"  Tricotar em canelado 2/2 durante 10 carreiras.")
        lines.append(f"  Seguir em ponto meia. Aumentar 1 pt de cada lado a cada 10 carreiras até ao fim.")
        lines.append(f"  A {leg_length_rows} carreiras, separar para as pernas.")
        lines.append(f"  Arrematar.")

        lines.append(f"\n  Costas (×1):")
        lines.append(f"  Montar {half_waist_st} pontos.")
        lines.append(f"  Tricotar em canelado 2/2 durante 10 carreiras.")
        lines.append(f"  Seguir em ponto meia, aumentando como na frente.")
        lines.append(f"  Nos últimos 10 carreiras, aumentar 2 pts de cada lado para o cós.")
        lines.append(f"  Arrematar.")

    return lines


def generate_recipe(sections, garment_type, gauge_st, gauge_rows, is_circular=False, measurements=None):
    recipe_text = _generate_narrative_recipe(sections, garment_type, gauge_st, gauge_rows, is_circular, measurements)

    gauge_text = f"{gauge_st} pts x {gauge_rows} carr = 10 cm"
    needle = _needle_recommendation(gauge_st)
    total_sts = 0
    total_rows = 0
    section_instructions = []

    for sec in sections:
        grid = sec.get("grid", [])
        if not grid or len(grid) == 0:
            continue
        name = sec.get("name", "")
        label = SECTION_NAMES.get(name, name)
        incs = sec.get("increases", [])
        decs = sec.get("decreases", [])
        chosen_pid = sec.get("chosen_pattern", None)
        pattern_name = None
        if chosen_pid and chosen_pid in STITCH_LIBRARY:
            pattern_name = STITCH_LIBRARY[chosen_pid]["name"]
        if not pattern_name:
            detected = _detect_pattern(grid)
            if detected and detected in STITCH_LIBRARY:
                pattern_name = STITCH_LIBRARY[detected]["name"]

        has_content = any(cell != '_' for row in grid for cell in row)
        if not has_content:
            continue

        row_counts = [sum(1 for cell in row if cell != '_') for row in grid]
        first_row = row_counts[0] if row_counts else 0
        max_row = max(row_counts) if row_counts else first_row
        last_count = row_counts[-1] if row_counts else first_row
        h = len(grid)

        lines = []
        lines.append(f"--- {label} ---")
        lines.append(f"Montar {first_row} pontos em agulhas {needle}.")
        if is_circular:
            lines.append("Tricotar em redondo.")

        pattern_text = pattern_name or "gráfico personalizado"
        lines.append(f"Carreira 1 a {h}: Seguir o {pattern_text}.")

        inc_by_row = {}
        for inc in incs:
            r = inc.get("r", 0)
            inc_by_row.setdefault(r + 1, 0)
            inc_by_row[r + 1] += 1
        dec_by_row = {}
        for dec in decs:
            r = dec.get("r", 0)
            dec_by_row.setdefault(r + 1, 0)
            dec_by_row[r + 1] += 1

        changes = {}
        for r in range(1, len(row_counts)):
            prev = row_counts[r - 1]
            curr = row_counts[r]
            diff = curr - prev
            if diff > 0:
                changes[r + 1] = f"Aumentar {diff} pontos (início/fim da carreira)"
            elif diff < 0:
                changes[r + 1] = f"Diminuir {abs(diff)} pontos (2pM no início/fim)"

        for row_num in sorted(set(list(inc_by_row.keys()) + list(dec_by_row.keys()) + list(changes.keys()))):
            if row_num in inc_by_row:
                lines.append(f"Carreira {row_num}: Aumentar {inc_by_row[row_num]} ponto(s).")
            if row_num in dec_by_row:
                lines.append(f"Carreira {row_num}: Diminuir {dec_by_row[row_num]} ponto(s) (2pM).")
            if row_num in changes and row_num not in inc_by_row and row_num not in dec_by_row:
                lines.append(f"Carreira {row_num}: {changes[row_num]}.")

        if last_count < first_row:
            lines.append(f"Rematar os {last_count} pontos.")
        elif last_count > first_row:
            lines.append(f"Rematar com {last_count} pontos.")
        else:
            lines.append(f"Rematar todos os {last_count} pontos.")

        total_sts += max_row
        total_rows += h
        section_instructions.append({
            "label": label,
            "instructions": lines,
            "stitches": max_row,
            "rows": h,
            "increases": len(incs),
            "decreases": len(decs),
            "detected_pattern": pattern_name,
        })

    total_yarn = _yarn_estimate(total_sts, total_rows, gauge_st, gauge_rows, garment_type)

    return {
        "recipe_text": recipe_text,
        "needle": needle,
        "gauge": gauge_text,
        "yarn_estimate": f"{total_yarn}m (aproximadamente)",
        "section_instructions": section_instructions,
        "total_stitches": total_sts,
        "total_rows": total_rows,
    }
