// App.js
import { enableScreens } from 'react-native-screens';
enableScreens();
import 'react-native-gesture-handler';
import React, { useEffect, useRef } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { NavigationContainer } from '@react-navigation/native';
import { Linking } from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage'; // Add this
import axios from 'axios'; 

import AppNavigator from './src/navigation/AppNavigator';
import { AuthProvider } from './src/contexts/AuthContext';

// --- NOTIFICATION SETUP ---

// Set notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// Function to register for push notifications
async function registerForPushNotificationsAsync() {
  let token;

  // Set up Android notification channel
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('chat-messages', {
      name: 'Chat Messages',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#005478',
    });
  }

  if (Constants.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.warn('Failed to get push token for push notification!');
      return;
    }

    try {
      const { data: pushToken } = await Notifications.getExpoPushTokenAsync();
      token = pushToken;
      console.log('Push token:', token);

      // Send token to your backend
      const userId = await AsyncStorage.getItem('userId');
      if (userId) {
        await axios.post('https://interpark-backend.onrender.com/api/notifications/register', {
          userId,
          token,
        });
        console.log('Push token registered with backend');
      }
    } catch (error) {
      console.error('Error registering push token:', error);
    }
  } else {
    console.warn('Must use physical device for Push Notifications');
  }

  return token;
}

// --- DEEP LINKING CONFIG ---
const linking = {
  prefixes: [
    'interpark://',
    'https://interpark-backend.onrender.com',
  ],
  config: {
    screens: {
      ResetPassword: 'reset-password/:token',
    },
  },
  async getInitialURL() {
    const url = await Linking.getInitialURL();
    return url;
  },
  subscribe(listener) {
    const onReceiveURL = ({ url }) => listener(url);
    const subscription = Linking.addEventListener('url', onReceiveURL);
    return () => subscription?.remove?.();
  },
};

// --- MAIN APP COMPONENT ---
export default function App() {
  const navigationRef = useRef();
  const routeNameRef = useRef();

  useEffect(() => {
    registerForPushNotificationsAsync();

    // Listen to notification when received (foreground)
    const notificationListener = Notifications.addNotificationReceivedListener((notification) => {
      console.log('Notification received:', notification);
    });

    // Handle user tapping on notification
    const responseListener = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data;
      if (data.type === 'chat_message' && data.chatRoomId && navigationRef.current) {
        // Navigate to the chat room
        navigationRef.current.navigate('ChatRooms', {
          chatRoomId: data.chatRoomId,
          clientId: data.clientId,
          agentLandlordId: data.agentLandlordId,
        });
      }
    });

    return () => {      
      notificationListener.remove();
      responseListener.remove();
    };
  }, []);

  return (
    <AuthProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <NavigationContainer
          linking={linking}
          fallback={null}
          ref={navigationRef}
          onReady={() => {
            routeNameRef.current = navigationRef.current.getCurrentRoute()?.name;
          }}
          onStateChange={async () => {
            //const previousRouteName = routeNameRef.current;
            const currentRouteName = navigationRef.current.getCurrentRoute()?.name;
            routeNameRef.current = currentRouteName;
          }}
        >
          <AppNavigator />
        </NavigationContainer>
      </GestureHandlerRootView>
    </AuthProvider>
  );
}