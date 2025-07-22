import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  FlatList, 
  Image, 
  TouchableOpacity, 
  StyleSheet, 
  ActivityIndicator, 
  Alert, 
  Modal, 
  ScrollView, 
  Dimensions, 
  TextInput
} from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Ionicons from 'react-native-vector-icons/Ionicons';
import axios from 'axios';
import Slider from '@react-native-community/slider';
import { useNavigation } from '@react-navigation/native';

const { width } = Dimensions.get('window');
const Tab = createBottomTabNavigator();

// Properties List Component for Guest Mode
function GuestPropertiesList() {
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedImages, setSelectedImages] = useState([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [expandedProperty, setExpandedProperty] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [selectedType, setSelectedType] = useState('All');
  
  // Price range filter states
  const [selectedCurrency, setSelectedCurrency] = useState('All');
  const [priceRange, setPriceRange] = useState([0, 1000000]);
  const [maxPrice, setMaxPrice] = useState(1000000);
  const [showPriceFilter, setShowPriceFilter] = useState(false);
  
  const scrollRef = useRef(null);
  const navigation = useNavigation();

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
      // Fetch properties without authentication for guest mode
      const response = await fetch(`https://interpark-backend.onrender.com/api/properties/public`);
      
      if (!response.ok) {
        // Fallback to regular endpoint if public endpoint doesn't exist
        const fallbackResponse = await fetch(`https://interpark-backend.onrender.com/api/properties/`);
        if (!fallbackResponse.ok) throw new Error('Failed to fetch properties');
        const data = await fallbackResponse.json();
        const propertiesData = data.properties || [];
        setProperties(propertiesData);
        
        // Calculate and set price range
        const { min, max } = calculatePriceRange(propertiesData);
        setMaxPrice(max);
        setPriceRange([min, max]);
      } else {
        const data = await response.json();
        const propertiesData = data.properties || [];
        setProperties(propertiesData);
        
        // Calculate and set price range
        const { min, max } = calculatePriceRange(propertiesData);
        setMaxPrice(max);
        setPriceRange([min, max]);
      }
    } catch (error) {
      console.error('Error fetching properties:', error);
      Alert.alert('Error', 'Failed to load properties.');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchProperties();
  }, []);

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
    }, 500);

    return () => {
      clearTimeout(handler);
    };
  }, [searchQuery]);

  // Handle chat icon press - navigate to login as client
  const handleChatPress = () => {
    Alert.alert(
      'Login Required',
      'Login with Google as a client or create an account manually and select the role of client to register.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Proceed to Login',
          onPress: () => {
            const parentNav = navigation.getParent();
            if (parentNav) {
              parentNav.navigate('Login', { userType: 'client' });
            } else {
              console.warn('No parent navigator found');
            }
          },
        },
      ],
      { cancelable: true }
    );
  };


  const renderProperty = ({ item }) => {
    const price = parseFloat(item.price?.$numberDouble) || 0.0;
    const currency = item.currency || 'Ksh';
    const imageFilenames = item.images || [];
    const propertyLocation = item.location || 'Unknown Location';
    const propertyPurpose = item.purpose || 'Unknown Purpose';

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
          <View style={styles.propertyHeader}>
            <Text style={styles.propertyTitle}>{item.title || 'Untitled Property'}</Text>
            
            {/* Chat icon for client communication */}
            <TouchableOpacity onPress={handleChatPress}>
              <Ionicons name="chatbubbles-outline" size={25} color="#ffffff" style={styles.messageIcon} />
            </TouchableOpacity>
          </View>
          
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
              <Text style={styles.infoText}>{item.nearbyPlaces?.join(', ') || 'None specified'}</Text>

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

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.searchBar}
        placeholder="Search for your type"
        placeholderTextColor="#1B1B1B"
        value={searchQuery}
        onChangeText={setSearchQuery}
      />

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

// Be an Agent Tab Component
function BeAnAgentTab() {
  const navigation = useNavigation();

  const handleBeAnAgentPress = () => {
    const parentNav = navigation.getParent();
    if (parentNav) {
      parentNav.navigate('Register', { userType: 'agent' });
    } else {
      console.warn('No parent navigator found');
    }
  };

  return (
    <View style={styles.beAgentTabContainer}>
      <TouchableOpacity style={styles.beAgentButton} onPress={handleBeAnAgentPress}>
        <Ionicons name="person-outline" size={50} color="#005478" />
        <Text style={styles.beAgentButtonText}>Be an Agent</Text>
        <Text style={styles.beAgentDescriptionText}>
          To be an Agent/Lanlord, select the role Register as Agent/Landlord
        </Text>
      </TouchableOpacity>
    </View>
  );
}

// Login Tab Component
function LoginTab() {
  const navigation = useNavigation();

  const handleLoginPress = () => {
    const parentNav = navigation.getParent();
    if (parentNav) {
      parentNav.navigate('Login'); // You can remove userType if you want it generic
    } else {
      console.warn('No parent navigator found');
    }
  };

  return (
    <View style={styles.loginTabContainer}>
      <TouchableOpacity style={styles.loginButton} onPress={handleLoginPress}>
        <Ionicons name="log-in-outline" size={50} color="#005478" />
        <Text style={styles.loginButtonText}>Login</Text>
        <Text style={styles.loginDescriptionText}>
          Login to access all the full features.
        </Text>
      </TouchableOpacity>
    </View>
  );
}


