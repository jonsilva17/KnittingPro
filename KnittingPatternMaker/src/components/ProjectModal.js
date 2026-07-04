import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  Modal,
  StyleSheet,
  Alert,
  FlatList,
} from 'react-native';
import { listProjects, saveProject, loadProject, deleteProject, renameProject } from '../services/StorageService';

export default function ProjectModal({ visible, onClose, onLoad, projectType }) {
  const [projects, setProjects] = useState([]);
  const [name, setName] = useState('');
  const [renameMode, setRenameMode] = useState(null);
  const [renameVal, setRenameVal] = useState('');

  const refresh = async () => {
    const list = await listProjects();
    setProjects(list.filter(p => p.name.startsWith(projectType + ':')));
  };

  useEffect(() => { if (visible) refresh(); }, [visible]);

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) { Alert.alert('Dá um nome ao projeto'); return; }
    const fullName = projectType + ':' + trimmed;
    const data = onLoad('__save__');
    await saveProject(fullName, data);
    setName('');
    refresh();
    Alert.alert('Guardado ✓');
  };

  const handleLoad = async (p) => {
    const data = await loadProject(p.name);
    if (data) { onLoad(data); onClose(); }
  };

  const handleDelete = (p) => {
    Alert.alert('Apagar', `Apagar "${p.name.replace(projectType + ':', '')}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Apagar', style: 'destructive', onPress: async () => {
        await deleteProject(p.name);
        refresh();
      }},
    ]);
  };

  const handleRename = async (oldName) => {
    const trimmed = renameVal.trim();
    if (!trimmed) return;
    await renameProject(oldName, projectType + ':' + trimmed);
    setRenameMode(null);
    refresh();
  };

  const formatDate = (iso) => {
    try { return new Date(iso).toLocaleString('pt-PT'); } catch { return iso; }
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <Text style={styles.title}>Projetos</Text>

          <View style={styles.saveRow}>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Nome do projeto"
              placeholderTextColor="#BBB"
            />
            <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
              <Text style={styles.saveBtnText}>Guardar</Text>
            </TouchableOpacity>
          </View>

          {projects.length === 0 ? (
            <Text style={styles.emptyText}>Nenhum projeto guardado</Text>
          ) : (
            <FlatList
              data={projects}
              keyExtractor={item => item.name}
              style={styles.list}
              renderItem={({ item }) => (
                <View style={styles.projectRow}>
                  {renameMode === item.name ? (
                    <View style={styles.renameRow}>
                      <TextInput
                        style={[styles.input, { flex: 1 }]}
                        value={renameVal}
                        onChangeText={setRenameVal}
                        autoFocus
                      />
                      <TouchableOpacity style={styles.renameBtn} onPress={() => handleRename(item.name)}>
                        <Text style={styles.renameBtnText}>OK</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.cancelBtn} onPress={() => setRenameMode(null)}>
                        <Text style={styles.cancelBtnText}>X</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <>
                      <TouchableOpacity style={styles.projectInfo} onPress={() => handleLoad(item)}>
                        <Text style={styles.projectName}>{item.name.replace(projectType + ':', '')}</Text>
                        <Text style={styles.projectDate}>{formatDate(item.date)}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.actionBtn} onPress={() => { setRenameMode(item.name); setRenameVal(item.name.replace(projectType + ':', '')); }}>
                        <Text style={styles.actionBtnText}>✏️</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.actionBtn} onPress={() => handleDelete(item)}>
                        <Text style={styles.actionBtnText}>🗑️</Text>
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              )}
            />
          )}

          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeBtnText}>Fechar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modal: { backgroundColor: '#FFF', borderRadius: 16, padding: 16, maxHeight: '80%' },
  title: { fontSize: 20, fontWeight: 'bold', color: '#1A237E', marginBottom: 12, textAlign: 'center' },
  saveRow: { flexDirection: 'row', gap: 6, marginBottom: 12 },
  input: { flex: 1, borderWidth: 1, borderColor: '#CCC', borderRadius: 8, padding: 8, fontSize: 14, backgroundColor: '#F9F9F9' },
  saveBtn: { backgroundColor: '#1A237E', borderRadius: 8, paddingHorizontal: 16, justifyContent: 'center' },
  saveBtnText: { color: '#FFF', fontWeight: 'bold' },
  emptyText: { textAlign: 'center', color: '#999', padding: 20 },
  list: { maxHeight: 300 },
  projectRow: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#F0F0F0', paddingVertical: 8 },
  projectInfo: { flex: 1 },
  projectName: { fontSize: 15, fontWeight: '600', color: '#333' },
  projectDate: { fontSize: 11, color: '#999', marginTop: 1 },
  actionBtn: { padding: 6, marginLeft: 4 },
  actionBtnText: { fontSize: 16 },
  renameRow: { flex: 1, flexDirection: 'row', gap: 4 },
  renameBtn: { backgroundColor: '#4A8B6F', borderRadius: 6, paddingHorizontal: 12, justifyContent: 'center' },
  renameBtnText: { color: '#FFF', fontWeight: 'bold' },
  cancelBtn: { backgroundColor: '#E87A90', borderRadius: 6, paddingHorizontal: 12, justifyContent: 'center' },
  cancelBtnText: { color: '#FFF', fontWeight: 'bold' },
  closeBtn: { backgroundColor: '#EEE', borderRadius: 8, paddingVertical: 10, alignItems: 'center', marginTop: 12 },
  closeBtnText: { color: '#666', fontWeight: 'bold' },
});
