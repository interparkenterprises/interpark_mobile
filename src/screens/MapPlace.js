import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import MapboxGL from '@rnmapbox/maps';
import axios from 'axios';
import { GEOCODING_API_KEY } from '@env';
import { useNavigation } from '@react-navigation/native';

MapboxGL.setAccessToken('pk.eyJ1IjoiaW50ZXJwYXJrLWVudGVycHJpc2UiLCJhIjoiY200aXNzMmxyMDUxMDJpcXhlZHQ1cWxqZSJ9.Rjs3qDCMz3p42FMD1U2rFg'); // Set your Mapbox token here

export default function MapPlace({ route }) {
  const { location } = route.params || {}; // Handle undefined params
  const [coordinates, setCoordinates] = useState(null);
  const [error, setError] = useState(null);

  const navigation = useNavigation(); // Use the navigation hook

  useEffect(() => {
    if (!location) {
      setError('No location provided');
      return;
    }

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
    return (
      <View style={styles.container}>
        <Text style={styles.error}>{error}</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
        <Text style={styles.backButtonText}>Back</Text>
      </TouchableOpacity>

      {coordinates ? (
        <MapboxGL.MapView style={styles.map}>
          <MapboxGL.Camera
            centerCoordinate={[coordinates.longitude, coordinates.latitude]}
            zoomLevel={14}
          />
          <MapboxGL.PointAnnotation
            id="marker"
            coordinate={[coordinates.longitude, coordinates.latitude]}
          >
            <View style={styles.marker} />
          </MapboxGL.PointAnnotation>
        </MapboxGL.MapView>
      ) : (
        <Text style={styles.loading}>Loading Map...</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
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
    zIndex: 1,
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
    marginTop: 40,
    color: 'red',
  },
  marker: {
    height: 20,
    width: 20,
    backgroundColor: '#005478',
    borderRadius: 10,
  },
});
