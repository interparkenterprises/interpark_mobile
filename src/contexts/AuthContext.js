// contexts/AuthContext.js
import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { BACKEND_URL } from '@env';

const AuthContext = createContext({});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Check for existing auth data on app startup
  useEffect(() => {
    checkAuthState();
  }, []);

  const checkAuthState = async () => {
    try {
      setIsLoading(true);
      
      // Get stored auth data
      const storedToken = await AsyncStorage.getItem('auth_token');
      const storedUser = await AsyncStorage.getItem('user');
      
      if (storedToken && storedUser) {
        console.log('Found stored auth data, validating...');
        
        // Validate token with backend
        const isValid = await validateToken(storedToken);
        
        if (isValid) {
          console.log('Token is valid, logging user in automatically');
          const userData = JSON.parse(storedUser);
          setToken(storedToken);
          setUser(userData);
          setIsAuthenticated(true);
          
          // Set default axios header for future requests
          axios.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
        } else {
          console.log('Token is invalid, clearing stored data');
          await clearAuthData();
        }
      } else {
        console.log('No stored auth data found');
      }
    } catch (error) {
      console.error('Error checking auth state:', error);
      await clearAuthData();
    } finally {
      setIsLoading(false);
    }
  };

  const validateToken = async (tokenToValidate) => {
    try {
      const backendUrl = BACKEND_URL || 'https://interpark-backend.onrender.com';
      
      const response = await axios.get(
        `${backendUrl}/api/auth/validate-token`,
        {
          headers: {
            Authorization: `Bearer ${tokenToValidate}`,
          },
          timeout: 10000,
        }
      );
      
      return response.status === 200;
    } catch (error) {
      console.error('Token validation failed:', error);
      return false;
    }
  };

  // Updated login function to handle both parameter styles
  const login = async (tokenOrAuthData, userData = null) => {
    try {
      let authToken, userInfo;
      
      // Handle both calling styles:
      // 1. login({ token, user }) - object style
      // 2. login(token, userData) - separate parameters style
      if (typeof tokenOrAuthData === 'object' && tokenOrAuthData !== null) {
        // Object style: { token, user }
        authToken = tokenOrAuthData.token;
        userInfo = tokenOrAuthData.user;
      } else {
        // Separate parameters style: (token, userData)
        authToken = tokenOrAuthData;
        userInfo = userData;
      }
      
      // Validate that we have both token and user data
      if (!authToken) {
        throw new Error('No authentication token provided');
      }
      
      if (!userInfo) {
        throw new Error('No user data provided');
      }
      
      // Validate user data structure
      if (!userInfo.id && !userInfo._id) {
        throw new Error('Invalid user data: missing user ID');
      }
      
      console.log('Storing auth data - Token:', !!authToken, 'User:', !!userInfo);
      
      // Store auth data
      await AsyncStorage.setItem('auth_token', authToken);
      await AsyncStorage.setItem('user', JSON.stringify(userInfo));
      await AsyncStorage.setItem('userId', userInfo.id || userInfo._id);
      
      // Update state
      setToken(authToken);
      setUser(userInfo);
      setIsAuthenticated(true);
      
      // Set default axios header
      axios.defaults.headers.common['Authorization'] = `Bearer ${authToken}`;
      
      console.log('Auth state updated successfully');
      
      // Preload chat rooms
      try {
        const backendUrl = BACKEND_URL || 'https://interpark-backend.onrender.com';
        const roomsRes = await axios.get(
          `${backendUrl}/api/chat/rooms/${userInfo.id || userInfo._id}`,
          { 
            headers: { Authorization: `Bearer ${authToken}` },
            timeout: 10000
          }
        );
        await AsyncStorage.setItem('userChatRooms', JSON.stringify(roomsRes.data));
        console.log('Chat rooms preloaded successfully');
      } catch (err) {
        console.warn('Could not preload chat rooms:', err);
      }
      
      return true;
    } catch (error) {
      console.error('Login error in AuthContext:', error);
      // Clear any partial data that might have been stored
      await clearAuthData();
      return false;
    }
  };

  const logout = async () => {
    try {
      await clearAuthData();
      console.log('User logged out successfully');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const clearAuthData = async () => {
    try {
      // Clear AsyncStorage
      await AsyncStorage.multiRemove([
        'auth_token',
        'user',
        'userId',
        'userChatRooms'
      ]);
      
      // Clear axios default header
      delete axios.defaults.headers.common['Authorization'];
      
      // Reset state
      setToken(null);
      setUser(null);
      setIsAuthenticated(false);
      
      console.log('Auth data cleared successfully');
    } catch (error) {
      console.error('Error clearing auth data:', error);
    }
  };

  const value = {
    user,
    token,
    isLoading,
    isAuthenticated,
    login,
    logout,
    checkAuthState,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
