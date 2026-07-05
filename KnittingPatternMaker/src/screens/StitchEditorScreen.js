import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
  TextInput,
  Image,
  Modal,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import ScrollWrapper from '../components/ScrollWrapper';
import GridCanvas from '../components/GridCanvas';
import ProjectModal from '../components/ProjectModal';
import PatternPicker from '../components/PatternPicker';
import { useLang } from '../lang';
import { createStitchEditorPattern, getStitchPreview, uriToBase64, saveCustomPattern, generateStitchRecipe } from '../services/ApiService';

const STITCH_TYPES = [
  { key: 'm', label: 'm', name: 'Meia', color: '#222222' },
  { key: 'l', label: 'l', name: 'Liga', color: '#D4E6F1' },
  { key: 't', label: 't', name: 'Torcido', color: '#A9DFBF' },
  { key: 'b', label: 'b', name: 'Buraco', color: '#FADBD8' },
  { key: 'bo', label: 'bo', name: 'Bola', color: '#D7BDE2' },
  { key: '2pm', label: '2pm', name: '2pM', color: '#F9E79F' },
  { key: '3pm', label: '3pm', name: '3pM', color: '#F5CBA7' },
  { key: '_', label: '✕', name: 'Fora', color: '#E8E8E8' },
];

const GARMENT_TYPES = [
  { key: 'sweater', label: 'Camisola', icon: '🧥' },
  { key: 'jacket', label: 'Casaco', icon: '🧥' },
  { key: 'pants', label: 'Calças', icon: '👖' },
  { key: 'socks', label: 'Meias', icon: '🧦' },
  { key: 'toy', label: 'Boneco', icon: '🧸' },
];

const SIZE_CHART = {
  XS: { chest: 41, length: 54, sleeve: 44 },
  S:  { chest: 45, length: 56, sleeve: 46 },
  M:  { chest: 49, length: 58, sleeve: 48 },
  L:  { chest: 53, length: 60, sleeve: 50 },
  XL: { chest: 57, length: 62, sleeve: 52 },
  '2XL': { chest: 61, length: 64, sleeve: 54 },
  '3XL': { chest: 65, length: 66, sleeve: 56 },
  '4XL': { chest: 69, length: 68, sleeve: 58 },
};

const SECTION_DEFS = {
  sweater: [
    { key: 'front', label: 'Frente', defaultW: 24, defaultH: 30 },
    { key: 'back', label: 'Costas', defaultW: 24, defaultH: 30 },
    { key: 'sleeve', label: 'Manga', defaultW: 14, defaultH: 26 },
  ],
  jacket: [
    { key: 'front_left', label: 'Frente Esq.', defaultW: 14, defaultH: 30 },
    { key: 'front_right', label: 'Frente Dir.', defaultW: 14, defaultH: 30 },
    { key: 'back', label: 'Costas', defaultW: 24, defaultH: 30 },
    { key: 'sleeve', label: 'Manga', defaultW: 14, defaultH: 26 },
  ],
  pants: [
    { key: 'front', label: 'Frente', defaultW: 18, defaultH: 28 },
    { key: 'back', label: 'Costas', defaultW: 18, defaultH: 28 },
  ],
  socks: [
    { key: 'leg', label: 'Perna', defaultW: 16, defaultH: 24 },
    { key: 'foot', label: 'Pé', defaultW: 18, defaultH: 14 },
  ],
  toy: [
    { key: 'front', label: 'Frente', defaultW: 20, defaultH: 20 },
    { key: 'back', label: 'Costas', defaultW: 20, defaultH: 20 },
  ],
};

const CIRCULAR_DEFS = {
  sweater: [
    { key: 'body', label: 'Corpo', defaultW: 24, defaultH: 30 },
    { key: 'sleeve', label: 'Manga', defaultW: 14, defaultH: 26 },
  ],
  pants: [
    { key: 'body', label: 'Corpo', defaultW: 18, defaultH: 28 },
  ],
  socks: [
    { key: 'leg', label: 'Perna', defaultW: 16, defaultH: 24 },
    { key: 'foot', label: 'Pé', defaultW: 18, defaultH: 14 },
  ],
  toy: [
    { key: 'body', label: 'Corpo', defaultW: 20, defaultH: 20 },
  ],
};

function createGrid(w, h) {
  return Array.from({ length: h }, () => Array(w).fill('m'));
}

const STITCH_KEYS = ['m', 'l', 't', 'b', 'bo', '2pm', '3pm'];

function executeCommand(sections, activeIdx, cmd) {
  const lower = cmd.toLowerCase().trim();
  const sectionAlias = { frente: 'front', costas: 'back', manga: 'sleeve' };
  const secMatch = lower.match(/^(frente|costas|manga|todas)\s+(.+)/);
  let targetKeys = [];
  let rest = lower;
  if (secMatch) {
    rest = secMatch[2];
    if (secMatch[1] === 'todas') {
      targetKeys = sections.map(s => s.key);
    } else {
      targetKeys = [sectionAlias[secMatch[1]] || secMatch[1]];
    }
  } else {
    targetKeys = [sections[activeIdx]?.key].filter(Boolean);
  }

  const stitchMap = { m: 'm', l: 'l', t: 't', b: 'b', bo: 'bo', '2pm': '2pm', '3pm': '3pm', meia: 'm', liga: 'l', torcido: 't', buraco: 'b', bola: 'bo' };
  function parseStitch(s) { return stitchMap[s] || 'm'; }
  function parseRows(part) {
    if (!part) return null;
    const m = part.match(/^(\d+)(?:-(\d+))?$/);
    if (!m) return null;
    const a = parseInt(m[1]) - 1;
    const b = m[2] ? parseInt(m[2]) - 1 : a;
    return [Math.max(0, a), Math.min(b, 9999)];
  }

  const applyToSection = (sec, cmdPart) => {
    const h = sec.grid.length;
    const w = sec.grid[0]?.length || 1;
    const g = sec.grid.map(r => [...r]);
    const inc = [...(sec.increases || [])];
    const dec = [...(sec.decreases || [])];
    const l = cmdPart;

    // "m toda" / "toda com X"
    if (l.match(/^(m|meia)\s+toda$/)) {
      for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) g[r][c] = 'm';
      return { grid: g, increases: inc, decreases: dec, label: sec.key };
    }
    const toda = l.match(/^toda\s+com\s+(.+)$/);
    if (toda) {
      const st = parseStitch(toda[1].trim());
      for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) g[r][c] = st;
      return { grid: g, increases: inc, decreases: dec, label: sec.key };
    }

    // "carreira X com Y" / "linha X com Y"
    const carr = l.match(/^(carreira|linha)(s)?\s+(\d+(?:-\d+)?)\s+com\s+(.+)$/);
    if (carr) {
      const rows = parseRows(carr[3]);
      if (!rows) return null;
      const st = parseStitch(carr[4].trim());
      for (let r = Math.max(0, rows[0]); r <= Math.min(rows[1], h - 1); r++) for (let c = 0; c < w; c++) g[r][c] = st;
      return { grid: g, increases: inc, decreases: dec, label: sec.key };
    }

    // "malha X com Y" / "coluna X com Y"
    const malha = l.match(/^(malha|coluna)(s)?\s+(\d+(?:-\d+)?)\s+com\s+(.+)$/);
    if (malha) {
      const m = malha[3].match(/^(\d+)(?:-(\d+))?$/);
      if (!m) return null;
      const a = Math.max(0, Math.min(parseInt(m[1]) - 1, parseInt(m[2] || m[1]) - 1));
      const b = Math.min(Math.max(parseInt(m[1]) - 1, parseInt(m[2] || m[1]) - 1), w - 1);
      const st = parseStitch(malha[4].trim());
      for (let r = 0; r < h; r++) for (let c = a; c <= b; c++) g[r][c] = st;
      return { grid: g, increases: inc, decreases: dec, label: sec.key };
    }

    // "aumentar cada lado cada N"
    const aum = l.match(/^aumentar\s+1?\s*cada\s+lado\s*cada\s+(\d+)/);
    if (aum) {
      const n = parseInt(aum[1]);
      for (let r = 0; r < h; r += n) {
        inc.push({ r, c: Math.floor(w * 0.1) });
        inc.push({ r, c: w - 1 - Math.floor(w * 0.1) });
      }
      return { grid: g, increases: inc, decreases: dec, label: sec.key };
    }

    // "diminuir cada lado cada N"
    const dim = l.match(/^diminuir\s+1?\s*cada\s+lado\s*cada\s+(\d+)/);
    if (dim) {
      const n = parseInt(dim[1]);
      for (let r = 0; r < h; r += n) {
        dec.push({ r, c: Math.floor(w * 0.1) });
        dec.push({ r, c: w - 1 - Math.floor(w * 0.1) });
      }
      return { grid: g, increases: inc, decreases: dec, label: sec.key };
    }

    // "espelho horizontal"
    if (l === 'espelho horizontal') {
      for (let r = 0; r < h; r++) for (let c = 0; c < w / 2; c++) g[r][w - 1 - c] = g[r][c];
      return { grid: g, increases: inc, decreases: dec, label: sec.key };
    }

    // "espelho vertical"
    if (l === 'espelho vertical') {
      for (let r = 0; r < h / 2; r++) for (let c = 0; c < w; c++) g[h - 1 - r][c] = g[r][c];
      return { grid: g, increases: inc, decreases: dec, label: sec.key };
    }

    // "alternar X Y a cada N"
    const alt = l.match(/^alternar\s+(\S+)\s+(\S+)\s+a\s+cada\s+(\d+)/);
    if (alt) {
      const s1 = parseStitch(alt[1]), s2 = parseStitch(alt[2]), n = parseInt(alt[3]);
      for (let r = 0; r < h; r++) {
        const st = Math.floor(r / n) % 2 === 0 ? s1 : s2;
        for (let c = 0; c < w; c++) g[r][c] = st;
      }
      return { grid: g, increases: inc, decreases: dec, label: sec.key };
    }

    return null;
  };

  const results = [];
  for (const key of targetKeys) {
    const sec = sections.find(s => s.key === key);
    if (!sec) continue;
    const res = applyToSection(sec, rest);
    if (res) results.push(res);
  }

  if (results.length === 0) {
    return { sections: null, msg: 'Comando não reconhecido. Ex: "frente carreira 1-10 com t", "costas toda com m", "manga malha 5 com l", "todas alternar m l a cada 2"' };
  }

  const newSections = sections.map(sec => {
    const r = results.find(x => x.label === sec.key);
    if (!r) return sec;
    return { ...sec, grid: r.grid, increases: r.increases, decreases: r.decreases };
  });

  const labelMap = { front: 'Frente', back: 'Costas', sleeve: 'Manga' };
  const names = results.map(r => labelMap[r.label] || r.label).join(', ');
  return { sections: newSections, msg: `${names}: ${cmd}` };
}

