import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Alert,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import axios from 'axios';
import { EXPO_PUBLIC_API_BASE_URL } from '@env';

export default function ForgotPassword({ navigation }) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const handlePasswordReset = async () => {
    // simple empty check
    if (!email.trim()) {
      Alert.alert('Validation Error', 'Please enter your email address.');
      return;
    }

    setLoading(true);
    try {
      await axios.post(
        `https://interpark-backend.onrender.com/api/auth/forgot-password`,
        { email: email.trim() }
      );
      Alert.alert(
        'Success',
        'If that email is registered, a reset link has been sent. Please check your inbox.'
      );
      navigation.goBack();
    } catch (error) {
      console.error(error.response?.data || error.message);
      Alert.alert(
        'Error',
        error.response?.data?.error ||
          'Failed to send reset link. Please try again later.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        onPress={() => navigation.goBack()}
        style={styles.backButton}
      >
        <Text style={styles.backButtonText}>Back</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Forgot Password</Text>

      <TextInput
        style={styles.input}
        placeholder="Enter your email"
        placeholderTextColor="#555"
        keyboardType="email-address"
        autoCapitalize="none"
        value={email}
        onChangeText={setEmail}
      />

      <TouchableOpacity
        style={[styles.resetButton, loading && { opacity: 0.7 }]}
        onPress={handlePasswordReset}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.resetButtonText}>Send Reset Link</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#585858',
    padding: 20,
    justifyContent: 'center',
  },
  backButton: {
    position: 'absolute',
    top: 40,
    left: 20,
    backgroundColor: '#ddd',
    padding: 8,
    borderRadius: 6,
  },
  backButtonText: {
    color: '#333',
    fontSize: 16,
  },
  title: {
    fontSize: 26,
    fontWeight: '600',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 24,
  },
  input: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    fontSize: 16,
    color: '#000',
  },
  resetButton: {
    backgroundColor: '#005478',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  resetButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '500',
  },
});
