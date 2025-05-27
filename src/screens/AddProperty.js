import React, { useState, useEffect } from 'react';
import {
    View, Text, TextInput, Alert, ScrollView, Image, TouchableOpacity,
    KeyboardAvoidingView, Platform, ActivityIndicator, StyleSheet
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import axios from 'axios';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DropDownPicker from 'react-native-dropdown-picker';

export default function AddProperty() {
    const [title, setTitle] = useState('');
    const [location, setLocation] = useState('');
    const [type, setType] = useState('');
    const [items, setItems] = useState([
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
    const [descriptionWordCount, setDescriptionWordCount] = useState(0);
    const [nearbyPlaces, setNearbyPlaces] = useState('');
    const [images, setImages] = useState([]);
    const [userId, setUserId] = useState(null);
    const [authToken, setAuthToken] = useState(null);
    const [purpose, setPurpose] = useState('BUY');
    const [isLoading, setIsLoading] = useState(false);
    const [open, setOpen] = useState(false);
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

    const countWords = text => {
        const trimmed = text.trim();
        return trimmed ? trimmed.split(/\s+/).length : 0;
    };

    const pickImage = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission Denied', 'Camera roll permission is required!');
            return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsMultipleSelection: true,
            quality: 1,
        });
        if (!result.canceled) {
            const selectedImages = result.assets ? result.assets.map(a => a.uri) : [result.uri];
            setImages(prev => [...prev, ...selectedImages]);
        }
    };

    const uploadImages = async () => {
        const formData = new FormData();
        images.forEach((uri, idx) => {
            formData.append('images', {
                uri,
                name: `image_${idx}.jpg`,
                type: 'image/jpeg',
            });
        });

        try {
            const response = await axios.post(
                'https://interpark-backend.onrender.com/api/properties/upload-images',
                formData,
                {
                    headers: {
                        'Content-Type': 'multipart/form-data',
                        Authorization: `Bearer ${authToken}`,
                    },
                }
            );
            return {
                images: response.data.images,
                imageResult: response.data.imageResult,
            };
        } catch (error) {
            console.error('Image Upload Error:', error.response?.data || error.message);
            Alert.alert('Error', 'Image upload or validation failed.');
            return null;
        }
    };

    const handleSubmit = async () => {
        if (purpose !== 'BUY' && purpose !== 'RENT') {
            Alert.alert('Error', 'Please select BUY or RENT.');
            return;
        }
        if (descriptionWordCount > 400) {
            Alert.alert('Error', `Description exceeds 400 words.`);
            return;
        }
        if (!userId || !authToken) {
            Alert.alert('Error', 'User authentication failed.');
            return;
        }
        if (images.length < 5 || images.length > 7) {
            Alert.alert('Error', 'Upload between 5 and 7 images.');
            return;
        }
        if (!title || !location || !type || !price || !description || !nearbyPlaces) {
            Alert.alert('Error', 'All fields are required.');
            return;
        }
        const parsedPrice = parseFloat(price);
        if (isNaN(parsedPrice)) {
            Alert.alert('Error', 'Enter a valid price.');
            return;
        }

        setIsLoading(true);

        const uploadResult = await uploadImages();
        if (!uploadResult) {
            setIsLoading(false);
            return;
        }

        const payload = {
            title,
            location,
            type,
            price: parsedPrice,
            description,
            nearbyPlaces: nearbyPlaces.split(',').map(p => p.trim()),
            agentLandlordId: userId,
            images: uploadResult.images,
            purpose,
            imageResult: uploadResult.imageResult
        };

        navigation.navigate('AIProcessingScreen', {
            endpoint: 'https://interpark-backend.onrender.com/api/properties/add',
            payload,
            onSuccessRedirect: 'PropertiesList',
            successMessageKey: 'message',
        });

        setIsLoading(false);
    };



    return (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled" nestedScrollEnabled>
                <Text style={styles.title}>Add Property</Text>
                <TextInput style={styles.input} placeholder="Title" placeholderTextColor="#000" value={title} onChangeText={setTitle} />
                <TextInput style={styles.input} placeholder="Location" placeholderTextColor="#000" value={location} onChangeText={setLocation} />
                <DropDownPicker
                    open={open} value={type} items={items}
                    setOpen={setOpen} setValue={setType} setItems={setItems}
                    placeholder="Select a property type" containerStyle={styles.dropdownContainer}
                    style={styles.dropdown} dropDownContainerStyle={styles.dropdownList}
                    listMode="SCROLLVIEW" nestedScrollEnabled
                />
                <TextInput style={styles.input} placeholder="Price" placeholderTextColor="#000" value={price} onChangeText={setPrice} keyboardType="numeric" />
                <TextInput
                    style={[styles.input, { height: 100 }]}
                    placeholder="Description" placeholderTextColor="#000"
                    value={description}
                    onChangeText={text => { setDescription(text); setDescriptionWordCount(countWords(text)); }}
                    multiline
                />
                <Text style={[styles.wordCount, descriptionWordCount > 400 && styles.errorText]}>Words: {descriptionWordCount}/400</Text>
                {descriptionWordCount > 400 && (
                    <Text style={styles.errorText}>Description exceeds the 400-word limit.</Text>
                )}
                <TextInput style={styles.input} placeholder="Nearby Places (comma-separated)" placeholderTextColor="#000" value={nearbyPlaces} onChangeText={setNearbyPlaces} multiline />
                <View style={styles.checkboxContainer}>
                    <TouchableOpacity onPress={() => setPurpose('BUY')} style={styles.checkbox}>
                        <Text style={styles.checkboxText}>Buy</Text>{purpose === 'BUY' && <View style={styles.checked} />}
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setPurpose('RENT')} style={styles.checkbox}>
                        <Text style={styles.checkboxText}>Rent</Text>{purpose === 'RENT' && <View style={styles.checked} />}
                    </TouchableOpacity>
                </View>
                <TouchableOpacity onPress={pickImage} style={styles.imageButton}>
                    <Text style={styles.buttonText}>Pick Images</Text>
                </TouchableOpacity>
                <Text style={styles.disclaimerText}>The number of images to be uploaded should be at least 5 and at most 7.</Text>
                <View style={styles.imagePreview}>
                    {images.map((uri, i) => (
                        <View key={i} style={styles.imageContainer}>
                            <Image source={{ uri }} style={styles.image} />
                            <TouchableOpacity style={styles.removeButton} onPress={() => setImages(imgs => imgs.filter((_, idx) => idx !== i))}>
                                <Text style={styles.removeButtonText}>X</Text>
                            </TouchableOpacity>
                        </View>
                    ))}
                </View>
            </ScrollView>
            <View style={styles.buttonContainer}>
                <TouchableOpacity style={[styles.submitButton, (isLoading || descriptionWordCount > 400) && { backgroundColor: '#aaa' }]} onPress={handleSubmit} disabled={isLoading || descriptionWordCount > 400}>
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
    scrollContainer: { flexGrow: 1, padding: 20, backgroundColor: '#E0E0E0' },
    title: { fontSize: 24, fontWeight: 'bold', marginBottom: 20, marginTop: 30, color: '#231f20' },
    input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, marginBottom: 15, padding: 10, color: '#000' },
    dropdownContainer: { marginBottom: 15, height: 40 },
    dropdown: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, paddingHorizontal: 10 },
    dropdownList: { borderWidth: 1, borderColor: '#ccc' },
    wordCount: { alignSelf: 'flex-end', marginBottom: 10, fontSize: 12, color: '#000' },
    errorText: { color: '#FF0000', fontSize: 12, marginBottom: 10 },
    imageButton: { backgroundColor: '#005478', padding: 15, borderRadius: 8, marginBottom: 10 },
    buttonText: { color: '#fff', textAlign: 'center', fontWeight: 'bold' },
    disclaimerText: { color: '#FF0000', marginBottom: 10, textAlign: 'center', fontSize: 10 },
    imagePreview: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 15 },
    image: { width: 100, height: 100, marginRight: 10, marginBottom: 10, borderRadius: 8 },
    imageContainer: { position: 'relative', marginRight: 10, marginBottom: 10 },
    removeButton: { position: 'absolute', top: 5, right: 5, backgroundColor: 'rgba(255, 0, 0, 0.7)', borderRadius: 10, width: 20, height: 20, alignItems: 'center', justifyContent: 'center' },
    removeButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 12 },
    buttonContainer: { padding: 10, backgroundColor: '#231F20' },
    submitButton: { backgroundColor: '#005478', padding: 15, borderRadius: 8 },
    submitButtonText: { color: '#fff', textAlign: 'center', fontWeight: 'bold' },
    loadingContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
    loadingText: { color: '#fff', marginLeft: 10 },
    checkboxContainer: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 15 },
    checkbox: { flexDirection: 'row', alignItems: 'center' },
    checkboxText: { color: '#231f20', marginRight: 5 },
    checked: { width: 20, height: 20, backgroundColor: '#007BFF', borderRadius: 4 }
});