function applyShapeMask(grid, garmentType, sectionKey, isCircular = false) {
  const h = grid.length;
  const w = grid[0].length;
  for (let row = 0; row < h; row++) {
    for (let col = 0; col < w; col++) {
      const x = (col + 0.5) / w;
      const y = (h - row - 0.5) / h;
      if (!isInsideShape(x, y, garmentType, sectionKey, isCircular)) {
        grid[row][col] = '_';
      }
    }
  }
  return grid;
}

function isInsideShape(x, y, garmentType, sectionKey, isCircular = false) {
  if (isCircular && garmentType === 'sweater' && sectionKey === 'body') {
    if (y > 0.85) {
      const topSlope = (y - 0.85) / 0.15;
      const cut = 0.08 * topSlope;
      if (x < cut || x > 1 - cut) return false;
    }
    const neckDepth = 0.18;
    const neckWidth = 0.28;
    if (y > 1 - neckDepth) {
      const ny = (y - (1 - neckDepth)) / neckDepth;
      const curve = Math.sin(ny * Math.PI / 2);
      const halfNeck = neckWidth / 2 * (1 - (1 - curve) * 0.3);
      if (x > 0.5 - halfNeck && x < 0.5 + halfNeck) return false;
    }
    if (y > 0.85) {
      const slope = (y - 0.85) / 0.15;
      const cut = 0.10 * slope;
      if (x < cut || x > 1 - cut) return false;
    }
    if (y > 0.50 && y < 0.72) {
      const ay = (y - 0.50) / 0.22;
      const curve = Math.sin(ay * Math.PI);
      const cut = 0.08 * curve;
      if (x < cut || x > 1 - cut) return false;
    }
    return true;
  }
  if (garmentType === 'sweater' || garmentType === 'jacket') {
    const isFront = sectionKey === 'front' || sectionKey === 'front_left' || sectionKey === 'front_right';
    const isBack = sectionKey === 'back';
    const isSleeve = sectionKey === 'sleeve';
    const isLeft = sectionKey === 'front_left';
    const isRight = sectionKey === 'front_right';
    if (isSleeve) {
      if (y > 0.85) {
        const topSlope = (y - 0.85) / 0.15;
        const cut = 0.08 * topSlope;
        if (x < cut || x > 1 - cut) return false;
      }
      return true;
    }
    const neckDepth = isFront ? 0.18 : 0.10;
    const neckWidth = isFront ? 0.28 : 0.20;
    if (y > 1 - neckDepth) {
      const ny = (y - (1 - neckDepth)) / neckDepth;
      const curve = Math.sin(ny * Math.PI / 2);
      const halfNeck = neckWidth / 2 * (1 - (1 - curve) * 0.3);
      const cx = isLeft ? 0 : (isRight ? 1 : 0.5);
      if (isLeft) { if (x > 1 - halfNeck * 0.6) return false; }
      else if (isRight) { if (x < halfNeck * 0.6) return false; }
      else { if (x > 0.5 - halfNeck && x < 0.5 + halfNeck) return false; }
    }
    if (y > 0.85) {
      const slope = (y - 0.85) / 0.15;
      const cut = 0.10 * slope;
      if (isLeft) { if (x > 1 - cut) return false; }
      else if (isRight) { if (x < cut) return false; }
      else { if (x < cut || x > 1 - cut) return false; }
    }
    if (y > 0.50 && y < 0.72 && !isLeft && !isRight) {
      const ay = (y - 0.50) / 0.22;
      const curve = Math.sin(ay * Math.PI);
      const cut = 0.08 * curve;
      if (x < cut || x > 1 - cut) return false;
    }
    if (isLeft && y > 0.50 && y < 0.72) {
      const ay = (y - 0.50) / 0.22;
      const curve = Math.sin(ay * Math.PI);
      const cut = 0.14 * curve;
      if (x > 1 - cut) return false;
    }
    if (isRight && y > 0.50 && y < 0.72) {
      const ay = (y - 0.50) / 0.22;
      const curve = Math.sin(ay * Math.PI);
      const cut = 0.14 * curve;
      if (x < cut) return false;
    }
    if (isLeft && y > 0.85) { if (x < 0.06) return false; }
    if (isRight && y > 0.85) { if (x > 0.94) return false; }
    return true;
  }
  if (garmentType === 'pants') {
    if (y > 0.92) {
      const waistSlope = (y - 0.92) / 0.08;
      const cut = 0.04 * (1 - waistSlope);
      if (x < cut || x > 1 - cut) return false;
    }
    if (y < 0.08) {
      const ankleSlope = y / 0.08;
      const cut = 0.06 * (1 - ankleSlope);
      if (x < cut || x > 1 - cut) return false;
    }
    if (y > 0.80) {
      const cy = (y - 0.80) / 0.20;
      const crotchCut = 0.10 * (1 - Math.sin(cy * Math.PI / 2));
      if (x < crotchCut) return false;
    }
    return true;
  }
  if (garmentType === 'socks') {
    if (sectionKey === 'leg') {
      if (y < 0.05) {
        const taper = y / 0.05;
        const cut = 0.06 * (1 - taper);
        if (x < cut || x > 1 - cut) return false;
      }
      return true;
    }
    if (sectionKey === 'foot') {
      if (y < 0.30) {
        if (x > 0.5) {
          const fy = y / 0.30;
          const footW = 0.4 * fy + 0.1;
          if (x < 0.5 + footW) return true;
        }
        return x < 0.5;
      }
      return x < 0.5;
    }
    return true;
  }
  return true;
}

function cloneSections(sections) {
  return sections.map(sec => ({
    ...sec,
    grid: sec.grid.map(row => [...row]),
    increases: sec.increases ? sec.increases.map(p => ({...p})) : [],
    decreases: sec.decreases ? sec.decreases.map(p => ({...p})) : [],
  }));
}

const GridCell = React.memo(({ cell, cellSize, ri, ci, isSelected, hasInc, hasDec, mode, onCellPress, onCellPointerDown, onCellPointerEnter }) => {
  const handlePress = useCallback(() => onCellPress(ri, ci), [onCellPress, ri, ci]);
  const handlePD = useCallback(() => onCellPointerDown(ri, ci), [onCellPointerDown, ri, ci]);
  const handlePE = useCallback(() => onCellPointerEnter(ri, ci), [onCellPointerEnter, ri, ci]);
  const incSize = Math.max(8, cellSize * 0.3);
  const textSize = Math.max(7, cellSize * 0.32);
  const xSize = Math.max(6, cellSize * 0.2);
  return (
    <TouchableOpacity
      style={[styles.cell, { width: cellSize, height: cellSize }, mode === 'select' && styles.cellClickable]}
      onPress={handlePress}
      onPointerDown={handlePD}
      onPointerEnter={handlePE}
    >
      {cell !== '_' ? (
        <View style={[
          styles.stitchCircle,
          {
            width: cellSize * 0.85,
            height: cellSize * 0.85,
            borderRadius: cellSize * 0.425,
            backgroundColor: STITCH_TYPES.find(s => s.key === cell)?.color || '#FFF',
          },
          isSelected && styles.stitchCircleSelected,
        ]}>
          {cell !== 'm' && (
            <Text style={[styles.cellText, { fontSize: textSize }]}>{cell}</Text>
          )}
          {hasInc && (
            <Text style={{ position: 'absolute', top: -4, right: -4, fontSize: incSize, color: '#2ECC71' }}>↗</Text>
          )}
          {hasDec && (
            <Text style={{ position: 'absolute', bottom: -4, right: -4, fontSize: incSize, color: '#E74C3C' }}>↘</Text>
          )}
        </View>
      ) : (
        <Text style={[styles.cellText, { fontSize: xSize, color: '#999' }]}>✕</Text>
      )}
    </TouchableOpacity>
  );
});

const GridRow = React.memo(({ row, ri, cellSize, mode, isSelected, hasInc, hasDec, onCellPress, onCellPointerDown, onCellPointerEnter }) => (
  <View style={styles.gridRow}>
    <Text style={styles.rowNum}>{ri + 1}</Text>
    {row.map((cell, ci) => (
      <GridCell
        key={ci}
        cell={cell}
        cellSize={cellSize}
        ri={ri}
        ci={ci}
        mode={mode}
        isSelected={isSelected(ri, ci)}
        hasInc={hasInc(ri, ci)}
        hasDec={hasDec(ri, ci)}
        onCellPress={onCellPress}
        onCellPointerDown={onCellPointerDown}
        onCellPointerEnter={onCellPointerEnter}
      />
    ))}
  </View>
), (prev, next) => {
  if (prev.ri !== next.ri || prev.cellSize !== next.cellSize || prev.mode !== next.mode) return false;
  if (prev.row.length !== next.row.length) return false;
  for (let i = prev.row.length - 1; i >= 0; i--) {
    if (prev.row[i] !== next.row[i]) return false;
  }
  return true;
});

