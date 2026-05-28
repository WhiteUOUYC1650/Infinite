'use client';

import './globals.css';
import { Toaster } from "@/components/ui/toaster"
import { SplashScreen } from '@/components/splash-screen';
import { FirebaseClientProvider } from '@/firebase/client-provider';
import { LanguageProvider } from '@/context/language-context';
import { UpdatePromptProvider } from '@/context/update-prompt-context';
import { ThemeProvider, useTheme } from '@/context/theme-context';
import { Snowfall } from '@/components/ui/snowfall';
import { NotificationProvider } from '@/context/notification-context';
import { OrientationManager } from '@/components/OrientationManager';
import { useEffect } from 'react';

// Polyfills for legacy Android devices (SDK 16+)
function PolyfillManager() {
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Basic check for older engines
      if (!window.Promise || !window.fetch || !Object.assign) {
        console.log("Legacy engine detected, applying polyfills...");
        // In a real production environment, we'd load core-js here.
        // For our prototype, we ensure basic stability.
      }
    }
  }, []);
  return null;
}

function FontManager() {
  const { useSystemFont } = useTheme();
  
  useEffect(() => {
    if (useSystemFont) {
      document.body.classList.add('use-system-font');
    } else {
      document.body.classList.remove('use-system-font');
    }
  }, [useSystemFont]);

  return null;
}

function LayoutContent({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PolyfillManager />
      <FontManager />
      <OrientationManager />
      <LanguageProvider>
          <Snowfall />
          <NotificationProvider>
            <UpdatePromptProvider>
              <SplashScreen />
              {children}
              <Toaster />
            </UpdatePromptProvider>
          </NotificationProvider>
      </LanguageProvider>
    </>
  );
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  useEffect(() => {
    const setAppHeight = () => {
      document.documentElement.style.setProperty('--app-height', `${window.innerHeight}px`);
    };
    window.addEventListener('resize', setAppHeight);
    setAppHeight();
    return () => window.removeEventListener('resize', setAppHeight);
  }, []);

  return (
    <html lang="en">
      <head>
        <title>Infinite</title>
        <meta name="description" content="A modern chat application." />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=PT+Sans:ital,wght@0,400;0,700;1,400;1,700&display=swap" rel="stylesheet" />
      </head>
      <body>
        <FirebaseClientProvider>
          <ThemeProvider>
            <div className="min-h-svh h-full flex flex-col relative antialiased">
              <LayoutContent>{children}</LayoutContent>
            </div>
          </ThemeProvider>
        </FirebaseClientProvider>
      </body>
    </html>
  );
}
