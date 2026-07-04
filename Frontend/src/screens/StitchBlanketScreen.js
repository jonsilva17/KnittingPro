import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
  TextInput,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { createStitchBlanket, fetchStitchPatterns } from '../services/ApiService';

const PATTERN_ORDER = [
  'garter', 'seed', 'moss', 'rib_1x1', 'rib_2x2',
  'check_2x2', 'check_4x4', 'diagonal', 'diagonal_reverse',
  'basketweave', 'broken_rib', 'tiles', 'stockinette',
];

export default function StitchBlanketScreen({ navigation }) {
  const [patterns, setPatterns] = useState([]);
  const [selectedKeys, setSelectedKeys] = useState([]);
  const [chartWidth, setChartWidth] = useState('120');
  const [sectionRows, setSectionRows] = useState(24);
  const [borderRows, setBorderRows] = useState(6);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const data = await fetchStitchPatterns();
        const list = PATTERN_ORDER
          .filter((k) => data[k])
          .map((k) => ({ key: k, ...data[k] }));
        setPatterns(list);
      } catch {
        Alert.alert('Erro', 'Não foi possível carregar os padrões.');
      }
    })();
  }, []);

  const togglePattern = (key) => {
    setSelectedKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const moveUp = (key) => {
    setSelectedKeys((prev) => {
      const idx = prev.indexOf(key);
      if (idx <= 0) return prev;
      const next = [...prev];
      [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
      return next;
    });
  };

  const moveDown = (key) => {
    setSelectedKeys((prev) => {
      const idx = prev.indexOf(key);
      if (idx === -1 || idx >= prev.length - 1) return prev;
      const next = [...prev];
      [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
      return next;
    });
  };

  const handleCreate = async () => {
    if (selectedKeys.length === 0) {
      Alert.alert('Aviso', 'Selecione pelo menos um padrão de pontos.');
      return;
    }

    const w = parseInt(chartWidth, 10);
    if (isNaN(w) || w < 20 || w > 300) {
      Alert.alert('Erro', 'A largura deve ser entre 20 e 300 pontos.');
      return;
    }

    setLoading(true);
    try {
      const result = await createStitchBlanket({
        patterns: selectedKeys,
        chartWidth: w,
        sectionRows,
        borderRows,
      });
      navigation.navigate('Preview', { result, isStitchBlanket: true, isSweater: false });
    } catch (e) {
      Alert.alert('Erro', e.message || 'Ocorreu um erro ao gerar a manta.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Criar Manta de Pontos</Text>
      <Text style={styles.subtitle}>
        Combina vários padrões de meia e liga como as mantas Purl Soho
      </Text>

      <View style={styles.sliderGroup}>
        <Text style={styles.label}>Carreiras por secção: {sectionRows}</Text>
        <Slider
          style={styles.slider}
          minimumValue={8}
          maximumValue={60}
          step={2}
          value={sectionRows}
          onValueChange={setSectionRows}
          minimumTrackTintColor="#6B4F8A"
          maximumTrackTintColor="#CCCCCC"
          thumbTintColor="#6B4F8A"
        />
        <View style={styles.sliderLabels}>
          <Text style={styles.sliderLabelText}>8</Text>
          <Text style={styles.sliderLabelText}>60</Text>
        </View>
      </View>

      <View style={styles.sliderGroup}>
        <Text style={styles.label}>Carreiras de borda: {borderRows}</Text>
        <Slider
          style={styles.slider}
          minimumValue={0}
          maximumValue={20}
          step={2}
          value={borderRows}
          onValueChange={setBorderRows}
          minimumTrackTintColor="#6B4F8A"
          maximumTrackTintColor="#CCCCCC"
          thumbTintColor="#6B4F8A"
        />
        <View style={styles.sliderLabels}>
          <Text style={styles.sliderLabelText}>0</Text>
          <Text style={styles.sliderLabelText}>20</Text>
        </View>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Largura (pontos a montar)</Text>
        <TextInput
          style={styles.textInput}
          keyboardType="number-pad"
          value={chartWidth}
          onChangeText={setChartWidth}
          maxLength={3}
        />
      </View>

      <Text style={styles.label}>Padrões (toque para selecionar)</Text>
      <Text style={styles.hint}>Ordem: toque ✓ e use as setas para reordenar</Text>

      {patterns.map((p) => {
        const isSelected = selectedKeys.includes(p.key);
        const idx = selectedKeys.indexOf(p.key);
        return (
          <TouchableOpacity
            key={p.key}
            style={[styles.patternItem, isSelected && styles.patternItemSelected]}
            onPress={() => togglePattern(p.key)}
          >
            <View style={styles.patternInfo}>
              <Text style={[styles.patternName, isSelected && styles.patternNameSelected]}>
                {isSelected ? `✓ ${p.name}` : `○ ${p.name}`}
              </Text>
              <Text style={[styles.patternDesc, isSelected && styles.patternDescSelected]}>
                {p.description} ({p.repeat_w}×{p.repeat_h})
              </Text>
            </View>
            {isSelected && (
              <View style={styles.patternControls}>
                <TouchableOpacity
                  style={styles.arrowBtn}
                  onPress={() => moveUp(p.key)}
                >
                  <Text style={styles.arrowText}>▲</Text>
                </TouchableOpacity>
                <Text style={styles.orderNum}>{idx + 1}</Text>
                <TouchableOpacity
                  style={styles.arrowBtn}
                  onPress={() => moveDown(p.key)}
                >
                  <Text style={styles.arrowText}>▼</Text>
                </TouchableOpacity>
              </View>
            )}
          </TouchableOpacity>
        );
      })}

      <TouchableOpacity
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={handleCreate}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.buttonText}>
            Gerar Manta ({selectedKeys.length} secções)
          </Text>
        )}
      </TouchableOpacity>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: '#F5F0FF',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#6B4F8A',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    marginBottom: 30,
    paddingHorizontal: 10,
  },
  sliderGroup: {
    marginBottom: 20,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  sliderLabelText: {
    fontSize: 12,
    color: '#999',
  },
  inputGroup: {
    marginBottom: 24,
  },
  textInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D0C0E0',
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 18,
    color: '#333',
    textAlign: 'center',
  },
  label: {
    fontSize: 16,
    color: '#333',
    marginBottom: 8,
    fontWeight: '600',
  },
  hint: {
    fontSize: 12,
    color: '#999',
    marginBottom: 12,
  },
  patternItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D0C0E0',
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 8,
  },
  patternItemSelected: {
    backgroundColor: '#6B4F8A',
    borderColor: '#6B4F8A',
  },
  patternInfo: {
    flex: 1,
  },
  patternName: {
    fontSize: 15,
    color: '#6B4F8A',
    fontWeight: '600',
  },
  patternNameSelected: {
    color: '#FFFFFF',
  },
  patternDesc: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  patternDescSelected: {
    color: '#DDD',
  },
  patternControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  arrowBtn: {
    padding: 4,
  },
  arrowText: {
    fontSize: 16,
    color: '#FFFFFF',
  },
  orderNum: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: 'bold',
    minWidth: 16,
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#6B4F8A',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 20,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    fontSize: 18,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
});
