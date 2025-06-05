import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  FlatList, 
  Image, 
  TouchableOpacity, 
  Alert, 
  TextInput, 
  StyleSheet,
  ActivityIndicator 
} from 'react-native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';

const getImageUrl = (filename) =>
  `https://interpark-uploads.nyc3.cdn.digitaloceanspaces.com/Propertypic/${filename}`;

const MyList = () => {
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [agentLandlordId, setAgentLandlordId] = useState('');
  const [editingProperty, setEditingProperty] = useState(null);
  const [newImages, setNewImages] = useState([]);
  const [loadingStates, setLoadingStates] = useState({
    deleteImage: {},
    updateProperty: {},
    deleteProperty: {},
    selectImages: false
  });

  useEffect(() => {
    const fetchProperties = async () => {
      try {
        const storedUserId = await AsyncStorage.getItem('userId');
        
        if (storedUserId) {
          setAgentLandlordId(storedUserId);
          const response = await axios.get(
            `https://interpark-backend.onrender.com/api/properties/agent/${storedUserId}`
          );

          if (response.data.properties && response.data.properties.length === 0) {
            Alert.alert('No Properties', 'No Properties have been added yet');
          } else {
            setProperties(response.data.properties);
          }
        } else {
          Alert.alert('Error', 'User ID not found');
        }
      } catch (error) {
        Alert.alert('No Properties', 'No Properties have been added yet');
      } finally {
        setLoading(false);
      }
    };
  
    fetchProperties();
  }, []);

  const deleteImage = async (propertyId, imageName) => {
    setLoadingStates(prev => ({
      ...prev,
      deleteImage: { ...prev.deleteImage, [`${propertyId}-${imageName}`]: true }
    }));
    
    try {
      await axios.delete(
        `https://interpark-backend.onrender.com/api/properties/images/${imageName}`
      );
      
      setProperties(prevProperties =>
        prevProperties.map(property =>
          property._id.$oid === propertyId
            ? {
                ...property,
                images: property.images.filter(image => image !== imageName),
              }
            : property
        )
      );
      Alert.alert('Success', 'Image deleted successfully!');
    } catch (error) {
      console.error('Error deleting image:', error);
      Alert.alert('Error', 'Failed to delete image.');
    } finally {
      setLoadingStates(prev => ({
        ...prev,
        deleteImage: { ...prev.deleteImage, [`${propertyId}-${imageName}`]: false }
      }));
    }
  };

  const updateProperty = async (propertyId) => {
    if (!editingProperty) return;
    
    setLoadingStates(prev => ({
      ...prev,
      updateProperty: { ...prev.updateProperty, [propertyId]: true }
    }));

    try {
      await axios.put(
        `https://interpark-backend.onrender.com/api/properties/update/${agentLandlordId}/${propertyId}`,
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
          `https://interpark-backend.onrender.com/api/properties/${propertyId}/images`,
          formData,
          { headers: { 'Content-Type': 'multipart/form-data' } }
        );
      }

      setProperties(prevProperties =>
        prevProperties.map(property =>
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
    } finally {
      setLoadingStates(prev => ({
        ...prev,
        updateProperty: { ...prev.updateProperty, [propertyId]: false }
      }));
    }
  };

  const deleteProperty = async (propertyId) => {
    if (!agentLandlordId) {
      Alert.alert('Error', 'Agent ID not available.');
      return;
    }

    setLoadingStates(prev => ({
      ...prev,
      deleteProperty: { ...prev.deleteProperty, [propertyId]: true }
    }));

    try {
      await axios.delete(
        `https://interpark-backend.onrender.com/api/properties/delete/${agentLandlordId}/${propertyId}`
      );

      setProperties(prevProperties =>
        prevProperties.filter(property => property._id !== propertyId)
      );

      Alert.alert('Success', 'Property and related chat rooms deleted successfully!');
    } catch (error) {
      console.error('Error deleting property:', error);
      if (error.response) {
        Alert.alert('Error', error.response.data.error || 'Failed to delete property.');
      } else {
        Alert.alert('Error', 'Network or server error.');
      }
    } finally {
      setLoadingStates(prev => ({
        ...prev,
        deleteProperty: { ...prev.deleteProperty, [propertyId]: false }
      }));
    }
  };

  const selectImages = async () => {
    setLoadingStates(prev => ({ ...prev, selectImages: true }));
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
      });

      if (!result.canceled) {
        setNewImages(result.assets.map(asset => ({ uri: asset.uri })));
      }
    } finally {
      setLoadingStates(prev => ({ ...prev, selectImages: false }));
    }
  };

  const renderProperty = ({ item }) => (
    <View style={styles.propertyCard}>
      <Text style={styles.propertyTitle}>{item.title}</Text>
      <Text>{item.location}</Text>
      <Text>Price: {item.currency}{item.price.$numberDouble}</Text>
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
              disabled={loadingStates.deleteImage[`${item._id.$oid}-${image}`]}
            >
              {loadingStates.deleteImage[`${item._id.$oid}-${image}`] ? (
                <ActivityIndicator color="#808080" size="small" />
              ) : (
                <Text style={styles.deleteText}>X</Text>
              )}
            </TouchableOpacity>
          </View>
        ))}
      </View>

      <TouchableOpacity
        style={styles.editButton}
        onPress={() => setEditingProperty({ 
          ...item, 
          price: item.price.$numberDouble,
          currency: item.currency || 'KSH'
        })}
      >
        <Text style={styles.buttonText}>Edit Property</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.deleteButtonLarge}
        onPress={() => deleteProperty(item._id.$oid)}
        disabled={loadingStates.deleteProperty[item._id.$oid]}
      >
        {loadingStates.deleteProperty[item._id.$oid] ? (
          <ActivityIndicator color="#808080" />
        ) : (
          <Text style={styles.buttonText}>Delete Property</Text>
        )}
      </TouchableOpacity>

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
            placeholder="Currency (KSH/USD)"
            value={editingProperty.currency}
            onChangeText={(text) => setEditingProperty({ ...editingProperty, currency: text.toUpperCase() })}
            style={styles.input}
          />
          <TextInput
            placeholder="Purpose"
            value={editingProperty.purpose}
            onChangeText={(text) => setEditingProperty({ ...editingProperty, purpose: text })}
            style={styles.input}
          />
          
          <TouchableOpacity
            style={styles.selectImagesButton}
            onPress={selectImages}
            disabled={loadingStates.selectImages}
          >
            {loadingStates.selectImages ? (
              <ActivityIndicator color="#808080" />
            ) : (
              <Text style={styles.buttonText}>Select Images</Text>
            )}
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.saveButton}
            onPress={() => updateProperty(item._id.$oid)}
            disabled={loadingStates.updateProperty[item._id.$oid]}
          >
            {loadingStates.updateProperty[item._id.$oid] ? (
              <ActivityIndicator color="#808080" />
            ) : (
              <Text style={styles.buttonText}>Save Changes</Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );


  return (
    <View style={styles.container}>
      <Text style={styles.heading}>My Properties</Text>
      {loading ? (
        <ActivityIndicator size="large" color="#808080" />
      ) : properties.length === 0 ? (
        <Text style={styles.noPropertiesText}>No Properties have been added yet</Text>
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
    color: '#231f20',
    textAlign: 'center'
  },
  noPropertiesText: {
    textAlign: 'center',
    fontSize: 16,
    marginTop: 20,
    color: '#555'
  },
  propertyCard: {
    marginBottom: 20,
    padding: 15,
    backgroundColor: '#fff',
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  propertyTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 5,
    color: '#333'
  },
  imageContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 10,
  },
  imageWrapper: {
    position: 'relative',
    marginRight: 10,
    marginBottom: 10,
  },
  image: {
    width: 80,
    height: 80,
    borderRadius: 5,
  },
  deleteButton: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: 'red',
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 12,
  },
  editForm: {
    marginTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingTop: 15,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    padding: 10,
    marginBottom: 10,
    backgroundColor: '#f9f9f9',
  },
  editButton: {
    backgroundColor: '#005478',
    padding: 12,
    borderRadius: 5,
    marginVertical: 5,
    alignItems: 'center',
  },
  deleteButtonLarge: {
    backgroundColor: '#FF6347',
    padding: 12,
    borderRadius: 5,
    marginVertical: 5,
    alignItems: 'center',
  },
  selectImagesButton: {
    backgroundColor: '#34C759',
    padding: 12,
    borderRadius: 5,
    marginVertical: 5,
    alignItems: 'center',
  },
  saveButton: {
    backgroundColor: '#005478',
    padding: 12,
    borderRadius: 5,
    marginVertical: 5,
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
});

export default MyList;