import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';

const API_BASE_URL = 'https://interparkenterprises1001-gtuf6.ondigitalocean.app/api/favorites';

export default function Preferences() {
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const navigation = useNavigation(); // Hook for navigation

  const fetchUserId = async () => {
    try {
      const id = await AsyncStorage.getItem('userId');
      if (id) {
        setUserId(id);
        fetchFavorites(id);
      } else {
        Alert.alert('Error', 'User ID not found!');
      }
    } catch (error) {
      console.error('Error fetching user ID:', error);
      Alert.alert('Error', 'Failed to load user data');
    }
  };

  const fetchFavorites = async (userId) => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_BASE_URL}/${userId}`);
      setFavorites(response.data.favorites);
    } catch (error) {
      console.error('Error fetching favorites:', error);
      Alert.alert('Error', 'Failed to fetch favorites');
    } finally {
      setLoading(false);
    }
  };

  const toggleFavorite = async (propertyId) => {
    try {
      const isFavorite = favorites.some(
        (item) => item.property._id.$oid === propertyId
      );
      const method = isFavorite ? 'delete' : 'post';
      const endpoint = isFavorite ? '/remove' : '/add';

      await axios({
        method,
        url: `${API_BASE_URL}${endpoint}`,
        data: {
          userId,
          propertyId,
        },
      });

      if (isFavorite) {
        setFavorites(favorites.filter((item) => item.property._id.$oid !== propertyId));
      } else {
        fetchFavorites(userId);
      }
    } catch (error) {
      console.error('Error toggling favorite:', error);
      Alert.alert('Error', 'Failed to update favorite');
    }
  };

  useEffect(() => {
    fetchUserId();
  }, []);

  const handlePropertyClick = (property) => {
    navigation.navigate('PropertiesList', {
      propertyId: property._id.$oid, // Pass the property ID
      propertyTitle: property.title,  // Also pass the property title
    });
  };
  

  const renderFavorite = ({ item }) => {
    const property = item.property;
    const price = parseFloat(property.price?.$numberDouble) || 0.0;

    return (
      <TouchableOpacity onPress={() => handlePropertyClick(property)}>
        <View style={styles.propertyCard}>
          <Text style={styles.propertyTitle}>{property.title}</Text>
          <Text style={styles.propertyLocation}>{property.location}</Text>
          <Text style={styles.propertyPrice}>Ksh {price.toFixed(2)}</Text>
          <TouchableOpacity
            onPress={() => toggleFavorite(property._id.$oid)}
            style={styles.favoriteIconContainer}
          >
            <Ionicons
              name="heart"
              size={30}
              color={
                favorites.some((fav) => fav.property._id.$oid === property._id.$oid)
                  ? '#ff6600'
                  : '#ccc'
              }
              style={styles.favoriteIcon}
            />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>My Favorites</Text>
      {loading ? (
        <ActivityIndicator size="large" color="#ffffff" />
      ) : favorites.length > 0 ? (
        <FlatList
          data={favorites}
          renderItem={renderFavorite}
          keyExtractor={(item) => item.favoriteId}
          refreshing={isRefreshing}
          onRefresh={() => fetchFavorites(userId)}
        />
      ) : (
        <Text style={styles.noFavoritesText}>No favorites yet.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1e1e1e',
    paddingTop: 20,
    paddingHorizontal: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 10,
  },
  propertyCard: {
    marginBottom: 15,
    backgroundColor: '#333',
    borderRadius: 8,
    padding: 15,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  propertyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  propertyLocation: {
    fontSize: 16,
    color: '#bbb',
    marginVertical: 5,
  },
  propertyPrice: {
    fontSize: 16,
    color: '#ff6600',
  },
  favoriteIconContainer: {
    position: 'absolute',
    top: 10,
    right: 10,
  },
  favoriteIcon: {
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderRadius: 15,
    padding: 5,
  },
  noFavoritesText: {
    color: '#ffffff',
    fontSize: 16,
    textAlign: 'center',
  },
});