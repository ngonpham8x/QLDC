import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { initializeFirestore } from "firebase/firestore";
import firebaseConfig from "../firebase-applet-config.json";

// Suppress benign Firestore gRPC idle stream connection warnings in iframe sandboxes
const suppressBenignFirestoreWarnings = () => {
  const originalConsoleError = console.error;
  console.error = (...args: any[]) => {
    const msg = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(" ");
    if (
      msg.includes("Disconnecting idle stream") || 
      msg.includes("GrpcConnection RPC 'Listen'") || 
      msg.includes("Timed out waiting for new targets") ||
      msg.includes("CANCELLED")
    ) {
      return;
    }
    originalConsoleError(...args);
  };

  const originalConsoleWarn = console.warn;
  console.warn = (...args: any[]) => {
    const msg = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(" ");
    if (
      msg.includes("Disconnecting idle stream") || 
      msg.includes("GrpcConnection RPC 'Listen'") || 
      msg.includes("Timed out waiting for new targets") ||
      msg.includes("CANCELLED")
    ) {
      return;
    }
    originalConsoleWarn(...args);
  };
};

suppressBenignFirestoreWarnings();

// Initialize Firebase App
const app = initializeApp(firebaseConfig);

// Initialize Firestore with specific database ID if present, using long polling to avoid gRPC stream timeouts in sandboxed environments
export const db = initializeFirestore(
  app,
  { experimentalForceLongPolling: true },
  (firebaseConfig as any).firestoreDatabaseId || "ai-studio-qunldnctdnph-da7c9d3e-909a-4207-ae73-55f5dd117cea"
);

// Initialize Firebase Auth
export const auth = getAuth(app);

// Google Auth Provider
export const googleProvider = new GoogleAuthProvider();
export const googleAuthProvider = googleProvider;

// In-memory access token cache
let cachedAccessToken: string | null = null;

export const getAccessToken = (): string | null => {
  return cachedAccessToken;
};

export const setAccessToken = (token: string | null) => {
  cachedAccessToken = token;
};

// Export helper to login with Google via Firebase Popup and cache token
export const loginWithGooglePopup = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (credential?.accessToken) {
      cachedAccessToken = credential.accessToken;
    }
    return {
      user: result.user,
      accessToken: credential?.accessToken || null
    };
  } catch (error) {
    console.error("Firebase Google Sign-In Error:", error);
    throw error;
  }
};

