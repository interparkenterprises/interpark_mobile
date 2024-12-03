// src/navigation/AppNavigator.js
import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { NavigationContainer } from '@react-navigation/native';

// Import screens for both agents and clients
import Login from '../screens/Login';
import Register from '../screens/Register';
import ForgotPassword from '../screens/ForgotPassword';
import AgentDashboard from '../screens/AgentDashboard';
import ClientDashboard from '../screens/ClientDashboard';
import PropertiesList from '../screens/PropertiesList';
import Preferences from '../screens/Preferences';
import ChatRooms from '../screens/ChatRooms';
import Profile from '../screens/Profile';
import MyList from '../screens/MyList'; // Adjust the path if necessary
import MapPlace from '../screens/MapPlace';




// Agent-specific screens
import AddProperty from '../screens/AddProperty';



const Stack = createStackNavigator();

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Login" screenOptions={{ headerShown: false }}>
        
        {/* Authentication Screens */}
        <Stack.Screen name="Login" component={Login} />
        <Stack.Screen name="Register" component={Register} />
        <Stack.Screen name="ForgotPassword" component={ForgotPassword} />

        {/* Client Navigation Screens */}
        <Stack.Screen name="ClientDashboard" component={ClientDashboard} />
        <Stack.Screen name="PropertiesList" component={PropertiesList} />
        <Stack.Screen name="Preferences" component={Preferences} />
        <Stack.Screen name="ChatRooms" component={ChatRooms} />
        <Stack.Screen name="Profile" component={Profile} />

        {/* Agent Navigation Screens */}
        <Stack.Screen name="AgentDashboard" component={AgentDashboard} />
        <Stack.Screen name="AddProperty" component={AddProperty} />

        
        {/* Add this screen to the stack navigator*/}
        <Stack.Screen name="MyList" component={MyList} />
        <Stack.Screen name="MapPlace" component={MapPlace} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
