import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, Button, Image, TouchableOpacity, Alert, TextInput, StyleSheet } from 'react-native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { API_BASE_URL } from '@env';

// Function to construct the CDN URL for images
const getImageUrl = (filename) =>
  `https://interparkenterprisespacebucket.blr1.cdn.digitaloceanspaces.com/Propertypic/${filename}`;

const MyList = () => {
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [agentLandlordId, setAgentLandlordId] = useState('');
  const [editingProperty, setEditingProperty] = useState(null);
  const [newImages, setNewImages] = useState([]);

  useEffect(() => {
    const fetchProperties = async () => {
      try {
        const storedUserId = await AsyncStorage.getItem('userId');
        console.log('Stored User ID:', storedUserId); // Log to check if the userId is valid
  
        if (storedUserId) {
          setAgentLandlordId(storedUserId);
          const requestUrl = `${API_BASE_URL}/properties/agent/${storedUserId}`;
          console.log('Requesting URL:', requestUrl); // Log the final URL to be sure it's correct
  
          const response = await axios.get(requestUrl);
  
          if (response.data.properties && response.data.properties.length === 0) {
            // If no properties found, display the custom message
            Alert.alert('No Properties', 'No Properties have been added yet');
          } else {
            setProperties(response.data.properties);
          }
        } else {
          Alert.alert('Error', 'User ID not found');
        }
      } catch (error) {
        //console.error('Error fetching properties:', error);
        Alert.alert('No Properties', 'No Properties have been added yet');
      } finally {
        setLoading(false);
      }
    };
  
    fetchProperties();
  }, []);
  
  

  const deleteImage = async (propertyId, imageName) => {
    try {
      await axios.delete(`${API_BASE_URL}/properties/images/${imageName}`);
      setProperties((prevProperties) =>
        prevProperties.map((property) =>
          property._id.$oid === propertyId
            ? {
                ...property,
                images: property.images.filter((image) => image !== imageName),
              }
            : property
        )
      );
      Alert.alert('Success', 'Image deleted successfully!');
    } catch (error) {
      console.error('Error deleting image:', error);
      Alert.alert('Error', 'Failed to delete image.');
    }
  };

  const updateProperty = async (propertyId) => {
    if (!editingProperty) return;
    try {
      await axios.put(
        `${API_BASE_URL}/properties/update/${agentLandlordId}/${propertyId}`,
        editingProperty
      );

      if (newImages.length > 0) {
        const formData = new FormData();
        newImages.forEach((image) => {
          formData.append('images', {
            uri: image.uri,
            name: image.uri.split('/').pop(),
            type: 'image/jpeg',
          });
        });

        await axios.put(
          `${API_BASE_URL}/properties/${propertyId}/images`,
          formData,
          { headers: { 'Content-Type': 'multipart/form-data' } }
        );
      }

      setProperties((prevProperties) =>
        prevProperties.map((property) =>
          property._id.$oid === propertyId
            ? { ...property, ...editingProperty }
            : property
        )
      );

      Alert.alert('Success', 'Property updated successfully!');
      setNewImages([]);
      setEditingProperty(null);
    } catch (error) {
      console.error('Error updating property:', error);
      Alert.alert('Error', 'Failed to update property.');
    }
  };

  const deleteProperty = async (propertyId) => {
    try {
      await axios.delete(
        `${API_BASE_URL}/properties/delete/${agentLandlordId}/${propertyId}`
      );
      setProperties(properties.filter((property) => property._id.$oid !== propertyId));
      Alert.alert('Success', 'Property and related chat rooms deleted successfully!');
    } catch (error) {
      console.error('Error deleting property:', error);
      Alert.alert('Error', 'Failed to delete property.');
    }
  };

  const selectImages = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
    });

    if (!result.canceled) {
      setNewImages(result.assets.map((asset) => ({ uri: asset.uri })));
    }
  };

  const renderProperty = ({ item }) => (
    <View style={styles.propertyCard}>
      <Text style={styles.propertyTitle}>{item.title}</Text>
      <Text>{item.location}</Text>
      <Text>Price: Ksh{item.price.$numberDouble}</Text>
      <Text>Purpose: {item.purpose}</Text>
      <View style={styles.imageContainer}>
        {item.images.map((image, index) => (
          <View key={index} style={styles.imageWrapper}>
            <Image
              source={{ uri: getImageUrl(image) }}
              style={styles.image}
            />
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={() => deleteImage(item._id.$oid, image)}
            >
              <Text style={styles.deleteText}>X</Text>
            </TouchableOpacity>
          </View>
        ))}
      </View>
      <Button
        title="Edit Property"
        onPress={() => setEditingProperty({ ...item, price: item.price.$numberDouble })}
      />
      <Button
        title="Delete Property"
        color="red"
        onPress={() => deleteProperty(item._id.$oid)}
      />
      {editingProperty && editingProperty._id.$oid === item._id.$oid && (
        <View style={styles.editForm}>
          <TextInput
            placeholder="Title"
            value={editingProperty.title}
            onChangeText={(text) => setEditingProperty({ ...editingProperty, title: text })}
            style={styles.input}
          />
          <TextInput
            placeholder="Location"
            value={editingProperty.location}
            onChangeText={(text) => setEditingProperty({ ...editingProperty, location: text })}
            style={styles.input}
          />
          <TextInput
            placeholder="Price"
            value={editingProperty.price}
            keyboardType="numeric"
            onChangeText={(text) => setEditingProperty({ ...editingProperty, price: text })}
            style={styles.input}
          />
          <TextInput
            placeholder="Purpose"
            value={editingProperty.purpose}
            onChangeText={(text) => setEditingProperty({ ...editingProperty, purpose: text })}
            style={styles.input}
          />
          <Button title="Select Images" onPress={selectImages} />
          <Button title="Save Changes" onPress={() => updateProperty(item._id.$oid)} />
        </View>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>My Properties</Text>
      {loading ? (
        <Text>Loading properties...</Text>
      ) : properties.length === 0 ? (
        // Display message when there are no properties
        <Text>No Properties have been added yet</Text>
      ) : (
        <FlatList
          data={properties}
          renderItem={renderProperty}
          keyExtractor={(item) => item._id.$oid}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#E0E0E0',
  },
  heading: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    marginTop: 30,
    color: '#231f20'
  },
  propertyCard: {
    marginBottom: 20,
    padding: 10,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  propertyTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 5,
  },
  imageContainer: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  imageWrapper: {
    position: 'relative',
  },
  image: {
    width: 50,
    height: 50,
    marginRight: 5,
  },
  deleteButton: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: 'red',
    padding: 5,
    borderRadius: 15,
  },
  deleteText: {
    color: 'white',
    fontWeight: 'bold',
  },
  editForm: {
    marginTop: 10,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 5,
    padding: 8,
    marginBottom: 10,
  },
});

export default MyList;
