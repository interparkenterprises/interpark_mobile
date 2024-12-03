// MapPlace.js
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import MapView, { Marker, PROVIDER_OSM } from 'react-native-maps';
import axios from 'axios';
import { GEOCODING_API_KEY } from '@env';
import { useNavigation } from '@react-navigation/native';

export default function MapPlace({ route }) {
  const { location } = route.params || {}; // Handle undefined params
  const [coordinates, setCoordinates] = useState(null);
  const [error, setError] = useState(null);

  const navigation = useNavigation(); // Use the navigation hook

  useEffect(() => {
    const fetchCoordinates = async () => {
      try {
        const response = await axios.get('https://api.opencagedata.com/geocode/v1/json', {
          params: {
            q: location,
            key: GEOCODING_API_KEY,
          },
        });
        if (response.data.results.length > 0) {
          const { geometry } = response.data.results[0];
          setCoordinates({
            latitude: geometry.lat,
            longitude: geometry.lng,
          });
        } else {
          setError('No results found for the specified location.');
        }
      } catch (e) {
        setError('Failed to fetch coordinates.');
      }
    };
    fetchCoordinates();
  }, [location]);

  if (error) {
    return <Text style={styles.error}>{error}</Text>;
  }

  return (
    <View style={styles.container}>
      {/* Back Button */}
      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
        <Text style={styles.backButtonText}>Back</Text>
      </TouchableOpacity>

      {coordinates ? (
        <MapView
          provider={PROVIDER_OSM}
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
        <Text style={styles.loading}>Loading Map...</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white', // Optional: for a white background
  },
  map: {
    flex: 1,
  },
  backButton: {
    position: 'absolute',
    top: 30,
    left: 20,
    padding: 10,
    backgroundColor: '#005478',
    borderRadius: 5,
    zIndex: 1, // Ensure it stays on top of the map
  },
  backButtonText: {
    color: 'white',
    fontSize: 16,
  },
  loading: {
    textAlign: 'center',
    marginTop: 20,
    fontSize: 16,
  },
  error: {
    textAlign: 'center',
    marginTop: 20,
    color: 'red',
  },
});
