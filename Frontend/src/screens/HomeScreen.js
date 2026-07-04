import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';

export default function HomeScreen({ navigation }) {
  const [image, setImage] = useState(null);

  const pickFromGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permissão necessária', 'Precisamos de acesso à galeria para selecionar imagens.');
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
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permissão necessária', 'Precisamos de acesso à câmara para tirar fotos.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      quality: 0.7,
      maxWidth: 1024,
      maxHeight: 1024,
    });

    if (!result.canceled && result.assets?.length > 0) {
      setImage(result.assets[0].uri);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Knitting Pattern Maker</Text>
      <Text style={styles.subtitle}>
        Cria padrões de tricô a partir de imagens ou combina pontos
      </Text>

      <Image source={require('../../assets/icon.png')} style={styles.appIcon} />

      <TouchableOpacity
        style={styles.primaryButton}
        onPress={() => navigation.navigate('StitchBlanket')}
      >
        <Text style={styles.primaryButtonText}>🧶 Manta de Pontos</Text>
        <Text style={styles.primaryButtonDesc}>Combina padrões de meia e liga</Text>
      </TouchableOpacity>

      <View style={styles.divider}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>ou</Text>
        <View style={styles.dividerLine} />
      </View>

      <Text style={styles.sectionLabel}>Colorwork a partir de imagem</Text>

      {image && (
        <Image source={{ uri: image }} style={styles.preview} />
      )}

      <View style={styles.buttonRow}>
        <TouchableOpacity style={styles.button} onPress={takePhoto}>
          <Text style={styles.buttonText}>📷 Foto</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.button} onPress={pickFromGallery}>
          <Text style={styles.buttonText}>🖼 Galeria</Text>
        </TouchableOpacity>
      </View>

      {image && (
        <TouchableOpacity
          style={[styles.button, styles.actionButton]}
          onPress={() => navigation.navigate('Edit', { imageUri: image })}
        >
          <Text style={[styles.buttonText, styles.actionButtonText]}>
            Criar Sweater com Padrão →
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F0FF',
    alignItems: 'center',
    padding: 20,
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
    tintColor: '#6B4F8A',
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
    shadowColor: '#6B4F8A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
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
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
    width: '100%',
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#D0C0E0',
  },
  dividerText: {
    marginHorizontal: 12,
    color: '#999',
    fontSize: 14,
  },
  sectionLabel: {
    fontSize: 15,
    color: '#6B4F8A',
    fontWeight: '600',
    marginBottom: 16,
  },
  preview: {
    width: 200,
    height: 200,
    borderRadius: 12,
    marginBottom: 16,
    resizeMode: 'cover',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  button: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#6B4F8A',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 16,
    color: '#6B4F8A',
    fontWeight: '600',
  },
  actionButton: {
    backgroundColor: '#6B4F8A',
    borderColor: '#6B4F8A',
    paddingHorizontal: 32,
    paddingVertical: 14,
    width: '100%',
  },
  actionButtonText: {
    color: '#FFFFFF',
  },
});
