import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text,
  ActivityIndicator,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Easing,
} from 'react-native';
import axios from 'axios';
import { useNavigation, useRoute } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function AIProcessingScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { endpoint, payload, onSuccessRedirect, successMessageKey = 'message' } = route.params;

  const [status, setStatus] = useState<'loading'|'success'|'error'>('loading');
  const [feedback, setFeedback] = useState('');

  // --- Info blurbs to cycle through ---
  const tips = [
    // IMAGE ANALYSIS
    "Detecting objects and structures in each photo…",
    "Ensuring every image clearly shows interior and exterior views…",
    "Filtering out blurry or unrelated shots…",

    // DESCRIPTION COHERENCE
    "Parsing your description for clarity and completeness…",
    "Verifying that key features (e.g. bedrooms, bathrooms) are mentioned…",
    "Checking for consistency between text and images…",

    // PRICE CONSISTENCY
    "Comparing your price to similar listings in the area…",
    "Flagging if your price is significantly above or below market…",

    // NEIGHBORHOOD CROSS-REFERENCE
    "Mapping nearby schools, transport, and amenities…",
    "Calculating walk-score and transit accessibility…",

    // FINAL SAFETY CHECKS
    "Scanning for prohibited content or policy violations…",
    "Packaging everything for secure submission…"
  ];
  const [tipIndex, setTipIndex] = useState(0);

  // --- Animated opacity for the tip text ---
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Function to fade in, hold, fade out
  const animateTip = () => {
    Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true, easing: Easing.out(Easing.ease) }),
      Animated.delay(2400),
      Animated.timing(fadeAnim, { toValue: 0, duration: 600, useNativeDriver: true, easing: Easing.in(Easing.ease) }),
    ]).start(() => {
      setTipIndex((idx) => (idx + 1) % tips.length);
    });
  };

  useEffect(() => {
    // Kick off cycling through tips
    animateTip();
    // Re-run animateTip whenever tipIndex changes
  }, [tipIndex]);

  useEffect(() => {
    async function runAIRequest() {
      try {
        const token = await AsyncStorage.getItem('auth_token');
        const response = await axios.post(
          endpoint,
          payload,
          { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } }
        );
        setFeedback(response.data[successMessageKey] || 'Operation completed successfully.');
        setStatus('success');
      } catch (err) {
        const msg = err.response?.data?.feedback || err.response?.data?.error || err.message;
        setFeedback(msg);
        setStatus('error');
      }
    }
    runAIRequest();
  }, []);

  const handleClose = () => {
    if (status === 'success' && onSuccessRedirect) {
      navigation.reset({ index: 0, routes: [{ name: onSuccessRedirect }] });
    } else {
      navigation.goBack();
    }
  };

  return (
    <View style={styles.container}>
      {status === 'loading' && (
        <>
          {/* Replace this with a LottieView if you prefer */}
          <ActivityIndicator size="large" />
          <Animated.Text style={[styles.tipText, { opacity: fadeAnim }]}>
            {tips[tipIndex]}
          </Animated.Text>
        </>
      )}

      {(status === 'success' || status === 'error') && (
        <>
          <Text style={[styles.title, status === 'success' ? styles.success : styles.error]}>
            {status === 'success' ? 'Success!' : 'Validation Failed'}
          </Text>
          <Text style={styles.text}>{feedback}</Text>
          <TouchableOpacity style={styles.button} onPress={handleClose}>
            <Text style={styles.buttonText}>OK</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    padding: 20, backgroundColor: '#E0E0E0'
  },
  tipText: {
    marginTop: 20,
    fontSize: 14,
    fontStyle: 'italic',
    textAlign: 'center',
    color: '#555',
    paddingHorizontal: 20,
  },
  text: {
    marginTop: 15,
    textAlign: 'center',
    color: '#333'
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10
  },
  success: { color: 'green' },
  error: { color: 'red' },
  button: {
    marginTop: 20,
    backgroundColor: '#005478',
    paddingVertical: 10,
    paddingHorizontal: 25,
    borderRadius: 8
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold'
  }
});
