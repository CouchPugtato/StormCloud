import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiService from '../utils/apiService';

const AuthContext = createContext();

export const USER_ROLES = {
  VIEWER: 'viewer',
  SCOUTER: 'scouter',
  SCOUTING_LEAD: 'scouting_lead',
  DRIVE_TEAM: 'drive_team',
};

const VALID_ROLES = new Set(Object.values(USER_ROLES));
const DEFAULT_USER_ROLE = USER_ROLES.VIEWER;

const PROFILES_STORAGE_KEY = 'stormwatch_profiles';
const AUTH_TOKEN_STORAGE_KEY = 'stormwatch_auth_token';
const AUTH_USER_STORAGE_KEY = 'stormwatch_auth_user';

const defaultStats = {
  totalMatches: 0,
  eventMatches: {},
  seasonMatches: 0,
  allTimeMatches: 0,
};

const normalizeUser = (rawUser) => {
  if (!rawUser) {
    return rawUser;
  }

  return {
    ...rawUser,
    role: VALID_ROLES.has(rawUser.role) ? rawUser.role : DEFAULT_USER_ROLE,
    stats: {
      ...defaultStats,
      ...(rawUser.stats || {}),
      eventMatches: {
        ...((rawUser.stats && rawUser.stats.eventMatches) || {}),
      },
    },
  };
};

