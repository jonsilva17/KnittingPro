import os
from PIL import Image, ImageDraw
from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm, mm
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas
import base64
from io import BytesIO

# Cores globais para os gráficos de Jacquard
YARN_COLORS = [
    {"name": "Branco", "hex": "#FFFFFF"},
    {"name": "Preto", "hex": "#1A1A1A"},
    {"name": "Vermelho", "hex": "#CC0000"},
    {"name": "Azul Escuro", "hex": "#003366"},
    {"name": "Azul Claro", "hex": "#6699CC"},
    {"name": "Verde Escuro", "hex": "#006600"},
    {"name": "Verde Claro", "hex": "#66CC66"},
    {"name": "Amarelo", "hex": "#FFCC00"},
    {"name": "Laranja", "hex": "#FF6600"},
    {"name": "Roxo", "hex": "#660099"},
    {"name": "Rosa", "hex": "#FF6699"},
    {"name": "Castanho", "hex": "#663300"},
    {"name": "Cinzento Claro", "hex": "#CCCCCC"},
    {"name": "Cinzento Escuro", "hex": "#666666"},
    {"name": "Bege", "hex": "#F5E6CC"},
    {"name": "Marinho", "hex": "#000033"},
]

WIDTH, HEIGHT = A4
MARGIN = 2 * cm


def draw_chart(c, chart, colors, start_x, start_y, cell_size=8):
    """Desenha o gráfico quadriculado de cores (Jacquard)."""
    for y, row in enumerate(chart):
        for x, color_idx in enumerate(row):
            if color_idx < len(YARN_COLORS):
                color_hex = YARN_COLORS[color_idx]["hex"]
            else:
                color_hex = "#FFFFFF"  # Cor de salvaguarda caso o índice falhe
            c.setFillColor(HexColor(color_hex))
            c.setStrokeColor(HexColor("#CCCCCC"))
            c.setLineWidth(0.3)
            c.rect(
                start_x + x * cell_size,
                start_y - y * cell_size,
                cell_size,
                cell_size,
                fill=1,
                stroke=1,
            )


def draw_color_key(c, colors, x, y):
    """Desenha a legenda de cores abaixo do gráfico."""
    c.setFont("Helvetica-Bold", 10)
    c.setFillColor(HexColor("#333333"))
    c.drawString(x, y, "Cores:")
    y -= 5

    for i, color in enumerate(colors):
        col = i % 2
        row = i // 2
        cx = x + col * 90
        cy = y - row * 22

        c.setFillColor(HexColor(color["hex"]))
        c.setStrokeColor(HexColor("#333333"))
        c.setLineWidth(0.5)
        c.rect(cx, cy - 10, 12, 12, fill=1, stroke=1)

        c.setFillColor(HexColor("#000000"))
        c.setFont("Helvetica", 8)
        c.drawString(cx + 16, cy - 8, f"{color['name']}")


def draw_bw_chart(c, chart, start_x, start_y, cell_size=8):
    """Desenha gráfico a preto e branco com símbolos: □ fundo, ○ ponto do padrão."""
    if not chart:
        return
    flat = [cell for row in chart for cell in row]
    bg_color = max(set(flat), key=flat.count) if flat else 0
    for y, row in enumerate(chart):
        for x, color_idx in enumerate(row):
            px = start_x + x * cell_size
            py = start_y - y * cell_size
            c.setStrokeColor(HexColor("#CCCCCC"))
            c.setLineWidth(0.3)
            c.rect(px, py, cell_size, cell_size, fill=0, stroke=1)
            if color_idx != bg_color:
                cx = px + cell_size / 2
                cy = py + cell_size / 2
                r = cell_size * 0.3
                c.setLineWidth(0.5)
                c.setStrokeColor(HexColor("#222222"))
                c.circle(cx, cy, r, fill=0, stroke=1)


def _draw_panel_chart(c, panel, colors, x, y, cell_sz, label):
    """Desenha o gráfico do painel (seja ele de pontos ou de coreswork)."""
    chart = panel.get("chart", [])
    ch = len(chart)
    cw = len(chart[0]) if chart else 0

    if panel.get("style") == "stitch":
        for yi, row in enumerate(chart):
            for xi, val in enumerate(row):
                px = x + xi * cell_sz
                py = y - yi * cell_sz
                c.setFillColor(HexColor("#FFFFFF"))
                c.setStrokeColor(HexColor("#CCCCCC"))
                c.setLineWidth(0.3)
                c.rect(px, py, cell_sz, cell_sz, fill=1, stroke=1)
                is_purl = val == 1
                c.setStrokeColor(HexColor("#333333"))
                c.setLineWidth(0.8)
                if is_purl:
                    cy2 = py + cell_sz * 0.5
                    c.line(px + 2, cy2, px + cell_sz - 2, cy2)
                else:
                    cx2 = px + cell_sz * 0.5
                    c.line(cx2, py + 2, cx2, py + cell_sz - 2)

        leg_y = y - ch * cell_sz - 15
        c.setFont("Helvetica", 8)
        c.setFillColor(HexColor("#666666"))
        c.setStrokeColor(HexColor("#333333"))
        c.setLineWidth(0.8)
        c.line(MARGIN + 5, leg_y + 2, MARGIN + 13, leg_y + 2)
        c.drawString(MARGIN + 16, leg_y - 2, "= Meia")
        cx_mid = MARGIN + 70
        c.line(cx_mid + 5, leg_y - 5, cx_mid + 5, leg_y + 2)
        c.drawString(cx_mid + 10, leg_y - 2, "= Liga")
        if panel.get("pattern_name"):
            c.setFont("Helvetica-Bold", 8)
            c.setFillColor(HexColor("#333333"))
            c.drawString(
                cx_mid + 65, leg_y - 2, f"Padrão: {panel['pattern_name']}"
            )
    else:
        draw_chart(c, chart, colors, x, y, cell_sz)
        if colors:
            leg_y = y - ch * cell_sz - 15
            c.setFont("Helvetica", 8)
            c.setFillColor(HexColor("#666666"))
            c.drawString(
                MARGIN, leg_y, f"Cada quadrado = 1 ponto na cor indicada"
            )


