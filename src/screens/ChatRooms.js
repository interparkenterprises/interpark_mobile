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
    BackHandler
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
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
    const [showBackButton, setShowBackButton] = useState(false);
    const animation = useState(new Animated.Value(0))[0];
    const visitCountRef = useRef(0);
    const socketRef = useRef(null);

    // Initialize socket connection
    useEffect(() => {
        socketRef.current = io('https://interpark-backend.onrender.com');
        return () => {
            if (socketRef.current) {
                socketRef.current.disconnect();
            }
        };
    }, []);

    // Track page visits to show/hide back button
    useFocusEffect(
        useCallback(() => {
            visitCountRef.current += 1;
            
            // Show back button only from second visit onwards
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
            //console.log('Back button pressed');
            //console.log('Can go back:', navigation.canGoBack());
            
            // Disconnect socket before navigation
            if (socketRef.current) {
                socketRef.current.disconnect();
            }
            
            // Check if we can go back safely
            if (navigation.canGoBack()) {
                navigation.goBack();
            } else {
                // If we can't go back, navigate to a specific safe screen
                navigation.navigate('PropertiesList');
            }
        } catch (error) {
            console.error('Navigation error:', error);
            
            // Show user feedback and provide fallback
            Alert.alert(
                'Navigation Response', 
                'Returning to main screen.',
                [
                    {
                        text: 'OK',
                        onPress: () => {
                            try {
                                // Reset navigation stack as fallback
                                navigation.reset({
                                    index: 0,
                                    routes: [{ name: 'PropertiesList' }],
                                });
                            } catch (resetError) {
                                console.error('Reset navigation error:', resetError);
                                // Ultimate fallback - close the app gracefully
                                BackHandler.exitApp();
                            }
                        }
                    }
                ]
            );
        }
    }, [navigation]);

    // Handle hardware back button (Android)
    useEffect(() => {
        const backAction = () => {
            if (showBackButton) {
                handleBackPress();
            }
            return true; // Prevent default behavior
        };

        const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);

        return () => {
            backHandler.remove();
        };
    }, [handleBackPress, showBackButton]);

    useEffect(() => {
        const requestPermissions = async () => {
            if (Platform.OS === 'ios' || (Platform.OS === 'android' && Device.osBuildNumber >= 33)) {
                await Notifications.requestPermissionsAsync();
            }
        };

        requestPermissions();
    }, []);

    const showNotification = async (title, message) => {
        try {
            await Notifications.scheduleNotificationAsync({
                content: {
                    title: title,
                    body: message,
                },
                trigger: null,
            });
        } catch (error) {
            console.error('Notification error:', error);
        }
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
                const formattedMessages = response.data.map((msg) => ({
                    _id: msg.id,
                    text: msg.content,
                    createdAt: new Date(msg.timestamp),
                    user: { _id: msg.senderId },
                }));
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

        // Join socket room
        if (socketRef.current) {
            socketRef.current.emit('join_room', chatRoomId);

            socketRef.current.on('receive_message', (incomingMessage) => {
                const currentUserId = userType === 'agent' ? agentLandlordId : clientId;
                
                // Only show messages from other users (not our own messages)
                if (incomingMessage.senderId !== currentUserId) {
                    console.log('Received message from database:', incomingMessage);
                    
                    const newMessage = {
                        _id: incomingMessage.id,
                        text: incomingMessage.content,
                        createdAt: new Date(incomingMessage.timestamp),
                        user: { _id: incomingMessage.senderId },
                    };
                    
                    setMessages(prevMessages => {
                        // Check if message already exists to prevent duplicates
                        const messageExists = prevMessages.some(msg => 
                            msg._id === incomingMessage.id || 
                            (msg.text === incomingMessage.content && 
                             msg.user._id === incomingMessage.senderId &&
                             Math.abs(new Date(msg.createdAt) - new Date(incomingMessage.timestamp)) < 1000)
                        );
                        
                        if (messageExists) {
                            console.log('Duplicate message detected, ignoring:', incomingMessage);
                            return prevMessages;
                        }
                        
                        return GiftedChat.prepend(prevMessages, newMessage);
                    });
                    
                    // Show notification for messages from others
                    showNotification('New Message', incomingMessage.content);
                } else {
                    // This is our own message coming back from database - just log it
                    console.log('Own message saved to database:', incomingMessage);
                }
            });
        }

        // Cleanup function
        return () => {
            if (socketRef.current) {
                socketRef.current.off('receive_message');
            }
        };
    }, [chatRoomId, userType, agentLandlordId, clientId]);

    const onSend = async (newMessages = []) => {
        const message = newMessages[0];
        const currentUserId = userType === 'agent' ? agentLandlordId : clientId;
        
        const fullMessage = {
            chatRoomId: chatRoomId,
            senderId: currentUserId,
            content: message.text,
        };

        // Show message immediately in UI (instant feedback)
        const instantMessage = {
            ...message,
            _id: `instant_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            user: { _id: currentUserId }
        };
        
        setMessages((prevMessages) => GiftedChat.prepend(prevMessages, instantMessage));

        try {
            // Send to server in background (don't wait for response to show message)
            axios.post(`https://interpark-backend.onrender.com/api/chat/send`, fullMessage)
                .then(response => {
                    console.log('Message saved to database:', response.data);
                    
                    // Update the instant message with the real database ID
                    setMessages(prevMessages => {
                        return prevMessages.map(msg => {
                            if (msg._id === instantMessage._id) {
                                return {
                                    ...msg,
                                    _id: response.data.id,
                                };
                            }
                            return msg;
                        });
                    });
                })
                .catch(error => {
                    console.error('Error saving message to database:', error);
                    // Mark message as failed
                    setMessages(prevMessages => prevMessages.map(msg => 
                        msg._id === instantMessage._id ? {...msg, isFailed: true} : msg
                    ));
                    Alert.alert('Error', 'Failed to send message.');
                });
            
            // Emit via socket for real-time delivery to other users
            if (socketRef.current) {
                socketRef.current.emit('send_message', fullMessage);
            }
            
        } catch (error) {
            console.error('Error sending message:', error);
            // Mark message as failed
            setMessages(prevMessages => prevMessages.map(msg => 
                msg._id === instantMessage._id ? {...msg, isFailed: true} : msg
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
                <Icon name="send" size={24} color="#005478" />
            </View>
        </Send>
    );

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
                    
                    {/* Show call icon only for clients (when chatting with agent) and when profile info is available */}
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
});

export default ChatRoom;
