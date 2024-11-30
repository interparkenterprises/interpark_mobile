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
import { API_BASE_URL } from '@env';
import { useNavigation } from '@react-navigation/native';
import { Asset } from 'expo-asset'; // Import expo-asset


export default function AgentProfile() {
  const [user, setUser] = useState(null);
  const [avatar, setAvatar] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);

  const [newUsername, setNewUsername] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [nationalIdOrPassport, setNationalIdOrPassport] = useState('');
  const [agentNumber, setAgentNumber] = useState('');
  const navigation = useNavigation();
  const [isSaving, setIsSaving] = useState(false); // New state to track saving state


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
    const fetchUserData = async () => {
      try {
        const storedUser = await AsyncStorage.getItem('user');
        if (storedUser) {
          const parsedUser = JSON.parse(storedUser);
          setUser(parsedUser);
          setAvatar(parsedUser.avatar || null);
          setNewUsername(parsedUser.username || '');

          // Preload the avatar if it's available
          if (parsedUser?.avatar) {
            preloadAvatar(parsedUser.avatar);
          }

          await fetchAgentProfile(parsedUser.id); // Fetch the agent profile details
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

  // Get Agent Profile info
  const fetchAgentProfile = async (userId) => {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      const response = await fetch(
        `${API_BASE_URL}/auth/agent-profile/${userId}`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`, // Include the token in the headers
          },
        }
      );

      const data = await response.json();
      if (response.ok) {
        const { profile } = data;
        setPhoneNumber(profile.phoneNumber || '');
        setNationalIdOrPassport(profile.nationalIdOrPassport || '');
        setAgentNumber(profile.agentNumber || '');
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
        `${API_BASE_URL}/auth/upload-avatar/${user.id}`,
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
  const validateFields = () => {
    console.log('Validating fields...');
    if (!phoneNumber.trim() || !nationalIdOrPassport.trim() || !agentNumber.trim()) {
      console.log('Validation failed: Missing required fields.');
      Alert.alert('Validation Error', 'All fields are required.');
      return false;
    }
    console.log('Validation succeeded.');
    return true;
  };

  const handleSaveProfile = async () => {
    console.log('Save Profile button clicked!');
  
    if (!validateFields()) {
      console.log('Validation failed.');
      return;
    }
    console.log('Validation passed.');
  
    setIsSaving(true); // Show activity indicator when saving starts
  
    try {
      const token = await AsyncStorage.getItem('auth_token');
      console.log('Retrieved Token:', token);
  
      if (!token) {
        console.log('No auth token found!');
        Alert.alert('Authentication Error', 'You are not authenticated.');
        setIsSaving(false);
        return;
      }
  
      if (!user?.id) {
        console.log('User ID is missing or invalid!');
        Alert.alert('Error', 'User ID is not found.');
        setIsSaving(false);
        return;
      }
  
      console.log('Making API call...');
      console.log('API URL:', `${API_BASE_URL}/auth/agent-profile/${user.id}`);
      console.log('Request Body:', { phoneNumber, nationalIdOrPassport, agentNumber });
  
      const response = await fetch(`${API_BASE_URL}/auth/agent-profile/${user.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ phoneNumber, nationalIdOrPassport, agentNumber }),
      });
  
      const data = await response.json();
      console.log('Response Status:', response.status);
      console.log('Response Data:', data);
  
      if (response.ok) {
        Alert.alert('Success', 'Profile updated successfully!');
        setUser({ ...user, phoneNumber, nationalIdOrPassport, agentNumber });
        await AsyncStorage.setItem('user', JSON.stringify({ ...user, phoneNumber, nationalIdOrPassport, agentNumber }));
        setIsEditing(false);
      } else {
        throw new Error(data.error || 'Failed to update profile.');
      }
    } catch (error) {
      console.error('Update Error:', error.message || error);
      Alert.alert('Error', error.message || 'An error occurred while updating the profile.');
    } finally {
      setIsSaving(false); // Hide activity indicator when operation finishes
    }
  };
  
  
  
  

  const handleLogout = async () => {
    try {
      const token = await AsyncStorage.getItem('auth_token'); // Retrieve the auth token
  
      const response = await fetch(`${API_BASE_URL}/auth/logout`, {
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
  // Function to exit the app
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
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.myListContainer}>
        <TouchableOpacity
          style={styles.myListButton}
          onPress={() => navigation.navigate('MyList')}
        >
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
      <TextInput
        value={nationalIdOrPassport}
        onChangeText={setNationalIdOrPassport}
        style={styles.input}
        placeholder="National ID / Passport Number"
        placeholderTextColor="black"
      />
      <TextInput
        value={agentNumber}
        onChangeText={setAgentNumber}
        style={styles.input}
        placeholder="Agent Registration Number"
        placeholderTextColor="black"
      />

      <TouchableOpacity
        style={[styles.button, isSaving && { opacity: 0.6 }]} // Dim the button when loading
        onPress={isSaving ? null : handleSaveProfile} // Disable button during save
        disabled={isSaving}
      >
        {isSaving ? (
          <ActivityIndicator size="small" color="#ffffff" />
        ) : (
          <Text style={styles.buttonText}>Save Profile</Text>
        )}
      </TouchableOpacity>


      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.buttonText}>Logout</Text>
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
    backgroundColor: '#585858',
    alignItems: 'center',
    paddingTop: 80,
    paddingHorizontal: 16,
  },
  myListContainer: {
    position: 'absolute',
    top: 16, // Adjust the value to position it vertically
    right: 16, // Adjust the value to position it horizontally
    zIndex: 1, // Ensures the button appears above other elements
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
