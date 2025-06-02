import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Easing,
  InteractionManager
} from 'react-native';
import axios from 'axios';
import { useNavigation, useRoute } from '@react-navigation/native';

export default function AIProcessingScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const {
    uploadEndpoint,
    addEndpoint,
    payload,
    onSuccessRedirect,
    successMessageKey = 'message',
    token
  } = route.params;

  const [status, setStatus] = useState('loading');
  const [feedback, setFeedback] = useState('');

  const tips = [
    "Detecting objects and structures in each photo…",
    "Ensuring every image clearly shows interior and exterior views…",
    "Filtering out blurry or unrelated shots…",
    "Parsing your description for clarity and completeness…",
    "Verifying that key features (e.g. bedrooms, bathrooms) are mentioned…",
    "Checking for consistency between text and images…",
    "Comparing your price to similar listings in the area…",
    "Flagging if your price is significantly above or below market…",
    "Mapping nearby schools, transport, and amenities…",
    "Calculating walk-score and transit accessibility…",
    "Scanning for prohibited content or policy violations…",
    "Packaging everything for secure submission…"
  ];

  const [tipIndex, setTipIndex] = useState(0);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const animationRef = useRef(null);

  const animateTip = () => {
    // Cancel any ongoing animation
    if (animationRef.current) {
      animationRef.current.stop();
    }

    animationRef.current = Animated.sequence([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
        easing: Easing.out(Easing.ease)
      }),
      Animated.delay(2400),
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
        easing: Easing.in(Easing.ease)
      }),
    ]);

    animationRef.current.start(() => {
      InteractionManager.runAfterInteractions(() => {
        setTipIndex(idx => (idx + 1) % tips.length);
      });
    });
  };

  useEffect(() => {
    animateTip();

    return () => {
      if (animationRef.current) {
        animationRef.current.stop();
      }
    };
  }, [tipIndex]);

  useEffect(() => {
    let isMounted = true;
    let source = axios.CancelToken.source();

    async function runAIRequest() {
      try {
        // 1) Upload images
        const form = new FormData();
        payload.localImageUris.forEach((uri, i) => {
          form.append('images', {
            uri,
            name: `img${i}.jpg`,
            type: 'image/jpeg'
          });
        });

        const uploadResp = await axios.post(
          uploadEndpoint,
          form,
          {
            headers: {
              'Content-Type': 'multipart/form-data',
              Authorization: `Bearer ${token}`
            },
            cancelToken: source.token
          }
        );

        // 2) Add property
        const finalPayload = {
          ...payload,
          images: uploadResp.data.images,
          imageResult: uploadResp.data.imageResult
        };

        const addResp = await axios.post(
          addEndpoint,
          finalPayload,
          {
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`
            },
            cancelToken: source.token
          }
        );

        if (isMounted) {
          setFeedback(addResp.data[successMessageKey] || 'Property added successfully.');
          setStatus('success');
        }
      } catch (err) {
        if (isMounted) {
          const msg = err.response?.data?.feedback || 
                      err.response?.data?.error || 
                      err.message;
          setFeedback(msg);
          setStatus('error');
        }
      }
    }

    runAIRequest();

    return () => {
      isMounted = false;
      source.cancel('Component unmounted, request canceled');
    };
  }, []);

  const handleClose = () => {
    if (status === 'success' && onSuccessRedirect) {
      navigation.reset({
        index: 0,
        routes: [{ name: onSuccessRedirect }]
      });
    } else {
      navigation.goBack();
    }
  };

  return (
    <View style={styles.container}>
      {status === 'loading' && (
        <>  
          <ActivityIndicator size="large" />
          <Animated.Text style={[styles.tipText, { opacity: fadeAnim }]}>
            {tips[tipIndex]}
          </Animated.Text>
        </>
      )}

      {(status === 'success' || status === 'error') && (
        <>
          <Text style={[
            styles.title,
            status === 'success' ? styles.success : styles.error
          ]}>
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
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#E0E0E0'
  },
  tipText: {
    marginTop: 20,
    fontSize: 14,
    fontStyle: 'italic',
    textAlign: 'center',
    color: '#555',
    paddingHorizontal: 20
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
  success: {
    color: 'green'
  },
  error: {
    color: 'red'
  },
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