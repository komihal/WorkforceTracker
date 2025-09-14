const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');
const exclusionList = require('metro-config/src/defaults/exclusionList');

/**
 * Metro configuration
 * https://facebook.github.io/metro/docs/configuration
 *
 * @type {import('metro-config').MetroConfig}
 */
const config = {
  resolver: {
    sourceExts: ['js', 'json', 'ts', 'tsx', 'jsx'],
    // Исключаем тяжёлые директории, не относящиеся к JS-бандлу
    blockList: exclusionList([
      /vendor\/bundle\/.*/,      // ruby gems cache
      /android\/build\/.*/,      // android build
      /ios\/Pods\/.*/,           // cocoapods
      /coverage\/.*/,            // coverage reports
    ]),
  },
  transformer: {
    getTransformOptions: async () => ({
      transform: {
        experimentalImportSupport: false,
        inlineRequires: true,
      },
    }),
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
