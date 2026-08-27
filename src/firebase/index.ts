import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore, initializeFirestore, persistentLocalCache } from 'firebase/firestore';
import { firebaseConfig } from './config';

let app: FirebaseApp;
let auth: Auth;
let firestore: Firestore;

function initializeFirebase() {
  if (getApps().length === 0) {
    app = initializeApp(firebaseConfig);
    // Initialize Firestore with persistent cache, but wrap in try-catch to handle IndexedDB corruption gracefully
    try {
      firestore = initializeFirestore(app, {
        localCache: persistentLocalCache({})
      });
    } catch (e) {
      console.warn("Firestore persistent cache failed (possible IndexedDB corruption), falling back to default.", e);
      firestore = getFirestore(app);
    }
  } else {
    app = getApp();
    firestore = getFirestore(app);
  }
  auth = getAuth(app);
  return { app, auth, firestore };
}

// Export the initialization function and instances
export { initializeFirebase };

// Export hooks and providers
export { FirebaseProvider, useFirebase, useFirebaseApp, useFirestore, useAuth } from './provider';
export { FirebaseClientProvider } from './client-provider';
export { useUser } from './auth/use-user';
export { useCollection } from './firestore/use-collection';
export { useDoc } from './firestore/use-doc';
export { useMemoFirebase } from './firestore/utils';
