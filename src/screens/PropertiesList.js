import React, { useState, useEffect, useRef } from 'react';
import { View,Text,FlatList,Image,TouchableOpacity,StyleSheet, ActivityIndicator, Alert, Modal, ScrollView, 
  Dimensions, TextInput } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

import Ionicons from 'react-native-vector-icons/Ionicons';
import { API_BASE_URL } from '@env';
import { useNavigation, useRoute } from '@react-navigation/native';
import Slider from '@react-native-community/slider';
import { useAuth } from '../contexts/AuthContext'; // Import the AuthContext

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
  const [favorites, setFavorites] = useState([]);
  
  // Price range filter states
  const [selectedCurrency, setSelectedCurrency] = useState('All');
  const [priceRange, setPriceRange] = useState([0, 1000000]);
  const [maxPrice, setMaxPrice] = useState(1000000);
  const [showPriceFilter, setShowPriceFilter] = useState(false);
  
  const scrollRef = useRef(null);
  const navigation = useNavigation();
  const route = useRoute();
  const { propertyId } = route.params || {};

  // Use AuthContext for user data
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();

  const getImageUrl = (filename) =>
    `https://interpark-uploads.nyc3.cdn.digitaloceanspaces.com/Propertypic/${filename}`;

  // Calculate price range based on properties
  const calculatePriceRange = (properties) => {
    if (properties.length === 0) return { min: 0, max: 1000000 };
    
    const prices = properties.map(item => parseFloat(item.price?.$numberDouble) || 0);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    
    return { min: Math.floor(min), max: Math.ceil(max) };
  };

  const fetchProperties = async (isRefresh = false) => {
    if (isRefresh) setIsRefreshing(true);
    else setLoading(true);

    try {
      const token = await AsyncStorage.getItem('userToken') || await AsyncStorage.getItem('auth_token');
      const response = await fetch(`https://interpark-backend.onrender.com/api/properties/`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error('Failed to fetch properties');

      const data = await response.json();
      const propertiesData = data.properties || [];
      setProperties(propertiesData);
      
      // Calculate and set price range
      const { min, max } = calculatePriceRange(propertiesData);
      setMaxPrice(max);
      setPriceRange([min, max]);
    } catch (error) {
      console.error('Error fetching properties:', error);
      Alert.alert('Error', 'Failed to load properties.');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  const toggleFavorite = async (propertyId) => {
    try {
      if (!user || !user.id) {
        Alert.alert('Error', 'Please log in to add favorites');
        return;
      }

      const userId = user.id;
      const isFavorite = favorites.some(
        (item) => item.property._id.$oid === propertyId
      );
      const method = isFavorite ? 'delete' : 'post';
      const endpoint = isFavorite ? '/favorites/remove' : '/favorites/add';

      console.log('Toggling favorite:', { method, endpoint, userId, propertyId });

      // Make the API request
      const response = await axios({
        method,
        url: `https://interpark-backend.onrender.com/api${endpoint}`,
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
    if (!userId) return;
    
    try {
      const response = await axios.get(`https://interpark-backend.onrender.com/api/favorites/${userId}`);
      setFavorites(response.data.favorites || []);
    } catch (error) {
      console.error('Error fetching favorites:', error);
      // Don't show alert for favorites error as it's not critical
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      console.log('Starting data fetch. Auth loading:', authLoading, 'User:', user);
      
      // Wait for auth to finish loading
      if (authLoading) {
        return;
      }

      await fetchProperties();

      // Fetch favorites if user is a client and authenticated
      if (user && user.id && user.role === 'CLIENT') {
        console.log('Fetching favorites for client user:', user.id);
        await fetchFavorites(user.id);
      }

      setLoading(false);
    };

    fetchData();
  }, [user, authLoading]); // Add user and authLoading as dependencies

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
    const clientId = user?.id || await AsyncStorage.getItem('userId');

    try {
        const response = await axios.post(`https://interpark-backend.onrender.com/api/chat/create`, {
            propertyId: String(propertyId),
            agentLandlordId:  String(agentLandlordId),
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

  const getUniqueCurrencies = (properties) => {
    const currencies = properties.map((item) => item.currency || 'Ksh');
    return ['All', ...new Set(currencies)];
  };

  const formatPrice = (price) => {
    if (price >= 1000000) {
      return (price / 1000000).toFixed(1) + 'M';
    } else if (price >= 1000) {
      return (price / 1000).toFixed(0) + 'K';
    } else {
      return price.toString();
    }
  };

  const resetPriceFilter = () => {
    const { min, max } = calculatePriceRange(properties);
    setPriceRange([min, max]);
    setSelectedCurrency('All');
  };

  const filteredProperties = properties.filter((item) => {
    const price = parseFloat(item.price?.$numberDouble) || 0;
    const currency = item.currency || 'Ksh';
    
    const matchesSearch = (selectedType === 'All' || item.type === selectedType) &&
      (item.title.toLowerCase().includes(debouncedQuery.toLowerCase()) ||
        item.location.toLowerCase().includes(debouncedQuery.toLowerCase()) ||
        item.purpose.toLowerCase().includes(debouncedQuery.toLowerCase()));
    
    const matchesCurrency = selectedCurrency === 'All' || currency === selectedCurrency;
    const matchesPrice = price >= priceRange[0] && price <= priceRange[1];
    
    return matchesSearch && matchesCurrency && matchesPrice;
  });

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
    const currency = item.currency || 'Ksh';
    const imageFilenames = item.images || [];
    const propertyLocation = item.location || 'Unknown Location';
    const propertyPurpose = item.purpose || 'Unknown Purpose';
    // Check if the property is in favorites
    const isFavorite = favorites.some(fav => fav.property._id.$oid === item._id.$oid);
    
    // Get user role - use context user data
    const userRole = user?.role;
    const isClient = userRole === 'CLIENT';
    
    console.log('Rendering property, userRole:', userRole, 'isClient:', isClient, 'user:', user);
    
    return (
      <View style={styles.propertyCard}>
        <View style={styles.imageContainer}>
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
          
          {/* Heart icon for favorites - positioned over the image */}
          {isClient && (
            <TouchableOpacity
              onPress={() => toggleFavorite(item._id.$oid)}
              style={styles.favoriteIconContainer}
            >
              <Ionicons
                name={isFavorite ? 'heart' : 'heart-outline'}
                size={30}
                color={isFavorite ? '#ff6b6b' : '#ffffff'}
                style={styles.favoriteIcon}
              />
            </TouchableOpacity>
          )}
          
          {/* Chat icon for clients */}
          {isClient && (
            <TouchableOpacity
              onPress={() => handleChatRoomNavigation(item._id.$oid, item.agentLandlordId.$oid)}
              style={styles.messageIconContainer}
            >
              <Ionicons name="chatbubbles-outline" size={25} color="#ffffff" style={styles.messageIcon} />
            </TouchableOpacity>
          )}
        </View>
        
        <View style={styles.propertyInfo}>
          <Text style={styles.propertyTitle}>{item.title || 'Untitled Property'}</Text>

          <View style={styles.locationContainer}>
            <TouchableOpacity onPress={() => toggleMoreInfo(item._id.$oid)}>
              <Ionicons name="location-outline" size={20} color="#ffffff" />
            </TouchableOpacity>
            <Text style={styles.propertyLocation}>{propertyLocation}</Text>
          </View>

          <Text style={styles.propertyPrice}>{currency} {price.toFixed(2)}</Text>
          <Text style={styles.propertyPurpose}>{propertyPurpose}</Text>
          
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

              <TouchableOpacity
                onPress={() => navigation.navigate('MapPlace', { location: propertyLocation })}
                style={styles.viewMapButton}
              >
                <Text style={styles.viewMapText}>View Map</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    );
  };

  // Show loading if auth is still loading
  if (authLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#005478" style={{ marginTop: 50 }} />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.searchBar}
        placeholder="Search for your type"
        placeholderTextColor="#1B1B1B"
        value={searchQuery}
        onChangeText={setSearchQuery}
      />

      {/* Filter Bar - Updated with ScrollView for horizontal scrolling */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterBarContainer}
        style={styles.filterBarScrollView}
      >
        {getUniqueTypes(properties).map((type) => (
          <TouchableOpacity
            key={type}
            style={[styles.filterButton, selectedType === type && styles.activeFilterButton]}
            onPress={() => setSelectedType(type)}
          >
            <Text style={styles.filterText}>{type}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Price Filter Section */}
      <View style={styles.priceFilterContainer}>
        <TouchableOpacity
          style={styles.priceFilterHeader}
          onPress={() => setShowPriceFilter(!showPriceFilter)}
        >
          <View style={styles.priceHeaderContent}>
            <Ionicons name="pricetag-outline" size={20} color="#005478" />
            <Text style={styles.priceFilterTitle}>Price Range</Text>
            <Text style={styles.priceRangeDisplay}>
              {selectedCurrency !== 'All' ? selectedCurrency : ''} {formatPrice(priceRange[0])} - {formatPrice(priceRange[1])}
            </Text>
          </View>
          <Ionicons 
            name={showPriceFilter ? 'chevron-up' : 'chevron-down'} 
            size={20} 
            color="#005478" 
          />
        </TouchableOpacity>

        {showPriceFilter && (
          <View style={styles.priceFilterContent}>
            {/* Currency Filter */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.currencyScrollView}
            >
              {getUniqueCurrencies(properties).map((currency) => (
                <TouchableOpacity
                  key={currency}
                  style={[
                    styles.currencyButton,
                    selectedCurrency === currency && styles.activeCurrencyButton
                  ]}
                  onPress={() => setSelectedCurrency(currency)}
                >
                  <Text style={[
                    styles.currencyText,
                    selectedCurrency === currency && styles.activeCurrencyText
                  ]}>
                    {currency}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Price Range Slider */}
            <View style={styles.sliderContainer}>
              <View style={styles.sliderLabels}>
                <Text style={styles.sliderLabel}>
                  {selectedCurrency !== 'All' ? selectedCurrency : ''} {formatPrice(priceRange[0])}
                </Text>
                <Text style={styles.sliderLabel}>
                  {selectedCurrency !== 'All' ? selectedCurrency : ''} {formatPrice(priceRange[1])}
                </Text>
              </View>
              
              <View style={styles.slidersContainer}>
                {/* Min Price Slider */}
                <Slider
                  style={styles.slider}
                  minimumValue={0}
                  maximumValue={maxPrice}
                  value={priceRange[0]}
                  onValueChange={(value) => 
                    setPriceRange([Math.min(value, priceRange[1] - 1000), priceRange[1]])
                  }
                  minimumTrackTintColor="#005478"
                  maximumTrackTintColor="#cccccc"
                  thumbStyle={styles.sliderThumb}
                  trackStyle={styles.sliderTrack}
                />
                
                {/* Max Price Slider */}
                <Slider
                  style={styles.slider}
                  minimumValue={0}
                  maximumValue={maxPrice}
                  value={priceRange[1]}
                  onValueChange={(value) => 
                    setPriceRange([priceRange[0], Math.max(value, priceRange[0] + 1000)])
                  }
                  minimumTrackTintColor="#005478"
                  maximumTrackTintColor="#cccccc"
                  thumbStyle={styles.sliderThumb}
                  trackStyle={styles.sliderTrack}
                />
              </View>
            </View>

            {/* Reset Button */}
            <TouchableOpacity style={styles.resetButton} onPress={resetPriceFilter}>
              <Text style={styles.resetButtonText}>Reset Price Filter</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#005478" />
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
        <Text style={styles.noResultsText}>No properties match your search criteria.</Text>
      )}

      <Modal visible={isModalVisible} animationType="slide" onRequestClose={() => setIsModalVisible(false)}>
        <View style={styles.modalContainer}>
          <ScrollView
            ref={scrollRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            contentOffset={{ x: currentIndex * width }}
            onMomentumScrollEnd={(event) => {
              const index = Math.round(event.nativeEvent.contentOffset.x / width);
              setCurrentIndex(index);
            }}
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
          
          {/* Pagination Dots */}
          <View style={styles.paginationContainer}>
            {selectedImages.map((_, index) => (
              <View
                key={index}
                style={[
                  styles.dot,
                  index === currentIndex ? styles.activeDot : styles.inactiveDot,
                ]}
              />
            ))}
          </View>

          <TouchableOpacity onPress={() => setIsModalVisible(false)} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>Close</Text>
          </TouchableOpacity>
        </View>
      </Modal>

    </View>
  );
}

// Define the styles - UPDATED TO FIX TEXT CLIPPING AND ADD PRICE FILTER STYLES
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#E0E0E0' },
  searchBar: { backgroundColor: '#7F7F7F', color: '#1B1B1B', padding: 10, margin: 10,marginTop: 35, borderRadius: 8 },
  loadingText: { textAlign: 'center', marginTop: 20, color: '#005478', fontSize: 16 },
  
  // Updated filter bar styles for horizontal scrolling with proper text visibility
  filterBarScrollView: {
    marginVertical: 10,
    maxHeight: 60, // Increased height to accommodate descenders
  },
  filterBarContainer: {
    paddingHorizontal: 10,
    alignItems: 'center',
    minWidth: '100%', // Ensure minimum width
    paddingVertical: 5, // Added vertical padding
  },
  filterButton: { 
    paddingHorizontal: 18, // Increased horizontal padding
    paddingVertical: 12, // Increased vertical padding for better text space
    borderRadius: 20, 
    backgroundColor: '#005478', 
    marginHorizontal: 5,
    minWidth: 80, // Ensure consistent button width
    minHeight: 40, // Added minimum height to ensure text fits
    alignItems: 'center', // Center text horizontally
    justifyContent: 'center', // Center text vertically
  },
  activeFilterButton: { backgroundColor: '#231f20' },
  filterText: { 
    color: '#ffffff', 
    fontSize: 14, 
    textAlign: 'center',
    lineHeight: 18, // Added line height to prevent clipping
    includeFontPadding: false, // Remove extra padding on Android
    textAlignVertical: 'center', // Center text vertically on Android
  },

  // Price Filter Styles
  priceFilterContainer: {
    backgroundColor: '#ffffff',
    marginHorizontal: 10,
    marginBottom: 10,
    borderRadius: 12,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  priceFilterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  priceHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  priceFilterTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#005478',
    marginLeft: 8,
  },
  priceRangeDisplay: {
    fontSize: 14,
    color: '#7F7F7F',
    marginLeft: 10,
    flex: 1,
  },
  priceFilterContent: {
    padding: 15,
  },
  currencyScrollView: {
    marginBottom: 20,
  },
  currencyButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f8f8f8',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    marginRight: 10,
  },
  activeCurrencyButton: {
    backgroundColor: '#005478',
    borderColor: '#005478',
  },
  currencyText: {
    fontSize: 14,
    color: '#7F7F7F',
    fontWeight: '500',
  },
  activeCurrencyText: {
    color: '#ffffff',
  },
  sliderContainer: {
    marginBottom: 15,
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sliderLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#005478',
  },
  slidersContainer: {
    paddingHorizontal: 5,
  },
  slider: {
    width: '100%',
    height: 40,
    marginBottom: 10,
  },
  sliderThumb: {
    backgroundColor: '#005478',
    width: 20,
    height: 20,
  },
  sliderTrack: {
    height: 4,
    borderRadius: 2,
  },
  resetButton: {
    backgroundColor: '#f8f8f8',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  resetButtonText: {
    color: '#005478',
    fontSize: 14,
    fontWeight: '600',
  },
  
  noResultsText: { color: '#7F7F7F', textAlign: 'center', marginTop: 20, fontSize: 16 },
  loaderContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#231F20' },
  propertyCard: { backgroundColor: '#7F7F7F', borderRadius: 10, padding: 10, marginVertical: 8, marginHorizontal: 16 },
  
  // Image container to handle positioning
  imageContainer: {
    position: 'relative',
  },
  propertyImage: { width: width - 40, height: 200, borderRadius: 10 },
  imageScroll: { height: 200 },
  placeholderImage: {
    width: width - 40,
    height: 200,
    borderRadius: 10,
    backgroundColor: '#444444',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    color: '#ffffff',
    fontSize: 16,
  },
  
  propertyInfo: { paddingVertical: 10 },
  
  // Updated message icon styles
  messageIconContainer: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0, 84, 120, 0.8)',
    borderRadius: 20,
    padding: 8,
    zIndex: 2, // Higher z-index than favorite
  },
  messageIcon: {
    color: '#ffffff',
  },
  
  // Updated favorite icon styles
  favoriteIconContainer: {
    position: 'absolute',
    top: 10,
    right: 60, // Adjusted to not overlap with chat icon
    zIndex: 1, // Ensure it overlays on top of the image
    backgroundColor: 'rgba(0, 0, 0, 0.5)', // Semi-transparent background
    borderRadius: 20,
    padding: 8,
  },
  favoriteIcon: {
    // Icon styles handled by the Ionicons component
  },
  
  propertyTitle: { fontSize: 18, fontWeight: 'bold', color: '#ffffff' },
  locationContainer: { flexDirection: 'row', alignItems: 'center', marginTop: 5 },
  propertyLocation: { color: '#cccccc', marginLeft: 5 },
  propertyPrice: { fontSize: 16, fontWeight: 'bold', color: '#ffffff', marginTop: 5 },
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
  viewMapButton: { marginTop: 10, paddingVertical: 8, paddingHorizontal: 12, backgroundColor: '#005478', borderRadius: 8 },
  viewMapText: { color: '#ffffff', fontSize: 16, textAlign: 'center' },
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    bottom: 20,
    width: '100%',
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginHorizontal: 5,
    backgroundColor: '#005478',
  },
  activeDot: {
    backgroundColor: 'white',
  },
  inactiveDot: {
    backgroundColor: '#005478',
  },
});
