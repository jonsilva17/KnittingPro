import os
import uuid
import base64
import traceback
from io import BytesIO
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from dotenv import load_dotenv
from pattern_maker import process_image_to_pattern, convert_image_to_stitch_grid
from pdf_generator import generate_pattern_pdf, generate_sweater_pdf, generate_stitch_blanket_pdf, generate_toy_pdf, generate_stitch_editor_pdf, generate_stitch_preview, generate_colorwork_editor_pdf
from sweater_pattern import generate_sweater_pattern
from stitch_patterns import generate_stitch_blanket, STITCH_PATTERNS, PATTERN_KEYS
from stitch_library import get_all_patterns, save_custom_pattern, delete_custom_pattern, CATEGORIES, load_custom_patterns
from recipe_generator import generate_recipe
from ai_chart import generate_grid, PROVIDERS as AI_PROVIDERS

load_dotenv()

app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024
CORS(app)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOAD_FOLDER = os.path.join(BASE_DIR, 'uploads')
OUTPUT_FOLDER = os.path.join(BASE_DIR, 'output')
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(OUTPUT_FOLDER, exist_ok=True)


@app.route('/')
def index():
    return jsonify({"status": "ok", "app": "Pointy Lines", "version": "1.0"})

@app.route('/api/convert', methods=['POST'])
def convert_image():
    try:
        data = request.get_json()
        if not data or 'image_base64' not in data:
            return jsonify({"error": "Nenhuma imagem enviada"}), 400

        image_data = base64.b64decode(data['image_base64'])
        colors = int(data.get('colors', 6))
        width = int(data.get('width', 80))
        height = int(data.get('height', 100))

        filename = f"{uuid.uuid4()}.jpg"
        input_path = os.path.join(UPLOAD_FOLDER, filename)
        with open(input_path, 'wb') as f:
            f.write(image_data)

        result = process_image_to_pattern(input_path, colors, width, height)

        pdf_url = None
        try:
            pdf_filename = f"{uuid.uuid4()}.pdf"
            pdf_path = os.path.join(OUTPUT_FOLDER, pdf_filename)
            generate_pattern_pdf(result, pdf_path, original_image_path=input_path)
            pdf_url = f"/api/download/{pdf_filename}"
        except Exception as e:
            print(f"PDF generation skipped: {e}")

        return jsonify({
            "chart": result['chart'],
            "colors": result['colors'],
            "width": result['width'],
            "height": result['height'],
            "materials": result['materials'],
            "pdf_url": pdf_url,
            "preview_url": f"/api/preview/{filename}",
        })

    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route('/api/download/<pdf_name>')
def download_pdf(pdf_name):
    pdf_path = os.path.join(OUTPUT_FOLDER, pdf_name)
    if not os.path.exists(pdf_path):
        return jsonify({"error": "PDF não encontrado"}), 404
    return send_file(pdf_path, as_attachment=True, download_name='padrao_tricot.pdf')


@app.route('/api/preview/<image_name>')
def preview_image(image_name):
    img_path = os.path.join(UPLOAD_FOLDER, image_name)
    if not os.path.exists(img_path):
        # Return a processed preview instead
        alt_path = img_path.rsplit('.', 1)[0] + '_processed.png'
        if os.path.exists(alt_path):
            return send_file(alt_path, mimetype='image/png')
        return jsonify({"error": "Imagem não encontrada"}), 404
    return send_file(img_path)


@app.route('/api/stitch-editor-autofill', methods=['POST'])
def stitch_editor_autofill():
    try:
        data = request.get_json()
        if not data or 'image_base64' not in data:
            return jsonify({"error": "Nenhuma imagem enviada"}), 400

        image_data = base64.b64decode(data['image_base64'])
        width = int(data.get('width', 24))
        height = int(data.get('height', 30))
        threshold = int(data.get('threshold', 128))

        grid = convert_image_to_stitch_grid(image_data, width, height, threshold)
        return jsonify({"grid": grid, "width": width, "height": height})

    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route('/api/sweater-pattern', methods=['POST'])
