// utils/encoding.js

import { VALID_ROLES } from '../constants/roles'; // Adjust path as needed

/**
 * URL-safe Base64 encoding that matches backend expectations
 */
export const base64UrlEncode = (str) => {
    const base64 = btoa(unescape(encodeURIComponent(str)));
    return base64
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
};

/**
 * URL-safe Base64 decoding
 */
export const base64UrlDecode = (str) => {
    const padding = '='.repeat((4 - (str.length % 4)) % 4);
    const base64 = (str + padding)
        .replace(/-/g, '+')
        .replace(/_/g, '/');

    try {
        return decodeURIComponent(escape(atob(base64)));
    } catch (error) {
        console.error('Base64 decode error:', error);
        throw error;
    }
};

// Helper for default state
const getDefaultState = () => ({
    role: 'CLIENT',
    platform: 'android',
    action: 'login',
    timestamp: Date.now(),
    isDev: typeof __DEV__ !== 'undefined' ? __DEV__ : false
});

/**
 * Create state parameter for Google OAuth
 */
export const createGoogleOAuthState = (params = {}) => {
    const { role, platform, action } = params;

    const validRole = Object.values(VALID_ROLES).includes(role)
        ? role
        : 'CLIENT';

    const stateObj = {
        ...params,
        role: validRole,
        platform: platform || 'android',
        isDev: typeof __DEV__ !== 'undefined' ? __DEV__ : false,
        action: action || 'login',
        timestamp: Date.now(),
        nonce: generateNonce() // Optional: for CSRF protection
    };

    return base64UrlEncode(JSON.stringify(stateObj));
};

/**
 * Parse state parameter from Google OAuth
 */
export const parseGoogleOAuthState = (stateParam) => {
    if (!stateParam) {
        console.warn('No state parameter provided');
        return getDefaultState();
    }

    try {
        const decoded = base64UrlDecode(stateParam);
        const parsed = JSON.parse(decoded);

        // Sanitize and validate
        const role = parsed.role && Object.values(VALID_ROLES).includes(parsed.role)
            ? parsed.role
            : 'CLIENT';

        return {
            ...parsed,
            role,
            platform: parsed.platform || 'android',
            action: parsed.action || 'login',
            timestamp: parsed.timestamp ? Number(parsed.timestamp) : Date.now(),
            isDev: !!parsed.isDev
        };
    } catch (error) {
        console.error('Failed to parse OAuth state:', error, { stateParam });
        return getDefaultState();
    }
};

// Optional: Generate a simple nonce (in prod, use crypto if available)
const generateNonce = () => Math.random().toString(36).substr(2, 10);