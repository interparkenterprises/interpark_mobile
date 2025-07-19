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
  BackHandler,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { Asset } from 'expo-asset';
import { useAuth } from '../contexts/AuthContext'; // Import useAuth

export default function Profile({ navigation }) {
  const [avatar, setAvatar] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [newUsername, setNewUsername] = useState('');

  // Use auth context
  const { user, logout } = useAuth();

  const preloadAvatar = async (uri) => {
    try {
      const asset = Asset.fromURI(uri);
      await asset.downloadAsync();
    } catch (error) {
      console.error('Error preloading image:', error);
    }
  };

  useEffect(() => {
    if (user) {
      setAvatar(user?.avatar || null);
      setNewUsername(user.username);

      // Preload the avatar if it's available
      if (user?.avatar) {
        preloadAvatar(user.avatar);
      }
    }

    const backHandler = BackHandler.addEventListener('hardwareBackPress', handleExit);
    return () => backHandler.remove();
  }, [user]);

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
        setAvatar(data.avatar);
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
    // Note: You might want to add a backend endpoint to update username
    // For now, this just updates local state
    setIsEditing(false);
    Alert.alert('Note', 'Username update feature needs backend implementation');
  };

  const handleLogout = async () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Logout',
          onPress: async () => {
            setLoading(true);
            await logout();
            setLoading(false);
            // Navigation will be handled automatically by AppNavigator
          },
        },
      ]
    );
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
            BackHandler.exitApp();
          },
        },
      ],
      { cancelable: true }
    );
  };

  if (!user) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="24" color="#ffffff" />
        <Text style={styles.errorText}>Loading user data...</Text>
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
      
      <TouchableOpacity 
        style={[styles.logoutButton, loading && styles.disabledButton]} 
        onPress={handleLogout}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator size="small" color="white" />
        ) : (
          <Text style={styles.buttonText}>Logout</Text>
        )}
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
  disabledButton: {
    opacity: 0.6,
  },
});
