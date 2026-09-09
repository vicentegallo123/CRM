
import { useCallback, useEffect, useState } from "react";
import {
  fetchCurrentUser,
  getAccessToken,
  loginUser,
  logoutUser,
  registerUser,
} from "../api/businessApi.js";

export function useAuthVM() {
  const [user, setUser] = useState(null);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [authError, setAuthError] = useState(null);

  const loadCurrentUser = useCallback(async () => {
    if (!getAccessToken()) {
      setUser(null);
      setIsCheckingSession(false);
      return;
    }
    try {
      const currentUser = await fetchCurrentUser();
      setUser(currentUser);
    } catch {
      setUser(null);
    } finally {
      setIsCheckingSession(false);
    }
  }, []);

  useEffect(() => {
    loadCurrentUser();
  }, [loadCurrentUser]);

  const login = useCallback(async ({ email, password }) => {
    setIsSubmitting(true);
    setAuthError(null);
    try {
      const data = await loginUser({ email, password });
      setUser(data.user);
      return true;
    } catch (err) {
      setAuthError(err?.response?.data?.detail || "No se pudo iniciar sesión.");
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  const register = useCallback(async ({ email, fullName, password, role }) => {
    setIsSubmitting(true);
    setAuthError(null);
    try {
      await registerUser({ email, fullName, password, role });
      return await login({ email, password });
    } catch (err) {
      setAuthError(err?.response?.data?.detail || "No se pudo completar el registro.");
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, [login]);

  const logout = useCallback(async () => {
    await logoutUser();
    setUser(null);
  }, []);

  const clearAuthError = useCallback(() => setAuthError(null), []);

  return {
    user,
    isAuthenticated: Boolean(user),
    isCheckingSession,
    isSubmitting,
    authError,
    login,
    register,
    logout,
    clearAuthError,
  };
}

export default useAuthVM;
