import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged, signInWithPopup, signInWithRedirect, signOut } from 'firebase/auth';
import { auth, googleAuthProvider } from '../firebase';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  token: string | null;
  login: () => Promise<void>;
  loginWithRedirect: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  console.log("AuthContext loading =", loading);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
    console.log("AUTH CALLBACK");
    console.log("Firebase user:", user);

    setUser(user);

if (user) {
  console.log("GET TOKEN...");

  const idToken = await user.getIdToken();
  setToken(idToken);

  try {
    await fetch('/api/users/setup', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${idToken}`,
      },
    });
  } catch (error) {
    console.error("Failed to setup user:", error);
  }
} else {
  setToken(null);
}

console.log("SET LOADING FALSE");
console.log("CALL setLoading(false)");
setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const login = async () => {
    try {
      await signInWithPopup(auth, googleAuthProvider);
      console.log("POPUP LOGIN SUCCESS");
console.log("Current auth user:", auth.currentUser);
    } catch (error: any) {
      const errorStr = error?.message ? String(error.message).toLowerCase() : "";
      const errorCode = error?.code ? String(error.code).toLowerCase() : "";
      const isPopupOrBlocked = errorCode.includes("popup") || errorStr.includes("popup") || errorStr.includes("closed-by-user") || errorStr.includes("cancelled");
      
      if (isPopupOrBlocked) {
        console.warn('Google sign-in popup blocked/closed in iframe, passing to handler for safe bypass:', error);
      } else {
        console.error('Login error:', error);
      }
      throw error;
    }
  };

  const loginWithRedirect = async () => {
    try {
      await signInWithRedirect(auth, googleAuthProvider);
    } catch (error: any) {
      console.error('Login with redirect error:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, token, login, loginWithRedirect, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
