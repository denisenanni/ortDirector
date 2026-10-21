// expo-notifications always adds the aps-environment (push) entitlement.
// The app only uses local notifications, and a free Apple ID cannot sign
// an app that asks for push, so drop it. List it before expo-notifications
// in app.json: mods run in reverse order, so this one runs after.
const { withEntitlementsPlist } = require('expo/config-plugins');

module.exports = function withoutPushEntitlement(config) {
  return withEntitlementsPlist(config, (config) => {
    delete config.modResults['aps-environment'];
    return config;
  });
};