// Main GuestMode Component with Tab Navigator
export default function GuestMode() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ color, size }) => {
          let iconName;
          if (route.name === 'Properties') {
            iconName = 'home-outline';
          } else if (route.name === 'BeAnAgent') {
            iconName = 'person-outline';
          } else if (route.name === 'Login') {
            iconName = 'log-in-outline';
          }
          return <Icon name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#005478',
        tabBarInactiveTintColor: 'gray',
        headerShown: false,
      })}
    >
      <Tab.Screen 
        name="Properties" 
        component={GuestPropertiesList}
        options={{
          tabBarLabel: 'Properties',
        }}
      />
      <Tab.Screen 
        name="BeAnAgent" 
        component={BeAnAgentTab}
        options={{
          tabBarLabel: 'Be an Agent',
        }}
      />
      <Tab.Screen 
        name="Login" 
        component={LoginTab}
        options={{
          tabBarLabel: 'Login',
        }}
      />
    </Tab.Navigator>
  );
}

// Import Icon component
const Icon = Ionicons;

// Styles - Updated to include new styles
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#E0E0E0' },
  searchBar: { backgroundColor: '#7F7F7F', color: '#1B1B1B', padding: 10, margin: 10, marginTop: 35, borderRadius: 8 },
  
  filterBarScrollView: {
    marginVertical: 10,
    maxHeight: 60,
  },
  filterBarContainer: {
    paddingHorizontal: 10,
    alignItems: 'center',
    minWidth: '100%',
    paddingVertical: 5,
  },
  filterButton: { 
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 20, 
    backgroundColor: '#005478', 
    marginHorizontal: 5,
    minWidth: 80,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeFilterButton: { backgroundColor: '#231f20' },
  filterText: { 
    color: '#ffffff', 
    fontSize: 14, 
    textAlign: 'center',
    lineHeight: 18,
    includeFontPadding: false,
    textAlignVertical: 'center',
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
  propertyCard: { backgroundColor: '#7F7F7F', borderRadius: 10, padding: 10, marginVertical: 8, marginHorizontal: 16 },
  propertyImage: { width: width - 40, height: 200, borderRadius: 10 },
  imageScroll: { height: 200 },
  placeholderImage: { 
    width: width - 40, 
    height: 200, 
    borderRadius: 10, 
    backgroundColor: '#444444',
    justifyContent: 'center',
    alignItems: 'center'
  },
  placeholderText: { color: '#ffffff', fontSize: 16 },
  propertyInfo: { paddingVertical: 10 },
  propertyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  propertyTitle: { fontSize: 18, fontWeight: 'bold', color: '#ffffff', flex: 1 },
  messageIcon: { 
    marginLeft: 10,
  },
  locationContainer: { flexDirection: 'row', alignItems: 'center', marginTop: 5 },
  propertyLocation: { color: '#cccccc', marginLeft: 5 },
  propertyPrice: { fontSize: 16, fontWeight: 'bold', color: '#ffffff', marginTop: 5 },
  propertyPurpose: { fontSize: 14, color: '#cccccc', marginTop: 5 },
  moreInfoContainer: { marginTop: 10, flexDirection: 'row', alignItems: 'center' },
  moreInfoText: { fontSize: 16, color: '#ffffff', textDecorationLine: 'underline' },
  additionalInfo: { marginTop: 10, padding: 10, backgroundColor: '#444444', borderRadius: 8 },
  infoHeading: { fontSize: 16, fontWeight: 'bold', color: '#ffffff', marginTop: 5 },
  infoText: { color: '#dddddd', marginTop: 2 },
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
  
  // Be an Agent tab styles
  beAgentTabContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#E0E0E0',
    padding: 20,
  },
  beAgentButton: {
    alignItems: 'center',
    padding: 30,
    backgroundColor: '#ffffff',
    borderRadius: 15,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    minWidth: 280,
  },
  beAgentButtonText: {
    marginTop: 15,
    fontSize: 18,
    fontWeight: 'bold',
    color: '#005478',
    textAlign: 'center',
  },
  beAgentDescriptionText: {
    marginTop: 8,
    fontSize: 14,
    color: '#7F7F7F',
    textAlign: 'center',
    lineHeight: 20,
  },
  
  // Login tab styles
  loginTabContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#E0E0E0',
    padding: 20,
  },
  loginButton: {
    alignItems: 'center',
    padding: 30,
    backgroundColor: '#ffffff',
    borderRadius: 15,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    minWidth: 280,
  },
  loginButtonText: {
    marginTop: 15,
    fontSize: 18,
    fontWeight: 'bold',
    color: '#005478',
    textAlign: 'center',
  },
  loginDescriptionText: {
    marginTop: 8,
    fontSize: 14,
    color: '#7F7F7F',
    textAlign: 'center',
    lineHeight: 20,
  },
});
