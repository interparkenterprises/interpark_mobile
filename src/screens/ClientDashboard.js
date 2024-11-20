// src/screens/ClientDashboard.js
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Ionicons'; // Import Ionicons for icons

// Import necessary screens for the tabs
import PropertiesList from './PropertiesList';
//import Favoritess from './Favorites';
import Preferences from './Preferences'
import ChatRooms from './ChatRooms';
import Profile from './Profile';
import ChatList from './ChatList'; // Import the ChatList component

const Tab = createBottomTabNavigator();

export default function ClientDashboard() {
    return (
        <NavigationContainer independent={true}>
            <Tab.Navigator
                screenOptions={({ route }) => ({
                    tabBarIcon: ({ color, size }) => {
                        let iconName;

                        // Set icons based on route name
                        if (route.name === 'PropertiesList') {
                            iconName = 'home-outline';
                        } else if (route.name === 'Preferences') {
                            iconName = 'heart';
                        } else if (route.name === 'ChatList') {
                            iconName = 'chatbubble-ellipses-outline';
                        }else if (route.name === 'ChatRooms') {
                          iconName = 'chatbubbles-outline';
                        }else if (route.name === 'Profile') {
                            iconName = 'person-circle-outline';
                        }

                        return <Icon name={iconName} size={size} color={color} />;
                    },
                    tabBarActiveTintColor: 'tomato',
                    tabBarInactiveTintColor: 'gray',
                    headerShown: false, // Hide the header
                })}
            >
                {/* Define the tabs */}
                <Tab.Screen name="PropertiesList" component={PropertiesList} />
                <Tab.Screen name="Preferences" component={Preferences} />
                
                <Tab.Screen 
                    name="ChatRooms" 
                    component={ChatRooms} 
                    initialParams={{ userType: 'client' }} // Pass userType as client
                />
                <Tab.Screen name="ChatList" component={ChatList} />
                <Tab.Screen name="Profile" component={Profile} />
            </Tab.Navigator>
        </NavigationContainer>
    );
}