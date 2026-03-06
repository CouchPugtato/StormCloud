import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth, USER_ROLES } from '../contexts/AuthContext';
import { platformUtils } from '../utils/platformUtils';

export default function ProfileScreen() {
  const { theme } = useTheme();
  const { user, signIn, signOut, getLeaderboard, startPasswordReset, completePasswordReset } = useAuth();
  const [activeTab, setActiveTab] = useState('leaderboard');
  const [authMode, setAuthMode] = useState('signin'); // 'signin' | 'forgot_request' | 'forgot_confirm'
  const [formData, setFormData] = useState({ email: '', password: '', resetCode: '', newPassword: '' });
  const [leaderboardType, setLeaderboardType] = useState('event');
  const [selectedEvent, setSelectedEvent] = useState('2024week1');
  const [loading, setLoading] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);

  const roleOptions = [
    { key: USER_ROLES.SCOUTER, label: 'Scouter' },
    { key: USER_ROLES.SCOUTING_LEAD, label: 'Scouting Lead' },
    { key: USER_ROLES.DRIVE_TEAM, label: 'Drive Team' },
  ];
  const currentRole = user?.role || USER_ROLES.SCOUTER;

  const upcomingMatches = [
    {
      id: 1,
      matchNumber: 'Qual 32',
      redAlliance: [1234, 5678, 9012],
      blueAlliance: [3456, 7890, 1357],
      userTeam: 5678, // team user is supposed to scout
      allianceColor: 'red'
    },
    {
      id: 2,
      matchNumber: 'Qual 45',
      redAlliance: [2468, 1357, 9753],
      blueAlliance: [8642, 1111, 2222],
      userTeam: 1111,
      allianceColor: 'blue'
    },
    {
      id: 3,
      matchNumber: 'Qual 61',
      redAlliance: [3333, 4444, 5555],
      blueAlliance: [6666, 7777, 8888],
      userTeam: 4444,
      allianceColor: 'red'
    },
    {
      id: 4,
      matchNumber: 'Qual 78',
      redAlliance: [9999, 1010, 1212],
      blueAlliance: [1313, 1414, 1515],
      userTeam: 1313,
      allianceColor: 'blue'
    }
  ];

  const events = [
    { key: '2024week1', name: '2024 Week 1' },
    { key: '2024week2', name: '2024 Week 2' },
    { key: '2024week3', name: '2024 Week 3' },
    { key: '2024regional', name: '2024 Regional Championship' },
  ];

  const leaderboardData = useMemo(() => {
    return getLeaderboard(leaderboardType, selectedEvent);
  }, [getLeaderboard, leaderboardType, selectedEvent]);

  const handleAuth = async () => {
    if (!formData.email.trim()) {
      Alert.alert('Error', 'Please enter your email');
      return;
    }

    if (authMode === 'signin' && !formData.password.trim()) {
      Alert.alert('Error', 'Please enter your password');
      return;
    }

    if (authMode === 'forgot_confirm' && (!formData.resetCode.trim() || !formData.newPassword.trim())) {
      Alert.alert('Error', 'Please enter your reset code and new password');
      return;
    }

    setLoading(true);
    try {
      if (authMode === 'signin') {
        await signIn(formData.email.trim(), formData.password);
        Alert.alert('Success', 'Signed in successfully!');
        setShowAuthModal(false);
      } else if (authMode === 'forgot_request') {
        await startPasswordReset(formData.email.trim());
        Alert.alert('Reset Code Sent', 'Check your email for a password reset code.');
        setAuthMode('forgot_confirm');
      } else if (authMode === 'forgot_confirm') {
        await completePasswordReset(formData.resetCode.trim(), formData.newPassword);
        Alert.alert('Success', 'Password reset complete. You are now signed in.');
        setShowAuthModal(false);
      }
      setFormData({ email: '', password: '', resetCode: '', newPassword: '' });
    } catch (error) {
      Alert.alert('Error', error?.errors?.[0]?.longMessage || error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign Out', style: 'destructive', onPress: signOut },
      ]
    );
  };

  const renderAuthForm = () => (
    <View style={styles.authContainer}>
      <View style={styles.authHeader}>
        <Text style={[styles.authTitle, { color: theme.colors.text }]}>
          {authMode === 'signin' && 'Sign In'}
          {authMode === 'forgot_request' && 'Reset Password'}
          {authMode === 'forgot_confirm' && 'Enter Reset Code'}
        </Text>
        <Text style={[styles.authSubtitle, { color: theme.colors.textSecondary }]}>
          {authMode === 'signin' && 'Sign in with your Clerk account'}
          {authMode === 'forgot_request' && 'We will email a reset code to your account'}
          {authMode === 'forgot_confirm' && 'Enter the code and choose a new password'}
        </Text>
      </View>

      <View style={styles.formContainer}>
        <View style={styles.inputContainer}>
          <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Email</Text>
          <TextInput
            style={[styles.input, { 
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
              color: theme.colors.text
            }]}
            value={formData.email}
            onChangeText={(text) => setFormData({ ...formData, email: text })}
            placeholder="you@example.com"
            placeholderTextColor={theme.colors.textSecondary}
            autoCapitalize="none"
            keyboardType="email-address"
          />
        </View>

        {authMode === 'signin' && (
          <View style={styles.inputContainer}>
            <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Password</Text>
            <TextInput
              style={[styles.input, { 
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
                color: theme.colors.text
              }]}
              value={formData.password}
              onChangeText={(text) => setFormData({ ...formData, password: text })}
              placeholder="Enter your password"
              placeholderTextColor={theme.colors.textSecondary}
              secureTextEntry
            />
          </View>
        )}

        {authMode === 'forgot_confirm' && (
          <View>
            <View style={styles.inputContainer}>
              <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Reset Code</Text>
              <TextInput
                style={[styles.input, { 
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.border,
                  color: theme.colors.text
                }]}
                value={formData.resetCode}
                onChangeText={(text) => setFormData({ ...formData, resetCode: text })}
                placeholder="Enter email reset code"
                placeholderTextColor={theme.colors.textSecondary}
                autoCapitalize="none"
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={[styles.inputLabel, { color: theme.colors.text }]}>New Password</Text>
              <TextInput
                style={[styles.input, { 
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.border,
                  color: theme.colors.text
                }]}
                value={formData.newPassword}
                onChangeText={(text) => setFormData({ ...formData, newPassword: text })}
                placeholder="Enter a new password"
                placeholderTextColor={theme.colors.textSecondary}
                secureTextEntry
              />
            </View>
          </View>
        )}

        <TouchableOpacity
          style={[styles.authButton, { 
            backgroundColor: (
              !formData.email.trim() ||
              (authMode === 'signin' && !formData.password.trim()) ||
              (authMode === 'forgot_confirm' && (!formData.resetCode.trim() || !formData.newPassword.trim())) ||
              loading
            )
              ? theme.colors.textSecondary 
              : theme.colors.primary 
          }]}
          onPress={handleAuth}
          disabled={
            !formData.email.trim() ||
            (authMode === 'signin' && !formData.password.trim()) ||
            (authMode === 'forgot_confirm' && (!formData.resetCode.trim() || !formData.newPassword.trim())) ||
            loading
          }
        >
          <Text style={styles.authButtonText}>
            {loading && 'Loading...'}
            {!loading && authMode === 'signin' && 'Sign In'}
            {!loading && authMode === 'forgot_request' && 'Send Reset Code'}
            {!loading && authMode === 'forgot_confirm' && 'Reset Password'}
          </Text>
        </TouchableOpacity>

        {authMode === 'signin' && (
          <TouchableOpacity
            style={styles.switchModeButton}
            onPress={() => {
              setAuthMode('forgot_request');
              setFormData({ ...formData, resetCode: '', newPassword: '' });
            }}
          >
            <Text style={[styles.switchModeText, { color: theme.colors.primary }]}>
              Forgot password?
            </Text>
          </TouchableOpacity>
        )}

        {(authMode === 'forgot_request' || authMode === 'forgot_confirm') && (
          <TouchableOpacity
            style={styles.switchModeButton}
            onPress={() => {
              setAuthMode('signin');
              setFormData({ ...formData, resetCode: '', newPassword: '' });
            }}
          >
            <Text style={[styles.switchModeText, { color: theme.colors.primary }]}>
              Back to sign in
            </Text>
          </TouchableOpacity>
        )}
      </View>

      <Text style={[styles.authHint, { color: theme.colors.textSecondary }]}>
        Accounts are invite-only. Scouting lead and drive team roles are assigned by admins.
      </Text>
    </View>
  );

  const renderProfile = () => (
    <View style={styles.profileContainer}>
      <View style={styles.profileHeader}>
        <View style={[styles.avatarContainer, { backgroundColor: theme.colors.primary }]}>
          <Ionicons name="person" size={40} color="white" />
        </View>
        <Text style={[styles.profileName, { color: theme.colors.text }]}>{user.name}</Text>
        <Text style={[styles.profileJoinDate, { color: theme.colors.textSecondary }]}>
          Joined {new Date(user.createdAt).toLocaleDateString()}
        </Text>
      </View>

      <View style={[styles.roleSection, { backgroundColor: theme.colors.surface }]}>
        <Text style={[styles.roleSectionTitle, { color: theme.colors.text }]}>Role</Text>
        <View style={styles.roleButtonRow}>
          {roleOptions.map((option) => (
            <View
              key={option.key}
              style={[
                styles.roleButton,
                { borderColor: theme.colors.border },
                currentRole === option.key && { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary }
              ]}
            >
              <Text
                style={[
                  styles.roleButtonText,
                  { color: theme.colors.text },
                  currentRole === option.key && { color: 'white' }
                ]}
              >
                {option.label}
              </Text>
            </View>
          ))}
        </View>
        <Text style={[styles.roleNote, { color: theme.colors.textSecondary }]}>
          Role is managed by scouting lead / drive team admins.
        </Text>
      </View>

      <View style={styles.statsContainer}>
        <View style={[styles.statCard, { backgroundColor: theme.colors.surface }]}>
          <Ionicons name="trophy" size={24} color="#FFD700" />
          <Text style={[styles.statValue, { color: theme.colors.text }]}>
            {user.stats.allTimeMatches}
          </Text>
          <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>All Time</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: theme.colors.surface }]}>
          <Ionicons name="calendar" size={24} color="#4ECDC4" />
          <Text style={[styles.statValue, { color: theme.colors.text }]}>
            {user.stats.seasonMatches}
          </Text>
          <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>This Season</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: theme.colors.surface }]}>
          <Ionicons name="flag" size={24} color="#FF6B6B" />
          <Text style={[styles.statValue, { color: theme.colors.text }]}>
            {Object.keys(user.stats.eventMatches).length}
          </Text>
          <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>Events</Text>
        </View>
      </View>

      <TouchableOpacity
        style={[styles.signOutButton, { backgroundColor: theme.colors.error }]}
        onPress={handleSignOut}
      >
        <Ionicons name="log-out" size={20} color="white" />
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>
    </View>
  );

  const renderLeaderboard = () => {
    const leaderboardData = getLeaderboard(leaderboardType, selectedEvent);

    return (
      <View style={styles.leaderboardContainer}>
        <View style={styles.leaderboardFilters}>
          <View style={styles.filterRow}>
            <TouchableOpacity
              style={[styles.filterButton,
                leaderboardType === 'event' && { backgroundColor: theme.colors.primary }
              ]}
              onPress={() => setLeaderboardType('event')}
            >
              <Text style={[styles.filterButtonText,
                leaderboardType === 'event' && { color: 'white' },
                { color: theme.colors.text }
              ]}>Event</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterButton,
                leaderboardType === 'season' && { backgroundColor: theme.colors.primary }
              ]}
              onPress={() => setLeaderboardType('season')}
            >
              <Text style={[styles.filterButtonText,
                leaderboardType === 'season' && { color: 'white' },
                { color: theme.colors.text }
              ]}>Season</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterButton, 
                leaderboardType === 'allTime' && { backgroundColor: theme.colors.primary }
              ]}
              onPress={() => setLeaderboardType('allTime')}
            >
              <Text style={[styles.filterButtonText, 
                leaderboardType === 'allTime' && { color: 'white' },
                { color: theme.colors.text }
              ]}>All Time</Text>
            </TouchableOpacity>
          </View>

          {leaderboardType === 'event' && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.eventSelector}>
              {events.map((event) => (
                <TouchableOpacity
                  key={event.key}
                  style={[styles.eventButton,
                    selectedEvent === event.key && { backgroundColor: theme.colors.primary }
                  ]}
                  onPress={() => setSelectedEvent(event.key)}
                >
                  <Text style={[styles.eventButtonText,
                    selectedEvent === event.key && { color: 'white' },
                    { color: theme.colors.text }
                  ]}>{event.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>

        <View style={styles.scrollableLeaderboard}>
          <FlatList
            data={leaderboardData}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={true}
            renderItem={({ item }) => {
              const getRankStyle = (rank) => {
                if (rank === 1) return { borderColor: '#FFD700', borderWidth: 3 }; // Gold
                if (rank === 2) return { borderColor: '#C0C0C0', borderWidth: 3 }; // Silver
                if (rank === 3) return { borderColor: '#CD7F32', borderWidth: 3 }; // Bronze
                return { borderColor: item.id === user?.id ? theme.colors.primary : theme.colors.border, borderWidth: 2 };
              };
              
              const getRankIcon = (rank) => {
                if (rank === 1) return { name: 'trophy', color: '#FFD700' };
                if (rank === 2) return { name: 'medal', color: '#C0C0C0' };
                if (rank === 3) return { name: 'medal', color: '#CD7F32' };
                return { name: item.id === user?.id ? "person-circle" : "person", color: item.id === user?.id ? theme.colors.primary : theme.colors.textSecondary };
              };
              
              const rankIcon = getRankIcon(item.rank);
              
              return (
                <View style={[styles.leaderboardItem, { 
                  backgroundColor: theme.colors.surface,
                  ...getRankStyle(item.rank)
                }]}>
                  <View style={styles.rankContainer}>
                    <Text style={[styles.rank, { 
                      color: item.rank <= 3 ? (item.rank === 1 ? '#FFD700' : item.rank === 2 ? '#C0C0C0' : '#CD7F32') : theme.colors.text,
                      fontSize: item.rank <= 3 ? 20 : 18
                    }]}>#{item.rank}</Text>
                  </View>
                  <View style={styles.userInfo}>
                    <Ionicons 
                      name={rankIcon.name}
                      size={item.rank <= 3 ? 28 : 24} 
                      color={rankIcon.color}
                    />
                    <Text style={[styles.userName, { 
                      color: theme.colors.text,
                      fontWeight: item.id === user?.id || item.rank <= 3 ? 'bold' : 'normal'
                    }]}>{item.name}</Text>
                  </View>
                  <View style={styles.matchCount}>
                    <Text style={[styles.matchCountText, { color: theme.colors.text }]}>
                      {item.matchCount}
                    </Text>
                    <Text style={[styles.matchCountLabel, { color: theme.colors.textSecondary }]}>matches</Text>
                  </View>
                </View>
              );
            }}
            ListEmptyComponent={
              <View style={styles.emptyLeaderboard}>
                <Ionicons name="trophy-outline" size={48} color={theme.colors.textSecondary} />
                <Text style={[styles.emptyLeaderboardText, { color: theme.colors.textSecondary }]}>
                  No scouting data available
                </Text>
              </View>
            }
          />
        </View>
      </View>
    );
  };

  const renderUpcomingMatches = () => {
    const title = user ? 'Your Next Matches' : 'Sample Upcoming Matches';
    
    return (
      <View style={styles.upcomingMatchesContainer}>
        <Text style={[styles.upcomingMatchesTitle, { color: theme.colors.text }]}>{title}</Text>
        <FlatList
          data={upcomingMatches}
          keyExtractor={(item) => item.id.toString()}
          horizontal={true}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.horizontalMatchList}
          renderItem={({ item, index }) => {
            const scoutTeam = item.allianceColor === 'red' ? item.blueAlliance[0] : item.redAlliance[0];
            
            return (
              <View style={[
                styles.compactMatchItem, 
                { backgroundColor: theme.colors.surface }
              ]}>
                <View style={styles.compactMatchHeader}>
                  <Text style={[styles.compactMatchNumber, { color: theme.colors.text }]}>
                    {item.matchNumber}
                  </Text>
                </View>
                <View style={styles.compactAlliancesContainer}>
                  <View style={styles.compactAllianceRow}>
                    <Text style={[styles.compactAllianceLabel, { color: '#FF4444' }]}>Red:</Text>
                    <View style={styles.compactTeamsRow}>
                      {item.redAlliance.map((team, teamIndex) => (
                        <View 
                          key={teamIndex} 
                          style={[
                            styles.compactTeamNumber,
                            { backgroundColor: team === scoutTeam ? '#FFD700' : theme.colors.background },
                            team === scoutTeam && styles.scoutTeamHighlight
                          ]}
                        >
                          <Text style={[
                            styles.compactTeamNumberText,
                            { color: team === scoutTeam ? '#000' : theme.colors.text }
                          ]}>{team}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                  <View style={styles.compactAllianceRow}>
                    <Text style={[styles.compactAllianceLabel, { color: '#4444FF' }]}>Blue:</Text>
                    <View style={styles.compactTeamsRow}>
                      {item.blueAlliance.map((team, teamIndex) => (
                        <View 
                          key={teamIndex} 
                          style={[
                            styles.compactTeamNumber,
                            { backgroundColor: team === scoutTeam ? '#FFD700' : theme.colors.background },
                            team === scoutTeam && styles.scoutTeamHighlight
                          ]}
                        >
                          <Text style={[
                            styles.compactTeamNumberText,
                            { color: team === scoutTeam ? '#000' : theme.colors.text }
                          ]}>{team}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                </View>
                <View style={styles.compactScoutingInfo}>
                    <TouchableOpacity style={[styles.scoutButton, { backgroundColor: theme.colors.primary }]}>
                      <Text style={styles.scoutButtonText}>Scout</Text>
                    </TouchableOpacity>
                  </View>
              </View>
            );
          }}
        />
      </View>
    );
  };

  const renderMyStatistics = () => {
    const dummyStats = {
      allTimeMatches: 47,
      seasonMatches: 23,
      eventMatches: { '2024week1': 8, '2024week2': 12, '2024regional': 3 }
    };
    
    const stats = user ? user.stats : dummyStats;
    const title = user ? 'My Statistics' : 'Sample Statistics';
    
    return (
      <View style={styles.myStatsContainer}>
        <Text style={[styles.myStatsTitle, { color: theme.colors.text }]}>{title}</Text>
        <View style={styles.statsContainer}>
          <View style={[styles.statCard, { backgroundColor: theme.colors.surface }]}>
            <Ionicons name="trophy" size={24} color="#FFD700" />
            <Text style={[styles.statValue, { color: theme.colors.text }]}>
              {stats.allTimeMatches}
            </Text>
            <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>All Time</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: theme.colors.surface }]}>
            <Ionicons name="calendar" size={24} color="#4ECDC4" />
            <Text style={[styles.statValue, { color: theme.colors.text }]}>
              {stats.seasonMatches}
            </Text>
            <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>This Season</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: theme.colors.surface }]}>
            <Ionicons name="flag" size={24} color="#FF6B6B" />
            <Text style={[styles.statValue, { color: theme.colors.text }]}>
              {Object.keys(stats.eventMatches).length}
            </Text>
            <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>Events</Text>
          </View>
        </View>
      </View>
    );
  };

  if (!user) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={[styles.simpleHeader, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.simpleHeaderTitle, { color: theme.colors.text }]}>Leaderboard</Text>
          <TouchableOpacity
            style={[styles.signInButton, { backgroundColor: theme.colors.primary }]}
            onPress={() => setShowAuthModal(true)}
          >
            <Text style={styles.signInButtonText}>Sign In</Text>
          </TouchableOpacity>
        </View>
        <ScrollView style={styles.content}>
          {renderLeaderboard()}
          {renderUpcomingMatches()}
          {renderMyStatistics()}
        </ScrollView>
        {showAuthModal && (
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: theme.colors.surface }]}>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setShowAuthModal(false)}
              >
                <Ionicons name="close" size={24} color={theme.colors.text} />
              </TouchableOpacity>
              <ScrollView 
                style={styles.modalScrollView}
                showsVerticalScrollIndicator={true}
                nestedScrollEnabled={true}
              >
                {renderAuthForm()}
              </ScrollView>
            </View>
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.simpleHeader, { backgroundColor: theme.colors.surface }]}>
        <Text style={[styles.simpleHeaderTitle, { color: theme.colors.text }]}>Welcome back, {user.name}!</Text>
        <TouchableOpacity
          style={[styles.signOutIconButton, { backgroundColor: theme.colors.error }]}
          onPress={handleSignOut}
        >
          <Ionicons name="log-out" size={20} color="white" />
        </TouchableOpacity>
      </View>

      <View style={[styles.tabContainer, { backgroundColor: theme.colors.surface }]}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'leaderboard' && { backgroundColor: theme.colors.primary }]}
          onPress={() => setActiveTab('leaderboard')}
        >
          <Text style={[styles.tabText,
            activeTab === 'leaderboard' && { color: 'white' },
            { color: theme.colors.text }
          ]}>Leaderboard</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'profile' && { backgroundColor: theme.colors.primary }]}
          onPress={() => setActiveTab('profile')}
        >
          <Text style={[styles.tabText, 
            activeTab === 'profile' && { color: 'white' },
            { color: theme.colors.text }
          ]}>Profile</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {activeTab === 'leaderboard' ? (
          <View>
            {renderLeaderboard()}
            {renderUpcomingMatches()}
            {renderMyStatistics()}
          </View>
        ) : (
          renderProfile()
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: platformUtils.getStatusBarHeight() + 20,
    paddingBottom: 30,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 5,
  },
  headerSubtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
  },
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginTop: -15,
    borderRadius: 12,
    padding: 4,
    ...platformUtils.getPlatformElevation(3),
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabText: {
    fontSize: 16,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    marginTop: 20,
  },
  authContainer: {
    padding: 20,
  },
  authHeader: {
    alignItems: 'center',
    marginBottom: 30,
  },
  authTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  authSubtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
  },
  formContainer: {
    marginBottom: 30,
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
  },
  authButton: {
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 10,
  },
  authButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  switchModeButton: {
    alignItems: 'center',
    marginTop: 20,
  },
  switchModeText: {
    fontSize: 16,
    fontWeight: '600',
  },
  authHint: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 8,
  },
  existingUsersContainer: {
    marginTop: 20,
  },
  existingUsersTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  existingUserItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  existingUserName: {
    fontSize: 16,
    fontWeight: '600',
  },
  existingUserStats: {
    fontSize: 14,
  },
  profileContainer: {
    padding: 20,
  },
  profileHeader: {
    alignItems: 'center',
    marginBottom: 30,
  },
  avatarContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
  },
  profileName: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  profileJoinDate: {
    fontSize: 16,
  },
  roleSection: {
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
    ...platformUtils.getPlatformElevation(1),
  },
  roleSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 10,
  },
  roleButtonRow: {
    flexDirection: 'row',
    gap: 8,
  },
  roleButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  roleButtonText: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  roleNote: {
    marginTop: 10,
    fontSize: 12,
    textAlign: 'center',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 30,
  },
  statCard: {
    alignItems: 'center',
    padding: 20,
    borderRadius: 12,
    flex: 1,
    marginHorizontal: 5,
    ...platformUtils.getPlatformElevation(2),
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    marginTop: 4,
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    marginTop: 20,
  },
  signOutText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  leaderboardContainer: {
    padding: 20,
  },
  leaderboardFilters: {
    marginBottom: 20,
  },
  filterRow: {
    flexDirection: 'row',
    marginBottom: 15,
  },
  filterButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  eventSelector: {
    marginTop: 10,
  },
  eventButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginRight: 10,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  eventButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  leaderboardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    marginBottom: 4,
    borderWidth: 2,
    ...platformUtils.getPlatformElevation(1),
  },
  rankContainer: {
    width: 40,
    alignItems: 'center',
  },
  rank: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginLeft: 15,
  },
  userName: {
    fontSize: 16,
    marginLeft: 10,
  },
  matchCount: {
    alignItems: 'center',
  },
  matchCountText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  matchCountLabel: {
    fontSize: 12,
  },
  emptyLeaderboard: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyLeaderboardText: {
    fontSize: 16,
    marginTop: 10,
    textAlign: 'center',
  },
  simpleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: platformUtils.getStatusBarHeight() + 20,
    paddingBottom: 30,
    paddingHorizontal: 20,
    ...platformUtils.getPlatformElevation(2),
  },
  simpleHeaderTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  signInButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  signInButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  signOutIconButton: {
    padding: 8,
    borderRadius: 8,
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '90%',
    maxWidth: 400,
    maxHeight: '80%',
    borderRadius: 12,
    padding: 20,
    paddingRight: 50, 
    ...platformUtils.getPlatformElevation(5),
  },
  modalScrollView: {
    maxHeight: '100%',
    paddingRight: 10,
  },
  closeButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    padding: 8,
    zIndex: 1,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 16,
  },

  scrollableUsersList: {
    maxHeight: 200,
    marginTop: 10,
  },
  userInfoSection: {
    flex: 1,
    marginLeft: 12,
  },
  scrollableLeaderboard: {
    height: 300,
    marginBottom: 10,
  },
  upcomingMatchesContainer: {
    paddingVertical: 20,
    paddingHorizontal: 15,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.1)',
    marginTop: 15,
  },
  upcomingMatchesTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
  },
  matchItem: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    ...platformUtils.getPlatformElevation(2),
  },
  matchHeader: {
    alignItems: 'center',
    marginBottom: 12,
  },
  matchNumber: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  alliancesContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  allianceSection: {
    flex: 1,
    alignItems: 'center',
  },
  allianceLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  teamsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 4,
  },
  teamNumber: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginHorizontal: 2,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
  },
  highlightedTeam: {
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  teamNumberText: {
    fontSize: 12,
    fontWeight: '600',
  },
  vsContainer: {
    paddingHorizontal: 16,
  },
  vsText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  scoutingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.1)',
  },
  scoutingText: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  myStatsContainer: {
    padding: 20,
    paddingTop: 30,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.1)',
    marginTop: 20,
  },
  myStatsTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  compactMatchItem: {
    padding: 16,
    borderRadius: 12,
    marginRight: 12,
    width: 280,
    minHeight: 160,
    ...platformUtils.getPlatformElevation(2),
  },
  horizontalMatchList: {
    paddingHorizontal: 15,
  },
  compactMatchHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  compactMatchNumber: {
    fontSize: 16,
    fontWeight: 'bold',
  },

  compactAlliancesContainer: {
    marginBottom: 8,
  },
  compactAllianceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  compactAllianceLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    width: 35,
  },
  compactTeamsRow: {
    flexDirection: 'row',
    flex: 1,
    gap: 4,
  },
  compactTeamNumber: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
    minWidth: 40,
    alignItems: 'center',
  },
  scoutTeamHighlight: {
    borderWidth: 2,
    borderColor: '#FFD700',
  },
  compactTeamNumberText: {
    fontSize: 11,
    fontWeight: '600',
  },
  compactScoutingInfo: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.1)',
  },
  scoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
  },
  scoutButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
});
