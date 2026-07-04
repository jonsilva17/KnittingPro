import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { useLang } from '../lang';

export default function HomeScreen({ navigation }) {
  const { height: windowHeight } = useWindowDimensions();
  const { lang, setLang, t } = useLang();

  const headerHeight = Platform.OS === 'web' ? 100 : 0;
  const contentHeight = windowHeight - headerHeight;

  const content = (
    <View style={styles.container}>
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

      <Text style={styles.title}>{t.appName}</Text>
      <Text style={styles.subtitle}>{t.subtitle}</Text>

      <Image source={require('../../assets/icon.png')} style={styles.appIcon} />

      <TouchableOpacity
        style={[styles.primaryButton, { backgroundColor: '#4A8B6F' }]}
        onPress={() => navigation.navigate('StitchEditor')}
      >
        <Text style={styles.primaryButtonText}>✏️ {t.stitchEditor}</Text>
        <Text style={styles.primaryButtonDesc}>{t.stitchEditorDesc}</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.primaryButton, { backgroundColor: '#1A237E' }]}
        onPress={() => navigation.navigate('ColorworkEditor')}
      >
        <Text style={styles.primaryButtonText}>🎨 {t.colorworkEditor}</Text>
        <Text style={styles.primaryButtonDesc}>{t.colorworkEditorDesc}</Text>
      </TouchableOpacity>

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
    backgroundColor: '#F5F0FF',
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
    borderRadius: 8,
    marginLeft: 4,
    backgroundColor: '#E8DEF0',
  },
  langBtnActive: {
    backgroundColor: '#6B4F8A',
  },
  langBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B4F8A',
  },
  langBtnTextActive: {
    color: '#FFFFFF',
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#6B4F8A',
    marginTop: 20,
    marginBottom: 6,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  appIcon: {
    width: 80,
    height: 80,
    marginBottom: 24,
  },
  primaryButton: {
    backgroundColor: '#6B4F8A',
    borderRadius: 14,
    paddingVertical: 18,
    paddingHorizontal: 32,
    alignItems: 'center',
    width: '100%',
    marginBottom: 8,
    elevation: 3,
    ...Platform.select({
      web: { boxShadow: '0 4px 6px rgba(107, 79, 138, 0.3)' },
    }),
  },
  primaryButtonText: {
    fontSize: 20,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  primaryButtonDesc: {
    fontSize: 12,
    color: '#E8DEF0',
    marginTop: 4,
  },
});
