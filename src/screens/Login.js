// Login.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Alert,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Linking,
  Platform,
} from 'react-native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import * as WebBrowser from 'expo-web-browser';
import Constants from 'expo-constants';
import { EXPO_PUBLIC_API_BASE_URL, GOOGLE_WEB_CLIENT_ID, BACKEND_URL } from '@env';

WebBrowser.maybeCompleteAuthSession();

// Cross-platform base64 encoding function
const base64Encode = (str) => {
  try {
    // For Expo Go and development
    if (typeof btoa !== 'undefined') {
      return btoa(unescape(encodeURIComponent(str)));
    }
    
    // For React Native production builds
    if (typeof Buffer !== 'undefined') {
      return Buffer.from(str, 'utf8').toString('base64');
    }
    
    // Fallback manual implementation
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    let result = '';
    let i = 0;
    
    // Convert string to UTF-8 bytes
    const utf8Bytes = unescape(encodeURIComponent(str));
    
    while (i < utf8Bytes.length) {
      const a = utf8Bytes.charCodeAt(i++);
      const b = i < utf8Bytes.length ? utf8Bytes.charCodeAt(i++) : 0;
      const c = i < utf8Bytes.length ? utf8Bytes.charCodeAt(i++) : 0;
      
      const bitmap = (a << 16) | (b << 8) | c;
      
      result += chars.charAt((bitmap >> 18) & 63);
      result += chars.charAt((bitmap >> 12) & 63);
      result += i - 2 < utf8Bytes.length ? chars.charAt((bitmap >> 6) & 63) : '=';
      result += i - 1 < utf8Bytes.length ? chars.charAt(bitmap & 63) : '=';
    }
    
    return result;
  } catch (error) {
    console.error('Base64 encoding error:', error);
    // Simple fallback - just URL encode the string
    return encodeURIComponent(str);
  }
};

