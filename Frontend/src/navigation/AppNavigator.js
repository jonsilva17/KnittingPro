import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import HomeScreen from '../screens/HomeScreen';
import EditScreen from '../screens/EditScreen';
import PreviewScreen from '../screens/PreviewScreen';
import StitchBlanketScreen from '../screens/StitchBlanketScreen';

const Stack = createStackNavigator();

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: '#6B4F8A' },
          headerTintColor: '#FFFFFF',
          headerTitleStyle: { fontWeight: 'bold' },
        }}
      >
        <Stack.Screen
          name="Home"
          component={HomeScreen}
          options={{ title: 'Knitting Pattern Maker' }}
        />
        <Stack.Screen
          name="Edit"
          component={EditScreen}
          options={{ title: 'Editar Sweater' }}
        />
        <Stack.Screen
          name="Preview"
          component={PreviewScreen}
          options={{ title: 'Pré-visualização' }}
        />
        <Stack.Screen
          name="StitchBlanket"
          component={StitchBlanketScreen}
          options={{ title: 'Manta de Pontos' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
