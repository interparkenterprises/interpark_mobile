import React, { useState, useEffect } from 'react';
import { 
    View, Text, TextInput, Button, StyleSheet, Alert, ScrollView, Image, TouchableOpacity, 
    KeyboardAvoidingView, Platform 
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import axios from 'axios';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '@env';

export default function AddProperty() {
    const [title, setTitle] = useState('');
    const [location, setLocation] = useState('');
    const [type, setType] = useState('');
    const [price, setPrice] = useState('');
    const [description, setDescription] = useState('');
    const [nearbyPlaces, setNearbyPlaces] = useState('');
    const [images, setImages] = useState([]);
    const [userId, setUserId] = useState(null);
    const [authToken, setAuthToken] = useState(null);
    const [purpose, setPurpose] = useState('BUY'); // Default purpose
    const navigation = useNavigation();

    useEffect(() => {
        const fetchUserData = async () => {
            try {
                const id = await AsyncStorage.getItem('userId');
                const token = await AsyncStorage.getItem('auth_token');
                if (id) setUserId(id);
                if (token) setAuthToken(token);
            } catch (error) {
                console.error('Failed to fetch user data:', error);
            }
        };
        fetchUserData();
    }, []);

    const pickImage = async () => {
        // Request media library permissions
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission Denied', 'Sorry, we need camera roll permissions to make this work!');
            return;
        }
    
        // Launch image library with updated options
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images, // Use 'photo' in an array as specified by the latest version
            allowsMultipleSelection: true,
            quality: 1,
        });
    
        if (!result.canceled) {
            const selectedImages = result.assets ? result.assets.map(asset => asset.uri) : [result.uri];
            setImages(prevImages => [...prevImages, ...selectedImages]);
        }
    };
    
    
    const uploadImages = async () => {
        const formData = new FormData();
        images.forEach((imageUri, index) => {
            formData.append('images', {
                uri: imageUri,
                name: `image_${index}.jpg`,
                type: 'image/jpeg',
            });
        });
    
        try {
            const response = await axios.post(
                `${API_BASE_URL}/properties/upload-images`,
                formData,
                {
                    headers: {
                        'Content-Type': 'multipart/form-data',
                        Authorization: `Bearer ${authToken}`,
                    },
                }
            );
            console.log('Uploaded Images Response:', response.data.images); // Log the uploaded image URLs
            return response.data.images;
        } catch (error) {
            console.error('Image Upload Error:', error);
            Alert.alert('Error', 'Failed to upload images.');
            return null;
        }
    };
    
    const handleSubmit = async () => {
        if (!userId || !authToken) {
            Alert.alert('Error', 'User authentication failed. Please log in again.');
            return;
        }
    
        if (!title || !location || !type || !price || !description || !nearbyPlaces || images.length === 0) {
            Alert.alert('Error', 'All fields are required.');
            return;
        }
    
        const parsedPrice = parseFloat(price);
        if (isNaN(parsedPrice)) {
            Alert.alert('Error', 'Please enter a valid price.');
            return;
        }
    
        const formattedNearbyPlaces = nearbyPlaces.split(',').map(place => place.trim());
        const uploadedImages = await uploadImages();
        if (!uploadedImages) return;
    
        const propertyData = {
            title,
            location,
            type,
            price: parsedPrice,
            description,
            nearbyPlaces: formattedNearbyPlaces,
            agentLandlordId: userId,
            images: uploadedImages, // Ensure image URLs are included
            purpose,
        };
    
        console.log('Final Property Data:', propertyData); // Log final data before sending
    
        try {
            const response = await axios.post(
                `${API_BASE_URL}/properties/add`,
                propertyData,
                {
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${authToken}`,
                    },
                    
                }
            );
            console.log('Property Add Response:', response.data); // Log success response
            Alert.alert('Success', 'Property added successfully!');
            // Reset all fields to initial values
            setTitle('');
            setLocation('');
            setType('');
            setPrice('');
            setDescription('');
            setNearbyPlaces('');
            setImages([]);
            setPurpose('BUY'); // or the default purpose you'd like to reset to
            navigation.navigate('PropertiesList'); // Navigate to PropertiesList after success
        } catch (error) {
            console.error('Add Property Error:', error);
            console.log('Axios Error Details:', error.toJSON()); // Log error details
            Alert.alert('Error', 'Failed to add property.');
        }
    };
    

    return (
        <KeyboardAvoidingView 
            style={{ flex: 1 }} 
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
            <ScrollView contentContainerStyle={styles.scrollContainer}>
                <Text style={styles.title}>Add Property</Text>
                <TextInput 
                    style={styles.input} 
                    placeholder="Title" 
                    placeholderTextColor="#000" 
                    value={title} 
                    onChangeText={setTitle} 
                />
                <TextInput 
                    style={styles.input} 
                    placeholder="Location" 
                    placeholderTextColor="#000" 
                    value={location} 
                    onChangeText={setLocation} 
                />
                <TextInput 
                    style={styles.input} 
                    placeholder="Type" 
                    placeholderTextColor="#000" 
                    value={type} 
                    onChangeText={setType} 
                />
                <TextInput 
                    style={styles.input} 
                    placeholder="Price" 
                    placeholderTextColor="#000" 
                    value={price} 
                    onChangeText={setPrice} 
                    keyboardType="numeric" 
                />
                <TextInput 
                    style={styles.input} 
                    placeholder="Description" 
                    placeholderTextColor="#000" 
                    value={description} 
                    onChangeText={setDescription} 
                    multiline 
                />
                <TextInput 
                    style={styles.input} 
                    placeholder="Nearby Places (comma-separated)" 
                    placeholderTextColor="#000" 
                    value={nearbyPlaces} 
                    onChangeText={setNearbyPlaces} 
                    multiline 
                />
                
                {/* Checkboxes for purpose selection */}
                <View style={styles.checkboxContainer}>
                    <TouchableOpacity onPress={() => setPurpose('BUY')} style={styles.checkbox}>
                        <Text style={styles.checkboxText}>Buy</Text>
                        {purpose === 'BUY' && <View style={styles.checked} />}
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setPurpose('RENT')} style={styles.checkbox}>
                        <Text style={styles.checkboxText}>Rent</Text>
                        {purpose === 'RENT' && <View style={styles.checked} />}
                    </TouchableOpacity>
                </View>

                <TouchableOpacity onPress={pickImage} style={styles.imageButton}>
                    <Text style={styles.buttonText}>Pick Images</Text>
                </TouchableOpacity>
                <View style={styles.imagePreview}>
                    {images.map((imageUri, index) => (
                        <View key={index} style={styles.imageContainer}>
                            <Image source={{ uri: imageUri }} style={styles.image} />
                            <TouchableOpacity 
                                style={styles.removeButton}
                                onPress={() => {
                                    setImages(images.filter((_, i) => i !== index));
                                }}
                            >
                                <Text style={styles.removeButtonText}>X</Text>
                            </TouchableOpacity>
                        </View>        
                    ))}
                </View>
            </ScrollView>
            <View style={styles.buttonContainer}>
                <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
                    <Text style={styles.submitButtonText}>Submit Property</Text>
                </TouchableOpacity>
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    scrollContainer: { 
        flexGrow: 1, 
        padding: 20, 
        backgroundColor: '#585858' // Soft dark background color
    },
    title: { 
        fontSize: 24, 
        fontWeight: 'bold', 
        marginBottom: 20, 
        color: '#fff' 
    },
    input: { 
        borderWidth: 1, 
        borderColor: '#ccc', 
        borderRadius: 8, 
        marginBottom: 15, 
        padding: 10, 
        color: '#000' 
    },
    imageButton: { 
        backgroundColor: '#0288D1', 
        padding: 15, 
        borderRadius: 8, 
        marginBottom: 10 
    },
    buttonText: { 
        color: '#fff', 
        textAlign: 'center', 
        fontWeight: 'bold' 
    },
    imagePreview: { 
        flexDirection: 'row', 
        flexWrap: 'wrap', 
        marginBottom: 15 
    },
    image: { 
        width: 100, 
        height: 100, 
        marginRight: 10, 
        marginBottom: 10, 
        borderRadius: 8 
    },
    imageContainer: { 
        position: 'relative', 
        marginRight: 10, 
        marginBottom: 10 
    },
    removeButton: { 
        position: 'absolute', 
        top: 5, 
        right: 5, 
        backgroundColor: 'rgba(255, 0, 0, 0.7)', 
        borderRadius: 10, 
        width: 20, 
        height: 20, 
        alignItems: 'center', 
        justifyContent: 'center' 
    },
    removeButtonText: { 
        color: '#fff', 
        fontWeight: 'bold', 
        fontSize: 12 
    },
    
    buttonContainer: { 
        padding: 10, 
        backgroundColor: '#2C2C2C' 
    },
    submitButton: { 
        backgroundColor: '#007BFF', 
        padding: 15, 
        borderRadius: 8 
    },
    submitButtonText: { 
        color: '#fff', 
        textAlign: 'center', 
        fontWeight: 'bold' 
    },
    checkboxContainer: { 
        flexDirection: 'row', 
        justifyContent: 'space-around', 
        marginBottom: 15 
    },
    checkbox: { 
        flexDirection: 'row', 
        alignItems: 'center' 
    },
    checkboxText: { 
        color: '#fff', 
        marginRight: 5 
    },
    checked: { 
        width: 20, 
        height: 20, 
        backgroundColor: '#007BFF', 
        borderRadius: 4 
    },
});
