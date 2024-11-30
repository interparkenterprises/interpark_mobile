import React, { useState, useEffect, useRef } from 'react';
import { View,Text,FlatList,Image,TouchableOpacity,StyleSheet, ActivityIndicator, Alert, Modal, ScrollView, 
  Dimensions, TextInput,} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import MapView, { PROVIDER_OSM, Marker } from 'react-native-maps';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { API_BASE_URL, GEOCODING_API_KEY } from '@env';
import { useNavigation, useRoute } from '@react-navigation/native';

const { width } = Dimensions.get('window');

export default function PropertiesList() {
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedImages, setSelectedImages] = useState([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [expandedProperty, setExpandedProperty] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState(''); // Debounced search query
  const [selectedType, setSelectedType] = useState('All'); // Added state for filtering
  const [userRole, setUserRole] = useState('');
  const [favorites, setFavorites] = useState([]);
  const scrollRef = useRef(null);
  const navigation = useNavigation();
  const route = useRoute();
  const { propertyId } = route.params || {};

  const getImageUrl = (filename) =>
    `https://interparkenterprisespacebucket.blr1.cdn.digitaloceanspaces.com/Propertypic/${filename}`;

  const fetchProperties = async (isRefresh = false) => {
    if (isRefresh) setIsRefreshing(true);
    else setLoading(true);

    try {
      const token = await AsyncStorage.getItem('auth_token');
      const response = await fetch(`${API_BASE_URL}/properties/`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error('Failed to fetch properties');

      const data = await response.json();
      setProperties(data.properties || []);
    } catch (error) {
      console.error('Error fetching properties:', error);
      Alert.alert('Error', 'Failed to load properties.');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  const fetchUserRole = async () => {
    try {
      const user = await AsyncStorage.getItem('user');
      if (user) {
        const parsedUser = JSON.parse(user);
        setUserRole(parsedUser.role);
      } else {
        console.warn('User not found in AsyncStorage.');
      }
    } catch (error) {
      console.error('Error fetching user role:', error);
      Alert.alert('Error', 'Failed to load user role.');
    }
  };

  const fetchUserId = async () => {
    try {
      const user = await AsyncStorage.getItem('user');
      if (user) {
        const parsedUser = JSON.parse(user);
        console.log('Parsed User:', parsedUser); // Debug: Log the full user object
  
        // Extract the id property and use it as userId
        if (parsedUser.id) {
          console.log('Fetched User ID:', parsedUser.id); // Debug: Log the userId
          return parsedUser.id;
        } else {
          console.warn('User ID not found in parsed user object.');
          return null;
        }
      } else {
        console.warn('User not found in AsyncStorage.');
        return null;
      }
    } catch (error) {
      console.error('Error fetching userId:', error);
      Alert.alert('Error', 'Failed to load user ID.');
      return null;
    }
  };
  
  

  const toggleFavorite = async (propertyId) => {
    try {
      const userId = await fetchUserId(); // Fetch the userId
      if (!userId) {
        throw new Error('User ID not available');
      }
  
      const isFavorite = favorites.some(
        (item) => item.property._id.$oid === propertyId
      );
      const method = isFavorite ? 'delete' : 'post';
      const endpoint = isFavorite ? '/favorites/remove' : '/favorites/add'; // Adjusted the endpoint
  
      console.log('Toggling favorite:', { method, endpoint, userId, propertyId });
  
      // Make the API request
      const response = await axios({
        method,
        url: `${API_BASE_URL}${endpoint}`,
        data: { userId, propertyId },
      });
  
      console.log('API Response:', response.data);
  
      if (isFavorite) {
        setFavorites(favorites.filter((item) => item.property._id.$oid !== propertyId));
      } else {
        fetchFavorites(userId); // Refetch favorites after adding
      }
    } catch (error) {
      console.error('Error toggling favorite:', error.response?.data || error.message);
      Alert.alert('Error', 'Failed to update favorite');
    }
  };
  

  const fetchFavorites = async (userId) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/favorites/${userId}`);
      setFavorites(response.data.favorites || []);
    } catch (error) {
      //console.error('Error fetching favorites:', error);
      //Alert.alert('Error', 'Failed to load favorites.');
    }
  };

  

  useEffect(() => {
  const fetchData = async () => {
    await fetchUserRole();
    await fetchProperties();

    // Fetch the user ID and load favorites
    const userId = await fetchUserId();
    if (userId) {
      await fetchFavorites(userId); // Fetch and store favorites
    }

    setLoading(false);
  };

  fetchData();
}, []);

  
  useEffect(() => {
    fetchProperties();
  }, []);

  useEffect(() => {
    if (propertyId && properties.length > 0) {
      // Find the index of the property with the matching propertyId
      const index = properties.findIndex(
        (property) => property._id.$oid === propertyId
      );
      if (index !== -1) {
        // Scroll to the property in the FlatList
        scrollRef.current?.scrollToIndex({ index, animated: true });
      }
    }
  }, [propertyId, properties]);
  
  

  const handleChatRoomNavigation = async (propertyId, agentLandlordId) => {
    const clientId = await AsyncStorage.getItem('userId'); // Retrieve client ID from AsyncStorage

    try {
        const response = await axios.post(`${API_BASE_URL}/chat/create`, {
            propertyId: String(propertyId),
            agentLandlordId:  String(agentLandlordId), // Ensure it's a string
            clientId: String(clientId),
        });

        const { id: chatRoomId } = response.data;
        navigation.navigate('ChatRooms', { chatRoomId, clientId, agentLandlordId });
    } catch (error) {
        console.error('Error creating or retrieving chat room:', error);
        Alert.alert('Error', 'Could not open chat room.');
    }
  };
 
  





  const openImageModal = (images, index) => {
    setSelectedImages(images);
    setCurrentIndex(index);
    setIsModalVisible(true);
  };

  const toggleMoreInfo = (propertyId) => {
    setExpandedProperty(expandedProperty === propertyId ? null : propertyId);
  };

  

  const getUniqueTypes = (properties) => {
    const types = properties.map((item) => item.type);
    return ['All', ...new Set(types)];
  };

  const filteredProperties = properties.filter((item) =>
    (selectedType === 'All' || item.type === selectedType) &&
    (item.title.toLowerCase().includes(debouncedQuery.toLowerCase()) ||
      item.location.toLowerCase().includes(debouncedQuery.toLowerCase()) ||
      item.purpose.toLowerCase().includes(debouncedQuery.toLowerCase()))
  );

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 500); // Debounce delay

    return () => {
      clearTimeout(handler); // Cleanup timeout on query change
    };
  }, [searchQuery]);

  const renderProperty = ({ item }) => {
    const price = parseFloat(item.price?.$numberDouble) || 0.0;
    const imageFilenames = item.images || [];
    const propertyLocation = item.location || 'Unknown Location';
    const propertyPurpose = item.purpose || 'Unknown Purpose';
      // Check if the property is in favorites
    const isFavorite = favorites.some(fav => fav.property._id.$oid === item._id.$oid);
    return (
      <View style={styles.propertyCard}>
        {imageFilenames.length > 0 ? (
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            style={styles.imageScroll}
          >
            {imageFilenames.map((filename, index) => (
              <TouchableOpacity key={index} onPress={() => openImageModal(imageFilenames, index)}>
                <Image
                  source={{ uri: getImageUrl(filename) }}
                  style={styles.propertyImage}
                  onError={(e) => console.error('Image load error:', e.nativeEvent.error)}
                />
              </TouchableOpacity>
            ))}
          </ScrollView>
        ) : (
          <View style={styles.placeholderImage}>
            <Text style={styles.placeholderText}>No Images Available</Text>
          </View>
        )}
        <View style={styles.propertyInfo}>
          <Text style={styles.propertyTitle}>{item.title || 'Untitled Property'}</Text>
          {/* Heart icon for favorites */}
          {userRole === 'CLIENT' && ( 
            <TouchableOpacity
            onPress={() => toggleFavorite(item._id.$oid)}
            style={styles.favoriteIconContainer}
          >
            <Ionicons
              name={isFavorite ? 'heart' : 'heart-outline'}
              size={30}
              color={isFavorite ? '#ffcc00' : '#ffffff'} // Orange when favorited
              style={styles.favoriteIcon}
            />
          </TouchableOpacity>

          )}
          

          <View style={styles.locationContainer}>
            <TouchableOpacity onPress={() => toggleMoreInfo(item._id.$oid)}>
              <Ionicons name="location-outline" size={20} color="#ffffff" />
            </TouchableOpacity>
            <Text style={styles.propertyLocation}>{propertyLocation}</Text>
          </View>

          <Text style={styles.propertyPrice}>Ksh{price.toFixed(2)}</Text>
          <Text style={styles.propertyPurpose}>{propertyPurpose}</Text>

          {userRole === 'CLIENT' && (
            <TouchableOpacity
              onPress={() => handleChatRoomNavigation(item._id.$oid, item.agentLandlordId.$oid)}
            >
              <Ionicons name="chatbubbles-outline" size={25} color="#ffcc00" style={styles.messageIcon} />
            </TouchableOpacity>
          )}
          
          
          <TouchableOpacity onPress={() => toggleMoreInfo(item._id.$oid)} style={styles.moreInfoContainer}>
            <Text style={styles.moreInfoText}>More Info</Text>
          </TouchableOpacity>

          {expandedProperty === item._id.$oid && (
            <View style={styles.additionalInfo}>
              <Text style={styles.infoHeading}>Type</Text>
              <Text style={styles.infoText}>{item.type}</Text>

              <Text style={styles.infoHeading}>Description</Text>
              <Text style={styles.infoText}>{item.description}</Text>

              <Text style={styles.infoHeading}>Nearby Places</Text>
              <Text style={styles.infoText}>{item.nearbyPlaces.join(', ')}</Text>

              <MapViewComponent location={propertyLocation} />
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.searchBar}
        placeholder="Search for your type"
        placeholderTextColor="#dddddd"
        value={searchQuery}
        onChangeText={setSearchQuery}
      />

      {/* Filter Bar */}
      <View style={styles.filterBar}>
        {getUniqueTypes(properties).map((type) => (
          <TouchableOpacity
            key={type}
            style={[styles.filterButton, selectedType === type && styles.activeFilterButton]}
            onPress={() => setSelectedType(type)}
          >
            <Text style={styles.filterText}>{type}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#0000ff" />
      ) : filteredProperties.length > 0 ? (
        <FlatList
          ref={scrollRef}
          data={filteredProperties}
          renderItem={renderProperty}
          keyExtractor={(item) => item._id.$oid}
          contentContainerStyle={styles.listContainer}
          refreshing={isRefreshing}
          onRefresh={() => fetchProperties(true)}
        />
      ) : (
        <Text style={styles.noResultsText}>No such property exists yet.</Text>
      )}

      <Modal visible={isModalVisible} animationType="slide" onRequestClose={() => setIsModalVisible(false)}>
        <View style={styles.modalContainer}>
          <ScrollView
            ref={scrollRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            contentOffset={{ x: currentIndex * width }}
          >
            {selectedImages.map((image, index) => (
              <Image
                key={index}
                source={{ uri: getImageUrl(image) }}
                style={styles.fullscreenImage}
                resizeMode="contain"
              />
            ))}
          </ScrollView>
          <TouchableOpacity onPress={() => setIsModalVisible(false)} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>Close</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}

function MapViewComponent({ location }) {
  const [coordinates, setCoordinates] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchCoordinates = async () => {
      try {
        const coords = await getCoordinates(location);
        if (coords) {
          setCoordinates(coords);
        } else {
          setError('No results found for the specified location.');
        }
      } catch (e) {
        setError('Failed to fetch coordinates.');
      }
    };
    fetchCoordinates();
  }, [location]);

  const getCoordinates = async (location) => {
    try {
      const response = await axios.get('https://api.opencagedata.com/geocode/v1/json', {
        params: {
          q: location,
          key: GEOCODING_API_KEY,
        },
      });

      if (response.data.results.length > 0) {
        const { geometry } = response.data.results[0];
        return {
          latitude: geometry.lat,
          longitude: geometry.lng,
        };
      }
      return null;
    } catch (error) {
      console.error('Error fetching coordinates:', error);
      throw error;
    }
  };

  if (error) {
    return <Text style={styles.error}>{error}</Text>;
  }

  return coordinates ? (
    <MapView
      provider={PROVIDER_OSM} // Use OpenStreetMap as the provider
      style={styles.map}
      initialRegion={{
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      }}
    >
      <Marker coordinate={coordinates} title={location} />
    </MapView>
  ) : (
    <Text style={styles.mapPlaceholder}>Loading Map...</Text>
  );
}


// Define the styles
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#58595b' },
  searchBar: { backgroundColor: '#231F20', color: '#ffffff', padding: 10, margin: 10,marginTop: 30, borderRadius: 8 },
  filterBar: { flexDirection: 'row', justifyContent: 'center', marginVertical: 10 },
  filterButton: { paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20, backgroundColor: '#005478', marginHorizontal: 5 },
  activeFilterButton: { backgroundColor: '#ffcc00' },
  filterText: { color: '#ffffff', fontSize: 14 },
  noResultsText: { color: '#ffffff', textAlign: 'center', marginTop: 20 },
  loaderContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#231F20' },
  propertyCard: { backgroundColor: '#231F20', borderRadius: 10, padding: 10, marginVertical: 8, marginHorizontal: 16 },
  propertyImage: { width: width - 40, height: 200, borderRadius: 10 },
  imageScroll: { height: 200 },
  propertyInfo: { paddingVertical: 10 },
  messageIcon: {marginLeft: 280 },
  favoriteIconContainer: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 1, // Ensure it overlays on top of the image
  },
  favoriteIcon: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)', // Semi-transparent background
    borderRadius: 15, // Make the icon circular
    padding: 5, // Space around the icon
  },
  propertyTitle: { fontSize: 18, fontWeight: 'bold', color: '#ffffff' },
  locationContainer: { flexDirection: 'row', alignItems: 'center', marginTop: 5 },
  propertyLocation: { color: '#cccccc', marginLeft: 5 },
  propertyPrice: { fontSize: 16, fontWeight: 'bold', color: '#ffcc00', marginTop: 5 },
  propertyPurpose: { fontSize: 14, color: '#cccccc', marginTop: 5 },
  moreInfoContainer: { marginTop: 10, flexDirection: 'row', alignItems: 'center' },
  moreInfoText: { fontSize: 16, color: '#ffffff', textDecorationLine: 'underline' },
  additionalInfo: { marginTop: 10, padding: 10, backgroundColor: '#444444', borderRadius: 8 },
  infoHeading: { fontSize: 16, fontWeight: 'bold', color: '#ffffff', marginTop: 5 },
  infoText: { color: '#dddddd', marginTop: 2 },
  map: { height: 200, width: '100%', marginTop: 10, borderRadius: 8 },
  loadingMapText: { color: '#ffffff', textAlign: 'center', marginTop: 10 },
  modalContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' },
  fullscreenImage: { width, height: '100%' },
  closeButton: { position: 'absolute', top: 20, marginTop: 30, right: 20 },
  closeButtonText: { color: '#ffffff', fontSize: 18 },
});

