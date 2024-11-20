// src/utils/auth.js
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '@env';

const API_URL = `${API_BASE_URL}/auth`;



export const logoutUser = async () => {
    try {
        await axios.post(`${API_URL}/logout`); // Call the logout endpoint
        await AsyncStorage.clear(); // Clear local storage
    } catch (error) {
        console.error('Logout failed:', error); // Log any errors
    }
};
