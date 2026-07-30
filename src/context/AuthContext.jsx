import { createContext, useContext, useState } from "react";
import { logout } from "../api/client.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => localStorage.getItem("username") || null);

  function signIn(token, username) {
    localStorage.setItem("token", token);
    localStorage.setItem("username", username);
    setUser(username);
  }

  async function signOut() {
    // Revoke the token server-side FIRST (while it's still in localStorage for
    // the auth header), then clear the client. Best-effort: if the token is
    // already invalid/expired the server call may fail — we clear regardless.
    try {
      await logout();
    } catch { /* token already gone/expired — clearing locally is enough */ }
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
