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
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import * as WebBrowser from 'expo-web-browser';
import Constants from 'expo-constants';
import { EXPO_PUBLIC_API_BASE_URL, GOOGLE_WEB_CLIENT_ID, BACKEND_URL } from '@env';

import { useAuth } from '../contexts/AuthContext'; // Import the auth context

WebBrowser.maybeCompleteAuthSession();

// Cross-platform base64 encoding function
const base64Encode = (str) => {
  try {
    if (typeof btoa !== 'undefined') {
      return btoa(unescape(encodeURIComponent(str)));
    }
    
    if (typeof Buffer !== 'undefined') {
      return Buffer.from(str, 'utf8').toString('base64');
    }
    
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    let result = '';
    let i = 0;
    
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
    return encodeURIComponent(str);
  }
};

const cleanRole = (roleString) => {
  if (!roleString) return null;
  
  const cleaned = roleString.trim().replace(/[#&\s]+$/, '');
  console.log('Cleaning role:', roleString, '->', cleaned);
  
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

  // Use the auth context
  const { login: authLogin } = useAuth();

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
    
    if (url.includes('google-auth') || url.includes('interpark://')) {
      try {
        let params;
        
        if (url.includes('?')) {
          const urlParts = url.split('?');
          const queryPart = urlParts[1];
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

    const setupLinking = async () => {
      subscription = Linking.addEventListener('url', handleDeepLink);

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
        // Use the auth context login function
        const loginSuccess = await authLogin(response.data);
        
        if (loginSuccess) {
          Alert.alert(
            'Welcome!', 
            response.data.message || 'Google login successful'
          );
          // Navigation will be handled automatically by AppNavigator
        } else {
          throw new Error('Failed to complete login process');
        }
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
      const isDev = __DEV__ || Constants.executionEnvironment === 'storeClient';
      
      const state = JSON.stringify({ 
        action: 'login',
        platform: Platform.OS,
        isDev: isDev,
        timestamp: Date.now()
      });
      
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

      // Use the auth context login function
      const loginSuccess = await authLogin(data);
      
      if (loginSuccess) {
        // Navigation will be handled automatically by AppNavigator
        console.log('Login successful, user authenticated');
      } else {
        Alert.alert('Login Failed', 'Failed to complete login process');
      }
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
          key={`password-${isPasswordVisible}`}
          enablesReturnKeyAutomatically={true}
          returnKeyType="done"
          clearButtonMode="never"
          allowFontScaling={true}
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
    </View>
  );
}

// Keep all your existing styles
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
    borderWidth: 0,
    textAlignVertical: 'center',
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
});
