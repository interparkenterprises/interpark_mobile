import React, { useEffect } from 'react';
import { View, Text, Alert, StyleSheet } from 'react-native';
import axios from 'axios';

const ConfirmEmail = ({ route, navigation }) => {
  const { token } = route.params;

  useEffect(() => {
    const confirmEmail = async () => {
      try {
        const response = await axios.get(`https://interpark-backend.onrender.com/api/auth/confirm-email/${token}`);
        Alert.alert('Success', response.data.message);
        navigation.navigate('Login'); // Redirect to login after success
      } catch (error) {
        console.error('Error:', error.response?.data || error.message);
        Alert.alert('Error', 'Invalid or expired confirmation link.');
      }
    };

    confirmEmail();
  }, [token, navigation]);

  return (
    <View style={styles.container}>
      <Text style={styles.text}>Processing your email confirmation...</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    fontSize: 16,
    textAlign: 'center',
  },
});

export default ConfirmEmail;
