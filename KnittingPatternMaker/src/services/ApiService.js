const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000';

export async function uriToBase64(imageUri) {
  if (typeof document !== 'undefined') {
    const resp = await fetch(imageUri);
    const blob = await resp.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result;
        resolve(result.split(',')[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
  const FileSystem = require('expo-file-system/legacy');
  return await FileSystem.readAsStringAsync(imageUri, {
    encoding: FileSystem.EncodingType.Base64,
  });
}

export async function convertImage(imageUri, colors, width, height) {
  const base64 = await uriToBase64(imageUri);

  const res = await fetch(`${API_URL}/api/convert`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      image_base64: base64,
      colors: String(colors),
      width: String(width),
      height: String(height),
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Erro desconhecido' }));
    throw new Error(err.error || 'Erro ao converter imagem');
  }

  return res.json();
}

export async function createSweaterPattern(imageUri, options) {
  const base64 = await uriToBase64(imageUri);

  const body = {
    image_base64: base64,
    colors: String(options.colors),
    size: options.size,
    gauge_stitches: String(options.gaugeStitches),
    gauge_rows: String(options.gaugeRows),
    sleeve_style: options.sleeveStyle,
    neckline: options.neckline,
    motif_placement: options.motifPlacement || 'center',
    bg_color: String(options.bgColor || 0),
  };
  if (options.sleevePattern) body.sleeve_pattern = options.sleevePattern;
  if (options.backPattern) body.back_pattern = options.backPattern;

  const res = await fetch(`${API_URL}/api/sweater-pattern`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Erro desconhecido' }));
    throw new Error(err.error || 'Erro ao gerar padrão de sweater');
  }

  return res.json();
}

export async function fetchStitchPatterns() {
  const res = await fetch(`${API_URL}/api/stitch-patterns`);
  if (!res.ok) throw new Error('Erro ao carregar padrões');
  return res.json();
}

export async function createStitchBlanket(options) {
  const res = await fetch(`${API_URL}/api/stitch-blanket`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      patterns: options.patterns,
      chart_width: options.chartWidth,
      section_rows: options.sectionRows,
      border_rows: options.borderRows,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Erro desconhecido' }));
    throw new Error(err.error || 'Erro ao gerar manta');
  }

  return res.json();
}

export async function createStitchEditorPattern(options) {
  const res = await fetch(`${API_URL}/api/stitch-editor-pdf`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sections: options.sections,
      garment_type: options.garment_type,
      is_circular: options.is_circular || false,
      gauge_stitches: options.gauge_stitches,
      gauge_rows: options.gauge_rows,
      image_base64: options.image_base64 || null,
      project_name: options.project_name || null,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Erro desconhecido' }));
    throw new Error(err.error || 'Erro ao gerar PDF do editor');
  }

  return res.json();
}

export async function createColorworkEditorPattern(options) {
  const res = await fetch(`${API_URL}/api/colorwork-editor-pdf`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sections: options.sections,
      garment_type: options.garment_type,
      gauge_stitches: options.gauge_stitches,
      gauge_rows: options.gauge_rows,
      image_base64: options.image_base64 || null,
      colors: options.colors,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Erro desconhecido' }));
    throw new Error(err.error || 'Erro ao gerar PDF jacquard');
  }

  return res.json();
}

export async function getStitchPreview(grid, cellSize = 40) {
  const res = await fetch(`${API_URL}/api/stitch-editor-preview`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ grid, cell_size: cellSize }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Erro desconhecido' }));
    throw new Error(err.error || 'Erro ao gerar preview');
  }

  return res.json();
}

export async function createToyPattern(imageUri, options) {
  const base64 = await uriToBase64(imageUri);

  const body = {
    image_base64: base64,
    colors: String(options.colors),
    size: options.size,
    toy_name: options.toyName || 'Brinquedo',
    toy_type: options.toyType || 'plush',
    gauge_stitches: String(options.gaugeStitches),
    gauge_rows: String(options.gaugeRows),
  };

  const res = await fetch(`${API_URL}/api/toy-pattern`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Erro desconhecido' }));
    throw new Error(err.error || 'Erro ao gerar padrão de brinquedo');
  }

  return res.json();
}

export function getPdfUrl(path) {
  return `${API_URL}${path}`;
}

export function getPreviewUrl(path) {
  return `${API_URL}${path}`;
}

export async function imageToChartAI(options) {
  const res = await fetch(`${API_URL}/api/image-to-chart-ai`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(options),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Erro AI' }));
    throw new Error(err.error || 'Erro AI ao converter imagem');
  }
  return res.json();
}

export async function imageToChart(options) {
  const res = await fetch(`${API_URL}/api/image-to-chart`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(options),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Erro ao converter imagem' }));
    throw new Error(err.error || 'Erro ao converter imagem');
  }
  return res.json();
}

export async function fetchStitchLibrary() {
  const res = await fetch(`${API_URL}/api/stitch-patterns`);
  if (!res.ok) throw new Error('Erro ao carregar biblioteca');
  return res.json();
}

export async function saveCustomPattern(pattern) {
  const res = await fetch(`${API_URL}/api/stitch-patterns/custom`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(pattern),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Erro desconhecido' }));
    throw new Error(err.error || 'Erro ao guardar padrão');
  }
  return res.json();
}

export async function deleteCustomPattern(pid) {
  const res = await fetch(`${API_URL}/api/stitch-patterns/custom/${pid}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Erro ao apagar padrão');
  return res.json();
}

export async function generateStitchRecipe(options) {
  const res = await fetch(`${API_URL}/api/stitch-editor-recipe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sections: options.sections,
      garment_type: options.garment_type,
      gauge_stitches: options.gauge_stitches,
      gauge_rows: options.gauge_rows,
      is_circular: options.is_circular || false,
      chest_cm: options.chest_cm,
      length_cm: options.length_cm,
      sleeve_cm: options.sleeve_cm,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Erro desconhecido' }));
    throw new Error(err.error || 'Erro ao gerar receita');
  }
  return res.json();
}

export async function fetchPatternGallery() {
  const res = await fetch(`${API_URL}/api/pattern-gallery`);
  if (!res.ok) throw new Error('Erro ao carregar galeria');
  return res.json();
}
