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
  const scrollRef = useRef(null);
  const navigation = useNavigation();

  const getImageUrl = (filename) =>
    `https://interpark-uploads.nyc3.cdn.digitaloceanspaces.com/Propertypic/${filename}`;

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
        setProperties(data.properties || []);
      } else {
        const data = await response.json();
        setProperties(data.properties || []);
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

  const filteredProperties = properties.filter((item) =>
    (selectedType === 'All' || item.type === selectedType) &&
    (item.title.toLowerCase().includes(debouncedQuery.toLowerCase()) ||
      item.location.toLowerCase().includes(debouncedQuery.toLowerCase()) ||
      item.purpose.toLowerCase().includes(debouncedQuery.toLowerCase()))
  );

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 500);

    return () => {
      clearTimeout(handler);
    };
  }, [searchQuery]);

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
          <Text style={styles.propertyTitle}>{item.title || 'Untitled Property'}</Text>
          
          {/* No heart icon for guest mode */}
          
          <View style={styles.locationContainer}>
            <TouchableOpacity onPress={() => toggleMoreInfo(item._id.$oid)}>
              <Ionicons name="location-outline" size={20} color="#ffffff" />
            </TouchableOpacity>
            <Text style={styles.propertyLocation}>{propertyLocation}</Text>
          </View>

          <Text style={styles.propertyPrice}>{currency} {price.toFixed(2)}</Text>
          <Text style={styles.propertyPurpose}>{propertyPurpose}</Text>

          {/* No chat icon for guest mode */}
          
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

// Login Tab Component
function LoginTab() {
  const navigation = useNavigation();

  const handleLoginPress = () => {
    const parentNav = navigation.getParent();
    if (parentNav) {
      parentNav.navigate('Login');
    } else {
      console.warn('No parent navigator found');
    }
  };

  return (
    <View style={styles.loginTabContainer}>
      <TouchableOpacity style={styles.loginButton} onPress={handleLoginPress}>
        <Ionicons name="log-in-outline" size={50} color="#005478" />
        <Text style={styles.loginButtonText}>Login to Access Full Features</Text>
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

// Styles (same as original PropertiesList with some additions)
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
  
  noResultsText: { color: '#ffffff', textAlign: 'center', marginTop: 20 },
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
  
  // New styles for login tab
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
  },
  loginButtonText: {
    marginTop: 15,
    fontSize: 18,
    fontWeight: 'bold',
    color: '#005478',
    textAlign: 'center',
  },
});
