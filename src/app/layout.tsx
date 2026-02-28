
import type {Metadata} from 'next';
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

export const metadata: Metadata = {
  title: 'Infinite',
  description: 'A modern chat application.',
  viewport: 'width=device-width, initial-scale=1, viewport-fit=cover',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
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
