import React, { useEffect, useState } from 'react';
import { GiftedChat, InputToolbar, Composer, Send } from 'react-native-gifted-chat';
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
    Linking
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Ionicons';
import axios from 'axios';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { EXPO_PUBLIC_API_BASE_URL } from '@env';

const ChatRoom = ({ route }) => {
    const navigation = useNavigation();
    const { chatRoomId, clientId, agentLandlordId, userType } = route.params || {};
    const [messages, setMessages] = useState([]);
    const [profileInfo, setProfileInfo] = useState(null);
    const [isProfileVisible, setIsProfileVisible] = useState(false);
    const animation = useState(new Animated.Value(0))[0];

    const socket = io('https://interpark-backend.onrender.com');

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

    const handlePhoneCall = (phoneNumber) => {
        if (!phoneNumber) {
            Alert.alert('Error', 'No phone number available');
            return;
        }

        const phoneUrl = `tel:${phoneNumber}`;
        
        Linking.canOpenURL(phoneUrl)
            .then(supported => {
                if (!supported) {
                    Alert.alert('Error', 'Phone calls are not supported on this device');
                } else {
                    return Linking.openURL(phoneUrl);
                }
            })
            .catch(err => {
                console.error('Error making phone call:', err);
                Alert.alert('Error', 'Failed to initiate phone call');
            });
    };

    useEffect(() => {
        if (!chatRoomId) {
            Alert.alert('Info', 'No Conversations have been initiated yet.');
            return;
        }

        const fetchMessages = async () => {
            try {
                const response = await axios.get(`https://interpark-backend.onrender.com/api/chat/${chatRoomId}/messages`);
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
                    response = await axios.get(`https://interpark-backend.onrender.com/api/auth/client-profile/${clientId}`);
                    setProfileInfo(response.data.profile);
                } else {
                    if (!agentLandlordId) throw new Error('Invalid agentLandlordId');
                    response = await axios.get(`https://interpark-backend.onrender.com/api/auth/agent-profile/${agentLandlordId}`);
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
            setMessages(prevMessages => {
                // Remove any optimistic message with matching content
                const filtered = prevMessages.filter(msg => 
                    !(msg.isOptimistic && msg.text === incomingMessage.content)
                );
                
                const newMessage = {
                    _id: incomingMessage.id,
                    text: incomingMessage.content,
                    createdAt: new Date(incomingMessage.timestamp),
                    user: { _id: incomingMessage.senderId },
                };
                
                return GiftedChat.prepend(filtered, newMessage);
            });
            showNotification('New Message', incomingMessage.content);
        });

        return () => {
            socket.disconnect();
        };
    }, [chatRoomId, userType, agentLandlordId, clientId]);

    const onSend = async (newMessages = []) => {
        const message = newMessages[0];
        const tempId = Date.now().toString(); // Temporary client-side ID
        const fullMessage = {
            chatRoomId: chatRoomId,
            senderId: userType === 'agent' ? agentLandlordId : clientId,
            content: message.text,
        };

        // Add message immediately with temp ID
        const optimisticMessage = {
            ...message,
            _id: tempId,
            isOptimistic: true // Flag for tracking
        };
        setMessages((prevMessages) => GiftedChat.prepend(prevMessages, optimisticMessage));

        try {
            await axios.post(`https://interpark-backend.onrender.com/api/chat/send`, fullMessage);
            socket.emit('send_message', fullMessage);
        } catch (error) {
            console.error('Error sending message:', error);
            // Mark message as failed
            setMessages(prevMessages => prevMessages.map(msg => 
                msg._id === tempId ? {...msg, isFailed: true} : msg
            ));
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
        outputRange: [0, 150],
    });

    const isAgent = userType === 'agent';
    const currentUserId = isAgent ? agentLandlordId : clientId;

    const renderMessage = (props) => {
        const isSentByCurrentUser = props.currentMessage.user._id === currentUserId;
        const isFailed = props.currentMessage.isFailed;
        
        return (
            <View style={[
                isSentByCurrentUser ? styles.sentMessage : styles.receivedMessage,
                isFailed && styles.failedMessage
            ]}>
                <Text style={styles.messageText}>{props.currentMessage.text}</Text>
                {isFailed && <Text style={styles.failedText}>Failed to send</Text>}
                <Text style={styles.timestampText}>
                    {new Date(props.currentMessage.createdAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                    })}
                </Text>
            </View>
        );
    };

    const renderInputToolbar = (props) => (
        <InputToolbar
            {...props}
            containerStyle={styles.inputToolbar}
            primaryStyle={styles.inputPrimary}
        />
    );

    const renderComposer = (props) => (
        <Composer
            {...props}
            textInputStyle={styles.composer}
            placeholderTextColor={styles.placeholderText.color}
            multiline={true}
        />
    );
    const renderSend = (props) => (
        <Send {...props}>
            <View style={styles.sendButtonContainer}>
                <Icon name="send" size={24} color="#007AFF" />
            </View>
        </Send>
    );
    

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
                                    <TouchableOpacity 
                                        onPress={() => handlePhoneCall(profileInfo.phoneNumber)}
                                        style={styles.phoneContainer}
                                    >
                                        <View style={styles.phoneRow}>
                                            <Icon name="call-outline" size={16} color="#ffffff" />
                                            <Text style={styles.profileText}>Phone: {profileInfo.phoneNumber}</Text>
                                        </View>
                                    </TouchableOpacity>
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
                renderMessage={renderMessage}
                renderInputToolbar={renderInputToolbar}
                renderSend={renderSend}
                renderComposer={renderComposer}
                placeholder="Type a message..."
                alwaysShowSend={true}
                textInputProps={{
                    maxLength: 1000,
                    enablesReturnKeyAutomatically: true,
                    blurOnSubmit: false,
                    returnKeyType: 'default',
                }}
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
    failedMessage: {
        backgroundColor: '#ffcccc',
        borderColor: '#ff0000',
        borderWidth: 1,
    },
    messageText: {
        color: 'black',
    },
    failedText: {
        color: '#ff0000',
        fontSize: 12,
        fontStyle: 'italic',
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
    inputToolbar: {
        borderTopWidth: 1,
        borderTopColor: '#e0e0e0',
        backgroundColor: '#ffffff',
        padding: 8,
    },
    composer: {
        backgroundColor: '#ffffff',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#e0e0e0',
        paddingTop: 8,
        paddingBottom: 8,
        paddingLeft: 12,
        paddingRight: 12,
        marginLeft: 0,
        maxHeight: 100,
        minHeight: 40,
    },
    placeholderText: {
        color: '#b2b2b2',
    },
    inputPrimary: {
        alignItems: 'center',
    },
    sendButtonContainer: {
        marginRight: 10,
        marginBottom: 5,
        justifyContent: 'center',
        alignItems: 'center',
    },
    phoneContainer: {
        marginVertical: 2,
    },
    phoneRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
    },
});

export default ChatRoom;