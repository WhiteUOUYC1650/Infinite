
'use client';

import './globals.css';
import { Toaster } from "@/components/ui/toaster"
import { SplashScreen } from '@/components/splash-screen';
import { FirebaseClientProvider } from '@/firebase/client-provider';
import { LanguageProvider } from '@/context/language-context';
import { UpdatePromptProvider } from '@/context/update-prompt-context';
import { ThemeProvider } from '@/context/theme-context';
import { Snowfall } from '@/components/ui/snowfall';
import { NotificationProvider } from '@/context/notification-context';
import { OrientationManager } from '@/components/OrientationManager';
import { useEffect } from 'react';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  useEffect(() => {
    // Optimization for old Android WebViews to handle 100vh correctly
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
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=PT+Sans:ital,wght@0,400;0,700;1,400;1,700&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased">
        <FirebaseClientProvider>
          <OrientationManager />
          <LanguageProvider>
            <ThemeProvider>
              <Snowfall />
              <NotificationProvider>
                <UpdatePromptProvider>
                  <SplashScreen />
                  {children}
                  <Toaster />
                </UpdatePromptProvider>
              </NotificationProvider>
            </ThemeProvider>
          </LanguageProvider>
        </FirebaseClientProvider>
      </body>
    </html>
  );
}
