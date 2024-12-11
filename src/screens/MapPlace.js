import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { WebView } from 'react-native-webview';
import axios from 'axios';
import { GEOCODING_API_KEY } from '@env';
import { useNavigation } from '@react-navigation/native';

export default function MapPlace({ route }) {
  const { location } = route.params || {}; // Handle undefined params
  const [coordinates, setCoordinates] = useState(null);
  const [error, setError] = useState(null);

  const navigation = useNavigation(); // Use the navigation hook

  useEffect(() => {
    // Ensure location is passed and valid before attempting to fetch coordinates
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

  // Return loading state or error message
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

  // Generate the Leaflet map HTML
  const generateMapHTML = () => {
    if (coordinates) {
      const { latitude, longitude } = coordinates;
      return `
        <html>
          <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <script src="https://unpkg.com/leaflet@1.7.1/dist/leaflet.js"></script>
            <link rel="stylesheet" href="https://unpkg.com/leaflet@1.7.1/dist/leaflet.css" />
            <style>
              body { margin: 0; padding: 0; }
              #map { height: 100vh; }
            </style>
          </head>
          <body>
            <div id="map"></div>
            <script>
              const map = L.map('map').setView([${latitude}, ${longitude}], 13);
              L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              }).addTo(map);
              L.marker([${latitude}, ${longitude}]).addTo(map)
                .bindPopup('<b>${location}</b>')
                .openPopup();
            </script>
          </body>
        </html>
      `;
    }
    return '';
  };

  return (
    <View style={styles.container}>
      {/* Back Button */}
      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
        <Text style={styles.backButtonText}>Back</Text>
      </TouchableOpacity>

      {coordinates ? (
        <WebView
          originWhitelist={['*']}
          source={{ html: generateMapHTML() }}
          style={styles.map}
        />
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
    marginTop: 30,
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
    marginTop: 50,
    fontSize: 16,
  },
  error: {
    textAlign: 'center',
    marginTop: 40,
    color: 'red',
  },
});
