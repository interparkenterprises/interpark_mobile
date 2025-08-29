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
import AIProcessingScreen from './AIProcessingScreen'; // Import AIProcessingScreen

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

// Stack Navigator for the Profile screen
function AgentStackNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="AgentProfile" component={AgentProfile} />
      <Stack.Screen name="MyList" component={MyList} />
    </Stack.Navigator>
  );
}

// Stack Navigator for AddProperty to handle AI Processing
function AddPropertyStackNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="AddPropertyMain" component={AddProperty} />
      <Stack.Screen 
        name="AIProcessing" 
        component={AIProcessingScreen}
        options={{
          gestureEnabled: false, // Prevent swipe back during processing
        }}
      />
    </Stack.Navigator>
  );
}

// Tab Navigator Component
function TabNavigator() {
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
      <Tab.Screen 
        name="AddProperty" 
        component={AddPropertyStackNavigator}
        options={{
          tabBarLabel: 'Add Property'
        }}
      />
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

// Main AgentDashboard with Stack Navigator for overall structure
export default function AgentDashboard() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="AgentDashboardTabs" component={TabNavigator} />
    </Stack.Navigator>
  );
}