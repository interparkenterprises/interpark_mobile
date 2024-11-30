import React, { useState, useRef } from 'react';
import { View, Text, TextInput, Alert, StyleSheet, Animated, TouchableOpacity, Image, ActivityIndicator,
  Linking
 } from 'react-native';
import axios from 'axios';
import DropDownPicker from 'react-native-dropdown-picker';
import BouncyCheckbox from 'react-native-bouncy-checkbox';
import { useFonts } from 'expo-font';
import { API_BASE_URL } from '@env';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons'; // Import the icon library
//import AsyncStorage from '@react-native-async-storage/async-storage';

WebBrowser.maybeCompleteAuthSession();

export default function Register({ navigation }) {
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [secureTextEntry, setSecureTextEntry] = useState(true); // Controls password visibility
  const [role, setRole] = useState(''); // Selected role
  const [open, setOpen] = useState(false); // Controls dropdown visibility
  const [items, setItems] = useState([
    { label: 'Register as Client', value: 'CLIENT' },
    { label: 'Register as Agent', value: 'AGENT_LANDLORD' },
  ]);
  const [isTermsChecked, setTermsChecked] = useState(false);
  const [loading, setLoading] = useState(false);

  


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

    setLoading(true); // Start loading

    try {
        // Step 1: Check if the email or username already exists
        const checkResponse = await axios.post(`${API_BASE_URL}/auth/verify-user`, {
            email,
            username,
        });

        if (checkResponse.data.exists) {
            Alert.alert('Registration Failed', 'The User already exists');
            setLoading(false); // Stop loading
            return;
        }

        // Step 2: Proceed with registration
        await axios.post(`${API_BASE_URL}/auth/register`, {
            email,
            username,
            password,
            role,
        });

        Alert.alert('Registration Successful', 'Please check your email to confirm your email address before logging in.');
        setLoading(false); // Stop loading
        navigation.navigate('Login');
    } catch (error) {
        console.error(error.response?.data || error.message);
        Alert.alert('Registration Failed', 'Please try again');
        setLoading(false); // Stop loading
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
      />
      <TextInput
        style={styles.input}
        placeholder="Username"
        placeholderTextColor="black"
        value={username}
        onChangeText={setUsername}
      />
      <View style={{ position: 'relative' }}>
        <TextInput
          style={styles.input}
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

      {/* Dropdown for Role Selection */}
      <DropDownPicker
        open={open}
        value={role}
        items={items}
        setOpen={setOpen}
        setValue={setRole}
        setItems={setItems}
        placeholder="Select a role"
        containerStyle={styles.dropdownContainer}
        style={styles.dropdown}
        dropDownContainerStyle={styles.dropdownList}
      />

      
      {/* Terms and Conditions Checkbox */}
      <BouncyCheckbox
        size={25}
        fillColor="green"
        unfillColor="#FFFFFF"
        iconStyle={{ borderColor: 'green' }}
        innerIconStyle={{ borderWidth: 2 }}
        isChecked={isTermsChecked}
        disableBuiltInState
        onPress={() => setTermsChecked(!isTermsChecked)}
        style={styles.checkbox}
        textComponent={
          <Text style={styles.checkboxText}>
            By continuing, you're accepting our{' '}
            <TouchableOpacity onPress={() => Linking.openURL('https://your-terms-url.com')}>
              <Text style={styles.checkboxLink}>terms of service</Text>
            </TouchableOpacity>.
          </Text>
        }
      />


      <Animated.View style={{ transform: [{ scale: animation }] }}>
        <TouchableOpacity
          style={styles.registerButton}
          onPress={handleRegister}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <Text style={styles.registerButtonText}>Register</Text>
          )}
        </TouchableOpacity>
      </Animated.View>

      <TouchableOpacity
        style={styles.googleButton}
        onPress={() => promptAsync()}
        disabled={loading || !request}
      >
        <Text style={styles.googleButtonText}>Register with </Text>
        <Image
          source={require('../../assets/google-logo-icon.png')}
          style={styles.googleIcon} // Style for the image
        />
      </TouchableOpacity>

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
    fontSize: 32,
    marginBottom: 20,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    padding: 10,
    backgroundColor: 'white',
    marginBottom: 10,
  },
  eyeIcon: {
    position: 'absolute',
    right: 15,
    top: 10,
  },
  dropdownContainer: {
    height: 40,
    marginBottom: 20,
  },
  dropdown: {
    backgroundColor: 'white',
    borderColor: '#ddd',
  },
  dropdownList: {
    backgroundColor: 'white',
  },
  checkbox: {
    marginVertical: 10,
  },
  checkboxText: {
    fontSize: 14,
    color: '#000',
  },
  checkboxLink: {
    color: 'blue',
    textDecorationLine: 'underline',
    top: 5,
  },
  
  registerButton: {
    backgroundColor: '#005478',
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 20,
  },
  registerButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#48D1CC',
    paddingVertical: 15,
    borderRadius: 10,
    marginTop: 20,
  },
  googleButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    marginRight: 10,
  },
  googleIcon: {
    width: 45, // Adjust the size to fit the button
    height: 41,
    marginLeft: 5, // Adds spacing between the text and the icon
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
