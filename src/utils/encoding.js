// encoding.js
import { encode as btoa, decode as atob } from 'base-64';
import { VALID_ROLES } from '../constants/roles';

/** URL-safe Base64 encoding that matches backend expectations */
export const base64UrlEncode = (str) => {
  try {
    let binString;

    // Preferred: use TextEncoder if available (most modern engines)
    if (typeof TextEncoder !== 'undefined') {
      const encoder = new TextEncoder();
      const data = encoder.encode(String(str));
      // Convert Uint8Array to binary string safely
      let tmp = '';
      for (let i = 0; i < data.length; i++) tmp += String.fromCharCode(data[i]);
      binString = tmp;
    } else {
      // Fallback for JSCore / Hermes: convert UTF-8 -> binary string
      // unescape(encodeURIComponent(...)) transforms UTF-8 into a byte-wise binary string
      binString = unescape(encodeURIComponent(String(str)));
    }

    // Base64 encode
    const base64 = btoa(binString);

    // URL-safe Base64
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  } catch (error) {
    console.error('Base64 encode error:', error, str);
    throw error;
  }
};

/** URL-safe Base64 decoding */
export const base64UrlDecode = (str) => {
  try {
    // Restore padding and standard base64 chars
    const padding = '='.repeat((4 - (str.length % 4)) % 4);
    const base64 = (str + padding).replace(/-/g, '+').replace(/_/g, '/');

    // Decode base64 to binary string
    const decodedBinary = atob(base64);

    // If TextDecoder exists, use it to decode UTF-8 bytes
    if (typeof TextDecoder !== 'undefined') {
      const len = decodedBinary.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) bytes[i] = decodedBinary.charCodeAt(i);
      const decoder = new TextDecoder('utf-8');
      return decoder.decode(bytes);
    } else {
      // Fallback: binary string -> UTF-8
      // decodeURIComponent(escape(...)) converts the binary string back to proper UTF-8
      // NOTE: escape()/unescape() are deprecated but still widely available and work here.
      return decodeURIComponent(escape(decodedBinary));
    }
  } catch (error) {
    console.error('Base64 decode error:', error, { str });
    throw error;
  }
};

// Helper for default state
const getDefaultState = () => ({
  role: 'CLIENT',
  platform: 'android',
  action: 'login',
  timestamp: Date.now(),
  isDev: typeof __DEV__ !== 'undefined' ? __DEV__ : false,
});

/** Create state parameter for Google OAuth */
export const createGoogleOAuthState = (params = {}) => {
  try {
    const { role, platform, action } = params;
    const validRole = Object.values(VALID_ROLES).includes(role) ? role : 'CLIENT';
    const stateObj = {
      ...params,
      role: validRole,
      platform: platform || 'android',
      action: action || 'login',
      timestamp: Date.now(),
      isDev: typeof __DEV__ !== 'undefined' ? __DEV__ : false,
      nonce: generateNonce(),
    };

    // Helpful debug log (remove in production if you want)
    console.log('Creating OAuth state object:', stateObj);

    const jsonString = JSON.stringify(stateObj);
    const encoded = base64UrlEncode(jsonString);

    if (!encoded) {
      throw new Error('Encoding resulted in empty string');
    }

    return encoded;
  } catch (error) {
    console.error('Error creating OAuth state:', error);
    throw new Error('Failed to create OAuth state');
  }
};

/** Parse state parameter from Google OAuth */
export const parseGoogleOAuthState = (stateParam) => {
  if (!stateParam) {
    console.warn('No state parameter provided');
    return getDefaultState();
  }
  try {
    const decoded = base64UrlDecode(stateParam);
    const parsed = JSON.parse(decoded);
    const role = parsed.role && Object.values(VALID_ROLES).includes(parsed.role) ? parsed.role : 'CLIENT';
    return {
      ...parsed,
      role,
      platform: parsed.platform || 'android',
      action: parsed.action || 'login',
      timestamp: parsed.timestamp ? Number(parsed.timestamp) : Date.now(),
      isDev: !!parsed.isDev,
    };
  } catch (error) {
    console.error('Failed to parse OAuth state:', error, { stateParam });
    return getDefaultState();
  }
};

// Simple nonce (fine for short-lived state)
export const generateNonce = () => Math.random().toString(36).slice(2, 12);
