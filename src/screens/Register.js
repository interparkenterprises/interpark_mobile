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
import DropDownPicker from 'react-native-dropdown-picker';
import BouncyCheckbox from 'react-native-bouncy-checkbox';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import * as WebBrowser from 'expo-web-browser';
import * as SecureStore from 'expo-secure-store';
import {
  GOOGLE_WEB_CLIENT_ID,
  BACKEND_URL,
} from '@env';

WebBrowser.maybeCompleteAuthSession();

export default function Register({ navigation }) {
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [secureTextEntry, setSecureTextEntry] = useState(true);
  const [role, setRole] = useState('');
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([
    { label: 'Register as a Client', value: 'CLIENT' },
    { label: 'Register as an Agent/Landlord', value: 'AGENT_LANDLORD' } // Fixed typo here
  ]);
  const [isTermsChecked, setTermsChecked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  // Deep linking handler
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
        // FIX: Decode and clean the role parameter
        let role = params.get('role');
        if (role) {
          role = decodeURIComponent(role).trim(); // Remove any extra characters
          // Ensure it's a valid role
          if (!['CLIENT', 'AGENT_LANDLORD'].includes(role)) {
            role = 'CLIENT'; // Default fallback
          }
        } else {
          role = 'CLIENT'; // Default fallback
        }
        
        console.log('Extracted token:', token);
        console.log('Extracted and cleaned role:', role);
        
        if (token) {
          await handleGoogleToken(token, role);
        } else {
          console.log('No token found in deep link');
        }
      } catch (error) {
        console.error('Error processing deep link:', error);
        Alert.alert('Error', 'Failed to process authentication');
      }
    }
  };

  const handleGoogleToken = async (idToken, role) => {
    console.log('Handling Google token for role:', role);
    setGoogleLoading(true);
    try {
      console.log('Sending token to backend...');
      const response = await axios.post(
        `https://interpark-backend.onrender.com/api/auth/google`,
        { idToken, role },
        {
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: 10000,
        }
      );

      console.log('Google auth response:', response.data);

      if (response.data.token) {
        await SecureStore.setItemAsync('authToken', response.data.token);
        
        Alert.alert(
          'Welcome!', 
          response.data.message || 'Google registration successful',
          [
            {
              text: 'OK',
              onPress: () => navigation.navigate('Login')
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
      
      Alert.alert('Google Registration Failed', errorMessage);
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    if (!role) {
      Alert.alert('Error', 'Please select your role first');
      return;
    }

    if (!isTermsChecked) {
      Alert.alert('Error', 'You must accept the terms and conditions');
      return;
    }

    console.log('Starting Google sign-in for role:', role);
    setGoogleLoading(true);
    try {
      const state = JSON.stringify({ role });
      const encodedState = btoa(unescape(encodeURIComponent(state)));
      
      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
        `client_id=70068801043-8mn6l9fa5s9u682touoa1mp713f2qv41.apps.googleusercontent.com&` +
        `redirect_uri=${encodeURIComponent(`https://interpark-backend.onrender.com/api/auth/google-callback`)}&` +
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

  // ... rest of your component code (styles, other handlers, render method) ...
  const validateEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
  
  const validateInputs = () => {
    if (!email || !username || !password || !confirmPassword) {
      Alert.alert('Error', 'All fields are required!');
      return false;
    }
    if (!validateEmail(email)) {
      Alert.alert('Error', 'Please enter a valid email');
      return false;
    }
    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return false;
    }
    if (!isTermsChecked) {
      Alert.alert('Error', 'You must accept the terms and conditions');
      return false;
    }
    return true;
  };

  const handleRegister = async () => {
    if (!validateInputs() || !role) {
      if (!role) Alert.alert('Error', 'Please select your role');
      return;
    }
    
    console.log('Starting regular registration');
    setLoading(true);
    try {
      const { data: check } = await axios.post(
        `https://interpark-backend.onrender.com/api/auth/verify-user`,
        { email, username }
      );
      
      if (check.exists) {
        Alert.alert('Registration Failed', 'User already exists');
        setLoading(false);
        return;
      }

      await axios.post(
        `https://interpark-backend.onrender.com/api/auth/register`,
        { username, email, password, role }
      );
      
      Alert.alert(
        'Registration Successful',
        'Please check your email to confirm before logging in',
        [
          {
            text: 'OK',
            onPress: () => navigation.navigate('Login')
          }
        ]
      );
    } catch (err) {
      console.error('Registration error:', err);
      const errorMessage = err.response?.data?.error || err.message;
      Alert.alert('Registration Failed', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Image
        source={require('../../assets/logo.png')}
        style={styles.logo}
      />
      <Text style={styles.title}>Register</Text>

      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor="black"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />
      <TextInput
        style={styles.input}
        placeholder="Username"
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
          secureTextEntry={secureTextEntry}
        />
        <TouchableOpacity
          style={styles.eyeIcon}
          onPress={() => setSecureTextEntry(!secureTextEntry)}
        >
          <Icon
            name={secureTextEntry ? 'eye-off' : 'eye'}
            size={24}
            color="gray"
          />
        </TouchableOpacity>
      </View>

      <View
        style={[
          styles.passwordContainer,
          password &&
            confirmPassword &&
            password !== confirmPassword &&
            styles.errorContainer,
        ]}
      >
        <TextInput
          style={[
            styles.passwordInput,
            password &&
              confirmPassword &&
              password !== confirmPassword &&
              styles.errorInput,
          ]}
          placeholder="Confirm Password"
          placeholderTextColor={
            password && confirmPassword && password !== confirmPassword
              ? 'red'
              : 'black'
          }
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry={secureTextEntry}
        />
        <TouchableOpacity
          style={styles.eyeIcon}
          onPress={() => setSecureTextEntry(!secureTextEntry)}
        >
          <Icon
            name={secureTextEntry ? 'eye-off' : 'eye'}
            size={24}
            color="gray"
          />
        </TouchableOpacity>
      </View>

      <DropDownPicker
        open={open}
        value={role}
        items={items}
        setOpen={setOpen}
        setValue={setRole}
        setItems={setItems}
        placeholder="Select your role"
        containerStyle={styles.dropdownContainer}
        style={styles.dropdown}
        dropDownContainerStyle={styles.dropdownList}
      />

      <BouncyCheckbox
        size={25}
        fillColor="#005478"
        unfillColor="#FFFFFF"
        iconStyle={{ borderColor: '#005478' }}
        innerIconStyle={{ borderWidth: 2 }}
        isChecked={isTermsChecked}
        disableBuiltInState
        onPress={() => setTermsChecked(!isTermsChecked)}
        style={styles.checkbox}
        textComponent={
          <Text style={styles.checkboxText}>
            I agree to the{' '}
            <Text
              style={styles.checkboxLink}
              onPress={() =>
                Linking.openURL(
                  'https://interparkenterprises.co.ke/terms-and-conditions/'
                )
              }
            >
              Terms
            </Text>{' '}
            and{' '}
            <Text
              style={styles.checkboxLink}
              onPress={() =>
                Linking.openURL(
                  'https://interparkenterprises.co.ke/privacy-policy/'
                )
              }
            >
              Privacy Policy
            </Text>
          </Text>
        }
      />

      <TouchableOpacity
        style={[
          styles.registerButton,
          (!role || loading) && styles.disabledButton
        ]}
        onPress={handleRegister}
        disabled={loading || !role}
      >
        {loading ? (
          <ActivityIndicator size="small" color="white" />
        ) : (
          <Text style={styles.registerButtonText}>Register</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.googleButton,
          (!role || !isTermsChecked || googleLoading) && styles.disabledButton
        ]}
        onPress={handleGoogleSignIn}
        disabled={googleLoading || !role || !isTermsChecked}
      >
        {googleLoading ? (
          <ActivityIndicator size="small" color="white" />
        ) : (
          <>
            <Text style={styles.googleButtonText}>
              Register with Google
            </Text>
            <Image
              source={require('../../assets/google-logo-icon.png')}
              style={styles.googleIcon}
            />
          </>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.loginButton}
        onPress={() => navigation.navigate('Login')}
      >
        <Text style={styles.loginText}>
          Already have an account? Login
        </Text>
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
    width: 100,
    height: 100,
    alignSelf: 'center',
    marginBottom: 20,
    resizeMode: 'contain',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
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
    marginBottom: 15,
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
  dropdownContainer: {
    marginBottom: 15,
  },
  dropdown: {
    backgroundColor: 'white',
    borderColor: '#ddd',
    borderRadius: 8,
  },
  dropdownList: {
    backgroundColor: 'white',
    borderColor: '#ddd',
  },
  checkbox: {
    marginVertical: 10,
    alignSelf: 'flex-start',
  },
  checkboxText: {
    fontSize: 14,
    color: '#333',
  },
  checkboxLink: {
    color: '#005478',
    textDecorationLine: 'underline',
  },
  registerButton: {
    backgroundColor: '#005478',
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
    elevation: 3,
  },
  registerButtonText: {
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
    marginTop: 15,
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
  loginButton: {
    marginTop: 20,
    alignItems: 'center',
  },
  loginText: {
    color: '#005478',
    fontSize: 16,
    textDecorationLine: 'underline',
  },
  errorContainer: {
    borderColor: 'red',
    borderRadius: 8,
  },
  errorInput: {
    borderColor: 'red',
  },
  disabledButton: {
    opacity: 0.6,
  },
});