// Helper function to clean role string (same as Register.js)
const cleanRole = (roleString) => {
  if (!roleString) return null;
  
  // Remove any trailing characters like #, &, whitespace, etc.
  const cleaned = roleString.trim().replace(/[#&\s]+$/, '');
  
  console.log('Cleaning role:', roleString, '->', cleaned);
  
  // Validate the cleaned role
  if (['CLIENT', 'AGENT_LANDLORD'].includes(cleaned)) {
    return cleaned;
  }
  
  console.warn('Invalid role after cleaning:', cleaned);
  return null;
};

export default function Login({ navigation }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isPasswordVisible, setPasswordVisible] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [isPasswordFocused, setIsPasswordFocused] = useState(false);

  // Enhanced deep linking handler
  const handleDeepLink = async (event) => {
    let url;
    
    if (typeof event === 'string') {
      url = event;
    } else if (event && event.url) {
      url = event.url;
    } else {
      console.log('No URL found in deep link event');
      return;
    }

    console.log('Processing deep link:', url);
    
    // Handle both interpark:// and https:// schemes
    if (url.includes('google-auth') || url.includes('interpark://')) {
      try {
        let params;
        
        if (url.includes('?')) {
          // Split by ? and get the query part, then split by # to remove any fragments
          const urlParts = url.split('?');
          const queryPart = urlParts[1];
          
          // Remove any URL fragments (everything after #)
          const cleanQueryPart = queryPart.split('#')[0];
          
          console.log('Original query part:', queryPart);
          console.log('Cleaned query part:', cleanQueryPart);
          
          params = new URLSearchParams(cleanQueryPart);
        } else {
          console.log('No query parameters found in URL');
          return;
        }
        
        const token = params.get('token');
        const roleFromUrl = params.get('role');
        const error = params.get('error');
        
        if (error) {
          console.error('OAuth error:', error);
          Alert.alert('Authentication Error', error);
          return;
        }
        
        console.log('Extracted token:', token);
        console.log('Extracted role from URL (raw):', roleFromUrl);
        
        if (token) {
          // Clean the role from URL if present
          const cleanedRoleFromUrl = cleanRole(roleFromUrl);
          console.log('Cleaned role from URL:', cleanedRoleFromUrl);
          
          await handleGoogleToken(token, cleanedRoleFromUrl);
        } else {
          console.log('No token found in deep link');
          Alert.alert('Error', 'No authentication token received');
        }
      } catch (error) {
        console.error('Error processing deep link:', error);
        Alert.alert('Error', 'Failed to process authentication');
      }
    }
  };

  useEffect(() => {
    let subscription;

    // Set up the linking event listener
    const setupLinking = async () => {
      subscription = Linking.addEventListener('url', handleDeepLink);

      // Check if app was opened via deep link
      try {
        const initialUrl = await Linking.getInitialURL();
        if (initialUrl) {
          console.log('Initial URL:', initialUrl);
          if (initialUrl.includes('google-auth') || initialUrl.includes('interpark://')) {
            handleDeepLink(initialUrl);
          }
        }
      } catch (error) {
        console.error('Error getting initial URL:', error);
      }
    };

    setupLinking();

    return () => {
      if (subscription) {
        subscription.remove();
      }
    };
  }, []);

  // Called once we get idToken from the deep link
  const handleGoogleToken = async (idToken, roleFromUrl = null) => {
    console.log('Handling Google token for login with role from URL:', roleFromUrl);
    setGoogleLoading(true);
    
    try {
      console.log('Sending token to backend...');
      
      // For login, we don't need to specify a role if the user already exists
      // The backend will use the existing user's role from the database
      // Only send role if it's explicitly provided from the URL (for registration flow)
      const requestBody = { idToken };
      if (roleFromUrl) {
        requestBody.role = roleFromUrl;
      }
      
      console.log('Request body:', requestBody);
      
      const response = await axios.post(
        `${BACKEND_URL || 'https://interpark-backend.onrender.com'}/api/auth/google`,
        requestBody,
        {
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: 15000,
        }
      );

      console.log('Google auth response:', response.data);

      if (response.data.token) {
        // Save auth data
        await AsyncStorage.setItem('auth_token', response.data.token);
        await AsyncStorage.setItem('user', JSON.stringify(response.data.user));
        await AsyncStorage.setItem('userId', response.data.user.id || response.data.user._id);

        // Preload chat rooms
        try {
          const roomsRes = await axios.get(
            `${BACKEND_URL || 'https://interpark-backend.onrender.com'}/api/chat/rooms/${response.data.user.id || response.data.user._id}`,
            { 
              headers: { Authorization: `Bearer ${response.data.token}` },
              timeout: 10000
            }
          );
          await AsyncStorage.setItem('userChatRooms', JSON.stringify(roomsRes.data));
        } catch (err) {
          console.warn('Could not preload chat rooms:', err);
        }

        Alert.alert(
          'Welcome!', 
          response.data.message || 'Google login successful',
          [
            {
              text: 'OK',
              onPress: () => {
                // Navigate to appropriate dashboard based on user role from backend
                const dashboardRoute = response.data.user.role === 'CLIENT' ? 'ClientDashboard' : 'AgentDashboard';
                console.log('Navigating to:', dashboardRoute, 'for user role:', response.data.user.role);
                navigation.replace(dashboardRoute);
              }
            }
          ]
        );
      } else {
        throw new Error('No token received from server');
      }
    } catch (error) {
      console.error('Google login error:', error);
      let errorMessage = 'Failed to authenticate with Google';
      
      if (error.response) {
        console.log('Error response status:', error.response.status);
        console.log('Error response data:', error.response.data);
        errorMessage = error.response.data.error || error.response.data.message || errorMessage;
      } else if (error.request) {
        console.log('Error request:', error.request);
        errorMessage = 'No response from server. Please check your internet connection.';
      } else {
        console.log('Error message:', error.message);
        errorMessage = error.message;
      }
      
      Alert.alert('Google Login Failed', errorMessage);
    } finally {
      setGoogleLoading(false);
    }
  };

  // Enhanced Google sign-in with better error handling
  const handleGoogleSignIn = async () => {
    console.log('Starting Google sign-in for login');
    setGoogleLoading(true);
    
    try {
      // Check if we're in development or production
      const isDev = __DEV__ || Constants.executionEnvironment === 'storeClient';
      
      // For login, we use a special state to indicate this is a login attempt
      // We don't specify a role since we want to use whatever role the user already has
      const state = JSON.stringify({ 
        action: 'login', // Distinguish from registration
        platform: Platform.OS,
        isDev: isDev,
        timestamp: Date.now()
      });
      
      // Use our cross-platform base64 encoding function
      const encodedState = base64Encode(state);
      
      console.log('State object:', state);
      console.log('Encoded state:', encodedState);
      
      const backendUrl = BACKEND_URL || 'https://interpark-backend.onrender.com';
      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
        `client_id=${GOOGLE_WEB_CLIENT_ID}&` +
        `redirect_uri=${encodeURIComponent(`${backendUrl}/api/auth/google-callback`)}&` +
        `response_type=code&` +
        `scope=openid%20profile%20email&` +
        `state=${encodedState}&` +
        `prompt=select_account`;

      console.log('Opening Google auth URL:', authUrl);
      console.log('Environment check - __DEV__:', __DEV__, 'Platform:', Platform.OS);
      console.log('Constants.executionEnvironment:', Constants.executionEnvironment);
      
      await WebBrowser.warmUpAsync();
      
      const result = await WebBrowser.openAuthSessionAsync(
        authUrl, 
        'interpark://',
        {
          showInRecents: true,
        }
      );
      
      console.log('WebBrowser result:', result);
      
      if (result.type === 'success' && result.url) {
        await handleDeepLink(result.url);
      } else if (result.type === 'cancel') {
        console.log('User cancelled Google sign-in');
        Alert.alert('Cancelled', 'Google sign-in was cancelled');
      } else {
        console.log('Google sign-in result:', result);
        Alert.alert('Error', 'Failed to complete Google sign-in');
      }
    } catch (error) {
      console.error('Google sign-in error:', error);
      Alert.alert('Error', `Failed to initiate Google sign-in: ${error.message}`);
    } finally {
      await WebBrowser.coolDownAsync();
      setGoogleLoading(false);
    }
  };

  // Regular (username/password) login
  const handleLogin = async () => {
    if (!username || !password) {
      return Alert.alert('Error', 'Both fields are required');
    }
    setLoading(true);
    try {
      const backendUrl = BACKEND_URL || 'https://interpark-backend.onrender.com';
      
      const { data } = await axios.post(
        `${backendUrl}/api/auth/login`,
        { username, password },
        { timeout: 10000 }
      );

      await AsyncStorage.setItem('auth_token', data.token);
      await AsyncStorage.setItem('user', JSON.stringify(data.user));
      await AsyncStorage.setItem('userId', data.user.id || data.user._id);

      // Preload chat rooms
      try {
        const roomsRes = await axios.get(
          `${backendUrl}/api/chat/rooms/${data.user.id || data.user._id}`,
          { 
            headers: { Authorization: `Bearer ${data.token}` },
            timeout: 10000
          }
        );
        await AsyncStorage.setItem('userChatRooms', JSON.stringify(roomsRes.data));
      } catch (err) {
        console.warn('Could not preload chat rooms:', err);
      }

      navigation.replace(
        data.user.role === 'CLIENT' ? 'ClientDashboard' : 'AgentDashboard'
      );
    } catch (err) {
      console.error(err);
      Alert.alert('Login Failed', err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  // Toggle password visibility handler
  const togglePasswordVisibility = () => {
    setPasswordVisible(!isPasswordVisible);
  };

  // Password input handlers
  const handlePasswordFocus = () => {
    setIsPasswordFocused(true);
  };

  const handlePasswordBlur = () => {
    setIsPasswordFocused(false);
  };

  return (
    <View style={styles.container}>
      <Image source={require('../../assets/logo.png')} style={styles.logo} />
      <Text style={styles.welcomeText}>Welcome Back</Text>

      <TextInput
        style={styles.input}
        placeholder="Username or Email"
        placeholderTextColor="black"
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="username"
      />
      
      <View style={[
        styles.passwordContainer,
        isPasswordFocused && styles.passwordContainerFocused
      ]}>
        <TextInput
          style={styles.passwordInput}
          placeholder="Password"
          placeholderTextColor="black"
          value={password}
          onChangeText={setPassword}
          secureTextEntry={!isPasswordVisible}
          onFocus={handlePasswordFocus}
          onBlur={handlePasswordBlur}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="password"
          textContentType="password"
          passwordRules="minlength: 6;"
          // Force re-render to fix visibility issues
          key={`password-${isPasswordVisible}`}
          // Additional props to ensure proper behavior
          enablesReturnKeyAutomatically={true}
          returnKeyType="done"
          clearButtonMode="never"
          // Ensure proper text rendering
          allowFontScaling={true}
          // Fix for Android APK builds
          underlineColorAndroid="transparent"
        />
        <TouchableOpacity
          onPress={togglePasswordVisibility}
          style={styles.eyeIcon}
          activeOpacity={0.7}
        >
          <Icon 
            name={isPasswordVisible ? 'eye' : 'eye-off'} 
            size={24} 
            color="#666" 
          />
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        onPress={() => navigation.navigate('ForgotPassword')}
        style={styles.forgotPasswordLink}
      >
        <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.loginButton,
          loading && styles.disabledButton
        ]}
        onPress={handleLogin}
        disabled={loading}
        activeOpacity={0.8}
      >
        {loading ? (
          <ActivityIndicator size="small" color="white" />
        ) : (
          <Text style={styles.buttonText}>Login</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.googleButton,
          googleLoading && styles.disabledButton
        ]}
        onPress={handleGoogleSignIn}
        disabled={googleLoading}
        activeOpacity={0.8}
      >
        {googleLoading ? (
          <ActivityIndicator size="small" color="white" />
        ) : (
          <>
            <Text style={styles.googleButtonText}>Login with Google</Text>
            <Image
              source={require('../../assets/google-logo-icon.png')}
              style={styles.googleIcon}
            />
          </>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.registerLink}
        onPress={() => navigation.navigate('Register')}
        activeOpacity={0.7}
      >
        <Text style={styles.registerText}>Don't have an account? Register</Text>
      </TouchableOpacity>
      
      {/* Debug info - remove in production */}
      {/*  
      {__DEV__ && (
        <View style={styles.debugContainer}>
          <Text style={styles.debugText}>Debug: Login Mode</Text>
        </View>
      )}*/}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#B0B0B0',
  },
  logo: {
    width: 150,
    height: 150,
    alignSelf: 'center',
    marginBottom: 30,
    resizeMode: 'contain',
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
    color: '#005478',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    backgroundColor: 'white',
    marginBottom: 15,
    fontSize: 16,
    color: '#000',
    // Ensure proper text rendering on Android
    textAlignVertical: 'center',
  },
  passwordContainer: {
    position: 'relative',
    marginBottom: 5,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    backgroundColor: 'white',
    flexDirection: 'row',
    alignItems: 'center',
  },
  passwordContainerFocused: {
    borderColor: '#005478',
    borderWidth: 2,
  },
  passwordInput: {
    flex: 1,
    padding: 12,
    fontSize: 16,
    color: '#000',
    backgroundColor: 'transparent',
    // Remove default styling that might interfere
    borderWidth: 0,
    // Ensure proper text rendering on Android
    textAlignVertical: 'center',
    // Fix for secure text entry visibility
    fontFamily: Platform.OS === 'android' ? 'monospace' : 'System',
  },
  eyeIcon: {
    position: 'absolute',
    right: 12,
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  forgotPasswordLink: {
    alignSelf: 'flex-end',
    marginBottom: 15,
    paddingVertical: 5,
  },
  forgotPasswordText: {
    color: '#005478',
    fontSize: 14,
    textDecorationLine: 'underline',
  },
  loginButton: {
    backgroundColor: '#005478',
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 15,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4285F4',
    paddingVertical: 15,
    borderRadius: 8,
    marginBottom: 15,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  googleButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  googleIcon: {
    width: 24,
    height: 24,
    marginLeft: 10,
  },
  registerLink: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  registerText: {
    color: '#005478',
    fontSize: 16,
    textDecorationLine: 'underline',
  },
  disabledButton: {
    opacity: 0.6,
  },
  debugContainer: {
    marginTop: 20,
    padding: 10,
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderRadius: 5,
  },
  debugText: {
    fontSize: 12,
    color: '#333',
  },
});
