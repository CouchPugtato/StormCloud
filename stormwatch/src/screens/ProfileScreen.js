import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  FlatList,
  Platform,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth, USER_ROLES } from '../contexts/AuthContext';
import { platformUtils } from '../utils/platformUtils';
import { registerForPushNotifications, unregisterNativePush, unregisterWebPush } from '../utils/pushNotifications';
import apiService from '../utils/apiService';

export default function ProfileScreen() {
  const { theme, isDarkMode, themePreference, toggleTheme, setSystemTheme } = useTheme();
  const { user, signIn, signOut, createAccount, getLeaderboard } = useAuth();
  const [activeTab, setActiveTab] = useState('leaderboard');
  const [authMode, setAuthMode] = useState('signin'); // 'signin' | 'signup'
  const [formData, setFormData] = useState({ firstName: '', lastName: '', email: '', password: '', confirmPassword: '' });
  const [leaderboardType, setLeaderboardType] = useState('event');
  const [selectedEvent, setSelectedEvent] = useState('2024week1');
  const [loading, setLoading] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showSignOutModal, setShowSignOutModal] = useState(false);
  const [authMessage, setAuthMessage] = useState('');
  const [authMessageType, setAuthMessageType] = useState('error');
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushStatusText, setPushStatusText] = useState('Push notifications are disabled for this browser/device session.');
  const [scheduledMatches, setScheduledMatches] = useState([]);
  const [scheduledMatchesLoading, setScheduledMatchesLoading] = useState(false);

  const roleOptions = [
    { key: USER_ROLES.VIEWER, label: 'Viewer' },
    { key: USER_ROLES.SCOUTER, label: 'Scouter' },
    { key: USER_ROLES.DRIVE_TEAM, label: 'Drive Team' },
    { key: USER_ROLES.SCOUTING_LEAD, label: 'Scouting Lead' },
  ];
  const currentRole = user?.role || USER_ROLES.VIEWER;
  const isAuthModalLarge = authMode === 'signup';

  const events = [
    { key: '2024week1', name: '2024 Week 1' },
    { key: '2024week2', name: '2024 Week 2' },
    { key: '2024week3', name: '2024 Week 3' },
    { key: '2024regional', name: '2024 Regional Championship' },
  ];

  const leaderboardData = useMemo(() => {
    return getLeaderboard(leaderboardType, selectedEvent);
  }, [getLeaderboard, leaderboardType, selectedEvent]);

  const loadScheduledMatches = async () => {
    if (!user) {
      setScheduledMatches([]);
      return;
    }

    setScheduledMatchesLoading(true);
    try {
      const scheduled = await apiService.getMyScoutingSchedule();
      const normalized = (scheduled || []).map((item, index) => {
        const redAlliance = (item.red_teams || []).map((team) => parseInt(String(team).replace('frc', ''), 10));
        const blueAlliance = (item.blue_teams || []).map((team) => parseInt(String(team).replace('frc', ''), 10));
        const slotKey = item.slot_key || '';
        const isAllianceAssignment = slotKey.endsWith('alliance');
        const assignedAllianceColor = slotKey.startsWith('red') ? 'red' : 'blue';
        const assignedTeamIndex = isAllianceAssignment ? -1 : Number((slotKey.split('_')[1] || '1')) - 1;
        const assignedTeam =
          !isAllianceAssignment && assignedTeamIndex >= 0
            ? (assignedAllianceColor === 'red' ? redAlliance : blueAlliance)[assignedTeamIndex]
            : null;

        return {
          id: `${item.match_key}-${slotKey}-${index}`,
          matchKey: item.match_key,
          eventKey: item.event_key,
          eventName: item.event_name || item.event_key,
          matchNumber: `Qual ${item.match_number}`,
          redAlliance,
          blueAlliance,
          assignmentLabel: slotKey === 'red_alliance'
            ? 'Red Alliance'
            : slotKey === 'blue_alliance'
              ? 'Blue Alliance'
              : `${assignedAllianceColor === 'red' ? 'Red' : 'Blue'} ${assignedTeamIndex + 1}`,
          assignedAllianceColor,
          assignedTeam,
          isAllianceAssignment,
        };
      });
      setScheduledMatches(normalized);
    } catch (error) {
      console.error('Unable to load scheduled matches:', error);
      setScheduledMatches([]);
    } finally {
      setScheduledMatchesLoading(false);
    }
  };

  useEffect(() => {
    loadScheduledMatches();
  }, [user?.id]);

  useFocusEffect(
    React.useCallback(() => {
      loadScheduledMatches();
    }, [user?.id])
  );

  const showInfo = (title, message) => {
    if (Platform.OS === 'web') {
      window.alert(`${title}\n\n${message}`);
    } else {
      Alert.alert(title, message, [{ text: 'OK' }]);
    }
  };

  const getPushUserID = () => {
    return user?.id || 'anonymous';
  };

  const togglePushNotifications = async () => {
    if (pushBusy) {
      return;
    }

    const nextEnabled = !notificationsEnabled;
    setPushBusy(true);
    try {
      if (nextEnabled) {
        const result = await registerForPushNotifications(getPushUserID());
        if (!result.ok) {
          showInfo('Push Notifications', result.error || 'Unable to enable push notifications.');
          return;
        }
        setPushStatusText('Push notifications are enabled for this device.');
      } else {
        if (Platform.OS === 'web') {
          await unregisterWebPush(getPushUserID());
        } else {
          await unregisterNativePush(getPushUserID());
        }
        setPushStatusText('Push notifications are disabled for this browser/device session.');
      }
      setNotificationsEnabled(nextEnabled);
    } catch (error) {
      console.error('Push toggle failed:', error);
      showInfo('Push Notifications', 'Unable to update push notification settings.');
    } finally {
      setPushBusy(false);
    }
  };

  const handleAuth = async () => {
    setAuthMessage('');

    if (!formData.email.trim()) {
      setAuthMessageType('error');
      setAuthMessage('Please enter your email');
      return;
    }

    if ((authMode === 'signin' || authMode === 'signup') && !formData.password.trim()) {
      setAuthMessageType('error');
      setAuthMessage('Please enter your password');
      return;
    }

    if (authMode === 'signup' && !formData.firstName.trim()) {
      setAuthMessageType('error');
      setAuthMessage('Please enter your first name');
      return;
    }

    if (authMode === 'signup' && !formData.lastName.trim()) {
      setAuthMessageType('error');
      setAuthMessage('Please enter your last name');
      return;
    }

    if (authMode === 'signup' && formData.password !== formData.confirmPassword) {
      setAuthMessageType('error');
      setAuthMessage('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      if (authMode === 'signin') {
        await signIn(formData.email.trim(), formData.password);
        setShowAuthModal(false);
      } else if (authMode === 'signup') {
        setAuthMessageType('success');
        setAuthMessage('Creating account...');
        await createAccount(formData.email.trim(), formData.password, formData.firstName.trim(), formData.lastName.trim());
        setShowAuthModal(false);
      }
      setFormData({ firstName: '', lastName: '', email: '', password: '', confirmPassword: '' });
    } catch (error) {
      setAuthMessageType('error');
      setAuthMessage(error?.errors?.[0]?.longMessage || error.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = () => {
    setShowSignOutModal(true);
  };

  const renderAuthForm = () => (
    <View style={styles.authContainer}>
      <View style={styles.authHeader}>
        <Text style={[styles.authTitle, { color: theme.colors.text }]}>
          {authMode === 'signin' && 'Sign In'}
          {authMode === 'signup' && 'Create Account'}
        </Text>
          <Text style={[styles.authSubtitle, { color: theme.colors.textSecondary }]}>
          {authMode === 'signin' && 'Sign in with your StormCloud account'}
          {authMode === 'signup' && 'Create a new account. New users start as Viewer.'}
        </Text>
      </View>

      <View style={styles.formContainer}>
        {!!authMessage && (
          <View style={[styles.authMessageBox, authMessageType === 'success' ? styles.authSuccessBox : styles.authErrorBox]}>
            <Text style={styles.authMessageText}>{authMessage}</Text>
          </View>
        )}

        {authMode === 'signup' && (
          <View style={styles.inputContainer}>
            <Text style={[styles.inputLabel, { color: theme.colors.text }]}>First Name</Text>
            <TextInput
              style={[styles.input, { 
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
                color: theme.colors.text
              }]}
              value={formData.firstName}
              onChangeText={(text) => setFormData({ ...formData, firstName: text })}
              placeholder="First name"
              placeholderTextColor={theme.colors.textSecondary}
            />
          </View>
        )}

        {authMode === 'signup' && (
          <View style={styles.inputContainer}>
            <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Last Name</Text>
            <TextInput
              style={[styles.input, { 
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
                color: theme.colors.text
              }]}
              value={formData.lastName}
              onChangeText={(text) => setFormData({ ...formData, lastName: text })}
              placeholder="Last name"
              placeholderTextColor={theme.colors.textSecondary}
            />
          </View>
        )}

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

        {(authMode === 'signin' || authMode === 'signup') && (
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

        {authMode === 'signup' && (
          <View style={styles.inputContainer}>
            <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Confirm Password</Text>
            <TextInput
              style={[styles.input, { 
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
                color: theme.colors.text
              }]}
              value={formData.confirmPassword}
              onChangeText={(text) => setFormData({ ...formData, confirmPassword: text })}
              placeholder="Confirm password"
              placeholderTextColor={theme.colors.textSecondary}
              secureTextEntry
            />
          </View>
        )}

        <TouchableOpacity
          style={[styles.authButton, { 
            backgroundColor: (
              !formData.email.trim() ||
              ((authMode === 'signin' || authMode === 'signup') && !formData.password.trim()) ||
              (authMode === 'signup' && !formData.confirmPassword.trim()) ||
              loading
            )
              ? theme.colors.textSecondary 
              : theme.colors.primary 
          }]}
          onPress={handleAuth}
          disabled={
            !formData.email.trim() ||
            ((authMode === 'signin' || authMode === 'signup') && !formData.password.trim()) ||
            (authMode === 'signup' && !formData.confirmPassword.trim()) ||
            loading
          }
        >
          <Text style={styles.authButtonText}>
            {loading && 'Loading...'}
            {!loading && authMode === 'signin' && 'Sign In'}
            {!loading && authMode === 'signup' && 'Create Account'}
          </Text>
        </TouchableOpacity>

        {authMode === 'signin' && (
          <TouchableOpacity
            style={styles.switchModeButton}
            onPress={() => {
              setAuthMode('signup');
              setAuthMessage('');
              setFormData({ ...formData, firstName: '', lastName: '', password: '', confirmPassword: '' });
            }}
          >
            <Text style={[styles.switchModeText, { color: theme.colors.primary }]}>
              Need an account? Create one
            </Text>
          </TouchableOpacity>
        )}

        {authMode === 'signup' && (
          <TouchableOpacity
            style={styles.switchModeButton}
            onPress={() => {
              setAuthMode('signin');
              setAuthMessage('');
              setFormData({ ...formData, password: '', confirmPassword: '' });
            }}
          >
            <Text style={[styles.switchModeText, { color: theme.colors.primary }]}>
              Back to sign in
            </Text>
          </TouchableOpacity>
        )}
      </View>

      <Text style={[styles.authHint, { color: theme.colors.textSecondary }]}>
        New accounts are created as Viewer. Scouting leads can upgrade users to scouter/drive team/scouting lead.
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
          Role is managed by scouting leads.
        </Text>
      </View>

      <View style={[styles.roleSection, { backgroundColor: theme.colors.surface }]}>
        <Text style={[styles.roleSectionTitle, { color: theme.colors.text }]}>Preferences</Text>

        <View style={[styles.preferenceRow, styles.preferenceRowWithBorder, { borderBottomColor: theme.colors.borderLight }]}>
          <View style={styles.preferenceTextBlock}>
            <Text style={[styles.preferenceTitle, { color: theme.colors.text }]}>Dark Mode</Text>
            <Text style={[styles.preferenceSubtitle, { color: theme.colors.textSecondary }]}>
              {themePreference === 'system' ? 'Following system preference' : (isDarkMode ? 'Dark theme enabled' : 'Light theme enabled')}
            </Text>
          </View>
          <Switch
            value={isDarkMode}
            onValueChange={toggleTheme}
            trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
            thumbColor="#FFFFFF"
            ios_backgroundColor={theme.colors.border}
            style={styles.preferenceSwitch}
            disabled={themePreference === 'system'}
          />
        </View>

        <View style={[styles.preferenceRow, styles.preferenceRowWithBorder, { borderBottomColor: theme.colors.borderLight }]}>
          <View style={styles.preferenceTextBlock}>
            <Text style={[styles.preferenceTitle, { color: theme.colors.text }]}>Use System Theme</Text>
            <Text style={[styles.preferenceSubtitle, { color: theme.colors.textSecondary }]}>
              Follow device theme settings
            </Text>
          </View>
          <Switch
            value={themePreference === 'system'}
            onValueChange={() => {
              if (themePreference === 'system') {
                toggleTheme();
              } else {
                setSystemTheme();
              }
            }}
            trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
            thumbColor="#FFFFFF"
            ios_backgroundColor={theme.colors.border}
            style={styles.preferenceSwitch}
          />
        </View>

        <View style={styles.preferenceRow}>
          <View style={styles.preferenceTextBlock}>
            <Text style={[styles.preferenceTitle, { color: theme.colors.text }]}>Push Notifications</Text>
            <Text style={[styles.preferenceSubtitle, { color: theme.colors.textSecondary }]}>
              {pushStatusText}
            </Text>
          </View>
          <Switch
            value={notificationsEnabled}
            onValueChange={togglePushNotifications}
            trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
            thumbColor="#FFFFFF"
            ios_backgroundColor={theme.colors.border}
            style={styles.preferenceSwitch}
            disabled={pushBusy}
          />
        </View>
      </View>

      <View style={styles.statsContainer}>
        <View style={[styles.statCard, { backgroundColor: theme.colors.surface }]}>
          <Ionicons name="trophy" size={24} color="#FFD700" />
          <Text style={[styles.statValue, { color: theme.colors.text }]}>
            {user.stats.allTimeMatches}
          </Text>
          <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>All Time</Text>
          <Text style={[styles.statDescription, { color: theme.colors.textSecondary }]}>
            Total matches you have scouted across all seasons.
          </Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: theme.colors.surface }]}>
          <Ionicons name="calendar" size={24} color="#4ECDC4" />
          <Text style={[styles.statValue, { color: theme.colors.text }]}>
            {user.stats.seasonMatches}
          </Text>
          <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>This Season</Text>
          <Text style={[styles.statDescription, { color: theme.colors.textSecondary }]}>
            Matches you have submitted during the current season.
          </Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: theme.colors.surface }]}>
          <Ionicons name="flag" size={24} color="#FF6B6B" />
          <Text style={[styles.statValue, { color: theme.colors.text }]}>
            {Object.keys(user.stats.eventMatches).length}
          </Text>
          <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>Events</Text>
          <Text style={[styles.statDescription, { color: theme.colors.textSecondary }]}>
            Number of different events where you have recorded scouting data.
          </Text>
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
    return (
      <View style={styles.leaderboardContainer}>
        <Text style={[styles.sectionHeaderTitle, { color: theme.colors.text }]}>Leaderboard</Text>
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

        <View>
          {leaderboardData.length === 0 ? (
            <View style={styles.emptyLeaderboard}>
              <Ionicons name="trophy-outline" size={48} color={theme.colors.textSecondary} />
              <Text style={[styles.emptyLeaderboardText, { color: theme.colors.textSecondary }]}>
                No scouting data available
              </Text>
            </View>
          ) : (
            <>
              {leaderboardData.map((item) => {
                const getRankStyle = (rank) => {
                  if (rank === 1) return { borderColor: '#FFD700', borderWidth: 3 };
                  if (rank === 2) return { borderColor: '#C0C0C0', borderWidth: 3 };
                  if (rank === 3) return { borderColor: '#CD7F32', borderWidth: 3 };
                  return { borderColor: item.id === user?.id ? theme.colors.primary : theme.colors.border, borderWidth: 2 };
                };

                const getRankIcon = (rank) => {
                  if (rank === 1) return { name: 'trophy', color: '#FFD700' };
                  if (rank === 2) return { name: 'medal', color: '#C0C0C0' };
                  if (rank === 3) return { name: 'medal', color: '#CD7F32' };
                  return {
                    name: item.id === user?.id ? 'person-circle' : 'person',
                    color: item.id === user?.id ? theme.colors.primary : theme.colors.textSecondary,
                  };
                };

                const rankIcon = getRankIcon(item.rank);

                return (
                  <View
                    key={item.id}
                    style={[
                      styles.leaderboardItem,
                      {
                        backgroundColor: theme.colors.surface,
                        ...getRankStyle(item.rank),
                      },
                    ]}
                  >
                    <View style={styles.rankContainer}>
                      <Text
                        style={[
                          styles.rank,
                          {
                            color: item.rank <= 3 ? (item.rank === 1 ? '#FFD700' : item.rank === 2 ? '#C0C0C0' : '#CD7F32') : theme.colors.text,
                            fontSize: item.rank <= 3 ? 20 : 18,
                          },
                        ]}
                      >
                        #{item.rank}
                      </Text>
                    </View>
                    <View style={styles.userInfo}>
                      <Ionicons
                        name={rankIcon.name}
                        size={item.rank <= 3 ? 28 : 24}
                        color={rankIcon.color}
                      />
                      <Text
                        style={[
                          styles.userName,
                          {
                            color: theme.colors.text,
                            fontWeight: item.id === user?.id || item.rank <= 3 ? 'bold' : 'normal',
                          },
                        ]}
                      >
                        {item.name}
                      </Text>
                    </View>
                    <View style={styles.matchCount}>
                      <Text style={[styles.matchCountText, { color: theme.colors.text }]}>
                        {item.matchCount}
                      </Text>
                      <Text style={[styles.matchCountLabel, { color: theme.colors.textSecondary }]}>matches</Text>
                    </View>
                  </View>
                );
              })}
              <Text style={[styles.topCountText, { color: theme.colors.textSecondary }]}>
                Showing top {leaderboardData.length}
              </Text>
            </>
          )}
        </View>
      </View>
    );
  };

  const renderUpcomingMatches = () => {
    const title = user ? 'Your Next Matches' : 'Upcoming Matches';
      
    return (
      <View style={styles.upcomingMatchesContainer}>
        <Text style={[styles.upcomingMatchesTitle, { color: theme.colors.text }]}>{title}</Text>
        {scheduledMatchesLoading ? (
          <View style={styles.scheduledMatchesLoading}>
            <Text style={[styles.emptyLeaderboardText, { color: theme.colors.textSecondary }]}>
              Loading scheduled matches...
            </Text>
          </View>
        ) : (
        <FlatList
            data={scheduledMatches}
            keyExtractor={(item) => item.id.toString()}
            horizontal={true}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalMatchList}
            renderItem={({ item }) => {
              const scoutTeam = item.assignedTeam;
              
              return (
                <View style={[
                styles.compactMatchItem, 
                { backgroundColor: theme.colors.surface }
              ]}>
                  <View style={styles.compactMatchHeader}>
                    <View>
                      <Text style={[styles.compactMatchNumber, { color: theme.colors.text }]}>
                        {item.matchNumber}
                      </Text>
                      <Text style={[styles.compactMatchEvent, { color: theme.colors.textSecondary }]} numberOfLines={1}>
                        {item.eventName}
                      </Text>
                    </View>
                    <Text style={[styles.compactAssignmentLabel, { color: theme.colors.primary }]}>
                      {item.assignmentLabel}
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
                      <TouchableOpacity
                        style={[styles.scoutButton, { backgroundColor: theme.colors.primary }]}
                        onPress={() => {
                          if (item.isAllianceAssignment) {
                            navigation.navigate('AllianceScoutingForm', {
                              allianceColor: item.assignedAllianceColor,
                              matchData: item,
                            });
                            return;
                          }

                          if (item.assignedTeam) {
                            navigation.navigate('MatchScoutingForm', {
                              teamNumber: item.assignedTeam,
                              matchData: item,
                            });
                          }
                        }}
                      >
                        <Text style={styles.scoutButtonText}>
                          {item.isAllianceAssignment ? 'Scout Alliance' : 'Scout Team'}
                        </Text>
                      </TouchableOpacity>
                  </View>
                </View>
              );
            }}
            ListEmptyComponent={
              <View style={styles.scheduledMatchesEmpty}>
                <Text style={[styles.emptyLeaderboardText, { color: theme.colors.textSecondary }]}>
                  No scheduled qualification matches yet.
                </Text>
              </View>
            }
          />
        )}
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
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {renderLeaderboard()}
          {renderUpcomingMatches()}
          {renderMyStatistics()}
        </ScrollView>
        {showAuthModal && (
          <View style={styles.modalOverlay}>
            <View
              style={[
                styles.modalContent,
                isAuthModalLarge && styles.modalContentLarge,
                { backgroundColor: theme.colors.surface },
              ]}
            >
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setShowAuthModal(false)}
              >
                <Ionicons name="close" size={24} color={theme.colors.text} />
              </TouchableOpacity>
              <View style={styles.modalBody}>
                {renderAuthForm()}
              </View>
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
          ]}>Scouting</Text>
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

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {activeTab === 'leaderboard' ? (
          <View>
            {renderUpcomingMatches()}
            {renderLeaderboard()}
            {renderMyStatistics()}
          </View>
        ) : (
          renderProfile()
        )}
      </ScrollView>

      {showSignOutModal && (
        <View style={styles.modalOverlay}>
          <View style={[styles.confirmModalContent, { backgroundColor: theme.colors.surface }]}>
            <Text style={[styles.confirmModalTitle, { color: theme.colors.text }]}>Sign Out?</Text>
            <Text style={[styles.confirmModalText, { color: theme.colors.textSecondary }]}>
              Are you sure you want to sign out?
            </Text>
            <View style={styles.confirmModalActions}>
              <TouchableOpacity
                style={[styles.confirmSecondaryButton, { borderColor: theme.colors.border, backgroundColor: theme.colors.background }]}
                onPress={() => setShowSignOutModal(false)}
              >
                <Text style={[styles.confirmSecondaryText, { color: theme.colors.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmPrimaryButton, styles.confirmDangerButton]}
                onPress={() => {
                  setShowSignOutModal(false);
                  signOut();
                }}
              >
                <Text style={styles.confirmPrimaryText}>Sign Out</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
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
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
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
  authMessageBox: {
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  authErrorBox: {
    backgroundColor: '#FDECEC',
    borderWidth: 1,
    borderColor: '#F5B5B5',
  },
  authSuccessBox: {
    backgroundColor: '#E9F9EF',
    borderWidth: 1,
    borderColor: '#9AD8AE',
  },
  authMessageText: {
    fontSize: 13,
    color: '#1F2937',
    fontWeight: '600',
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
  preferenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  preferenceRowWithBorder: {
    borderBottomWidth: 1,
  },
  preferenceTextBlock: {
    flex: 1,
    paddingRight: 16,
  },
  preferenceTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  preferenceSubtitle: {
    fontSize: 13,
    lineHeight: 18,
  },
  preferenceSwitch: {
    transform: [{ scaleX: 1.05 }, { scaleY: 1.05 }],
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
  statDescription: {
    fontSize: 11,
    lineHeight: 15,
    marginTop: 8,
    textAlign: 'center',
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
    paddingTop: 28,
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.12)',
  },
  sectionHeaderTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 18,
    textAlign: 'center',
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
    maxHeight: '78%',
    borderRadius: 12,
    paddingVertical: 20,
    paddingHorizontal: 18,
    ...platformUtils.getPlatformElevation(5),
  },
  modalContentLarge: {
    maxWidth: 520,
    maxHeight: '92%',
  },
  modalBody: {
    width: '100%',
  },
  confirmModalContent: {
    width: '90%',
    maxWidth: 360,
    borderRadius: 12,
    padding: 20,
    ...platformUtils.getPlatformElevation(5),
  },
  confirmModalTitle: {
    fontSize: 22,
    fontWeight: '700',
  },
  confirmModalText: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 10,
  },
  confirmModalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 20,
  },
  confirmSecondaryButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmSecondaryText: {
    fontSize: 14,
    fontWeight: '700',
  },
  confirmPrimaryButton: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmDangerButton: {
    backgroundColor: '#dc2626',
  },
  confirmPrimaryText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '700',
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
  topCountText: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 4,
  },
  upcomingMatchesContainer: {
    paddingVertical: 20,
    paddingHorizontal: 15,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.1)',
    marginTop: 15,
  },
  upcomingMatchesTitle: {
    fontSize: 24,
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
    alignItems: 'flex-start',
    marginBottom: 8,
    gap: 8,
  },
  compactMatchNumber: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  compactMatchEvent: {
    fontSize: 12,
    marginTop: 4,
  },
  compactAssignmentLabel: {
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'right',
    maxWidth: 110,
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
  scheduledMatchesLoading: {
    paddingHorizontal: 15,
    paddingVertical: 10,
  },
  scheduledMatchesEmpty: {
    paddingHorizontal: 15,
    paddingVertical: 20,
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
