import os
import json
import requests
import base64
import traceback
from io import BytesIO
from PIL import Image

OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "")
OPENAI_MODEL = os.environ.get("OPENAI_MODEL", "gpt-4o-mini")
GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-1.5-flash")
GROQ_MODEL = os.environ.get("GROQ_MODEL", "meta-llama/llama-4-scout-17b-16e-instruct")


def _resize_image(image_data, max_size=800):
    img = Image.open(BytesIO(image_data))
    w, h = img.size
    if max(w, h) > max_size:
        scale = max_size / max(w, h)
        img = img.resize((round(w * scale), round(h * scale)), Image.LANCZOS)
    buf = BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def _build_prompt(width, height, pattern_name=None):
    pattern_hint = f"\nThe intended stitch pattern is: {pattern_name}. Use this pattern's texture as the background fill." if pattern_name else ""
    return f"""You are a knitting chart generator. Analyze the design in this image and convert it to a {width}x{height} stitch chart grid.

Rules:
- 'm' = knit/meia/stockinette (light areas, smooth V-shaped stitches)
- 'l' = purl/liga/garter (dark areas, bumpy horizontal stitches)
- Trace the actual shapes and motifs from the image accurately
- For gradients or smooth transitions, use dithering-like alternation of m/l{pattern_hint}
- Return ONLY valid JSON with no markdown, no explanations: {{"grid": [["m","l",...], ...]}}
- The grid MUST be exactly {width} columns and {height} rows"""


def _parse_grid(response_text, expected_w, expected_h):
    text = response_text.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[-1]
        text = text.rsplit("```", 1)[0]
    text = text.strip()
    if text.startswith("```json"):
        text = text[7:]
        text = text.rsplit("```", 1)[0]
        text = text.strip()

    data = json.loads(text)
    grid = data.get("grid", data.get("chart", data.get("pattern", [])))

    if not grid or not isinstance(grid, list):
        raise ValueError("AI response did not contain a valid grid")

    actual_h = len(grid)
    actual_w = len(grid[0]) if grid else 0

    if actual_w == 0:
        raise ValueError("AI returned empty grid")

    if actual_h == expected_h and actual_w == expected_w:
        return grid

    img = Image.new("L", (actual_w, actual_h))
    for y in range(actual_h):
        for x in range(actual_w):
            img.putpixel((x, y), 0 if grid[y][x] == "l" else 255)
    img_resized = img.resize((expected_w, expected_h), Image.LANCZOS)
    new_grid = []
    for y in range(expected_h):
        row = []
        for x in range(expected_w):
            row.append("m" if img_resized.getpixel((x, y)) >= 128 else "l")
        new_grid.append(row)
    return new_grid


def generate_with_openai(image_data, width, height, pattern_name=None):
    if not OPENAI_API_KEY:
        raise ValueError("OPENAI_API_KEY not configured on server")

    img_b64 = base64.b64encode(image_data).decode("utf-8")
    prompt = _build_prompt(width, height, pattern_name)
    model = OPENAI_MODEL

    print(f"Calling OpenAI model={model} for {width}x{height} grid")

    try:
        resp = requests.post(
            "https://api.openai.com/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {OPENAI_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": model,
                "messages": [
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": prompt},
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": f"data:image/png;base64,{img_b64}",
                                    "detail": "high",
                                },
                            },
                        ],
                    }
                ],
                "max_tokens": 16000,
                "temperature": 0.1,
            },
            timeout=120,
        )
        resp.raise_for_status()
    except requests.exceptions.HTTPError as e:
        status = resp.status_code
        detail = resp.text[:500] if resp.text else "no response body"
        print(f"OpenAI HTTP {status}: {detail}")
        raise ValueError(f"OpenAI API error {status}: {detail}")
    except requests.exceptions.Timeout:
        print("OpenAI request timed out (120s)")
        raise ValueError("OpenAI request timed out after 120 seconds")
    except requests.exceptions.ConnectionError as e:
        print(f"OpenAI connection failed: {e}")
        raise ValueError(f"Could not connect to OpenAI API: {e}")

    data = resp.json()
    text = data["choices"][0]["message"]["content"]
    print(f"OpenAI response received ({len(text)} chars)")
    return _parse_grid(text, width, height)