export default function StitchEditorScreen({ navigation, route }) {
  const { t } = useLang();
  const [garmentType, setGarmentType] = useState('sweater');
  const [sections, setSections] = useState([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [selectedStitch, setSelectedStitch] = useState('m');
  const [gauge, setGauge] = useState('22');
  const [gaugeRows, setGaugeRows] = useState('30');
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [referenceImage, setReferenceImage] = useState(null);
  const [notes, setNotes] = useState('');
  const [chestCm, setChestCm] = useState('');
  const [lengthCm, setLengthCm] = useState('');
  const [sleeveCm, setSleeveCm] = useState('');
  const [projectModal, setProjectModal] = useState(false);
  const [isCircular, setIsCircular] = useState(false);
  const [sizeKey, setSizeKey] = useState(null);
  const [patternPicker, setPatternPicker] = useState(false);
  const [savePatternModal, setSavePatternModal] = useState(false);
  const [newPatternName, setNewPatternName] = useState('');
  const [recipeModal, setRecipeModal] = useState(false);
  const [recipeData, setRecipeData] = useState(null);
  const [recipeEditing, setRecipeEditing] = useState(null);
  const [recipeLoading, setRecipeLoading] = useState(false);
  const [rowInstructions, setRowInstructions] = useState(null);
  const [activeRowSection, setActiveRowSection] = useState(0);
  const [needleSize, setNeedleSize] = useState('');
  const [recipeLang, setRecipeLang] = useState('pt');
  const [mode, setMode] = useState('paint');
  const [cmdFeedback, setCmdFeedback] = useState('');
  const [assistModal, setAssistModal] = useState(false);
  const [assistSections, setAssistSections] = useState(['front']);
  const [assistAction, setAssistAction] = useState('fill_rows');
  const [assistStitch, setAssistStitch] = useState('m');
  const [assistRange, setAssistRange] = useState('');
  const [assistPattern, setAssistPattern] = useState('');
  const [assistEvery, setAssistEvery] = useState('');
  const [assistNeckStart, setAssistNeckStart] = useState('5');
  const [assistNeckWidth, setAssistNeckWidth] = useState('8');
  const [selStart, setSelStart] = useState(null);
  const [selEnd, setSelEnd] = useState(null);
  const [zoom, setZoom] = useState(24);
  const paintingRef = useRef(false);
  const stitchRef = useRef(selectedStitch);
  stitchRef.current = selectedStitch;
  const activeIdxRef = useRef(activeIndex);
  const sectionsRef = useRef(sections);
  sectionsRef.current = sections;
  activeIdxRef.current = activeIndex;
  const isSelectedRef = useRef((r, c) => false);
  const clipboardRef = useRef(null);
  const historyStack = useRef([]);
  const historyPos = useRef(-1);
  const loadingRef = useRef(false);

  const paintCell = useCallback((r, c) => {
    setSections(prev => {
      const next = cloneSections(prev);
      const idx = activeIdxRef.current;
      if (next[idx]?.grid?.[r]?.[c] !== undefined) {
        next[idx].grid[r][c] = stitchRef.current;
      }
      return next;
    });
  }, []);

  const isSelected = (r, c) => {
    if (!selStart || !selEnd) return false;
    const r1 = Math.min(selStart.r, selEnd.r);
    const r2 = Math.max(selStart.r, selEnd.r);
    const c1 = Math.min(selStart.c, selEnd.c);
    const c2 = Math.max(selStart.c, selEnd.c);
    return r >= r1 && r <= r2 && c >= c1 && c <= c2;
  };
  isSelectedRef.current = isSelected;

  const pushHistory = useCallback(() => {
    setSections(prev => {
      const snap = cloneSections(prev);
      historyStack.current = historyStack.current.slice(0, historyPos.current + 1);
      historyStack.current.push(snap);
      if (historyStack.current.length > 50) historyStack.current.shift();
      historyPos.current = historyStack.current.length - 1;
      return prev;
    });
  }, []);

  const handleCopy = () => {
    if (!selStart || !selEnd) { Alert.alert(t.copyAlert); return; }
    const r1 = Math.min(selStart.r, selEnd.r);
    const r2 = Math.max(selStart.r, selEnd.r);
    const c1 = Math.min(selStart.c, selEnd.c);
    const c2 = Math.max(selStart.c, selEnd.c);
    const grid = [];
    for (let r = r1; r <= r2; r++) {
      const row = [];
      for (let c = c1; c <= c2; c++) row.push(active.grid[r]?.[c] || 'm');
      grid.push(row);
    }
    clipboardRef.current = grid;
    Alert.alert(`${t.copied} ${grid[0].length}×${grid.length}`);
  };

  const handlePaste = () => {
    if (!clipboardRef.current) { Alert.alert(t.pasteAlert); return; }
    if (!active) return;
    const grid = clipboardRef.current;
    const anchor = selStart || { r: 0, c: 0 };
    pushHistory();
    setSections(prev => {
      const next = cloneSections(prev);
      for (let r = 0; r < grid.length; r++) {
        for (let c = 0; c < grid[0].length; c++) {
          const tr = anchor.r + r;
          const tc = anchor.c + c;
          if (next[activeIndex]?.grid?.[tr]?.[tc] !== undefined) {
            next[activeIndex].grid[tr][tc] = grid[r][c];
          }
        }
      }
      return next;
    });
  };

  const handleUndo = useCallback(() => {
    if (historyPos.current < 0) return;
    setSections(() => {
      historyPos.current--;
      return cloneSections(historyStack.current[historyPos.current]);
    });
  }, []);

  const handleRedo = useCallback(() => {
    if (historyPos.current + 1 >= historyStack.current.length) return;
    setSections(() => {
      historyPos.current++;
      return cloneSections(historyStack.current[historyPos.current]);
    });
  }, []);

  const serializeProject = async () => {
    return {
      garmentType,
      isCircular,
      sections: sections.map(s => ({
        key: s.key, label: s.label, width: s.width, height: s.height, grid: s.grid,
        increases: s.increases || [], decreases: s.decreases || [],
      })),
      gauge, gaugeRows, chestCm, lengthCm, sleeveCm,
      projectName, notes,
    };
  };

  const deserializeProject = (data) => {
    loadingRef.current = true;
    setGarmentType(data.garmentType || 'sweater');
    setIsCircular(data.isCircular || false);
    setSections(data.sections || []);
    setGauge(data.gauge || '22');
    setGaugeRows(data.gaugeRows || '30');
    setChestCm(data.chestCm || '');
    setLengthCm(data.lengthCm || '');
    setSleeveCm(data.sleeveCm || '');
    if (data.projectName) setProjectName(data.projectName);
    if (data.notes) setNotes(data.notes);
    setActiveIndex(0);
    setTimeout(() => { loadingRef.current = false; }, 100);
  };

  useEffect(() => {
    if (loadingRef.current) return;
    if (route.params?.initialSections) {
      setSections(route.params.initialSections.map(s => ({
        key: s.name || s.key,
        label: s.label || (s.name === 'front' ? t.front : s.name === 'back' ? t.back : s.name === 'sleeve' ? t.sleeve : s.name),
        grid: s.grid,
        width: String(s.width || 20),
        height: String(s.height || 20),
        increases: s.increases || [],
        decreases: s.decreases || [],
      })));
      setActiveIndex(0);
      return;
    }
    const isCirc = isCircular && CIRCULAR_DEFS[garmentType];
    const defs = isCirc ? CIRCULAR_DEFS[garmentType] : SECTION_DEFS[garmentType];
    setSections(defs.map(d => ({
      key: d.key,
      label: d.label,
      width: String(d.defaultW),
      height: String(d.defaultH),
      grid: createGrid(d.defaultW, d.defaultH),
      increases: [],
      decreases: [],
    })));
    setActiveIndex(0);
  }, [garmentType, isCircular]);

  const active = sections[activeIndex] || sections[0];
  const activeW = parseInt(active?.width, 10) || 20;
  const activeH = parseInt(active?.height, 10) || 20;
  const autoCellSize = Math.floor(600 / Math.max(activeW, activeH));
  useEffect(() => { setZoom(Math.max(16, Math.min(64, autoCellSize))); }, [autoCellSize]);
  const cellSize = zoom;

  const handleCellPress = useCallback((ri, ci) => {
    if (mode === 'select') {
      if (!selStart) { setSelStart({ r: ri, c: ci }); setSelEnd(null); }
      else { setSelEnd({ r: ri, c: ci }); }
      return;
    }
    if (mode === 'aum_dim') {
      setSections(prev => {
        const next = cloneSections(prev);
        const sec = next[activeIndex];
        if (!sec) return prev;
        const isInc = sec.increases.some(p => p.r === ri && p.c === ci);
        const isDec = sec.decreases.some(p => p.r === ri && p.c === ci);
        if (isInc) {
          sec.increases = sec.increases.filter(p => !(p.r === ri && p.c === ci));
          sec.decreases.push({ r: ri, c: ci });
        } else if (isDec) {
          sec.decreases = sec.decreases.filter(p => !(p.r === ri && p.c === ci));
        } else {
          sec.increases.push({ r: ri, c: ci });
        }
        return next;
      });
      return;
    }
    pushHistory();
    paintCell(ri, ci);
  }, [mode, selStart, activeIndex, paintCell, pushHistory]);

  const handleCellPointerDown = useCallback((ri, ci) => {
    if (mode === 'select') { handleCellPress(ri, ci); return; }
    if (!paintingRef.current) { pushHistory(); }
    paintingRef.current = true;
  }, [mode, handleCellPress, pushHistory]);

  const handleGridChanged = useCallback((newGrid) => {
    setSections(prev => {
      const next = cloneSections(prev);
      const idx = activeIdxRef.current;
      if (next[idx]) {
        next[idx].grid = newGrid.map(r => [...r]);
      }
      return next;
    });
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.ctrlKey && e.key === 'z' && !e.shiftKey) { e.preventDefault(); handleUndo(); }
      if (e.ctrlKey && e.key === 'z' && e.shiftKey) { e.preventDefault(); handleRedo(); }
      if (e.ctrlKey && e.key === 'y') { e.preventDefault(); handleRedo(); }
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', onKey);
      return () => window.removeEventListener('keydown', onKey);
    }
  }, [handleUndo, handleRedo]);

  const handleSizePress = (size) => {
    setSizeKey(size);
    const m = SIZE_CHART[size];
    setChestCm(String(m.chest));
    setLengthCm(String(m.length));
    setSleeveCm(String(m.sleeve));
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const up = () => { paintingRef.current = false; };
    window.addEventListener('pointerup', up);
    window.addEventListener('pointerleave', up);
    return () => {
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointerleave', up);
    };
  }, []);

  const handleResize = () => {
    if (!active) return;
    pushHistory();
    const w = Math.max(5, Math.min(200, parseInt(active.width, 10) || 20));
    const h = Math.max(5, Math.min(200, parseInt(active.height, 10) || 20));
    setSections(prev => {
      const next = cloneSections(prev);
      next[activeIndex] = { ...next[activeIndex], width: String(w), height: String(h), grid: createGrid(w, h) };
      return next;
    });
  };

  const handleClear = () => {
    if (!active) return;
    pushHistory();
    setSections(prev => {
      const next = cloneSections(prev);
      const w = parseInt(next[activeIndex].width, 10) || 20;
      const h = parseInt(next[activeIndex].height, 10) || 20;
      next[activeIndex].grid = createGrid(w, h);
      return next;
    });
  };

  const handleAssistGo = () => {
    const targetSections = assistSections.includes('all')
      ? sections.map(s => s.key)
      : assistSections;

    pushHistory();

    const stitchMap = { m: 'm', l: 'l', t: 't', b: 'b', bo: 'bo', '2pm': '2pm', '3pm': '3pm' };
    const st = stitchMap[assistStitch] || 'm';

    let newSections = sections.map(sec => {
      if (!targetSections.includes(sec.key)) return sec;

      const h = sec.grid.length;
      const w = sec.grid[0]?.length || 1;
      const g = sec.grid.map(r => [...r]);
      const inc = [...(sec.increases || [])];
      const dec = [...(sec.decreases || [])];

      const parseRange = (s, max) => {
        if (!s) return [];
        // "1-10" or "1,3,5"
        if (s.includes('-')) {
          const [a, b] = s.split('-').map(x => parseInt(x.trim()) - 1);
          const result = [];
          for (let i = a; i <= Math.min(b, max - 1); i++) result.push(i);
          return result;
        }
        return s.split(',').map(x => parseInt(x.trim()) - 1).filter(x => x >= 0 && x < max);
      };

      switch (assistAction) {
        case 'fill_rows': {
          const rows = parseRange(assistRange, h);
          for (const r of rows) for (let c = 0; c < w; c++) g[r][c] = st;
          break;
        }
        case 'row_pattern': {
          const rows = parseRange(assistRange, h);
          const pattern = [];
          const regex = /(\d+)([a-zA-Z]+)/g;
          let match;
          while ((match = regex.exec(assistPattern)) !== null) {
            const count = parseInt(match[1]);
            const stName = stitchMap[match[2].toLowerCase()] || match[2].toLowerCase();
            for (let i = 0; i < count; i++) pattern.push(stName);
          }
          if (pattern.length === 0) break;
          for (const r of rows) {
            for (let c = 0; c < w; c++) {
              g[r][c] = pattern[c % pattern.length];
            }
          }
          break;
        }
        case 'fill_cols': {
          const cols = parseRange(assistRange, w);
          for (const c of cols) for (let r = 0; r < h; r++) g[r][c] = st;
          break;
        }
        case 'clear':
          for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) g[r][c] = 'm';
          break;
        case 'alternate': {
          const parts = assistPattern.trim().split(/\s+/).filter(Boolean).map(s => stitchMap[s] || s);
          const n = parseInt(assistEvery) || 2;
          for (let r = 0; r < h; r++) {
            const curSt = parts[Math.floor(r / n) % parts.length] || 'm';
            for (let c = 0; c < w; c++) g[r][c] = curSt;
          }
          break;
        }
        case 'increase': {
          const n = parseInt(assistEvery) || 5;
          for (let r = 0; r < h; r += n) {
            inc.push({ r, c: Math.floor(w * 0.1) });
            inc.push({ r, c: w - 1 - Math.floor(w * 0.1) });
          }
          break;
        }
        case 'decrease': {
          const n = parseInt(assistEvery) || 5;
          for (let r = 0; r < h; r += n) {
            dec.push({ r, c: Math.floor(w * 0.1) });
            dec.push({ r, c: w - 1 - Math.floor(w * 0.1) });
          }
          break;
        }
        case 'mirror_h':
          for (let r = 0; r < h; r++) for (let c = 0; c < w / 2; c++) g[r][w - 1 - c] = g[r][c];
          break;
        case 'neckline': {
          const startFromTop = parseInt(assistNeckStart) || 5;
          const neckSts = parseInt(assistNeckWidth) || 8;
          const neckStartRow = Math.max(0, h - startFromTop);
          const shoulder = Math.max(1, Math.floor((w - neckSts) / 2));
          for (let r = neckStartRow; r < h; r++) {
            for (let c = 0; c < w; c++) {
              if (c < shoulder || c >= w - shoulder) {
                g[r][c] = 'm';
              } else {
                g[r][c] = '_';
              }
            }
          }
          break;
        }
      }

      return { ...sec, grid: g, increases: inc, decreases: dec };
    });

    setSections(newSections);
    setCmdFeedback('Aplicado com sucesso!');
    setAssistSections(['front']);
    setAssistRange('');
    setAssistPattern('');
    setAssistEvery('');
    setAssistNeckStart('5');
    setAssistNeckWidth('8');
  };

  const applyMeasurements = () => {
    const gst = parseInt(gauge, 10) || 22;
    const grw = parseInt(gaugeRows, 10) || 30;
    const chest = parseFloat(chestCm) || 0;
    const length = parseFloat(lengthCm) || 0;
    const sleeve = parseFloat(sleeveCm) || 0;
    if (!chest && !length && !sleeve) { Alert.alert(t.enterMeasurement); return; }
    pushHistory();
    setSections(prev => {
      const next = cloneSections(prev);
      const updateSection = (idx, _sk, wSts, hRows) => {
        if (idx < next.length) {
          next[idx].width = String(wSts);
          next[idx].height = String(hRows);
          next[idx].grid = createGrid(wSts, hRows);
        }
      };
      if (garmentType === 'sweater') {
        if (isCircular) {
          updateSection(0, 'body', Math.max(5, Math.round(chest / 10 * gst)), Math.max(5, Math.round(length / 10 * grw)));
          if (sleeve) updateSection(1, 'sleeve', Math.max(5, Math.round(sleeve / 10 * gst * 0.6)), Math.max(5, Math.round(sleeve / 10 * grw)));
        } else {
          updateSection(0, 'front', Math.max(5, Math.round(chest / 10 * gst)), Math.max(5, Math.round(length / 10 * grw)));
          updateSection(1, 'back', Math.max(5, Math.round(chest / 10 * gst)), Math.max(5, Math.round(length / 10 * grw)));
          if (sleeve) updateSection(2, 'sleeve', Math.max(5, Math.round(sleeve / 10 * gst * 0.6)), Math.max(5, Math.round(sleeve / 10 * grw)));
        }
      } else if (garmentType === 'jacket') {
        updateSection(0, 'front_left', Math.max(5, Math.round(chest / 2 / 10 * gst * 1.1)), Math.max(5, Math.round(length / 10 * grw)));
        updateSection(1, 'front_right', Math.max(5, Math.round(chest / 2 / 10 * gst * 1.1)), Math.max(5, Math.round(length / 10 * grw)));
        updateSection(2, 'back', Math.max(5, Math.round(chest / 10 * gst)), Math.max(5, Math.round(length / 10 * grw)));
        if (sleeve) updateSection(3, 'sleeve', Math.max(5, Math.round(sleeve / 10 * gst * 0.6)), Math.max(5, Math.round(sleeve / 10 * grw)));
      } else if (garmentType === 'pants') {
        if (isCircular) {
          const halfLeg = chest / 2;
          updateSection(0, 'body', Math.max(5, Math.round((chest || 50) / 10 * gst)), Math.max(5, Math.round((length || 60) / 10 * grw)));
        } else {
          const halfLeg = chest / 2;
          updateSection(0, 'front', Math.max(5, Math.round(halfLeg / 10 * gst)), Math.max(5, Math.round((length || 60) / 10 * grw)));
          updateSection(1, 'back', Math.max(5, Math.round(halfLeg / 10 * gst)), Math.max(5, Math.round((length || 60) / 10 * grw)));
        }
      } else if (garmentType === 'socks') {
        updateSection(0, 'leg', Math.max(5, Math.round((chest || 20) / 10 * gst * 0.8)), Math.max(5, Math.round((length || 15) / 10 * grw * 0.6)));
        updateSection(1, 'foot', Math.max(5, Math.round((chest || 20) / 10 * gst * 0.8)), Math.max(5, Math.round((length || 10) / 10 * grw * 0.4)));
      } else if (garmentType === 'toy') {
        if (isCircular) {
          updateSection(0, 'body', Math.max(5, Math.round((chest || 20) / 10 * gst)), Math.max(5, Math.round((length || 20) / 10 * grw)));
        } else {
          updateSection(0, 'front', Math.max(5, Math.round((chest || 20) / 10 * gst)), Math.max(5, Math.round((length || 20) / 10 * grw)));
          updateSection(1, 'back', Math.max(5, Math.round((chest || 20) / 10 * gst)), Math.max(5, Math.round((length || 20) / 10 * grw)));
        }
      }
      return next;
    });
  };

  const handlePreview = async () => {
    if (!active) return;
    setPreviewLoading(true);
    setPreview(null);
    try {
      const result = await getStitchPreview(active.grid, 40);
      setPreview(result.image_base64);
    } catch (e) { Alert.alert(t.errorGeneric, e.message || t.previewError); }
    finally { setPreviewLoading(false); }
  };

  const updateActive = (field, val) => {
    setSections(prev => {
      const next = cloneSections(prev);
      next[activeIndex] = { ...next[activeIndex], [field]: val };
      return next;
    });
  };

  const handleSelectPattern = (patternKey, pattern) => {
    if (!active) return;
    pushHistory();
    const chart = pattern.chart;
    if (!chart || chart.length === 0) return;
    const pw = pattern.repeat_w || chart[0].length;
    const ph = pattern.repeat_h || chart.length;
    const w = parseInt(active.width, 10) || 20;
    const h = parseInt(active.height, 10) || 20;
    const grid = [];
    for (let r = 0; r < h; r++) {
      const row = [];
      const srcRow = chart[r % ph];
      for (let c = 0; c < w; c++) {
        const val = srcRow[c % pw];
        row.push(val === 0 ? 'm' : 'l');
      }
      grid.push(row);
    }
    setSections(prev => {
      const next = cloneSections(prev);
      next[activeIndex].grid = grid;
      return next;
    });
  };

  const handleSaveAsPattern = async () => {
    if (!active || !newPatternName.trim()) {
      Alert.alert(t.needName);
      return;
    }
    try {
      const chart = active.grid.map(row =>
        row.map(cell => (cell === 'm' ? 0 : cell === 'l' ? 1 : 0))
      );
      const result = await saveCustomPattern({
        name: newPatternName.trim(),
        chart,
        repeat_w: active.grid[0]?.length || 1,
        repeat_h: active.grid.length,
        description: t.namePattern,
      });
      Alert.alert(t.nameSaved, `"${result.name}" ${t.savePatternSuccess}`);
      setSavePatternModal(false);
      setNewPatternName('');
    } catch (e) {
      Alert.alert(t.errorGeneric, e.message || t.savePatternError);
    }
  };

  const pickRefImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {       Alert.alert(t.permissionNeeded, t.permissionDesc); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7, maxWidth: 800, maxHeight: 800 });
    if (!result.canceled && result.assets?.length > 0) setReferenceImage(result.assets[0].uri);
  };

  const handleGenerate = async () => {
    setLoading(true);
    try {
      let imageBase64 = null;
      if (referenceImage) { try { imageBase64 = await uriToBase64(referenceImage); } catch {} }
      const payload = {
        sections: sections.map(sec => ({
          name: sec.key, grid: sec.grid, width: sec.width, height: sec.height,
          increases: sec.increases || [], decreases: sec.decreases || [],
        })),
        garment_type: garmentType,
        is_circular: isCircular,
        gauge_stitches: parseInt(gauge, 10) || 22,
        gauge_rows: parseInt(gaugeRows, 10) || 30,
        image_base64: imageBase64,
        project_name: projectName || null,
        notes: notes || null,
        recipe_text: recipeEditing || null,
        needle: needleSize || null,
        lang: recipeLang || 'pt',
      };
      const result = await createStitchEditorPattern(payload);
      navigation.replace('Preview', { result, isSweater: false, isStitchBlanket: false, isToy: false, isStitchEditor: true });
    } catch (e) { Alert.alert(t.errorGeneric, e.message || t.errorPdf); }
    finally { setLoading(false); }
  };

  const generateRowInstructions = (sections, lang = 'pt') => {
    const sectionLabels = lang === 'en'
      ? { front: 'Front', back: 'Back', sleeve: 'Sleeve', leg: 'Leg', foot: 'Foot', body: 'Body', front_left: 'Front Left', front_right: 'Front Right' }
      : { front: 'Frente', back: 'Costas', sleeve: 'Manga', leg: 'Perna', foot: 'Pé', body: 'Corpo', front_left: 'Frente Esq.', front_right: 'Frente Dir.' };
    const stitchLabels = {
      m: lang === 'en' ? 'RS' : 'm',
      l: lang === 'en' ? 'WS' : 'l',
      t: lang === 'en' ? 'C' : 't',
      b: lang === 'en' ? 'H' : 'b',
      bo: lang === 'en' ? 'B' : 'bo',
      '2pm': '2pm', '3pm': '3pm',
      _: lang === 'en' ? '✕' : '✕',
    };
    const rowLabel = lang === 'en' ? 'Row' : 'Carreira';
    return sections.map(sec => {
      const label = sectionLabels[sec.key] || sec.key;
      const grid = sec.grid;
      const incs = sec.increases || [];
      const decs = sec.decreases || [];
      const incSet = new Set(incs.map(p => `${p.r},${p.c}`));
      const decSet = new Set(decs.map(p => `${p.r},${p.c}`));
      const rows = grid.map((row, ri) => {
        const reversedRi = grid.length - 1 - ri;
        const rowData = grid[reversedRi];
        let line = `${rowLabel} ${ri + 1}: `;
        // Count consecutive stitches
        let counts = [];
        let cur = null;
        let cnt = 0;
        for (let ci = 0; ci < rowData.length; ci++) {
          const st = rowData[ci] || 'm';
          if (st === '_') continue;
          if (st === cur) { cnt++; }
          else {
            if (cur !== null) counts.push({ st: cur, n: cnt });
            cur = st; cnt = 1;
          }
        }
        if (cur !== null) counts.push({ st: cur, n: cnt });
        line += counts.map(c => `${c.n}${stitchLabels[c.st] || c.st}`).join(', ');
        // Increases/decreases on this row (also reversed)
        const rowIncs = incs.filter(p => p.r === reversedRi);
        const rowDecs = decs.filter(p => p.r === reversedRi);
        if (rowIncs.length > 0) line += ` | ↑${rowIncs.length}`;
        if (rowDecs.length > 0) line += ` | ↓${rowDecs.length}`;
        return line;
      });
      return { label, rows };
    });
  };

  const handleRecipe = async () => {
    setRecipeLoading(true);
    try {
      const payload = {
        sections: sections.map(sec => ({
          name: sec.key, grid: sec.grid, width: sec.width, height: sec.height,
          increases: sec.increases || [], decreases: sec.decreases || [],
        })),
        garment_type: garmentType,
        gauge_stitches: parseInt(gauge, 10) || 22,
        gauge_rows: parseInt(gaugeRows, 10) || 30,
        is_circular: isCircular,
        chest_cm: chestCm ? parseFloat(chestCm) : null,
        length_cm: lengthCm ? parseFloat(lengthCm) : null,
        sleeve_cm: sleeveCm ? parseFloat(sleeveCm) : null,
      };
      const result = await generateStitchRecipe(payload);
      setRecipeData(result);
      setRecipeEditing(result.recipe_text || '');
      setRowInstructions(generateRowInstructions(sections, recipeLang));
      setActiveRowSection(0);
      setNeedleSize(result.needle || '4 mm');
      setRecipeModal(true);
    } catch (e) { Alert.alert(t.errorGeneric, e.message || t.recipeError); }
    finally { setRecipeLoading(false); }
  };

  const toggleRecipeLang = (lang) => {
    setRecipeLang(lang);
    const newRows = generateRowInstructions(sections, lang);
    setRowInstructions(newRows);
    const header = lang === 'en'
      ? 'RECIPE:\n========\n'
      : 'RECEITA:\n========\n';
    const footer = lang === 'en'
      ? '\nNeedle: ' + needleSize
      : '\nAgulha: ' + needleSize;
    setRecipeEditing(header + newRows.map(sec =>
      `${sec.label}:\n${sec.rows.join('\n')}`
    ).join('\n\n') + footer);
  };

  const secLabel = (sec) => t[sec.key] || sec.label;

  if (!active) return null;

  return (
    <ScrollWrapper style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{t.editTitle}</Text>
      <Text style={styles.subtitle}>{t.editSubtitle}</Text>

      <Text style={styles.sectionLabel}>{t.garmentType}</Text>
      <View style={styles.garmentRow}>
        {GARMENT_TYPES.map(gt => (
          <TouchableOpacity
            key={gt.key}
            style={[styles.garmentBtn, garmentType === gt.key && styles.garmentBtnSelected]}
            onPress={() => setGarmentType(gt.key)}
          >
            <Text style={styles.garmentIcon}>{gt.icon}</Text>
            <Text style={[styles.garmentLabel, garmentType === gt.key && styles.garmentLabelSelected]}>{t[gt.key] || gt.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {garmentType !== 'jacket' && (
        <View style={styles.circularRow}>
          <Text style={styles.sectionLabel}>{t.knitType}</Text>
          <TouchableOpacity
            style={[styles.circularToggle, !isCircular && styles.circularToggleActive]}
            onPress={() => setIsCircular(false)}
          >
            <Text style={[styles.circularToggleText, !isCircular && styles.circularToggleTextActive]}>{t.knitFlat}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.circularToggle, isCircular && styles.circularToggleActive]}
            onPress={() => setIsCircular(true)}
          >
            <Text style={[styles.circularToggleText, isCircular && styles.circularToggleTextActive]}>{t.knitRound}</Text>
          </TouchableOpacity>
        </View>
      )}

      <Text style={styles.sectionLabel}>{t.size}</Text>
      <View style={styles.sizeSelectorRow}>
        {Object.keys(SIZE_CHART).map(sz => (
          <TouchableOpacity
            key={sz}
            style={[styles.sizeSelectorBtn, sizeKey === sz && styles.sizeSelectorBtnSelected]}
            onPress={() => handleSizePress(sz)}
          >
            <Text style={[styles.sizeSelectorText, sizeKey === sz && styles.sizeSelectorTextSelected]}>{sz}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.sectionLabel}>{t.sections}</Text>
      <View style={styles.tabRow}>
        {sections.map((sec, i) => (
          <TouchableOpacity
            key={sec.key}
            style={[styles.tab, i === activeIndex && styles.tabActive]}
            onPress={() => setActiveIndex(i)}
          >
            <Text style={[styles.tabText, i === activeIndex && styles.tabTextActive]}>{secLabel(sec)}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.sizeRow}>
        <Text style={styles.sizeLabel}>{t.width}:</Text>
        <TextInput style={styles.sizeInput} value={active.width} onChangeText={v => updateActive('width', v)} keyboardType="numeric" />
        <Text style={styles.sizeLabel}>{t.height}:</Text>
        <TextInput style={styles.sizeInput} value={active.height} onChangeText={v => updateActive('height', v)} keyboardType="numeric" />
      </View>

      <Text style={styles.sectionLabel}>{t.gauge}</Text>
      <View style={styles.sizeRow}>
        <Text style={styles.sizeLabel}>{t.stitchesLabel}:</Text>
        <TextInput style={styles.sizeInput} value={gauge} onChangeText={setGauge} keyboardType="numeric" />
        <Text style={styles.sizeLabel}>{t.rowsLabel}:</Text>
        <TextInput style={styles.sizeInput} value={gaugeRows} onChangeText={setGaugeRows} keyboardType="numeric" />
      </View>

      <Text style={styles.sectionLabel}>{t.measurements}</Text>
      <View style={styles.measureRow}>
        <TextInput style={styles.measureInput} value={chestCm} onChangeText={setChestCm} keyboardType="numeric" placeholder={t.chest} placeholderTextColor="#BBB" />
        <TextInput style={styles.measureInput} value={lengthCm} onChangeText={setLengthCm} keyboardType="numeric" placeholder={t.length} placeholderTextColor="#BBB" />
        <TextInput style={styles.measureInput} value={sleeveCm} onChangeText={setSleeveCm} keyboardType="numeric" placeholder={t.sleeve} placeholderTextColor="#BBB" />
        <TouchableOpacity style={styles.applyBtn} onPress={applyMeasurements}>
          <Text style={styles.applyBtnText}>{t.calculate}</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.assistBtn} onPress={() => setAssistModal(true)}>
        <Text style={styles.assistBtnText}>🤖 {t.assistant}</Text>
      </TouchableOpacity>

      <Modal visible={assistModal} animationType="slide" transparent={false}>
        <View style={styles.assistOverlay}>
          <View style={styles.assistModalBox}>
            <Text style={styles.assistModalTitle}>🤖 {t.assistTitle}</Text>

            <Text style={styles.assistLabel}>{t.assistSections}</Text>
            <View style={styles.assistSectionRow}>
              {[
                { key: 'front', label: t.front },
                { key: 'back', label: t.back },
                { key: 'sleeve', label: t.sleeve },
                { key: 'all', label: t.all },
              ].map(s => (
                <TouchableOpacity
                  key={s.key}
                  style={[styles.assistChip, assistSections.includes(s.key) && styles.assistChipOn]}
                  onPress={() => setAssistSections(prev =>
                    prev.includes(s.key) ? prev.filter(x => x !== s.key) : [...prev, s.key]
                  )}
                >
                  <Text style={[styles.assistChipText, assistSections.includes(s.key) && styles.assistChipTextOn]}>{s.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.assistLabel}>{t.assistAction}</Text>
            <View style={styles.assistActionRow}>
              {[
                { key: 'fill_rows', label: t.assistFillRows },
                { key: 'fill_cols', label: t.assistFillCols },
                { key: 'row_pattern', label: t.assistRowPattern },
                { key: 'clear', label: t.assistClear },
                { key: 'alternate', label: t.assistAlternate },
                { key: 'increase', label: t.assistIncrease },
                { key: 'decrease', label: t.assistDecrease },
                { key: 'neckline', label: t.assistNeckline },
                { key: 'mirror_h', label: t.assistMirrorH },
              ].map(a => (
                <TouchableOpacity
                  key={a.key}
                  style={[styles.assistActionBtn, assistAction === a.key && styles.assistActionBtnOn]}
                  onPress={() => setAssistAction(a.key)}
                >
                  <Text style={[styles.assistActionBtnText, assistAction === a.key && styles.assistActionBtnTextOn]}>{a.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {(assistAction === 'fill_rows' || assistAction === 'fill_cols') && (
              <>
                <Text style={styles.assistLabel}>{t.assistStitch}</Text>
                <View style={styles.assistSectionRow}>
                  {['m', 'l', 't', 'b', 'bo', '2pm', '3pm'].map(st => (
                    <TouchableOpacity
                      key={st}
                      style={[styles.assistChip, assistStitch === st && styles.assistChipOn]}
                      onPress={() => setAssistStitch(st)}
                    >
                      <Text style={[styles.assistChipText, assistStitch === st && styles.assistChipTextOn]}>{st}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <Text style={styles.assistLabel}>
                  {assistAction === 'fill_rows' ? t.altRows : t.altCols}
                </Text>
                <TextInput style={styles.assistInput} value={assistRange} onChangeText={setAssistRange} placeholder="1-10" placeholderTextColor="#AAA" keyboardType="default" />
              </>
            )}

            {assistAction === 'row_pattern' && (
              <>
                <Text style={styles.assistLabel}>{t.altRowPattern}</Text>
                <TextInput style={styles.assistInput} value={assistRange} onChangeText={setAssistRange} placeholder="1-5" placeholderTextColor="#AAA" keyboardType="default" />
                <Text style={styles.assistLabel}>{t.altPattern}</Text>
                <TextInput style={styles.assistInput} value={assistPattern} onChangeText={setAssistPattern} placeholder="3m 2l 5m 2l 3m" placeholderTextColor="#AAA" />
                <Text style={styles.assistHint}>{t.assistPatternHint}</Text>
              </>
            )}

            {(assistAction === 'alternate') && (
              <>
                <Text style={styles.assistLabel}>{t.altStitchSep}</Text>
                <TextInput style={styles.assistInput} value={assistPattern} onChangeText={setAssistPattern} placeholder="m l" placeholderTextColor="#AAA" />
                <Text style={styles.assistLabel}>{t.altEvery}</Text>
                <TextInput style={styles.assistInput} value={assistEvery} onChangeText={setAssistEvery} placeholder="2" placeholderTextColor="#AAA" keyboardType="numeric" />
              </>
            )}

            {(assistAction === 'increase' || assistAction === 'decrease') && (
              <>
                <Text style={styles.assistLabel}>{t.altEvery}</Text>
                <TextInput style={styles.assistInput} value={assistEvery} onChangeText={setAssistEvery} placeholder="5" placeholderTextColor="#AAA" keyboardType="numeric" />
              </>
            )}

            {assistAction === 'neckline' && (
              <>
                <Text style={styles.assistLabel}>{t.altNeckStart}</Text>
                <TextInput style={styles.assistInput} value={assistNeckStart} onChangeText={setAssistNeckStart} placeholder="5" placeholderTextColor="#AAA" keyboardType="numeric" />
                <Text style={styles.assistLabel}>{t.altNeckWidth}</Text>
                <TextInput style={styles.assistInput} value={assistNeckWidth} onChangeText={setAssistNeckWidth} placeholder="8" placeholderTextColor="#AAA" keyboardType="numeric" />
                <Text style={styles.assistHint}>{t.altNeckHintDetail}</Text>
              </>
            )}

            <View style={styles.assistModalRow}>
              <TouchableOpacity style={styles.assistCancelBtn} onPress={() => setAssistModal(false)}>
                <Text style={styles.assistCancelBtnText}>{t.cancel}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.assistGoBtn} onPress={() => { handleAssistGo(); setAssistModal(false); }}>
                <Text style={styles.assistGoBtnText}>{t.apply}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <View style={styles.projectRow}>
        <TouchableOpacity style={styles.projectBtn} onPress={() => setProjectModal(true)}>
          <Text style={styles.projectBtnText}>💾 {t.saveLoad}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.actionRow}>
        <TouchableOpacity style={[styles.resizeBtn, { flex: 0.5 }]} onPress={handleUndo}>
          <Text style={styles.resizeBtnText}>{t.undo}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.resizeBtn, { flex: 0.5 }]} onPress={handleRedo}>
          <Text style={styles.resizeBtnText}>{t.redo}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.resizeBtn, { flex: 1 }]} onPress={handleResize}>
          <Text style={styles.resizeBtnText}>{t.resize}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.clearBtn, { flex: 1 }]} onPress={handleClear}>
          <Text style={styles.clearBtnText}>{t.clear}</Text>
        </TouchableOpacity>
      </View>
      <TouchableOpacity style={styles.fillAllBtn} onPress={() => {
        if (!active) return;
        pushHistory();
        const w = parseInt(active.width, 10) || 20;
        const h = parseInt(active.height, 10) || 20;
        setSections(prev => {
          const next = cloneSections(prev);
          next[activeIndex].grid = Array.from({ length: h }, () => Array(w).fill(selectedStitch));
          return next;
        });
      }}>
        <Text style={styles.fillAllBtnText}>{t.fillAll} {STITCH_TYPES.find(s => s.key === selectedStitch)?.label || selectedStitch}</Text>
      </TouchableOpacity>

      <View style={styles.patternActionRow}>
        <TouchableOpacity style={styles.patternBtn} onPress={() => setPatternPicker(true)}>
          <Text style={styles.patternBtnText}>📚 {t.patternLibrary}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.patternBtn} onPress={() => setSavePatternModal(true)}>
          <Text style={styles.patternBtnText}>💾 {t.savePattern}</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.recipeBtn} onPress={handleRecipe}>
        {recipeLoading ? (
          <ActivityIndicator color="#FFF" />
        ) : (
          <Text style={styles.recipeBtnText}>📖 {t.generateRecipe}</Text>
        )}
      </TouchableOpacity>

      <PatternPicker
        visible={patternPicker}
        onClose={() => setPatternPicker(false)}
        onSelect={handleSelectPattern}
      />

      <Modal visible={savePatternModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>{t.savePatternTitle}</Text>
            <TextInput
              style={styles.modalInput}
              value={newPatternName}
              onChangeText={setNewPatternName}
              placeholder={t.patternNamePlaceholder}
              placeholderTextColor="#AAA"
            />
            <View style={styles.modalRow}>
              <TouchableOpacity style={styles.modalBtn} onPress={() => { setSavePatternModal(false); setNewPatternName(''); }}>
                <Text style={styles.modalBtnText}>{t.cancel}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, styles.modalBtnPrimary]} onPress={handleSaveAsPattern}>
                <Text style={[styles.modalBtnText, { color: '#FFF' }]}>{t.save}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={recipeModal} transparent animationType="slide">
        <View style={styles.recipeOverlay}>
          <View style={styles.recipeContainer}>
            <View style={styles.recipeHeaderRow}>
              <Text style={styles.modalTitle}>📖 {t.recipe}</Text>
              <View style={styles.recipeLangRow}>
                <TouchableOpacity style={[styles.recipeLangBtn, recipeLang === 'pt' && styles.recipeLangBtnOn]} onPress={() => toggleRecipeLang('pt')}>
                  <Text style={[styles.recipeLangBtnText, recipeLang === 'pt' && styles.recipeLangBtnTextOn]}>PT</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.recipeLangBtn, recipeLang === 'en' && styles.recipeLangBtnOn]} onPress={() => toggleRecipeLang('en')}>
                  <Text style={[styles.recipeLangBtnText, recipeLang === 'en' && styles.recipeLangBtnTextOn]}>EN</Text>
                </TouchableOpacity>
              </View>
            </View>
            {recipeData && (
              <>
                {rowInstructions && rowInstructions.length > 1 && (
                  <View style={styles.assistSectionRow}>
                    {rowInstructions.map((sec, i) => (
                      <TouchableOpacity
                        key={i}
                        style={[styles.assistChip, activeRowSection === i && styles.assistChipOn]}
                        onPress={() => setActiveRowSection(i)}
                      >
                        <Text style={[styles.assistChipText, activeRowSection === i && styles.assistChipTextOn]}>{secLabel(sec)}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
                <ScrollView style={styles.recipeScroll}>
                  <Text style={styles.assistLabel}>{t.instructions}</Text>
                  <TextInput
                    style={styles.recipeTextInput}
                    multiline
                    value={recipeEditing}
                    onChangeText={setRecipeEditing}
                    textAlignVertical="top"
                    scrollEnabled={false}
                  />
                  <View style={{ height: 10 }} />
                  <View style={styles.recipeMetaRow}>
                    <Text style={styles.recipeMetaLabel}>{t.needle}:</Text>
                    <TextInput style={styles.recipeMetaInput} value={needleSize} onChangeText={setNeedleSize} placeholder="4 mm" placeholderTextColor="#AAA" />
                    <Text style={styles.recipeMetaLabel}>{t.gauge}:</Text>
                    <Text style={styles.recipeMeta}>{recipeData.gauge}</Text>
                  </View>
                  <Text style={styles.recipeMeta}>{t.yarnEstimate}: ~{recipeData.yarn_estimate}</Text>
                </ScrollView>
              </>
            )}
            <View style={styles.recipeActions}>
              <TouchableOpacity style={styles.closeBtn} onPress={() => setRecipeModal(false)}>
                <Text style={styles.closeBtnText}>{t.close}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <ProjectModal
        visible={projectModal}
        onClose={() => setProjectModal(false)}
        onLoad={async (data) => {
          if (data === '__save__') return await serializeProject();
          deserializeProject(data);
        }}
        projectType="pontos"
      />

      {sections.map((sec, idx) => (
        <View key={sec.key} style={{ marginBottom: 16, width: '100%' }}>
          <Text style={styles.sectionLabel}>{secLabel(sec)} — {sec.width}×{sec.height}</Text>
          <View style={{ width: '100%', borderWidth: 3, borderColor: '#1A237E', borderRadius: 10, backgroundColor: '#FFF', overflow: 'auto', maxHeight: '65vh' }}>
            <GridCanvas
              grid={sec.grid}
              cellSize={cellSize}
              mode={mode}
              selectedStitch={stitchRef.current}
              increases={sec.increases}
              decreases={sec.decreases}
              isSelected={(r, c) => idx === activeIndex && isSelectedRef.current(r, c)}
              onCellPress={(r, c) => { activeIdxRef.current = idx; setActiveIndex(idx); handleCellPress(r, c); }}
              onCellPaintStart={(r, c) => { activeIdxRef.current = idx; setActiveIndex(idx); handleCellPointerDown(r, c); }}
              onGridChanged={(newGrid) => { activeIdxRef.current = idx; setActiveIndex(idx); handleGridChanged(newGrid); }}
            />
          </View>
        </View>
      ))}

      <View style={styles.selectionRow}>
        <TouchableOpacity style={[styles.modeBtn, mode === 'paint' && styles.modeBtnActive]} onPress={() => { setMode('paint'); setSelStart(null); setSelEnd(null); }}>
          <Text style={[styles.modeBtnText, mode === 'paint' && styles.modeBtnTextActive]}>{t.paint}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.modeBtn, mode === 'select' && styles.modeBtnActive]} onPress={() => { setMode('select'); setSelStart(null); setSelEnd(null); }}>
          <Text style={[styles.modeBtnText, mode === 'select' && styles.modeBtnTextActive]}>{t.select}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.modeBtn, mode === 'aum_dim' && styles.modeBtnActive]} onPress={() => { setMode('aum_dim'); }}>
          <Text style={[styles.modeBtnText, mode === 'aum_dim' && styles.modeBtnTextActive]}>{t.aumDim}</Text>
        </TouchableOpacity>
        {mode === 'select' && (
          <>
            <TouchableOpacity style={styles.copyBtn} onPress={handleCopy}>
              <Text style={styles.copyBtnText}>{t.copy}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.pasteBtn} onPress={handlePaste}>
              <Text style={styles.pasteBtnText}>{t.paste}</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      <View style={styles.zoomRow}>
        <Text style={styles.zoomLabel}>{t.zoom}:</Text>
        <TouchableOpacity style={styles.zoomBtn} onPress={() => setZoom(z => Math.max(16, z - 4))}>
          <Text style={styles.zoomBtnText}>−</Text>
        </TouchableOpacity>
        <Text style={styles.zoomValue}>{zoom}px</Text>
        <TouchableOpacity style={styles.zoomBtn} onPress={() => setZoom(z => Math.min(64, z + 4))}>
          <Text style={styles.zoomBtnText}>+</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.exportRow}>
        <TouchableOpacity style={styles.exportBtn} onPress={() => {
          if (!active) return;
          const lookup = (k) => STITCH_TYPES.find(s => s.key === k)?.color || '#FFF';
          const { renderGridToCanvas, downloadPng } = require('../services/ExportService');
          const canvas = renderGridToCanvas(active.grid, lookup, Math.max(10, Math.min(30, zoom)));
          downloadPng(canvas, `${active.label.toLowerCase().replace(/\s/g, '_')}.png`);
        }}>
          <Text style={styles.exportBtnText}>{t.exportPng}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.exportBtn} onPress={() => {
          if (!active) return;
          const lookup = (k) => STITCH_TYPES.find(s => s.key === k)?.color || '#FFF';
          const { generateSvg, downloadSvg } = require('../services/ExportService');
          const svg = generateSvg(active.grid, lookup, Math.max(10, Math.min(30, zoom)));
          downloadSvg(svg, `${active.label.toLowerCase().replace(/\s/g, '_')}.svg`);
        }}>
          <Text style={styles.exportBtnText}>{t.exportSvg}</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.previewBtn} onPress={handlePreview} disabled={previewLoading}>
        {previewLoading ? <ActivityIndicator color="#6B4F8A" /> : <Text style={styles.previewBtnText}>{t.preview}</Text>}
      </TouchableOpacity>

      {preview && (
        <View style={styles.previewBox}>
          <Text style={styles.previewLabel}>{t.previewLabel} {secLabel(active)}</Text>
          <Image source={{ uri: `data:image/png;base64,${preview}` }} style={styles.previewImg} resizeMode="contain" />
        </View>
      )}

      <Text style={styles.sectionLabel}>{t.stitchToolbar}</Text>
      <View style={styles.toolbar}>
        {STITCH_TYPES.map(st => (
          <TouchableOpacity
            key={st.key}
            style={[styles.toolBtn, selectedStitch === st.key && styles.toolBtnSelected]}
            onPress={() => setSelectedStitch(st.key)}
          >
            <Text style={[styles.toolBtnText, selectedStitch === st.key && styles.toolBtnTextSelected]}>{st.label}</Text>
            <Text style={styles.toolBtnName}>{st.name}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.infoBox}>
        <Text style={styles.infoTitle}>{t.pdfIncludes}</Text>
        <Text style={styles.infoText}>• {t.pdfChartDetail}</Text>
        <Text style={styles.infoText}>• {t.pdfGuideDetail} {t.garmentInfo} {t[garmentType] || garmentType}</Text>
        <Text style={styles.infoText}>• {t.pdfInstructionsDetail}</Text>
        <Text style={styles.infoText}>• {t.pdfTableDetail}</Text>
      </View>

      <Text style={styles.sectionLabel}>{t.projectName}</Text>
      <TextInput
        style={styles.textInput}
        value={projectName}
        onChangeText={setProjectName}
        placeholder={t.projectNamePlaceholder}
        placeholderTextColor="#BBB"
      />

      <Text style={styles.sectionLabel}>{t.imagePdf}</Text>
      <View style={styles.imageRow}>
        {referenceImage ? (
          <View style={styles.imagePreviewBox}>
            <Image source={{ uri: referenceImage }} style={styles.imagePreview} />
            <TouchableOpacity onPress={() => setReferenceImage(null)} style={styles.removeImageBtn}>
              <Text style={styles.removeImageBtnText}>{t.remove}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={styles.imageBtn} onPress={pickRefImage}>
            <Text style={styles.imageBtnText}>{t.chooseImage}</Text>
          </TouchableOpacity>
        )}
      </View>

      <Text style={styles.sectionLabel}>{t.notes}</Text>
      <TextInput
        style={styles.notesInput}
        value={notes}
        onChangeText={setNotes}
        placeholder={t.notesPlaceholder}
        placeholderTextColor="#BBB"
        multiline
        textAlignVertical="top"
      />

      <TouchableOpacity style={[styles.generateBtn, loading && styles.btnDisabled]} onPress={handleGenerate} disabled={loading}>
        {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.generateBtnText}>📄 {t.generatePdf}</Text>}
      </TouchableOpacity>
      <View style={{ height: 40 }} />
    </ScrollWrapper>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F0FF' },
  content: { padding: 12, alignItems: 'center' },
  title: { fontSize: 22, fontWeight: 'bold', color: '#6B4F8A', marginBottom: 2 },
  subtitle: { fontSize: 13, color: '#888', marginBottom: 12 },
  sectionLabel: { fontSize: 14, fontWeight: 'bold', color: '#6B4F8A', marginTop: 10, marginBottom: 6, alignSelf: 'flex-start' },
  garmentRow: { flexDirection: 'row', gap: 6, width: '100%' },
  garmentBtn: { flex: 1, backgroundColor: '#FFF', borderWidth: 2, borderColor: '#DDD', borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  garmentBtnSelected: { borderColor: '#6B4F8A', backgroundColor: '#F0EBF8' },
  garmentIcon: { fontSize: 22 },
  garmentLabel: { fontSize: 12, color: '#666', fontWeight: '600', marginTop: 2 },
  garmentLabelSelected: { color: '#6B4F8A' },
  circularRow: { flexDirection: 'row', gap: 6, width: '100%', alignItems: 'center' },
  circularToggle: { flex: 1, backgroundColor: '#FFF', borderWidth: 2, borderColor: '#DDD', borderRadius: 8, paddingVertical: 8, alignItems: 'center' },
  circularToggleActive: { borderColor: '#6B4F8A', backgroundColor: '#F0EBF8' },
  circularToggleText: { fontSize: 13, color: '#666', fontWeight: '600' },
  circularToggleTextActive: { color: '#6B4F8A' },
  sizeSelectorRow: { flexDirection: 'row', gap: 6, width: '100%' },
  sizeSelectorBtn: { flex: 1, backgroundColor: '#FFF', borderWidth: 2, borderColor: '#DDD', borderRadius: 8, paddingVertical: 8, alignItems: 'center' },
  sizeSelectorBtnSelected: { borderColor: '#6B4F8A', backgroundColor: '#F0EBF8' },
  sizeSelectorText: { fontSize: 14, color: '#666', fontWeight: 'bold' },
  sizeSelectorTextSelected: { color: '#6B4F8A' },
  tabRow: { flexDirection: 'row', gap: 4, width: '100%' },
  tab: { flex: 1, backgroundColor: '#FFF', borderWidth: 1.5, borderColor: '#DDD', borderRadius: 8, paddingVertical: 8, alignItems: 'center' },
  tabActive: { borderColor: '#6B4F8A', backgroundColor: '#F0EBF8' },
  tabText: { fontSize: 13, color: '#666', fontWeight: '600' },
  tabTextActive: { color: '#6B4F8A' },
  sizeRow: { flexDirection: 'row', alignItems: 'center', gap: 4, width: '100%' },
  sizeLabel: { fontSize: 13, color: '#333', fontWeight: '600' },
  sizeInput: { borderWidth: 1, borderColor: '#CCC', borderRadius: 6, padding: 4, width: 55, textAlign: 'center', fontSize: 14, backgroundColor: '#FFF' },
  imageRow: { flexDirection: 'row', gap: 8, width: '100%', alignItems: 'center' },
  imageBtn: { flex: 1, backgroundColor: '#FFF', borderWidth: 2, borderColor: '#6B4F8A', borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  imageBtnText: { fontSize: 14, color: '#6B4F8A', fontWeight: 'bold' },
  imagePreviewBox: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  imagePreview: { width: 60, height: 60, borderRadius: 6, borderWidth: 1, borderColor: '#DDD' },
  removeImageBtn: { backgroundColor: '#E87A90', borderRadius: 6, paddingVertical: 6, paddingHorizontal: 12 },
  removeImageBtnText: { color: '#FFF', fontSize: 12, fontWeight: 'bold' },
  textInput: { borderWidth: 1, borderColor: '#CCC', borderRadius: 8, padding: 10, fontSize: 14, backgroundColor: '#FFF', width: '100%' },
  notesInput: { borderWidth: 1, borderColor: '#CCC', borderRadius: 8, padding: 10, fontSize: 14, backgroundColor: '#FFF', width: '100%', minHeight: 80 },
  projectRow: { flexDirection: 'row', gap: 8, width: '100%', marginTop: 8 },
  projectBtn: { flex: 1, backgroundColor: '#FFF', borderWidth: 2, borderColor: '#6B4F8A', borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  projectBtnText: { fontSize: 14, color: '#6B4F8A', fontWeight: 'bold' },
  patternActionRow: { flexDirection: 'row', gap: 8, width: '100%', marginTop: 6 },
  patternBtn: { flex: 1, backgroundColor: '#FFF', borderWidth: 2, borderColor: '#4A8B6F', borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  patternBtnText: { fontSize: 14, color: '#4A8B6F', fontWeight: 'bold' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalBox: { backgroundColor: '#FFF', borderRadius: 16, padding: 20, width: '85%' },
  modalTitle: { fontSize: 17, fontWeight: 'bold', color: '#6B4F8A', marginBottom: 12 },
  modalInput: { borderWidth: 1, borderColor: '#CCC', borderRadius: 8, padding: 10, fontSize: 15, marginBottom: 14 },
  modalRow: { flexDirection: 'row', gap: 8, justifyContent: 'flex-end' },
  modalBtn: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8 },
  modalBtnPrimary: { backgroundColor: '#6B4F8A' },
  modalBtnText: { fontSize: 14, fontWeight: 'bold', color: '#6B4F8A' },
  recipeBtn: { backgroundColor: '#E67E22', borderRadius: 8, paddingVertical: 10, alignItems: 'center', marginTop: 6, width: '100%' },
  recipeBtnText: { color: '#FFF', fontSize: 14, fontWeight: 'bold' },
  recipeOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  recipeContainer: { backgroundColor: '#FFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 16, maxHeight: '80%' },
  recipeScroll: { maxHeight: 400, marginBottom: 10 },
  recipeLine: { fontSize: 12, color: '#333', lineHeight: 18 },
  recipeMeta: { fontSize: 10, color: '#888', marginTop: 4, fontStyle: 'italic' },
  recipeMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  recipeHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%' },
  recipeLangRow: { flexDirection: 'row', gap: 4 },
  recipeLangBtn: { backgroundColor: '#F0F0F0', borderRadius: 6, paddingVertical: 4, paddingHorizontal: 10, borderWidth: 1.5, borderColor: 'transparent' },
  recipeLangBtnOn: { borderColor: '#6B4F8A', backgroundColor: '#F0EBF8' },
  recipeLangBtnText: { fontSize: 12, color: '#666', fontWeight: 'bold' },
  recipeLangBtnTextOn: { color: '#6B4F8A' },
  recipeMetaLabel: { fontSize: 11, color: '#666', fontWeight: '600' },
  recipeMetaInput: { borderWidth: 1, borderColor: '#DDD', borderRadius: 4, padding: 4, fontSize: 11, width: 80, backgroundColor: '#FFF', textAlign: 'center' },
  recipeActions: { flexDirection: 'row', gap: 8, justifyContent: 'flex-end' },
  recipeTextInput: { fontSize: 12, color: '#333', lineHeight: 18, borderWidth: 1, borderColor: '#DDD', borderRadius: 8, padding: 10, minHeight: 200, backgroundColor: '#FAFAFA' },
  rowInstrSection: { marginBottom: 12 },
  rowInstrSectionTitle: { fontSize: 14, fontWeight: 'bold', color: '#6B4F8A', marginBottom: 6 },
  rowInstrLine: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 },
  rowInstrNum: { width: 28, fontSize: 10, color: '#999', fontWeight: 'bold', textAlign: 'right' },
  rowInstrInput: { flex: 1, borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 4, padding: 4, fontSize: 11, backgroundColor: '#FFF' },
  closeBtn: { backgroundColor: '#6B4F8A', borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginTop: 10 },
  closeBtnText: { color: '#FFF', fontSize: 15, fontWeight: 'bold' },
  measureRow: { flexDirection: 'row', gap: 4, width: '100%', alignItems: 'center' },
  measureInput: { borderWidth: 1, borderColor: '#CCC', borderRadius: 6, padding: 6, flex: 1, textAlign: 'center', fontSize: 13, backgroundColor: '#FFF' },
  applyBtn: { backgroundColor: '#6B4F8A', borderRadius: 6, paddingVertical: 8, paddingHorizontal: 12 },
  applyBtnText: { color: '#FFF', fontSize: 13, fontWeight: 'bold' },
  fillAllBtn: { backgroundColor: '#4A8B6F', borderRadius: 6, paddingVertical: 8, paddingHorizontal: 16, alignItems: 'center', marginTop: 6, width: '100%' },
  fillAllBtnText: { color: '#FFF', fontSize: 13, fontWeight: 'bold' },
  cmdFeedback: { fontSize: 12, color: '#4A8B6F', marginBottom: 6, fontStyle: 'italic' },
  assistBtn: { backgroundColor: '#6B4F8A', borderRadius: 8, paddingVertical: 10, paddingHorizontal: 20, alignItems: 'center', width: '100%', marginBottom: 8 },
  assistBtnText: { color: '#FFF', fontSize: 14, fontWeight: 'bold' },
  assistOverlay: { flex: 1, backgroundColor: '#F5F0FA', justifyContent: 'center', paddingTop: 40 },
  assistModalBox: { backgroundColor: '#FFF', margin: 20, borderRadius: 16, padding: 20, maxHeight: '90%' },
  assistModalTitle: { fontSize: 20, fontWeight: 'bold', color: '#6B4F8A', marginBottom: 16, textAlign: 'center' },
  assistLabel: { fontSize: 13, fontWeight: 'bold', color: '#333', marginTop: 10, marginBottom: 6 },
  assistSectionRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  assistChip: { backgroundColor: '#F0F0F0', borderRadius: 20, paddingVertical: 6, paddingHorizontal: 14 },
  assistChipOn: { backgroundColor: '#6B4F8A' },
  assistChipText: { fontSize: 13, color: '#555', fontWeight: '600' },
  assistChipTextOn: { color: '#FFF' },
  assistActionRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  assistActionBtn: { backgroundColor: '#F0F0F0', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12, borderWidth: 2, borderColor: 'transparent' },
  assistActionBtnOn: { borderColor: '#6B4F8A', backgroundColor: '#F0EBF8' },
  assistActionBtnText: { fontSize: 12, color: '#555', fontWeight: '600' },
  assistActionBtnTextOn: { color: '#6B4F8A' },
  assistInput: { borderWidth: 1, borderColor: '#CCC', borderRadius: 8, padding: 10, fontSize: 14, backgroundColor: '#FAFAFA', marginTop: 4 },
  assistHint: { fontSize: 11, color: '#888', marginTop: 4, fontStyle: 'italic' },
  assistModalRow: { flexDirection: 'row', gap: 12, marginTop: 20, justifyContent: 'flex-end' },
  assistCancelBtn: { backgroundColor: '#DDD', borderRadius: 8, paddingVertical: 10, paddingHorizontal: 20 },
  assistCancelBtnText: { fontSize: 14, color: '#555', fontWeight: 'bold' },
  assistGoBtn: { backgroundColor: '#6B4F8A', borderRadius: 8, paddingVertical: 10, paddingHorizontal: 20 },
  assistGoBtnText: { fontSize: 14, color: '#FFF', fontWeight: 'bold' },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 8, width: '100%' },
  resizeBtn: { backgroundColor: '#6B4F8A', borderRadius: 6, paddingVertical: 8, paddingHorizontal: 16, flex: 1, alignItems: 'center' },
  resizeBtnText: { color: '#FFF', fontSize: 14, fontWeight: 'bold' },
  clearBtn: { backgroundColor: '#E87A90', borderRadius: 6, paddingVertical: 8, paddingHorizontal: 16, flex: 1, alignItems: 'center' },
  clearBtnText: { color: '#FFF', fontSize: 14, fontWeight: 'bold' },
  gridScroll: { maxHeight: 350, borderWidth: 3, borderColor: '#1A237E', borderRadius: 10, backgroundColor: '#FFF' },
  gridScrollV: { maxHeight: 350 },
  grid: { padding: 4 },
  gridRow: { flexDirection: 'row', alignItems: 'center' },
  rowNum: { width: 20, fontSize: 8, color: '#999', textAlign: 'center' },
  colNum: { fontSize: 8, color: '#999', textAlign: 'center' },
  cell: { borderWidth: 0, alignItems: 'center', justifyContent: 'center' },
  cellActive: { backgroundColor: '#F0EBF8' },
  stitchCircle: { alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: 'rgba(0,0,0,0.08)' },
  stitchCircleSelected: { borderColor: '#FF6B35', borderWidth: 2.5 },
  cellClickable: { cursor: 'crosshair' },
  cellText: { color: '#6B4F8A', fontWeight: 'bold' },
  toolbar: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, justifyContent: 'center' },
  toolBtn: { backgroundColor: '#FFF', borderWidth: 2, borderColor: '#DDD', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 10, alignItems: 'center', minWidth: 46 },
  toolBtnSelected: { borderColor: '#6B4F8A', backgroundColor: '#F0EBF8' },
  toolBtnText: { fontSize: 15, fontWeight: 'bold', color: '#666' },
  toolBtnTextSelected: { color: '#6B4F8A' },
  toolBtnName: { fontSize: 8, color: '#999', marginTop: 1 },
  previewBtn: { backgroundColor: '#FFF', borderWidth: 2, borderColor: '#6B4F8A', borderRadius: 8, paddingVertical: 10, paddingHorizontal: 20, alignItems: 'center', marginTop: 10, width: '100%' },
  previewBtnText: { fontSize: 14, color: '#6B4F8A', fontWeight: 'bold' },
  previewBox: { backgroundColor: '#FFF', borderRadius: 10, padding: 10, width: '100%', marginTop: 8, borderWidth: 1, borderColor: '#E0E0E0', alignItems: 'center' },
  previewLabel: { fontSize: 12, fontWeight: 'bold', color: '#6B4F8A', marginBottom: 6 },
  previewImg: { width: '100%', height: 200, borderRadius: 6 },
  zoomRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, width: '100%', justifyContent: 'center' },
  zoomLabel: { fontSize: 13, color: '#666', fontWeight: '600' },
  zoomBtn: { backgroundColor: '#6B4F8A', borderRadius: 6, width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  zoomBtnText: { color: '#FFF', fontSize: 18, fontWeight: 'bold', lineHeight: 20 },
  zoomValue: { fontSize: 14, color: '#333', fontWeight: 'bold', minWidth: 40, textAlign: 'center' },
  selectionRow: { flexDirection: 'row', gap: 4, marginTop: 8, width: '100%', flexWrap: 'wrap' },
  modeBtn: { backgroundColor: '#FFF', borderWidth: 2, borderColor: '#DDD', borderRadius: 8, paddingVertical: 6, paddingHorizontal: 10, alignItems: 'center' },
  modeBtnActive: { borderColor: '#6B4F8A', backgroundColor: '#F0EBF8' },
  modeBtnText: { fontSize: 12, color: '#666', fontWeight: '600' },
  modeBtnTextActive: { color: '#6B4F8A' },
  copyBtn: { backgroundColor: '#4A8B6F', borderRadius: 6, paddingVertical: 6, paddingHorizontal: 12, alignItems: 'center' },
  copyBtnText: { color: '#FFF', fontSize: 12, fontWeight: 'bold' },
  pasteBtn: { backgroundColor: '#1A237E', borderRadius: 6, paddingVertical: 6, paddingHorizontal: 12, alignItems: 'center' },
  pasteBtnText: { color: '#FFF', fontSize: 12, fontWeight: 'bold' },
  exportRow: { flexDirection: 'row', gap: 8, width: '100%', marginTop: 8 },
  exportBtn: { flex: 1, backgroundColor: '#FFF', borderWidth: 2, borderColor: '#6B4F8A', borderRadius: 8, paddingVertical: 8, alignItems: 'center' },
  exportBtnText: { fontSize: 13, color: '#6B4F8A', fontWeight: 'bold' },
  infoBox: { backgroundColor: '#FFF', borderRadius: 10, padding: 14, width: '100%', borderWidth: 1, borderColor: '#E0E0E0', marginTop: 12 },
  infoTitle: { fontSize: 14, fontWeight: 'bold', color: '#6B4F8A', marginBottom: 6 },
  infoText: { fontSize: 12, color: '#555', marginBottom: 3, lineHeight: 16 },
  generateBtn: { backgroundColor: '#6B4F8A', borderRadius: 12, paddingVertical: 16, paddingHorizontal: 32, alignItems: 'center', marginTop: 16, width: '100%' },
  btnDisabled: { opacity: 0.6 },
  generateBtnText: { fontSize: 18, color: '#FFF', fontWeight: 'bold' },
});
