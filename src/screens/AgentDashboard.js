// src/screens/AgentDashboard.js
import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Icon from 'react-native-vector-icons/Ionicons'; // Using Ionicons for icons

// Import screens
import PropertiesList from './PropertiesList';
import AddProperty from './AddProperty';
import ChatRooms from './ChatRooms';
import ChatList from './ChatList'; // Import the ChatList component
import AgentProfile from './AgentProfile';
import MyList from './MyList';

const Stack = createStackNavigator();

// Stack Navigator for the Profile screen
function AgentStackNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="AgentProfile" component={AgentProfile} />
      <Stack.Screen name="MyList" component={MyList} />
    </Stack.Navigator>
  );
}

// Create the Tab Navigator for AgentDashboard
const Tab = createBottomTabNavigator();

export default function AgentDashboard() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ color, size }) => {
          let iconName;

          // Define icons based on route name
          if (route.name === 'PropertiesList') {
            iconName = 'home-outline';
          } else if (route.name === 'AddProperty') {
            iconName = 'add-circle-outline';
          } else if (route.name === 'ChatList') {
            iconName = 'chatbubble-ellipses-outline';
          } else if (route.name === 'ChatRooms') {
            iconName = 'chatbubbles-outline';
          } else if (route.name === 'Profile') {
            iconName = 'person-circle-outline';
          }

          return <Icon name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#005478',
        tabBarInactiveTintColor: 'gray',
        headerShown: false, // Hides the header for each screen
      })}
    >
      {/* Define the tabs */}
      <Tab.Screen name="PropertiesList" component={PropertiesList} />
      <Tab.Screen name="AddProperty" component={AddProperty} />
      <Tab.Screen 
        name="ChatRooms" 
        component={ChatRooms} 
        initialParams={{ userType: 'agent' }} // Pass userType as agent
      />
      <Tab.Screen name="ChatList" component={ChatList} />
      <Tab.Screen name="Profile" component={AgentStackNavigator} />
    </Tab.Navigator>
  );
}