def generate_with_gemini(image_data, width, height, pattern_name=None):
    if not GEMINI_API_KEY:
        raise ValueError("GEMINI_API_KEY not configured on server. Get a free key at https://ai.google.dev/")

    img_b64 = base64.b64encode(image_data).decode("utf-8")
    prompt = _build_prompt(width, height, pattern_name)
    model = GEMINI_MODEL

    print(f"Calling Gemini model={model} for {width}x{height} grid")

    try:
        resp = requests.post(
            f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={GEMINI_API_KEY}",
            headers={"Content-Type": "application/json"},
            json={
                "contents": [{
                    "parts": [
                        {"text": prompt},
                        {
                            "inline_data": {
                                "mime_type": "image/png",
                                "data": img_b64,
                            }
                        },
                    ]
                }],
                "generationConfig": {
                    "temperature": 0.1,
                    "maxOutputTokens": 16000,
                },
            },
            timeout=120,
        )
        resp.raise_for_status()
    except requests.exceptions.HTTPError as e:
        status = resp.status_code
        detail = resp.text[:500] if resp.text else "no response body"
        print(f"Gemini HTTP {status}: {detail}")
        raise ValueError(f"Gemini API error {status}: {detail}")
    except requests.exceptions.Timeout:
        print("Gemini request timed out (120s)")
        raise ValueError("Gemini request timed out after 120 seconds")
    except requests.exceptions.ConnectionError as e:
        print(f"Gemini connection failed: {e}")
        raise ValueError(f"Could not connect to Gemini API: {e}")

    data = resp.json()
    text = data["candidates"][0]["content"]["parts"][0]["text"]
    print(f"Gemini response received ({len(text)} chars)")
    return _parse_grid(text, width, height)


def generate_with_groq(image_data, width, height, pattern_name=None):
    if not GROQ_API_KEY:
        raise ValueError("GROQ_API_KEY not configured. Get a free key at https://console.groq.com/keys")

    img_b64 = base64.b64encode(image_data).decode("utf-8")
    prompt = _build_prompt(width, height, pattern_name)
    model = GROQ_MODEL

    print(f"Calling Groq model={model} for {width}x{height} grid")

    try:
        resp = requests.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {GROQ_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": model,
                "messages": [
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": prompt},
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": f"data:image/png;base64,{img_b64}",
                                },
                            },
                        ],
                    }
                ],
                "max_tokens": 16000,
                "temperature": 0.1,
            },
            timeout=120,
        )
        resp.raise_for_status()
    except requests.exceptions.HTTPError as e:
        status = resp.status_code
        detail = resp.text[:500] if resp.text else "no response body"
        print(f"Groq HTTP {status}: {detail}")
        raise ValueError(f"Groq API error {status}: {detail}")
    except requests.exceptions.Timeout:
        print("Groq request timed out (120s)")
        raise ValueError("Groq request timed out after 120 seconds")
    except requests.exceptions.ConnectionError as e:
        print(f"Groq connection failed: {e}")
        raise ValueError(f"Could not connect to Groq API: {e}")

    data = resp.json()
    text = data["choices"][0]["message"]["content"]
    print(f"Groq response received ({len(text)} chars)")
    return _parse_grid(text, width, height)


def generate_grid(image_data, width, height, provider="openai", pattern_name=None):
    image_data = _resize_image(image_data)
    if provider == "openai":
        return generate_with_openai(image_data, width, height, pattern_name)
    elif provider == "gemini":
        return generate_with_gemini(image_data, width, height, pattern_name)
    elif provider == "groq":
        return generate_with_groq(image_data, width, height, pattern_name)
    else:
        raise ValueError(f"Unsupported provider: {provider}. Use 'openai', 'gemini', or 'groq'.")
