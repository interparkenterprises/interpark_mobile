import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, TextInput, Alert, Button } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import axios from 'axios';
import io from 'socket.io-client';
import { EXPO_PUBLIC_API_BASE_URL } from '@env';

const ChatList = () => {
    const [chatRooms, setChatRooms] = useState([]);
    const [properties, setProperties] = useState({});
    const [searchQuery, setSearchQuery] = useState('');
    const [filteredChatRooms, setFilteredChatRooms] = useState([]);
    const navigation = useNavigation();
    const socket = io('https://interpark-backend.onrender.com/api'); // Use your server URL

    useEffect(() => {
        const loadChatRooms = async () => {
            try {
                const storedChatRooms = await AsyncStorage.getItem('userChatRooms');
                if (storedChatRooms) {
                    const parsedChatRooms = JSON.parse(storedChatRooms);
                    setChatRooms(parsedChatRooms);
                    setFilteredChatRooms(parsedChatRooms);
                    await fetchPropertyTitles(parsedChatRooms);
                } else {
                    //Alert.alert('No Chat Rooms', 'No chat rooms found.');
                }
            } catch (error) {
                console.error('Error loading chat rooms:', error);
                Alert.alert('Error', 'Failed to load chat rooms.');
            }
        };

        loadChatRooms();

        // Listen for new chat rooms using Socket.io
        socket.on('new_chat_room', async (newChatRoom) => {
            setChatRooms((prevChatRooms) => {
                const updatedChatRooms = [...prevChatRooms, newChatRoom];
                setFilteredChatRooms(updatedChatRooms);
                return updatedChatRooms;
            });
            await fetchPropertyTitle(newChatRoom.propertyId);
        });

        // Set up automatic refresh every 30 seconds
        const intervalId = setInterval(() => {
            loadChatRooms(); // Call the refresh function periodically
        }, 15000); // Refresh every 15 seconds

        return () => {
            clearInterval(intervalId); // Clean up the interval on component unmount
            socket.disconnect(); // Clean up the socket connection
        };
    }, []);

    // Function to fetch property titles for all chat rooms
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
            //console.error('Error fetching property titles:', error);
        }
    };

    // Function to manually refresh chat rooms
    const refreshChatRooms = async () => {
        try {
            const storedChatRooms = await AsyncStorage.getItem('userChatRooms');
            if (storedChatRooms) {
                const parsedChatRooms = JSON.parse(storedChatRooms);
                setChatRooms(parsedChatRooms);
                setFilteredChatRooms(parsedChatRooms);
                await fetchPropertyTitles(parsedChatRooms);
            }
        } catch (error) {
            console.error('Error refreshing chat rooms:', error);
            Alert.alert('Error', 'Failed to refresh chat rooms.');
        }
    };

    // Function to filter chat rooms based on the search query
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
        navigation.navigate('ChatRooms', {
            chatRoomId: chatRoom.id,
            clientId: chatRoom.clientId,
            agentLandlordId: chatRoom.agentLandlordId,
        });
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>All Chats</Text>
            <TextInput
                style={styles.searchInput}
                placeholder="Search by property title..."
                placeholderTextColor="#aaa"
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
                    renderItem={({ item }) => (
                        <TouchableOpacity style={styles.chatRoom} onPress={() => handleChatRoomPress(item)}>
                            <Text style={styles.chatRoomText}>
                                {`Chat about ${properties[item.propertyId] || 'Unknown Property'}`}
                            </Text>
                        </TouchableOpacity>
                    )}
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
        backgroundColor: '#231F20',
        color: 'white',
        borderRadius: 8,
        paddingHorizontal: 10,
        marginBottom: 16,
    },
    chatRoom: {
        padding: 16,
        backgroundColor: '#231f20',
        borderRadius: 8,
        marginBottom: 8,
    },
    chatRoomText: {
        color: '#fff',
    },
    noChatRoomsText: {
        color: '#231f20',
        textAlign: 'center',
        marginTop: 20,
    },
});

export default ChatList;
