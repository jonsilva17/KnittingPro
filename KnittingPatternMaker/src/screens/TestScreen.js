import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import ScrollWrapper from '../components/ScrollWrapper';

export default function TestScreen({ navigation }) {
  return (
    <ScrollWrapper style={styles.container}>
      <TouchableOpacity onPress={() => navigation.goBack()}>
        <Text style={styles.btn}>Voltar</Text>
      </TouchableOpacity>
      <Text style={styles.txt}>Teste OK</Text>
    </ScrollWrapper>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF', padding: 40, alignItems: 'center', justifyContent: 'center' },
  btn: { fontSize: 20, color: '#1A237E', fontWeight: 'bold', marginBottom: 20 },
  txt: { fontSize: 24, color: '#4A8B6F' },
});
