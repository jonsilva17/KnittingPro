import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { useLang } from '../lang';
import HomeScreen from '../screens/HomeScreen';
import EditScreen from '../screens/EditScreen';
import PreviewScreen from '../screens/PreviewScreen';
import ToyScreen from '../screens/ToyScreen';
import StitchBlanketScreen from '../screens/StitchBlanketScreen';
import StitchEditorScreen from '../screens/StitchEditorScreen';
import ColorworkEditorScreen from '../screens/ColorworkEditorScreen';

const Stack = createStackNavigator();

function AppNavigatorInner() {
  const { t } = useLang();
  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: '#6B4F8A' },
          headerTintColor: '#FFFFFF',
          headerTitleStyle: { fontWeight: 'bold' },
          cardStyle: Platform.OS === 'web' ? { overflow: 'auto', flex: 1 } : {},
          gestureEnabled: Platform.OS !== 'web',
        }}
      >
        <Stack.Screen
          name="Home"
          options={{ title: t.appName }}
        >
          {props => <HomeScreen {...props} />}
        </Stack.Screen>
        <Stack.Screen
          name="Edit"
          options={{ title: t.editSweater }}
        >
          {props => <EditScreen {...props} />}
        </Stack.Screen>
        <Stack.Screen
          name="Preview"
          options={{ title: t.previewTitle || 'Preview' }}
        >
          {props => <PreviewScreen {...props} />}
        </Stack.Screen>
        <Stack.Screen
          name="Toy"
          options={{ title: t.toyPattern }}
        >
          {props => <ToyScreen {...props} />}
        </Stack.Screen>
        <Stack.Screen
          name="StitchBlanket"
          options={{ title: t.stitchBlanket }}
        >
          {props => <StitchBlanketScreen {...props} />}
        </Stack.Screen>
        <Stack.Screen
          name="StitchEditor"
          options={{ title: t.editTitle }}
        >
          {props => <StitchEditorScreen {...props} />}
        </Stack.Screen>
        <Stack.Screen
          name="ColorworkEditor"
          options={{ title: t.colorworkEditor }}
        >
          {props => <ColorworkEditorScreen {...props} />}
        </Stack.Screen>
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function AppNavigator() {
  return (
    <View style={styles.container}>
      <AppNavigatorInner />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    ...(Platform.OS === 'web' ? { height: '100vh' } : {}),
  },
});
