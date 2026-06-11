import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import firebaseConfigJson from '../firebase-applet-config.json';

// Type-safe Firebase config interface
interface FirebaseConfig {
  projectId: string;
  appId: string;
  apiKey: string;
  authDomain: string;
  firestoreDatabaseId?: string;
  storageBucket: string;
  messagingSenderId: string;
  measurementId?: string;
}

// Validate config at initialization time
const firebaseConfig = firebaseConfigJson as FirebaseConfig;

if (!firebaseConfig.projectId || !firebaseConfig.apiKey) {
  throw new Error('Invalid Firebase configuration: Missing required fields (projectId, apiKey)');
}

try {
  const app = initializeApp(firebaseConfig);
  export const db = getFirestore(
    app,
    firebaseConfig.firestoreDatabaseId || undefined
  );
  export const auth = getAuth(app);
  export const googleProvider = new GoogleAuthProvider();
} catch (error) {
  console.error('Failed to initialize Firebase:', error);
  throw new Error('Firebase initialization failed');
}
