import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { Alert } from 'react-native';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [lastRole, setLastRole] = useState(null);
  
  // Chat rooms state for preloading and persistent state management
  const [chatRooms, setChatRooms] = useState([]);
  const [properties, setProperties] = useState({});
  const [unreadCounts, setUnreadCounts] = useState({});
  const [lastMessages, setLastMessages] = useState({});
  const [isLoadingChatRooms, setIsLoadingChatRooms] = useState(false);

  // Check if user is already logged in when app starts
  useEffect(() => {
    checkAuthState();
  }, []);

  const checkAuthState = async () => {
    try {
      setIsLoading(true);
      
      // Check for stored authentication data
      const [storedToken, storedUser, storedRole] = await Promise.all([
        AsyncStorage.getItem('userToken'),
        AsyncStorage.getItem('userData'),
        AsyncStorage.getItem('lastRole')
      ]);

      if (storedToken && storedUser) {
        const userData = JSON.parse(storedUser);
        setUser(userData);
        setIsAuthenticated(true);
        
        if (storedRole) {
          setLastRole(storedRole);
        }

        // Preload chat rooms for returning user
        if (userData.id || userData.userId) {
          await preloadChatRooms(userData.id || userData.userId);
        }
      }
    } catch (error) {
      console.error('Error checking auth state:', error);
      // Clear potentially corrupted data
      await clearAuthData();
    } finally {
      setIsLoading(false);
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

  const preloadChatRooms = async (userId) => {
    try {
      setIsLoadingChatRooms(true);
      console.log('Preloading chat rooms for user:', userId);
      
      // Get stored chat rooms
      const storedChatRooms = await AsyncStorage.getItem('userChatRooms');
      if (storedChatRooms) {
        const parsedChatRooms = JSON.parse(storedChatRooms);
        
        if (parsedChatRooms.length > 0) {
          // Load detailed chat rooms from backend
          const response = await axios.post(
            `https://interpark-backend.onrender.com/api/chat/detailed-rooms`, 
            {
              chatRoomIds: parsedChatRooms.map(room => room.id),
              userId: userId
            },
            {
              timeout: 10000 // 10 second timeout
            }
          );

          if (response.data && response.data.chatRooms) {
            const detailedRooms = response.data.chatRooms;
            const sortedRooms = sortChatRooms(detailedRooms);
            
            setChatRooms(sortedRooms);
            
            // Extract unread counts, last messages, and property data
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
            
            console.log(`Successfully preloaded ${sortedRooms.length} chat rooms`);
          }
        } else {
          console.log('No stored chat rooms found');
          setChatRooms([]);
          setProperties({});
          setUnreadCounts({});
          setLastMessages({});
        }
      } else {
        console.log('No userChatRooms in AsyncStorage');
        setChatRooms([]);
        setProperties({});
        setUnreadCounts({});
        setLastMessages({});
      }
    } catch (error) {
      console.error('Error preloading chat rooms:', error);
      // Don't show alert for preloading errors as it's not critical
      // Just log and continue
      setChatRooms([]);
      setProperties({});
      setUnreadCounts({});
      setLastMessages({});
    } finally {
      setIsLoadingChatRooms(false);
    }
  };

  const login = async (userData) => {
    try {
      console.log('Starting login process with userData:', userData);
      
      // Extract user information
      const { token, user: userInfo, message, role } = userData;
      
      if (!token || !userInfo) {
        throw new Error('Invalid login data received');
      }

      // Prepare user data for storage
      const userDataToStore = {
        id: userInfo.id,
        userId: userInfo.id, // Keep both for compatibility
        username: userInfo.username,
        email: userInfo.email,
        role: userInfo.role || role,
        ...userInfo
      };

      // Store authentication data
      await Promise.all([
        AsyncStorage.setItem('userToken', token),
        AsyncStorage.setItem('userData', JSON.stringify(userDataToStore)),
        AsyncStorage.setItem('userId', userInfo.id.toString()),
        role && AsyncStorage.setItem('lastRole', role)
      ]);

      // Update state
      setUser(userDataToStore);
      setIsAuthenticated(true);
      
      if (role) {
        setLastRole(role);
      }

      console.log('User data stored successfully');

      // Preload chat rooms in background (don't await to avoid blocking login)
      preloadChatRooms(userInfo.id).catch(error => {
        console.error('Background chat room preloading failed:', error);
      });

      return true;
    } catch (error) {
      console.error('Login process error:', error);
      Alert.alert('Login Error', error.message || 'Failed to complete login');
      return false;
    }
  };

  const logout = async () => {
    try {
      console.log('Starting logout process');
      
      // Clear authentication data
      await clearAuthData();
      
      // Clear chat rooms data
      setChatRooms([]);
      setProperties({});
      setUnreadCounts({});
      setLastMessages({});
      
      // Update state
      setUser(null);
      setIsAuthenticated(false);
      
      console.log('Logout completed successfully');
      return true;
    } catch (error) {
      console.error('Logout error:', error);
      Alert.alert('Logout Error', 'Failed to logout properly');
      return false;
    }
  };

  const clearAuthData = async () => {
    try {
      await Promise.all([
        AsyncStorage.removeItem('userToken'),
        AsyncStorage.removeItem('userData'),
        AsyncStorage.removeItem('userId'),
        // Don't remove lastRole as it should persist for next login
      ]);
    } catch (error) {
      console.error('Error clearing auth data:', error);
    }
  };

  // Function to refresh chat rooms (can be called from ChatList)
  const refreshChatRooms = async () => {
    if (user && (user.id || user.userId)) {
      await preloadChatRooms(user.id || user.userId);
    }
  };

  // Function to update chat room (for real-time updates)
  const updateChatRoom = (chatRoomId, updates) => {
    setChatRooms(prevRooms => {
      const roomIndex = prevRooms.findIndex(room => room.id === chatRoomId);
      if (roomIndex >= 0) {
        const updatedRooms = [...prevRooms];
        updatedRooms[roomIndex] = { ...updatedRooms[roomIndex], ...updates };
        return sortChatRooms(updatedRooms);
      }
      return prevRooms;
    });
  };

  // Function to add new chat room
  const addChatRoom = (newRoom) => {
    setChatRooms(prevRooms => {
      // Check if room already exists
      if (prevRooms.find(room => room.id === newRoom.id)) {
        return prevRooms;
      }
      return sortChatRooms([...prevRooms, newRoom]);
    });
  };

  // Function to update unread count
  const updateUnreadCount = (chatRoomId, count) => {
    setUnreadCounts(prev => ({
      ...prev,
      [chatRoomId]: count
    }));
    
    // Also update the chat room with new unread count
    updateChatRoom(chatRoomId, { unreadCount: count });
  };

  // Function to update last message
  const updateLastMessage = (chatRoomId, message, timestamp) => {
    setLastMessages(prev => ({
      ...prev,
      [chatRoomId]: {
        content: message,
        timestamp: timestamp
      }
    }));
    
    // Also update the chat room with new last message data
    updateChatRoom(chatRoomId, { 
      lastMessage: { content: message, timestamp: timestamp },
      lastMessageTime: timestamp
    });
  };

  // Function to update property data
  const updateProperty = (propertyId, title) => {
    setProperties(prev => ({
      ...prev,
      [propertyId]: title
    }));
  };

  // Function to handle chat list updates (from socket)
  const handleChatListUpdate = (data) => {
    updateUnreadCount(data.chatRoomId, data.unreadCount);
    updateLastMessage(data.chatRoomId, data.lastMessage, data.lastMessageTime);
  };

  const contextValue = {
    // User state
    user,
    isAuthenticated,
    isLoading,
    lastRole,
    
    // Chat rooms state
    chatRooms,
    properties,
    unreadCounts,
    lastMessages,
    isLoadingChatRooms,
    
    // Auth functions
    login,
    logout,
    checkAuthState,
    
    // Chat room functions
    preloadChatRooms,
    refreshChatRooms,
    updateChatRoom,
    addChatRoom,
    updateUnreadCount,
    updateLastMessage,
    updateProperty,
    handleChatListUpdate,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
