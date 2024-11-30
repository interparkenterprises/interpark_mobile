import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Alert,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Image,
  ActivityIndicator,
} from 'react-native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '@env';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

export default function Login({ navigation }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const animation = new Animated.Value(1);
  const [isPasswordVisible, setPasswordVisible] = useState(false); // New state

  // Function to toggle password visibility
  const togglePasswordVisibility = () => {
    setPasswordVisible(!isPasswordVisible);
  };

  const handlePressIn = () => {
    Animated.spring(animation, {
      toValue: 0.95,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(animation, {
      toValue: 1,
      useNativeDriver: true,
    }).start();
  };

  const validateFields = () => {
    if (!username || !password) {
      Alert.alert('Validation Error', 'Both fields are required.');
      return false;
    }
    return true;
  };

  const fetchUserChatRooms = async (userId) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/chat/rooms/${userId}`);
      const chatRooms = response.data || [];

      const processedChatRooms = await Promise.all(
        chatRooms.map(async (room) => ({
          id: room.id,
          clientId: room.clientId,
          agentLandlordId: room.agentLandlordId,
          propertyId: room.propertyId,
        }))
      );

      await AsyncStorage.setItem('userChatRooms', JSON.stringify(processedChatRooms));
    } catch (error) {
      console.error('Error fetching chat rooms:', error);
      Alert.alert('Error', 'Failed to load chat rooms.');
    }
  };

  const handleLogin = async () => {
    if (!validateFields()) return;

    setLoading(true);

    try {
      const response = await axios.post(`${API_BASE_URL}/auth/login`, {
        username,
        password,
      });

      const { token, user } = response.data;
      const role = user.role;
      const userId = user.id;
      console.log(`Logged in user role: ${role}`);

      await AsyncStorage.setItem('auth_token', token);
      console.log('Bearer Token:', token);
      await AsyncStorage.setItem('userId', userId);
      await AsyncStorage.setItem('user_role', role);
      await AsyncStorage.setItem('user', JSON.stringify(user));

      await fetchUserChatRooms(userId);

      if (role === 'AGENT_LANDLORD') {
        navigation.replace('AgentDashboard');
      } else if (role === 'CLIENT') {
        navigation.replace('ClientDashboard');
      } else {
        Alert.alert('Login Failed', 'Invalid role detected.');
      }

      Alert.alert('Success', 'Login successful!');
    } catch (error) {
      console.error(error.response?.data || error.message);
      Alert.alert(
        'Login Failed',
        error.response?.data?.error || 'Invalid credentials or network error.'
      );
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
      />

      <View style={{ position: 'relative' }}>
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor="black"
          value={password}
          onChangeText={setPassword}
          secureTextEntry={!isPasswordVisible} // Toggle secure entry
        />
        <TouchableOpacity
          onPress={togglePasswordVisibility}
          style={styles.eyeIcon}
        >
          <Icon
            name={isPasswordVisible ? 'eye' : 'eye-off'}
            size={24}
            color="gray"
          />
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        onPress={() => navigation.navigate('ForgotPassword')}
        style={styles.forgotPasswordLink}
      >
        <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
      </TouchableOpacity>

      {loading ? (
        <ActivityIndicator size="large" color="#ffffff" style={styles.spinner} />
      ) : (
        <Animated.View style={{ transform: [{ scale: animation }] }}>
          <TouchableOpacity
            style={styles.loginButton}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            onPress={handleLogin}
          >
            <Text style={styles.buttonText}>Login</Text>
          </TouchableOpacity>
        </Animated.View>
      )}

      <TouchableOpacity
        style={styles.registerButton}
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
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    marginBottom: 10,
    padding: 10,
    borderRadius: 8,
    backgroundColor: 'white',
  },
  eyeIcon: {
    position: 'absolute',
    right: 15,
    top: 10,
  },
  forgotPasswordLink: {
    alignSelf: 'flex-end',
    marginBottom: 10,
  },
  forgotPasswordText: {
    color: 'blue',
    textDecorationLine: 'underline',
  },
  loginButton: {
    backgroundColor: '#005478',
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 20,
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  spinner: {
    marginTop: 20,
  },
  registerButton: {
    marginTop: 15,
    alignItems: 'center',
  },
  registerText: {
    color: 'blue',
    fontSize: 16,
    textDecorationLine: 'underline',
  },
});
