export function getCellColor(cell, colorLookup) {
  if (typeof colorLookup === 'function') return colorLookup(cell) || '#FFFFFF';
  return colorLookup[cell] || '#FFFFFF';
}

export function generateSvg(grid, colorLookup, cellSize = 20) {
  const h = grid.length;
  const w = grid[0]?.length || 0;
  const totalW = w * cellSize;
  const totalH = h * cellSize;
  let rects = '';
  for (let r = 0; r < h; r++) {
    for (let c = 0; c < w; c++) {
      const fill = getCellColor(grid[r][c], colorLookup);
      rects += `<rect x="${c * cellSize}" y="${r * cellSize}" width="${cellSize}" height="${cellSize}" fill="${fill}" stroke="#DDD" stroke-width="0.5"/>\n`;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalW}" height="${totalH}" viewBox="0 0 ${totalW} ${totalH}">
  ${rects}
</svg>`;
}

export function downloadPng(canvas, filename = 'pattern.png') {
  const link = document.createElement('a');
  link.download = filename;
  link.href = canvas.toDataURL('image/png');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function downloadSvg(svgString, filename = 'pattern.svg') {
  const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.download = filename;
  link.href = url;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function renderGridToCanvas(grid, colorLookup, cellSize = 20) {
  const h = grid.length;
  const w = grid[0]?.length || 0;
  const canvas = document.createElement('canvas');
  canvas.width = w * cellSize;
  canvas.height = h * cellSize;
  const ctx = canvas.getContext('2d');
  for (let r = 0; r < h; r++) {
    for (let c = 0; c < w; c++) {
      ctx.fillStyle = getCellColor(grid[r][c], colorLookup);
      ctx.fillRect(c * cellSize, r * cellSize, cellSize, cellSize);
      ctx.strokeStyle = '#DDD';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(c * cellSize, r * cellSize, cellSize, cellSize);
    }
  }
  return canvas;
}
