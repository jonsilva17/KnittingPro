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

function DecoCircle({ size, top, left, color, opacity }) {
  return (
    <View style={{
      position: 'absolute', top, left, width: size, height: size,
      borderRadius: size / 2, backgroundColor: color, opacity: opacity || 0.12,
    }} />
  );
}

function WavyLine({ style }) {
  return (
    <View style={[{ width: '100%', height: 8, overflow: 'hidden' }, style]}>
      <View style={{ flexDirection: 'row', height: 8 }}>
        {Array.from({ length: 12 }).map((_, i) => (
          <View key={i} style={{
            width: 16, height: 16, borderRadius: 8,
            backgroundColor: '#2D5A27', opacity: 0.08,
            marginLeft: -4, marginTop: -4,
          }} />
        ))}
      </View>
    </View>
  );
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
      <DecoCircle size={160} top={-40} left={-50} color="#C96B4E" />
      <DecoCircle size={100} top={60} left={-20} color="#2D5A27" />
      <DecoCircle size={80} top={-20} right={-30} color="#D4A84B" />
      <DecoCircle size={200} bottom={-60} right={-60} color="#2D5A27" />

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
        <View style={styles.headerDeco}>
          {['#C96B4E', '#D4A84B', '#2D5A27'].map((c, i) => (
            <View key={i} style={[styles.headerStripe, { backgroundColor: c, opacity: 0.2 + i * 0.1 }]} />
          ))}
        </View>
        <Text style={styles.title}>Pointy Lines</Text>
        <Text style={styles.tagline}>{t.subtitle}</Text>
        <View style={styles.titleUnderline} />
      </View>

      <View style={styles.buttonSection}>
        <TouchableOpacity
          style={styles.primaryButton}
          activeOpacity={0.85}
          onPress={() => navigation.navigate('StitchEditor')}
        >
          <View style={styles.btnIconCircle}>
            <Text style={styles.btnIcon}>✏️</Text>
          </View>
          <View style={styles.btnTextWrap}>
            <Text style={styles.primaryButtonText}>{t.stitchEditor}</Text>
            <Text style={styles.primaryButtonDesc}>{t.stitchEditorDesc}</Text>
          </View>
          <Text style={styles.btnArrow}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.primaryButton}
          activeOpacity={0.85}
          onPress={() => navigation.navigate('ColorworkEditor')}
        >
          <View style={styles.btnIconCircle}>
            <Text style={styles.btnIcon}>🎨</Text>
          </View>
          <View style={styles.btnTextWrap}>
            <Text style={styles.primaryButtonText}>{t.colorworkEditor}</Text>
            <Text style={styles.primaryButtonDesc}>{t.colorworkEditorDesc}</Text>
          </View>
          <Text style={styles.btnArrow}>›</Text>
        </TouchableOpacity>
      </View>

      {galleryPatterns.length > 0 && (
        <>
          <WavyLine style={{ marginTop: 12, marginBottom: 6 }} />
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
    backgroundColor: '#FDF6EE',
    alignItems: 'center',
    padding: 20,
    position: 'relative',
    overflow: 'hidden',
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
    borderRadius: 8,
    marginLeft: 4,
    backgroundColor: '#EDE0D4',
  },
  langBtnActive: {
    backgroundColor: '#2D5A27',
  },
  langBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2D5A27',
  },
  langBtnTextActive: {
    color: '#FFFFFF',
  },
  headerSection: {
    alignItems: 'center',
    marginTop: 40,
    marginBottom: 32,
    width: '100%',
    position: 'relative',
  },
  headerDeco: {
    position: 'absolute',
    top: -10,
    left: 0,
    right: 0,
    height: 80,
    borderRadius: 40,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  headerStripe: {
    flex: 1,
    height: 80,
    borderRadius: 40,
    marginHorizontal: -4,
  },
  title: {
    fontSize: 34,
    fontWeight: '800',
    color: '#2D5A27',
    textAlign: 'center',
    letterSpacing: 1,
    zIndex: 1,
  },
  tagline: {
    fontSize: 14,
    color: '#8B7355',
    textAlign: 'center',
    marginTop: 6,
    fontStyle: 'italic',
    zIndex: 1,
  },
  titleUnderline: {
    width: 60,
    height: 3,
    backgroundColor: '#C96B4E',
    borderRadius: 2,
    marginTop: 10,
    zIndex: 1,
  },
  buttonSection: {
    width: '100%',
    gap: 12,
  },
  primaryButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    elevation: 4,
    ...Platform.select({
      web: { boxShadow: '0 4px 12px rgba(45, 90, 39, 0.12)' },
    }),
    borderWidth: 1,
    borderColor: '#E8DDD0',
  },
  btnIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FDF6EE',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
    borderWidth: 1.5,
    borderColor: '#E8DDD0',
  },
  btnIcon: {
    fontSize: 22,
  },
  btnTextWrap: {
    flex: 1,
  },
  primaryButtonText: {
    fontSize: 17,
    color: '#2D5A27',
    fontWeight: '700',
  },
  primaryButtonDesc: {
    fontSize: 12,
    color: '#8B7355',
    marginTop: 2,
  },
  btnArrow: {
    fontSize: 24,
    color: '#C96B4E',
    fontWeight: '300',
    marginLeft: 8,
  },
  galleryTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2D5A27',
    alignSelf: 'flex-start',
    marginTop: 10,
    marginBottom: 10,
  },
  galleryScroll: {
    width: '100%',
    marginBottom: 10,
  },
  galleryCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    marginRight: 12,
    width: 160,
    overflow: 'hidden',
    elevation: 2,
    ...Platform.select({ web: { boxShadow: '0 2px 4px rgba(0,0,0,0.08)' } }),
    borderWidth: 1,
    borderColor: '#E8DDD0',
  },
  galleryImage: {
    width: 160,
    height: 120,
    resizeMode: 'cover',
  },
  galleryLabel: {
    fontSize: 11,
    color: '#2D5A27',
    padding: 8,
    textAlign: 'center',
    fontWeight: '600',
  },
  footer: {
    marginTop: 20,
    paddingBottom: 10,
  },
  footerText: {
    fontSize: 11,
    color: '#B8A58E',
  },
});
