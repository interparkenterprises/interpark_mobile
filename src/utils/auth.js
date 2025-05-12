// src/utils/auth.js
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { EXPO_PUBLIC_API_BASE_URL } from '@env';

const API_URL = `https://interpark-backend.onrender.com/api/auth`;



export const logoutUser = async () => {
    try {
        await axios.post(`https://interpark-backend.onrender.com/api/logout`); // Call the logout endpoint
        await AsyncStorage.clear(); // Clear local storage
    } catch (error) {
        console.error('Logout failed:', error); // Log any errors
    }
};
