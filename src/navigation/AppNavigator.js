import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { View, ActivityIndicator, StyleSheet } from 'react-native';

import { useAuth } from '../contexts/AuthContext';

// Import screens
import Login from '../screens/Login';
import Register from '../screens/Register';
import ForgotPassword from '../screens/ForgotPassword';
import ResetPassword from '../screens/ResetPassword';
import AgentDashboard from '../screens/AgentDashboard';
import ClientDashboard from '../screens/ClientDashboard';
import PropertiesList from '../screens/PropertiesList';
import Preferences from '../screens/Preferences';
import ChatRooms from '../screens/ChatRooms';
import Profile from '../screens/Profile';
import MyList from '../screens/MyList';
import MapPlace from '../screens/MapPlace';
import GuestMode from '../screens/GuestMode';
import AddProperty from '../screens/AddProperty';
import AIProcessingScreen from '../screens/AIProcessingScreen';

const Stack = createStackNavigator();

const LoadingScreen = () => (
  <View style={styles.loadingContainer}>
    <ActivityIndicator size="large" color="#005478" />
  </View>
);

const AuthStack = () => (
  <Stack.Navigator 
    initialRouteName="GuestMode"
    screenOptions={{ headerShown: false }}
  >
    <Stack.Screen name="GuestMode" component={GuestMode} />
    <Stack.Screen name="Login" component={Login} />
    <Stack.Screen name="Register" component={Register} />
    <Stack.Screen name="ForgotPassword" component={ForgotPassword} />
    <Stack.Screen name="ResetPassword" component={ResetPassword} />
    <Stack.Screen name="MapPlace" component={MapPlace} />
  </Stack.Navigator>
);

const AppStack = () => {
  const { user } = useAuth();
  
  return (
    <Stack.Navigator 
      initialRouteName={user?.role === 'CLIENT' ? 'ClientDashboard' : 'AgentDashboard'}
      screenOptions={{ headerShown: false }}
    >
      {/* Client Navigation Screens */}
      <Stack.Screen name="ClientDashboard" component={ClientDashboard} />
      <Stack.Screen name="PropertiesList" component={PropertiesList} />
      <Stack.Screen name="Preferences" component={Preferences} />
      <Stack.Screen name="ChatRooms" component={ChatRooms} />
      <Stack.Screen name="Profile" component={Profile} />

      {/* Agent Navigation Screens */}
      <Stack.Screen name="AgentDashboard" component={AgentDashboard} />
      <Stack.Screen name="AddProperty" component={AddProperty} />
      <Stack.Screen name="AIProcessing" component={AIProcessingScreen} options={{ headerShown: false }} />

      {/* Additional Screens */}
      <Stack.Screen name="MyList" component={MyList} />
      <Stack.Screen name="MapPlace" component={MapPlace} />
    </Stack.Navigator>
  );
};

export default function AppNavigator() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <>
      {isAuthenticated ? <AppStack /> : <AuthStack />}
    </>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#B0B0B0',
  },
});