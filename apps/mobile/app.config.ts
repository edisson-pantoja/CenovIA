import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'CenovIA',
  slug: 'cenovia',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  scheme: 'cenovia',
  userInterfaceStyle: 'dark',
  splash: {
    image: './assets/images/splash.png',
    resizeMode: 'contain',
    backgroundColor: '#0F1923'
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.cenovia.app'
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/images/icon.png',
      backgroundColor: '#0F1923'
    },
    package: 'com.cenovia.app'
  },
  web: {
    bundler: 'metro',
    output: 'single',
    favicon: './assets/images/icon.png'
  },
  plugins: [
    'expo-router',
    'expo-av'
  ],
  experiments: {
    typedRoutes: true
  },
  extra: {
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    backendUrl: process.env.EXPO_PUBLIC_BACKEND_URL,
    eas: {
      projectId: "your-project-id"
    }
  }
});
