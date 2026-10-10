import type { CapacitorConfig } from '@capacitor/cli';

const appMode = process.env.TIBA_APP_MODE === 'office' ? 'office' : 'driver';

const config: CapacitorConfig = {
  appId: appMode === 'office' ? 'com.tibasupplies.office' : 'com.tibasupplies.driver',
  appName: appMode === 'office' ? 'Tiba Supplies Office' : 'Tiba Supplies Driver',
  webDir: 'dist',
  android: {
    allowMixedContent: false,
  },
};

export default config;