def sweater_pattern():
    try:
        data = request.get_json()
        if not data or 'image_base64' not in data:
            return jsonify({"error": "Nenhuma imagem enviada"}), 400

        image_data = base64.b64decode(data['image_base64'])
        colors = int(data.get('colors', 6))
        size = data.get('size', 'M')
        gauge_st = int(data.get('gauge_stitches', 22))
        gauge_rows = int(data.get('gauge_rows', 30))
        sleeve_style = data.get('sleeve_style', 'set-in')
        neckline = data.get('neckline', 'crew')
        motif_placement = data.get('motif_placement', 'center')
        sleeve_pattern = data.get('sleeve_pattern') or None
        back_pattern = data.get('back_pattern') or None
        bg_color = int(data.get('bg_color', 0))

        filename = f"{uuid.uuid4()}.jpg"
        input_path = os.path.join(UPLOAD_FOLDER, filename)
        with open(input_path, 'wb') as f:
            f.write(image_data)

        base_result = process_image_to_pattern(input_path, colors, 80, 100)

        sweater = generate_sweater_pattern(
            base_result['chart'], base_result['colors'],
            size, gauge_st, gauge_rows, sleeve_style, neckline,
            motif_placement=motif_placement,
            sleeve_pattern=sleeve_pattern,
            back_pattern=back_pattern,
            bg_color_index=bg_color,
        )

        pdf_filename = f"{uuid.uuid4()}.pdf"
        pdf_path = os.path.join(OUTPUT_FOLDER, pdf_filename)
        generate_sweater_pdf(sweater, pdf_path, original_image_path=input_path)

        sweater['pdf_url'] = f"/api/download/{pdf_filename}"
        sweater['preview_url'] = f"/api/preview/{filename}"
        sweater['base_colors'] = base_result['colors']

        return jsonify(sweater)

    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route('/api/stitch-blanket', methods=['POST'])
def stitch_blanket():
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "Dados inválidos"}), 400

        patterns = data.get('patterns', [])
        if not patterns:
            return jsonify({"error": "Selecione pelo menos um padrão"}), 400

        chart_width = int(data.get('chart_width', 100))
        section_rows = int(data.get('section_rows', 20))
        border_rows = int(data.get('border_rows', 6))

        result = generate_stitch_blanket(patterns, chart_width, section_rows, border_rows)

        pdf_filename = f"{uuid.uuid4()}.pdf"
        pdf_path = os.path.join(OUTPUT_FOLDER, pdf_filename)
        generate_stitch_blanket_pdf(result, pdf_path)

        result['pdf_url'] = f"/api/download/{pdf_filename}"

        return jsonify(result)

    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route('/api/toy-pattern', methods=['POST'])
def toy_pattern():
    try:
        data = request.get_json()
        if not data or 'image_base64' not in data:
            return jsonify({"error": "Nenhuma imagem enviada"}), 400

        image_data = base64.b64decode(data['image_base64'])
        colors = int(data.get('colors', 6))
        size = data.get('size', 'M')
        toy_name = data.get('toy_name', 'Brinquedo')
        toy_type = data.get('toy_type', 'plush')
        gauge_st = int(data.get('gauge_stitches', 22))
        gauge_rows = int(data.get('gauge_rows', 30))

        filename = f"{uuid.uuid4()}.jpg"
        input_path = os.path.join(UPLOAD_FOLDER, filename)
        with open(input_path, 'wb') as f:
            f.write(image_data)

        chart_width = {"P": 50, "M": 80, "G": 100}.get(size, 80)
        chart_height = {"P": 60, "M": 100, "G": 120}.get(size, 100)
        base_result = process_image_to_pattern(input_path, colors, chart_width, chart_height)

        panel_w = {"P": 20, "M": 30, "G": 40}.get(size, 30)
        panel_h = {"P": 25, "M": 40, "G": 50}.get(size, 40)

        toy = {
            "chart": base_result['chart'],
            "colors": base_result['colors'],
            "size": size,
            "toy_name": toy_name,
            "toy_type": toy_type,
            "gauge_stitches": gauge_st,
            "gauge_rows": gauge_rows,
            "panel_width_cm": panel_w,
            "panel_height_cm": panel_h,
            "estimated_yarn_grams": {"P": 30, "M": 50, "G": 70}.get(size, 50),
            "stuffing_grams": {"P": 15, "M": 25, "G": 35}.get(size, 25),
        }

        pdf_filename = f"{uuid.uuid4()}.pdf"
        pdf_path = os.path.join(OUTPUT_FOLDER, pdf_filename)
        generate_toy_pdf(toy, pdf_path, original_image_path=input_path)

        toy['pdf_url'] = f"/api/download/{pdf_filename}"
        toy['preview_url'] = f"/api/preview/{filename}"

        return jsonify(toy)

    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route('/api/stitch-patterns')
