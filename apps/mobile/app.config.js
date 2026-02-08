/**
 * Dynamic Expo config that extends app.json
 * Allows injecting secrets from environment variables at build time
 *
 * For building your own fork, set EAS_PROJECT_ID to your Expo project ID
 * (create at https://expo.dev → Create project → copy Project ID).
 * This avoids "Entity not authorized" when using your own EXPO_TOKEN.
 */

const baseConfig = require('./app.json');

module.exports = ({ config }) => {
  const projectId = process.env.EAS_PROJECT_ID || baseConfig.expo.extra?.eas?.projectId;

  const merged = {
    ...baseConfig.expo,
    ...config,
    android: {
      ...baseConfig.expo.android,
      config: {
        ...baseConfig.expo.android?.config,
        googleMaps: {
          apiKey: process.env.GOOGLE_MAPS_API_KEY || '',
        },
      },
    },
  };

  // Override EAS project, owner, and updates URL when building with your own project
  if (projectId) {
    merged.extra = { ...merged.extra, eas: { ...merged.extra?.eas, projectId } };
    merged.updates = { ...merged.updates, url: `https://u.expo.dev/${projectId}` };
    if (process.env.EAS_OWNER) {
      merged.owner = process.env.EAS_OWNER;
    }
  }

  return merged;
};
