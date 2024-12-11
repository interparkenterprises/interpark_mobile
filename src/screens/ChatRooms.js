import React, { useEffect, useState } from 'react';
import { GiftedChat } from 'react-native-gifted-chat';
import io from 'socket.io-client';
import {
    Text,
    View,
    Alert,
    StyleSheet,
    Platform,
    TouchableOpacity,
    Image,
    Animated,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Ionicons';
import axios from 'axios';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';  // <-- Import Device from expo-device
import { API_BASE_URL } from '@env';

const ChatRoom = ({ route }) => {
    const navigation = useNavigation();
    const { chatRoomId, clientId, agentLandlordId, userType } = route.params || {};
    const [messages, setMessages] = useState([]);
    const [profileInfo, setProfileInfo] = useState(null);
    const [isProfileVisible, setIsProfileVisible] = useState(false);
    const animation = useState(new Animated.Value(0))[0];

    const socket = io('https://interparkenterprises1001-gtuf6.ondigitalocean.app');

    useEffect(() => {
        const requestPermissions = async () => {
            if (Platform.OS === 'ios' || (Platform.OS === 'android' && Device.osBuildNumber >= 33)) {
                await Notifications.requestPermissionsAsync();
            }
        };

        requestPermissions();
    }, []);

    const showNotification = async (title, message) => {
        await Notifications.scheduleNotificationAsync({
            content: {
                title: title,
                body: message,
            },
            trigger: null,
        });
    };

    useEffect(() => {
        if (!chatRoomId) {
            Alert.alert('Info', 'No Conversations have been initiated yet.');
            return;
        }

        const fetchMessages = async () => {
            try {
                const response = await axios.get(`${API_BASE_URL}/chat/${chatRoomId}/messages`);
                setMessages(response.data.map((msg) => ({
                    _id: msg.id,
                    text: msg.content,
                    createdAt: new Date(msg.timestamp),
                    user: { _id: msg.senderId },
                })));
            } catch (error) {
                console.error('Error fetching messages:', error);
                Alert.alert('Error', 'Failed to load messages.');
            }
        };

        const fetchProfileData = async () => {
            try {
                let response;
                if (userType === 'agent') {
                    if (!clientId) throw new Error('Invalid clientId');
                    response = await axios.get(`${API_BASE_URL}/auth/client-profile/${clientId}`);
                    setProfileInfo(response.data.profile);
                } else {
                    if (!agentLandlordId) throw new Error('Invalid agentLandlordId');
                    response = await axios.get(`${API_BASE_URL}/auth/agent-profile/${agentLandlordId}`);
                    setProfileInfo(response.data.profile);
                }
            } catch (error) {
                console.error('Error fetching profile:', error);
                if (error.response && error.response.status === 404) {
                    Alert.alert('Error', 'Profile not found. Please check the profile ID.');
                } else {
                    Alert.alert('Error', `Failed to load profile data: ${error.message}`);
                }
            }
        };

        fetchMessages();
        fetchProfileData();

        socket.emit('join_room', chatRoomId);

        socket.on('receive_message', (incomingMessage) => {
            const newMessage = {
                _id: incomingMessage.id,
                text: incomingMessage.content,
                createdAt: new Date(incomingMessage.timestamp),
                user: { _id: incomingMessage.senderId },
            };
            setMessages((prevMessages) => GiftedChat.prepend(prevMessages, newMessage));
            showNotification('New Message', incomingMessage.content);
        });

        return () => {
            socket.disconnect();
        };
    }, [chatRoomId, userType, agentLandlordId, clientId]);

    const onSend = async (newMessages = []) => {
        const message = newMessages[0];
        const fullMessage = {
            chatRoomId: chatRoomId,
            senderId: userType === 'agent' ? agentLandlordId : clientId,
            content: message.text,
        };

        try {
            await axios.post(`${API_BASE_URL}/chat/send`, fullMessage);
            socket.emit('send_message', fullMessage);
            setMessages((prevMessages) => GiftedChat.prepend(prevMessages, message));
        } catch (error) {
            console.error('Error sending message:', error);
            Alert.alert('Error', 'Failed to send message.');
        }
    };

    const toggleProfileVisibility = () => {
        Animated.timing(animation, {
            toValue: isProfileVisible ? 0 : 1,
            duration: 300,
            useNativeDriver: false,
        }).start();
        setIsProfileVisible(!isProfileVisible);
    };

    const profileHeight = animation.interpolate({
        inputRange: [0, 1],
        outputRange: [0, 150], // Adjust height range as needed
    });

    const isAgent = userType === 'agent';
    const currentUserId = isAgent ? agentLandlordId : clientId;

    // Correctly define renderMessage as a function
    const renderMessage = (props) => {
        const isSentByCurrentUser = props.currentMessage.user._id === currentUserId;
        return (
            <View style={isSentByCurrentUser ? styles.sentMessage : styles.receivedMessage}>
                <Text style={styles.messageText}>{props.currentMessage.text}</Text>
                <Text style={styles.timestampText}>
                    {new Date(props.currentMessage.createdAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                    })}
                </Text>
            </View>
        );
    };

    return chatRoomId ? (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Icon name="arrow-back" size={24} color="#ffffff" />
                </TouchableOpacity>
                <TouchableOpacity onPress={toggleProfileVisibility}>
                    <Text style={styles.headerText}>
                        {isAgent ? 'Chatting with Client' : 'Chatting with Agent'}
                    </Text>
                </TouchableOpacity>
                <Animated.View style={{ height: profileHeight, overflow: 'hidden' }}>
                    {profileInfo && (
                        <View style={styles.profileContainer}>
                            {isAgent ? (
                                <>
                                    <Text style={styles.profileText}>Client: {profileInfo.user.username}</Text>
                                    <Text style={styles.profileText}>UserID: {profileInfo.user.id}</Text>
                                    <Text style={styles.profileText}>Email: {profileInfo.user.email}</Text>
                                    {profileInfo.user.avatar && (
                                        <Image
                                            source={{ uri: profileInfo.user.avatar }}
                                            style={styles.avatar}
                                        />
                                    )}
                                </>
                            ) : (
                                <>
                                    <Text style={styles.profileText}>Agent: {profileInfo.user.username}</Text>
                                    <Text style={styles.profileText}>Phone: {profileInfo.phoneNumber}</Text>
                                    <Text style={styles.profileText}>Agent ID: {profileInfo.agentNumber}</Text>
                                    <Text style={styles.profileText}>Email: {profileInfo.user.email}</Text>
                                    {profileInfo.user.avatar && (
                                        <Image
                                            source={{ uri: profileInfo.user.avatar }}
                                            style={styles.avatar}
                                        />
                                    )}
                                </>
                            )}
                        </View>
                    )}
                </Animated.View>
            </View>
            <GiftedChat
                messages={messages}
                onSend={onSend}
                user={{ _id: currentUserId, name: isAgent ? 'Agent' : 'Client' }}
                inverted={false}
                scrollToBottom
                renderMessage={renderMessage} // Ensure it's passed as a function
            />
        </View>
    ) : (
        <View style={styles.noConversation}>
            <Text>No Conversations have been initiated yet.</Text>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#E0E0E0',
    },
    header: {
        backgroundColor: '#444444',
        padding: 15,
        paddingTop: 40,
        alignItems: 'flex-start',
    },
    headerText: {
        color: '#ffffff',
        fontSize: 18,
        marginVertical: 5,
    },
    profileContainer: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        backgroundColor: '#333',
        borderTopWidth: 1,
        borderTopColor: '#888',
    },
    profileText: {
        color: '#fff',
    },
    avatar: {
        width: 50,
        height: 50,
        borderRadius: 25,
    },
    sentMessage: {
        backgroundColor: '#005478',
        alignSelf: 'flex-end',
        padding: 10,
        borderRadius: 15,
        marginBottom: 5,
        maxWidth: '80%',
    },
    receivedMessage: {
        backgroundColor: '#f1f1f1',
        alignSelf: 'flex-start',
        padding: 10,
        borderRadius: 15,
        marginBottom: 5,
        maxWidth: '80%',
    },
    messageText: {
        color: 'black',
    },
    timestampText: {
        color: '#b2b2b2',
        fontSize: 10,
        textAlign: 'right',
    },
    noConversation: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
});

export default ChatRoom;