def list_stitch_patterns():
    patterns = get_all_patterns()
    result = {}
    for key, p in patterns.items():
        result[key] = {
            "name": p.get("name", key),
            "category": p.get("category", "outros"),
            "difficulty": p.get("difficulty", 1),
            "description": p.get("description", ""),
            "repeat_w": p.get("repeat_w", 1),
            "repeat_h": p.get("repeat_h", 1),
            "chart": p.get("chart", [[0]]),
            "tags": p.get("tags", []),
            "is_custom": p.get("is_custom", False),
        }
    return jsonify({
        "patterns": result,
        "categories": [{"key": k, "label": v} for k, v in CATEGORIES],
    })


@app.route('/api/stitch-patterns/custom', methods=['POST'])
def add_custom_pattern():
    try:
        data = request.get_json()
        if not data or 'chart' not in data or 'name' not in data:
            return jsonify({"error": "Nome e chart são obrigatórios"}), 400
        pid = data.get("id", f"custom_{uuid.uuid4().hex[:8]}")
        pattern = {
            "name": data["name"],
            "category": "custom",
            "difficulty": data.get("difficulty", 1),
            "description": data.get("description", ""),
            "chart": data["chart"],
            "repeat_w": data.get("repeat_w", len(data["chart"][0]) if data["chart"] else 1),
            "repeat_h": data.get("repeat_h", len(data["chart"])),
            "tags": data.get("tags", ["custom"]),
            "is_custom": True,
        }
        save_custom_pattern(pid, pattern)
        return jsonify({"id": pid, "name": pattern["name"]})
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route('/api/stitch-patterns/custom/<pid>', methods=['DELETE'])
def remove_custom_pattern(pid):
    if delete_custom_pattern(pid):
        return jsonify({"ok": True})
    return jsonify({"error": "Padrão não encontrado"}), 404


@app.route('/api/stitch-editor-pdf', methods=['POST'])
def stitch_editor_pdf():
    try:
        data = request.get_json()
        if not data or 'sections' not in data:
            return jsonify({"error": "Nenhuma secção enviada"}), 400

        sections = data['sections']
        garment_type = data.get('garment_type', 'sweater')
        is_circular = data.get('is_circular', False)
        gauge_st = int(data.get('gauge_stitches', 22))
        gauge_rows = int(data.get('gauge_rows', 30))
        image_b64 = data.get('image_base64', None)
        project_name = data.get('project_name', None)
        notes = data.get('notes', None)
        recipe_text = data.get('recipe_text', None)
        needle = data.get('needle', None)
        lang = data.get('lang', 'pt')

        pdf_filename = f"{uuid.uuid4()}.pdf"
        pdf_path = os.path.join(OUTPUT_FOLDER, pdf_filename)

        recipe = generate_recipe(sections, garment_type, gauge_st, gauge_rows, is_circular)
        kw = {}
        if project_name:
            kw['project_name'] = project_name
        if notes:
            kw['notes'] = notes
        if recipe_text:
            kw['recipe_text'] = recipe_text
        if needle:
            kw['needle'] = needle
        if lang:
            kw['lang'] = lang
        generate_stitch_editor_pdf(sections, pdf_path, garment_type, gauge_st, gauge_rows, image_b64, is_circular, recipe, **kw)

        total_w = max((s.get('width', 0) for s in sections), default=0)
        total_h = max((s.get('height', 0) for s in sections), default=0)
        return jsonify({
            "pdf_url": f"/api/download/{pdf_filename}",
            "width": total_w,
            "height": total_h,
        })

    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route('/api/stitch-editor-preview', methods=['POST'])
