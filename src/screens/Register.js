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
} from 'react-native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DropDownPicker from 'react-native-dropdown-picker';
import BouncyCheckbox from 'react-native-bouncy-checkbox';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import Constants from 'expo-constants';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import auth from '@react-native-firebase/auth';

import { EXPO_PUBLIC_API_BASE_URL } from '@env';

export default function Register({ navigation }) {
  // Manual form state
  const [email, setEmail]       = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [secureTextEntry, setSecureTextEntry] = useState(true);

  // Role dropdown
  const [role, setRole]         = useState('');
  const [open, setOpen]         = useState(false);
  const [items, setItems]       = useState([
    { label: 'Register as a Client',        value: 'CLIENT' },
    { label: 'Register as an Agent/Landlord', value: 'AGENT_LANDLORD' },
  ]);

  const [isTermsChecked, setTermsChecked]   = useState(false);
  const [loading, setLoading]               = useState(false);
  const [googleLoading, setGoogleLoading]   = useState(false);

  // --- Configure Google Sign-In once ---
  useEffect(() => {
    const { googleClientIdWeb, googleClientIdAndroid } = Constants.expoConfig.extra;

    GoogleSignin.configure({
      webClientId: googleClientIdWeb,
      androidClientId: googleClientIdAndroid,
      offlineAccess: true,
    });
  }, []);

  // --- Manual Registration ---
  const validateEmail = e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
  const validateInputs = () => {
    if (!email.trim() || !username.trim() || !password.trim() || !confirmPassword.trim()) {
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
      Alert.alert('Error', 'You must accept the terms');
      return false;
    }
    return true;
  };

  const handleRegister = async () => {
    if (!validateInputs() || !role) {
      if (!role) Alert.alert('Error', 'Please select your role');
      return;
    }
    setLoading(true);
    try {
      // Check existence
      const { data: check } = await axios.post(
        `https://interpark-backend.onrender.com/api/auth/verify-user`,
        { email, username }
      );
      if (check.exists) {
        Alert.alert('Registration Failed', 'User already exists');
        setLoading(false);
        return;
      }
      // Register
      await axios.post(
        `https://interpark-backend.onrender.com/api/auth/register`,
        { username, email, password, role }
      );
      Alert.alert(
        'Registration Successful',
        'Please check your email to confirm before logging in'
      );
      navigation.navigate('Login');
    } catch (err) {
      console.error(err);
      Alert.alert('Registration Failed', err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  // --- Google Registration/Login ---
  const handleGoogleSignIn = async () => {
    if (!role) {
      return Alert.alert('Error', 'Please select your role first');
    }
    setGoogleLoading(true);
    try {
      // 1. Launch native Google Sign-In
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const { idToken: googleIdToken } = await GoogleSignin.signIn();

      // 2. Create a Firebase credential with the token
      const credential = auth.GoogleAuthProvider.credential(googleIdToken);
      const userCredential = await auth().signInWithCredential(credential);

      // 3. Get the Firebase ID token
      const firebaseIdToken = await userCredential.user.getIdToken();

      // 4. Send it to your backend
      const { data } = await axios.post(
        `https://interpark-backend.onrender.com/api/auth/google`,
        { idToken: firebaseIdToken, role }
      );

      // 5. Store your JWT & user, navigate
      await AsyncStorage.setItem('auth_token', data.token);
      await AsyncStorage.setItem('user', JSON.stringify(data.user));
      navigation.replace(
        data.user.role === 'CLIENT' ? 'ClientDashboard' : 'AgentDashboard'
      );
    } catch (err) {
      console.error('Google Sign-In Error', err);
      Alert.alert('Error', err.response?.data?.error || err.message);
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Image source={require('../../assets/logo.png')} style={styles.logo} />
      <Text style={styles.title}>Register</Text>

      {/* Manual Fields */}
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
          <Icon name={secureTextEntry ? 'eye-off' : 'eye'} size={24} color="gray" />
        </TouchableOpacity>
      </View>
      
      {/* Confirm Password Field with error styling */}
      <View style={[
        styles.passwordContainer, 
        password && confirmPassword && password !== confirmPassword && styles.errorContainer
      ]}>
        <TextInput
          style={[
            styles.passwordInput,
            password && confirmPassword && password !== confirmPassword && styles.errorInput
          ]}
          placeholder="Confirm Password"
          placeholderTextColor={password && confirmPassword && password !== confirmPassword ? 'red' : 'black'}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry={secureTextEntry}
        />
        <TouchableOpacity
          style={styles.eyeIcon}
          onPress={() => setSecureTextEntry(!secureTextEntry)}
        >
          <Icon name={secureTextEntry ? 'eye-off' : 'eye'} size={24} color="gray" />
        </TouchableOpacity>
      </View>

      {/* Role Picker */}
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

      {/* Terms */}
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

      {/* Manual Register */}
      <TouchableOpacity
        style={styles.registerButton}
        onPress={handleRegister}
        disabled={loading || !role}
      >
        {loading
          ? <ActivityIndicator size="small" color="white" />
          : <Text style={styles.registerButtonText}>Register</Text>
        }
      </TouchableOpacity>

      {/* Google Register */}
      <TouchableOpacity
        style={styles.googleButton}
        onPress={handleGoogleSignIn}
        disabled={googleLoading || !role}
      >
        {googleLoading
          ? <ActivityIndicator size="small" color="white" />
          : <>
              <Text style={styles.googleButtonText}>Register with</Text>
              <Image
                source={require('../../assets/google-logo-icon.png')}
                style={styles.googleIcon}
              />
            </>
        }
      </TouchableOpacity>

      {/* Go to Login */}
      <TouchableOpacity
        style={styles.loginButton}
        onPress={() => navigation.navigate('Login')}
      >
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
  
});
