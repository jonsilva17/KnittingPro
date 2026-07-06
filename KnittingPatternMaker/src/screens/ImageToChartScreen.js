import React, { useState, useCallback } from 'react';
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
import { imageToChartAI, uriToBase64 } from '../services/ApiService';
import PatternPicker from '../components/PatternPicker';
import * as ImagePicker from 'expo-image-picker';

const SIZES = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL'];

export default function ImageToChartScreen({ navigation }) {
  const { t } = useLang();
  const [size, setSize] = useState('M');
  const [patternKey, setPatternKey] = useState(null);
  const [patternName, setPatternName] = useState(null);
  const [imageUri, setImageUri] = useState(null);
  const [imageBase64, setImageBase64] = useState(null);
  const [loading, setLoading] = useState(false);
  const [patternPicker, setPatternPicker] = useState(false);
  const [aiProvider, setAiProvider] = useState('gemini');

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
      base64: true,
    });
    if (!result.canceled && result.assets?.length > 0) {
      const asset = result.assets[0];
      setImageUri(asset.uri);
      if (asset.base64) {
        setImageBase64(asset.base64);
      } else {
        try {
          const b64 = await uriToBase64(asset.uri);
          setImageBase64(b64);
        } catch (e) {
          Alert.alert('Erro', 'Não foi possível ler a imagem: ' + e.message);
        }
      }
    }
  };

  const handleConvert = async () => {
    if (!imageBase64) {
      Alert.alert(t.errorGeneric, t.imageToChartNoImage);
      return;
    }
    setLoading(true);
    try {
      const result = await imageToChartAI({
        image_base64: imageBase64,
        size_key: size,
        pattern_key: patternKey,
        gauge_st: 22,
        gauge_rows: 30,
        provider: aiProvider,
      });

      navigation.navigate('StitchEditor', { initialSections: result.sections });
    } catch (e) {
      Alert.alert(t.imageToChartError, e.message || 'Verifica a chave de API no servidor');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPattern = useCallback((key, p) => {
    setPatternKey(key);
    setPatternName(p.name || key);
    setPatternPicker(false);
  }, []);

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      <Text style={styles.title}>{t.imageToChartTitle}</Text>

      {loading && <ActivityIndicator color="#B565A7" style={{ marginVertical: 10 }} />}

      <Text style={styles.sectionTitle}>{t.imageToChartSize}</Text>
      <View style={styles.sizeRow}>
        {SIZES.map(s => (
          <TouchableOpacity
            key={s}
            style={[styles.sizeBtn, size === s && styles.sizeBtnActive]}
            onPress={() => setSize(s)}
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

      <View style={styles.providerRow}>
        <TouchableOpacity
          style={[styles.providerBtn, aiProvider === 'gemini' && styles.providerBtnActive]}
          onPress={() => setAiProvider('gemini')}
        >
          <Text style={[styles.providerText, aiProvider === 'gemini' && styles.providerTextActive]}>Gemini (grátis)</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.providerBtn, aiProvider === 'openai' && styles.providerBtnActive]}
          onPress={() => setAiProvider('openai')}
        >
          <Text style={[styles.providerText, aiProvider === 'openai' && styles.providerTextActive]}>OpenAI</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={[styles.actionBtn, { backgroundColor: '#B565A7' }]}
        onPress={handleConvert}
        disabled={loading || !imageBase64}
      >
        {loading ? (
          <ActivityIndicator color="#FFF" />
        ) : (
          <Text style={styles.actionBtnText}>
            {'🤖 AI ' + (t.imageToChartAutoFill || 'Converter')}
          </Text>
        )}
      </TouchableOpacity>

      <Text style={styles.editHint}>
        {t.imageToChartEditHint || 'Depois de converter, podes editar o gráfico antes de gerar o PDF'}
      </Text>

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
  aiNote: {
    fontSize: 11,
    color: '#999',
    textAlign: 'center',
    marginBottom: 8,
    paddingHorizontal: 10,
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
  editHint: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    marginTop: 12,
    paddingHorizontal: 20,
  },
  providerRow: {
    flexDirection: 'row',
    backgroundColor: '#E8DEF0',
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 16,
    width: '100%',
  },
  providerBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
  },
  providerBtnActive: {
    backgroundColor: '#6B4F8A',
  },
  providerText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B4F8A',
  },
  providerTextActive: {
    color: '#FFFFFF',
  },
});