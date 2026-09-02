import Constants from 'expo-constants';

export const FREE_TIER_MINUTES = 30;

const baseBackendUrl = ((process.env.EXPO_PUBLIC_BACKEND_URL || Constants.expoConfig?.extra?.backendUrl) || 'http://localhost:3001').replace(/\/$/, '');

// If backendUrl is http/https, we convert to ws/wss for the websocket
const baseWsUrl = baseBackendUrl.includes('localhost') ? baseBackendUrl.replace(/^http/, 'ws') : baseBackendUrl.replace(/^https?/, 'wss');

export const BACKEND_API_URL = baseBackendUrl;
export const BACKEND_WS_URL = baseWsUrl;

export const COLORS = {
  CHALKBOARD_GREEN: '#2A5234',
  CHALK_WHITE: '#F5F5DC',
  BACKGROUND: '#0F1923',
  GOLD: '#D4A853',
  TEXT_PRIMARY: '#FFFFFF',
  TEXT_SECONDARY: '#A0AEC0',
  ERROR: '#E53E3E',
  WARNING: '#D69E2E',
  SUCCESS: '#38A169',
};
