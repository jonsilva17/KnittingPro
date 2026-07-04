from stitch_library import STITCH_LIBRARY, get_all_patterns

STITCH_PATTERNS = {k: {kk: vv for kk, vv in v.items() if kk not in ("category", "difficulty", "tags")} for k, v in STITCH_LIBRARY.items()}

PATTERN_KEYS = sorted(STITCH_PATTERNS.keys())


def generate_stitch_blanket(
    selected_patterns, chart_width, section_rows, border_rows
):
    sections = []
    full_chart = []
    section_breaks = []

    for i, key in enumerate(selected_patterns):
        if key not in STITCH_PATTERNS:
            continue
        pattern = STITCH_PATTERNS[key]
        chart = pattern["chart"]
        pw = pattern["repeat_w"]
        ph = pattern["repeat_h"]

        section = []
        for r in range(section_rows):
            row = []
            src_row = chart[r % ph]
            for c in range(chart_width):
                row.append(src_row[c % pw])
            section.append(row)

        sections.append({
            "key": key,
            "name": pattern["name"],
            "chart": section,
            "width": chart_width,
            "height": section_rows,
            "repeat_w": pw,
            "repeat_h": ph,
        })

        if i > 0:
            section_breaks.append(len(full_chart))

        full_chart.extend(section)

        if border_rows > 0 and i < len(selected_patterns) - 1:
            border = []
            for r in range(border_rows):
                row = []
                for c in range(chart_width):
                    row.append(0)
                border.append(row)
            full_chart.extend(border)

    total_height = len(full_chart)

    border_section = None
    if border_rows > 0:
        border_chart = []
        for r in range(border_rows):
            row = [0] * chart_width
            border_chart.append(row)
        border_section = {
            "name": "Borda",
            "chart": border_chart,
            "height": border_rows,
            "width": chart_width,
        }

    written_instructions = []
    for i, sec in enumerate(sections):
        pattern = STITCH_PATTERNS[sec["key"]]
        p_name = pattern["name"]
        note = pattern.get("note", "")
        chart_repr = pattern["chart"]

        rows_text = []
        for ri, row in enumerate(chart_repr):
            rn = ri + 1
            symbols = []
            for val in row:
                symbols.append("M" if val == 0 else "L")
            row_text = f"Carreira {rn} (dir.): " + ", ".join(symbols)
            rows_text.append(row_text)

        extra = f" Nota: {note}" if note else ""
        written_instructions.append({
            "section": f"Secção {chr(65 + i)}",
            "name": p_name,
            "repeat": f"{sec['repeat_w']} pts x {sec['repeat_h']} carreiras",
            "rows": rows_text,
            "note": note,
        })

    repeats_per_section = section_rows // max(ph, 1) if ph > 0 else 1
    for i, inst in enumerate(written_instructions):
        inst["repeat_count"] = repeats_per_section

    result = {
        "sections": sections,
        "border": border_section,
        "full_chart": full_chart,
        "total_width": chart_width,
        "total_height": total_height,
        "section_breaks": section_breaks,
        "written_instructions": written_instructions,
        "patterns_used": [
            {"key": k, "name": STITCH_PATTERNS[k]["name"]}
            for k in selected_patterns
        ],
    }

    return result
