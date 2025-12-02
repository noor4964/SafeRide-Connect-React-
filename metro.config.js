const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// For web builds, completely exclude audio files from asset processing
// This prevents Jimp from trying to process them
const audioExtensions = ['mp3', 'wav', 'aac', 'ogg', 'mpeg', 'm4a'];

config.resolver.assetExts = config.resolver.assetExts.filter(
  ext => !audioExtensions.includes(ext)
);

// Treat audio files as source files instead of assets
config.resolver.sourceExts = [...config.resolver.sourceExts, ...audioExtensions];

// Exclude expo-notifications from web builds to avoid audio file processing issues
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && (
    moduleName === 'expo-notifications' ||
    moduleName.startsWith('expo-notifications/')
  )) {
    // Return a mock module for web
    return {
      filePath: path.resolve(__dirname, 'node_modules/expo-notifications/build/index.js'),
      type: 'empty',
    };
  }
  
  // Default resolver
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
