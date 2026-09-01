// metro.config.js
// No build WEB: substitui @shopify/react-native-skia por um stub vazio,
// pois o Skia eh uma biblioteca nativa e nao suporta web.
const { getDefaultConfig } = require('expo/metro-config');
const config = getDefaultConfig(__dirname);
config.resolver = {
  ...config.resolver,
  resolveRequest: (context, moduleName, platform) => {
    if (
      platform === 'web' &&
      (moduleName === '@shopify/react-native-skia' ||
        moduleName.startsWith('@shopify/react-native-skia/'))
    ) {
      return { type: 'sourceFile', filePath: require.resolve('./lib/skia-stub.web.js') };
    }
    return context.resolveRequest(context, moduleName, platform);
  },
};
module.exports = config;
