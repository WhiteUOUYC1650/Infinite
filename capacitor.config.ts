import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.infinite.chat',
  appName: 'Infinite Chat',
  webDir: 'out',
  server: {
    androidScheme: 'https'
  }
};

export default config;
