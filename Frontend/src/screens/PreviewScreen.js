import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { getPdfUrl } from '../services/ApiService';

const CELL_SIZE = 12;
const SCREEN_WIDTH = Dimensions.get('window').width;

function ChartGrid({ chart, colors, cellSize }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator>
      <View style={styles.chartContainer}>
        {(chart || []).map((row, yi) => (
          <View key={yi} style={styles.row}>
            {(row || []).map((colorIdx, xi) => {
              const color = (colors || []).find((c) => c.index === colorIdx);
              return (
                <View
                  key={xi}
                  style={[
                    styles.cell,
                    { backgroundColor: color?.hex || '#FFFFFF' },
                  ]}
                />
              );
            })}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

function ColorKey({ colors }) {
  if (!colors || colors.length === 0) return null;
  return (
    <>
      <Text style={styles.sectionTitle}>Cores Utilizadas</Text>
      <View style={styles.colorRow}>
        {colors.map((c) => (
          <View key={c.index} style={styles.colorItem}>
            <View style={[styles.colorSwatch, { backgroundColor: c.hex }]} />
            <Text style={styles.colorName}>{c.name}</Text>
          </View>
        ))}
      </View>
    </>
  );
}

function StitchChartGrid({ chart }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator>
      <View style={styles.chartContainer}>
        {(chart || []).map((row, yi) => (
          <View key={yi} style={styles.row}>
            {(row || []).map((val, xi) => (
              <View
                key={xi}
                style={[
                  styles.stitchCell,
                  { backgroundColor: '#FFFFFF' },
                ]}
              >
                <Text style={styles.stitchSymbol}>
                  {val === 1 ? '–' : '|'}
                </Text>
              </View>
            ))}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

function StitchSectionItem({ section, index }) {
  if (!section) return null;
  return (
    <View style={styles.sectionCard}>
      <Text style={styles.sectionCardTitle}>
        Secção {String.fromCharCode(65 + index)}: {section.name}
      </Text>
      <Text style={styles.sectionCardInfo}>
        {section.width} pts × {section.height} carreiras
      </Text>
      <Text style={styles.sectionCardInfo}>
        Repetição de {section.repeat_w} × {section.repeat_h}
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator>
        <View style={styles.miniChart}>
          {(section.chart || []).slice(0, 8).map((row, ri) => (
            <View key={ri} style={styles.row}>
              {(row || []).slice(0, 16).map((val, ci) => (
                <View
                  key={ci}
                  style={[styles.miniCell, { backgroundColor: '#FFFFFF' }]}
                >
                  <Text style={styles.miniSymbol}>
                    {val === 1 ? '–' : '|'}
                  </Text>
                </View>
              ))}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

export default function PreviewScreen({ route }) {
  const { result, isSweater, isStitchBlanket } = route.params;
  const [downloading, setDownloading] = useState(false);
  const [activeTab, setActiveTab] = useState('front');

  const handleDownloadPdf = async (customName) => {
    if (!(await Sharing.isAvailableAsync())) {
      Alert.alert('Indisponível', 'A partilha de ficheiros não está disponível neste dispositivo.');
      return;
    }

    setDownloading(true);
    try {
      const url = getPdfUrl(result?.pdf_url);
      const localUri = FileSystem.cacheDirectory + (customName || 'padrao_sweater.pdf');

      const download = await FileSystem.downloadAsync(url, localUri);
      await Sharing.shareAsync(download.uri, {
        mimeType: 'application/pdf',
        dialogTitle: 'Guardar Padrão de Sweater',
      });
    } catch (e) {
      Alert.alert('Erro', 'Não foi possível transferir o PDF.');
    } finally {
      setDownloading(false);
    }
  };

  // BLOCO DA MANTA DE PONTOS CORRIGIDO E PROTEGIDO CONTRA ERROS DE VARIÁVEIS AUSENTES
  if (isStitchBlanket) {
    const fileName = 'manta_pontos.pdf';
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.title}>Manta de Pontos</Text>
        <Text style={styles.dimensions}>
          {result?.patterns_used?.length || 0} secções · {result?.total_width || 0} pts × {result?.total_height || 0} carreiras
        </Text>

        <Text style={styles.sectionTitle}>Gráfico Completo</Text>
        <Text style={styles.legendText}>| = meia &nbsp;&nbsp; – = liga</Text>
        {result?.full_chart ? (
          <StitchChartGrid chart={result.full_chart} />
        ) : (
          <Text style={styles.shapingText}>Nenhum gráfico disponível</Text>
        )}

        <Text style={styles.sectionTitle}>Secções</Text>
        {result?.sections?.map((sec, i) => (
          <StitchSectionItem key={i} section={sec} index={i} />
        ))}

        <Text style={styles.sectionTitle}>Padrões Utilizados</Text>
        <View style={styles.patternList}>
          {result?.patterns_used?.map((p, i) => (
            <Text key={p.key} style={styles.patternListItem}>
              {i + 1}. {p.name}
            </Text>
          ))}
        </View>

        <TouchableOpacity
          style={[styles.downloadButton, downloading && styles.buttonDisabled]}
          onPress={() => handleDownloadPdf(fileName)}
          disabled={downloading}
        >
          {downloading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.downloadButtonText}>📥 Transferir PDF</Text>
          )}
        </TouchableOpacity>
        <View style={{ height: 40 }} />
      </ScrollView>
    );
  }

  if (!isSweater) {
    const { chart, colors, width, height, materials, pdf_url } = result || {};
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.title}>Padrão Gerado</Text>
        <Text style={styles.dimensions}>{width} × {height} pontos</Text>
        <ChartGrid chart={chart} colors={colors} cellSize={14} />
        <ColorKey colors={colors} />
        {materials && (
          <>
            <Text style={styles.sectionTitle}>Materiais</Text>
            <View style={styles.materialsBox}>
              <MaterialRow label="Cores de lã" value={materials.yarn_colors} />
              <MaterialRow label="Lã estimada" value={`~${materials.estimated_yarn_grams}g`} />
              <MaterialRow label="Agulhas" value={materials.needle_size} />
              <MaterialRow label="Amostra" value={materials.gauge} />
              <MaterialRow label="Tamanho final" value={materials.finished_size_cm} />
              {materials.yarn_types && (
                <MaterialRow label="Tipo de lã" value={materials.yarn_types.join(', ')} />
              )}
              {materials.tools && (
                <MaterialRow label="Ferramentas" value={materials.tools.join(', ')} />
              )}
            </View>
          </>
        )}
        <TouchableOpacity
          style={[styles.downloadButton, downloading && styles.buttonDisabled]}
          onPress={handleDownloadPdf}
          disabled={downloading}
        >
          {downloading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.downloadButtonText}>📥 Transferir PDF</Text>
          )}
        </TouchableOpacity>
        <View style={{ height: 40 }} />
      </ScrollView>
    );
  }

  const isFront = activeTab === 'front';
  const isBack = activeTab === 'back';
  const isSleeve = activeTab === 'sleeve';

  const panel = isFront
    ? result?.front
    : isBack
    ? result?.back
    : result?.sleeve;

  const gauge = result?.gauge || {};
  const mat = result?.materials || {};
  const baseColors = result?.base_colors || [];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Padrão de Sweater</Text>
      <Text style={styles.dimensions}>Tamanho {result?.size}</Text>

      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tab, isFront && styles.tabActive]}
          onPress={() => setActiveTab('front')}
        >
          <Text style={[styles.tabText, isFront && styles.tabTextActive]}>Frente</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, isBack && styles.tabActive]}
          onPress={() => setActiveTab('back')}
        >
          <Text style={[styles.tabText, isBack && styles.tabTextActive]}>Costas</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, isSleeve && styles.tabActive]}
          onPress={() => setActiveTab('sleeve')}
        >
          <Text style={[styles.tabText, isSleeve && styles.tabTextActive]}>Mangas</Text>
        </TouchableOpacity>
      </View>

      {panel && (
        <>
          {panel.style === 'stitch' ? (
            <StitchChartGrid chart={panel.chart} />
          ) : (
            <ChartGrid chart={panel.chart} colors={baseColors} cellSize={CELL_SIZE} />
          )}

          {panel.pattern_name && (
            <Text style={styles.patternNameLabel}>Padrão: {panel.pattern_name}</Text>
          )}

          {isFront && (
            <View style={styles.infoBox}>
              <Text style={styles.infoTitle}>Painel da Frente</Text>
              <MaterialRow label="Largura" value={`${panel.width_sts} pts`} />
              <MaterialRow label="Altura" value={`${panel.height_rows} carreiras`} />
              <MaterialRow label="Total de pontos" value={panel.stitch_count} />
              <Text style={styles.shapingTitle}>Modelagem:</Text>
              {(panel.shaping?.instructions || []).map((inst, i) => (
                <Text key={i} style={styles.shapingText}>• {inst}</Text>
              ))}
            </View>
          )}

          {isBack && (
            <View style={styles.infoBox}>
              <Text style={styles.infoTitle}>Painel das Costas</Text>
              <MaterialRow label="Largura" value={`${panel.width_sts} pts`} />
              <MaterialRow label="Altura" value={`${panel.height_rows} carreiras`} />
              <MaterialRow label="Total de pontos" value={panel.stitch_count} />
              {panel.pattern_name && (
                <MaterialRow label="Padrão" value={panel.pattern_name} />
              )}
              <Text style={styles.shapingTitle}>Modelagem:</Text>
              {(panel.shaping?.instructions || []).map((inst, i) => (
                <Text key={i} style={styles.shapingText}>• {inst}</Text>
              ))}
            </View>
          )}

          {isSleeve && (
            <View style={styles.infoBox}>
              <Text style={styles.infoTitle}>Mangas (x2)</Text>
              <MaterialRow label="Punho" value={`${panel.cuff_sts} pts`} />
              <MaterialRow label="Parte mais larga" value={`${panel.top_sts} pts`} />
              <MaterialRow label="Comprimento" value={`${panel.height_rows} carreiras`} />
              {panel.pattern_name && (
                <MaterialRow label="Padrão" value={panel.pattern_name} />
              )}
              {panel.total_increases > 0 && (
                <MaterialRow label="Aumentos" value={`${panel.total_increases} de cada lado a cada ${panel.increases_every} carreiras`} />
              )}
              <Text style={styles.shapingText}>{panel.shaping_notes}</Text>
            </View>
          )}

          {panel.style !== 'stitch' && <ColorKey colors={baseColors} />}
        </>
      )}

      <Text style={styles.sectionTitle}>Materiais</Text>
      <View style={styles.materialsBox}>
        <MaterialRow label="Cores de lã" value={mat.yarn_colors} />
        <MaterialRow label="Lã estimada" value={`~${mat.estimated_yarn_grams}g`} />
        <MaterialRow label="Agulhas" value={mat.needle_size} />
        <MaterialRow label="Amostra" value={mat.gauge} />
        <MaterialRow label="Peito" value={`${mat.finished_chest_cm}cm`} />
        <MaterialRow label="Comprimento" value={`${mat.finished_length_cm}cm`} />
        <MaterialRow label="Manga" value={`${mat.finished_sleeve_cm}cm`} />
      </View>

      <TouchableOpacity
        style={[styles.downloadButton, downloading && styles.buttonDisabled]}
        onPress={handleDownloadPdf}
        disabled={downloading}
      >
        {downloading ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.downloadButtonText}>📥 Transferir PDF Completo</Text>
        )}
      </TouchableOpacity>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

