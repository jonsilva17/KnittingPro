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
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import ScrollWrapper from '../components/ScrollWrapper';
import ProjectModal from '../components/ProjectModal';
import ColorPicker from '../components/ColorPicker';
import { useLang } from '../lang';
import { createColorworkEditorPattern, imageToChartAI, uriToBase64 } from '../services/ApiService';

const COLOR_PALETTE = [
  { key: 'white', label: 'Branco', labelEn: 'White', color: '#FFFFFF' },
  { key: 'black', label: 'Preto', labelEn: 'Black', color: '#1A1A1A' },
  { key: 'red', label: 'Vermelho', labelEn: 'Red', color: '#CC0000' },
  { key: 'nvy', label: 'Marinho', labelEn: 'Navy', color: '#1A237E' },
  { key: 'blue', label: 'Azul', labelEn: 'Blue', color: '#1976D2' },
  { key: 'lblue', label: 'Azul Claro', labelEn: 'Light Blue', color: '#64B5F6' },
  { key: 'green', label: 'Verde', labelEn: 'Green', color: '#2E7D32' },
  { key: 'lime', label: 'Verde Claro', labelEn: 'Lime', color: '#8BC34A' },
  { key: 'yellow', label: 'Amarelo', labelEn: 'Yellow', color: '#FDD835' },
  { key: 'orange', label: 'Laranja', labelEn: 'Orange', color: '#EF6C00' },
  { key: 'purple', label: 'Roxo', labelEn: 'Purple', color: '#8E44AD' },
  { key: 'pink', label: 'Rosa', labelEn: 'Pink', color: '#E91E63' },
  { key: 'brown', label: 'Castanho', labelEn: 'Brown', color: '#795548' },
  { key: 'gray', label: 'Cinza', labelEn: 'Gray', color: '#9E9E9E' },
  { key: 'cream', label: 'Cru', labelEn: 'Cream', color: '#F5E6D0' },
  { key: 'wine', label: 'Vinho', labelEn: 'Wine', color: '#880E4F' },
  { key: 'turquoise', label: 'Turquesa', labelEn: 'Turquoise', color: '#00BCD4' },
  { key: 'teal', label: 'Verde Azul', labelEn: 'Teal', color: '#00897B' },
  { key: 'coral', label: 'Coral', labelEn: 'Coral', color: '#FF7043' },
  { key: 'salmon', label: 'Salmão', labelEn: 'Salmon', color: '#FA8072' },
  { key: 'lavender', label: 'Lavanda', labelEn: 'Lavender', color: '#B39DDB' },
  { key: 'mint', label: 'Menta', labelEn: 'Mint', color: '#80CBC4' },
  { key: 'gold', label: 'Dourado', labelEn: 'Gold', color: '#FFB300' },
  { key: 'silver', label: 'Prateado', labelEn: 'Silver', color: '#BDBDBD' },
  { key: 'burgundy', label: 'Bordô', labelEn: 'Burgundy', color: '#6A1B4D' },
  { key: 'mustard', label: 'Mostarda', labelEn: 'Mustard', color: '#C9A200' },
  { key: 'olive', label: 'Oliva', labelEn: 'Olive', color: '#827717' },
  { key: 'peach', label: 'Pêssego', labelEn: 'Peach', color: '#FFCCBC' },
  { key: 'rose', label: 'Rosa Claro', labelEn: 'Rose', color: '#F48FB1' },
  { key: 'sky', label: 'Céu', labelEn: 'Sky', color: '#81D4FA' },
  { key: 'beige', label: 'Bege', labelEn: 'Beige', color: '#E8D5B7' },
  { key: 'ivory', label: 'Marfim', labelEn: 'Ivory', color: '#FFF8E7' },
];

const GARMENT_TYPES = [
  { key: 'sweater', label: 'Camisola', icon: '🧥' },
  { key: 'jacket', label: 'Casaco', icon: '🧥' },
  { key: 'pants', label: 'Calças', icon: '👖' },
  { key: 'socks', label: 'Meias', icon: '🧦' },
  { key: 'toy', label: 'Boneco', icon: '🧸' },
];

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

