import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { auth, googleAuthProvider } from '../firebase';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  token: string | null;
  login: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (user) {
        const idToken = await user.getIdToken();
        setToken(idToken);
        
        // Setup user on backend
        try {
          await fetch('/api/users/setup', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${idToken}`,
            },
          });
        } catch (error) {
          console.error('Failed to setup user:', error);
        }
      } else {
        setToken(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const login = async () => {
    try {
      await signInWithPopup(auth, googleAuthProvider);
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

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, token, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