const mapBackendUser = (backendUser, existingProfile = null) => {
  const firstName = (backendUser.first_name || '').trim();
  const lastName = (backendUser.last_name || '').trim();
  const fullName = `${firstName} ${lastName}`.trim();

  return normalizeUser({
    id: backendUser.id,
    email: backendUser.email || null,
    name: fullName || backendUser.email || 'User',
    role: backendUser.role || DEFAULT_USER_ROLE,
    createdAt: existingProfile?.createdAt || (backendUser.created_at ? new Date(backendUser.created_at * 1000).toISOString() : new Date().toISOString()),
    stats: existingProfile?.stats || defaultStats,
  });
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  const saveUsers = useCallback(async (updatedUsers) => {
    try {
      await AsyncStorage.setItem(PROFILES_STORAGE_KEY, JSON.stringify(updatedUsers));
      setUsers(updatedUsers);
    } catch (error) {
      console.error('Error saving users:', error);
    }
  }, []);

  const upsertProfile = useCallback(async (backendUser) => {
    setUsers((prevUsers) => {
      const existingProfile = prevUsers.find((profile) => profile.id === backendUser.id) || null;
      const mappedUser = mapBackendUser(backendUser, existingProfile);
      const updatedUsers = existingProfile
        ? prevUsers.map((profile) => (profile.id === mappedUser.id ? mappedUser : profile))
        : [...prevUsers, mappedUser];

      AsyncStorage.setItem(PROFILES_STORAGE_KEY, JSON.stringify(updatedUsers)).catch((err) => {
        console.error('Error saving users:', err);
      });
      setUser(mappedUser);
      AsyncStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(mappedUser)).catch((err) => {
        console.error('Error saving auth user:', err);
      });

      return updatedUsers;
    });
  }, []);

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const storedProfiles = await AsyncStorage.getItem(PROFILES_STORAGE_KEY);
        const parsedProfiles = storedProfiles ? JSON.parse(storedProfiles).map(normalizeUser) : [];
        setUsers(parsedProfiles);
        if (!storedProfiles) {
          await AsyncStorage.setItem(PROFILES_STORAGE_KEY, JSON.stringify(parsedProfiles));
        }

        const token = await AsyncStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
        if (token) {
          apiService.setAuthToken(token);
          try {
            const me = await apiService.authMe();
            const backendUser = me.user || me;
            const existingProfile = parsedProfiles.find((profile) => profile.id === backendUser.id) || null;
            const mappedUser = mapBackendUser(backendUser, existingProfile);

            const mergedUsers = existingProfile
              ? parsedProfiles.map((profile) => (profile.id === mappedUser.id ? mappedUser : profile))
              : [...parsedProfiles, mappedUser];

            setUsers(mergedUsers);
            setUser(mappedUser);
            await AsyncStorage.setItem(PROFILES_STORAGE_KEY, JSON.stringify(mergedUsers));
            await AsyncStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(mappedUser));
          } catch (error) {
            console.error('Stored session is invalid:', error);
            apiService.setAuthToken(null);
            await AsyncStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
            await AsyncStorage.removeItem(AUTH_USER_STORAGE_KEY);
            setUser(null);
          }
        } else {
          const storedUser = await AsyncStorage.getItem(AUTH_USER_STORAGE_KEY);
          if (storedUser) {
            setUser(normalizeUser(JSON.parse(storedUser)));
          }
        }
      } catch (error) {
        console.error('Error bootstrapping auth context:', error);
      } finally {
        setLoading(false);
      }
    };

    bootstrap();
  }, []);

  const createAccount = async (email, password, firstName, lastName) => {
    if (!email.trim() || !password.trim() || !firstName.trim() || !lastName.trim()) {
      throw new Error('Email, password, first name, and last name are required');
    }

    const result = await apiService.authRegister({
      email: email.trim(),
      password,
      first_name: firstName.trim(),
      last_name: lastName.trim(),
    });

    const token = result.token;
    const backendUser = result.user;
    apiService.setAuthToken(token);
    await AsyncStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
    await upsertProfile(backendUser);

    return backendUser;
  };

  const signIn = async (email, password) => {
    if (!email.trim() || !password.trim()) {
      throw new Error('Email and password are required');
    }

    const result = await apiService.authLogin({
      email: email.trim(),
      password,
    });

    const token = result.token;
    const backendUser = result.user;
    apiService.setAuthToken(token);
    await AsyncStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
    await upsertProfile(backendUser);

    return { status: 'complete' };
  };

  const signOut = async () => {
    try {
      await apiService.authLogout();
    } catch (error) {
      // best-effort logout
      console.error('Backend logout failed:', error);
    }

    apiService.setAuthToken(null);
    await AsyncStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
    await AsyncStorage.removeItem(AUTH_USER_STORAGE_KEY);
    setUser(null);
  };

  const completeSecondFactor = async () => {
    throw new Error('MFA is not configured for local auth.');
  };

  const startPasswordReset = async () => {
    throw new Error('Password reset is not yet implemented for local auth.');
  };

  const completePasswordReset = async () => {
    throw new Error('Password reset is not yet implemented for local auth.');
  };

  const updateUserRole = async (targetUserID, targetRole) => {
    if (!user) {
      throw new Error('You must be signed in.');
    }
    if (user.role !== USER_ROLES.SCOUTING_LEAD) {
      throw new Error('Only scouting leads can change account roles.');
    }
    if (!targetUserID || !VALID_ROLES.has(targetRole)) {
      throw new Error('Invalid role update request.');
    }

    await apiService.updateUserRole({
      target_user_id: targetUserID,
      target_role: targetRole,
    });

    const updatedUsers = users.map((profile) =>
      profile.id === targetUserID ? normalizeUser({ ...profile, role: targetRole }) : profile
    );
    await saveUsers(updatedUsers);

    if (user.id === targetUserID) {
      const updatedCurrent = normalizeUser({ ...user, role: targetRole });
      setUser(updatedCurrent);
      await AsyncStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(updatedCurrent));
    }
  };

  const getLeaderboard = (type = 'allTime', eventKey = null) => {
    let sortedUsers = [...users];

    switch (type) {
      case 'event':
        if (!eventKey) {
          return [];
        }
        sortedUsers = sortedUsers
          .map((profile) => ({
            ...profile,
            matchCount: profile.stats.eventMatches[eventKey] || 0,
          }))
          .filter((profile) => profile.matchCount > 0)
          .sort((a, b) => b.matchCount - a.matchCount);
        break;
      case 'season':
        sortedUsers = sortedUsers
          .map((profile) => ({
            ...profile,
            matchCount: profile.stats.seasonMatches || 0,
          }))
          .filter((profile) => profile.matchCount > 0)
          .sort((a, b) => b.matchCount - a.matchCount);
        break;
      case 'allTime':
      default:
        sortedUsers = sortedUsers
          .map((profile) => ({
            ...profile,
            matchCount: profile.stats.allTimeMatches || 0,
          }))
          .filter((profile) => profile.matchCount > 0)
          .sort((a, b) => b.matchCount - a.matchCount);
        break;
    }

    return sortedUsers.map((profile, index) => ({
      ...profile,
      rank: index + 1,
    }));
  };

  const updateUserStats = async (matchData) => {
    if (!user) {
      return;
    }

    const updatedUser = {
      ...user,
      stats: {
        ...user.stats,
        totalMatches: user.stats.totalMatches + 1,
        seasonMatches: user.stats.seasonMatches + 1,
        allTimeMatches: user.stats.allTimeMatches + 1,
        eventMatches: {
          ...user.stats.eventMatches,
          [matchData.eventKey]: (user.stats.eventMatches[matchData.eventKey] || 0) + 1,
        },
      },
    };

    const updatedUsers = users.map((profile) => (profile.id === user.id ? updatedUser : profile));
    await saveUsers(updatedUsers);
    setUser(updatedUser);
    await AsyncStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(updatedUser));
  };

  const value = {
    user,
    users,
    loading,
    createAccount,
    signIn,
    signOut,
    completeSecondFactor,
    startPasswordReset,
    completePasswordReset,
    updateUserRole,
    updateUserStats,
    getLeaderboard,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