def stitch_editor_preview():
    try:
        data = request.get_json()
        if not data or 'grid' not in data:
            return jsonify({"error": "Nenhum grid enviado"}), 400

        grid = data['grid']
        cell_size = int(data.get('cell_size', 40))
        image_b64 = generate_stitch_preview(grid, cell_size)

        if not image_b64:
            return jsonify({"error": "Grid vazio"}), 400

        return jsonify({"image_base64": image_b64})

    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route('/api/stitch-editor-recipe', methods=['POST'])
def stitch_editor_recipe():
    try:
        data = request.get_json()
        if not data or 'sections' not in data:
            return jsonify({"error": "Nenhuma secção enviada"}), 400

        sections = data['sections']
        garment_type = data.get('garment_type', 'sweater')
        gauge_st = int(data.get('gauge_stitches', 22))
        gauge_rows = int(data.get('gauge_rows', 30))
        is_circular = data.get('is_circular', False)
        measurements = data.get('measurements', None)
        chest_cm = data.get('chest_cm')
        length_cm = data.get('length_cm')
        sleeve_cm = data.get('sleeve_cm')
        if chest_cm is not None or length_cm is not None or sleeve_cm is not None:
            measurements = measurements or {}
            if chest_cm is not None:
                measurements['chest_cm'] = float(chest_cm)
            if length_cm is not None:
                measurements['length_cm'] = float(length_cm)
            if sleeve_cm is not None:
                measurements['sleeve_cm'] = float(sleeve_cm)

        recipe = generate_recipe(sections, garment_type, gauge_st, gauge_rows, is_circular, measurements)
        return jsonify(recipe)

    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route('/api/health')
def health():
    return jsonify({"status": "ok"})


SIZE_DIMS = {
    "XS": {"chest": 41, "length": 54, "sleeve": 44},
    "S": {"chest": 45, "length": 56, "sleeve": 46},
    "M": {"chest": 49, "length": 58, "sleeve": 48},
    "L": {"chest": 53, "length": 60, "sleeve": 50},
    "XL": {"chest": 57, "length": 62, "sleeve": 52},
    "2XL": {"chest": 61, "length": 64, "sleeve": 54},
    "3XL": {"chest": 65, "length": 66, "sleeve": 56},
    "4XL": {"chest": 69, "length": 68, "sleeve": 58},
}


@app.route('/api/image-to-chart', methods=['POST'])
def image_to_chart():
    try:
        data = request.get_json()
        if not data or 'image_base64' not in data:
            return jsonify({"error": "Nenhuma imagem enviada"}), 400

        image_data = base64.b64decode(data['image_base64'])
        size_key = data.get('size_key', 'M')
        pattern_key = data.get('pattern_key')
        gauge_st = int(data.get('gauge_st', 22))
        gauge_rows = int(data.get('gauge_rows', 30))

        dims = SIZE_DIMS.get(size_key, SIZE_DIMS['M'])
        front_w = round(dims['chest'] * gauge_st / 10)
        front_h = round(dims['length'] * gauge_rows / 10)
        sleeve_w = round(dims['sleeve'] * gauge_st / 10)
        sleeve_h = round(front_h * 0.8)

        grid = convert_image_to_stitch_grid(image_data, front_w, front_h)

        if pattern_key:
            from stitch_library import STITCH_LIBRARY
            pattern = STITCH_LIBRARY.get(pattern_key)
            if pattern and 'chart' in pattern:
                chart = pattern['chart']
                pw = pattern.get('repeat_w', len(chart[0]))
                ph = pattern.get('repeat_h', len(chart))
                for r in range(front_h):
                    for c in range(front_w):
                        cv = chart[r % ph][c % pw]
                        if grid[r][c] == 'm':
                            grid[r][c] = 'm' if cv == 0 else 'l'
                        else:
                            grid[r][c] = 'l' if cv == 0 else 'm'

        def make_plain_grid(w, h):
            return [['m' for _ in range(w)] for _ in range(h)]

        sections = [
            {"name": "front", "grid": grid, "width": front_w, "height": front_h, "increases": [], "decreases": []},
            {"name": "back", "grid": make_plain_grid(front_w, front_h), "width": front_w, "height": front_h, "increases": [], "decreases": []},
            {"name": "sleeve", "grid": make_plain_grid(sleeve_w, sleeve_h), "width": sleeve_w, "height": sleeve_h, "increases": [], "decreases": []},
        ]

        return jsonify({
            "sections": sections,
            "width": front_w,
            "height": front_h,
            "size_key": size_key,
        })

    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route('/api/image-to-chart-ai', methods=['POST'])
