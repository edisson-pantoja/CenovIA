const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Adiciona o root do monorepo para que o Metro possa ler dependências hoisted
config.watchFolders = [workspaceRoot];

config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// Modulos nativos que nao existem na web -- redirecionados para stubs vazios
const WEB_STUBS = {
  '@shopify/react-native-skia': './lib/skia-stub.web.js',
  'lottie-react-native': './lib/lottie-stub.web.js',
};

config.resolver = {
  ...config.resolver,
  resolveRequest: (context, moduleName, platform) => {
    if (platform === 'web') {
      const stub = WEB_STUBS[moduleName];
      if (stub) {
        return { type: 'sourceFile', filePath: require.resolve(stub) };
      }
    }
    return context.resolveRequest(context, moduleName, platform);
  },
};

module.exports = config;
