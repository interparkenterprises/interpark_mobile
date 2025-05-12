import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Alert,
  TextInput,
  ActivityIndicator,
  BackHandler, // Import BackHandler
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons'; // Import Icons
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { EXPO_PUBLIC_API_BASE_URL } from '@env';
import { Asset } from 'expo-asset'; // Import expo-asset

export default function Profile({ navigation }) {
  const [user, setUser] = useState(null);
  const [avatar, setAvatar] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false); // Track edit mode
  const [newUsername, setNewUsername] = useState(''); // Store edited username

  const preloadAvatar = async (uri) => {
    try {
      const asset = Asset.fromURI(uri);
      await asset.downloadAsync();
    } catch (error) {
      console.error('Error preloading image:', error);
    }
  };

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const storedUser = await AsyncStorage.getItem('user');
        if (storedUser) {
          const parsedUser = JSON.parse(storedUser);
          setUser(parsedUser);
          setAvatar(parsedUser?.avatar || null);
          setNewUsername(parsedUser.username); // Pre-fill with existing username

          // Preload the avatar if it's available
          if (parsedUser?.avatar) {
            preloadAvatar(parsedUser.avatar);
          }
        } else {
          console.warn('No user data found in AsyncStorage.');
        }
      } catch (error) {
        console.error('Failed to load user data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchUserData();

    const backHandler = BackHandler.addEventListener('hardwareBackPress', handleExit);
    return () => backHandler.remove(); // Cleanup on unmount
  }, []);

  const pickImage = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        return Alert.alert(
          'Permission Required',
          'Camera roll permissions are required to select an image.'
        );
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 1,
      });

      if (!result.canceled) {
        const uri = result.assets[0].uri;
        const fileInfo = await FileSystem.getInfoAsync(uri);

        if (fileInfo.exists && fileInfo.size > 0) {
          setAvatar(uri);
          if (user?.id) {
            await uploadAvatar(uri);
          } else {
            Alert.alert('Error', 'User ID not found.');
          }

          // Preload the newly selected avatar
          preloadAvatar(uri);
        } else {
          Alert.alert('Error', 'The selected image is invalid or empty.');
        }
      }
    } catch (error) {
      console.error('Image Selection Error:', error);
    }
  };

  const uploadAvatar = async (avatarUri) => {
    try {
      const formData = new FormData();
      formData.append('avatar', {
        uri: avatarUri,
        type: 'image/jpeg',
        name: `avatar-${Date.now()}.jpg`,
      });

      const token = await AsyncStorage.getItem('auth_token');

      const response = await fetch(
        `https://interpark-backend.onrender.com/api/auth/upload-avatar/${user.id}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'multipart/form-data',
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        }
      );

      const data = await response.json();
      if (response.ok) {
        Alert.alert('Success', 'Avatar uploaded successfully!');
        setUser((prevUser) => ({ ...prevUser, avatar: data.avatar }));
        setAvatar(data.avatar);
        await AsyncStorage.setItem('user', JSON.stringify({ ...user, avatar: data.avatar }));

        // Preload the uploaded avatar
        preloadAvatar(data.avatar);
      } else {
        throw new Error(data.error || 'Failed to upload avatar.');
      }
    } catch (error) {
      console.error('Upload Error:', error);
      Alert.alert('Error', error.message || 'An error occurred while uploading the avatar.');
    }
  };

  const handleSaveUsername = async () => {
    setUser((prevUser) => ({ ...prevUser, username: newUsername }));
    await AsyncStorage.setItem('user', JSON.stringify({ ...user, username: newUsername }));
    setIsEditing(false);
  };

  const handleLogout = async () => {
    try {
      const token = await AsyncStorage.getItem('auth_token'); // Retrieve the auth token
  
      const response = await fetch(`https://interpark-backend.onrender.com/api/auth/logout`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
  
      const data = await response.json();
  
      if (response.ok) {
        // Clear the AsyncStorage after successful logout
        await AsyncStorage.clear();
        Alert.alert('Logged Out', data.message);
        setUser(null);
        // Reset the navigation stack to the Login screen
        navigation.reset({
          index: 0,
          routes: [{ name: 'Login' }],
        });
         
      } else {
        Alert.alert('Logout Failed', data.error || 'An error occurred while logging out.');
      }
    } catch (error) {
      console.error('Logout Error:', error);
      Alert.alert('Error', 'An error occurred during logout.');
    }
  };

  const handleExit = () => {
    Alert.alert(
      "Exit App",
      "Are you sure you want to exit?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Yes",
          onPress: () => {
            BackHandler.exitApp(); // Close the app gracefully
          },
        },
      ],
      { cancelable: true }
    );
  };
  

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="24" color="#ffffff" />
      </View>
    );
  }

  if (!user) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>No user data available.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Image
        source={{ uri: avatar || 'https://via.placeholder.com/180' }}
        style={styles.avatar}
      />
      <View style={styles.usernameContainer}>
        {isEditing ? (
          <>
            <TextInput
              value={newUsername}
              onChangeText={setNewUsername}
              style={styles.usernameInput}
            />
            <TouchableOpacity onPress={handleSaveUsername}>
              <Icon name="check" size={24} color="white" />
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={styles.info}>{user.username}</Text>
            <TouchableOpacity onPress={() => setIsEditing(true)}>
              <Icon name="edit" size={24} color="white" />
            </TouchableOpacity>
          </>
        )}
      </View>
      <Text style={styles.info}>Email: {user.email}</Text>
      <TouchableOpacity style={styles.button} onPress={pickImage}>
        <Text style={styles.buttonText}>
          {avatar ? 'Change Avatar' : 'Upload Avatar'}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.buttonText}>Logout</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.exitButton} onPress={handleExit}>
        <Text style={styles.buttonText}>Exit App</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#E0E0E0',
    alignItems: 'center',
    paddingTop: 80,
    paddingHorizontal: 16,
  },
  avatar: {
    width: 180,
    height: 180,
    borderRadius: 90,
    marginBottom: 24,
    borderWidth: 3,
    borderColor: '#ffffff',
  },
  usernameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  usernameInput: {
    backgroundColor: '#ffffff',
    color: '#000',
    padding: 8,
    borderRadius: 8,
    marginRight: 8,
    width: 150,
  },
  info: {
    fontSize: 20,
    color: '#231f20',
    marginVertical: 8,
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#005478',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginTop: 16,
  },
  logoutButton: {
    backgroundColor: '#FF6347',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginTop: 16,
  },
  exitButton: {
    backgroundColor: '#A9A9A9',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginTop: 16,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  errorText: {
    fontSize: 18,
    color: 'red',
  },
});
