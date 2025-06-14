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
import AsyncStorage from '@react-native-async-storage/async-storage';
import DropDownPicker from 'react-native-dropdown-picker';
import BouncyCheckbox from 'react-native-bouncy-checkbox';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import * as WebBrowser from 'expo-web-browser';
import Constants from 'expo-constants';
import {
  GOOGLE_WEB_CLIENT_ID,
  BACKEND_URL,
} from '@env';

WebBrowser.maybeCompleteAuthSession();

// Cross-platform base64 encoding function (same as Login.js)
const base64Encode = (str) => {
  try {
    // For React Native production builds
    if (typeof Buffer !== 'undefined') {
      return Buffer.from(str, 'utf8').toString('base64');
    }
    
    // For Expo Go and development
    if (typeof btoa !== 'undefined') {
      return btoa(unescape(encodeURIComponent(str)));
    }
    
    // If both fail, use URL encoding as fallback
    console.warn('Base64 encoding not available, using URL encoding fallback');
    return encodeURIComponent(str);
  } catch (error) {
    console.error('Base64 encoding error:', error);
    // Return URL encoded string as final fallback
    return encodeURIComponent(str);
  }
};

// Helper function to clean role string
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

export default function Register({ navigation }) {
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [secureTextEntry, setSecureTextEntry] = useState(true);
  const [secureConfirmTextEntry, setSecureConfirmTextEntry] = useState(true);
  const [role, setRole] = useState('');
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([
    { label: 'Register as a Client', value: 'CLIENT' },
    { label: 'Register as an Agent/Landlord', value: 'AGENT_LANDLORD' }
  ]);
  const [isTermsChecked, setTermsChecked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

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
        console.log('Current selected role:', role);
        
        if (token) {
          // Clean the role from URL and validate
          const cleanedRoleFromUrl = cleanRole(roleFromUrl);
          const cleanedSelectedRole = cleanRole(role);
          
          // Use cleaned role from URL or fall back to cleaned selected role
          let finalRole = cleanedRoleFromUrl || cleanedSelectedRole || 'CLIENT';
          
          // Double-check that the final role is valid
          if (!['CLIENT', 'AGENT_LANDLORD'].includes(finalRole)) {
            console.warn('Final role validation failed, using CLIENT as fallback:', finalRole);
            finalRole = 'CLIENT';
          }
          
          console.log('Final role being sent to backend:', finalRole);
          await handleGoogleToken(token, finalRole);
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
  }, [role]); // Added role dependency to ensure latest role is used

  // Called once we get idToken from the deep link
  const handleGoogleToken = async (idToken, userRole) => {
    console.log('Handling Google token for registration with role:', userRole);
    
    // Clean and validate role before sending to backend
    const cleanedRole = cleanRole(userRole);
    if (!cleanedRole) {
      console.error('Invalid role detected before sending to backend:', userRole);
      Alert.alert('Error', 'Invalid role selected. Please try again.');
      setGoogleLoading(false);
      return;
    }
    
    setGoogleLoading(true);
    try {
      console.log('Sending token to backend with cleaned role:', cleanedRole);
      const response = await axios.post(
        `${BACKEND_URL || 'https://interpark-backend.onrender.com'}/api/auth/google`,
        { 
          idToken: idToken, 
          role: cleanedRole 
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: 15000, // Increased timeout
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
          response.data.message || 'Google registration successful',
          [
            {
              text: 'OK',
              onPress: () => {
                // Navigate to appropriate dashboard based on user role
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
      console.error('Google registration error:', error);
      let errorMessage = 'Failed to authenticate with Google';
      
      if (error.response) {
        console.log('Error response status:', error.response.status);
        console.log('Error response data:', error.response.data);
        errorMessage = error.response.data.error || error.response.data.message || errorMessage;
        
        // Specific handling for role validation error
        if (error.response.status === 400 && error.response.data.error === 'Invalid role specified') {
          errorMessage = `Invalid role "${cleanedRole}" specified. Please select a valid role and try again.`;
        }
      } else if (error.request) {
        console.log('Error request:', error.request);
        errorMessage = 'No response from server. Please check your internet connection.';
      } else {
        console.log('Error message:', error.message);
        errorMessage = error.message;
      }
      
      Alert.alert('Google Registration Failed', errorMessage);
    } finally {
      setGoogleLoading(false);
    }
  };

  // Enhanced Google sign-in with better error handling
  const handleGoogleSignIn = async () => {
    if (!role) {
      Alert.alert('Error', 'Please select your role first');
      return;
    }

    if (!isTermsChecked) {
      Alert.alert('Error', 'You must accept the terms and conditions');
      return;
    }

    // Clean and validate role
    const cleanedRole = cleanRole(role);
    if (!cleanedRole) {
      Alert.alert('Error', 'Please select a valid role');
      return;
    }

    console.log('Starting Google sign-in for registration with role:', cleanedRole);
    setGoogleLoading(true);
    
    try {
      // Check if we're in development or production
      const isDev = __DEV__ || Constants.executionEnvironment === 'storeClient';
      
      const state = JSON.stringify({ 
        role: cleanedRole, // Use cleaned role
        platform: Platform.OS,
        isDev: isDev,
        action: 'register', // Add action to distinguish from login
        timestamp: Date.now() // Add timestamp for debugging
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

  // Validation functions
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
    const cleanedRole = cleanRole(role);
    if (!cleanedRole) {
      Alert.alert('Error', 'Please select a valid role');
      return false;
    }
    return true;
  };

  // Regular (form-based) registration
  const handleRegister = async () => {
    if (!validateInputs() || !role) {
      if (!role) Alert.alert('Error', 'Please select your role');
      return;
    }
    
    const cleanedRole = cleanRole(role);
    if (!cleanedRole) {
      Alert.alert('Error', 'Please select a valid role');
      return;
    }
    
    console.log('Starting regular registration with role:', cleanedRole);
    setLoading(true);
    try {
      const backendUrl = BACKEND_URL || 'https://interpark-backend.onrender.com';
      
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

      await axios.post(
        `${backendUrl}/api/auth/register`,
        { username, email, password, role: cleanedRole },
        { timeout: 10000 }
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

      {/* PASSWORD FIELD - FIXED */}
      <View style={styles.passwordContainer}>
        <TextInput
          style={styles.passwordInput}
          placeholder="Password"
          placeholderTextColor="black"
          value={password}
          onChangeText={setPassword}
          secureTextEntry={secureTextEntry}
          textContentType="newPassword"
          passwordRules="minlength: 6;"
          autoComplete="new-password"
          autoCorrect={false}
          spellCheck={false}
          importantForAutofill="no"
          keyboardType="default"
          //blurOnSubmit={true}
          // Force re-render when visibility changes
          key={`password-${secureTextEntry}`}
            // Additional recommended props from the first TextInput
          autoCapitalize="none"
          enablesReturnKeyAutomatically={true}
          returnKeyType="done"
          clearButtonMode="never"
          allowFontScaling={true}
          underlineColorAndroid="transparent"
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

      {/* CONFIRM PASSWORD FIELD - FIXED */}
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
          secureTextEntry={secureConfirmTextEntry}
          textContentType="newPassword"
          passwordRules="minlength: 6;"
          autoComplete="new-password"
          autoCorrect={false}
          spellCheck={false}
          importantForAutofill="no"
          keyboardType="default"
          //blurOnSubmit={true}
          // Force re-render when visibility changes
          key={`confirmPassword-${secureConfirmTextEntry}`}
            // Additional recommended props from the first TextInput
          autoCapitalize="none"
          enablesReturnKeyAutomatically={true}
          returnKeyType="done"
          clearButtonMode="never"
          allowFontScaling={true}
          underlineColorAndroid="transparent"
        />
        <TouchableOpacity
          style={styles.eyeIcon}
          onPress={() => setSecureConfirmTextEntry(!secureConfirmTextEntry)}
        >
          <Icon
            name={secureConfirmTextEntry ? 'eye-off' : 'eye'}
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
        onChangeValue={(value) => {
          console.log('Role selected:', value);
          setRole(value);
        }}
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
      
      {/* Debug info - remove in production */}
      {/*
      {__DEV__ && (
        <View style={styles.debugContainer}>
          <Text style={styles.debugText}>Debug: Selected Role: {role}</Text>
          <Text style={styles.debugText}>Debug: Cleaned Role: {cleanRole(role)}</Text>
          <Text style={styles.debugText}>Terms Checked: {isTermsChecked.toString()}</Text>
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