def image_to_chart_ai():
    try:
        data = request.get_json()
        if not data or 'image_base64' not in data:
            return jsonify({"error": "Nenhuma imagem enviada"}), 400

        image_data = base64.b64decode(data['image_base64'])
        size_key = data.get('size_key', 'M')
        provider = data.get('provider', 'openai')
        pattern_key = data.get('pattern_key')
        gauge_st = int(data.get('gauge_st', 22))
        gauge_rows = int(data.get('gauge_rows', 30))

        dims = SIZE_DIMS.get(size_key, SIZE_DIMS['M'])
        front_w = round(dims['chest'] * gauge_st / 10)
        front_h = round(dims['length'] * gauge_rows / 10)
        sleeve_w = round(dims['sleeve'] * gauge_st / 10)
        sleeve_h = round(front_h * 0.8)

        pattern_name = None
        if pattern_key:
            from stitch_library import STITCH_LIBRARY
            p = STITCH_LIBRARY.get(pattern_key)
            if p:
                pattern_name = p.get('name', pattern_key)

        grid = generate_grid(image_data, front_w, front_h, provider, pattern_name)

        def make_plain_grid(w, h):
            return [['m' for _ in range(w)] for _ in range(h)]

        sections = [
            {"name": "front", "grid": grid, "width": front_w, "height": front_h, "increases": [], "decreases": []},
            {"name": "back", "grid": make_plain_grid(front_w, front_h), "width": front_w, "height": front_h, "increases": [], "decreases": []},
            {"name": "sleeve", "grid": make_plain_grid(sleeve_w, sleeve_h), "width": sleeve_w, "height": sleeve_h, "increases": [], "decreases": []},
        ]

        return jsonify({
            "sections": sections,
            "width": front_w,
            "height": front_h,
            "size_key": size_key,
            "provider": provider,
        })

    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route('/api/colorwork-editor-pdf', methods=['POST'])
def colorwork_editor_pdf():
    try:
        data = request.get_json()
        if not data or 'sections' not in data:
            return jsonify({"error": "Nenhuma secção enviada"}), 400

        sections = data['sections']
        garment_type = data.get('garment_type', 'sweater')
        gauge_st = int(data.get('gauge_stitches', 22))
        gauge_rows = int(data.get('gauge_rows', 30))
        image_b64 = data.get('image_base64', None)
        colors = data.get('colors', [])

        pdf_filename = f"{uuid.uuid4()}.pdf"
        pdf_path = os.path.join(OUTPUT_FOLDER, pdf_filename)
        generate_colorwork_editor_pdf(sections, pdf_path, garment_type, gauge_st, gauge_rows, image_b64, colors)

        total_w = max((s.get('width', 0) for s in sections), default=0)
        total_h = max((s.get('height', 0) for s in sections), default=0)
        return jsonify({
            "pdf_url": f"/api/download/{pdf_filename}",
            "width": total_w,
            "height": total_h,
        })

    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5000))
    app.run(debug=True, host='0.0.0.0', port=port)
