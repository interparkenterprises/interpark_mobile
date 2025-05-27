// src/navigation/AppNavigator.js
import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';

// Import screens for both agents and clients
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

// Agent-specific screens
import AddProperty from '../screens/AddProperty';
import AIProcessingScreen from '../screens/AIProcessingScreen';

// Create the stack navigator
const Stack = createStackNavigator();

export default function AppNavigator() {
  return (
    <Stack.Navigator initialRouteName="Login" screenOptions={{ headerShown: false }}>
      {/* Authentication Screens */}
      <Stack.Screen name="Login" component={Login} />
      <Stack.Screen name="Register" component={Register} />
      <Stack.Screen name="ForgotPassword" component={ForgotPassword} />
      <Stack.Screen name="ResetPassword" component={ResetPassword} />

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
}
