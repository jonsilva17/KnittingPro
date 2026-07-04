import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  Image,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import ScrollWrapper from '../components/ScrollWrapper';
import * as ImagePicker from 'expo-image-picker';
import Slider from '@react-native-community/slider';
import { createToyPattern } from '../services/ApiService';

const SIZES = [
  { key: 'P', label: 'P (20x25cm)' },
  { key: 'M', label: 'M (30x40cm)' },
  { key: 'G', label: 'G (40x50cm)' },
];

const TOY_TYPES = [
  { key: 'plush', label: 'Brinquedo 3D' },
  { key: 'cushion', label: 'Almofada' },
];

export default function ToyScreen({ navigation }) {
  const [image, setImage] = useState(null);
  const [imageUri, setImageUri] = useState(null);
  const [colors, setColors] = useState(6);
  const [size, setSize] = useState('M');
  const [toyType, setToyType] = useState('plush');
  const [toyName, setToyName] = useState('');
  const [gaugeStitches, setGaugeStitches] = useState('22');
  const [gaugeRows, setGaugeRows] = useState('30');
  const [loading, setLoading] = useState(false);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permissão necessária', 'Precisamos de acesso à galeria.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      maxWidth: 1024,
      maxHeight: 1024,
    });
    if (!result.canceled && result.assets?.length > 0) {
      setImage(result.assets[0].uri);
      setImageUri(result.assets[0].uri);
    }
  };

  const handleGenerate = async () => {
    if (!imageUri) {
      Alert.alert('Erro', 'Selecione uma imagem primeiro.');
      return;
    }
    const gs = parseInt(gaugeStitches, 10);
    const gr = parseInt(gaugeRows, 10);
    if (isNaN(gs) || gs < 10 || gs > 40) {
      Alert.alert('Erro', 'A amostra de pontos deve ser entre 10 e 40.');
      return;
    }
    if (isNaN(gr) || gr < 10 || gr > 50) {
      Alert.alert('Erro', 'A amostra de carreiras deve ser entre 10 e 50.');
      return;
    }

    setLoading(true);
    try {
      const result = await createToyPattern(imageUri, {
        colors,
        size,
        toyName: toyName || 'Brinquedo',
        toyType,
        gaugeStitches: gs,
        gaugeRows: gr,
      });
      navigation.replace('Preview', { result, isSweater: false, isStitchBlanket: false, isToy: true });
    } catch (e) {
      Alert.alert('Erro', e.message || 'Ocorreu um erro ao gerar o padrão.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollWrapper style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>🧸 Criar Brinquedo / Plush</Text>
      <Text style={styles.subtitle}>
        Transforme uma imagem num brinquedo de tricô
      </Text>

      {!image ? (
        <TouchableOpacity style={styles.imagePicker} onPress={pickImage}>
          <Text style={styles.imagePickerText}>📷 Selecionar Imagem</Text>
          <Text style={styles.imagePickerHint}>A imagem será convertida em gráfico de tricô</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.imagePreview}>
          <Image source={{ uri: image }} style={styles.image} resizeMode="cover" />
          <TouchableOpacity onPress={pickImage}>
            <Text style={styles.changeImageText}>Alterar imagem</Text>
          </TouchableOpacity>
        </View>
      )}

      <Text style={styles.label}>Nome do Brinquedo</Text>
      <TextInput
        style={styles.nameInput}
        value={toyName}
        onChangeText={setToyName}
        placeholder="Ex: Ursinho, Gato, Boneco..."
        placeholderTextColor="#AAA"
      />

      <Text style={styles.label}>Cores do padrão: {colors}</Text>
      <Slider
        style={styles.slider}
        minimumValue={2}
        maximumValue={12}
        step={1}
        value={colors}
        onValueChange={setColors}
        minimumTrackTintColor="#6B4F8A"
        maximumTrackTintColor="#CCCCCC"
        thumbTintColor="#6B4F8A"
      />

      <Text style={styles.label}>Tamanho</Text>
      <View style={styles.optionsRow}>
        {SIZES.map((s) => (
          <TouchableOpacity
            key={s.key}
            style={[styles.optionBtn, size === s.key && styles.optionBtnSelected]}
            onPress={() => setSize(s.key)}
          >
            <Text style={[styles.optionBtnText, size === s.key && styles.optionBtnTextSelected]}>
              {s.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Tipo</Text>
      <View style={styles.optionsRow}>
        {TOY_TYPES.map((t) => (
          <TouchableOpacity
            key={t.key}
            style={[styles.optionBtn, toyType === t.key && styles.optionBtnSelected]}
            onPress={() => setToyType(t.key)}
          >
            <Text style={[styles.optionBtnText, toyType === t.key && styles.optionBtnTextSelected]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Amostra (pts e carreiras por 10cm)</Text>
      <View style={styles.gaugeRow}>
        <View style={styles.gaugeInputGroup}>
          <TextInput
            style={styles.gaugeInput}
            keyboardType="number-pad"
            value={gaugeStitches}
            onChangeText={setGaugeStitches}
            maxLength={2}
          />
          <Text style={styles.gaugeUnit}>pts</Text>
        </View>
        <Text style={styles.gaugeX}>x</Text>
        <View style={styles.gaugeInputGroup}>
          <TextInput
            style={styles.gaugeInput}
            keyboardType="number-pad"
            value={gaugeRows}
            onChangeText={setGaugeRows}
            maxLength={2}
          />
          <Text style={styles.gaugeUnit}>carr</Text>
        </View>
      </View>

      <TouchableOpacity
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={handleGenerate}
        disabled={loading || !image}
      >
        {loading ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.buttonText}>🧶 Gerar Padrão de Brinquedo</Text>
        )}
      </TouchableOpacity>

      <View style={styles.infoBox}>
        <Text style={styles.infoTitle}>Como funciona</Text>
        <Text style={styles.infoText}>
          1. Selecione uma imagem do animal/desenho que deseja{'\n'}
          2. Escolha o tamanho e número de cores{'\n'}
          3. Gere o padrão com gráfico e instruções{'\n'}
          4. Tricote 2 painéis (frente + costas), cosa e encha!
        </Text>
      </View>
    </ScrollWrapper>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: '#F5F0FF', padding: 20 },
  content: { alignItems: 'center' },
  title: { fontSize: 24, fontWeight: 'bold', color: '#6B4F8A', textAlign: 'center', marginBottom: 6, marginTop: 10 },
  subtitle: { fontSize: 14, color: '#888', textAlign: 'center', marginBottom: 24, paddingHorizontal: 20 },
  imagePicker: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#D0C0E0',
    borderStyle: 'dashed',
    borderRadius: 14,
    padding: 40,
    alignItems: 'center',
    width: '100%',
    marginBottom: 20,
  },
  imagePickerText: { fontSize: 18, color: '#6B4F8A', fontWeight: '600' },
  imagePickerHint: { fontSize: 12, color: '#999', marginTop: 6 },
  imagePreview: { alignItems: 'center', marginBottom: 20, width: '100%' },
  image: { width: 200, height: 200, borderRadius: 12, marginBottom: 8 },
  changeImageText: { fontSize: 13, color: '#6B4F8A', fontWeight: '600' },
  label: { fontSize: 16, color: '#333', marginBottom: 10, fontWeight: '600', alignSelf: 'flex-start', marginTop: 10 },
  nameInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D0C0E0',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#333',
    width: '100%',
    marginBottom: 10,
  },
  slider: { width: '100%', height: 40, marginBottom: 10 },
  optionsRow: { flexDirection: 'row', gap: 10, marginBottom: 10, width: '100%', flexWrap: 'wrap' },
  optionBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#D0C0E0',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
    flex: 1,
    minWidth: 80,
  },
  optionBtnSelected: { backgroundColor: '#6B4F8A', borderColor: '#6B4F8A' },
  optionBtnText: { fontSize: 13, color: '#6B4F8A', fontWeight: '600' },
  optionBtnTextSelected: { color: '#FFFFFF' },
  gaugeRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 20, width: '100%' },
  gaugeInputGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D0C0E0',
    paddingHorizontal: 12,
    flex: 1,
  },
  gaugeInput: { fontSize: 18, color: '#333', paddingVertical: 10, flex: 1, textAlign: 'center' },
  gaugeUnit: { fontSize: 14, color: '#888', marginLeft: 4 },
  gaugeX: { fontSize: 18, color: '#999', fontWeight: 'bold' },
  button: {
    backgroundColor: '#6B4F8A',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 10,
    width: '100%',
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { fontSize: 18, color: '#FFFFFF', fontWeight: 'bold' },
  infoBox: {
    backgroundColor: '#E8DEF0',
    borderRadius: 12,
    padding: 16,
    width: '100%',
    marginTop: 20,
    marginBottom: 30,
  },
  infoTitle: { fontSize: 16, fontWeight: 'bold', color: '#6B4F8A', marginBottom: 8 },
  infoText: { fontSize: 13, color: '#555', lineHeight: 20 },
});
