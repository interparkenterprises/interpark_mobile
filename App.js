// App.js
import { enableScreens } from 'react-native-screens';
enableScreens();
import 'react-native-gesture-handler';
import React from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import AppNavigator from './src/navigation/AppNavigator';
import { NavigationContainer } from '@react-navigation/native';

const linking = {
  // Recognize both your app’s scheme and your backend’s https:// URL
  prefixes: [
    'interpark://',                                      // mobile deep link
    'https://interpark-backend.onrender.com',            // web fallback
  ],
  config: {
    screens: {
      // name must match your Stack.Screen name in AppNavigator
      ResetPassword: 'reset-password/:token',
      // … other screens if you ever deep‑link to them
    },
  },
};

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <NavigationContainer linking={linking} fallback={null}>
        <AppNavigator />
      </NavigationContainer>
    </GestureHandlerRootView>
  );
}
