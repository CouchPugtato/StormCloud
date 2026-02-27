import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const AuthContext = createContext();
export const USER_ROLES = {
  SCOUTER: 'scouter',
  SCOUTING_LEAD: 'scouting_lead',
  DRIVE_TEAM: 'drive_team',
};
const VALID_ROLES = new Set(Object.values(USER_ROLES));
const DEFAULT_USER_ROLE = USER_ROLES.SCOUTER;

const normalizeUser = (rawUser) => {
  if (!rawUser) {
    return rawUser;
  }

  return {
    ...rawUser,
    role: VALID_ROLES.has(rawUser.role) ? rawUser.role : DEFAULT_USER_ROLE,
    stats: {
      totalMatches: 0,
      eventMatches: {},
      seasonMatches: 0,
      allTimeMatches: 0,
      ...(rawUser.stats || {}),
      eventMatches: {
        ...((rawUser.stats && rawUser.stats.eventMatches) || {}),
      },
    },
  };
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

  useEffect(() => {
    loadStoredData();
  }, []);

  useEffect(() => {
    const initializeMockData = async () => {
      if (users.length === 0) {
        const mockUsers = [
          {
            id: 'mock1',
            name: 'Alex Chen',
            password: 'demo123',
            role: DEFAULT_USER_ROLE,
            teamNumber: 1234,
            createdAt: '2024-01-15T10:00:00.000Z',
            stats: {
              totalMatches: 45,
              eventMatches: {
                '2024week1': 12,
                '2024week2': 8,
                '2024week3': 15,
                '2024regional': 10
              },
              seasonMatches: 45,
              allTimeMatches: 127
            }
          },
          {
            id: 'mock2',
            name: 'Jordan Smith',
            password: 'demo123',
            role: DEFAULT_USER_ROLE,
            teamNumber: 5678,
            createdAt: '2024-01-20T14:30:00.000Z',
            stats: {
              totalMatches: 38,
              eventMatches: {
                '2024week1': 10,
                '2024week2': 12,
                '2024week3': 8,
                '2024regional': 8
              },
              seasonMatches: 38,
              allTimeMatches: 95
            }
          },
          {
            id: 'mock3',
            name: 'Taylor Johnson',
            password: 'demo123',
            role: DEFAULT_USER_ROLE,
            teamNumber: 9012,
            createdAt: '2024-02-01T09:15:00.000Z',
            stats: {
              totalMatches: 52,
              eventMatches: {
                '2024week1': 15,
                '2024week2': 14,
                '2024week3': 12,
                '2024regional': 11
              },
              seasonMatches: 52,
              allTimeMatches: 52
            }
          },
          {
            id: 'mock4',
            name: 'Casey Williams',
            password: 'demo123',
            role: DEFAULT_USER_ROLE,
            teamNumber: 3456,
            createdAt: '2024-01-10T16:45:00.000Z',
            stats: {
              totalMatches: 29,
              eventMatches: {
                '2024week1': 8,
                '2024week2': 6,
                '2024week3': 9,
                '2024regional': 6
              },
              seasonMatches: 29,
              allTimeMatches: 73
            }
          },
          {
            id: 'mock5',
            name: 'Morgan Davis',
            password: 'demo123',
            role: DEFAULT_USER_ROLE,
            teamNumber: 7890,
            createdAt: '2024-01-25T11:20:00.000Z',
            stats: {
              totalMatches: 41,
              eventMatches: {
                '2024week1': 11,
                '2024week2': 10,
                '2024week3': 13,
                '2024regional': 7
              },
              seasonMatches: 41,
              allTimeMatches: 89
            }
          },
          {
            id: 'mock6',
            name: 'Riley Thompson',
            password: 'demo123',
            role: DEFAULT_USER_ROLE,
            teamNumber: 1357,
            createdAt: '2024-02-05T13:30:00.000Z',
            stats: {
              totalMatches: 33,
              eventMatches: {
                '2024week1': 9,
                '2024week2': 8,
                '2024week3': 10,
                '2024regional': 6
              },
              seasonMatches: 33,
              allTimeMatches: 67
            }
          },
          {
            id: 'mock7',
            name: 'Sam Rodriguez',
            password: 'demo123',
            role: DEFAULT_USER_ROLE,
            teamNumber: 2468,
            createdAt: '2024-01-28T08:45:00.000Z',
            stats: {
              totalMatches: 47,
              eventMatches: {
                '2024week1': 13,
                '2024week2': 11,
                '2024week3': 14,
                '2024regional': 9
              },
              seasonMatches: 47,
              allTimeMatches: 102
            }
          },
          {
            id: 'mock8',
            name: 'Avery Kim',
            password: 'demo123',
            role: DEFAULT_USER_ROLE,
            teamNumber: 8642,
            createdAt: '2024-02-10T15:20:00.000Z',
            stats: {
              totalMatches: 25,
              eventMatches: {
                '2024week1': 7,
                '2024week2': 6,
                '2024week3': 8,
                '2024regional': 4
              },
              seasonMatches: 25,
              allTimeMatches: 25
            }
          }
        ];
        
        await saveUsers(mockUsers);
      }
    };
    
    initializeMockData();
  }, [users.length]);

  const loadStoredData = async () => {
    try {
      const storedUsers = await AsyncStorage.getItem('stormwatch_users');
      const currentUser = await AsyncStorage.getItem('stormwatch_current_user');
      let normalizedUsers = [];
      
      if (storedUsers) {
        const parsedUsers = JSON.parse(storedUsers);
        normalizedUsers = parsedUsers.map(normalizeUser);
        setUsers(normalizedUsers);
        if (JSON.stringify(parsedUsers) !== JSON.stringify(normalizedUsers)) {
          await AsyncStorage.setItem('stormwatch_users', JSON.stringify(normalizedUsers));
        }
      }
      
      if (currentUser) {
        const parsedCurrentUser = JSON.parse(currentUser);
        const normalizedCurrentUser = normalizeUser(parsedCurrentUser);
        const syncedCurrentUser = normalizedUsers.find((u) => u.id === normalizedCurrentUser.id) || normalizedCurrentUser;
        setUser(syncedCurrentUser);
        if (JSON.stringify(parsedCurrentUser) !== JSON.stringify(syncedCurrentUser)) {
          await AsyncStorage.setItem('stormwatch_current_user', JSON.stringify(syncedCurrentUser));
        }
      }
    } catch (error) {
      console.error('Error loading stored data:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveUsers = async (updatedUsers) => {
    try {
      await AsyncStorage.setItem('stormwatch_users', JSON.stringify(updatedUsers));
      setUsers(updatedUsers);
    } catch (error) {
      console.error('Error saving users:', error);
    }
  };

  const saveCurrentUser = async (userData) => {
    try {
      await AsyncStorage.setItem('stormwatch_current_user', JSON.stringify(userData));
      setUser(userData);
    } catch (error) {
      console.error('Error saving current user:', error);
    }
  };

  const createAccount = async (name, password) => {
    if (!name.trim() || !password.trim()) {
      throw new Error('Name and password are required');
    }

    if (name.length < 2) {
      throw new Error('Name must be at least 2 characters long');
    }

    if (password.length < 4) {
      throw new Error('Password must be at least 4 characters long');
    }

    const existingUser = users.find(u => u.name.toLowerCase() === name.toLowerCase());
    if (existingUser) {
      throw new Error('A user with this name already exists');
    }

    const newUser = {
      id: Date.now().toString(),
      name: name.trim(),
      password,
      role: DEFAULT_USER_ROLE,
      createdAt: new Date().toISOString(),
      stats: {
        totalMatches: 0,
        eventMatches: {},
        seasonMatches: 0,
        allTimeMatches: 0
      }
    };

    const updatedUsers = [...users, newUser];
    await saveUsers(updatedUsers);
    await saveCurrentUser(newUser);

    return newUser;
  };

  const signIn = async (name, password) => {
    if (!name.trim() || !password.trim()) {
      throw new Error('Name and password are required');
    }

    const existingUser = users.find(u => u.name.toLowerCase() === name.toLowerCase());
    if (!existingUser) {
      throw new Error('User not found');
    }

    if (existingUser.password !== password) {
      throw new Error('Incorrect password');
    }

    await saveCurrentUser(existingUser);
    return existingUser;
  };

  const updateUserRole = async (role) => {
    if (!user || !VALID_ROLES.has(role)) {
      return;
    }

    const updatedUser = {
      ...user,
      role,
    };

    const updatedUsers = users.map((u) => (u.id === user.id ? updatedUser : u));
    await saveUsers(updatedUsers);
    await saveCurrentUser(updatedUser);
  };

  const signOut = async () => {
    try {
      await AsyncStorage.removeItem('stormwatch_current_user');
      setUser(null);
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const updateUserStats = async (matchData) => {
    if (!user) return;

    const updatedUser = {
      ...user,
      stats: {
        ...user.stats,
        totalMatches: user.stats.totalMatches + 1,
        seasonMatches: user.stats.seasonMatches + 1,
        allTimeMatches: user.stats.allTimeMatches + 1,
        eventMatches: {
          ...user.stats.eventMatches,
          [matchData.eventKey]: (user.stats.eventMatches[matchData.eventKey] || 0) + 1
        }
      }
    };

    const updatedUsers = users.map(u => u.id === user.id ? updatedUser : u);
    await saveUsers(updatedUsers);
    await saveCurrentUser(updatedUser);
  };

  const getLeaderboard = (type = 'allTime', eventKey = null) => {
    let sortedUsers = [...users];

    switch (type) {
      case 'event':
        if (!eventKey) return [];
        sortedUsers = sortedUsers
          .map(user => ({
            ...user,
            matchCount: user.stats.eventMatches[eventKey] || 0
          }))
          .filter(user => user.matchCount > 0)
          .sort((a, b) => b.matchCount - a.matchCount);
        break;
      case 'season':
        sortedUsers = sortedUsers
          .map(user => ({
            ...user,
            matchCount: user.stats.seasonMatches || 0
          }))
          .filter(user => user.matchCount > 0)
          .sort((a, b) => b.matchCount - a.matchCount);
        break;
      case 'allTime':
      default:
        sortedUsers = sortedUsers
          .map(user => ({
            ...user,
            matchCount: user.stats.allTimeMatches || 0
          }))
          .filter(user => user.matchCount > 0)
          .sort((a, b) => b.matchCount - a.matchCount);
        break;
    }

    return sortedUsers.map((user, index) => ({
      ...user,
      rank: index + 1
    }));
  };

  const value = {
    user,
    users,
    loading,
    createAccount,
    signIn,
    signOut,
    updateUserRole,
    updateUserStats,
    getLeaderboard
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

