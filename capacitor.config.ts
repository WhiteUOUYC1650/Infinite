import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.infinite.chat',
  appName: 'Infinite',
  webDir: 'out',
  server: {
    androidScheme: 'https'
  }
};

export default config;
