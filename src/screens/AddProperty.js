import React, { useState, useEffect } from 'react';
import { 
    View, Text, TextInput, Button, StyleSheet, Alert, ScrollView, Image, TouchableOpacity, 
    KeyboardAvoidingView, Platform, ActivityIndicator 
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import axios from 'axios';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '@env';
import DropDownPicker from 'react-native-dropdown-picker'; // Import DropDownPicker


export default function AddProperty() {
    const [title, setTitle] = useState('');
    const [location, setLocation] = useState('');
    const [type, setType] = useState('');
    const [items, setItems] = useState([ // Items for dropdown
        { label: 'Apartment', value: 'Apartment' },
        { label: 'Villa', value: 'Villa' },
        { label: 'Mansion', value: 'Mansion' },
        { label: 'Cottage', value: 'Cottage' },
        { label: 'Townhouse', value: 'Townhouse' },
        { label: 'Penthouse', value: 'Penthouse' },
        { label: 'Studio', value: 'Studio' },
        { label: 'Duplex', value: 'Duplex' },
        { label: 'Bungalow', value: 'Bungalow' },
        { label: 'Farmhouse', value: 'Farmhouse' },
        { label: 'Loft', value: 'Loft' },
        { label: 'Condo', value: 'Condo' },
        { label: 'Mobile Home', value: 'Mobile Home' },
        { label: 'Hotel', value: 'Hotel' },
        { label: 'Warehouse', value: 'Warehouse' },
        { label: 'Retail Space', value: 'Retail Space' },
        { label: 'Office Space', value: 'Office Space' },
        { label: 'Industrial', value: 'Industrial' },
        { label: 'Commercial Property', value: 'Commercial Property' },
        { label: 'Land', value: 'Land' },
    ]);

    const [price, setPrice] = useState('');
    const [description, setDescription] = useState('');
    const [nearbyPlaces, setNearbyPlaces] = useState('');
    const [images, setImages] = useState([]);
    const [userId, setUserId] = useState(null);
    const [authToken, setAuthToken] = useState(null);
    const [purpose, setPurpose] = useState('BUY'); // Default purpose
    const navigation = useNavigation();
    const [isLoading, setIsLoading] = useState(false);
    const [open, setOpen] = useState(false);

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
        if (images.length < 5) {
            Alert.alert('Error', 'Images uploaded are less than the required, please add more to submit.');
            return;
        }
        if (images.length > 7) {
            Alert.alert('Error', 'You have uploaded more than the allowed 7 images. Please remove some images.');
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
        setIsLoading(true); // Start loading
        const uploadedImages = await uploadImages();
        if (!uploadedImages) {
            setIsLoading(false); // Stop loading on error
            return;
        }
    
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
            console.log('Property Add Response:', response.data);
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
        } finally {
            setIsLoading(false); // Stop loading after success or error
        }
    };
    
    

    return (
        <KeyboardAvoidingView 
            style={{ flex: 1 }} 
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
            <ScrollView 
                contentContainerStyle={styles.scrollContainer}
                keyboardShouldPersistTaps="handled"
                nestedScrollEnabled
            >
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
                
                <DropDownPicker
                    open={open}
                    value={type}
                    items={items}
                    setOpen={setOpen}
                    setValue={setType}
                    setItems={setItems}
                    placeholder="Select a property type"
                    containerStyle={styles.dropdownContainer}
                    style={styles.dropdown}
                    dropDownContainerStyle={styles.dropdownList}
                    listMode="SCROLLVIEW" // Use ScrollView instead of FlatList
                    nestedScrollEnabled={true}
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
                {/* Disclaimer Message */}
                <Text style={styles.disclaimerText}>
                    The number of images to be uploaded should be at least 5 and at most 7.
                </Text>
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
                <TouchableOpacity 
                    style={[styles.submitButton, isLoading && { backgroundColor: '#aaa' }]} 
                    onPress={handleSubmit} 
                    disabled={isLoading} // Disable the button when loading
                >
                    {isLoading ? (
                        <View style={styles.loadingContainer}>
                            <ActivityIndicator size="small" color="#fff" />
                            <Text style={styles.loadingText}>Submitting...</Text>
                        </View>
                    ) : (
                        <Text style={styles.submitButtonText}>Submit Property</Text>
                    )}
                </TouchableOpacity>
            </View>

        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    scrollContainer: { 
        flexGrow: 1, 
        padding: 20, 
        backgroundColor: '#E0E0E0' // Soft dark background color
    },
    title: { 
        fontSize: 24, 
        fontWeight: 'bold', 
        marginBottom: 20, 
        marginTop: 30,
        color: '#231f20' 
    },
    input: { 
        borderWidth: 1, 
        borderColor: '#ccc', 
        borderRadius: 8, 
        marginBottom: 15, 
        padding: 10, 
        color: '#000' 
    },
    label: {
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 5,
        color: '#231f20',
    },
    dropdownContainer: {
        marginBottom: 15,
        height: 40,
    },
    dropdown: {
        borderWidth: 1,
        borderColor: '#ccc',
        borderRadius: 8,
        paddingHorizontal: 10,
    },
    dropdownList: {
        borderWidth: 1,
        borderColor: '#ccc',
    },
    imageButton: { 
        backgroundColor: '#005478', 
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
    disclaimerText: {
        color: '#FF0000', // Red color for emphasis
        marginBottom: 10,
        textAlign: 'center',
        fontSize: 10,
    },
    
    buttonContainer: { 
        padding: 10, 
        backgroundColor: '#231F20' 
    },
    submitButton: { 
        backgroundColor: '#005478', 
        padding: 15, 
        borderRadius: 8 
    },
    submitButtonText: { 
        color: '#fff', 
        textAlign: 'center', 
        fontWeight: 'bold' 
    },
    loadingContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    loadingText: {
        color: '#fff',
        marginLeft: 10,
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
        color: '#231f20', 
        marginRight: 5 
    },
    checked: { 
        width: 20, 
        height: 20, 
        backgroundColor: '#007BFF', 
        borderRadius: 4 
    },
});
