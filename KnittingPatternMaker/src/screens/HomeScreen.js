import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  Platform,
  useWindowDimensions,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useLang } from '../lang';
import { fetchPatternGallery } from '../services/ApiService';
import { uriToBase64 } from '../services/ApiService';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000';
const GRID_SIZE = 28;

function BackgroundGrid() {
  const { width, height } = useWindowDimensions();
  const cols = Math.ceil(width / GRID_SIZE) + 1;
  const rows = Math.ceil(height / GRID_SIZE) + 1;
  const squares = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const isBlack = (r + c) % 2 === 0;
      squares.push(
        <View key={`${r}-${c}`} style={{
          position: 'absolute',
          top: r * GRID_SIZE,
          left: c * GRID_SIZE,
          width: GRID_SIZE,
          height: GRID_SIZE,
          backgroundColor: isBlack ? 'rgba(0,0,0,0.04)' : 'transparent',
        }} />
      );
    }
  }
  return <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>{squares}</View>;
}

export default function HomeScreen({ navigation }) {
  const { height: windowHeight } = useWindowDimensions();
  const { lang, setLang, t } = useLang();
  const [galleryPatterns, setGalleryPatterns] = useState([]);
  const [galleryLoading, setGalleryLoading] = useState(false);

  useEffect(() => {
    (async () => {
      setGalleryLoading(true);
      try {
        const data = await fetchPatternGallery();
        setGalleryPatterns(data.patterns || []);
      } catch (e) {
        // silently fail
      } finally {
        setGalleryLoading(false);
      }
    })();
  }, []);

  const openPatternInEditor = async (pattern) => {
    try {
      const url = `${API_URL}${pattern.url}`;
      const b64 = await uriToBase64(url);
      navigation.navigate('ColorworkEditor', { referenceImage: b64, referenceTitle: pattern.title });
    } catch (e) {
      Alert.alert('Erro', 'Não foi possível carregar o padrão');
    }
  };

  const headerHeight = Platform.OS === 'web' ? 100 : 0;
  const contentHeight = windowHeight - headerHeight;

  const content = (
    <View style={styles.container}>
      <BackgroundGrid />

      <View style={styles.langRow}>
        <TouchableOpacity
          style={[styles.langBtn, lang === 'pt' && styles.langBtnActive]}
          onPress={() => setLang('pt')}
        >
          <Text style={[styles.langBtnText, lang === 'pt' && styles.langBtnTextActive]}>PT</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.langBtn, lang === 'en' && styles.langBtnActive]}
          onPress={() => setLang('en')}
        >
          <Text style={[styles.langBtnText, lang === 'en' && styles.langBtnTextActive]}>EN</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.headerSection}>
        <Text style={styles.title}>Pointy Lines</Text>
        <View style={styles.titleUnderline} />
      </View>

      <View style={styles.buttonSection}>
        <TouchableOpacity
          style={styles.primaryButton}
          activeOpacity={0.85}
          onPress={() => navigation.navigate('StitchEditor')}
        >
          <Text style={styles.primaryButtonText}>✏️ {t.stitchEditor}</Text>
          <Text style={styles.primaryButtonDesc}>{t.stitchEditorDesc}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.primaryButton}
          activeOpacity={0.85}
          onPress={() => navigation.navigate('ColorworkEditor')}
        >
          <Text style={styles.primaryButtonText}>🎨 {t.colorworkEditor}</Text>
          <Text style={styles.primaryButtonDesc}>{t.colorworkEditorDesc}</Text>
        </TouchableOpacity>
      </View>

      {galleryPatterns.length > 0 && (
        <>
          <Text style={styles.galleryTitle}>{t.patternGallery || 'Galeria de Padrões'}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.galleryScroll}>
            {galleryPatterns.map((p, i) => (
              <TouchableOpacity key={i} style={styles.galleryCard} onPress={() => openPatternInEditor(p)}>
                <Image source={{ uri: `${API_URL}${p.url}` }} style={styles.galleryImage} />
                <Text style={styles.galleryLabel}>{p.title}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </>
      )}

      <View style={styles.footer}>
        <Text style={styles.footerText}>Pointy Lines © 2026</Text>
      </View>
    </View>
  );

  if (Platform.OS === 'web') {
    return (
      <View style={{ height: contentHeight, overflowY: 'auto', backgroundColor: '#F5F0FF' }}>
        {content}
      </View>
    );
  }

  const NativeScrollView = require('react-native').ScrollView;
  return (
    <NativeScrollView contentContainerStyle={styles.container}>
      {content}
    </NativeScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: '#F5F0EB',
    alignItems: 'center',
    padding: 20,
    position: 'relative',
  },
  langRow: {
    flexDirection: 'row',
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 10,
  },
  langBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 4,
    marginLeft: 4,
    backgroundColor: 'rgba(0,0,0,0.04)',
  },
  langBtnActive: {
    backgroundColor: '#222',
  },
  langBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#555',
  },
  langBtnTextActive: {
    color: '#FFF',
  },
  headerSection: {
    alignItems: 'center',
    marginTop: 50,
    marginBottom: 36,
  },
  title: {
    fontSize: 36,
    fontWeight: '800',
    color: '#1A1A1A',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  titleUnderline: {
    width: 48,
    height: 2,
    backgroundColor: '#1A1A1A',
    marginTop: 10,
    opacity: 0.3,
  },
  buttonSection: {
    width: '100%',
    gap: 12,
  },
  primaryButton: {
    backgroundColor: '#FFF',
    borderRadius: 4,
    paddingVertical: 18,
    paddingHorizontal: 24,
    alignItems: 'center',
    width: '100%',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
    ...Platform.select({
      web: { boxShadow: '0 1px 3px rgba(0,0,0,0.04)' },
    }),
  },
  primaryButtonText: {
    fontSize: 18,
    color: '#1A1A1A',
    fontWeight: '700',
  },
  primaryButtonDesc: {
    fontSize: 12,
    color: '#888',
    marginTop: 3,
  },
  galleryTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A1A1A',
    alignSelf: 'flex-start',
    marginTop: 24,
    marginBottom: 10,
    letterSpacing: 0.3,
  },
  galleryScroll: {
    width: '100%',
    marginBottom: 10,
  },
  galleryCard: {
    backgroundColor: '#FFF',
    borderRadius: 4,
    marginRight: 12,
    width: 160,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  galleryImage: {
    width: 160,
    height: 120,
    resizeMode: 'cover',
  },
  galleryLabel: {
    fontSize: 11,
    color: '#555',
    padding: 8,
    textAlign: 'center',
    fontWeight: '600',
  },
  footer: {
    marginTop: 24,
    paddingBottom: 10,
  },
  footerText: {
    fontSize: 11,
    color: '#bbb',
    letterSpacing: 0.5,
  },
});
