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
  ScrollView,
  BackHandler,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { Asset } from 'expo-asset';
import { useAuth } from '../contexts/AuthContext'; // Import useAuth

export default function AgentProfile() {
  const [avatar, setAvatar] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [newUsername, setNewUsername] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [nationalIdOrPassport, setNationalIdOrPassport] = useState('');
  const [agentNumber, setAgentNumber] = useState('');
  const [fieldsLocked, setFieldsLocked] = useState(false);

  const navigation = useNavigation();

  // Use auth context
  const { user, logout } = useAuth();

  // Preload Avatar function
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
      setAvatar(user.avatar || null);
      setNewUsername(user.username || '');

      if (user.avatar) {
        preloadAvatar(user.avatar);
      }

      fetchAgentProfile(user.id);
    }

    const backHandler = BackHandler.addEventListener('hardwareBackPress', handleExit);
    return () => backHandler.remove();
  }, [user]);

  // Fetch Agent Profile info
  const fetchAgentProfile = async (userId) => {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      const response = await fetch(
        `https://interpark-backend.onrender.com/api/auth/agent-profile/${userId}`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      const data = await response.json();
      if (response.ok) {
        const { profile } = data;
        setPhoneNumber(profile.phoneNumber || '');
        setNationalIdOrPassport(profile.nationalIdOrPassport || '');
        setAgentNumber(profile.agentNumber || '');

        // Lock fields if they were already set on the server
        if (profile.nationalIdOrPassport && profile.agentNumber) {
          setFieldsLocked(true);
        }
      } else {
        throw new Error(data.error || 'Failed to fetch agent profile.');
      }
    } catch (error) {
      console.error('Fetch Agent Profile Error:', error);
      Alert.alert('Error', error.message || 'An error occurred while fetching the agent profile.');
    }
  };

  // Image Picker for Avatar
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

  // Upload Avatar function
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

  const validateFields = () => {
    if (!phoneNumber.trim() || !nationalIdOrPassport.trim() || !agentNumber.trim()) {
      Alert.alert('Validation Error', 'All fields are required.');
      return false;
    }
    return true;
  };

  const handleSaveProfile = async () => {
    if (!validateFields()) return;

    setIsSaving(true);
    try {
      const token = await AsyncStorage.getItem('auth_token');
      if (!token) {
        Alert.alert('Authentication Error', 'You are not authenticated.');
        setIsSaving(false);
        return;
      }
      if (!user?.id) {
        Alert.alert('Error', 'User ID is not found.');
        setIsSaving(false);
        return;
      }

      const response = await fetch(
        `https://interpark-backend.onrender.com/api/auth/agent-profile/${user.id}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ phoneNumber, nationalIdOrPassport, agentNumber }),
        }
      );
      const data = await response.json();
      if (response.ok) {
        Alert.alert('Success', 'Profile updated successfully!');
        setIsEditing(false);
        setFieldsLocked(true);
      } else {
        throw new Error(data.error || 'Failed to update profile.');
      }
    } catch (error) {
      console.error('Update Error:', error);
      Alert.alert('Error', error.message || 'An error occurred while updating the profile.');
    } finally {
      setIsSaving(false);
    }
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
          onPress: () => BackHandler.exitApp(),
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
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.myListContainer}>
        <TouchableOpacity style={styles.myListButton} onPress={() => navigation.navigate('MyList')}>
          <Icon name="list" size={24} color="#fff" />
          <Text style={styles.myListText}>My List</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.avatarContainer}>
        <Image
          source={{ uri: avatar || 'https://via.placeholder.com/180' }}
          style={styles.avatar}
        />
        <TouchableOpacity style={styles.avatarIcon} onPress={pickImage}>
          <Icon name="add" size={30} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={styles.usernameContainer}>
        {isEditing ? (
          <TextInput
            value={newUsername}
            onChangeText={setNewUsername}
            style={styles.input}
            placeholder="Username"
            placeholderTextColor="black"
          />
        ) : (
          <View style={styles.infoContainer}>
            <Text style={styles.info}>{user.username}</Text>
            <TouchableOpacity onPress={() => setIsEditing(true)}>
              <Icon name="edit" size={24} color="white" />
            </TouchableOpacity>
          </View>
        )}
      </View>

      <TextInput
        value={phoneNumber}
        onChangeText={setPhoneNumber}
        style={styles.input}
        placeholder="Phone Number"
        placeholderTextColor="black"
        keyboardType="phone-pad"
      />

      {/* National ID / Passport */}
      <Text style={styles.fieldTitle}>National ID / Passport Number</Text>
      <TextInput
        value={nationalIdOrPassport}
        onChangeText={setNationalIdOrPassport}
        style={[
          styles.input,
          fieldsLocked && { backgroundColor: '#e0e0e0' }
        ]}
        placeholder="Enter your National ID or Passport"
        placeholderTextColor="black"
        editable={!fieldsLocked}
      />
      {fieldsLocked && (
        <Text style={styles.lockedFieldNote}>
          This field cannot be edited after saving.
        </Text>
      )}

      {/* Agent Registration Number */}
      <Text style={styles.fieldTitle}>Agent Registration Number</Text>
      <TextInput
        value={agentNumber}
        onChangeText={setAgentNumber}
        style={[
          styles.input,
          fieldsLocked && { backgroundColor: '#e0e0e0' }
        ]}
        placeholder="Enter your Agent Registration Number"
        placeholderTextColor="black"
        editable={!fieldsLocked}
      />
      {fieldsLocked && (
        <Text style={styles.lockedFieldNote}>
          This field cannot be edited after saving.
        </Text>
      )}

      <TouchableOpacity
        style={[styles.button, isSaving && { opacity: 0.6 }]}
        onPress={isSaving ? null : handleSaveProfile}
        disabled={isSaving}
      >
        {isSaving ? (
          <ActivityIndicator size="small" color="#ffffff" />
        ) : (
          <Text style={styles.buttonText}>Save Profile</Text>
        )}
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
      
      <TouchableOpacity onPress={handleExit} style={styles.exitButton}>
        <Text style={styles.buttonText}>Exit App</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}


const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: '#E0E0E0',
    alignItems: 'center',
    paddingTop: 80,
    paddingHorizontal: 16,
  },
  myListContainer: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 1,
  },
  myListButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#005478',
    padding: 8,
    borderRadius: 16,
    marginTop: 30,
  },
  myListText: {
    color: '#fff',
    fontSize: 18,
    marginLeft: 8,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 24,
  },
  avatar: {
    width: 180,
    height: 180,
    borderRadius: 90,
    borderWidth: 3,
    borderColor: '#ffffff',
  },
  avatarIcon: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#005478',
    borderRadius: 15,
    padding: 4,
  },
  usernameContainer: {
    marginBottom: 16,
    width: '100%',
  },
  infoContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    padding: 8,
    borderRadius: 8,
  },
  input: {
    backgroundColor: '#ffffff',
    padding: 8,
    borderRadius: 8,
    marginBottom: 16,
    width: '100%',
  },
  info: {
    fontSize: 18,
    color: 'black',
  },
  fieldTitle: {
    alignSelf: 'flex-start',
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
    paddingLeft: 4,
  },
  lockedFieldNote: {
    fontSize: 12,
    color: 'gray',
    marginBottom: 12,
    alignSelf: 'flex-start',
    paddingLeft: 16,
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
