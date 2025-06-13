import React, { useEffect, useState, useCallback } from 'react';
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

    // Safe navigation handler
    const handleBackPress = useCallback(() => {
        try {
            console.log('Back button pressed');
            console.log('Can go back:', navigation.canGoBack());
            
            // Disconnect socket before navigation
            if (socket) {
                socket.disconnect();
            }
            
            // Check if we can go back safely
            if (navigation.canGoBack()) {
                navigation.goBack();
            } else {
                // If we can't go back, navigate to a specific safe screen
                // Replace 'Properties' with your actual Properties screen name
                navigation.navigate('Properties');
            }
        } catch (error) {
            console.error('Navigation error:', error);
            
            // Show user feedback and provide fallback
            Alert.alert(
                'Navigation Error', 
                'Returning to main screen.',
                [
                    {
                        text: 'OK',
                        onPress: () => {
                            try {
                                // Reset navigation stack as fallback
                                navigation.reset({
                                    index: 0,
                                    routes: [{ name: 'Properties' }], // Replace with your main screen name
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
    }, [navigation, socket]);

    // Handle hardware back button (Android)
    useEffect(() => {
        const backAction = () => {
            handleBackPress();
            return true; // Prevent default behavior
        };

        const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);

        return () => {
            backHandler.remove();
        };
    }, [handleBackPress]);

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
        if (socket) {
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
        }

        // Cleanup function
        return () => {
            if (socket) {
                socket.off('receive_message');
                socket.disconnect();
            }
        };
    }, [chatRoomId, userType, agentLandlordId, clientId, socket]);

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
            if (socket) {
                socket.emit('send_message', fullMessage);
            }
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
                <TouchableOpacity onPress={handleBackPress} style={styles.backIconContainer}>
                    <Icon name="arrow-back" size={24} color="#ffffff" />
                </TouchableOpacity>
                
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
