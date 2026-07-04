import React from 'react';
import { View, ScrollView, Platform, useWindowDimensions } from 'react-native';

export default function ScrollWrapper({ children, style, contentContainerStyle }) {
  const { height: windowHeight } = useWindowDimensions();

  if (Platform.OS === 'web') {
    const headerEstimate = 100;
    const scrollHeight = windowHeight - headerEstimate;
    const merged = { ...(style || {}), ...(contentContainerStyle || {}) };
    return (
      <View style={[{ height: scrollHeight, overflowY: 'auto' }, style]}>
        <View style={contentContainerStyle}>
          {children}
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={style} contentContainerStyle={contentContainerStyle}>
      {children}
    </ScrollView>
  );
}
