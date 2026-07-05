import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import ScrollWrapper from '../components/ScrollWrapper';
import Slider from '@react-native-community/slider';
import { createSweaterPattern, fetchStitchPatterns } from '../services/ApiService';

const SIZES = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL'];
const SLEEVE_STYLES = [
  { key: 'set-in', label: 'Manga Set-in' },
  { key: 'raglan', label: 'Manga Raglan' },
  { key: 'drop-shoulder', label: 'Ombro Caído' },
];
const NECKLINES = [
  { key: 'crew', label: 'Gola Redonda' },
  { key: 'vneck', label: 'Decote em V' },
  { key: 'scoop', label: 'Decote Scoop' },
];
const BACK_OPTIONS = [
  { key: 'plain', label: 'Lisa (Meia)' },
  { key: 'motif', label: 'Motivo (igual à frente)' },
  { key: 'pattern', label: 'Padrão de Pontos' },
];
const SLEEVE_OPTIONS = [
  { key: 'motif', label: 'Motivo (da imagem)' },
  { key: 'pattern', label: 'Padrão de Pontos' },
];

const MOTIF_PLACEMENTS = [
  { key: 'center', label: 'Centrado' },
  { key: 'tile', label: 'Repetido' },
];

export default function EditScreen({ route, navigation }) {
  const { imageUri } = route.params;
  const [colors, setColors] = useState(6);
  const [size, setSize] = useState('M');
  const [gaugeStitches, setGaugeStitches] = useState('22');
  const [gaugeRows, setGaugeRows] = useState('30');
  const [sleeveStyle, setSleeveStyle] = useState('set-in');
  const [neckline, setNeckline] = useState('crew');
  const [motifPlacement, setMotifPlacement] = useState('center');
  const [backOption, setBackOption] = useState('plain');
  const [sleeveOption, setSleeveOption] = useState('motif');
  const [backPattern, setBackPattern] = useState('garter');
  const [sleevePattern, setSleevePattern] = useState('seed');
  const [availablePatterns, setAvailablePatterns] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const data = await fetchStitchPatterns();
        const list = Object.entries(data).map(([key, val]) => ({ key, ...val }));
        setAvailablePatterns(list);
      } catch {}
    })();
  }, []);

  const handleCreate = async () => {
    const gs = parseInt(gaugeStitches, 10);
    const gr = parseInt(gaugeRows, 10);

    if (isNaN(gs) || gs < 10 || gs > 40) {
      Alert.alert('Erro', 'A amostra de pontos deve ser entre 10 e 40 por 10cm.');
      return;
    }
    if (isNaN(gr) || gr < 10 || gr > 50) {
      Alert.alert('Erro', 'A amostra de carreiras deve ser entre 10 e 50 por 10cm.');
      return;
    }

    setLoading(true);
    try {
      const result = await createSweaterPattern(imageUri, {
        colors,
        size,
        gaugeStitches: gs,
        gaugeRows: gr,
        sleeveStyle,
        neckline,
        motifPlacement,
        sleevePattern: sleeveOption === 'pattern' ? sleevePattern : null,
        backPattern: backOption === 'pattern' ? backPattern : backOption,
      });
      navigation.replace('Preview', { result, isSweater: true, isStitchBlanket: false });
    } catch (e) {
      Alert.alert('Erro', e.message || 'Ocorreu um erro ao gerar o padrão.');
    } finally {
      setLoading(false);
    }
  };

  const OptionButton = ({ selected, onPress, label, small }) => (
    <TouchableOpacity
      style={[styles.optionBtn, small && styles.optionBtnSmall, selected && styles.optionBtnSelected]}
      onPress={onPress}
    >
      <Text style={[styles.optionBtnText, small && styles.optionBtnTextSmall, selected && styles.optionBtnTextSelected]}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  const patternPicker = availablePatterns.map((p) => (
    <OptionButton
      key={p.key}
      selected={false}
      onPress={() => {}}
      small
      label={`${p.name}`}
    />
  ));

  const formContent = (
    <View style={styles.container}>
      <Text style={styles.title}>Configurar Sweater</Text>

      {/* COLORS */}
      <View style={styles.sliderGroup}>
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
      </View>

      {/* SIZE */}
      <Text style={styles.label}>Tamanho</Text>
      <View style={styles.optionsRow}>
        {SIZES.map((s) => (
          <OptionButton key={s} selected={size === s} onPress={() => setSize(s)} label={s} />
        ))}
      </View>

      {/* MOTIF PLACEMENT */}
      <Text style={styles.label}>Posição do motivo</Text>
      <View style={styles.optionsRow}>
        {MOTIF_PLACEMENTS.map((m) => (
          <OptionButton key={m.key} selected={motifPlacement === m.key} onPress={() => setMotifPlacement(m.key)} label={m.label} />
        ))}
      </View>

      {/* BACK PANEL */}
      <Text style={styles.label}>Costas</Text>
      <View style={styles.optionsColumn}>
        {BACK_OPTIONS.map((b) => (
          <OptionButton
            key={b.key}
            selected={backOption === b.key}
            onPress={() => setBackOption(b.key)}
            label={b.label}
          />
        ))}
      </View>

      {backOption === 'pattern' && (
        <View style={styles.patternPicker}>
          <Text style={styles.subLabel}>Selecionar padrão para as costas:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator>
            <View style={styles.patternRow}>
              {availablePatterns.map((p) => (
                <TouchableOpacity
                  key={p.key}
                  style={[styles.patternChip, backPattern === p.key && styles.patternChipSelected]}
                  onPress={() => setBackPattern(p.key)}
                >
                  <Text style={[styles.patternChipText, backPattern === p.key && styles.patternChipTextSelected]}>
                    {p.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>
      )}

      {/* SLEEVES */}
      <Text style={styles.label}>Mangas</Text>
      <View style={styles.optionsRow}>
        {SLEEVE_OPTIONS.map((s) => (
          <OptionButton
            key={s.key}
            selected={sleeveOption === s.key}
            onPress={() => setSleeveOption(s.key)}
            label={s.label}
          />
        ))}
      </View>

      {sleeveOption === 'pattern' && (
        <View style={styles.patternPicker}>
          <Text style={styles.subLabel}>Selecionar padrão para as mangas:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator>
            <View style={styles.patternRow}>
              {availablePatterns.map((p) => (
                <TouchableOpacity
                  key={p.key}
                  style={[styles.patternChip, sleevePattern === p.key && styles.patternChipSelected]}
                  onPress={() => setSleevePattern(p.key)}
                >
                  <Text style={[styles.patternChipText, sleevePattern === p.key && styles.patternChipTextSelected]}>
                    {p.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>
      )}

      {/* SLEEVE STYLE */}
      <Text style={styles.label}>Tipo de Manga</Text>
      <View style={styles.optionsColumn}>
        {SLEEVE_STYLES.map((s) => (
          <OptionButton key={s.key} selected={sleeveStyle === s.key} onPress={() => setSleeveStyle(s.key)} label={s.label} />
        ))}
      </View>

      {/* NECKLINE */}
      <Text style={styles.label}>Decote</Text>
      <View style={styles.optionsColumn}>
        {NECKLINES.map((n) => (
          <OptionButton key={n.key} selected={neckline === n.key} onPress={() => setNeckline(n.key)} label={n.label} />
        ))}
      </View>

      {/* GAUGE */}
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
          <Text style={styles.gaugeUnit}>carreiras</Text>
        </View>
      </View>

      <TouchableOpacity
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={handleCreate}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.buttonText}>Gerar Padrão de Sweater</Text>
        )}
      </TouchableOpacity>
    </View>
  );

  return (
    <ScrollWrapper contentContainerStyle={styles.container}>
      {formContent}
    </ScrollWrapper>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: '#F5F0FF', padding: 20 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#6B4F8A', textAlign: 'center', marginBottom: 30 },
  sliderGroup: { marginBottom: 24 },
  label: { fontSize: 16, color: '#333', marginBottom: 10, fontWeight: '600' },
  subLabel: { fontSize: 14, color: '#666', marginBottom: 8 },
  slider: { width: '100%', height: 40 },
  optionsRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  optionsColumn: { flexDirection: 'column', gap: 8, marginBottom: 24 },
  optionBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#D0C0E0',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  optionBtnSmall: { paddingVertical: 8, paddingHorizontal: 12 },
  optionBtnSelected: { backgroundColor: '#6B4F8A', borderColor: '#6B4F8A' },
  optionBtnText: { fontSize: 15, color: '#6B4F8A', fontWeight: '600' },
  optionBtnTextSmall: { fontSize: 13 },
  optionBtnTextSelected: { color: '#FFFFFF' },
  patternPicker: { marginBottom: 24 },
  patternRow: { flexDirection: 'row', gap: 8, paddingVertical: 4 },
  patternChip: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D0C0E0',
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  patternChipSelected: { backgroundColor: '#6B4F8A', borderColor: '#6B4F8A' },
  patternChipText: { fontSize: 13, color: '#6B4F8A' },
  patternChipTextSelected: { color: '#FFFFFF' },
  gaugeRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 30 },
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
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { fontSize: 18, color: '#FFFFFF', fontWeight: 'bold' },
});
