import React, { useEffect, useState, useCallback, useRef } from 'react';
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
    Linking,
    BackHandler,
    AppState
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Ionicons';
import axios from 'axios';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { EXPO_PUBLIC_API_BASE_URL } from '@env';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Configure notifications
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
    }),
});

const ChatRoom = ({ route }) => {
    const navigation = useNavigation();
    const { chatRoomId, clientId, agentLandlordId, userType } = route.params || {};
    const [messages, setMessages] = useState([]);
    const [profileInfo, setProfileInfo] = useState(null);
    const [isProfileVisible, setIsProfileVisible] = useState(false);
    const [showBackButton, setShowBackButton] = useState(false);
    const [isTyping, setIsTyping] = useState(false);
    const [inputText, setInputText] = useState(''); // Add input text state
    const animation = useState(new Animated.Value(0))[0];
    const visitCountRef = useRef(0);
    const socketRef = useRef(null);
    const messageIdsRef = useRef(new Set());
    const typingTimeoutRef = useRef(null);
    const reconnectTimeoutRef = useRef(null);
    const appState = useRef(AppState.currentState);

    const currentUserId = userType === 'agent' ? agentLandlordId : clientId;

    // Initialize socket connection with better error handling
    const initializeSocket = useCallback(() => {
        if (socketRef.current?.connected) return;

        socketRef.current = io('https://interpark-backend.onrender.com', {
            transports: ['websocket', 'polling'],
            timeout: 5000,
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000,
        });

        socketRef.current.on('connect', () => {
            console.log('Socket connected:', socketRef.current.id);
            
            // Register user and join room
            socketRef.current.emit('register_user', currentUserId);
            if (chatRoomId) {
                socketRef.current.emit('join_room', chatRoomId);
            }
        });

        socketRef.current.on('connect_error', (error) => {
            console.error('Socket connection error:', error);
        });

        socketRef.current.on('disconnect', (reason) => {
            console.log('Socket disconnected:', reason);
            
            // Attempt to reconnect after a delay
            if (reason === 'io server disconnect') {
                reconnectTimeoutRef.current = setTimeout(() => {
                    initializeSocket();
                }, 2000);
            }
        });

        socketRef.current.on('receive_message', (incomingMessage) => {
            console.log('Received message:', incomingMessage);
            
            // Prevent duplicate messages
            if (messageIdsRef.current.has(incomingMessage.id)) {
                console.log('Duplicate message ignored:', incomingMessage.id);
                return;
            }

            messageIdsRef.current.add(incomingMessage.id);

            const newMessage = {
                _id: incomingMessage.id,
                text: incomingMessage.content,
                createdAt: new Date(incomingMessage.timestamp),
                user: { _id: incomingMessage.senderId },
            };
            
            setMessages(prevMessages => {
                // Double-check for duplicates in the current message list
                const exists = prevMessages.some(msg => msg._id === incomingMessage.id);
                if (exists) {
                    console.log('Message already exists in state:', incomingMessage.id);
                    return prevMessages;
                }
                
                return GiftedChat.prepend(prevMessages, newMessage);
            });
        });

        socketRef.current.on('user_typing', (data) => {
            if (data.userId !== currentUserId) {
                setIsTyping(true);
            }
        });

        socketRef.current.on('user_stop_typing', (data) => {
            if (data.userId !== currentUserId) {
                setIsTyping(false);
            }
        });

        socketRef.current.on('message_error', (error) => {
            console.error('Message error:', error);
            Alert.alert('Error', 'Failed to send message. Please try again.');
        });

    }, [currentUserId, chatRoomId]);

    // Handle app state changes
    useEffect(() => {
        const handleAppStateChange = (nextAppState) => {
            if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
                // App came to foreground - reconnect socket if needed
                if (!socketRef.current?.connected) {
                    initializeSocket();
                }
            }
            appState.current = nextAppState;
        };

        const subscription = AppState.addEventListener('change', handleAppStateChange);
        return () => subscription?.remove();
    }, [initializeSocket]);

    // Initialize socket on component mount
    useEffect(() => {
        initializeSocket();
        
        return () => {
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
            }
            if (socketRef.current) {
                socketRef.current.disconnect();
                socketRef.current = null;
            }
        };
    }, [initializeSocket]);

    // Register for push notifications
    useEffect(() => {
        const registerForPushNotifications = async () => {
            try {
                if (Platform.OS === 'android') {
                    await Notifications.setNotificationChannelAsync('chat-messages', {
                        name: 'Chat Messages',
                        importance: Notifications.AndroidImportance.HIGH,
                        vibrationPattern: [0, 250, 250, 250],
                        lightColor: '#FF231F7C',
                    });
                }

                if (Device.isDevice) {
                    const { status: existingStatus } = await Notifications.getPermissionsAsync();
                    let finalStatus = existingStatus;
                    
                    if (existingStatus !== 'granted') {
                        const { status } = await Notifications.requestPermissionsAsync();
                        finalStatus = status;
                    }
                    
                    if (finalStatus !== 'granted') {
                        console.log('Failed to get push token for push notification!');
                        return;
                    }
                    
                    const token = (await Notifications.getExpoPushTokenAsync()).data;
                    console.log('Push token:', token);
                    
                    // Register token with backend
                    try {
                        await axios.post('https://interpark-backend.onrender.com/api/notifications/register', {
                            userId: currentUserId,
                            token: token
                        });
                        console.log('Push token registered successfully');
                    } catch (error) {
                        //console.error('Error registering push token:', error);
                    }
                }
            } catch (error) {
                console.error('Error setting up push notifications:', error);
            }
        };

        registerForPushNotifications();
    }, [currentUserId]);

    // Track page visits to show/hide back button
    useFocusEffect(
        useCallback(() => {
            visitCountRef.current += 1;
            
            if (visitCountRef.current > 1) {
                setShowBackButton(true);
            }
            
            return () => {
                // Cleanup on unfocus if needed
            };
        }, [])
    );

    // Safe navigation handler
    const handleBackPress = useCallback(() => {
        try {
            // Disconnect socket before navigation
            if (socketRef.current) {
                socketRef.current.disconnect();
                socketRef.current = null;
            }
            
            if (navigation.canGoBack()) {
                navigation.goBack();
            } else {
                navigation.navigate('PropertiesList');
            }
        } catch (error) {
            console.error('Navigation error:', error);
            Alert.alert(
                'Navigation Response', 
                'Returning to main screen.',
                [{
                    text: 'OK',
                    onPress: () => {
                        try {
                            navigation.reset({
                                index: 0,
                                routes: [{ name: 'PropertiesList' }],
                            });
                        } catch (resetError) {
                            console.error('Reset navigation error:', resetError);
                            BackHandler.exitApp();
                        }
                    }
                }]
            );
        }
    }, [navigation]);

    // Handle hardware back button (Android)
    useEffect(() => {
        const backAction = () => {
            if (showBackButton) {
                handleBackPress();
            }
            return true;
        };

        const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
        return () => backHandler.remove();
    }, [handleBackPress, showBackButton]);

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

    // Fetch messages and profile data
    useEffect(() => {
        if (!chatRoomId) {
            Alert.alert('Info', 'No Conversations have been initiated yet.');
            return;
        }

        const fetchMessages = async () => {
            try {
                const response = await axios.get(`https://interpark-backend.onrender.com/api/chat/${chatRoomId}/messages`);
                const formattedMessages = response.data.map((msg) => {
                    messageIdsRef.current.add(msg.id); // Track message IDs
                    return {
                        _id: msg.id,
                        text: msg.content,
                        createdAt: new Date(msg.timestamp),
                        user: { _id: msg.senderId },
                    };
                });
                setMessages(formattedMessages);
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
    }, [chatRoomId, userType, agentLandlordId, clientId]);

    // Handle typing indicators - Updated to only handle typing notifications
    const handleTypingIndicator = useCallback((text) => {
        if (!socketRef.current?.connected) return;

        if (text.length > 0) {
            socketRef.current.emit('typing_start', {
                userId: currentUserId,
                chatRoomId: chatRoomId
            });

            // Clear existing timeout and set new one
            if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current);
            }

            typingTimeoutRef.current = setTimeout(() => {
                socketRef.current.emit('typing_stop', {
                    userId: currentUserId,
                    chatRoomId: chatRoomId
                });
            }, 1000);
        } else {
            socketRef.current.emit('typing_stop', {
                userId: currentUserId,
                chatRoomId: chatRoomId
            });
        }
    }, [currentUserId, chatRoomId]);

    // Handle input text changes
    const handleInputTextChanged = useCallback((text) => {
        setInputText(text);
        handleTypingIndicator(text);
    }, [handleTypingIndicator]);

    const onSend = useCallback(async (newMessages = []) => {
        const message = newMessages[0];
        
        // Clear the input text
        setInputText('');
        
        // Generate unique temporary ID
        const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        const instantMessage = {
            ...message,
            _id: tempId,
            user: { _id: currentUserId },
            pending: true
        };
        
        // Show message immediately in UI
        setMessages((prevMessages) => GiftedChat.prepend(prevMessages, instantMessage));

        const fullMessage = {
            chatRoomId: chatRoomId,
            senderId: currentUserId,
            content: message.text,
        };

        try {
            // Send via socket for real-time delivery
            if (socketRef.current?.connected) {
                socketRef.current.emit('send_message', fullMessage);
            } else {
                throw new Error('Socket not connected');
            }

            // Remove the temporary message after successful send
            setTimeout(() => {
                setMessages(prevMessages => 
                    prevMessages.filter(msg => msg._id !== tempId)
                );
            }, 1000);

        } catch (error) {
            console.error('Error sending message:', error);
            
            // Mark message as failed
            setMessages(prevMessages => 
                prevMessages.map(msg => 
                    msg._id === tempId 
                        ? { ...msg, pending: false, failed: true }
                        : msg
                )
            );
            
            Alert.alert('Error', 'Failed to send message. Please check your connection.');
        }
    }, [currentUserId, chatRoomId]);

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

    const renderMessage = (props) => {
        const isSentByCurrentUser = props.currentMessage.user._id === currentUserId;
        const isFailed = props.currentMessage.failed;
        const isPending = props.currentMessage.pending;
        
        return (
            <View style={[
                isSentByCurrentUser ? styles.sentMessage : styles.receivedMessage,
                isFailed && styles.failedMessage,
                isPending && styles.pendingMessage
            ]}>
                <Text style={[
                    styles.messageText,
                    isSentByCurrentUser && styles.sentMessageText
                ]}>
                    {props.currentMessage.text}
                </Text>
                {isFailed && <Text style={styles.failedText}>Failed to send</Text>}
                {isPending && <Text style={styles.pendingText}>Sending...</Text>}
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
            text={inputText}
            onTextChanged={handleInputTextChanged}
        />
    );
    
    const renderSend = (props) => (
        <Send {...props}>
            <View style={styles.sendButtonContainer}>
                <Icon name="send" size={24} color="#005478" />
            </View>
        </Send>
    );

    // Render typing indicator
    const renderFooter = () => {
        if (isTyping) {
            return (
                <View style={styles.typingContainer}>
                    <Text style={styles.typingText}>Typing...</Text>
                </View>
            );
        }
        return null;
    };

    // Early return for no chat room
    if (!chatRoomId) {
        return (
            <View style={styles.noConversation}>
                <Text>No Conversations have been initiated yet.</Text>
                <TouchableOpacity 
                    style={styles.backButton} 
                    onPress={handleBackPress}
                >
                    <Text style={styles.backButtonText}>Go Back</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                {showBackButton && (
                    <TouchableOpacity onPress={handleBackPress} style={styles.backIconContainer}>
                        <Icon name="arrow-back" size={24} color="#ffffff" />
                    </TouchableOpacity>
                )}
                
                <View style={styles.headerRow}>
                    <TouchableOpacity onPress={toggleProfileVisibility}>
                        <Text style={styles.headerText}>
                            {isAgent ? 'Chatting with Client' : 'Chatting with Agent'}
                        </Text>
                    </TouchableOpacity>
                    
                    {!isAgent && profileInfo?.phoneNumber && (
                        <TouchableOpacity 
                            onPress={() => handlePhoneCall(profileInfo.phoneNumber)}
                            style={styles.callIconContainer}
                        >
                            <Icon name="call-outline" size={20} color="#ffffff" />
                        </TouchableOpacity>
                    )}
                </View>
                
                <Animated.View style={{ height: profileHeight, overflow: 'hidden' }}>
                    {profileInfo && (
                        <View style={styles.profileContainer}>
                            {isAgent ? (
                                <>
                                    <Text style={styles.profileText}>Client: {profileInfo.user?.username || 'Unknown'}</Text>
                                    <Text style={styles.profileText}>UserID: {profileInfo.user?.id || 'Unknown'}</Text>
                                    <Text style={styles.profileText}>Email: {profileInfo.user?.email || 'Unknown'}</Text>
                                    {profileInfo.user?.avatar && (
                                        <Image
                                            source={{ uri: profileInfo.user.avatar }}
                                            style={styles.avatar}
                                        />
                                    )}
                                </>
                            ) : (
                                <>
                                    <Text style={styles.profileText}>Agent: {profileInfo.user?.username || 'Unknown'}</Text>
                                    <TouchableOpacity 
                                        onPress={() => handlePhoneCall(profileInfo.phoneNumber)}
                                        style={styles.phoneContainer}
                                    >
                                        <View style={styles.phoneRow}>
                                            <Icon name="call-outline" size={16} color="#ffffff" />
                                            <Text style={styles.profileText}>Phone: {profileInfo.phoneNumber || 'Not available'}</Text>
                                        </View>
                                    </TouchableOpacity>
                                    <Text style={styles.profileText}>Agent ID: {profileInfo.agentNumber || 'Unknown'}</Text>
                                    <Text style={styles.profileText}>Email: {profileInfo.user?.email || 'Unknown'}</Text>
                                    {profileInfo.user?.avatar && (
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
                renderFooter={renderFooter}
                placeholder="Type a message..."
                alwaysShowSend={true}
                text={inputText}
                onInputTextChanged={handleInputTextChanged}
                textInputProps={{
                    maxLength: 1000,
                    enablesReturnKeyAutomatically: true,
                    blurOnSubmit: false,
                    returnKeyType: 'default',
                }}
                keyboardShouldPersistTaps="never"
                bottomOffset={Platform.OS === 'ios' ? 0 : 0}
            />
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
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        width: '100%',
        marginVertical: 5,
    },
    backIconContainer: {
        padding: 8,
        borderRadius: 20,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        marginBottom: 5,
    },
    callIconContainer: {
        padding: 8,
        borderRadius: 20,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
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
    pendingMessage: {
        backgroundColor: '#e6f3ff',
        borderColor: '#005478',
        borderWidth: 1,
        opacity: 0.7,
    },
    messageText: {
        color: 'black',
    },
    sentMessageText: {
        color: 'white',
    },
    failedText: {
        color: '#ff0000',
        fontSize: 12,
        fontStyle: 'italic',
    },
    pendingText: {
        color: '#005478',
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
        backgroundColor: '#E0E0E0',
    },
    backButton: {
        marginTop: 20,
        backgroundColor: '#007AFF',
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 8,
    },
    backButtonText: {
        color: '#ffffff',
        fontSize: 16,
        fontWeight: 'bold',
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
    typingContainer: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        backgroundColor: '#f0f0f0',
    },
    typingText: {
        fontStyle: 'italic',
        color: '#666',
        fontSize: 12,
    },
});

export default ChatRoom;
