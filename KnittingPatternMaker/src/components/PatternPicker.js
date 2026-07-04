import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import { fetchStitchLibrary } from '../services/ApiService';
import { useLang } from '../lang';

function MiniChartPreview({ chart }) {
  if (!chart || chart.length === 0) return null;
  const cell = 6;
  const w = chart[0].length * cell;
  const h = chart.length * cell;
  return (
    <View style={{ width: w, height: h, flexDirection: 'row', flexWrap: 'wrap' }}>
      {chart.map((row, ri) =>
        row.map((val, ci) => (
          <View
            key={`${ri}-${ci}`}
            style={{
              width: cell, height: cell,
              backgroundColor: val === 0 ? '#FFF' : '#6B4F8A',
              borderWidth: 0.3, borderColor: '#CCC',
            }}
          />
        ))
      )}
    </View>
  );
}

export default function PatternPicker({ visible, onClose, onSelect }) {
  const { t } = useLang();
  const [patterns, setPatterns] = useState({});
  const [categories, setCategories] = useState([]);
  const [activeCat, setActiveCat] = useState(null);
  const [expandedCat, setExpandedCat] = useState({});

  useEffect(() => {
    if (!visible) return;
    (async () => {
      try {
        const data = await fetchStitchLibrary();
        setPatterns(data.patterns || {});
        const cats = data.categories || [];
        setCategories(cats);
        if (cats.length > 0 && !activeCat) setActiveCat(cats[0].key);
      } catch (e) {
        Alert.alert(t.errorGeneric, 'Could not load library');
      }
    })();
  }, [visible]);

  const catPatterns = activeCat
    ? Object.entries(patterns).filter(([, p]) => p.category === activeCat)
    : Object.entries(patterns);

  const toggleCat = (key) => {
    setExpandedCat(prev => ({ ...prev, [key]: !prev[key] }));
    setActiveCat(key);
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.container}>
          <Text style={styles.title}>{t.patternLibrary}</Text>

          <ScrollView horizontal style={styles.catRow} showsHorizontalScrollIndicator={false}>
            <TouchableOpacity
              style={[styles.catBtn, !activeCat && styles.catBtnActive]}
              onPress={() => setActiveCat(null)}
            >
              <Text style={[styles.catText, !activeCat && styles.catTextActive]}>{t.all}</Text>
            </TouchableOpacity>
            {categories.map(c => (
              <TouchableOpacity
                key={c.key}
                style={[styles.catBtn, activeCat === c.key && styles.catBtnActive]}
                onPress={() => toggleCat(c.key)}
              >
                <Text style={[styles.catText, activeCat === c.key && styles.catTextActive]}>{c.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
            {catPatterns.map(([key, p]) => (
              <TouchableOpacity
                key={key}
                style={styles.patternRow}
                onPress={() => { onSelect(key, p); onClose(); }}
              >
                <MiniChartPreview chart={p.chart} />
                <View style={styles.patternInfo}>
                  <Text style={styles.patternName} numberOfLines={1} ellipsizeMode="tail">{p.name}</Text>
                  <Text style={styles.patternMeta}>
                    {p.repeat_w}×{p.repeat_h}
                    {p.is_custom ? ' • Custom' : ''}
                    {' • '}{'★'.repeat(p.difficulty || 1)}
                  </Text>
                  <Text style={styles.patternDesc} numberOfLines={2}>{p.description}</Text>
                </View>
              </TouchableOpacity>
            ))}
            {catPatterns.length === 0 && (
              <Text style={styles.empty}>No patterns</Text>
            )}
          </ScrollView>

          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeBtnText}>{t.close}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  container: { backgroundColor: '#FFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 16, maxHeight: '85%' },
  title: { fontSize: 18, fontWeight: 'bold', color: '#6B4F8A', marginBottom: 10 },
  catRow: { marginBottom: 10 },
  catBtn: { backgroundColor: '#F0EBF8', borderRadius: 16, paddingVertical: 6, paddingHorizontal: 14, marginRight: 6 },
  catBtnActive: { backgroundColor: '#6B4F8A' },
  catText: { fontSize: 13, color: '#6B4F8A', fontWeight: '600' },
  catTextActive: { color: '#FFF' },
  list: { maxHeight: 400, flex: 1 },
  patternRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F0EBF8' },
  patternInfo: { marginLeft: 10, flex: 1 },
  patternName: { fontSize: 14, fontWeight: 'bold', color: '#333', flexShrink: 1 },
  patternMeta: { fontSize: 11, color: '#888', marginTop: 2 },
  patternDesc: { fontSize: 11, color: '#AAA', marginTop: 2 },
  empty: { textAlign: 'center', color: '#AAA', padding: 20 },
  closeBtn: { backgroundColor: '#6B4F8A', borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginTop: 10 },
  closeBtnText: { color: '#FFF', fontSize: 15, fontWeight: 'bold' },
});
