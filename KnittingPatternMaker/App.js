import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LangProvider } from './src/lang';
import AppNavigator from './src/navigation/AppNavigator';

export default function App() {
  return (
    <LangProvider>
      <View style={styles.root}>
        <StatusBar style="light" />
        <AppNavigator />
      </View>
    </LangProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    ...(Platform.OS === 'web' ? { height: '100vh' } : {}),
  },
});
