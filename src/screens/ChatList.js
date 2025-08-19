import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, TextInput, Alert, Button } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import axios from 'axios';
import io from 'socket.io-client';
import { EXPO_PUBLIC_API_BASE_URL } from '@env';
import * as Notifications from 'expo-notifications';

const ChatList = () => {
    const [chatRooms, setChatRooms] = useState([]);
    const [properties, setProperties] = useState({});
    const [searchQuery, setSearchQuery] = useState('');
    const [filteredChatRooms, setFilteredChatRooms] = useState([]);
    const [unreadCounts, setUnreadCounts] = useState({});
    const [lastMessages, setLastMessages] = useState({});
    const navigation = useNavigation();
    const [socket, setSocket] = useState(null);
    const [userId, setUserId] = useState(null);

    useEffect(() => {
        initializeComponent();
    }, []);

    const initializeComponent = async () => {
        try {
            // Get user ID
            const storedUserId = await AsyncStorage.getItem('userId');
            if (storedUserId) {
                setUserId(storedUserId);
                
                // Ensure push token is registered
                await ensurePushTokenRegistered(storedUserId);
                
                // Initialize socket connection
                initializeSocket(storedUserId);
                
                // Load chat rooms - Pass userId directly
                await loadChatRooms(storedUserId);
            } else {
                console.error('No userId found in storage');
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
        const newSocket = io('https://interpark-backend.onrender.com');
        
        newSocket.on('connect', () => {
            console.log('Socket connected:', newSocket.id);
            newSocket.emit('register_user', userId);
        });

        newSocket.on('chat_list_update', (data) => {
            console.log('Received chat list update:', data);
            setUnreadCounts(prev => ({
                ...prev,
                [data.chatRoomId]: data.unreadCount
            }));
            setLastMessages(prev => ({
                ...prev,
                [data.chatRoomId]: {
                    content: data.lastMessage,
                    timestamp: data.lastMessageTime
                }
            }));
            // Re-sort chat rooms
            loadChatRooms(userId);
        });

        newSocket.on('new_chat_room', async (newChatRoom) => {
            setChatRooms((prevChatRooms) => {
                const updatedChatRooms = [...prevChatRooms, newChatRoom];
                setFilteredChatRooms(sortChatRooms(updatedChatRooms));
                return updatedChatRooms;
            });
            await fetchPropertyTitle(newChatRoom.propertyId);
        });

        newSocket.on('error', (error) => {
            console.error('Socket error:', error);
        });

        setSocket(newSocket);

        // Cleanup function
        return () => {
            newSocket.disconnect();
        };
    };

    const loadChatRooms = async (userIdParam) => {
        try {
            const storedChatRooms = await AsyncStorage.getItem('userChatRooms');
            if (storedChatRooms) {
                const parsedChatRooms = JSON.parse(storedChatRooms);
                await loadChatRoomsWithDetails(parsedChatRooms, userIdParam);
            }
        } catch (error) {
            console.error('Error loading chat rooms:', error);
            Alert.alert('Error', 'Failed to load chat rooms.');
        }
    };

    const loadChatRoomsWithDetails = async (chatRooms, userIdParam) => {
        try {
            const currentUserId = userIdParam || userId;
            if (!currentUserId) {
                console.error('No userId available for loading detailed rooms');
                return;
            }

            const response = await axios.post(`https://interpark-backend.onrender.com/api/chat/detailed-rooms`, {
                chatRoomIds: chatRooms.map(room => room.id),
                userId: currentUserId
            });

            const detailedRooms = response.data.chatRooms;
            const sortedRooms = sortChatRooms(detailedRooms);
            
            setChatRooms(sortedRooms);
            setFilteredChatRooms(sortedRooms);
            
            // Extract unread counts and last messages
            const unreadData = {};
            const lastMessageData = {};
            const propertyData = {};
            
            detailedRooms.forEach(room => {
                unreadData[room.id] = room.unreadCount || 0;
                if (room.lastMessage) {
                    lastMessageData[room.id] = {
                        content: room.lastMessage.content,
                        timestamp: room.lastMessage.timestamp
                    };
                }
                if (room.property) {
                    propertyData[room.propertyId] = room.property.title;
                }
            });
            
            setUnreadCounts(unreadData);
            setLastMessages(lastMessageData);
            setProperties(propertyData);
            
        } catch (error) {
            console.error('Error loading detailed chat rooms:', error);
            // Fallback to basic loading
            setChatRooms(chatRooms);
            setFilteredChatRooms(chatRooms);
            await fetchPropertyTitles(chatRooms);
        }
    };

    const sortChatRooms = (rooms) => {
        return [...rooms].sort((a, b) => {
            // First priority: unread messages
            const aUnread = a.unreadCount || 0;
            const bUnread = b.unreadCount || 0;
            
            if (aUnread !== bUnread) {
                return bUnread - aUnread;
            }
            
            // Second priority: last message time
            const aTime = a.lastMessageTime || a.updatedAt || a.createdAt;
            const bTime = b.lastMessageTime || b.updatedAt || b.createdAt;
            
            return new Date(bTime) - new Date(aTime);
        });
    };

    const fetchPropertyTitles = async (chatRooms) => {
        try {
            const propertyIds = chatRooms.map((room) => room.propertyId);
            const response = await axios.post(`https://interpark-backend.onrender.com/api/properties/titles`, { propertyIds });
            const titles = response.data.titles;

            const propertyMap = {};
            titles.forEach((title) => {
                propertyMap[title.propertyId] = title.title;
            });

            setProperties(propertyMap);
        } catch (error) {
            console.error('Error fetching property titles:', error);
        }
    };

    const fetchPropertyTitle = async (propertyId) => {
        try {
            const response = await axios.post(`https://interpark-backend.onrender.com/api/properties/titles`, { 
                propertyIds: [propertyId] 
            });
            const titles = response.data.titles;

            if (titles && titles.length > 0) {
                setProperties(prev => ({
                    ...prev,
                    [propertyId]: titles[0].title
                }));
            }
        } catch (error) {
            console.error('Error fetching property title:', error);
        }
    };

    const refreshChatRooms = async () => {
        try {
            if (userId) {
                await loadChatRooms(userId);
            } else {
                const storedUserId = await AsyncStorage.getItem('userId');
                if (storedUserId) {
                    setUserId(storedUserId);
                    await loadChatRooms(storedUserId);
                } else {
                    Alert.alert('Error', 'User not logged in');
                }
            }
        } catch (error) {
            console.error('Error refreshing chat rooms:', error);
            Alert.alert('Error', 'Failed to refresh chat rooms.');
        }
    };

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

    const handleChatRoomPress = (chatRoom) => {
        // Clear unread count for this chat room locally
        setUnreadCounts(prev => ({
            ...prev,
            [chatRoom.id]: 0
        }));

        // Join the room via socket to mark messages as read
        if (socket && userId) {
            socket.emit('join_room', {
                chatRoomId: chatRoom.id,
                userId: userId
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
            <Button title="Refresh" onPress={refreshChatRooms} color="#005478" />
            {filteredChatRooms.length === 0 ? (
                <Text style={styles.noChatRoomsText}>No chat rooms available.</Text>
            ) : (
                <FlatList
                    data={filteredChatRooms}
                    keyExtractor={(item) => item.id.toString()}
                    renderItem={renderChatRoom}
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
