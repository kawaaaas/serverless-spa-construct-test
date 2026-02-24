import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { signOut as cognitoSignOut, getSession } from './auth';

type AuthState = {
  isAuthenticated: boolean;
  isLoading: boolean;
  idToken: string | null;
  signOut: () => void;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthState>({
  isAuthenticated: false,
  isLoading: true,
  idToken: null,
  signOut: () => {},
  refresh: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [idToken, setIdToken] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const session = await getSession();
    if (session) {
      setIsAuthenticated(true);
      setIdToken(session.getIdToken().getJwtToken());
    } else {
      setIsAuthenticated(false);
      setIdToken(null);
    }
  }, []);

  useEffect(() => {
    refresh().finally(() => setIsLoading(false));
  }, [refresh]);

  const handleSignOut = useCallback(() => {
    cognitoSignOut();
    setIsAuthenticated(false);
    setIdToken(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        isLoading,
        idToken,
        signOut: handleSignOut,
        refresh,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
