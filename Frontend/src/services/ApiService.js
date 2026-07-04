import * as FileSystem from 'expo-file-system/legacy';

const API_URL = 'http://192.168.1.71:5000';

export async function convertImage(imageUri, colors, width, height) {
  try {
    const base64 = await FileSystem.readAsStringAsync(imageUri, {
      encoding: FileSystem.EncodingType.Base64,
    });

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
  } catch (error) {
    throw new Error(error.message || 'Erro de rede ao converter imagem');
  }
}

export async function createSweaterPattern(imageUri, options) {
  try {
    const base64 = await FileSystem.readAsStringAsync(imageUri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    // Construção blindada do objeto para o backend
    const body = {
      image_base64: base64,
      colors: String(options?.colors || 6),
      size: options?.size || 'M',
      gauge_stitches: String(options?.gaugeStitches || '22'),
      gauge_rows: String(options?.gaugeRows || '30'),
      sleeve_style: options?.sleeveStyle || 'set-in',
      neckline: options?.neckline || 'crew',
      motif_placement: options?.motifPlacement || 'center',
      bg_color: String(options?.bgColor || 0),
    };

    if (options?.sleevePattern) body.sleeve_pattern = options.sleevePattern;
    if (options?.backPattern) body.back_pattern = options.backPattern;

    const res = await fetch(`${API_URL}/api/sweater-pattern`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Erro interno do servidor' }));
      throw new Error(err.error || 'Erro ao gerar padrão de sweater');
    }

    return res.json();
  } catch (error) {
    throw new Error(error.message || 'Falha na ligação ao servidor da API');
  }
}

export async function fetchStitchPatterns() {
  try {
    const res = await fetch(`${API_URL}/api/stitch-patterns`);
    if (!res.ok) throw new Error('Erro ao carregar padrões');
    return res.json();
  } catch (error) {
    return {};
  }
}

export async function createStitchBlanket(options) {
  try {
    const res = await fetch(`${API_URL}/api/stitch-blanket`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patterns: options?.patterns || [],
        chart_width: options?.chartWidth || 0,
        section_rows: options?.sectionRows || 0,
        border_rows: options?.borderRows || 0,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Erro desconhecido' }));
      throw new Error(err.error || 'Erro ao gerar manta');
    }

    return res.json();
  } catch (error) {
    throw new Error(error.message || 'Falha de rede ao gerar manta');
  }
}

export function getPdfUrl(path) {
  return `${API_URL}${path || ''}`;
}

export function getPreviewUrl(path) {
  return `${API_URL}${path || ''}`;
}
