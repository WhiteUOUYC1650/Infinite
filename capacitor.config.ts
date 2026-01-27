import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.whitegram.app',
  appName: 'WhiteGram',
  webDir: 'out',
  server: {
    androidScheme: 'https'
  }
};

export default config;
