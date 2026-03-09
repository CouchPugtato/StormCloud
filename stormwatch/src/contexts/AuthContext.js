import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth as useClerkAuth, useUser, useSignIn, useSignUp } from '@clerk/clerk-expo';
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

const getRoleFromMetadata = (clerkUser) => {
  const roleFromMetadata = clerkUser?.publicMetadata?.role;
  return VALID_ROLES.has(roleFromMetadata) ? roleFromMetadata : DEFAULT_USER_ROLE;
};

const getDisplayName = (clerkUser) => {
  const fullName = [clerkUser?.firstName, clerkUser?.lastName].filter(Boolean).join(' ').trim();
  if (fullName) {
    return fullName;
  }
  if (clerkUser?.username) {
    return clerkUser.username;
  }
  const email = clerkUser?.primaryEmailAddress?.emailAddress;
  if (email && email.includes('@')) {
    return email.split('@')[0];
  }
  return 'Scouter';
};

const getMockProfiles = () => [
  {
    id: 'mock1',
    name: 'Alex Chen',
    role: DEFAULT_USER_ROLE,
    teamNumber: 1234,
    createdAt: '2024-01-15T10:00:00.000Z',
    stats: {
      totalMatches: 45,
      eventMatches: {
        '2024week1': 12,
        '2024week2': 8,
        '2024week3': 15,
        '2024regional': 10,
      },
      seasonMatches: 45,
      allTimeMatches: 127,
    },
  },
  {
    id: 'mock2',
    name: 'Jordan Smith',
    role: DEFAULT_USER_ROLE,
    teamNumber: 5678,
    createdAt: '2024-01-20T14:30:00.000Z',
    stats: {
      totalMatches: 38,
      eventMatches: {
        '2024week1': 10,
        '2024week2': 12,
        '2024week3': 8,
        '2024regional': 8,
      },
      seasonMatches: 38,
      allTimeMatches: 95,
    },
  },
  {
    id: 'mock3',
    name: 'Taylor Johnson',
    role: DEFAULT_USER_ROLE,
    teamNumber: 9012,
    createdAt: '2024-02-01T09:15:00.000Z',
    stats: {
      totalMatches: 52,
      eventMatches: {
        '2024week1': 15,
        '2024week2': 14,
        '2024week3': 12,
        '2024regional': 11,
      },
      seasonMatches: 52,
      allTimeMatches: 52,
    },
  },
  {
    id: 'mock4',
    name: 'Casey Williams',
    role: DEFAULT_USER_ROLE,
    teamNumber: 3456,
    createdAt: '2024-01-10T16:45:00.000Z',
    stats: {
      totalMatches: 29,
      eventMatches: {
        '2024week1': 8,
        '2024week2': 6,
        '2024week3': 9,
        '2024regional': 6,
      },
      seasonMatches: 29,
      allTimeMatches: 73,
    },
  },
  {
    id: 'mock5',
    name: 'Morgan Davis',
    role: DEFAULT_USER_ROLE,
    teamNumber: 7890,
    createdAt: '2024-01-25T11:20:00.000Z',
    stats: {
      totalMatches: 41,
      eventMatches: {
        '2024week1': 11,
        '2024week2': 10,
        '2024week3': 13,
        '2024regional': 7,
      },
      seasonMatches: 41,
      allTimeMatches: 89,
    },
  },
  {
    id: 'mock6',
    name: 'Riley Thompson',
    role: DEFAULT_USER_ROLE,
    teamNumber: 1357,
    createdAt: '2024-02-05T13:30:00.000Z',
    stats: {
      totalMatches: 33,
      eventMatches: {
        '2024week1': 9,
        '2024week2': 8,
        '2024week3': 10,
        '2024regional': 6,
      },
      seasonMatches: 33,
      allTimeMatches: 67,
    },
  },
  {
    id: 'mock7',
    name: 'Sam Rodriguez',
    role: DEFAULT_USER_ROLE,
    teamNumber: 2468,
    createdAt: '2024-01-28T08:45:00.000Z',
    stats: {
      totalMatches: 47,
      eventMatches: {
        '2024week1': 13,
        '2024week2': 11,
        '2024week3': 14,
        '2024regional': 9,
      },
      seasonMatches: 47,
      allTimeMatches: 102,
    },
  },
  {
    id: 'mock8',
    name: 'Avery Kim',
    role: DEFAULT_USER_ROLE,
    teamNumber: 8642,
    createdAt: '2024-02-10T15:20:00.000Z',
    stats: {
      totalMatches: 25,
      eventMatches: {
        '2024week1': 7,
        '2024week2': 6,
        '2024week3': 8,
        '2024regional': 4,
      },
      seasonMatches: 25,
      allTimeMatches: 25,
    },
  },
].map(normalizeUser);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const { isLoaded: clerkLoaded, isSignedIn, signOut: clerkSignOut } = useClerkAuth();
  const { user: clerkUser } = useUser();
  const { isLoaded: signInLoaded, signIn, setActive } = useSignIn();
  const { isLoaded: signUpLoaded, signUp } = useSignUp();

  const [user, setUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [profilesLoaded, setProfilesLoaded] = useState(false);
  const [loading, setLoading] = useState(true);

  const saveUsers = useCallback(async (updatedUsers) => {
    try {
      await AsyncStorage.setItem(PROFILES_STORAGE_KEY, JSON.stringify(updatedUsers));
      setUsers(updatedUsers);
    } catch (error) {
      console.error('Error saving users:', error);
    }
  }, []);

  useEffect(() => {
    const loadStoredProfiles = async () => {
      try {
        const storedProfiles = await AsyncStorage.getItem(PROFILES_STORAGE_KEY);
        if (storedProfiles) {
          const normalizedProfiles = JSON.parse(storedProfiles).map(normalizeUser);
          setUsers(normalizedProfiles);
        } else {
          const mockProfiles = getMockProfiles();
          await AsyncStorage.setItem(PROFILES_STORAGE_KEY, JSON.stringify(mockProfiles));
          setUsers(mockProfiles);
        }
      } catch (error) {
        console.error('Error loading stored profiles:', error);
        setUsers(getMockProfiles());
      } finally {
        setProfilesLoaded(true);
      }
    };

    loadStoredProfiles();
  }, []);

  useEffect(() => {
    if (!profilesLoaded || !clerkLoaded) {
      return;
    }

    if (!isSignedIn || !clerkUser) {
      setUser(null);
      setLoading(false);
      return;
    }

    const syncSignedInUser = async () => {
      const existingProfile = users.find((profile) => profile.id === clerkUser.id);
      const normalizedProfile = normalizeUser({
        id: clerkUser.id,
        name: getDisplayName(clerkUser),
        email: clerkUser.primaryEmailAddress?.emailAddress || null,
        role: getRoleFromMetadata(clerkUser),
        createdAt: existingProfile?.createdAt || (clerkUser.createdAt ? new Date(clerkUser.createdAt).toISOString() : new Date().toISOString()),
        stats: existingProfile?.stats || defaultStats,
      });

      const upsertedProfiles = existingProfile
        ? users.map((profile) => (profile.id === clerkUser.id ? normalizedProfile : profile))
        : [...users, normalizedProfile];

      const changed = JSON.stringify(existingProfile || null) !== JSON.stringify(normalizedProfile);
      if (!existingProfile || changed) {
        await saveUsers(upsertedProfiles);
      }

      setUser(normalizedProfile);
      setLoading(false);
    };

    syncSignedInUser();
  }, [profilesLoaded, clerkLoaded, isSignedIn, clerkUser, users, saveUsers]);

  const createAccount = async (email, password, firstName, lastName) => {
    if (!signUpLoaded) {
      throw new Error('Authentication is still loading. Please try again.');
    }
    if (!email.trim() || !password.trim()) {
      throw new Error('Email and password are required');
    }
    if (!firstName.trim() || !lastName.trim()) {
      throw new Error('First and last name are required');
    }

    const result = await signUp.create({
      emailAddress: email.trim(),
      password,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      unsafeMetadata: {
        role: DEFAULT_USER_ROLE,
      },
    });

    if (result.status === 'complete') {
      await setActive({ session: result.createdSessionId });
      return;
    }

    throw new Error('Account created but requires verification in Clerk settings. Complete verification, then sign in.');
  };

  const signInWithPassword = async (email, password) => {
    if (!signInLoaded) {
      throw new Error('Authentication is still loading. Please try again.');
    }

    if (!email.trim() || !password.trim()) {
      throw new Error('Email and password are required');
    }

    await signIn.create({
      identifier: email.trim(),
    });

    const result = await signIn.attemptFirstFactor({
      strategy: 'password',
      password,
    });

    if (result.status === 'complete') {
      await setActive({ session: result.createdSessionId });
      return { status: 'complete' };
    }

    if (result.status === 'needs_second_factor') {
      return { status: 'needs_second_factor' };
    }

    throw new Error(`Unable to sign in. Clerk status: ${result.status}`);
  };

  const completeSecondFactor = async (code) => {
    if (!signInLoaded) {
      throw new Error('Authentication is still loading. Please try again.');
    }
    if (!code || !code.trim()) {
      throw new Error('MFA code is required');
    }

    const availableFactors = signIn?.supportedSecondFactors || [];
    const preferredStrategies = ['totp', 'phone_code', 'backup_code'];
    let selectedStrategy = '';
    for (const strategy of preferredStrategies) {
      if (availableFactors.some((factor) => factor.strategy === strategy)) {
        selectedStrategy = strategy;
        break;
      }
    }
    if (!selectedStrategy && availableFactors.length > 0) {
      selectedStrategy = availableFactors[0].strategy;
    }
    if (!selectedStrategy) {
      throw new Error('No supported MFA strategy found for this account.');
    }

    const result = await signIn.attemptSecondFactor({
      strategy: selectedStrategy,
      code: code.trim(),
    });

    if (result.status === 'complete') {
      await setActive({ session: result.createdSessionId });
      return;
    }

    throw new Error(`Unable to complete MFA. Clerk status: ${result.status}`);
  };

  const startPasswordReset = async (email) => {
    if (!signInLoaded) {
      throw new Error('Authentication is still loading. Please try again.');
    }

    if (!email.trim()) {
      throw new Error('Email is required');
    }

    await signIn.create({
      strategy: 'reset_password_email_code',
      identifier: email.trim(),
    });
  };

  const completePasswordReset = async (code, newPassword) => {
    if (!signInLoaded) {
      throw new Error('Authentication is still loading. Please try again.');
    }

    if (!code.trim() || !newPassword.trim()) {
      throw new Error('Reset code and new password are required');
    }

    const result = await signIn.attemptFirstFactor({
      strategy: 'reset_password_email_code',
      code: code.trim(),
      password: newPassword,
    });

    if (result.status === 'complete') {
      await setActive({ session: result.createdSessionId });
      return;
    }

    throw new Error('Unable to reset password. Verify your code and try again.');
  };

  const signOut = async () => {
    try {
      await clerkSignOut();
      setUser(null);
    } catch (error) {
      console.error('Error signing out:', error);
    }
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

    await apiService.updateClerkUserRole({
      requester_id: user.id,
      target_user_id: targetUserID,
      target_role: targetRole,
    });

    const updatedUsers = users.map((profile) =>
      profile.id === targetUserID ? normalizeUser({ ...profile, role: targetRole }) : profile
    );
    await saveUsers(updatedUsers);

    if (user.id === targetUserID) {
      setUser((prev) => (prev ? normalizeUser({ ...prev, role: targetRole }) : prev));
    }
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

  const value = {
    user,
    users,
    loading,
    createAccount,
    signIn: signInWithPassword,
    completeSecondFactor,
    startPasswordReset,
    completePasswordReset,
    signOut,
    updateUserRole,
    updateUserStats,
    getLeaderboard,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