function createGrid(w, h, defaultColor = 'white') {
  return Array.from({ length: h }, () => Array(w).fill(defaultColor));
}

function cloneSections(sections) {
  return sections.map(sec => ({
    ...sec,
    grid: sec.grid.map(row => [...row]),
  }));
}

export default function ColorworkEditorScreen({ navigation, route }) {
  const { t, lang } = useLang();
  const [garmentType, setGarmentType] = useState('sweater');
  const [sections, setSections] = useState([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [selectedColor, setSelectedColor] = useState('white');
  const [customColors, setCustomColors] = useState([]);
  const [colorPickerVisible, setColorPickerVisible] = useState(false);
  const fullPalette = [...COLOR_PALETTE, ...customColors.map((c, i) => ({
    key: `custom_${i}`, label: c, color: c,
  }))];
  const [gauge, setGauge] = useState('22');
  const [gaugeRows, setGaugeRows] = useState('30');
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [referenceImage, setReferenceImage] = useState(route?.params?.referenceImage || null);
  const [referenceTitle, setReferenceTitle] = useState(route?.params?.referenceTitle || null);
  const [aiProvider, setAiProvider] = useState('gemini');
  const [projectModal, setProjectModal] = useState(false);
  const [mode, setMode] = useState('paint');
  const [selStart, setSelStart] = useState(null);
  const [selEnd, setSelEnd] = useState(null);
  const [zoom, setZoom] = useState(24);
  const paintingRef = useRef(false);
  const clipboardRef = useRef(null);
  const historyStack = useRef([]);
  const historyPos = useRef(-1);

  const isSelected = (r, c) => {
    if (!selStart || !selEnd) return false;
    const r1 = Math.min(selStart.r, selEnd.r);
    const r2 = Math.max(selStart.r, selEnd.r);
    const c1 = Math.min(selStart.c, selEnd.c);
    const c2 = Math.max(selStart.c, selEnd.c);
    return r >= r1 && r <= r2 && c >= c1 && c <= c2;
  };

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

  const paintCell = useCallback((r, c) => {
    setSections(prev => {
      const next = cloneSections(prev);
      if (next[activeIndex]?.grid?.[r]?.[c] !== undefined) {
        next[activeIndex].grid[r][c] = selectedColor;
      }
      return next;
    });
  }, [selectedColor, activeIndex]);

  const handleCellPress = useCallback((ri, ci) => {
    if (mode === 'select') {
      if (!selStart) { setSelStart({ r: ri, c: ci }); setSelEnd(null); }
      else { setSelEnd({ r: ri, c: ci }); }
      return;
    }
    pushHistory();
    paintCell(ri, ci);
  }, [mode, selStart, paintCell, pushHistory]);

  const handleCellPointerDown = useCallback((ri, ci) => {
    if (mode === 'select') { handleCellPress(ri, ci); return; }
    if (!paintingRef.current) { pushHistory(); }
    paintingRef.current = true;
    paintCell(ri, ci);
  }, [mode, handleCellPress, pushHistory, paintCell]);

  const handleCellPointerEnter = useCallback((ri, ci) => {
    if (mode !== 'paint') return;
    if (paintingRef.current) paintCell(ri, ci);
  }, [mode, paintCell]);

  const handleCopy = () => {
    if (!selStart || !selEnd) { Alert.alert(t.copyAlert); return; }
    const r1 = Math.min(selStart.r, selEnd.r);
    const r2 = Math.max(selStart.r, selEnd.r);
    const c1 = Math.min(selStart.c, selEnd.c);
    const c2 = Math.max(selStart.c, selEnd.c);
    const grid = [];
    for (let r = r1; r <= r2; r++) {
      const row = [];
      for (let c = c1; c <= c2; c++) row.push(active.grid[r]?.[c] || 'white');
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
    let imageBase64 = null;
    if (referenceImage) { try { imageBase64 = await uriToBase64(referenceImage); } catch {} }
    return {
      garmentType,
      sections: sections.map(s => ({ key: s.key, label: s.label, width: s.width, height: s.height, grid: s.grid })),
      gauge, gaugeRows,
      referenceImage: imageBase64,
    };
  };

  const deserializeProject = (data) => {
    setGarmentType(data.garmentType || 'sweater');
    setSections(data.sections || []);
    setGauge(data.gauge || '22');
    setGaugeRows(data.gaugeRows || '30');
    if (data.referenceImage) setReferenceImage(`data:image/png;base64,${data.referenceImage}`);
    setActiveIndex(0);
  };

  useEffect(() => {
    const defs = SECTION_DEFS[garmentType];
    setSections(defs.map(d => ({
      key: d.key, label: d.label, width: String(d.defaultW), height: String(d.defaultH),
      grid: createGrid(d.defaultW, d.defaultH),
    })));
    setActiveIndex(0);
  }, [garmentType]);

  const active = sections[activeIndex] || sections[0];
  const activeW = parseInt(active?.width, 10) || 20;
  const activeH = parseInt(active?.height, 10) || 20;
  const autoCellSize = Math.floor(600 / Math.max(activeW, activeH));
  useEffect(() => { setZoom(Math.max(16, Math.min(64, autoCellSize))); }, [autoCellSize]);
  const cellSize = zoom;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onKey = (e) => {
      if (e.ctrlKey && e.key === 'z' && !e.shiftKey) { e.preventDefault(); handleUndo(); }
      if (e.ctrlKey && e.key === 'z' && e.shiftKey) { e.preventDefault(); handleRedo(); }
      if (e.ctrlKey && e.key === 'y') { e.preventDefault(); handleRedo(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleUndo, handleRedo]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const up = () => { paintingRef.current = false; };
    window.addEventListener('pointerup', up);
    window.addEventListener('pointerleave', up);
    return () => { window.removeEventListener('pointerup', up); window.removeEventListener('pointerleave', up); };
  }, []);

  const handleResize = () => {
    if (!active) return;
    pushHistory();
    const w = Math.max(5, Math.min(60, parseInt(active.width, 10) || 20));
    const h = Math.max(5, Math.min(60, parseInt(active.height, 10) || 20));
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
      next[activeIndex].grid = createGrid(parseInt(next[activeIndex].width, 10) || 20, parseInt(next[activeIndex].height, 10) || 20);
      return next;
    });
  };

  const updateActive = (field, val) => {
    setSections(prev => {
      const next = cloneSections(prev);
      next[activeIndex] = { ...next[activeIndex], [field]: val };
      return next;
    });
  };

  const pickGalleryImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert(t.permissionNeeded, t.permissionDesc); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7, maxWidth: 1024, maxHeight: 1024 });
    if (!result.canceled && result.assets?.length > 0) setReferenceImage(result.assets[0].uri);
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') { Alert.alert(t.permissionNeeded, t.camera); return; }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.7, maxWidth: 1024, maxHeight: 1024 });
    if (!result.canceled && result.assets?.length > 0) setReferenceImage(result.assets[0].uri);
  };

  const removeImage = () => setReferenceImage(null);

  const handleGenerate = async () => {
    setLoading(true);
    try {
      let imageBase64 = null;
      if (referenceImage) imageBase64 = await uriToBase64(referenceImage);
      const payload = {
        sections: sections.map(sec => ({
          name: sec.key, grid: sec.grid, width: parseInt(sec.width, 10) || 20, height: parseInt(sec.height, 10) || 20,
        })),
        garment_type: garmentType,
        gauge_stitches: parseInt(gauge, 10) || 22,
        gauge_rows: parseInt(gaugeRows, 10) || 30,
        colors: fullPalette.map(c => ({ key: c.key, hex: c.color, label: c.label })),
      };
      if (imageBase64) payload.image_base64 = imageBase64;
      const result = await createColorworkEditorPattern(payload);
      navigation.replace('Preview', { result, isSweater: false, isStitchBlanket: false, isToy: false, isStitchEditor: false, isColorworkEditor: true });
    } catch (e) { Alert.alert(t.errorGeneric, e.message || t.errorPdf); }
    finally { setLoading(false); }
  };

  const handleAIConvert = async () => {
    if (!referenceImage) return;
    setAiLoading(true);
    try {
      const b64 = await uriToBase64(referenceImage);
      const result = await imageToChartAI({
        image_base64: b64,
        size_key: 'M',
        pattern_key: null,
        gauge_st: parseInt(gauge, 10) || 22,
        gauge_rows: parseInt(gaugeRows, 10) || 30,
        provider: aiProvider,
      });
      pushHistory();
      setSections(prev => {
        const next = cloneSections(prev);
        if (!result.sections || result.sections.length === 0) return next;
        const aiSections = result.sections;
        next.forEach((sec, idx) => {
          const aiSec = aiSections[idx % aiSections.length];
          if (!aiSec || !aiSec.grid) return;
          const w = parseInt(sec.width, 10) || 20;
          const h = parseInt(sec.height, 10) || 20;
          const aiGrid = aiSec.grid;
          const aiH = aiGrid.length;
          const aiW = aiGrid[0]?.length || 1;
          const newGrid = [];
          for (let r = 0; r < h; r++) {
            const row = [];
            for (let c = 0; c < w; c++) {
              const ar = Math.floor((r / h) * aiH);
              const ac = Math.floor((c / w) * aiW);
              const cell = aiGrid[Math.min(ar, aiH - 1)]?.[Math.min(ac, aiW - 1)] || 'm';
              row.push(cell === 'm' ? selectedColor : 'white');
            }
            newGrid.push(row);
          }
          next[idx].grid = newGrid;
        });
        return next;
      });
      Alert.alert(t.success, 'Grid gerado pela IA. Ajusta as cores conforme necessário.');
    } catch (e) {
      Alert.alert(t.imageToChartError, e.message || 'Erro ao converter com IA');
    } finally {
      setAiLoading(false);
    }
  };

  const secLabel = (sec) => t[sec.key] || sec.label;

  if (!active) return null;

  return (
    <ScrollWrapper style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{t.colorworkEditor}</Text>
      <Text style={styles.subtitle}>{t.colorworkEditorDesc}</Text>

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

      <Text style={styles.sectionLabel}>{t.imagePdf}</Text>
      <View style={styles.imageRow}>
        {referenceImage ? (
          <View style={styles.imagePreviewBox}>
            <Image source={{ uri: referenceImage }} style={styles.imagePreview} />
            <TouchableOpacity onPress={removeImage} style={styles.removeImageBtn}>
              <Text style={styles.removeImageBtnText}>{t.remove}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <TouchableOpacity style={styles.imageBtn} onPress={pickGalleryImage}>
              <Text style={styles.imageBtnText}>📁 {t.chooseImage}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.imageBtn} onPress={takePhoto}>
              <Text style={styles.imageBtnText}>{t.camera}</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {referenceImage && (
        <>
          <Text style={styles.sectionLabel}>Assistente IA</Text>
          <View style={styles.providerRow}>
            {['groq','gemini','openai'].map(p => (
              <TouchableOpacity
                key={p}
                style={[styles.providerBtn, aiProvider === p && styles.providerBtnActive]}
                onPress={() => setAiProvider(p)}
              >
                <Text style={[styles.providerText, aiProvider === p && styles.providerTextActive]}>{p === 'groq' ? 'Groq' : p === 'gemini' ? 'Gemini' : 'OpenAI'}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity style={styles.aiConvertBtn} onPress={handleAIConvert} disabled={aiLoading}>
            {aiLoading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.aiConvertBtnText}>🤖 {t.imageToChartAutoFill}</Text>}
          </TouchableOpacity>
        </>
      )}

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
          next[activeIndex].grid = Array.from({ length: h }, () => Array(w).fill(selectedColor));
          return next;
        });
      }}>
        <Text style={styles.fillAllBtnText}>{t.fillAll} {fullPalette.find(c => c.key === selectedColor)?.[lang === 'en' ? 'labelEn' : 'label'] || selectedColor}</Text>
      </TouchableOpacity>

      <ProjectModal
        visible={projectModal}
        onClose={() => setProjectModal(false)}
        onLoad={async (data) => {
          if (data === '__save__') return await serializeProject();
          deserializeProject(data);
        }}
        projectType="jacquard"
      />

      <Text style={styles.sectionLabel}>{secLabel(active)}</Text>
      <ScrollView horizontal style={styles.gridScroll}>
        <ScrollView style={styles.gridScrollV}>
          <View style={styles.grid}>
            {active.grid.map((row, ri) => (
              <View key={ri} style={styles.gridRow}>
                <Text style={styles.rowNum}>{ri + 1}</Text>
                {row.map((cell, ci) => (
                  <TouchableOpacity
                    key={ci}
                    style={[
                      styles.cell,
                      { width: cellSize, height: cellSize },
                      mode === 'select' && styles.cellClickable,
                    ]}
                    onPress={() => handleCellPress(ri, ci)}
                    onPointerDown={() => handleCellPointerDown(ri, ci)}
                    onPointerEnter={() => handleCellPointerEnter(ri, ci)}
                  >
                    <View style={[
                      styles.stitchCircle,
                      {
                        width: cellSize * 0.85,
                        height: cellSize * 0.85,
                        borderRadius: cellSize * 0.425,
                        backgroundColor: fullPalette.find(c => c.key === cell)?.color || '#FFF',
                      },
                      isSelected(ri, ci) && styles.stitchCircleSelected,
                    ]} />
                  </TouchableOpacity>
                ))}
              </View>
            ))}
          </View>
        </ScrollView>
      </ScrollView>

      <View style={styles.selectionRow}>
        <TouchableOpacity style={[styles.modeBtn, mode === 'paint' && styles.modeBtnActive]} onPress={() => { setMode('paint'); setSelStart(null); setSelEnd(null); }}>
          <Text style={[styles.modeBtnText, mode === 'paint' && styles.modeBtnTextActive]}>{t.paint}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.modeBtn, mode === 'select' && styles.modeBtnActive]} onPress={() => { setMode('select'); setSelStart(null); setSelEnd(null); }}>
          <Text style={[styles.modeBtnText, mode === 'select' && styles.modeBtnTextActive]}>{t.select}</Text>
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
          const lookup = (k) => fullPalette.find(c => c.key === k)?.color || '#FFF';
          const { renderGridToCanvas, downloadPng } = require('../services/ExportService');
          const canvas = renderGridToCanvas(active.grid, lookup, Math.max(10, Math.min(30, zoom)));
          downloadPng(canvas, `${secLabel(active).toLowerCase().replace(/\s/g, '_')}.png`);
        }}>
          <Text style={styles.exportBtnText}>{t.exportPng}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.exportBtn} onPress={() => {
          if (!active) return;
          const lookup = (k) => fullPalette.find(c => c.key === k)?.color || '#FFF';
          const { generateSvg, downloadSvg } = require('../services/ExportService');
          const svg = generateSvg(active.grid, lookup, Math.max(10, Math.min(30, zoom)));
          downloadSvg(svg, `${secLabel(active).toLowerCase().replace(/\s/g, '_')}.svg`);
        }}>
          <Text style={styles.exportBtnText}>{t.exportSvg}</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionLabel}>{t.stitchToolbar}</Text>
      <View style={styles.palette}>
        {fullPalette.map(c => (
          <TouchableOpacity
            key={c.key}
            style={[styles.colorSwatch, { backgroundColor: c.color }, selectedColor === c.key && styles.colorSwatchSelected]}
            onPress={() => setSelectedColor(c.key)}
          >
            {selectedColor === c.key && (
              <Text style={[styles.colorCheck, { color: c.key === 'white' || c.key === 'cream' || c.key === 'yellow' || c.key.startsWith('custom_') ? '#333' : '#FFF' }]}>✓</Text>
            )}
          </TouchableOpacity>
        ))}
        <TouchableOpacity style={styles.addColorBtn} onPress={() => setColorPickerVisible(true)}>
          <Text style={styles.addColorBtnText}>+</Text>
        </TouchableOpacity>
      </View>

      <ColorPicker
        visible={colorPickerVisible}
        onClose={() => setColorPickerVisible(false)}
        onAdd={(hex) => { setCustomColors(prev => [...prev, hex]); setColorPickerVisible(false); }}
      />

      <TouchableOpacity style={[styles.generateBtn, loading && styles.btnDisabled]} onPress={handleGenerate} disabled={loading}>
        {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.generateBtnText}>📄 {t.generatePdf}</Text>}
      </TouchableOpacity>
      <View style={{ height: 40 }} />
    </ScrollWrapper>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F5FF' },
  content: { padding: 12, alignItems: 'center' },
  title: { fontSize: 22, fontWeight: 'bold', color: '#1A237E', marginBottom: 2 },
  subtitle: { fontSize: 13, color: '#888', marginBottom: 12 },
  sectionLabel: { fontSize: 14, fontWeight: 'bold', color: '#1A237E', marginTop: 10, marginBottom: 6, alignSelf: 'flex-start' },
  garmentRow: { flexDirection: 'row', gap: 6, width: '100%' },
  garmentBtn: { flex: 1, backgroundColor: '#FFF', borderWidth: 2, borderColor: '#DDD', borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  garmentBtnSelected: { borderColor: '#1A237E', backgroundColor: '#E8EAF6' },
  garmentIcon: { fontSize: 22 },
  garmentLabel: { fontSize: 12, color: '#666', fontWeight: '600', marginTop: 2 },
  garmentLabelSelected: { color: '#1A237E' },
  tabRow: { flexDirection: 'row', gap: 4, width: '100%' },
  tab: { flex: 1, backgroundColor: '#FFF', borderWidth: 1.5, borderColor: '#DDD', borderRadius: 8, paddingVertical: 8, alignItems: 'center' },
  tabActive: { borderColor: '#1A237E', backgroundColor: '#E8EAF6' },
  tabText: { fontSize: 13, color: '#666', fontWeight: '600' },
  tabTextActive: { color: '#1A237E' },
  sizeRow: { flexDirection: 'row', alignItems: 'center', gap: 4, width: '100%' },
  sizeLabel: { fontSize: 13, color: '#333', fontWeight: '600' },
  sizeInput: { borderWidth: 1, borderColor: '#CCC', borderRadius: 6, padding: 4, width: 55, textAlign: 'center', fontSize: 14, backgroundColor: '#FFF' },
  imageRow: { flexDirection: 'row', gap: 8, width: '100%', alignItems: 'center' },
  imageBtn: { flex: 1, backgroundColor: '#FFF', borderWidth: 2, borderColor: '#1A237E', borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  imageBtnText: { fontSize: 14, color: '#1A237E', fontWeight: 'bold' },
  imagePreviewBox: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  imagePreview: { width: 60, height: 60, borderRadius: 6, borderWidth: 1, borderColor: '#DDD' },
  removeImageBtn: { backgroundColor: '#E87A90', borderRadius: 6, paddingVertical: 6, paddingHorizontal: 12 },
  removeImageBtnText: { color: '#FFF', fontSize: 12, fontWeight: 'bold' },
  projectRow: { flexDirection: 'row', gap: 8, width: '100%', marginTop: 8 },
  projectBtn: { flex: 1, backgroundColor: '#FFF', borderWidth: 2, borderColor: '#1A237E', borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  projectBtnText: { fontSize: 14, color: '#1A237E', fontWeight: 'bold' },
  fillAllBtn: { backgroundColor: '#1A237E', borderRadius: 6, paddingVertical: 8, paddingHorizontal: 16, alignItems: 'center', marginTop: 6, width: '100%' },
  fillAllBtnText: { color: '#FFF', fontSize: 13, fontWeight: 'bold' },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 8, width: '100%' },
  resizeBtn: { backgroundColor: '#1A237E', borderRadius: 6, paddingVertical: 8, paddingHorizontal: 16, flex: 1, alignItems: 'center' },
  resizeBtnText: { color: '#FFF', fontSize: 14, fontWeight: 'bold' },
  clearBtn: { backgroundColor: '#E87A90', borderRadius: 6, paddingVertical: 8, paddingHorizontal: 16, flex: 1, alignItems: 'center' },
  clearBtnText: { color: '#FFF', fontSize: 14, fontWeight: 'bold' },
  gridScroll: { maxHeight: 350, borderWidth: 3, borderColor: '#1A237E', borderRadius: 10, backgroundColor: '#FFF' },
  gridScrollV: { maxHeight: 350 },
  grid: { padding: 4 },
  gridRow: { flexDirection: 'row', alignItems: 'center' },
  rowNum: { width: 20, fontSize: 8, color: '#999', textAlign: 'center' },
  cell: { borderWidth: 0, alignItems: 'center', justifyContent: 'center' },
  stitchCircle: { alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: 'rgba(0,0,0,0.08)' },
  stitchCircleSelected: { borderColor: '#FF6B35', borderWidth: 2.5 },
  cellClickable: { cursor: 'crosshair' },
  zoomRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, width: '100%', justifyContent: 'center' },
  zoomLabel: { fontSize: 13, color: '#666', fontWeight: '600' },
  zoomBtn: { backgroundColor: '#1A237E', borderRadius: 6, width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  zoomBtnText: { color: '#FFF', fontSize: 18, fontWeight: 'bold', lineHeight: 20 },
  zoomValue: { fontSize: 14, color: '#333', fontWeight: 'bold', minWidth: 40, textAlign: 'center' },
  selectionRow: { flexDirection: 'row', gap: 4, marginTop: 8, width: '100%', flexWrap: 'wrap' },
  modeBtn: { backgroundColor: '#FFF', borderWidth: 2, borderColor: '#DDD', borderRadius: 8, paddingVertical: 6, paddingHorizontal: 10, alignItems: 'center' },
  modeBtnActive: { borderColor: '#1A237E', backgroundColor: '#E8EAF6' },
  modeBtnText: { fontSize: 12, color: '#666', fontWeight: '600' },
  modeBtnTextActive: { color: '#1A237E' },
  copyBtn: { backgroundColor: '#4A8B6F', borderRadius: 6, paddingVertical: 6, paddingHorizontal: 12, alignItems: 'center' },
  copyBtnText: { color: '#FFF', fontSize: 12, fontWeight: 'bold' },
  pasteBtn: { backgroundColor: '#1A237E', borderRadius: 6, paddingVertical: 6, paddingHorizontal: 12, alignItems: 'center' },
  pasteBtnText: { color: '#FFF', fontSize: 12, fontWeight: 'bold' },
  exportRow: { flexDirection: 'row', gap: 8, width: '100%', marginTop: 8 },
  exportBtn: { flex: 1, backgroundColor: '#FFF', borderWidth: 2, borderColor: '#1A237E', borderRadius: 8, paddingVertical: 8, alignItems: 'center' },
  exportBtnText: { fontSize: 13, color: '#1A237E', fontWeight: 'bold' },
  palette: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, justifyContent: 'center' },
  colorSwatch: { width: 34, height: 34, borderRadius: 6, borderWidth: 2, borderColor: '#DDD', alignItems: 'center', justifyContent: 'center' },
  colorSwatchSelected: { borderColor: '#1A237E', borderWidth: 3 },
  colorCheck: { fontSize: 16, fontWeight: 'bold' },
  addColorBtn: { width: 34, height: 34, borderRadius: 6, borderWidth: 2, borderColor: '#1A237E', backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center' },
  addColorBtnText: { fontSize: 18, color: '#1A237E', fontWeight: 'bold', lineHeight: 20 },
  providerRow: { flexDirection: 'row', gap: 4, width: '100%', marginTop: 4 },
  providerBtn: { flex: 1, backgroundColor: '#FFF', borderWidth: 2, borderColor: '#DDD', borderRadius: 8, paddingVertical: 6, alignItems: 'center' },
  providerBtnActive: { borderColor: '#1A237E', backgroundColor: '#E8EAF6' },
  providerText: { fontSize: 12, color: '#666', fontWeight: '600' },
  providerTextActive: { color: '#1A237E' },
  aiConvertBtn: { backgroundColor: '#FF6B35', borderRadius: 8, paddingVertical: 10, paddingHorizontal: 20, alignItems: 'center', marginTop: 4, width: '100%' },
  aiConvertBtnText: { color: '#FFF', fontSize: 14, fontWeight: 'bold' },
  generateBtn: { backgroundColor: '#1A237E', borderRadius: 12, paddingVertical: 16, paddingHorizontal: 32, alignItems: 'center', marginTop: 16, width: '100%' },
  btnDisabled: { opacity: 0.6 },
  generateBtnText: { fontSize: 18, color: '#FFF', fontWeight: 'bold' },
});
