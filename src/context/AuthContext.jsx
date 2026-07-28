import { createContext, useContext, useState } from "react";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => localStorage.getItem("username") || null);

  function signIn(token, username) {
    localStorage.setItem("token", token);
    localStorage.setItem("username", username);
    setUser(username);
  }

  function signOut() {
    localStorage.removeItem("token");
    localStorage.removeItem("username");
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