function MaterialRow({ label, value }) {
  return (
    <View style={styles.materialRow}>
      <Text style={styles.materialLabel}>{label}</Text>
      <Text style={styles.materialValue}>{value !== undefined && value !== null ? String(value) : ''}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F0FF' },
  content: { padding: 16, alignItems: 'center' },
  title: { fontSize: 22, fontWeight: 'bold', color: '#6B4F8A', marginBottom: 4 },
  dimensions: { fontSize: 14, color: '#888', marginBottom: 16 },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: '#E8DEF0',
    borderRadius: 10,
    padding: 3,
    marginBottom: 16,
    width: '100%',
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabActive: { backgroundColor: '#6B4F8A' },
  tabText: { fontSize: 14, fontWeight: '600', color: '#6B4F8A' },
  tabTextActive: { color: '#FFFFFF' },
  chartContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 3,
    borderWidth: 1,
    borderColor: '#DDD',
    marginBottom: 16,
  },
  row: { flexDirection: 'row' },
  cell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    borderWidth: 0.3,
    borderColor: '#E0E0E0',
  },
  infoBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    width: '100%',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    marginBottom: 16,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#6B4F8A',
    marginBottom: 10,
  },
  shapingTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 10,
    marginBottom: 4,
  },
  shapingText: {
    fontSize: 13,
    color: '#555',
    marginBottom: 4,
    lineHeight: 18,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#6B4F8A',
    alignSelf: 'flex-start',
    marginBottom: 10,
    marginTop: 10,
  },
  colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  colorItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  colorSwatch: { width: 20, height: 20, borderRadius: 4, marginRight: 6, borderWidth: 0.5, borderColor: '#CCC' },
  colorName: { fontSize: 13, color: '#333' },
  materialsBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    width: '100%',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    marginBottom: 20,
  },
  materialRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: '#EEE',
  },
  materialLabel: { fontSize: 14, color: '#666', flex: 1 },
  materialValue: { fontSize: 14, color: '#333', fontWeight: '600', flex: 1, textAlign: 'right' },
  downloadButton: {
    backgroundColor: '#6B4F8A',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 32,
    alignItems: 'center',
    marginTop: 10,
    width: '100%',
  },
  buttonDisabled: { opacity: 0.6 },
  downloadButtonText: { fontSize: 18, color: '#FFFFFF', fontWeight: 'bold' },
  stitchCell: {
    width: 16,
    height: 16,
    borderWidth: 0.3,
    borderColor: '#E0E0E0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stitchSymbol: {
    fontSize: 12,
    color: '#333',
    lineHeight: 14,
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    width: '100%',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    marginBottom: 12,
  },
  sectionCardTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#6B4F8A',
    marginBottom: 4,
  },
  sectionCardInfo: {
    fontSize: 12,
    color: '#888',
  },
  miniChart: {
    marginTop: 8,
    padding: 2,
    backgroundColor: '#FAFAFA',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#DDD',
  },
  miniCell: {
    width: 14,
    height: 14,
    borderWidth: 0.3,
    borderColor: '#E0E0E0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniSymbol: {
    fontSize: 10,
    color: '#333',
    lineHeight: 12,
  },
  legendText: {
    fontSize: 13,
    color: '#666',
    marginBottom: 8,
    alignSelf: 'flex-start',
  },
  patternNameLabel: {
    fontSize: 14,
    color: '#6B4F8A',
    fontWeight: '600',
    marginBottom: 12,
    alignSelf: 'flex-start',
  },
  patternList: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    width: '100%',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    marginBottom: 16,
  },
  patternListItem: {
    fontSize: 14,
    color: '#333',
    paddingVertical: 4,
  },
});
