import React, { useState } from 'react';
import { View, Text, TextInput, Alert, StyleSheet, TouchableOpacity } from 'react-native';
import axios from 'axios';
import { API_BASE_URL } from '@env';

export default function ForgotPassword({ navigation }) {
  const [emailOrUsername, setEmailOrUsername] = useState('');

  const handlePasswordReset = async () => {
    if (!emailOrUsername) {
      Alert.alert('Validation Error', 'Please enter your email or username.');
      return;
    }

    try {
      const response = await axios.post(`${API_BASE_URL}/auth/forgot-password`, {
        emailOrUsername,
      });
      Alert.alert('Success', 'Password reset link sent! Check your email.');
      navigation.goBack();
    } catch (error) {
      console.error(error.response?.data || error.message);
      Alert.alert(
        'Error',
        error.response?.data?.error || 'Failed to send password reset link. Try again later.'
      );
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Reset Your Password</Text>
      <TextInput
        style={styles.input}
        placeholder="Enter Email or Username"
        placeholderTextColor="black"
        value={emailOrUsername}
        onChangeText={setEmailOrUsername}
      />
      <TouchableOpacity style={styles.resetButton} onPress={handlePasswordReset}>
        <Text style={styles.resetButtonText}>Send Reset Link</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  title: {
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
  resetButton: {
    backgroundColor: '#1E90FF',
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  resetButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
