const { withAndroidManifest } = require('@expo/config-plugins');

/**
 * Config plugin that ensures SYSTEM_ALERT_WINDOW and foreground service
 * declarations are present in AndroidManifest.xml for the overlay feature.
 */
module.exports = function withOverlayPermission(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;

    // Ensure permissions array exists
    if (!manifest['uses-permission']) {
      manifest['uses-permission'] = [];
    }

    const requiredPermissions = [
      'android.permission.SYSTEM_ALERT_WINDOW',
      'android.permission.FOREGROUND_SERVICE',
      'android.permission.FOREGROUND_SERVICE_DATA_SYNC',
      'android.permission.POST_NOTIFICATIONS',
      'android.permission.RECEIVE_BOOT_COMPLETED',
    ];

    requiredPermissions.forEach((perm) => {
      const already = manifest['uses-permission'].some(
        (p) => p.$?.['android:name'] === perm
      );
      if (!already) {
        manifest['uses-permission'].push({ $: { 'android:name': perm } });
      }
    });

    // Add foreground service declaration to application
    const application = manifest.application?.[0];
    if (application) {
      if (!application.service) application.service = [];

      const serviceName = 'com.topnotch.overlay.DownloadOverlayService';
      const exists = application.service.some(
        (s) => s.$?.['android:name'] === serviceName
      );

      if (!exists) {
        application.service.push({
          $: {
            'android:name': serviceName,
            'android:foregroundServiceType': 'dataSync',
            'android:exported': 'false',
          },
        });
      }
    }

    return config;
  });
};
