import React, { useRef, useEffect, useCallback } from 'react';

const DEFAULT_COLORS = {
  m: '#222222', l: '#D4E6F1', t: '#A9DFBF', b: '#FADBD8',
  bo: '#D7BDE2', '2pm': '#F9E79F', '3pm': '#F5CBA7', _: '#E8E8E8',
};

function lookupColor(k, colors) {
  return colors?.[k] || DEFAULT_COLORS[k] || '#FFF';
}

function drawCell(ctx, val, x, y, cellSize, isSel, hasInc, hasDec, colors) {
  ctx.fillStyle = isSel ? '#E8DCF5' : '#FFF';
  ctx.fillRect(x, y, cellSize, cellSize);

  if (val === '_') {
    ctx.fillStyle = '#E8E8E8';
    ctx.fillRect(x, y, cellSize, cellSize);
    ctx.fillStyle = '#999';
    ctx.font = `${Math.max(6, cellSize * 0.35)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('\u2715', x + cellSize / 2, y + cellSize / 2);
    return;
  }

  const color = lookupColor(val, colors);
  const radius = cellSize * 0.4;
  const cx = x + cellSize / 2;
  const cy = y + cellSize / 2;

  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.08)';
  ctx.lineWidth = 1;
  ctx.stroke();

  if (val !== 'm') {
    ctx.fillStyle = '#FFF';
    ctx.font = `bold ${Math.max(7, cellSize * 0.3)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(val, cx, cy);
  }

  if (hasInc) {
    ctx.fillStyle = '#2ECC71';
    ctx.font = `${Math.max(8, cellSize * 0.3)}px sans-serif`;
    ctx.fillText('\u2197', x + cellSize - 2, y + 2);
  }
  if (hasDec) {
    ctx.fillStyle = '#E74C3C';
    ctx.font = `${Math.max(8, cellSize * 0.3)}px sans-serif`;
    ctx.fillText('\u2198', x + cellSize - 2, y + cellSize - 2);
  }
}

function drawGrid(ctx, grid, cellSize, increases, decreases, isSelectedFn, colors) {
  const h = grid.length;
  const w = grid[0]?.length || 0;
  const offY = cellSize * 0.8;

  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  ctx.fillStyle = '#999';
  ctx.font = `${Math.max(9, cellSize * 0.4)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let c = 0; c < w; c++) {
    ctx.fillText(String(c + 1), 20 + c * cellSize + cellSize / 2, offY * 0.5, cellSize);
  }

  for (let r = 0; r < h; r++) {
    const y = r * cellSize + offY;
    const row = grid[r];

    ctx.fillStyle = '#999';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `${Math.max(9, cellSize * 0.4)}px sans-serif`;
    ctx.fillText(String(r + 1), 10, y + cellSize / 2, 18);

    for (let c = 0; c < w; c++) {
      const x = 20 + c * cellSize;
      drawCell(
        ctx, row[c], x, y, cellSize,
        isSelectedFn(r, c),
        increases?.some(p => p.r === r && p.c === c),
        decreases?.some(p => p.r === r && p.c === c),
        colors
      );
    }
  }
}

function initCanvas(canvas, grid, cellSize) {
  const w = grid[0]?.length || 0;
  const h = grid.length;
  const dpr = window.devicePixelRatio || 1;
  const offY = cellSize * 0.8;
  const totalW = w * cellSize + 20;
  const totalH = h * cellSize + offY;
  canvas.width = totalW * dpr;
  canvas.height = totalH * dpr;
  canvas.style.width = totalW + 'px';
  canvas.style.height = totalH + 'px';
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  return ctx;
}

export default function GridCanvas({ grid, cellSize = 20, mode, selectedStitch, increases, decreases, isSelected, onCellPress, onGridChanged, style, onCellPaintStart, stitchColors }) {
  const canvasRef = useRef(null);
  const gridRef = useRef(null);
  const ctxRef = useRef(null);
  const paintingRef = useRef(false);
  const isSelectedRef = useRef(isSelected);
  const stitchColorsRef = useRef(stitchColors);
  isSelectedRef.current = isSelected;
  stitchColorsRef.current = stitchColors;

  useEffect(() => {
    if (!canvasRef.current || !grid?.length) return;
    gridRef.current = grid.map(r => [...r]);
    const ctx = initCanvas(canvasRef.current, gridRef.current, cellSize);
    ctxRef.current = ctx;
    drawGrid(ctx, gridRef.current, cellSize, increases, decreases, (r, c) => isSelectedRef.current(r, c), stitchColorsRef.current);
  }, [grid, cellSize, increases, decreases]);

  const drawCellAt = useCallback((ctx, r, c) => {
    const offY = cellSize * 0.8;
    const y = r * cellSize + offY;
    const x = 20 + c * cellSize;
    drawCell(
      ctx, gridRef.current[r][c], x, y, cellSize,
      isSelectedRef.current(r, c),
      increases?.some(p => p.r === r && p.c === c),
      decreases?.some(p => p.r === r && p.c === c),
      stitchColorsRef.current
    );
  }, [cellSize, increases, decreases]);

  const getCell = useCallback((e) => {
    const canvas = canvasRef.current;
    if (!canvas || !gridRef.current) return null;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const c = Math.floor((x - 20) / cellSize);
    const r = Math.floor((y - cellSize * 0.8) / cellSize);
    if (r < 0 || r >= gridRef.current.length || c < 0 || c >= (gridRef.current[0]?.length || 0)) return null;
    return { r, c };
  }, [cellSize]);

  const handlePointerDown = useCallback((e) => {
    const cell = getCell(e);
    if (!cell) return;
    if (mode === 'paint') {
      paintingRef.current = true;
      onCellPaintStart?.(cell.r, cell.c);
    } else {
      onCellPress?.(cell.r, cell.c);
    }
  }, [getCell, mode, onCellPress, onCellPaintStart]);

  const handlePointerMove = useCallback((e) => {
    if (!paintingRef.current) return;
    if (e.buttons !== 1) { paintingRef.current = false; return; }
    const cell = getCell(e);
    if (!cell || gridRef.current?.[cell.r]?.[cell.c] === undefined) return;
    gridRef.current[cell.r][cell.c] = selectedStitch;
    const ctx = ctxRef.current;
    if (ctx) drawCellAt(ctx, cell.r, cell.c);
  }, [getCell, selectedStitch, drawCellAt]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const up = () => {
      if (paintingRef.current && gridRef.current) {
        paintingRef.current = false;
        onGridChanged?.(gridRef.current);
      }
    };
    window.addEventListener('pointerup', up);
    window.addEventListener('pointerleave', up);
    return () => {
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointerleave', up);
    };
  }, [onGridChanged]);

  return (
    <canvas
      ref={canvasRef}
      style={style}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
    />
  );
}
