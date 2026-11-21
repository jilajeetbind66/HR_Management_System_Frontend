import React, { createContext, useContext, useEffect, useState } from 'react';
import api, { getCachedUser, hasAuthToken, setAuthToken, setCachedUser } from '../services/api';
import { hasRolePermission } from '../config/roleAccess';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [activeBranch, setActiveBranch] = useState('All Branches');

  useEffect(() => {
    const cachedUser = getCachedUser();

    if (!hasAuthToken()) {
      setCachedUser(null);
      setIsLoading(false);
      return;
    }

    api.currentUser()
      .then((response) => {
        const user = response?.data;
        if (!user) {
          setAuthToken(null);
          setCachedUser(null);
          setCurrentUser(null);
          setIsAuthenticated(false);
          return;
        }

        setCurrentUser(user);
        setIsAuthenticated(true);
        setCachedUser(user);
      })
      .catch((error) => {
        if (error?.status === 401) {
          setAuthToken(null);
          setCachedUser(null);
          setCurrentUser(null);
          setIsAuthenticated(false);
          return;
        }

        if (cachedUser) {
          console.warn('[HRMS auth] Session validation unavailable; restoring the cached profile.', error);
          setCurrentUser(cachedUser);
          setIsAuthenticated(true);
          return;
        }

        setCurrentUser(null);
        setIsAuthenticated(false);
      })
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    if (currentUser) {
      if (currentUser.role === 'super_admin') {
        setActiveBranch((prev) => prev || 'All Branches');
      } else if (currentUser.branch_name) {
        setActiveBranch(currentUser.branch_name);
      }
    }
  }, [currentUser]);

  const handleSetActiveBranch = (branch) => {
    if (currentUser?.role === 'super_admin') {
      setActiveBranch(branch);
    }
  };

  const login = async (identifier, password, roleType, rememberMe) => {
    try {
      const response = await api.login(identifier, password, roleType);
      const { token, user } = response.data;
      setAuthToken(token, rememberMe);
      setCachedUser(user, rememberMe);
      setCurrentUser(user);
      setIsAuthenticated(true);
      return { success: true, user };
    } catch (error) {
      return {
        success: false,
        message: error?.data?.message || error.message || 'Unable to sign in.',
      };
    }
  };

  const changePassword = async (currentPassword, password, passwordConfirmation) => {
    try {
      const response = await api.changePassword(currentPassword, password, passwordConfirmation);
      const user = response?.data;
      if (!user) throw new Error('Password changed, but the updated account could not be loaded.');

      setCurrentUser(user);
      setCachedUser(user);
      return { success: true, user };
    } catch (error) {
      return {
        success: false,
        message: error?.data?.errors?.current_password?.[0]
          || error?.data?.errors?.password?.[0]
          || error?.data?.message
          || error.message
          || 'Unable to change the password.',
      };
    }
  };

  const refreshCurrentUser = async () => {
    const response = await api.currentUser();
    const user = response?.data;
    if (user) {
      setCurrentUser(user);
      setCachedUser(user);
    }
    return user;
  };

  const logout = async () => {
    try {
      if (isAuthenticated) await api.logout();
    } catch (error) {
      if (error?.status !== 401) throw error;
    } finally {
      setAuthToken(null);
      setCachedUser(null);
      setCurrentUser(null);
      setIsAuthenticated(false);
      setActiveBranch('All Branches');
    }
  };

  const hasPermission = (permission) => {
    if (!currentUser) return false;
    return hasRolePermission(currentUser.role, permission);
  };

  return (
    <AuthContext.Provider value={{
      currentUser,
      isAuthenticated,
      isLoading,
      activeBranch,
      setActiveBranch: handleSetActiveBranch,
      login,
      changePassword,
      refreshCurrentUser,
      logout,
      hasPermission,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
