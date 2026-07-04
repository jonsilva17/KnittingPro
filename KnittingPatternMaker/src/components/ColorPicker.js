import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  Modal,
  StyleSheet,
  Alert,
} from 'react-native';

const QUICK_COLORS = [
  '#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF',
  '#FF8800', '#88FF00', '#0088FF', '#FF0088', '#8800FF', '#00FF88',
  '#800000', '#008000', '#000080', '#808000', '#800080', '#008080',
  '#C0C0C0', '#808080', '#A52A2A', '#D2691E', '#FFD700', '#F0E68C',
];

export default function ColorPicker({ visible, onClose, onAdd }) {
  const [hex, setHex] = useState('#FF0000');

  const isValid = (h) => /^#[0-9A-Fa-f]{6}$/.test(h);

  const handleAdd = () => {
    if (!isValid(hex)) { Alert.alert('Cor inválida. Usa formato #RRGGBB'); return; }
    onAdd(hex.toUpperCase());
    setHex('#FF0000');
  };

  const quickAdd = (c) => {
    onAdd(c);
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <Text style={styles.title}>Adicionar Cor</Text>

          <View style={styles.previewRow}>
            <View style={[styles.preview, { backgroundColor: isValid(hex) ? hex : '#FFF' }]} />
            <TextInput
              style={[styles.input, { borderColor: isValid(hex) ? '#4A8B6F' : '#CCC' }]}
              value={hex}
              onChangeText={setHex}
              placeholder="#RRGGBB"
              placeholderTextColor="#BBB"
              maxLength={7}
              autoCapitalize="characters"
            />
          </View>

          <Text style={styles.subtitle}>Cores rápidas</Text>
          <View style={styles.quickGrid}>
            {QUICK_COLORS.map(c => (
              <TouchableOpacity
                key={c}
                style={[styles.quickSwatch, { backgroundColor: c }]}
                onPress={() => quickAdd(c)}
              />
            ))}
          </View>

          <View style={styles.btnRow}>
            <TouchableOpacity style={styles.addBtn} onPress={handleAdd}>
              <Text style={styles.addBtnText}>Adicionar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelBtnText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modal: { backgroundColor: '#FFF', borderRadius: 16, padding: 16 },
  title: { fontSize: 18, fontWeight: 'bold', color: '#1A237E', marginBottom: 12, textAlign: 'center' },
  previewRow: { flexDirection: 'row', gap: 10, alignItems: 'center', marginBottom: 12 },
  preview: { width: 48, height: 48, borderRadius: 8, borderWidth: 1, borderColor: '#DDD' },
  input: { flex: 1, borderWidth: 2, borderRadius: 8, padding: 10, fontSize: 16, textAlign: 'center', fontWeight: 'bold', backgroundColor: '#F9F9F9' },
  subtitle: { fontSize: 13, fontWeight: '600', color: '#666', marginBottom: 6 },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: 16 },
  quickSwatch: { width: 32, height: 32, borderRadius: 6, borderWidth: 1, borderColor: '#DDD' },
  btnRow: { flexDirection: 'row', gap: 8 },
  addBtn: { flex: 1, backgroundColor: '#4A8B6F', borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
  addBtnText: { color: '#FFF', fontWeight: 'bold', fontSize: 15 },
  cancelBtn: { flex: 1, backgroundColor: '#EEE', borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
  cancelBtnText: { color: '#666', fontWeight: 'bold', fontSize: 15 },
});
