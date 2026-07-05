import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  Platform,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useLang } from '../lang';
import { imageToChart, uriToBase64, createStitchEditorPattern, getPdfUrl } from '../services/ApiService';
import PatternPicker from '../components/PatternPicker';
import * as ImagePicker from 'expo-image-picker';

const SIZES = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL'];

const CELL_SIZE = 6;

export default function ImageToChartScreen({ navigation }) {
  const { t } = useLang();
  const [size, setSize] = useState('M');
  const [patternKey, setPatternKey] = useState(null);
  const [patternName, setPatternName] = useState(null);
  const [imageUri, setImageUri] = useState(null);
  const [imageBase64, setImageBase64] = useState(null);
  const [sections, setSections] = useState(null);
  const [loading, setLoading] = useState(false);
  const [patternPicker, setPatternPicker] = useState(false);
  const [needsPdfConfirm, setNeedsPdfConfirm] = useState(false);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(t.permissionNeeded, t.permissionDesc);
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      maxWidth: 800,
      maxHeight: 800,
    });
    if (!result.canceled && result.assets?.length > 0) {
      setImageUri(result.assets[0].uri);
      try {
        const b64 = await uriToBase64(result.assets[0].uri);
        setImageBase64(b64);
      } catch {}
    }
  };

  const handleAutoFill = async () => {
    if (!imageBase64) {
      Alert.alert(t.errorGeneric, t.imageToChartNoImage);
      return;
    }
    setLoading(true);
    try {
      const result = await imageToChart({
        image_base64: imageBase64,
        size_key: size,
        pattern_key: patternKey,
        gauge_st: 22,
        gauge_rows: 30,
      });
      setSections(result.sections);
      setNeedsPdfConfirm(true);
      const msg = t.imageToChartSuccess.replace('{w}', String(result.width)).replace('{h}', String(result.height));
      Alert.alert('', msg);
    } catch (e) {
      Alert.alert(t.imageToChartError, e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGeneratePdf = async () => {
    if (!sections) {
      handleAutoFill();
      return;
    }
    setLoading(true);
    try {
      const payload = {
        sections,
        garment_type: 'sweater',
        is_circular: false,
        gauge_stitches: 22,
        gauge_rows: 30,
        image_base64: imageBase64 || null,
        project_name: t.imageToChartTitle + ' - ' + size,
        recipe_text: null,
        needle: null,
        lang: 'pt',
      };
      const result = await createStitchEditorPattern(payload);
      navigation.replace('Preview', { result, isStitchEditor: true });
    } catch (e) {
      Alert.alert(t.errorPdf, e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPattern = useCallback((key, p) => {
    setPatternKey(key);
    setPatternName(p.name || key);
    setPatternPicker(false);
  }, []);

  const activeGrid = sections?.[0]?.grid || null;

  const renderMiniChart = () => {
    if (!activeGrid) return null;
    const h = activeGrid.length;
    const w = activeGrid[0]?.length || 0;
    if (w === 0 || h === 0) return null;
    const maxPreview = 100;
    const ratio = Math.min(maxPreview / w, maxPreview / h, 1);
    const cw = Math.max(2, Math.round(CELL_SIZE * ratio));
    const ch = cw;
    return (
      <View style={styles.miniChartContainer}>
        <Text style={styles.miniChartLabel}>{t.imageToChartPreview}</Text>
        <View style={{ width: w * cw, height: h * ch, borderWidth: 1, borderColor: '#ccc' }}>
          {activeGrid.map((row, ri) => (
            <View key={ri} style={{ flexDirection: 'row' }}>
              {row.map((cell, ci) => (
                <View
                  key={ci}
                  style={{
                    width: cw,
                    height: ch,
                    backgroundColor: cell === 'm' ? '#FFFFFF' : '#333333',
                    borderWidth: 0.3,
                    borderColor: '#ddd',
                  }}
                />
              ))}
            </View>
          ))}
        </View>
        <Text style={styles.miniChartDims}>{w}×{h} pts</Text>
      </View>
    );
  };

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      <Text style={styles.title}>{t.imageToChartTitle}</Text>

      <Text style={styles.sectionTitle}>{t.imageToChartSize}</Text>
      <View style={styles.sizeRow}>
        {SIZES.map(s => (
          <TouchableOpacity
            key={s}
            style={[styles.sizeBtn, size === s && styles.sizeBtnActive]}
            onPress={() => { setSize(s); setSections(null); setNeedsPdfConfirm(false); }}
          >
            <Text style={[styles.sizeBtnText, size === s && styles.sizeBtnTextActive]}>{s}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.sectionTitle}>{t.imageToChartPattern}</Text>
      <TouchableOpacity style={styles.patternRow} onPress={() => setPatternPicker(true)}>
        <Text style={styles.patternText}>
          {patternName || t.imageToChartSelectPattern}
        </Text>
        {patternKey && (
          <TouchableOpacity onPress={() => { setPatternKey(null); setPatternName(null); }}>
            <Text style={styles.clearBtn}>✕</Text>
          </TouchableOpacity>
        )}
      </TouchableOpacity>

      <Text style={styles.sectionTitle}>{t.imageToChartImage}</Text>
      <TouchableOpacity style={styles.imageBtn} onPress={pickImage}>
        {imageUri ? (
          <View style={styles.imagePreviewBox}>
            <Image source={{ uri: imageUri }} style={styles.imagePreview} />
            <Text style={styles.imageSelectedText}>{t.imageToChartImageSelected}</Text>
          </View>
        ) : (
          <Text style={styles.imageBtnText}>{t.imageToChartPickImage}</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.actionBtn, { backgroundColor: '#4A8B6F' }]}
        onPress={handleAutoFill}
        disabled={loading || !imageBase64}
      >
        {loading ? (
          <ActivityIndicator color="#FFF" />
        ) : (
          <Text style={styles.actionBtnText}>{t.imageToChartAutoFill}</Text>
        )}
      </TouchableOpacity>

      {renderMiniChart()}

      <TouchableOpacity
        style={[styles.actionBtn, { backgroundColor: '#1A237E', marginTop: 8 }]}
        onPress={handleGeneratePdf}
        disabled={loading}
      >
        <Text style={styles.actionBtnText}>{t.imageToChartPdf}</Text>
      </TouchableOpacity>

      <View style={{ height: 40 }} />

      <PatternPicker
        visible={patternPicker}
        onClose={() => setPatternPicker(false)}
        onSelect={handleSelectPattern}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: '#F5F0FF',
  },
  container: {
    padding: 20,
    alignItems: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#6B4F8A',
    marginBottom: 20,
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B4F8A',
    alignSelf: 'flex-start',
    marginTop: 16,
    marginBottom: 8,
  },
  sizeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 6,
  },
  sizeBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#E8DEF0',
    margin: 2,
  },
  sizeBtnActive: {
    backgroundColor: '#6B4F8A',
  },
  sizeBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B4F8A',
  },
  sizeBtnTextActive: {
    color: '#FFFFFF',
  },
  patternRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    width: '100%',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  patternText: {
    flex: 1,
    fontSize: 15,
    color: '#333',
  },
  clearBtn: {
    fontSize: 18,
    color: '#999',
    paddingLeft: 12,
  },
  imageBtn: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 12,
    width: '100%',
    alignItems: 'center',
  },
  imageBtnText: {
    fontSize: 15,
    color: '#6B4F8A',
  },
  imagePreviewBox: {
    alignItems: 'center',
  },
  imagePreview: {
    width: 120,
    height: 120,
    borderRadius: 8,
    resizeMode: 'cover',
  },
  imageSelectedText: {
    fontSize: 12,
    color: '#4A8B6F',
    marginTop: 4,
  },
  actionBtn: {
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 32,
    alignItems: 'center',
    width: '100%',
    marginTop: 20,
  },
  actionBtnText: {
    fontSize: 18,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  miniChartContainer: {
    marginTop: 16,
    alignItems: 'center',
    width: '100%',
  },
  miniChartLabel: {
    fontSize: 12,
    color: '#888',
    marginBottom: 6,
  },
  miniChartDims: {
    fontSize: 11,
    color: '#aaa',
    marginTop: 4,
  },
});