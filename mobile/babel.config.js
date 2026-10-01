module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Required for expo-router reanimated-safe gesture handling on SDK 51
      'react-native-reanimated/plugin',
    ],
  };
};