# =========================================================================
# DOCUMENTO 1: PADRÃO DE TRICÔ (Jacquard / Imagem)
# =========================================================================
def generate_pattern_pdf(result, output_path, original_image_path=None):
    c = canvas.Canvas(output_path, pagesize=A4)

    chart = result["chart"]
    chart_h = len(chart)
    chart_w = len(chart[0]) if chart else 0
    colors = result.get("colors", [])
    materials = result.get("materials", {})

    # === PAGE 1: COVER ===
    c.setFillColor(HexColor("#333333"))
    c.setFont("Helvetica-Bold", 26)
    c.drawString(MARGIN, HEIGHT - MARGIN, "Padrão de Tricô")
    c.setFont("Helvetica", 13)
    c.setFillColor(HexColor("#6B4F8A"))
    c.drawString(MARGIN, HEIGHT - MARGIN - 24, "Pointy Lines")
    c.setStrokeColor(HexColor("#6B4F8A"))
    c.line(MARGIN, HEIGHT - MARGIN - 34, WIDTH - MARGIN, HEIGHT - MARGIN - 34)

    if original_image_path and os.path.exists(original_image_path):
        try:
            img = ImageReader(original_image_path)
            iw, ih = img.getSize()
            mw = WIDTH - 2 * MARGIN
            mh = HEIGHT * 0.48
            s = min(mw / iw, mh / ih)
            dw, dh = iw * s, ih * s
            ix = MARGIN + (mw - dw) / 2
            iy = HEIGHT * 0.62 - dh
            c.drawImage(img, ix, iy, dw, dh)
            c.setStrokeColor(HexColor("#CCCCCC"))
            c.setLineWidth(0.5)
            c.rect(ix - 2, iy - 2, dw + 4, dh + 4, fill=0, stroke=1)
        except Exception:
            pass

    y = HEIGHT * 0.25
    c.setFont("Helvetica", 11)
    c.setFillColor(HexColor("#333333"))
    info_lines = [
        f"Gráfico: {chart_w} pts x {chart_h} carreiras",
        f"Cores: {len(colors)}",
        f"Tamanho final: {materials.get('finished_size_cm', 'N/A')}",
    ]
    for line in info_lines:
        c.drawString(MARGIN, y, line)
        y -= 16

    c.setFont("Helvetica", 9)
    c.setFillColor(HexColor("#888888"))
    c.drawString(MARGIN, y - 10, "Veja nas páginas seguintes: gráfico P&B, gráfico a cores e instruções.")

    # === PAGE 2: B&W CHART ===
    c.showPage()
    c.setFont("Helvetica-Bold", 18)
    c.setFillColor(HexColor("#333333"))
    c.drawString(MARGIN, HEIGHT - MARGIN, "Gráfico Preto e Branco")
    c.setFont("Helvetica", 9)
    c.setFillColor(HexColor("#666666"))
    c.drawString(MARGIN, HEIGHT - MARGIN - 18, "○ = ponto do padrão  |  □ = fundo (meia)")
    c.line(MARGIN, HEIGHT - MARGIN - 28, WIDTH - MARGIN, HEIGHT - MARGIN - 28)

    mw_bw = WIDTH - 2 * MARGIN
    mh_bw = HEIGHT - 2 * MARGIN - 100
    cs_bw = min(mw_bw // max(chart_w, 1), mh_bw // max(chart_h, 1), 10)
    cs_bw = max(cs_bw, 3)

    cx_bw = MARGIN + (mw_bw - chart_w * cs_bw) / 2
    cy_bw = HEIGHT - MARGIN - 45
    draw_bw_chart(c, chart, cx_bw, cy_bw, cs_bw)

    info_y = cy_bw - chart_h * cs_bw - 15
    c.setFont("Helvetica", 8)
    c.setFillColor(HexColor("#666666"))
    c.drawString(MARGIN, info_y, f"{chart_w} pts x {chart_h} carr  |  Cada quadrado = 1 ponto")
    if colors:
        c.drawString(MARGIN, info_y - 12, "Consulte o gráfico a cores na pág. seguinte para referência.")

    # === PAGE 3: COLOR CHART ===
    c.showPage()
    c.setFont("Helvetica-Bold", 18)
    c.setFillColor(HexColor("#333333"))
    c.drawString(MARGIN, HEIGHT - MARGIN, "Gráfico a Cores")
    c.setFont("Helvetica", 9)
    c.setFillColor(HexColor("#666666"))
    c.drawString(MARGIN, HEIGHT - MARGIN - 18, "Referência de cores para o padrão")
    c.line(MARGIN, HEIGHT - MARGIN - 28, WIDTH - MARGIN, HEIGHT - MARGIN - 28)

    mw_c = WIDTH - 2 * MARGIN
    mh_c = HEIGHT - 2 * MARGIN - 140
    cs_c = min(mw_c // max(chart_w, 1), mh_c // max(chart_h, 1), 10)
    cs_c = max(cs_c, 3)

    cx_c = MARGIN + (mw_c - chart_w * cs_c) / 2
    cy_c = HEIGHT - MARGIN - 50

    draw_chart(c, chart, colors, cx_c, cy_c, cs_c)

    info_y2 = cy_c - chart_h * cs_c - 15
    c.setFont("Helvetica", 8)
    c.setFillColor(HexColor("#666666"))
    c.drawString(MARGIN, info_y2, f"{chart_w} pts x {chart_h} carr  |  Cada quadrado = 1 ponto na cor indicada")

    if colors:
        draw_color_key(c, colors, MARGIN, info_y2 - 30)

    # === PAGE 4: MATERIALS + INSTRUCTIONS ===
    c.showPage()
    c.setFont("Helvetica-Bold", 20)
    c.setFillColor(HexColor("#333333"))
    c.drawString(MARGIN, HEIGHT - MARGIN, "Materiais e Instruções")
    c.line(MARGIN, HEIGHT - MARGIN - 25, WIDTH - MARGIN, HEIGHT - MARGIN - 25)

    y = HEIGHT - MARGIN - 50
    c.setFont("Helvetica-Bold", 14)
    c.drawString(MARGIN, y, "Materiais Necessários")
    y -= 25
    c.setFont("Helvetica", 10)
    for key, value in materials.items():
        if isinstance(value, list):
            c.drawString(MARGIN + 10, y, f"• {key.replace('_', ' ').title()}:")
            y -= 15
            for item in value:
                c.drawString(MARGIN + 25, y, f"  - {item}")
                y -= 15
        else:
            label = key.replace("_", " ").title()
            c.drawString(MARGIN + 10, y, f"• {label}: {value}")
            y -= 18

    y -= 10
    c.line(MARGIN, y, WIDTH - MARGIN, y)
    y -= 20

    c.setFont("Helvetica-Bold", 14)
    c.drawString(MARGIN, y, "Instruções de Tricô")
    y -= 25
    c.setFont("Helvetica", 10)
    instructions = [
        f"1. Monte {chart_w} pontos na agulha.",
        f"2. Siga o gráfico P&B (pág. 2) ou o gráfico a cores (pág. 3).",
        "3. Cada quadrado representa 1 ponto.",
        "4. Use a técnica de jacquard (fair isle) para padrões multicolor.",
        "5. Ao mudar de cor, cruze os fios pelo avesso para evitar buracos.",
        "6. Mantenha a tensão constante para um acabamento profissional.",
        "7. Remate todos os pontos no final.",
        "8. Bloqueie a peça para assentar o padrão e uniformizar os pontos.",
        f"Tamanho final aprox.: {materials.get('finished_size_cm', 'N/A')}",
    ]
    for instr in instructions:
        c.drawString(MARGIN + 10, y, instr)
        y -= 16

    y -= 10
    c.line(MARGIN, y, WIDTH - MARGIN, y)
    y -= 20
    c.setFont("Helvetica-Bold", 14)
    c.drawString(MARGIN, y, "Dicas")
    y -= 20
    c.setFont("Helvetica", 10)
    tips = [
        "• Use marcadores para não perder a contagem de carreiras.",
        "• Para gráficos grandes, fotocopie e risque as carreiras já feitas.",
        "• Lave a peça com água fria e sabão neutro para lã.",
        "• Seque na horizontal para manter a forma.",
    ]
    for tip in tips:
        c.drawString(MARGIN + 10, y, tip)
        y -= 16

    # === PAGE 5: FOOTER ===
    c.showPage()
    c.setFont("Helvetica", 8)
    c.setFillColor(HexColor("#999999"))
    c.drawString(MARGIN, HEIGHT - MARGIN, "Pointy Lines App")
    c.drawString(MARGIN, HEIGHT - MARGIN - 12, "Todas as medidas são aproximadas. Ajuste conforme necessário.")

    c.save()


# =========================================================================
# DOCUMENTO 2: MANTA DE PONTOS
# =========================================================================
def generate_stitch_blanket_pdf(blanket, output_path):
    c = canvas.Canvas(output_path, pagesize=A4)

    # === PAGINA 1: Título e Gráfico ===
    c.setFillColor(HexColor("#333333"))
    c.setFont("Helvetica-Bold", 22)
    c.drawString(MARGIN, HEIGHT - MARGIN, "Manta de Pontos")
    c.setFont("Helvetica", 11)
    c.drawString(
        MARGIN,
        HEIGHT - MARGIN - 18,
        f"{blanket['total_width']} pontos x {blanket['total_height']} carreiras",
    )
    c.line(MARGIN, HEIGHT - MARGIN - 28, WIDTH - MARGIN, HEIGHT - MARGIN - 28)

    full_chart = blanket["full_chart"]
    ch = len(full_chart)
    cw = len(full_chart[0]) if full_chart else 0

    mw = WIDTH - 2 * MARGIN
    mh = HEIGHT - 2 * MARGIN - 120
    cs = min(mw // max(cw, 1), mh // max(ch, 1), 6)
    cs = max(cs, 2)

    cx = MARGIN + (mw - cw * cs) / 2
    cy = HEIGHT - MARGIN - 50

    for y, row in enumerate(full_chart):
        for x, val in enumerate(row):
            is_purl = val == 1
            px = cx + x * cs
            py = cy - y * cs

            c.setFillColor(HexColor("#FFFFFF"))
            c.setStrokeColor(HexColor("#CCCCCC"))
            c.setLineWidth(0.3)
            c.rect(px, py, cs, cs, fill=1, stroke=1)

            if is_purl:
                c.setStrokeColor(HexColor("#333333"))
                c.setLineWidth(0.8)
                cy2 = py + cs * 0.5
                c.line(px + 2, cy2, px + cs - 2, cy2)
            else:
                c.setStrokeColor(HexColor("#333333"))
                c.setLineWidth(0.8)
                cx2 = px + cs * 0.5
                c.line(cx2, py + 2, cx2, py + cs - 2)

    leg_y = cy - ch * cs - 20
    c.setFont("Helvetica", 9)
    c.setFillColor(HexColor("#333333"))

    c.setStrokeColor(HexColor("#333333"))
    c.setLineWidth(0.8)
    c.line(MARGIN + 5, leg_y + 3, MARGIN + 15, leg_y + 3)
    c.drawString(MARGIN + 20, leg_y - 3, "= Meia (tricotar)")

    cx_mid = MARGIN + 90
    c.setLineWidth(0.8)
    c.line(cx_mid + 5, leg_y - 7, cx_mid + 5, leg_y + 3)
    c.drawString(cx_mid + 12, leg_y - 3, "= Liga (purl)")

    leg_y2 = leg_y - 18
    c.setFont("Helvetica", 8)
    c.setFillColor(HexColor("#888888"))
    c.drawString(
        MARGIN,
        leg_y2,
        "Ler as carreiras do direito (ímpares) da direita para a esquerda.",
    )
    c.drawString(
        MARGIN,
        leg_y2 - 10,
        "Ler as carreiras do avesso (pares) da esquerda para a direita.",
    )
    c.drawString(
        MARGIN,
        leg_y2 - 20,
        "No avesso, tricotar o contrário do que está no gráfico.",
    )

    # === PAGINA 2: Instruções Escritas ===
    c.showPage()
    c.setFont("Helvetica-Bold", 20)
    c.setFillColor(HexColor("#333333"))
    c.drawString(MARGIN, HEIGHT - MARGIN, "Instruções Escritas")
    c.line(MARGIN, HEIGHT - MARGIN - 25, WIDTH - MARGIN, HEIGHT - MARGIN - 25)

    y = HEIGHT - MARGIN - 45
    c.setFont("Helvetica-Bold", 12)
    c.drawString(MARGIN, y, "Informação Geral")
    y -= 18
    c.setFont("Helvetica", 10)
    c.setFillColor(HexColor("#555555"))
    c.drawString(MARGIN + 10, y, f"Monte {blanket['total_width']} pontos.")
    y -= 14
    c.drawString(MARGIN + 10, y, "Tricote as secções pela ordem indicada.")
    y -= 14
    c.drawString(MARGIN + 10, y, "Lenda: M = meia, L = liga")
    y -= 20

    for inst in blanket["written_instructions"]:
        c.setStrokeColor(HexColor("#CCCCCC"))
        c.line(MARGIN, y, WIDTH - MARGIN, y)
        y -= 14
        c.setFont("Helvetica-Bold", 11)
        c.setFillColor(HexColor("#6B4F8A"))
        c.drawString(MARGIN, y, f"{inst['section']}: {inst['name']}")
        y -= 16
        c.setFont("Helvetica", 9)
        c.setFillColor(HexColor("#666666"))
        c.drawString(MARGIN + 10, y, f"Repetição: {inst['repeat']}")
        y -= 14
        c.drawString(
            MARGIN + 10, y, f"Repetir {inst['repeat_count']} vezes"
        )
        if inst["note"]:
            y -= 14
            c.drawString(MARGIN + 10, y, f"Nota: {inst['note']}")
        y -= 14

        c.setFont("Helvetica", 8)
        c.setFillColor(HexColor("#333333"))
        for row_text in inst["rows"][:6]:
            c.drawString(MARGIN + 10, y, row_text)
            y -= 11

        y -= 10
        if y < 60:
            c.showPage()
            y = HEIGHT - MARGIN - 30

    # === PAGINA 3: Visão Geral das Secções ===
    c.showPage()
    c.setFont("Helvetica-Bold", 20)
    c.setFillColor(HexColor("#333333"))
    c.drawString(MARGIN, HEIGHT - MARGIN, "Visão Geral das Secções")
    c.line(MARGIN, HEIGHT - MARGIN - 25, WIDTH - MARGIN, HEIGHT - MARGIN - 25)

    y = HEIGHT - MARGIN - 45
    c.setFont("Helvetica-Bold", 12)
    c.setFillColor(HexColor("#333333"))
    c.drawString(MARGIN, y, f"Manta com {len(blanket['sections'])} secções")
    y -= 22

    for i, sec in enumerate(blanket["sections"]):
        c.setFont("Helvetica-Bold", 11)
        c.setFillColor(HexColor("#6B4F8A"))
        c.drawString(MARGIN, y, f"Secção {chr(65 + i)}: {sec['name']}")
        y -= 16
        c.setFont("Helvetica", 9)
        c.setFillColor(HexColor("#555555"))
        c.drawString(
            MARGIN + 10, y, f"{sec['width']} pts x {sec['height']} carreiras"
        )
        y -= 14
        c.drawString(
            MARGIN + 10,
            y,
            f"Repetição de {sec['repeat_w']} pts x {sec['repeat_h']} carreiras",
        )
        y -= 22

        schart = sec["chart"]
        mcs = 4
        m_w = min(len(schart[0]) if schart else 1, 20)
        m_h = min(len(schart), 12)
        m_cx = MARGIN + 10
        m_cy = y

        for sy in range(m_h):
            for sx in range(m_w):
                val = schart[sy][sx]
                px = m_cx + sx * mcs
                py = m_cy - sy * mcs
                c.setFillColor(HexColor("#FFFFFF"))
                c.setStrokeColor(HexColor("#BBBBBB"))
                c.setLineWidth(0.3)
                c.rect(px, py, mcs, mcs, fill=1, stroke=1)
                if val == 1:
                    c.setStrokeColor(HexColor("#333333"))
                    c.setLineWidth(0.5)
                    c.line(px + 1, py + mcs * 0.5, px + mcs - 1, py + mcs * 0.5)
                else:
                    c.setStrokeColor(HexColor("#333333"))
                    c.setLineWidth(0.5)
                    c.line(px + mcs * 0.5, py + 1, px + mcs * 0.5, py + mcs - 1)

        y = m_cy - m_h * mcs - 20
        if y < 60:
            c.showPage()
            y = HEIGHT - MARGIN - 30

    c.showPage()
    c.setFont("Helvetica", 8)
    c.setFillColor(HexColor("#999999"))
    c.drawString(MARGIN, MARGIN, "Gerado pela Pointy Lines App")
    c.drawString(
        MARGIN,
        MARGIN - 12,
        "Lenda: traço vertical = meia, traço horizontal = liga",
    )

    c.save()


# =========================================================================
# DOCUMENTO 3: SWEATER COMPLETA — PROFISSIONAL
# =========================================================================

def _chart_to_written_instructions(chart, style="colorwork"):
    """Convert a chart (list of rows) into written row-by-row instructions.
    Returns a list of strings like "Carr 1 (dir): 10M, 5L, 10M"
    """
    lines = []
    total = len(chart)
    for i, row in enumerate(chart):
        row_num = total - i  # row 1 is the bottom of the chart
        side = "dir" if row_num % 2 == 1 else "avesso"
        if style == "stitch":
            groups = []
            count = 1
            prev = row[0] if row else 0
            for val in row[1:]:
                if val == prev:
                    count += 1
                else:
                    label = "M" if prev == 0 else "L"
                    groups.append(f"{count}{label}")
                    count = 1
                    prev = val
            label = "M" if prev == 0 else "L"
            groups.append(f"{count}{label}")
            text = ", ".join(groups)
            lines.append(f"Carr {row_num} ({side}): {text}  ({len(row)} pts)")
        else:
            groups = []
            count = 1
            prev = row[0] if row else 0
            for val in row[1:]:
                if val == prev:
                    count += 1
                else:
                    groups.append(f"{count}x cor {prev}")
                    count = 1
                    prev = val
            groups.append(f"{count}x cor {prev}")
            text = ", ".join(groups)
            lines.append(f"Carr {row_num} ({side}): {text}")
    return lines


def _draw_abbreviations_key(c, x, y):
    """Draw the abbreviations legend."""
    c.setFont("Helvetica-Bold", 10)
    c.setFillColor(HexColor("#333333"))
    c.drawString(x, y, "Abreviaturas:")
    y -= 14
    c.setFont("Helvetica", 8)
    c.setFillColor(HexColor("#555555"))
    abbrevs = [
        "M = meia (tricotar)",
        "L = liga (purl)",
        "pt = ponto / pts = pontos",
        "Carr = carreira(s)",
        "rem = rematar",
        "aum = aumentar",
        "dim = diminuir",
        "dir = lado direito",
        "avesso = lado do avesso",
    ]
    for a in abbrevs:
        c.drawString(x + 5, y, a)
        y -= 11


def _draw_gauge_instructions(c, x, y, gauge_st, gauge_rows):
    """Draw gauge swatch instructions."""
    c.setFont("Helvetica-Bold", 10)
    c.setFillColor(HexColor("#333333"))
    c.drawString(x, y, "Amostra (Gauge):")
    y -= 14
    c.setFont("Helvetica", 8)
    c.setFillColor(HexColor("#555555"))
    lines = [
        f"{gauge_st} pts x {gauge_rows} carreiras = 10 cm em ponto meia",
        f"Monte {gauge_st + 6} pts e tricote {gauge_rows + 6} carreiras.",
        "Bloqueie a amostra antes de medir.",
        "Ajuste o número da agulha se necessário:",
        "  - Mais pontos → agulha maior",
        "  - Menos pontos → agulha menor",
    ]
    for line in lines:
        c.drawString(x + 5, y, line)
        y -= 11


def _draw_size_table(c, x, y, gauge_st, gauge_rows):
    """Draw a size measurement table for S/M/L/XL."""
    sizes = [
        ("S", 86, 56, 44, 18),
        ("M", 91, 58, 45, 19),
        ("L", 97, 60, 46, 20),
        ("XL", 102, 62, 47, 21),
    ]
    col_w = (WIDTH - 2 * MARGIN - 40) / 6

    c.setFont("Helvetica-Bold", 10)
    c.setFillColor(HexColor("#333333"))
    c.drawString(x, y, "Tabela de Medidas (cm):")
    y -= 14

    headers = ["Tamanho", "Peito", "Comp.", "Manga", "Cava"]
    c.setFont("Helvetica-Bold", 8)
    c.setFillColor(HexColor("#333333"))
    for i, h in enumerate(headers):
        c.drawString(x + 20 + i * col_w, y, h)

    c.setStrokeColor(HexColor("#CCCCCC"))
    c.setLineWidth(0.3)
    y -= 2
    c.line(x + 20, y, x + 20 + len(headers) * col_w, y)
    y -= 10

    c.setFont("Helvetica", 8)
    c.setFillColor(HexColor("#555555"))
    for sz, chest, length, sleeve, armhole in sizes:
        c.drawString(x + 20, y, sz)
        c.drawString(x + 20 + 1 * col_w, y, str(chest))
        c.drawString(x + 20 + 2 * col_w, y, str(length))
        c.drawString(x + 20 + 3 * col_w, y, str(sleeve))
        c.drawString(x + 20 + 4 * col_w, y, str(armhole))
        y -= 10

    y -= 5
    st_per_cm = gauge_st / 10
    rows_per_cm = gauge_rows / 10
    c.setFont("Helvetica", 7)
    c.setFillColor(HexColor("#888888"))
    c.drawString(x + 20, y, f"pts/cm: {st_per_cm:.1f}  |  carr/cm: {rows_per_cm:.1f}")


def generate_sweater_pdf(sweater, output_path, original_image_path=None):
    c = canvas.Canvas(output_path, pagesize=A4)

    size = sweater.get("size", "M")
    gauge = sweater["gauge"]
    gauge_st = gauge["stitches_per_10cm"]
    gauge_rows = gauge["rows_per_10cm"]
    colors = sweater.get("base_colors", [])
    mat = sweater["materials"]
    m = sweater["measurements"]
    motif_placement = sweater.get("motif_placement", "center")
    front = sweater.get("front", {})
    chart = front.get("chart", [])
    chart_h = len(chart)
    chart_w = len(chart[0]) if chart else 0

    # === PAGE 1: COVER ===
    c.setFillColor(HexColor("#333333"))
    c.setFont("Helvetica-Bold", 26)
    c.drawString(MARGIN, HEIGHT - MARGIN, "Padrão de Sweater")
    c.setFont("Helvetica", 14)
    c.setFillColor(HexColor("#6B4F8A"))
    c.drawString(MARGIN, HEIGHT - MARGIN - 24, "Pointy Lines")
    c.line(MARGIN, HEIGHT - MARGIN - 34, WIDTH - MARGIN, HEIGHT - MARGIN - 34)

    if original_image_path and os.path.exists(original_image_path):
        try:
            img = ImageReader(original_image_path)
            iw, ih = img.getSize()
            mw = WIDTH - 2 * MARGIN
            mh = HEIGHT * 0.35
            s = min(mw / iw, mh / ih)
            dw, dh = iw * s, ih * s
            ix = MARGIN + (mw - dw) / 2
            iy = HEIGHT * 0.68 - dh
            c.drawImage(img, ix, iy, dw, dh)
            c.setStrokeColor(HexColor("#CCCCCC"))
            c.setLineWidth(0.5)
            c.rect(ix - 2, iy - 2, dw + 4, dh + 4, fill=0, stroke=1)
        except Exception:
            pass

    y = HEIGHT * 0.28
    c.setFont("Helvetica", 11)
    c.setFillColor(HexColor("#333333"))
    info_lines = [
        f"Tamanho: {size}",
        f"Amostra: {gauge_st} pts x {gauge_rows} carr = 10 cm",
        f"Motivo: {'Centrado' if motif_placement == 'center' else 'Repetido'}",
    ]
    for line in info_lines:
        c.drawString(MARGIN, y, line)
        y -= 14

    c.setFont("Helvetica", 9)
    c.setFillColor(HexColor("#888888"))
    c.drawString(MARGIN, y - 8, "Veja nas páginas seguintes: gráficos, moldes e instruções.")

    # === ESQUEMA TÉCNICO PROFISSIONAL ===
    chest_cm = m["chest_cm"]
    sleeve_cm = m["sleeve_cm"]
    length_cm = m["length_cm"]
    armhole_cm = m["armhole_cm"]

    c.setFont("Helvetica-Bold", 12)
    c.setFillColor(HexColor("#333333"))
    c.drawString(MARGIN, y - 5, "Esquema Técnico")

    c.setStrokeColor(HexColor("#6B4F8A"))
    c.setLineWidth(0.5)
    c.line(MARGIN, y - 9, MARGIN + 80, y - 9)
    c.setStrokeColor(HexColor("#333333"))
    c.setLineWidth(0.6)

    # Calculate scale for body and sleeve
    sx = MARGIN + 15
    sy_body = y - 30
    body_w = chest_cm / 2 * 2.2
    body_h = length_cm * 1.2
    scale = min(130 / max(body_w, 1), 110 / max(body_h, 1))
    body_w *= scale
    body_h *= scale

    # --- BODY RECTANGLE (Front/Back) ---
    c.setStrokeColor(HexColor("#333333"))
    c.setLineWidth(0.8)
    c.rect(sx, sy_body - body_h, body_w, body_h, fill=0, stroke=1)

    # Measurement labels with letters A-F on body
    c.setFont("Helvetica-Bold", 8)
    c.setFillColor(HexColor("#6B4F8A"))

    # A: Chest width (half)
    mid_x = sx + body_w / 2
    c.setLineWidth(0.3)
    c.setStrokeColor(HexColor("#6B4F8A"))
    c.line(sx, sy_body + 8, sx + body_w, sy_body + 8)
    c.line(sx, sy_body + 4, sx, sy_body + 12)
    c.line(sx + body_w, sy_body + 4, sx + body_w, sy_body + 12)
    c.setFont("Helvetica", 7)
    c.setFillColor(HexColor("#6B4F8A"))
    c.drawString(mid_x - 20, sy_body + 10, f"A: {chest_cm / 2} cm (frente)")

    # B: Total chest
    c.setFont("Helvetica", 7)
    c.setFillColor(HexColor("#6B4F8A"))
    c.drawString(mid_x + 20, sy_body + 10, f"B: {chest_cm} cm (total)")

    # C: Length
    body_mid_y = sy_body - body_h / 2
    c.setStrokeColor(HexColor("#6B4F8A"))
    c.setLineWidth(0.3)
    c.line(sx + body_w + 1, sy_body, sx + body_w + 1, sy_body - body_h)
    c.line(sx + body_w - 3, sy_body, sx + body_w + 5, sy_body)
    c.line(sx + body_w - 3, sy_body - body_h, sx + body_w + 5, sy_body - body_h)
    c.setFont("Helvetica", 7)
    c.setFillColor(HexColor("#6B4F8A"))
    c.drawString(sx + body_w + 3, body_mid_y - 3, f"C: {length_cm} cm")

    # D: Armhole depth
    armhole_h = armhole_cm * scale / 1.5
    armhole_sy = sy_body - armhole_h
    c.setStrokeColor(HexColor("#6B4F8A"))
    c.setLineWidth(0.3)
    c.line(sx - 2, sy_body, sx - 2, armhole_sy)
    c.line(sx - 5, sy_body, sx + 1, sy_body)
    c.line(sx - 5, armhole_sy, sx + 1, armhole_sy)
    c.setFont("Helvetica", 7)
    c.setFillColor(HexColor("#6B4F8A"))
    c.drawString(sx - 25, armhole_sy + (sy_body - armhole_sy) / 2 - 3, f"D: {armhole_cm} cm")

    # --- SLEEVE ---
    sleeve_sx = sx + body_w + 20
    sleeve_sy = armhole_sy
    cuff_w = 18 * scale / 1.5
    top_w = armhole_cm * 2 * scale / 1.5
    sleeve_h = sleeve_cm * scale / 1.5

    c.setStrokeColor(HexColor("#333333"))
    c.setLineWidth(0.8)
    sleeve_path = c.beginPath()
    sleeve_path.moveTo(sleeve_sx, sleeve_sy)
    sleeve_path.lineTo(sleeve_sx + top_w, sleeve_sy)
    sleeve_path.lineTo(sleeve_sx + top_w - (top_w - cuff_w) / 2, sleeve_sy - sleeve_h)
    sleeve_path.lineTo(sleeve_sx + (top_w - cuff_w) / 2, sleeve_sy - sleeve_h)
    sleeve_path.close()
    c.drawPath(sleeve_path, fill=0, stroke=1)

    # E: Sleeve length
    sleeve_mid_x = sleeve_sx + top_w / 2
    c.setStrokeColor(HexColor("#6B4F8A"))
    c.setLineWidth(0.3)
    c.line(sleeve_sx + top_w + 4, sleeve_sy, sleeve_sx + top_w + 4, sleeve_sy - sleeve_h)
    c.line(sleeve_sx + top_w + 1, sleeve_sy, sleeve_sx + top_w + 7, sleeve_sy)
    c.line(sleeve_sx + top_w + 1, sleeve_sy - sleeve_h, sleeve_sx + top_w + 7, sleeve_sy - sleeve_h)
    c.setFont("Helvetica", 7)
    c.setFillColor(HexColor("#6B4F8A"))
    c.drawString(sleeve_sx + top_w + 6, sleeve_sy - sleeve_h / 2 - 3, f"E: {sleeve_cm} cm")

    # F: Sleeve top width
    c.setStrokeColor(HexColor("#6B4F8A"))
    c.setLineWidth(0.3)
    c.line(sleeve_sx, sleeve_sy + 6, sleeve_sx + top_w, sleeve_sy + 6)
    c.line(sleeve_sx, sleeve_sy + 3, sleeve_sx, sleeve_sy + 9)
    c.line(sleeve_sx + top_w, sleeve_sy + 3, sleeve_sx + top_w, sleeve_sy + 9)
    c.setFont("Helvetica", 7)
    c.setFillColor(HexColor("#6B4F8A"))
    c.drawString(sleeve_sx + top_w / 2 - 8, sleeve_sy + 8, f"F: {armhole_cm * 2} cm")

    # Right side "Parte de trás / Frente"
    c.setFont("Helvetica", 6)
    c.setFillColor(HexColor("#999999"))
    c.drawString(sx + 5, sy_body - body_h - 8, "(Costas / Frente - tricotar 2 peças iguais)")

    y = sy_body - body_h - 22

    # Measurement reference table
    c.setFont("Helvetica-Bold", 10)
    c.setFillColor(HexColor("#333333"))
    c.drawString(MARGIN, y, "Tabela de Medidas")
    y -= 16

    meas_table = [
        ("A", "Largura da Frente", f"{chest_cm / 2} cm", f"{round(chest_cm / 2 * gauge_st / 10)} pts"),
        ("B", "Peito (total)", f"{chest_cm} cm", ""),
        ("C", "Comprimento Total", f"{length_cm} cm", f"{round(length_cm * gauge_rows / 10)} carr"),
        ("D", "Profundidade da Cava", f"{armhole_cm} cm", f"{round(armhole_cm * gauge_rows / 10)} carr"),
        ("E", "Comprimento da Manga", f"{sleeve_cm} cm", f"{round(sleeve_cm * gauge_rows / 10)} carr"),
        ("F", "Largura da Manga (cava)", f"{armhole_cm * 2} cm", f"{round(armhole_cm * 2 * gauge_st / 10)} pts"),
    ]

    col_w = (WIDTH - 2 * MARGIN - 20) / 4
    c.setFont("Helvetica-Bold", 7)
    c.setFillColor(HexColor("#333333"))
    headers = ["Ref.", "Descrição", "Medida (cm)", "Pontos/Carreiras"]
    for i, h in enumerate(headers):
        c.drawString(MARGIN + 5 + i * col_w, y, h)
    y -= 2
    c.setStrokeColor(HexColor("#CCCCCC"))
    c.setLineWidth(0.3)
    c.line(MARGIN + 5, y, MARGIN + 5 + len(headers) * col_w, y)
    y -= 9

    c.setFont("Helvetica", 7)
    c.setFillColor(HexColor("#555555"))
    for ref, desc, cm_val, sts in meas_table:
        c.drawString(MARGIN + 7, y, ref)
        c.drawString(MARGIN + 5 + 1 * col_w, y, desc)
        c.drawString(MARGIN + 5 + 2 * col_w, y, cm_val)
        if sts:
            c.drawString(MARGIN + 5 + 3 * col_w, y, sts)
        y -= 9

    y -= 3
    c.setStrokeColor(HexColor("#CCCCCC"))
    c.setLineWidth(0.3)
    c.line(MARGIN + 5, y, WIDTH - MARGIN, y)
    y -= 12

    # Abreviaturas
    _draw_abbreviations_key(c, MARGIN, y)
    _draw_gauge_instructions(c, MARGIN + 120, y, gauge_st, gauge_rows)

    if chart and chart_w > 0 and chart_h > 0:
        c.showPage()
        c.setFont("Helvetica-Bold", 18)
        c.setFillColor(HexColor("#333333"))
        c.drawString(MARGIN, HEIGHT - MARGIN, "Gráfico Preto e Branco")
        c.setFont("Helvetica", 9)
        c.setFillColor(HexColor("#666666"))
    c.drawString(MARGIN, HEIGHT - MARGIN - 18, "○ = ponto do padrão  |  □ = fundo (meia)")
    c.line(MARGIN, HEIGHT - MARGIN - 28, WIDTH - MARGIN, HEIGHT - MARGIN - 28)

    mw_bw = WIDTH - 2 * MARGIN
    mh_bw = HEIGHT - 2 * MARGIN - 100
    cs_bw = min(mw_bw // max(chart_w, 1), mh_bw // max(chart_h, 1), 10)
    cs_bw = max(cs_bw, 3)

    cx_bw = MARGIN + (mw_bw - chart_w * cs_bw) / 2
    cy_bw = HEIGHT - MARGIN - 45
    draw_bw_chart(c, chart, cx_bw, cy_bw, cs_bw)

    info_y = cy_bw - chart_h * cs_bw - 15
    c.setFont("Helvetica", 8)
    c.setFillColor(HexColor("#666666"))
    c.drawString(MARGIN, info_y, f"{chart_w} pts x {chart_h} carr  |  Cada quadrado = 1 ponto")
    if colors:
        c.drawString(MARGIN, info_y - 12, "Consulte o gráfico a cores na página seguinte.")

    # === PAGINA 2: PAINEL FRONTAL ===
    c.showPage()
    c.setFont("Helvetica-Bold", 20)
    c.setFillColor(HexColor("#333333"))
    c.drawString(MARGIN, HEIGHT - MARGIN, "Painel da Frente")
    c.setFont("Helvetica", 10)
    c.setFillColor(HexColor("#666666"))
    c.drawString(MARGIN, HEIGHT - MARGIN - 18, f"{sweater['front']['width_sts']} pts x {sweater['front']['height_rows']} carr")
    c.line(MARGIN, HEIGHT - MARGIN - 28, WIDTH - MARGIN, HEIGHT - MARGIN - 28)

    front = sweater["front"]
    chart = front["chart"]
    chart_h = len(chart)
    chart_w = len(chart[0]) if chart else 0

    mw = WIDTH - 2 * MARGIN
    mh = HEIGHT - 2 * MARGIN - 140
    cs = min(mw // max(chart_w, 1), mh // max(chart_h, 1), 8)
    cs = max(cs, 3)

    cx = MARGIN + (mw - chart_w * cs) / 2
    cy = HEIGHT - MARGIN - 50

    _draw_panel_chart(c, front, colors, cx, cy, cs, "Frente")

    info_y = cy - chart_h * cs - 50 if front.get("style") == "stitch" else cy - chart_h * cs - 15
    c.setFont("Helvetica", 8)
    c.setFillColor(HexColor("#666666"))
    c.drawString(MARGIN, info_y, f"Largura: {front['width_sts']} pts  |  Altura: {front['height_rows']} carr  |  Total: {front['stitch_count']} pts")

    # Shaping instructions
    c.setFont("Helvetica-Bold", 8)
    c.setFillColor(HexColor("#333333"))
    c.drawString(MARGIN, info_y - 15, "Modelagem:")
    c.setFont("Helvetica", 7)
    sy2 = info_y - 25
    for instr in front["shaping"]["instructions"]:
        c.drawString(MARGIN + 5, sy2, f"• {instr}")
        sy2 -= 10

    if front.get("style") != "stitch" and colors:
        draw_color_key(c, colors, MARGIN, sy2 - 15)

    # Written row-by-row instructions
    written = _chart_to_written_instructions(chart, front.get("style", "colorwork"))
    instr_x = WIDTH / 2 + 20
    instr_y = info_y
    c.setFont("Helvetica-Bold", 8)
    c.setFillColor(HexColor("#333333"))
    c.drawString(instr_x, info_y, "Instruções carreira-a-carreira:")
    c.setFont("Helvetica", 6)
    c.setFillColor(HexColor("#555555"))
    instr_y -= 12
    for line in written:
        if instr_y < 50:
            break
        c.drawString(instr_x + 3, instr_y, line)
        instr_y -= 7

    # === PAGINA 3: COSTAS ===
    c.showPage()
    c.setFont("Helvetica-Bold", 20)
    c.setFillColor(HexColor("#333333"))
    c.drawString(MARGIN, HEIGHT - MARGIN, "Painel das Costas")
    c.setFont("Helvetica", 10)
    c.setFillColor(HexColor("#666666"))
    c.drawString(MARGIN, HEIGHT - MARGIN - 18, f"{sweater['back']['width_sts']} pts x {sweater['back']['height_rows']} carr")
    c.line(MARGIN, HEIGHT - MARGIN - 28, WIDTH - MARGIN, HEIGHT - MARGIN - 28)

    back = sweater["back"]
    bchart = back["chart"]
    bch = len(bchart)
    bcw = len(bchart[0]) if bchart else 0

    cs2 = min(mw // max(bcw, 1), mh // max(bch, 1), 8)
    cs2 = max(cs2, 3)
    cx2 = MARGIN + (mw - bcw * cs2) / 2
    cy2 = HEIGHT - MARGIN - 50

    _draw_panel_chart(c, back, colors, cx2, cy2, cs2, "Costas")

    info_y2 = cy2 - bch * cs2 - 50 if back.get("style") == "stitch" else cy2 - bch * cs2 - 15
    c.setFont("Helvetica", 8)
    c.setFillColor(HexColor("#666666"))
    c.drawString(MARGIN, info_y2, f"Largura: {back['width_sts']} pts  |  Altura: {back['height_rows']} carr  |  Total: {back['stitch_count']} pts")

    c.setFont("Helvetica-Bold", 8)
    c.setFillColor(HexColor("#333333"))
    c.drawString(MARGIN, info_y2 - 15, "Modelagem:")
    c.setFont("Helvetica", 7)
    sy2_b = info_y2 - 25
    for instr in back["shaping"]["instructions"]:
        c.drawString(MARGIN + 5, sy2_b, f"• {instr}")
        sy2_b -= 10

    # Written instructions for back
    written_b = _chart_to_written_instructions(bchart, back.get("style", "colorwork"))
    instr_x_b = WIDTH / 2 + 20
    instr_y_b = info_y2
    c.setFont("Helvetica-Bold", 8)
    c.setFillColor(HexColor("#333333"))
    c.drawString(instr_x_b, info_y2, "Instruções carreira-a-carreira:")
    c.setFont("Helvetica", 6)
    c.setFillColor(HexColor("#555555"))
    instr_y_b -= 12
    for line in written_b:
        if instr_y_b < 50:
            break
        c.drawString(instr_x_b + 3, instr_y_b, line)
        instr_y_b -= 7

    # === PAGINA 4: MANGAS ===
    c.showPage()
    c.setFont("Helvetica-Bold", 20)
    c.setFillColor(HexColor("#333333"))
    c.drawString(MARGIN, HEIGHT - MARGIN, "Mangas (x2)")
    c.line(MARGIN, HEIGHT - MARGIN - 28, WIDTH - MARGIN, HEIGHT - MARGIN - 28)

    sleeve = sweater["sleeve"]
    schart = sleeve["chart"]
    sch = len(schart)
    scw = len(schart[0]) if schart else 0

    sleeve_label = f"Punho: {sleeve['cuff_sts']} pts → Cava: {sleeve['top_sts']} pts, {sleeve['height_rows']} carr"
    if sleeve.get("pattern_name"):
        sleeve_label += f"  |  {sleeve['pattern_name']}"

    c.setFont("Helvetica", 10)
    c.setFillColor(HexColor("#333333"))
    c.drawString(MARGIN, HEIGHT - MARGIN - 48, sleeve_label)
    c.setFont("Helvetica", 8)
    c.setFillColor(HexColor("#666666"))
    c.drawString(MARGIN, HEIGHT - MARGIN - 64, sleeve["shaping_notes"])

    mw2 = WIDTH - 2 * MARGIN
    mh2 = HEIGHT - 2 * MARGIN - 180
    cs3 = min(mw2 // max(scw, 1), mh2 // max(sch, 1), 7)
    cs3 = max(cs3, 3)
    cx3 = MARGIN + (mw2 - scw * cs3) / 2
    cy3 = HEIGHT - MARGIN - 90

    _draw_panel_chart(c, sleeve, colors, cx3, cy3, cs3, "Manga")

    info_y3 = cy3 - sch * cs3 - 50 if sleeve.get("style") == "stitch" else cy3 - sch * cs3 - 15
    c.setFont("Helvetica", 8)
    c.setFillColor(HexColor("#666666"))
    c.drawString(MARGIN, info_y3, f"Manga: {sleeve['top_sts']} pts (mais larga), {sleeve['height_rows']} carr")

    # Written instructions for sleeves
    written_s = _chart_to_written_instructions(schart, sleeve.get("style", "colorwork"))
    instr_x_s = WIDTH / 2 + 20
    instr_y_s = info_y3
    c.setFont("Helvetica-Bold", 8)
    c.setFillColor(HexColor("#333333"))
    c.drawString(instr_x_s, info_y3, "Instruções carreira-a-carreira:")
    c.setFont("Helvetica", 6)
    c.setFillColor(HexColor("#555555"))
    instr_y_s -= 12
    for line in written_s:
        if instr_y_s < 50:
            break
        c.drawString(instr_x_s + 3, instr_y_s, line)
        instr_y_s -= 7

    if colors and sleeve.get("style") != "stitch":
        draw_color_key(c, colors, MARGIN, info_y3 - 25)

    # === PAGINA 5: MATERIAIS + FERRAMENTAS ===
    c.showPage()
    c.setFont("Helvetica-Bold", 20)
    c.setFillColor(HexColor("#333333"))
    c.drawString(MARGIN, HEIGHT - MARGIN, "Materiais Necessários")
    c.line(MARGIN, HEIGHT - MARGIN - 25, WIDTH - MARGIN, HEIGHT - MARGIN - 25)

    y = HEIGHT - MARGIN - 50
    c.setFont("Helvetica-Bold", 12)
    c.setFillColor(HexColor("#333333"))
    c.drawString(MARGIN, y, "Lã e Acessórios")
    y -= 18

    c.setFont("Helvetica", 9)
    c.setFillColor(HexColor("#555555"))
    mat_items = [
        f"• Cores de lã: {mat.get('yarn_colors', 'N/A')}",
        f"• Lã estimada: ~{mat.get('estimated_yarn_grams', 'N/A')}g",
        f"• Agulhas: {mat.get('needle_size', 'N/A')}",
        f"• Amostra: {mat.get('gauge', 'N/A')}",
        f"• Peito final: {mat.get('finished_chest_cm', 'N/A')}cm",
        f"• Comprimento final: {mat.get('finished_length_cm', 'N/A')}cm",
        f"• Manga final: {mat.get('finished_sleeve_cm', 'N/A')}cm",
    ]
    for item in mat_items:
        c.drawString(MARGIN + 5, y, item)
        y -= 14

    y -= 6
    c.line(MARGIN, y, WIDTH - MARGIN, y)
    y -= 14
    c.setFont("Helvetica-Bold", 12)
    c.setFillColor(HexColor("#333333"))
    c.drawString(MARGIN, y, "Ferramentas")
    y -= 16
    c.setFont("Helvetica", 9)
    c.setFillColor(HexColor("#555555"))
    for tool in mat.get("tools", []):
        c.drawString(MARGIN + 5, y, f"• {tool}")
        y -= 14

    y -= 6
    c.line(MARGIN, y, WIDTH - MARGIN, y)
    y -= 14
    c.setFont("Helvetica-Bold", 12)
    c.setFillColor(HexColor("#333333"))
    c.drawString(MARGIN, y, "Legenda de Cores")
    y -= 16

    if colors:
        c.setFont("Helvetica", 8)
        for i, clr in enumerate(colors):
            cx_clr = MARGIN + 5 + (i % 2) * 80
            cy_clr = y - (i // 2) * 14
            c.setFillColor(HexColor(clr["hex"]))
            c.setStrokeColor(HexColor("#333333"))
            c.setLineWidth(0.3)
            c.rect(cx_clr, cy_clr - 8, 10, 10, fill=1, stroke=1)
            c.setFillColor(HexColor("#333333"))
            c.drawString(cx_clr + 13, cy_clr - 7, f"Cor {clr['index']}: {clr['name']}")

    # === PAGINA 6: INSTRUÇÕES DE TRICÔ PASSO-A-PASSO ===
    c.showPage()
    c.setFont("Helvetica-Bold", 20)
    c.setFillColor(HexColor("#333333"))
    c.drawString(MARGIN, HEIGHT - MARGIN, "Instruções de Tricô Passo-a-Passo")
    c.line(MARGIN, HEIGHT - MARGIN - 25, WIDTH - MARGIN, HEIGHT - MARGIN - 25)

    y = HEIGHT - MARGIN - 50
    c.setFont("Helvetica-Bold", 12)
    c.setFillColor(HexColor("#6B4F8A"))

    front = sweater["front"]
    back = sweater["back"]
    sleeve = sweater["sleeve"]

    # Step-by-step knitting instructions per panel
    knit_steps = [
        ("1. Painel da Frente", [
            f"Monte {front['width_sts']} pontos na agulha.",
            f"Siga o gráfico da Frente (página 2) da carreira 1 à {front['height_rows']}.",
            f"O gráfico é lido de baixo para cima.",
            "Carreiras ímpares (direito): ler da direita para a esquerda.",
            "Carreiras pares (avesso): ler da esquerda para a direita.",
            f"Cava: a {m['length_cm'] - m['armhole_cm']} cm de altura",
            f"({round((m['length_cm'] - m['armhole_cm']) * gauge_rows / 10)} carr),",
            "iniciar as diminuições da cava de cada lado.",
            f"Decote: a {m['length_cm'] - 4} cm de altura, arrematar os pts centrais",
            "e continuar cada lado separadamente.",
        ]),
        ("2. Painel das Costas", [
            f"Monte {back['width_sts']} pontos na agulha.",
            f"Siga o gráfico das Costas (página 3) da carreira 1 à {back['height_rows']}.",
            "Tricotar igual à Frente até às cavas.",
            f"Cava: diminuir da mesma forma que a Frente.",
            f"Decote das costas: mais curto que o da frente. Arrematar",
            "os pontos centrais nas últimas carreiras.",
            "Deixar os pontos dos ombros em espera ou arrematar.",
        ]),
        ("3. Mangas (fazer 2)", [
            f"Com agulhas mais finas, monte {sleeve['cuff_sts']} pontos.",
            "Tricote em canelado 1/1 (1M, 1L) por 4 cm.",
            "Mude para agulhas maiores e distribua aumentos",
            f"para atingir {sleeve['top_sts']} pontos no total.",
            f"Siga o gráfico da Manga (página 4) por {sleeve['height_rows']} carreiras.",
            f"Aumentos: 1 pt de cada lado a cada {sleeve['increases_every']} carreiras,",
            f"totalizando {sleeve['total_increases']} aumentos de cada lado.",
            "Arrematar todos os pontos no final.",
        ]),
        ("4. Montagem", [
            "Bloqueie cada peça separadamente nas medidas finais.",
            "Costure os ombros com costura invisível (mattress stitch)",
            f"ou remate de 3 agulhas (deixando {m['chest_cm'] / 4 * gauge_st / 10:.0f} pts para cada ombro).",
            f"Marque o centro das mangas e alinhe com a costura dos ombros.",
            f"Prenda as mangas à cava ({m['armhole_cm']} cm) com alfinetes.",
            "Cosa as mangas à cava com pontos pequenos e regulares.",
            "Cosa as laterais do corpo e as mangas.",
        ]),
        ("5. Remate do Decote", [
            "Com agulha circular 3.5mm, levante pontos à volta do decote.",
            "Levante aproximadamente 1 pt por cada pt arrematado",
            "e 3 pts a cada 4 carreiras nas laterais.",
            "Tricote em canelado 1/1 (1M, 1L) por 5 carreiras.",
            "Remate soltando os pontos (bind-off loosely).",
        ]),
        ("6. Acabamentos Finais", [
            "Corte e esconda todos os fios soltos no avesso.",
            "Bloqueie a peça final montada nas medidas indicadas.",
            "Lave seguindo as instruções da lã escolhida.",
            "Seque na horizontal para manter a forma.",
        ]),
    ]

    for title, bullets in knit_steps:
        if y < 70:
            c.showPage()
            y = HEIGHT - MARGIN - 30
            c.setFont("Helvetica-Bold", 12)
            c.setFillColor(HexColor("#6B4F8A"))

        c.drawString(MARGIN + 5, y, title)
        y -= 14
        c.setFont("Helvetica", 8)
        c.setFillColor(HexColor("#555555"))
        for bullet in bullets:
            c.drawString(MARGIN + 15, y, f"• {bullet}")
            y -= 10
        c.setFont("Helvetica-Bold", 12)
        c.setFillColor(HexColor("#6B4F8A"))
        y -= 6

    # === PAGINA 7: DICAS E LEGENDA ===
    c.showPage()
    c.setFont("Helvetica-Bold", 20)
    c.setFillColor(HexColor("#333333"))
    c.drawString(MARGIN, HEIGHT - MARGIN, "Dicas e Informações Úteis")
    c.line(MARGIN, HEIGHT - MARGIN - 25, WIDTH - MARGIN, HEIGHT - MARGIN - 25)

    y = HEIGHT - MARGIN - 50
    c.setFont("Helvetica-Bold", 12)
    c.setFillColor(HexColor("#6B4F8A"))
    c.drawString(MARGIN, y, "Como Ler o Gráfico")
    y -= 18
    c.setFont("Helvetica", 9)
    c.setFillColor(HexColor("#555555"))
    reading_tips = [
        "O gráfico é lido de baixo para cima, da carreira 1 até ao fim.",
        "Carreiras do direito (ímpares): ler da direita para a esquerda.",
        "Carreiras do avesso (pares): ler da esquerda para a direita.",
        "No avesso, tricotar o ponto contrário do que está no gráfico",
        "(se o gráfico mostra M, fazer L no avesso e vice-versa).",
        "Cada quadrado = 1 ponto na cor indicada (colorwork).",
    ]
    for tip in reading_tips:
        c.drawString(MARGIN + 10, y, f"• {tip}")
        y -= 12

    y -= 6
    c.setStrokeColor(HexColor("#CCCCCC"))
    c.line(MARGIN, y, WIDTH - MARGIN, y)
    y -= 16

    c.setFont("Helvetica-Bold", 12)
    c.setFillColor(HexColor("#6B4F8A"))
    c.drawString(MARGIN, y, "Dicas para um Acabamento Profissional")
    y -= 18
    c.setFont("Helvetica", 9)
    c.setFillColor(HexColor("#555555"))
    pro_tips = [
        "Sempre faça uma amostra (gauge swatch) antes de começar.",
        "Use marcadores para delimitar as cavas e o decote.",
        "Ao mudar de cor, cruze os fios pelo avesso para evitar buracos.",
        "Mantenha a tensão uniforme ao longo de toda a peça.",
        "Conte as carreiras regularmente para não perder o ritmo.",
        "Use uma fita métrica para verificar as medidas durante o tricô.",
        "Deixe fios suficientemente longos para as costuras finais.",
    ]
    for tip in pro_tips:
        c.drawString(MARGIN + 10, y, f"• {tip}")
        y -= 12

    y -= 6
    c.setStrokeColor(HexColor("#CCCCCC"))
    c.line(MARGIN, y, WIDTH - MARGIN, y)
    y -= 16

    c.setFont("Helvetica-Bold", 12)
    c.setFillColor(HexColor("#6B4F8A"))
    c.drawString(MARGIN, y, "Bloqueio (Blocking)")
    y -= 18
    c.setFont("Helvetica", 9)
    c.setFillColor(HexColor("#555555"))
    blocking_tips = [
        "Lave a peça em água fria com detergente para lã.",
        "Enrole numa toalha para retirar o excesso de água.",
        "Estique suavemente para as medidas finais.",
        "Use alfinetes para prender a peça no formato desejado.",
        "Deixe secar completamente antes de coser ou usar.",
    ]
    for tip in blocking_tips:
        c.drawString(MARGIN + 10, y, f"• {tip}")
        y -= 12

    # Final page — footer
    c.showPage()
    c.setFont("Helvetica-Bold", 16)
    c.setFillColor(HexColor("#333333"))
    c.drawString(MARGIN, HEIGHT - MARGIN, "Pointy Lines")
    c.setFont("Helvetica", 11)
    c.setFillColor(HexColor("#6B4F8A"))
    c.drawString(MARGIN, HEIGHT - MARGIN - 20, "Obrigado por usar o nosso gerador de padrões!")

    c.line(MARGIN, HEIGHT - MARGIN - 30, WIDTH - MARGIN, HEIGHT - MARGIN - 30)

    y = HEIGHT - MARGIN - 55
    c.setFont("Helvetica", 9)
    c.setFillColor(HexColor("#555555"))
    footer_lines = [
        "Este padrão foi gerado automaticamente pela Pointy Lines App.",
        f"Tamanho: {size}  |  Amostra: {gauge_st} pts x {gauge_rows} carr = 10 cm",
        f"Motivo: {'Centrado' if motif_placement == 'center' else 'Repetido'}",
        "",
        "Recomendações:",
        "• Verifique a sua amostra antes de começar.",
        "• Leia todas as instruções antes de iniciar o projeto.",
        "• Marque as carreiras no gráfico à medida que avança.",
        "• Use uma calculadora de tricô para ajustar medidas se necessário.",
        "",
        "Partilhe o seu resultado: #KnittingPatternMaker",
    ]
    for line in footer_lines:
        c.drawString(MARGIN, y, line)
        y -= 13

    y -= 15
    c.line(MARGIN, y, WIDTH - MARGIN, y)
    y -= 15

    c.setFont("Helvetica", 8)
    c.setFillColor(HexColor("#999999"))
    c.drawString(MARGIN, y, "Todas as medidas são aproximadas. Ajuste conforme necessário.")
    c.drawString(MARGIN, y - 12, "Lenda: | = meia  |  – = liga  |  Cada quadrado = 1 ponto na cor indicada")
    c.drawString(MARGIN, y - 24, "© Pointy Lines - Gerado digitalmente")

    c.save()


# =========================================================================
# DOCUMENTO 4: BRINQUEDO / PLUSH
# =========================================================================

def generate_toy_pdf(toy, output_path, original_image_path=None):
    c = canvas.Canvas(output_path, pagesize=A4)

    chart = toy["chart"]
    colors = toy["colors"]
    chart_h = len(chart)
    chart_w = len(chart[0]) if chart else 0
    toy_type = toy.get("toy_type", "plush")
    toy_name = toy.get("toy_name", "Brinquedo")
    size = toy.get("size", "M")
    gauge_st = toy.get("gauge_stitches", 22)
    gauge_rows = toy.get("gauge_rows", 30)
    panel_width_cm = toy.get("panel_width_cm", 30)
    panel_height_cm = toy.get("panel_height_cm", 40)

    # === PAGE 1: COVER ===
    c.setFillColor(HexColor("#333333"))
    c.setFont("Helvetica-Bold", 26)
    c.drawString(MARGIN, HEIGHT - MARGIN, f"Padrão: {toy_name}")
    c.setFont("Helvetica", 14)
    c.setFillColor(HexColor("#6B4F8A"))
    c.drawString(MARGIN, HEIGHT - MARGIN - 24, "Brinquedo / Plush de Tricô")
    c.line(MARGIN, HEIGHT - MARGIN - 34, WIDTH - MARGIN, HEIGHT - MARGIN - 34)

    y = HEIGHT - MARGIN - 55
    c.setFont("Helvetica", 11)
    c.setFillColor(HexColor("#333333"))
    info_lines = [
        f"Tamanho: {size}  |  Painel: {panel_width_cm} cm x {panel_height_cm} cm",
        f"Amostra: {gauge_st} pts x {gauge_rows} carreiras = 10 cm",
        f"Gráfico: {chart_w} pontos x {chart_h} carreiras",
        f"Tipo: {'Peluche almofada' if toy_type == 'cushion' else 'Brinquedo 3D'}",
    ]
    for line in info_lines:
        c.drawString(MARGIN, y, line)
        y -= 16

    # Original image
    if original_image_path and os.path.exists(original_image_path):
        try:
            img = ImageReader(original_image_path)
            iw, ih = img.getSize()
            mw = WIDTH - 2 * MARGIN
            mh = HEIGHT * 0.32
            s = min(mw / iw, mh / ih)
            dw, dh = iw * s, ih * s
            ix = MARGIN + (mw - dw) / 2
            iy = y - dh - 10
            c.drawImage(img, ix, iy, dw, dh)
            c.setStrokeColor(HexColor("#CCCCCC"))
            c.setLineWidth(0.5)
            c.rect(ix - 2, iy - 2, dw + 4, dh + 4, fill=0, stroke=1)
            y = iy - 15
        except Exception:
            pass

    # Mini schematic - rectangle with label
    y -= 10
    c.setFont("Helvetica-Bold", 12)
    c.setFillColor(HexColor("#333333"))
    c.drawString(MARGIN, y, "Esquema do Painel")
    y -= 5
    c.setStrokeColor(HexColor("#6B4F8A"))
    c.setLineWidth(0.5)
    c.line(MARGIN, y, MARGIN + 80, y)
    y -= 10

    sx = MARGIN + 40
    sy = y - 10
    pw = min(panel_width_cm * 3, 120)
    ph = min(panel_height_cm * 2.5, 100)
    scale = min(pw / max(chart_w, 1), ph / max(chart_h, 1))
    pw = chart_w * scale
    ph = chart_h * scale

    c.setStrokeColor(HexColor("#333333"))
    c.setLineWidth(0.8)
    c.rect(sx, sy - ph, pw, ph, fill=0, stroke=1)

    c.setFont("Helvetica", 8)
    c.setFillColor(HexColor("#555555"))
    c.drawString(sx + pw / 2 - 15, sy + 3, f"{panel_width_cm} cm")
    c.drawString(sx - 16, sy - ph / 2 - 3, f"{panel_height_cm} cm")

    c.setFont("Helvetica", 7)
    c.setFillColor(HexColor("#999999"))
    c.drawString(sx + pw / 2 - 20, sy - ph - 10, "(frente do brinquedo)")
    c.drawString(sx + 2, sy - ph + 2, "Tricotar 2 painéis:")
    c.drawString(sx + 2, sy - ph + 12, "frente (gráfico) + costas (liso)")

    y2 = sy - ph - 35

    # Size table for toys
    c.setFont("Helvetica-Bold", 10)
    c.setFillColor(HexColor("#333333"))
    c.drawString(MARGIN, y2, "Tabela de Medidas")
    y2 -= 14

    toy_sizes = [
        ("P", 20, 25, 30, 15),
        ("M", 30, 40, 50, 25),
        ("G", 40, 50, 70, 35),
    ]
    col_w2 = (WIDTH - 2 * MARGIN - 20) / 5
    c.setFont("Helvetica-Bold", 7)
    c.setFillColor(HexColor("#333333"))
    th = ["Tam.", "Larg. (cm)", "Alt. (cm)", "Lã (g)", "Ench. (g)"]
    for i, h in enumerate(th):
        c.drawString(MARGIN + 5 + i * col_w2, y2, h)
    y2 -= 2
    c.setStrokeColor(HexColor("#CCCCCC"))
    c.setLineWidth(0.3)
    c.line(MARGIN + 5, y2, MARGIN + 5 + len(th) * col_w2, y2)
    y2 -= 10
    c.setFont("Helvetica", 7)
    c.setFillColor(HexColor("#555555"))
    for sz, w, h2, yrn, stuff in toy_sizes:
        c.drawString(MARGIN + 7, y2, sz)
        c.drawString(MARGIN + 5 + 1 * col_w2, y2, str(w))
        c.drawString(MARGIN + 5 + 2 * col_w2, y2, str(h2))
        c.drawString(MARGIN + 5 + 3 * col_w2, y2, str(yrn))
        c.drawString(MARGIN + 5 + 4 * col_w2, y2, str(stuff))
        y2 -= 9
    y2 -= 5
    c.line(MARGIN + 5, y2, WIDTH - MARGIN, y2)
    y2 -= 12

    # Abbreviations
    _draw_abbreviations_key(c, MARGIN, y2)
    _draw_gauge_instructions(c, MARGIN + 120, y2, gauge_st, gauge_rows)

    # === PAGE 2: CHART ===
    c.showPage()
    c.setFont("Helvetica-Bold", 20)
    c.setFillColor(HexColor("#333333"))
    c.drawString(MARGIN, HEIGHT - MARGIN, f"Gráfico - Frente ({toy_name})")
    c.setFont("Helvetica", 10)
    c.setFillColor(HexColor("#666666"))
    c.drawString(MARGIN, HEIGHT - MARGIN - 18, f"{chart_w} pts x {chart_h} carr")
    c.line(MARGIN, HEIGHT - MARGIN - 28, WIDTH - MARGIN, HEIGHT - MARGIN - 28)

    mw = WIDTH - 2 * MARGIN
    mh = HEIGHT - 2 * MARGIN - 140
    cs = min(mw // max(chart_w, 1), mh // max(chart_h, 1), 8)
    cs = max(cs, 3)

    cx = MARGIN + (mw - chart_w * cs) / 2
    cy = HEIGHT - MARGIN - 50

    draw_chart(c, chart, colors, cx, cy, cs)

    info_y = cy - chart_h * cs - 15
    c.setFont("Helvetica", 8)
    c.setFillColor(HexColor("#666666"))
    c.drawString(MARGIN, info_y, f"{chart_w} pts x {chart_h} carr  |  Cada quadrado = 1 ponto")

    if colors:
        draw_color_key(c, colors, MARGIN, info_y - 30)

    # Written instructions
    written = _chart_to_written_instructions(chart, "colorwork")
    instr_x = WIDTH / 2 + 20
    instr_y = info_y
    c.setFont("Helvetica-Bold", 8)
    c.setFillColor(HexColor("#333333"))
    c.drawString(instr_x, info_y, "Instruções carreira-a-carreira:")
    c.setFont("Helvetica", 6)
    c.setFillColor(HexColor("#555555"))
    instr_y -= 12
    for line in written:
        if instr_y < 50:
            break
        c.drawString(instr_x + 3, instr_y, line)
        instr_y -= 7

    # === PAGE 3: BACK PANEL ===
    c.showPage()
    c.setFont("Helvetica-Bold", 20)
    c.setFillColor(HexColor("#333333"))
    c.drawString(MARGIN, HEIGHT - MARGIN, "Painel das Costas (Liso)")
    c.line(MARGIN, HEIGHT - MARGIN - 25, WIDTH - MARGIN, HEIGHT - MARGIN - 25)

    y = HEIGHT - MARGIN - 50
    c.setFont("Helvetica", 10)
    c.setFillColor(HexColor("#555555"))
    back_info = [
        f"Monte {chart_w} pontos na agulha.",
        f"Tricote {chart_h} carreiras em ponto meia.",
        "Use a mesma lã de fundo do painel da frente.",
        "Arremate todos os pontos no final.",
    ]
    for line in back_info:
        c.drawString(MARGIN + 10, y, f"• {line}")
        y -= 14

    y -= 10
    c.setStrokeColor(HexColor("#CCCCCC"))
    c.line(MARGIN, y, WIDTH - MARGIN, y)
    y -= 16

    c.setFont("Helvetica-Bold", 14)
    c.setFillColor(HexColor("#6B4F8A"))
    c.drawString(MARGIN, y, "Materiais Necessários")
    y -= 20
    c.setFont("Helvetica", 9)
    c.setFillColor(HexColor("#555555"))
    mat_items = [
        f"• Cores de lã: {len(colors)} cores",
        f"• Lã estimada: ~{toy.get('estimated_yarn_grams', 50)}g",
        f"• Agulhas: 3.5mm - 4.5mm",
        f"• Enchimento: ~{toy.get('stuffing_grams', 25)}g de fibra siliconada",
        f"• Olhos de segurança (opcional): 2 unidades",
        f"• Agulha de tapeçaria para costuras",
        f"• Tesoura, alfinetes, fita métrica",
    ]
    for item in mat_items:
        c.drawString(MARGIN + 10, y, f"• {item}")
        y -= 13

    # === PAGE 4: ASSEMBLY ===
    c.showPage()
    c.setFont("Helvetica-Bold", 20)
    c.setFillColor(HexColor("#333333"))
    c.drawString(MARGIN, HEIGHT - MARGIN, "Montagem Passo-a-Passo")
    c.line(MARGIN, HEIGHT - MARGIN - 25, WIDTH - MARGIN, HEIGHT - MARGIN - 25)

    y = HEIGHT - MARGIN - 50
    c.setFont("Helvetica-Bold", 12)
    c.setFillColor(HexColor("#6B4F8A"))

    toy_steps = [
        ("1. Bloquear os Painéis", [
            "Bloqueie os dois painéis (frente e costas) nas medidas finais.",
            "Use alfinetes para prender e deixe secar completamente.",
        ]),
        ("2. Colocar Detalhes (opcional)", [
            "Se for usar olhos de segurança, fixe-os agora no painel da frente.",
            "Pode bordar boca, nariz, bigodes ou outros detalhes.",
            "Use lã preta ou da cor desejada para bordar os detalhes.",
        ]),
        ("3. Coser os Painéis", [
            "Coloque os dois painéis com o direito virado para dentro.",
            "Cosa à volta deixando uma abertura de 8-10 cm na parte inferior.",
            "Use costura invisível (mattress stitch) para melhor acabamento.",
            "Pode coser à máquina ou à mão com pontos pequenos.",
        ]),
        ("4. Encher (Stuffing)", [
            "Desvire o brinquedo para o direito.",
            "Encha com fibra siliconada ou outro enchimento.",
            "Empurre o enchimento para os cantos com um palito ou agulha.",
            "Encha o suficiente para dar forma mas sem deformar os pontos.",
        ]),
        ("5. Fechar a Abertura", [
            "Cosa a abertura com pontos invisíveis.",
            "Use a mesma lã do fundo ou fio de costura.",
            "Certifique-se que o enchimento não fica visível.",
        ]),
        ("6. Acabamentos Finais", [
            "Corte e esconda todos os fios soltos.",
            "Se desejar, adicione uma fita, laço ou etiqueta.",
            "Lave delicadamente se necessário.",
            f"Parabéns! O seu {toy_name} está pronto!",
        ]),
    ]

    for title, bullets in toy_steps:
        if y < 70:
            c.showPage()
            y = HEIGHT - MARGIN - 30
            c.setFont("Helvetica-Bold", 12)
            c.setFillColor(HexColor("#6B4F8A"))

        c.drawString(MARGIN + 5, y, title)
        y -= 14
        c.setFont("Helvetica", 8)
        c.setFillColor(HexColor("#555555"))
        for bullet in bullets:
            c.drawString(MARGIN + 15, y, f"• {bullet}")
            y -= 11
        c.setFont("Helvetica-Bold", 12)
        c.setFillColor(HexColor("#6B4F8A"))
        y -= 6

    # === PAGE 5: TIPS ===
    c.showPage()
    c.setFont("Helvetica-Bold", 20)
    c.setFillColor(HexColor("#333333"))
    c.drawString(MARGIN, HEIGHT - MARGIN, "Dicas para Brinquedos de Tricô")
    c.line(MARGIN, HEIGHT - MARGIN - 25, WIDTH - MARGIN, HEIGHT - MARGIN - 25)

    y = HEIGHT - MARGIN - 50
    c.setFont("Helvetica-Bold", 12)
    c.setFillColor(HexColor("#6B4F8A"))

    sections = [
        ("Segurança", [
            "Para crianças pequenas, evite olhos de plástico — borde os olhos.",
            "Use lã hipoalergénica se for para bebés.",
            "Certifique-se que todos os fios estão bem presos.",
        ]),
        ("Personalização", [
            "Pode adicionar orelhas, asas, braços e pernas.",
            "Para orelhas: tricote 2 triângulos pequenos e cosa ao topo.",
            "Para braços/pernas: tricote tubos em ponto meia e encha.",
            "Use cores diferentes para criar detalhes únicos.",
        ]),
        ("Variações", [
            "Almofada: use o gráfico como almofada decorativa (sem enchimento).",
            "Mini: reduza o tamanho do gráfico para fazer versões menores.",
            "Manta: use vários gráficos para criar uma manta de histórias.",
        ]),
    ]

    for title, bullets in sections:
        if y < 70:
            c.showPage()
            y = HEIGHT - MARGIN - 30
            c.setFont("Helvetica-Bold", 12)
            c.setFillColor(HexColor("#6B4F8A"))

        c.drawString(MARGIN + 5, y, title)
        y -= 14
        c.setFont("Helvetica", 9)
        c.setFillColor(HexColor("#555555"))
        for bullet in bullets:
            c.drawString(MARGIN + 15, y, f"• {bullet}")
            y -= 12
        c.setFont("Helvetica-Bold", 12)
        c.setFillColor(HexColor("#6B4F8A"))
        y -= 6

    # Footer
    c.showPage()
    c.setFont("Helvetica-Bold", 16)
    c.setFillColor(HexColor("#333333"))
    c.drawString(MARGIN, HEIGHT - MARGIN, "Pointy Lines")
    c.setFont("Helvetica", 11)
    c.setFillColor(HexColor("#6B4F8A"))
    c.drawString(MARGIN, HEIGHT - MARGIN - 20, "Brinquedo gerado a partir da sua imagem!")

    c.line(MARGIN, HEIGHT - MARGIN - 30, WIDTH - MARGIN, HEIGHT - MARGIN - 30)

    y = HEIGHT - MARGIN - 55
    c.setFont("Helvetica", 9)
    c.setFillColor(HexColor("#555555"))
    for line in [
        "Este padrão foi gerado automaticamente pela Pointy Lines App.",
        f"Brinquedo: {toy_name}  |  Tamanho: {size}",
        f"Amostra: {gauge_st} pts x {gauge_rows} carr = 10 cm",
        "",
        "Técnicas necessárias:",
        "• Ponto meia e liga",
        "• Acompanhar gráfico colorido",
        "• Costura invisível (mattress stitch)",
        "• Aumentos e diminuições básicos (opcional para formas 3D)",
        "",
        "Partilhe o seu resultado: #KnittingPatternMaker",
    ]:
        c.drawString(MARGIN, y, line)
        y -= 13

    y -= 15
    c.line(MARGIN, y, WIDTH - MARGIN, y)
    y -= 15
    c.setFont("Helvetica", 8)
    c.setFillColor(HexColor("#999999"))
    c.drawString(MARGIN, y, "Todas as medidas são aproximadas. Ajuste conforme necessário.")
    c.drawString(MARGIN, y - 12, "Cada quadrado = 1 ponto na cor indicada")
    c.drawString(MARGIN, y - 24, "© Pointy Lines - Gerado digitalmente")

    c.save()


STITCH_SYMBOLS = {
    "m": {"symbol": "m", "name": "Meia", "desc": "Ponto meia (direito)", "name_en": "RS", "desc_en": "Right side (knit)"},
    "l": {"symbol": "l", "name": "Liga", "desc": "Ponto liga (avesso)", "name_en": "WS", "desc_en": "Wrong side (purl)"},
    "t": {"symbol": "t", "name": "Torcido", "desc": "Ponto torcido", "name_en": "C", "desc_en": "Cable stitch"},
    "b": {"symbol": "b", "name": "Buraco", "desc": "Laçada / buraco", "name_en": "H", "desc_en": "Hole / yarn over"},
    "bo": {"symbol": "bo", "name": "Bola", "desc": "Bola (nó)", "name_en": "B", "desc_en": "Ball / bobble"},
    "2pm": {"symbol": "2pM", "name": "2pM", "desc": "2 pontos meia juntos", "name_en": "K2tog", "desc_en": "Knit 2 together"},
    "3pm": {"symbol": "3pM", "name": "3pM", "desc": "3 pontos meia juntos", "name_en": "K3tog", "desc_en": "Knit 3 together"},
    "_": {"symbol": "✕", "name": "Fora", "desc": "Fora da forma da peça", "name_en": "✕", "desc_en": "Outside shape"},
}


def draw_chart(c, grid, title, label_top, cell_size_override=None):
    chart_h = len(grid)
    chart_w = len(grid[0]) if grid else 0
    if chart_w == 0 or chart_h == 0:
        return

    c.setFont("Helvetica-Bold", 14)
    c.setFillColor(HexColor("#333333"))
    c.drawString(MARGIN, HEIGHT - MARGIN, title)
    c.setFont("Helvetica", 10)
    c.setFillColor(HexColor("#666666"))
    c.drawString(MARGIN, HEIGHT - MARGIN - 18, f"{chart_w} pts x {chart_h} carr")

    mw = WIDTH - 2 * MARGIN
    mh = HEIGHT - 2 * MARGIN - 110
    cell_size = cell_size_override or min(mw // max(chart_w, 1), mh // max(chart_h, 1), 14)
    cell_size = max(cell_size, 4)

    label_w = 16
    header_h = 12
    avail_w = mw - label_w
    cx = MARGIN + label_w
    cy = HEIGHT - MARGIN - 45 - header_h

    # Column numbers (top)
    num_fs = min(cell_size * 0.5, 8)
    c.setFont("Helvetica", num_fs)
    c.setFillColor(HexColor("#888888"))
    for x in range(chart_w):
        nx = cx + x * cell_size + cell_size / 2
        c.drawCentredString(nx, cy + cell_size + 2, str(x + 1))

    # Row numbers (left side)
    for y in range(chart_h):
        rn = chart_h - y
        ry = cy - y * cell_size + cell_size / 2
        c.drawRightString(cx - 4, ry - num_fs * 0.35, str(rn))

    stitch_bg = {
        "m": "#FFFFFF", "l": "#D4E6F1", "t": "#A9DFBF",
        "b": "#FADBD8", "bo": "#D7BDE2", "2pm": "#F9E79F", "3pm": "#F5CBA7",
    }
    _grid_cell_size = cell_size
    _grid_cx = cx
    _grid_cy = cy

    # Grid lines (light grey background grid)
    c.setStrokeColor(HexColor("#D0D0D0"))
    c.setLineWidth(0.3)
    for y in range(chart_h + 1):
        yy = _grid_cy - y * _grid_cell_size
        c.line(_grid_cx, yy, _grid_cx + chart_w * _grid_cell_size, yy)
    for x in range(chart_w + 1):
        xx = _grid_cx + x * _grid_cell_size
        c.line(xx, _grid_cy, xx, _grid_cy - chart_h * _grid_cell_size)

    # Cells
    for y, row in enumerate(grid):
        for x, stitch in enumerate(row):
            px = _grid_cx + x * _grid_cell_size + 0.5
            py = _grid_cy - y * _grid_cell_size - _grid_cell_size + 0.5
            pw = _grid_cell_size - 1
            ph = _grid_cell_size - 1
            if stitch == "_":
                c.setFillColor(HexColor("#E8E8E8"))
                c.rect(px, py, pw, ph, fill=1, stroke=0)
            elif stitch != "m":
                bg = stitch_bg.get(stitch, "#FFFFFF")
                c.setFillColor(HexColor(bg))
                c.rect(px, py, pw, ph, fill=1, stroke=0)

            # Label
            if stitch in STITCH_SYMBOLS:
                sym = STITCH_SYMBOLS[stitch]["symbol"]
                c.setFont("Helvetica", _grid_cell_size * 0.5)
                c.setFillColor(HexColor("#222222"))
                tw = c.stringWidth(sym, "Helvetica", _grid_cell_size * 0.5)
                c.drawString(px + (pw - tw) / 2, py + (ph - _grid_cell_size * 0.5) * 0.35, sym)

    # Legend
    ly = _grid_cy - chart_h * _grid_cell_size - 16
    c.setFont("Helvetica-Bold", 10)
    c.setFillColor(HexColor("#333333"))
    c.drawString(MARGIN, ly, "Legenda:")
    ly -= 14
    c.setFont("Helvetica", 9)
    used = set()
    for row in grid:
        for s in row:
            used.add(s)
    col = 0
    for stitch_key in sorted(used):
        if stitch_key in STITCH_SYMBOLS:
            sx = MARGIN + (col % 2) * 130
            sy = ly - (col // 2) * 16
            swatch_color = stitch_bg.get(stitch_key, "#FFFFFF")
            if stitch_key != "m":
                c.setFillColor(HexColor(swatch_color))
                c.setStrokeColor(HexColor("#CCCCCC"))
                c.setLineWidth(0.2)
                c.rect(sx, sy, 8, 8, fill=1, stroke=1)
            c.setFillColor(HexColor("#222222"))
            c.setFont("Helvetica", 9)
            lab = STITCH_SYMBOLS[stitch_key]["symbol"]
            c.drawString(sx + 12, sy + 1, f"{lab} = {STITCH_SYMBOLS[stitch_key]['name']}")
            col += 1


def generate_stitch_editor_pdf(sections, output_path, garment_type="sweater", gauge_st=22, gauge_rows=30, image_b64=None, is_circular=False, recipe=None, project_name=None, notes=None, recipe_text=None, needle=None, lang='pt'):
    c = canvas.Canvas(output_path, pagesize=A4)

    garment_names = {
        "sweater": "Camisola",
        "pants": "Calças",
        "socks": "Meias",
        "toy": "Boneco",
        "jacket": "Casaco",
    }
    gname = garment_names.get(garment_type, "Peça")

    # Decode optional image
    ref_image = None
    if image_b64:
        try:
            img_data = base64.b64decode(image_b64)
            ref_image = Image.open(BytesIO(img_data))
        except Exception:
            pass

    section_labels = {
        "front": "Frente",
        "back": "Costas",
        "sleeve": "Manga",
        "leg": "Perna",
        "foot": "Pé",
        "front_left": "Frente Esq.",
        "front_right": "Frente Dir.",
        "body": "Corpo",
    }

    # === PAGE 1: COVER ===
    title = project_name if project_name else f"Padrão: {gname}"
    c.setFont("Helvetica-Bold", 24)
    c.setFillColor(HexColor("#333333"))
    c.drawString(MARGIN, HEIGHT - MARGIN, title)
    c.setFont("Helvetica", 13)
    c.setFillColor(HexColor("#6B4F8A"))
    c.drawString(MARGIN, HEIGHT - MARGIN - 22, "Editor de Pontos — Pointy Lines")
    c.line(MARGIN, HEIGHT - MARGIN - 32, WIDTH - MARGIN, HEIGHT - MARGIN - 32)

    y = HEIGHT - MARGIN - 55
    c.setFont("Helvetica", 11)
    c.setFillColor(HexColor("#333333"))
    info_lines = [
        f"Peça: {gname}",
        f"Secções: {', '.join(section_labels.get(s.get('name',''), s.get('name','')) for s in sections)}",
        f"Amostra: {gauge_st} pts x {gauge_rows} carr = 10 cm",
    ]
    if is_circular:
        mode_text = "Tricotado em redondo (circular)"
    else:
        mode_text = "Tricotado em idas e voltas (plano)"
    info_lines.append(mode_text)
    for line in info_lines:
        c.drawString(MARGIN, y, line)
        y -= 16

    if notes:
        y -= 8
        c.setFont("Helvetica-Oblique", 10)
        c.setFillColor(HexColor("#555555"))
        c.drawString(MARGIN, y, "Notas:")
        y -= 14
        c.setFont("Helvetica", 9)
        for note_line in notes.strip().split("\n"):
            if y < 60:
                break
            # word wrap manually
            words = note_line.split()
            line_builder = ""
            for w in words:
                test = line_builder + " " + w if line_builder else w
                if c.stringWidth(test, "Helvetica", 9) > WIDTH - 2 * MARGIN:
                    c.drawString(MARGIN, y, line_builder)
                    y -= 12
                    line_builder = w
                else:
                    line_builder = test
            if line_builder:
                c.drawString(MARGIN, y, line_builder)
                y -= 12
        c.setFont("Helvetica", 9)
        c.setFillColor(HexColor("#888888"))
        y -= 8

    if ref_image:
        c.drawString(MARGIN, y - 8, "Veja nas páginas seguintes: gráfico de cada secção, foto de referência e guia de montagem.")
    else:
        c.drawString(MARGIN, y - 8, "Veja nas páginas seguintes: gráfico de cada secção e guia de montagem.")

    # Draw reference image on cover if provided
    if ref_image:
        img_width, img_height = ref_image.size
        max_w = WIDTH - 2 * MARGIN
        max_h = y - 80
        scale = min(max_w / img_width, max_h / img_height, 0.8)
        display_w = int(img_width * scale)
        display_h = int(img_height * scale)
        ix = MARGIN + (max_w - display_w) // 2
        iy = y - 50 - display_h
        c.drawImage(ImageReader(ref_image), ix, iy, width=display_w, height=display_h)

    # === PAGES 2+ : CHARTS (one per section) ===
    for i, sec in enumerate(sections):
        grid = sec.get("grid", [])
        if not grid:
            continue
        sec_name = sec.get("name", "")
        sec_label = section_labels.get(sec_name, sec_name)
        c.showPage()
        draw_chart(c, grid, f"{sec_label} — Gráfico de Pontos", gname)

    # === RECIPE PAGES (if recipe data available) ===
    if recipe or recipe_text:
        c.showPage()
        c.setFont("Helvetica-Bold", 18)
        c.setFillColor(HexColor("#333333"))
        c.drawString(MARGIN, HEIGHT - MARGIN, f"Receita: {gname}")
        c.setFont("Helvetica", 10)
        c.setFillColor(HexColor("#6B4F8A"))
        if recipe_text:
            c.drawString(MARGIN, HEIGHT - MARGIN - 20, "Notas e instruções personalizadas")
        else:
            c.drawString(MARGIN, HEIGHT - MARGIN - 20, "Instruções passo a passo geradas automaticamente")
        c.line(MARGIN, HEIGHT - MARGIN - 30, WIDTH - MARGIN, HEIGHT - MARGIN - 30)

        y = HEIGHT - MARGIN - 55

        if recipe_text:
            c.setFont("Helvetica", 10)
            c.setFillColor(HexColor("#333333"))
            if needle:
                c.drawString(MARGIN, y, f"Agulha: {needle}")
                y -= 14
            for line in recipe_text.strip().split("\n"):
                if y < 40:
                    c.showPage()
                    y = HEIGHT - MARGIN
                # word wrap
                words = line.split()
                line_builder = ""
                for w in words:
                    test = line_builder + " " + w if line_builder else w
                    if c.stringWidth(test, "Helvetica", 10) > WIDTH - 2 * MARGIN:
                        c.drawString(MARGIN, y, line_builder)
                        y -= 14
                        line_builder = w
                    else:
                        line_builder = test
                if line_builder:
                    c.drawString(MARGIN, y, line_builder)
                    y -= 14
        elif recipe:
            c.setFont("Helvetica", 11)
            c.setFillColor(HexColor("#555555"))
            c.drawString(MARGIN, y, f"Agulha recomendada: {needle or recipe.get('needle', '—')}")
            y -= 16
            c.drawString(MARGIN, y, f"Amostra: {recipe.get('gauge', '—')}")
            y -= 16
            c.drawString(MARGIN, y, f"Lã estimada: {recipe.get('yarn_estimate', '—')}")
            y -= 16
            c.drawString(MARGIN, y, f"Total: {recipe.get('total_stitches', 0)} pts x {recipe.get('total_rows', 0)} carr")
            y -= 22
            c.line(MARGIN, y, WIDTH - MARGIN, y)
            y -= 18

            for sec_inst in recipe.get("section_instructions", []):
                label = sec_inst.get("label", "")
                detected = sec_inst.get("detected_pattern", "")
                inc_count = sec_inst.get("increases", 0)
                dec_count = sec_inst.get("decreases", 0)

                lines = sec_inst.get("instructions", [])
                title = f"«{label}»"
                if detected:
                    title += f" — Padrão: {detected}"
                title += f"  |  ↑{inc_count}  ↓{dec_count}"

                if y < 60:
                    c.showPage()
                    y = HEIGHT - MARGIN

                c.setFont("Helvetica-Bold", 12)
                c.setFillColor(HexColor("#6B4F8A"))
                c.drawString(MARGIN + 5, y, title)
                y -= 18

                c.setFont("Helvetica", 10)
                c.setFillColor(HexColor("#333333"))
                for line in lines:
                    if y < 40:
                        c.showPage()
                        y = HEIGHT - MARGIN
                    c.drawString(MARGIN + 10, y, line)
                    y -= 14
                y -= 10

    # === LAST PAGE: GARMENT GUIDE ===
    c.showPage()
    c.setFont("Helvetica-Bold", 18)
    c.setFillColor(HexColor("#333333"))
    c.drawString(MARGIN, HEIGHT - MARGIN, f"Guia de Montagem: {gname}")
    c.line(MARGIN, HEIGHT - MARGIN - 25, WIDTH - MARGIN, HEIGHT - MARGIN - 25)

    y = HEIGHT - MARGIN - 50
    c.setFont("Helvetica-Bold", 14)
    legend_title = "Legenda de Símbolos" if lang == 'pt' else "Legend"
    c.drawString(MARGIN, y, legend_title)
    y -= 22
    c.setFont("Helvetica", 10)
    stitch_colors = {
        "m": "#FFFFFF", "l": "#D4E6F1", "t": "#A9DFBF",
        "b": "#FADBD8", "bo": "#D7BDE2", "2pm": "#F9E79F", "3pm": "#F5CBA7",
    }
    for k, v in sorted(STITCH_SYMBOLS.items()):
        col = stitch_colors.get(k, "#FFFFFF")
        if k != "m":
            c.setFillColor(HexColor(col))
            c.rect(MARGIN + 10, y - 2, 8, 8, fill=1, stroke=0)
        c.setFillColor(HexColor("#333333"))
        name = v.get('name_en', v['name']) if lang == 'en' else v['name']
        desc = v.get('desc_en', v['desc']) if lang == 'en' else v['desc']
        c.drawString(MARGIN + 22, y, f"{v['symbol']} = {name} — {desc}")
        y -= 16

    y -= 10
    c.line(MARGIN, y, WIDTH - MARGIN, y)
    y -= 20

    c.setFont("Helvetica-Bold", 14)
    read_title = "How to Read the Chart" if lang == 'en' else "Como Ler o Gráfico"
    c.drawString(MARGIN, y, read_title)
    y -= 22
    c.setFont("Helvetica", 10)
    if lang == 'en':
        reading_instructions = [
            "• Each square represents 1 stitch.",
            "• Read from bottom to top (row 1 to last).",
        ]
        if is_circular:
            reading_instructions.append("• IN THE ROUND: all rows are read from right to left.")
            reading_instructions.append("• Each complete round = 1 row on circular needle.")
        else:
            reading_instructions.append("• Right side rows (odd): read from right to left.")
            reading_instructions.append("• Wrong side rows (even): read from left to right.")
        reading_instructions.append("• Follow the symbol in each square for the stitch to make.")
    else:
        reading_instructions = [
            "• Cada quadrado representa 1 ponto.",
            "• Leia de baixo para cima (carreira 1 à última).",
        ]
        if is_circular:
            reading_instructions.append("• EM REDONDO: todas as carreiras se leem da direita para a esquerda.")
            reading_instructions.append("• Cada volta completa do gráfico = 1 volta na agulha circular.")
        else:
            reading_instructions.append("• Carreiras do direito (ímpares): leia da direita para a esquerda.")
            reading_instructions.append("• Carreiras do avesso (pares): leia da esquerda para a direita.")
        reading_instructions.append("• Siga o símbolo em cada quadrado para saber qual ponto fazer.")
    for instr in reading_instructions:
        c.drawString(MARGIN + 10, y, instr)
        y -= 16

    y -= 10
    c.line(MARGIN, y, WIDTH - MARGIN, y)
    y -= 20

    c.setFont("Helvetica-Bold", 14)
    c.drawString(MARGIN, y, f"Instruções para {gname}")
    y -= 22
    c.setFont("Helvetica", 10)

    # Gather section widths for guide
    sec_widths = {sec.get("name", ""): len(sec.get("grid", [[]])[0]) if sec.get("grid") else 0 for sec in sections}
    sec_heights = {sec.get("name", ""): len(sec.get("grid", [])) for sec in sections}
    if is_circular:
        fw = sec_widths.get("body", 0)
        fh = sec_heights.get("body", 0)
        bw = fw
        bh = fh
    else:
        fw = sec_widths.get("front", sec_widths.get("leg", 0))
        fh = sec_heights.get("front", sec_heights.get("leg", 0))
        bw = sec_widths.get("back", sec_widths.get("foot", 0))
        bh = sec_heights.get("back", sec_heights.get("foot", 0))
    sw = sec_widths.get("sleeve", 0)
    sh = sec_heights.get("sleeve", 0)

    sts_per_cm = gauge_st / 10
    rows_per_cm = gauge_rows / 10

    if garment_type == "sweater":
        def cm(v): return round(v / sts_per_cm, 1)
        def cmr(v): return round(v / rows_per_cm, 1)
        if is_circular:
            guide = [
                "Materiais necessários:",
                f"• Lã para amostra de {gauge_st} pts x {gauge_rows} carr = 10 cm",
                "• Agulhas circulares (cabo de 60-80 cm)",
                "• Tesoura, fita métrica, agulha de tapeçaria",
                "",
                "Dimensões finais (aproximadas):",
                f"• Corpo: {cm(fw)} cm largura (frente) x {cmr(fh)} cm altura",
                f"• Manga: {cm(sw)} cm largura x {cmr(sh)} cm altura" if sw else "",
                "",
                "Passo a passo (em redondo):",
                f"1. Monte {fw * 2} pontos (frente + costas) na agulha circular.",
                "2. Una em redondo com cuidado para não torcer.",
                f"3. Siga o gráfico do corpo da carreira 1 à {fh}.",
                "4. Coloque os pontos das mangas à espera (cerca de 1/4 de cada lado).",
                "5. Continue a frente e costas separadamente em idas e voltas.",
                "6. Faça as diminuições do decote conforme o gráfico.",
                "7. Remate os ombros.",
                "8. Levante pontos para a gola e tricote em redondo.",
            ]
            if sw:
                guide.append(f"9. Retome os {sw} pontos da manga em agulhas de pontas duplas ou circular curta.")
                guide.append("10. Siga o gráfico da manga em redondo.")
                guide.append("11. Remate e repita para a outra manga.")
                guide.append("12. Bloqueie a peça.")
            else:
                guide.append("9. Bloqueie a peça.")
        else:
            guide = [
                "Materiais necessários:",
                f"• Lã para amostra de {gauge_st} pts x {gauge_rows} carr = 10 cm",
                "• Agulhas de tricô adequadas à amostra",
                "• Tesoura, fita métrica, agulha de tapeçaria",
                "",
                "Dimensões finais (aproximadas):",
                f"• Frente: {cm(fw)} cm largura x {cmr(fh)} cm altura",
                f"• Costas: {cm(bw)} cm largura x {cmr(bh)} cm altura" if bw else "",
                f"• Manga: {cm(sw)} cm largura x {cmr(sh)} cm altura" if sw else "",
                "",
                "Passo a passo:",
                f"1. Monte {fw} pontos para a frente.",
                f"2. Siga o gráfico da carreira 1 à {fh}.",
                "3. Remate todos os pontos.",
                f"4. Monte {bw or fw} pontos para as costas e repita o gráfico.",
                f"5. Costure os ombros (cerca de 1/3 da largura).",
                "6. Levante pontos para a gola e tricote em canelado.",
            ]
            if sw:
                guide.append(f"7. Monte {sw} pontos para a manga e siga o gráfico.")
                guide.append("8. Costure as mangas às cavas.")
                guide.append("9. Costure os lados da camisola e das mangas.")
                guide.append("10. Bloqueie a peça.")
            else:
                guide.append("7. Costure as mangas (se aplicável) ou cavas.")
                guide.append("8. Costure os lados da camisola.")
                guide.append("9. Bloqueie a peça.")
    elif garment_type == "pants":
        def cm(v): return round(v / sts_per_cm, 1)
        def cmr(v): return round(v / rows_per_cm, 1)
        if is_circular:
            guide = [
                "Materiais necessários:",
                f"• Lã para amostra de {gauge_st} pts x {gauge_rows} carr = 10 cm",
                "• Agulhas circulares (cabo longo) ou de pontas duplas",
                "• Tesoura, fita métrica, agulha de tapeçaria",
                "",
                "Dimensões finais (aproximadas):",
                f"• Corpo: {cm(fw)} cm largura x {cmr(fh)} cm altura",
                "",
                "Passo a passo (em redondo):",
                f"1. Monte {fw * 2} pontos para o corpo na agulha circular.",
                "2. Una em redondo sem torcer.",
                f"3. Siga o gráfico da carreira 1 à {fh}.",
                "4. Separe os pontos ao meio para cada perna.",
                "5. Continue cada perna em redondo nas agulhas de pontas duplas.",
                "6. Faça as diminuições progressivas para a barra da perna.",
                "7. Remate e repita para a segunda perna.",
                "8. Levante pontos à volta da cintura para o cós.",
                "9. Tricote o cós em canelado (2/2) por 5-8 cm.",
                "10. Passe um elástico se desejar. Bloqueie.",
            ]
        else:
            guide = [
                "Materiais necessários:",
                f"• Lã para amostra de {gauge_st} pts x {gauge_rows} carr = 10 cm",
                "• Agulhas de tricô adequadas",
                "• Tesoura, fita métrica, agulha de tapeçaria",
                "",
                "Dimensões finais (aproximadas):",
                f"• Frente (cada perna): {cm(fw)} cm largura x {cmr(fh)} cm altura" if fw else "",
                f"• Costas (cada perna): {cm(bw)} cm largura x {cmr(bh)} cm altura" if bw else "",
                "",
                "Passo a passo:",
                f"1. Monte {fw} pontos para a perna da frente.",
                f"2. Siga o gráfico da carreira 1 à {fh}.",
                "3. Remate e repita para a segunda perna da frente.",
                f"4. Monte {bw} pontos para a perna de trás e siga o gráfico.",
                "5. Remate e repita para a segunda perna de trás.",
                "6. Costure a parte interior de cada perna (frente + costas).",
                "7. Una as duas pernas e costure a entreperna.",
                "8. Levante pontos à volta da cintura para o cós.",
                "9. Tricote o cós em canelado (2/2) por 5-8 cm.",
                "10. Dobre o cós ao meio e costure por dentro.",
                "11. Passe um elástico se desejar. Bloqueie.",
            ]
    elif garment_type == "socks":
        guide = [
            "Materiais necessários:",
            f"• Lã para amostra de {gauge_st} pts x {gauge_rows} carr = 10 cm",
            "• Agulhas de tricô (2,5mm - 3,5mm para meias)",
            "• Tesoura, fita métrica, agulha de tapeçaria",
            "",
            "Passo a passo:",
            f"1. Monte {fw} pontos para a perna da meia.",
            "2. Tricote o canelado (2/2 ou 1/1) por 4-6 cm.",
            f"3. Siga o gráfico da perna da carreira 1 à {fh}.",
            f"4. Continue para o pé: siga o gráfico do pé ({bh} carreiras)." if bw else "4. Continue para o pé.",
            "5. Tricote o calcanhar (heelflap) em idas e voltas.",
            "6. Faça as diminuições do calcanhar (gusset).",
            "7. Continue o pé até ao comprimento desejado.",
            "8. Faça as diminuições da ponta do pé (toe).",
            "9. Remate e costure a ponta.",
            "10. Repita para a segunda meia.",
        ]
    elif garment_type == "toy":
        if is_circular:
            guide = [
                "Materiais necessários:",
                f"• Lã para amostra de {gauge_st} pts x {gauge_rows} carr = 10 cm",
                "• Agulhas de pontas duplas ou circular",
                "• Enchimento de fibra siliconada",
                "• Tesoura, agulha de tapeçaria",
                "",
                "Passo a passo (em redondo):",
                f"1. Monte {fw} pontos na agulha circular.",
                "2. Una em redondo sem torcer.",
                f"3. Siga o gráfico do corpo da carreira 1 à {fh}.",
                "4. Remate os pontos com folga.",
                "5. Costure a base e o topo.",
                "6. Desvire para o direito.",
                "7. Encha com fibra siliconada.",
                "8. Feche as aberturas com costura invisível.",
                "9. Adicione olhos, boca ou outros detalhes se desejar.",
            ]
        else:
            guide = [
                "Materiais necessários:",
                f"• Lã para amostra de {gauge_st} pts x {gauge_rows} carr = 10 cm",
                "• Agulhas de tricô adequadas",
                "• Enchimento de fibra siliconada",
                "• Tesoura, agulha de tapeçaria",
                "",
                "Passo a passo:",
                f"1. Monte {fw} pontos para o painel da frente.",
                f"2. Siga o gráfico da carreira 1 à {fh}.",
                "3. Remate todos os pontos.",
                f"4. Monte {bw or fw} pontos para o painel de trás e siga o gráfico.",
                "5. Coloque os dois painéis frente com frente.",
                "6. Costure à volta, deixando uma abertura de 5 cm.",
                "7. Desvire para o direito.",
                "8. Encha com fibra siliconada.",
                "9. Feche a abertura com costura invisível.",
                "10. Adicione olhos, boca ou outros detalhes se desejar.",
            ]

    # Filter empty strings from guide
    guide = [g for g in guide if g]

    for line in guide:
        c.drawString(MARGIN + 10, y, line)
        y -= 14

    y -= 10
    c.line(MARGIN, y, WIDTH - MARGIN, y)
    y -= 18
    c.setFont("Helvetica-Bold", 14)
    c.drawString(MARGIN, y, "Dicas Finais")
    y -= 20
    c.setFont("Helvetica", 10)
    for tip in [
        "• Use marcadores para separar repetições do padrão.",
        "• Mantenha a tensão constante para um acabamento uniforme.",
        "• Bloqueie a peça no final para assentar os pontos.",
        "• Lave com água fria e sabão neutro para lã.",
        "• Seque na horizontal para manter a forma.",
    ]:
        c.drawString(MARGIN + 10, y, tip)
        y -= 14

    c.save()


def generate_stitch_preview(grid, cell_size=40):
    """Generate a visual preview image of a stitch grid. Returns base64 PNG."""
    h = len(grid)
    w = len(grid[0]) if grid else 0
    if w == 0 or h == 0:
        return None

    img = Image.new("RGB", (w * cell_size, h * cell_size), "#FCF5EB")
    draw = ImageDraw.Draw(img)
    cs = cell_size
    yarn = "#A0845C"
    bobble = "#6B4F8A"

    for y, row in enumerate(grid):
        for x, stitch in enumerate(row):
            px = x * cs
            py = y * cs
            draw.rectangle([px, py, px + cs - 1, py + cs - 1], outline="#DDD", fill="#FCF5EB")

            if stitch == 'm':
                cx, cy = px + cs // 2, py + cs // 2
                r = cs * 0.35
                draw.line([(cx - r, cy - r), (cx, cy + r * 0.6)], fill=yarn, width=max(2, cs // 15))
                draw.line([(cx + r, cy - r), (cx, cy + r * 0.6)], fill=yarn, width=max(2, cs // 15))
            elif stitch == 'l':
                cx, cy = px + cs // 2, py + cs // 2
                r = cs * 0.3
                for i in range(3):
                    bx = cx - r + i * r
                    draw.arc([bx - 3, cy - 5, bx + 3, cy + 5], 0, 180, fill=yarn, width=max(2, cs // 15))
            elif stitch == 't':
                cx, cy = px + cs // 2, py + cs // 2
                r = cs * 0.35
                draw.line([(cx - r, cy - r), (cx + r, cy + r)], fill=yarn, width=max(2, cs // 15))
                draw.line([(cx + r, cy - r), (cx - r, cy + r)], fill=yarn, width=max(2, cs // 15))
                draw.line([(cx - r, cy), (cx + r, cy)], fill=yarn, width=max(1, cs // 20))
            elif stitch == 'b':
                cx, cy = px + cs // 2, py + cs // 2
                r = cs * 0.3
                draw.ellipse([cx - r, cy - r, cx + r, cy + r], outline=yarn, width=max(2, cs // 15))
            elif stitch == 'bo':
                cx, cy = px + cs // 2, py + cs // 2
                r = cs * 0.32
                draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=bobble)
                draw.ellipse([cx - r * 0.5, cy - r * 0.5, cx + r * 0.5, cy + r * 0.5], fill="#8B6FAE")
            elif stitch == '2pm':
                cx, cy = px + cs // 2, py + cs // 2
                r = cs * 0.35
                draw.line([(cx - r, cy - r), (cx - r * 0.2, cy + r * 0.4)], fill=yarn, width=max(2, cs // 15))
                draw.line([(cx + r * 0.2, cy - r), (cx - r * 0.2, cy + r * 0.4)], fill=yarn, width=max(2, cs // 15))
                draw.line([(cx - r * 0.2, cy + r * 0.4), (cx - r * 0.2, cy + r)], fill=yarn, width=max(2, cs // 15))
            elif stitch == '3pm':
                cx, cy = px + cs // 2, py + cs // 2
                r = cs * 0.35
                draw.line([(cx - r, cy - r), (cx - r * 0.15, cy + r * 0.3)], fill=yarn, width=max(2, cs // 15))
                draw.line([(cx, cy - r), (cx - r * 0.15, cy + r * 0.3)], fill=yarn, width=max(2, cs // 15))
                draw.line([(cx + r, cy - r), (cx - r * 0.15, cy + r * 0.3)], fill=yarn, width=max(2, cs // 15))
                draw.line([(cx - r * 0.15, cy + r * 0.3), (cx - r * 0.15, cy + r)], fill=yarn, width=max(2, cs // 15))

    buf = BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    return base64.b64encode(buf.read()).decode()


JACQUARD_COLORS = {
    "white": "#FFFFFF", "black": "#1A1A1A", "red": "#CC0000",
    "nvy": "#1A237E", "blue": "#1976D2", "lblue": "#64B5F6",
    "green": "#2E7D32", "lime": "#8BC34A", "yellow": "#FDD835",
    "orange": "#EF6C00", "purple": "#8E44AD", "pink": "#E91E63",
    "brown": "#795548", "gray": "#9E9E9E", "cream": "#F5E6D0",
    "wine": "#880E4F",
}


def generate_colorwork_editor_pdf(sections, output_path, garment_type="sweater", gauge_st=22, gauge_rows=30, image_b64=None, colors=None):
    c = canvas.Canvas(output_path, pagesize=A4)

    garment_names = {
        "sweater": "Camisola", "pants": "Calças", "socks": "Meias", "toy": "Boneco", "jacket": "Casaco",
    }
    gname = garment_names.get(garment_type, "Peça")

    section_labels = {"front": "Frente", "back": "Costas", "sleeve": "Manga", "leg": "Perna", "foot": "Pé", "front_left": "Frente Esq.", "front_right": "Frente Dir."}

    # Decode optional image
    ref_image = None
    if image_b64:
        try:
            img_data = base64.b64decode(image_b64)
            ref_image = Image.open(BytesIO(img_data))
        except Exception:
            pass

    # === PAGE 1: COVER ===
    c.setFont("Helvetica-Bold", 24)
    c.setFillColor(HexColor("#1A237E"))
    c.drawString(MARGIN, HEIGHT - MARGIN, f"Padrão Jacquard: {gname}")
    c.setFont("Helvetica", 13)
    c.setFillColor(HexColor("#1A237E"))
    c.drawString(MARGIN, HEIGHT - MARGIN - 22, "Editor Jacquard — Pointy Lines")
    c.line(MARGIN, HEIGHT - MARGIN - 32, WIDTH - MARGIN, HEIGHT - MARGIN - 32)

    y = HEIGHT - MARGIN - 55
    c.setFont("Helvetica", 11)
    c.setFillColor(HexColor("#333333"))
    for line in [
        f"Peça: {gname}",
        f"Secções: {', '.join(section_labels.get(s.get('name',''), s.get('name','')) for s in sections)}",
        f"Amostra: {gauge_st} pts x {gauge_rows} carr = 10 cm",
        "Tipo: Jacquard / Colorwork",
    ]:
        c.drawString(MARGIN, y, line)
        y -= 16

    c.setFont("Helvetica", 9)
    c.setFillColor(HexColor("#888888"))
    if ref_image:
        c.drawString(MARGIN, y - 8, "Veja nas páginas seguintes: gráfico colorido, foto de referência e guia.")
    else:
        c.drawString(MARGIN, y - 8, "Veja nas páginas seguintes: gráfico colorido e guia de montagem.")

    if ref_image:
        img_width, img_height = ref_image.size
        max_w = WIDTH - 2 * MARGIN
        max_h = y - 80
        scale = min(max_w / img_width, max_h / img_height, 0.8)
        display_w = int(img_width * scale)
        display_h = int(img_height * scale)
        ix = MARGIN + (max_w - display_w) // 2
        iy = y - 50 - display_h
        c.drawImage(ImageReader(ref_image), ix, iy, width=display_w, height=display_h)

    # === PAGES 2+ : CHARTS ===
    for i, sec in enumerate(sections):
        grid = sec.get("grid", [])
        if not grid:
            continue
        sec_name = sec.get("name", "")
        sec_label = section_labels.get(sec_name, sec_name)
        c.showPage()

        chart_h = len(grid)
        chart_w = len(grid[0]) if grid else 0
        if chart_w == 0 or chart_h == 0:
            continue

        c.setFont("Helvetica-Bold", 14)
        c.setFillColor(HexColor("#1A237E"))
        c.drawString(MARGIN, HEIGHT - MARGIN, f"{sec_label} — Gráfico Jacquard")
        c.setFont("Helvetica", 10)
        c.setFillColor(HexColor("#666666"))
        c.drawString(MARGIN, HEIGHT - MARGIN - 18, f"{chart_w} pts x {chart_h} carr")

        mw = WIDTH - 2 * MARGIN
        mh = HEIGHT - 2 * MARGIN - 110
        cell_size = min(mw // max(chart_w, 1), mh // max(chart_h, 1), 12)
        cell_size = max(cell_size, 4)

        cx = MARGIN + (mw - chart_w * cell_size) / 2
        cy = HEIGHT - MARGIN - 45

        # Blue border behind chart

        for y, row in enumerate(grid):
            for x, stitch in enumerate(row):
                px = cx + x * cell_size
                py = cy - y * cell_size
                cx2 = px + cell_size / 2
                cy2 = py + cell_size / 2
                r = cell_size * 0.42
                if stitch == "_":
                    c.setFillColor(HexColor("#E8E8E8"))
                    c.setStrokeColor(HexColor("#E0E0E0"))
                    c.setLineWidth(0.2)
                else:
                    color_hex = JACQUARD_COLORS.get(stitch, "#FFFFFF")
                    c.setFillColor(HexColor(color_hex))
                    c.setStrokeColor(HexColor("#CCCCCC"))
                    c.setLineWidth(0.3)
                c.circle(cx2, cy2, r, fill=1, stroke=1)

        # Legend with color swatches
        ly = cy - chart_h * cell_size - 16
        c.setFont("Helvetica-Bold", 10)
        c.setFillColor(HexColor("#1A237E"))
        c.drawString(MARGIN, ly, "Cores usadas:")
        ly -= 14
        c.setFont("Helvetica", 9)
        used = set()
        for row in grid:
            for s in row:
                used.add(s)
        col = 0
        for ckey in sorted(used):
            if ckey in JACQUARD_COLORS:
                sx = MARGIN + (col % 2) * 130
                sy = ly - (col // 2) * 16
                chex = JACQUARD_COLORS[ckey]
                c.setFillColor(HexColor(chex))
                c.setStrokeColor(HexColor("#999999"))
                c.setLineWidth(0.5)
                c.circle(sx + 4, sy + 2, 4, fill=1, stroke=1)
                clabel = ckey
                if colors:
                    for col_def in colors:
                        if col_def.get("key") == ckey:
                            clabel = col_def.get("label", ckey)
                            break
                c.setFillColor(HexColor("#222222"))
                c.drawString(sx + 12, sy, clabel)
                col += 1

    # === LAST PAGE: GARMENT GUIDE ===
    c.showPage()
    c.setFont("Helvetica-Bold", 18)
    c.setFillColor(HexColor("#1A237E"))
    c.drawString(MARGIN, HEIGHT - MARGIN, f"Guia de Montagem: {gname}")
    c.line(MARGIN, HEIGHT - MARGIN - 25, WIDTH - MARGIN, HEIGHT - MARGIN - 25)

    y = HEIGHT - MARGIN - 50
    c.setFont("Helvetica-Bold", 14)
    c.setFillColor(HexColor("#1A237E"))
    c.drawString(MARGIN, y, "Cores disponíveis")
    y -= 22
    c.setFont("Helvetica", 10)
    c.setFillColor(HexColor("#333333"))
    for ckey, chex in sorted(JACQUARD_COLORS.items()):
        c.setFillColor(HexColor(chex))
        c.rect(MARGIN + 10, y - 2, 8, 8, fill=1, stroke=0)
        clabel = ckey
        if colors:
            for col_def in colors:
                if col_def.get("key") == ckey:
                    clabel = col_def.get("label", ckey)
                    break
        c.setFillColor(HexColor("#333333"))
        c.drawString(MARGIN + 22, y, clabel)
        y -= 16

    y -= 10
    c.line(MARGIN, y, WIDTH - MARGIN, y)
    y -= 20

    c.setFont("Helvetica-Bold", 14)
    c.setFillColor(HexColor("#1A237E"))
    c.drawString(MARGIN, y, "Como Ler o Gráfico")
    y -= 22
    c.setFont("Helvetica", 10)
    c.setFillColor(HexColor("#333333"))
    for instr in [
        "• Cada quadrado representa 1 ponto na cor indicada.",
        "• Leia de baixo para cima (carreira 1 à última).",
        "• Carreiras do direito (ímpares): leia da direita para a esquerda.",
        "• Carreiras do avesso (pares): leia da esquerda para a direita.",
        "• Troque de cor conforme o gráfico, sem cortar o fio.",
    ]:
        c.drawString(MARGIN + 10, y, instr)
        y -= 16

    y -= 10
    c.line(MARGIN, y, WIDTH - MARGIN, y)
    y -= 20

    c.setFont("Helvetica-Bold", 14)
    c.setFillColor(HexColor("#1A237E"))
    c.drawString(MARGIN, y, f"Instruções para {gname}")
    y -= 22
    c.setFont("Helvetica", 10)
    c.setFillColor(HexColor("#333333"))

    sec_widths = {sec.get("name", ""): len(sec.get("grid", [[]])[0]) if sec.get("grid") else 0 for sec in sections}
    sec_heights = {sec.get("name", ""): len(sec.get("grid", [])) for sec in sections}
    fw = sec_widths.get("front", sec_widths.get("leg", 0))

    if garment_type == "sweater":
        guide = [
            "Materiais necessários:",
            f"• Lã para amostra de {gauge_st} pts x {gauge_rows} carr = 10 cm",
            "• 2-4 cores de lã conforme o gráfico",
            "• Agulhas adequadas à amostra",
            "• Tesoura, fita métrica, agulha de tapeçaria",
            "",
            "Dicas para jacquard:",
            "• Mantenha a tensão uniforme ao trocar de cor.",
            "• Não puxe o fio solto com mais de 5 pts.",
            "• Torça os fios ao mudar de cor para evitar buracos.",
        ]
    elif garment_type == "pants":
        guide = [
            "Materiais necessários:",
            f"• Lã para amostra de {gauge_st} pts x {gauge_rows} carr = 10 cm",
            "• 2-4 cores de lã conforme o gráfico",
            "• Agulhas adequadas",
            "• Elástico para o cós (opcional)",
            "",
            "Dicas para jacquard:",
            "• Mantenha a tensão uniforme ao trocar de cor.",
            "• Torça os fios ao mudar de cor para evitar buracos.",
        ]
    else:
        guide = [
            "Materiais necessários:",
            f"• Lã para amostra de {gauge_st} pts x {gauge_rows} carr = 10 cm",
            "• Cores conforme o gráfico",
            "• Agulhas adequadas",
            "",
            "Siga o gráfico de cores carreira a carreira.",
            "Troque de cor conforme indicado em cada quadrado.",
        ]

    for line in guide:
        c.drawString(MARGIN + 10, y, line)
        y -= 14

    c.save()