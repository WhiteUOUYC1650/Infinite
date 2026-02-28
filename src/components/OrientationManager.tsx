
'use client';

import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';

export function OrientationManager() {
  useEffect(() => {
    const applyOrientation = async () => {
      // Only run on native platforms (Android/iOS)
      if (Capacitor.isNativePlatform()) {
        try {
          const { ScreenOrientation } = await import('@capacitor/screen-orientation');
          
          // Determine if the device is a tablet or phone
          // We use width >= 768 as a common threshold for tablets
          const isTablet = window.innerWidth >= 768 || window.innerHeight >= 768;
          
          if (!isTablet) {
            // Lock phones to portrait only
            await ScreenOrientation.lock({ orientation: 'portrait' });
          } else {
            // Allow tablets to rotate freely
            await ScreenOrientation.unlock();
          }
        } catch (e) {
          console.error("Orientation management error:", e);
        }
      }
    };

    applyOrientation();

    // Re-check on window resize (e.g. tablet split-screen changes)
    window.addEventListener('resize', applyOrientation);
    return () => window.removeEventListener('resize', applyOrientation);
  }, []);

  return null;
}
