import React, { useState, useRef } from 'react';
import { View, Text, TextInput, Alert, StyleSheet, Animated, TouchableOpacity, ImageBackground } from 'react-native';
import axios from 'axios';
import BouncyCheckbox from 'react-native-bouncy-checkbox';
import { API_BASE_URL } from '@env';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
import AsyncStorage from '@react-native-async-storage/async-storage';

WebBrowser.maybeCompleteAuthSession();

export default function Register({ navigation }) {
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('CLIENT');
  const [isClientChecked, setClientChecked] = useState(true);
  const [isAgentChecked, setAgentChecked] = useState(false);
  const [isTermsChecked, setTermsChecked] = useState(false); // New state


  const animation = useRef(new Animated.Value(1)).current;

  // Set up Google Sign-In with dynamic redirectUri
  const [request, response, promptAsync] = Google.useAuthRequest({
    iosClientId: '404388363961-hdt1e7t3ok9lgbd2biiqepmooign1n8k.apps.googleusercontent.com',
    androidClientId: '404388363961-a1ei5i7bd0ajavteejs7dnlsinuenj7v.apps.googleusercontent.com',
    redirectUri: makeRedirectUri({ useProxy: true }), // Automatically handles redirect URI    
  });
  


  // Handle the Google Sign-In response
  React.useEffect(() => {
    if (response?.type === 'success') {
      const { authentication } = response;
      handleGoogleSignIn(authentication.accessToken);
    }
  }, [response]);

  // Function to handle Google Sign-In
  const handleGoogleSignIn = async (accessToken) => {
    try {
      // Get user information from Google
      const userInfoResponse = await fetch('https://www.googleapis.com/userinfo/v2/me', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const userInfo = await userInfoResponse.json();

      // Register the user on your backend
      await axios.post(`${API_BASE_URL}/auth/register`, {
        email: userInfo.email,
        username: userInfo.name,
        role,
        googleId: userInfo.id, // Pass the Google ID here
        avatar: userInfo.picture, // Optionally pass the Google avatar
      });

      Alert.alert('Registration Successful', 'You can now log in');
      navigation.navigate('Login');
    } catch (error) {
      console.error('Google Sign-In error:', error);
      Alert.alert('Registration Failed', 'Please try again');
    }
  };

  // Function to validate email format
  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // Function to validate inputs
  const validateInputs = () => {
    if (!email.trim() || !username.trim() || !password.trim()) {
      Alert.alert('Error', 'All fields are required!');
      return false;
    }
    if (!validateEmail(email)) {
      Alert.alert('Error', 'Please enter a valid email address');
      return false;
    }

    if (!isTermsChecked) {
      Alert.alert('Error', 'Accept and check the terms and conditions in order to register.');
      return false;
    }
    return true;
  };

  const handleRegister = async () => {
    if (!validateInputs()) return;

    try {
      await axios.post(`${API_BASE_URL}/auth/register`, { 
        email, 
        username, 
        password, 
        role 
      });
      Alert.alert('Registration Successful', 'You can now log in');
      navigation.navigate('Login');
    } catch (error) {
      console.error(error.response?.data || error.message);
      Alert.alert('Registration Failed', 'Please try again');
    }
  };

  const handlePressIn = () => {
    Animated.spring(animation, { toValue: 0.95, useNativeDriver: true }).start();
  };

  const handlePressOut = () => {
    Animated.spring(animation, { toValue: 1, useNativeDriver: true }).start();
  };

  const handleClientSelect = () => {
    setRole('CLIENT');
    setClientChecked(true);
    setAgentChecked(false);
  };

  const handleAgentSelect = () => {
    setRole('AGENT_LANDLORD');
    setClientChecked(false);
    setAgentChecked(true);
  };

  return (
    <ImageBackground 
      source={require('../../assets/House2.jpg')}
      style={styles.background}
      resizeMode="cover"
    >
      <View style={styles.container}>
        <Text style={styles.title}>Register</Text>

        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="black"
          value={email}
          onChangeText={setEmail}
        />
        <TextInput
          style={styles.input}
          placeholder="Username"
          placeholderTextColor="black"
          value={username}
          onChangeText={setUsername}
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor="black"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
        <BouncyCheckbox
          size={25}
          fillColor="green"
          unfillColor="#FFFFFF"
          text="I accept the Terms and Conditions"
          iconStyle={{ borderColor: 'green' }}
          innerIconStyle={{ borderWidth: 2 }}
          isChecked={isTermsChecked}
          disableBuiltInState
          onPress={() => setTermsChecked(!isTermsChecked)}
          style={styles.checkbox}
        />

        <BouncyCheckbox
          size={25}
          fillColor="red"
          unfillColor="#FFFFFF"
          text="Register as Client"
          iconStyle={{ borderColor: 'red' }}
          innerIconStyle={{ borderWidth: 2 }}
          isChecked={isClientChecked}
          disableBuiltInState
          onPress={handleClientSelect}
          style={styles.checkbox}
        />

        <BouncyCheckbox
          size={25}
          fillColor="blue"
          unfillColor="#FFFFFF"
          text="Register as Agent"
          iconStyle={{ borderColor: 'blue' }}
          innerIconStyle={{ borderWidth: 2 }}
          isChecked={isAgentChecked}
          disableBuiltInState
          onPress={handleAgentSelect}
          style={styles.checkbox}
        />

        <Animated.View style={{ transform: [{ scale: animation }] }}>
          <TouchableOpacity
            style={styles.registerButton}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            onPress={handleRegister}
          >
            <Text style={styles.registerButtonText}>Register</Text>
          </TouchableOpacity>
        </Animated.View>

        <TouchableOpacity
          disabled={!request}
          style={styles.googleButton}
          onPress={() => promptAsync()}
        >
          <Text style={styles.googleButtonText}>Register with Google</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.loginButton} 
          onPress={() => navigation.navigate('Login')}
        >
          <Text style={styles.loginText}>Already have an account? Login</Text>
        </TouchableOpacity>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
    justifyContent: 'center',
  },
  container: { 
    flex: 1, 
    justifyContent: 'center', 
    padding: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 20,
    margin: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  title: { 
    fontSize: 32, 
    marginBottom: 20, 
    textAlign: 'center' 
  },
  input: { 
    borderWidth: 1, 
    borderColor: '#ddd',
    borderRadius: 5,
    marginBottom: 10, 
    padding: 10,
    backgroundColor: 'white',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  checkbox: { 
    marginVertical: 10 
  },
  registerButton: {
    backgroundColor: '#6495ED',
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  registerButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  googleButton: {
    backgroundColor: '#db4437',
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 20,
  },
  googleButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  loginButton: {
    marginTop: 15,
    alignItems: 'center',
  },
  loginText: {
    color: 'blue',
    fontSize: 16,
    textDecorationLine: 'underline',
  },
});
