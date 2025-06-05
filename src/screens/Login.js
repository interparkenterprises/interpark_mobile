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
} from 'react-native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import * as WebBrowser from 'expo-web-browser';
import { EXPO_PUBLIC_API_BASE_URL, GOOGLE_WEB_CLIENT_ID, BACKEND_URL } from '@env';

WebBrowser.maybeCompleteAuthSession();

export default function Login({ navigation }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isPasswordVisible, setPasswordVisible] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  // Deep linking handler (consistent with Register.js)
  const handleDeepLink = async (event) => {
    let url;
    
    if (typeof event === 'string') {
      url = event;
    } else if (event.url) {
      url = event.url;
    } else {
      console.log('No URL found in deep link event');
      return;
    }

    console.log('Processing deep link:', url);
    
    if (url.includes('interpark://google-auth')) {
      try {
        const params = new URLSearchParams(url.split('?')[1]);
        const token = params.get('token');
        
        console.log('Extracted token:', token);
        
        if (token) {
          await handleGoogleToken(token);
        } else {
          console.log('No token found in deep link');
        }
      } catch (error) {
        console.error('Error processing deep link:', error);
        Alert.alert('Error', 'Failed to process authentication');
      }
    }
  };

  useEffect(() => {
    const subscription = Linking.addEventListener('url', handleDeepLink);

    Linking.getInitialURL().then((url) => {
      if (url && url.includes('interpark://google-auth')) {
        handleDeepLink(url);
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  // Called once we get idToken from the deep link
  const handleGoogleToken = async (idToken) => {
    console.log('Handling Google token for login');
    setGoogleLoading(true);
    try {
      console.log('Sending token to backend...');
      const response = await axios.post(
        `${BACKEND_URL}/api/auth/google`, // Use consistent backend URL
        { idToken, role: 'CLIENT' }, // Include role parameter (defaulting to CLIENT for login)
        {
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: 10000,
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
            `${BACKEND_URL}/api/chat/rooms/${response.data.user.id || response.data.user._id}`,
            { headers: { Authorization: `Bearer ${response.data.token}` } }
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
                // Navigate to appropriate dashboard based on user role
                navigation.replace(
                  response.data.user.role === 'CLIENT' ? 'ClientDashboard' : 'AgentDashboard'
                );
              }
            }
          ]
        );
      }
    } catch (error) {
      console.error('Google login error:', error);
      let errorMessage = 'Failed to authenticate with Google';
      
      if (error.response) {
        console.log('Error response data:', error.response.data);
        errorMessage = error.response.data.error || errorMessage;
      } else if (error.request) {
        console.log('Error request:', error.request);
        errorMessage = 'No response from server';
      }
      
      Alert.alert('Google Login Failed', errorMessage);
    } finally {
      setGoogleLoading(false);
    }
  };

  // Open Google's OAuth consent screen (consistent with Register.js)
  const handleGoogleSignIn = async () => {
    console.log('Starting Google sign-in for login');
    setGoogleLoading(true);
    try {
      // For login, we'll use CLIENT as default role, but the backend will use existing user's role
      const state = JSON.stringify({ role: 'CLIENT' });
      const encodedState = btoa(unescape(encodeURIComponent(state)));
      
      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
        `client_id=${GOOGLE_WEB_CLIENT_ID}&` +
        `redirect_uri=${encodeURIComponent(`${BACKEND_URL}/api/auth/google-callback`)}&` +
        `response_type=code&` +
        `scope=openid%20profile%20email&` +
        `state=${encodedState}&` +
        `prompt=select_account`;

      console.log('Opening Google auth URL:', authUrl);
      
      await WebBrowser.warmUpAsync();
      const result = await WebBrowser.openAuthSessionAsync(authUrl, 'interpark://');
      console.log('WebBrowser result:', result);
      
      if (result.url) {
        await handleDeepLink(result);
      }
    } catch (error) {
      console.error('Google sign-in error:', error);
      Alert.alert('Error', 'Failed to initiate Google sign-in');
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
      const { data } = await axios.post(
        `${EXPO_PUBLIC_API_BASE_URL}/auth/login`,
        { username, password }
      );

      await AsyncStorage.setItem('auth_token', data.token);
      await AsyncStorage.setItem('user', JSON.stringify(data.user));
      await AsyncStorage.setItem('userId', data.user.id || data.user._id);

      // Preload chat rooms
      try {
        const roomsRes = await axios.get(
          `${EXPO_PUBLIC_API_BASE_URL}/chat/rooms/${data.user.id || data.user._id}`,
          { headers: { Authorization: `Bearer ${data.token}` } }
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
      />
      <View style={styles.passwordContainer}>
        <TextInput
          style={styles.passwordInput}
          placeholder="Password"
          placeholderTextColor="black"
          value={password}
          onChangeText={setPassword}
          secureTextEntry={!isPasswordVisible}
        />
        <TouchableOpacity
          onPress={() => setPasswordVisible(!isPasswordVisible)}
          style={styles.eyeIcon}
        >
          <Icon name={isPasswordVisible ? 'eye' : 'eye-off'} size={24} color="gray" />
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        onPress={() => navigation.navigate('ForgotPassword')}
        style={styles.forgotPasswordLink}
      >
        <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.loginButton}
        onPress={handleLogin}
        disabled={loading}
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
      >
        <Text style={styles.registerText}>Don't have an account? Register</Text>
      </TouchableOpacity>
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
  },
  passwordContainer: {
    position: 'relative',
    marginBottom: 5,
  },
  passwordInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    backgroundColor: 'white',
    fontSize: 16,
  },
  eyeIcon: {
    position: 'absolute',
    right: 15,
    top: 12,
  },
  forgotPasswordLink: {
    alignSelf: 'flex-end',
    marginBottom: 15,
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
