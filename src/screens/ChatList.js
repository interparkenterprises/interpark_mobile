import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, TextInput, Alert, Button } from 'react-native';
//import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import axios from 'axios';
import io from 'socket.io-client';
//import { EXPO_PUBLIC_API_BASE_URL } from '@env';
import * as Notifications from 'expo-notifications';
import { useAuth } from '../contexts/AuthContext'; // Import the auth context

const ChatList = () => {
    const [searchQuery, setSearchQuery] = useState('');
    const [filteredChatRooms, setFilteredChatRooms] = useState([]);
    const [socket, setSocket] = useState(null);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const navigation = useNavigation();
    
    // Get user data and chat room state from AuthContext
    const { 
        user, 
        chatRooms, 
        properties, 
        unreadCounts, 
        lastMessages, 
        isLoadingChatRooms,
        refreshChatRooms,
        handleChatListUpdate,
        addChatRoom,
        updateProperty,
        updateUnreadCount
    } = useAuth();

    useEffect(() => {
        if (user?.id) {
            initializeComponent();
        }
        
        // Cleanup socket on unmount
        return () => {
            if (socket) {
                socket.disconnect();
            }
        };
    }, [user]);

    // Use focus effect to ensure data is current when screen comes into focus
    useFocusEffect(
        useCallback(() => {
            if (chatRooms && chatRooms.length > 0) {
                setFilteredChatRooms(chatRooms);
            }
        }, [chatRooms])
    );

    // Update filtered chat rooms when chatRooms or search query changes
    useEffect(() => {
        if (searchQuery.trim() === '') {
            setFilteredChatRooms(chatRooms);
        } else {
            const filtered = chatRooms.filter((room) => {
                const propertyTitle = properties[room.propertyId] || '';
                return propertyTitle.toLowerCase().includes(searchQuery.toLowerCase());
            });
            setFilteredChatRooms(filtered);
        }
    }, [searchQuery, chatRooms, properties]);

    const initializeComponent = async () => {
        try {
            const userId = user.id;
            
            if (userId) {
                // Ensure push token is registered
                await ensurePushTokenRegistered(userId);
                
                // Initialize socket connection
                initializeSocket(userId);
            } else {
                console.error('No userId found');
                Alert.alert('Error', 'User not logged in');
            }
        } catch (error) {
            console.error('Error initializing component:', error);
        }
    };

    const ensurePushTokenRegistered = async (userId) => {
        try {
            // Check if user already has a push token registered
            const response = await axios.get(`https://interpark-backend.onrender.com/api/notifications/token/${userId}`);
            
            if (!response.data.hasPushToken) {
                console.log('No push token found, registering...');
                await registerForPushNotifications(userId);
            } else {
                console.log('Push token already registered');
            }
        } catch (error) {
            console.error('Error checking/registering push token:', error);
            // Try to register anyway
            await registerForPushNotifications(userId);
        }
    };

    const registerForPushNotifications = async (userId) => {
        try {
            const { status } = await Notifications.requestPermissionsAsync();
            
            if (status !== 'granted') {
                console.log('Push notification permissions not granted');
                return;
            }

            const token = (await Notifications.getExpoPushTokenAsync()).data;
            
            // Register token with backend
            await axios.post('https://interpark-backend.onrender.com/api/notifications/register', {
                userId,
                token
            });
            
            console.log('Push token registered successfully');
        } catch (error) {
            console.error('Error registering push token:', error);
        }
    };

    const initializeSocket = (userId) => {
        if (socket) {
            socket.disconnect();
        }

        const newSocket = io('https://interpark-backend.onrender.com');
        
        newSocket.on('connect', () => {
            console.log('Socket connected:', newSocket.id);
            newSocket.emit('register_user', userId);
        });

        newSocket.on('chat_list_update', (data) => {
            console.log('Received chat list update:', data);
            // Use AuthContext handler to update the global state
            handleChatListUpdate(data);
        });

        newSocket.on('new_chat_room', async (newChatRoom) => {
            console.log('Received new chat room:', newChatRoom);
            // Add to AuthContext state
            addChatRoom(newChatRoom);
            // Fetch property title if not available
            if (!properties[newChatRoom.propertyId]) {
                await fetchPropertyTitle(newChatRoom.propertyId);
            }
        });

        newSocket.on('error', (error) => {
            console.error('Socket error:', error);
        });

        setSocket(newSocket);
    };

    const fetchPropertyTitle = async (propertyId) => {
        try {
            const response = await axios.post(`https://interpark-backend.onrender.com/api/properties/titles`, { 
                propertyIds: [propertyId] 
            });
            const titles = response.data.titles;

            if (titles && titles.length > 0) {
                updateProperty(propertyId, titles[0].title);
            }
        } catch (error) {
            console.error('Error fetching property title:', error);
        }
    };

    const handleRefresh = async () => {
        try {
            setIsRefreshing(true);
            await refreshChatRooms();
        } catch (error) {
            console.error('Error refreshing chat rooms:', error);
            Alert.alert('Error', 'Failed to refresh chat rooms.');
        } finally {
            setIsRefreshing(false);
        }
    };

    const handleChatRoomPress = (chatRoom) => {
        // Clear unread count using AuthContext function
        updateUnreadCount(chatRoom.id, 0);

        // Join the room via socket to mark messages as read
        if (socket && user?.id) {
            socket.emit('join_room', {
                chatRoomId: chatRoom.id,
                userId: user.id
            });
        }

        navigation.navigate('ChatRooms', {
            chatRoomId: chatRoom.id,
            clientId: chatRoom.clientId,
            agentLandlordId: chatRoom.agentLandlordId,
        });
    };

    const formatTimestamp = (timestamp) => {
        if (!timestamp) return '';
        
        const now = new Date();
        const messageTime = new Date(timestamp);
        const diffInHours = (now - messageTime) / (1000 * 60 * 60);
        
        if (diffInHours < 1) {
            const diffInMinutes = Math.floor((now - messageTime) / (1000 * 60));
            return `${diffInMinutes}m ago`;
        } else if (diffInHours < 24) {
            return `${Math.floor(diffInHours)}h ago`;
        } else {
            return messageTime.toLocaleDateString();
        }
    };

    const renderChatRoom = ({ item }) => {
        const unreadCount = unreadCounts[item.id] || 0;
        const lastMessage = lastMessages[item.id];
        const hasUnread = unreadCount > 0;
        
        return (
            <TouchableOpacity 
                style={[
                    styles.chatRoom, 
                    hasUnread && styles.unreadChatRoom
                ]} 
                onPress={() => handleChatRoomPress(item)}
            >
                <View style={styles.chatRoomContent}>
                    <View style={styles.chatRoomHeader}>
                        <Text style={[
                            styles.chatRoomText,
                            hasUnread && styles.unreadText
                        ]}>
                            {`Chat about ${properties[item.propertyId] || 'Unknown Property'}`}
                        </Text>
                        {hasUnread && (
                            <View style={styles.unreadBadge}>
                                <Text style={styles.unreadBadgeText}>
                                    {unreadCount > 99 ? '99+' : unreadCount}
                                </Text>
                            </View>
                        )}
                    </View>
                    {lastMessage && (
                        <View style={styles.lastMessageContainer}>
                            <Text style={styles.lastMessageText} numberOfLines={1}>
                                {lastMessage.content}
                            </Text>
                            <Text style={styles.timestampText}>
                                {formatTimestamp(lastMessage.timestamp)}
                            </Text>
                        </View>
                    )}
                </View>
            </TouchableOpacity>
        );
    };

    const isLoading = isLoadingChatRooms || isRefreshing;

    return (
        <View style={styles.container}>
            <Text style={styles.title}>All Chats</Text>
            <TextInput
                style={styles.searchInput}
                placeholder="Search by property title..."
                placeholderTextColor="#1B1B1B"
                value={searchQuery}
                onChangeText={setSearchQuery}
            />
            <Button 
                title={isLoading ? "Loading..." : "Refresh"} 
                onPress={handleRefresh} 
                color="#005478" 
                disabled={isLoading}
            />
            {filteredChatRooms.length === 0 ? (
                <Text style={styles.noChatRoomsText}>
                    {isLoading ? 'Loading chat rooms...' : 'No chat rooms available.'}
                </Text>
            ) : (
                <FlatList
                    data={filteredChatRooms}
                    keyExtractor={(item) => item.id.toString()}
                    renderItem={renderChatRoom}
                    extraData={[unreadCounts, lastMessages, properties]} // Re-render when these change
                />
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 16,
        backgroundColor: '#E0E0E0',
    },
    title: {
        fontSize: 24,
        color: '#231f20',
        marginBottom: 16,
        marginTop: 30,
    },
    searchInput: {
        height: 40,
        backgroundColor: '#7F7F7F',
        color: '#1B1B1B',
        borderRadius: 8,
        paddingHorizontal: 10,
        marginBottom: 16,
    },
    chatRoom: {
        padding: 16,
        backgroundColor: '#7F7F7F',
        borderRadius: 8,
        marginBottom: 8,
    },
    unreadChatRoom: {
        backgroundColor: '#A0A0A0',
        borderLeftWidth: 4,
        borderLeftColor: '#005478',
    },
    chatRoomContent: {
        flex: 1,
    },
    chatRoomHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    chatRoomText: {
        color: '#1B1B1B',
        fontSize: 16,
        flex: 1,
    },
    unreadText: {
        fontWeight: 'bold',
        color: '#000',
    },
    unreadBadge: {
        backgroundColor: '#005478',
        borderRadius: 12,
        paddingHorizontal: 6,
        paddingVertical: 2,
        minWidth: 24,
        alignItems: 'center',
    },
    unreadBadgeText: {
        color: 'white',
        fontSize: 12,
        fontWeight: 'bold',
    },
    lastMessageContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 4,
    },
    lastMessageText: {
        color: '#4A4A4A',
        fontSize: 14,
        flex: 1,
        marginRight: 8,
    },
    timestampText: {
        color: '#666',
        fontSize: 12,
    },
    noChatRoomsText: {
        color: '#231f20',
        textAlign: 'center',
        marginTop: 20,
    },
});

export default ChatList;
