// App.js
import { enableScreens } from 'react-native-screens';
enableScreens();
import 'react-native-gesture-handler';
import React from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import AppNavigator from './src/navigation/AppNavigator';
import { NavigationContainer } from '@react-navigation/native';
import { Linking } from 'react-native';
import { AuthProvider } from './src/contexts/AuthContext'; // Add this import

const linking = {
  // Recognize both your app's scheme and your backend's https:// URL
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
  // Add getInitialURL and subscribe for better deep link handling
  async getInitialURL() {
    // Check if app was opened from a deep link
    const url = await Linking.getInitialURL();
    return url;
  },
  subscribe(listener) {
    // Listen to incoming links when app is already open
    const onReceiveURL = ({ url }) => listener(url);
    
    // Listen to incoming links from deep linking
    const subscription = Linking.addEventListener('url', onReceiveURL);
    
    return () => {
      // Clean up the event listeners
      subscription?.remove();
    };
  },
};

export default function App() {
  return (
    <AuthProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <NavigationContainer linking={linking} fallback={null}>
          <AppNavigator />
        </NavigationContainer>
      </GestureHandlerRootView>
    </AuthProvider>
  );
}
