// Register.js
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
import { useAuth } from '../contexts/AuthContext';
import { createGoogleOAuthState } from '../utils/encoding';
import { GOOGLE_WEB_CLIENT_ID, BACKEND_URL } from '@env';

WebBrowser.maybeCompleteAuthSession();

// Helper function to clean role string
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

export default function Register({ navigation }) {
  const { login: authLogin, lastRole } = useAuth();

  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [secureTextEntry, setSecureTextEntry] = useState(true);
  const [secureConfirmTextEntry, setSecureConfirmTextEntry] = useState(true);
  const [role, setRole] = useState(lastRole); // ✅ Start with last used role
  const [open, setOpen] = useState(false);
  const [items] = useState([
    { label: 'Register as a Client', value: 'CLIENT' },
    { label: 'Register as an Agent/Landlord', value: 'AGENT_LANDLORD' },
  ]);
  const [isTermsChecked, setTermsChecked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  // Update role state when dropdown changes
  useEffect(() => {
    if (role) {
      const cleaned = cleanRole(role);
      if (cleaned) setRole(cleaned);
    }
  }, [role]);

  // Handle deep link from Google OAuth callback
  const handleDeepLink = async (event) => {
    let url;
    if (typeof event === 'string') {
      url = event;
    } else if (event?.url) {
      url = event.url;
    } else {
      console.log('No URL found in deep link event');
      return;
    }

    console.log('Processing deep link:', url);

    if (url.includes('google-auth') || url.includes('interpark://')) {
      try {
        const urlParts = url.split('?');
        if (urlParts.length < 2) return;

        const queryPart = urlParts[1].split('#')[0]; // Remove fragment
        const params = new URLSearchParams(queryPart);

        const token = params.get('token');
        const roleFromUrl = params.get('role');
        const error = params.get('error');

        if (error) {
          console.error('OAuth error:', error);
          Alert.alert('Authentication Error', error);
          return;
        }

        if (token) {
          const cleanedRoleFromUrl = cleanRole(roleFromUrl);
          const finalRole = cleanedRoleFromUrl || role || 'CLIENT';

          if (!['CLIENT', 'AGENT_LANDLORD'].includes(finalRole)) {
            Alert.alert('Error', 'Invalid role. Please select one and try again.');
            return;
          }

          console.log('Final role for Google registration:', finalRole);
          await handleGoogleToken(token, finalRole);
        } else {
          Alert.alert('Error', 'No authentication token received');
        }
      } catch (err) {
        console.error('Error processing deep link:', err);
        Alert.alert('Error', 'Failed to process authentication');
      }
    }
  };

  // Listen to deep links
  useEffect(() => {
    const subscription = Linking.addEventListener('url', handleDeepLink);

    Linking.getInitialURL().then((initialUrl) => {
      if (initialUrl) {
        console.log('Initial deep link:', initialUrl);
        handleDeepLink(initialUrl);
      }
    });

    return () => {
      subscription.remove();
    };
  }, [role]);

  // Handle Google token from backend
  const handleGoogleToken = async (idToken, userRole) => {
    const cleanedRole = cleanRole(userRole);
    if (!cleanedRole) {
      Alert.alert('Error', 'Invalid role. Please try again.');
      return;
    }

    setGoogleLoading(true);
    try {
      const response = await axios.post(
        `${BACKEND_URL}/api/auth/google`,
        { idToken, role: cleanedRole },
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 15000,
        }
      );

      if (response.data.token && response.data.user) {
        const loginSuccess = await authLogin(response.data);
        if (loginSuccess) {
          Alert.alert(
            'Welcome!',
            response.data.message || 'Registration successful!'
          );
        } else {
          throw new Error('Login failed');
        }
      } else {
        throw new Error('Missing token or user data');
      }
    } catch (error) {
      console.error('Google registration error:', error);
      let errorMessage = 'Registration failed';
      if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error.request) {
        errorMessage = 'No response from server. Check your connection.';
      }
      Alert.alert('Registration Failed', errorMessage);
    } finally {
      setGoogleLoading(false);
    }
  };

  // Google Sign-In using createGoogleOAuthState
  const handleGoogleSignIn = async () => {
    if (!role) {
      Alert.alert('Error', 'Please select your role first');
      return;
    }
    if (!isTermsChecked) {
      Alert.alert('Error', 'You must accept the terms and conditions');
      return;
    }

    const cleanedRole = cleanRole(role);
    if (!cleanedRole) {
      Alert.alert('Error', 'Invalid role selected');
      return;
    }

    console.log('Starting Google sign-in for registration with role:', cleanedRole);
    setGoogleLoading(true);

    try {
      const state = createGoogleOAuthState({
        role: cleanedRole,
        platform: Platform.OS,
        action: 'register',
      });

      const backendUrl = BACKEND_URL || 'https://interpark-backend.onrender.com';
      const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
        `client_id=${GOOGLE_WEB_CLIENT_ID}&` +
        `redirect_uri=${encodeURIComponent(`${backendUrl}/api/auth/google-callback`)}&` +
        `response_type=code&` +
        `scope=openid%20email%20profile&` +
        `state=${state}&` +
        `prompt=select_account`;

      console.log('Opening Google auth URL:', googleAuthUrl);

      await WebBrowser.warmUpAsync();
      const result = await WebBrowser.openAuthSessionAsync(googleAuthUrl, 'interpark://');

      console.log('WebBrowser result:', result);

      if (result.type === 'success' && result.url) {
        await handleDeepLink(result.url);
      } else if (result.type === 'cancel') {
        console.log('User cancelled Google sign-in');
        Alert.alert('Cancelled', 'Google sign-in was cancelled');
      } else {
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

  // Validation
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
    if (!role) {
      Alert.alert('Error', 'Please select your role');
      return false;
    }
    if (!isTermsChecked) {
      Alert.alert('Error', 'You must accept the terms and conditions');
      return false;
    }
    return true;
  };

  // Regular registration
  const handleRegister = async () => {
    if (!validateInputs()) return;

    const cleanedRole = cleanRole(role);
    if (!cleanedRole) {
      Alert.alert('Error', 'Invalid role selected');
      return;
    }

    setLoading(true);
    try {
      const backendUrl = BACKEND_URL || 'https://interpark-backend.onrender.com';

      // Check if user exists
      const { data: check } = await axios.post(
        `${backendUrl}/api/auth/verify-user`,
        { email, username },
        { timeout: 10000 }
      );

      if (check.exists) {
        Alert.alert('Registration Failed', 'User already exists');
        setLoading(false);
        return;
      }

      // Proceed with registration
      await axios.post(
        `${backendUrl}/api/auth/register`,
        { username, email, password, role: cleanedRole },
        { timeout: 10000 }
      );

      Alert.alert(
        'Registration Successful',
        'Please check your email to confirm before logging in',
        [{ text: 'OK', onPress: () => navigation.navigate('Login') }]
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
      <Image source={require('../../assets/logo.png')} style={styles.logo} />
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

      {/* Password Field */}
      <View style={styles.passwordContainer}>
        <TextInput
          style={styles.passwordInput}
          placeholder="Password"
          placeholderTextColor="black"
          value={password}
          onChangeText={setPassword}
          secureTextEntry={secureTextEntry}
          textContentType="newPassword"
          autoComplete="password-new"
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
          key={`password-${secureTextEntry}`}
        />
        <TouchableOpacity
          style={styles.eyeIcon}
          onPress={() => setSecureTextEntry(!secureTextEntry)}
        >
          <Icon name={secureTextEntry ? 'eye-off' : 'eye'} size={24} color="gray" />
        </TouchableOpacity>
      </View>

      {/* Confirm Password Field */}
      <View style={styles.passwordContainer}>
        <TextInput
          style={[
            styles.passwordInput,
            password && confirmPassword && password !== confirmPassword && styles.errorInput,
          ]}
          placeholder="Confirm Password"
          placeholderTextColor={
            password && confirmPassword && password !== confirmPassword ? 'red' : 'black'
          }
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry={secureConfirmTextEntry}
          textContentType="newPassword"
          autoComplete="password-new"
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
          key={`confirmPassword-${secureConfirmTextEntry}`}
        />
        <TouchableOpacity
          style={styles.eyeIcon}
          onPress={() => setSecureConfirmTextEntry(!secureConfirmTextEntry)}
        >
          <Icon name={secureConfirmTextEntry ? 'eye-off' : 'eye'} size={24} color="gray" />
        </TouchableOpacity>
      </View>

      {/* Role Dropdown */}
      <DropDownPicker
        open={open}
        value={role}
        items={items}
        setOpen={setOpen}
        setValue={setRole}
        placeholder="Select your role"
        containerStyle={styles.dropdownContainer}
        style={styles.dropdown}
        dropDownContainerStyle={styles.dropdownList}
      />

      {/* Terms Checkbox */}
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
              onPress={() => Linking.openURL('https://interparkenterprises.co.ke/terms-and-conditions/')}
            >
              Terms
            </Text>{' '}
            and{' '}
            <Text
              style={styles.checkboxLink}
              onPress={() => Linking.openURL('https://interparkenterprises.co.ke/privacy-policy/')}
            >
              Privacy Policy
            </Text>
          </Text>
        }
      />

      {/* Register Button */}
      <TouchableOpacity
        style={[styles.registerButton, (!role || loading) && styles.disabledButton]}
        onPress={handleRegister}
        disabled={loading || !role}
      >
        {loading ? (
          <ActivityIndicator size="small" color="white" />
        ) : (
          <Text style={styles.registerButtonText}>Register</Text>
        )}
      </TouchableOpacity>

      {/* Google Sign-Up Button */}
      <TouchableOpacity
        style={[
          styles.googleButton,
          (!role || !isTermsChecked || googleLoading) && styles.disabledButton,
        ]}
        onPress={handleGoogleSignIn}
        disabled={googleLoading || !role || !isTermsChecked}
      >
        {googleLoading ? (
          <ActivityIndicator size="small" color="white" />
        ) : (
          <>
            <Text style={styles.googleButtonText}>Register with Google</Text>
            <Image source={require('../../assets/google-logo-icon.png')} style={styles.googleIcon} />
          </>
        )}
      </TouchableOpacity>

      {/* Login Prompt */}
      <TouchableOpacity style={styles.loginButton} onPress={() => navigation.navigate('Login')}>
        <Text style={styles.loginText}>Already have an account? Login</Text>
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
    textAlignVertical: 'center',
    fontSize: 16,
    // Additional styles for better password handling in APK
    fontFamily: Platform.OS === 'android' ? 'monospace' : 'System',
    letterSpacing: Platform.OS === 'android' ? 1 : 0,
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
