import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Switch,
  Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth, USER_ROLES } from '../contexts/AuthContext';
import { useEventMode } from '../contexts/EventModeContext';
import { platformUtils } from '../utils/platformUtils';
import apiService from '../utils/apiService';

export default function ControlDashboardScreen() {
  const { theme } = useTheme();
  const { user, updateUserRole } = useAuth();
  const { isEventMode, toggleEventMode } = useEventMode();
  const [allAccounts, setAllAccounts] = useState([]);
  const [accountsLoading, setAccountsLoading] = useState(false);

  const upgradableRoleOptions = [
    { key: USER_ROLES.SCOUTER, label: 'Scouter' },
    { key: USER_ROLES.DRIVE_TEAM, label: 'Drive Team' },
    { key: USER_ROLES.SCOUTING_LEAD, label: 'Scouting Lead' },
  ];
  const isScoutingLead = user?.role === USER_ROLES.SCOUTING_LEAD;

  useEffect(() => {
    const loadAccounts = async () => {
      if (!isScoutingLead) {
        return;
      }

      setAccountsLoading(true);
      try {
        const accounts = await apiService.getUsers();
        setAllAccounts(accounts);
      } catch (error) {
        Alert.alert('Error', 'Unable to load account list.');
      } finally {
        setAccountsLoading(false);
      }
    };

    loadAccounts();
  }, [isScoutingLead]);

  const handleRoleUpgrade = async (targetUserID, targetRole) => {
    try {
      await updateUserRole(targetUserID, targetRole);
      setAllAccounts((prev) =>
        prev.map((account) => (account.id === targetUserID ? { ...account, role: targetRole } : account))
      );
      Alert.alert('Success', 'User role updated.');
    } catch (error) {
      Alert.alert('Error', error.message || 'Unable to update role.');
    }
  };

  if (!isScoutingLead) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={[styles.restrictedCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <Ionicons name="lock-closed-outline" size={56} color={theme.colors.textSecondary} />
          <Text style={[styles.restrictedTitle, { color: theme.colors.text }]}>Control Dashboard unavailable</Text>
          <Text style={[styles.restrictedText, { color: theme.colors.textSecondary }]}>
            Only scouting leads can access the control dashboard.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <StatusBar style={theme.colors.statusBar} />

      <View style={[styles.header, { backgroundColor: theme.colors.primary }]}>
        <Text style={styles.headerTitle}>Control Dashboard</Text>
        <Text style={styles.headerSubtitle}>
          Manage event operations and account permissions
        </Text>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>System Settings</Text>
          <View style={styles.preferenceRow}>
            <View style={styles.preferenceTextBlock}>
              <Text style={[styles.preferenceTitle, { color: theme.colors.text }]}>Event Mode</Text>
              <Text style={[styles.preferenceSubtitle, { color: theme.colors.textSecondary }]}>
                {isEventMode ? 'Server updates every 3 minutes' : 'Normal update schedule (every 2 hours)'}
              </Text>
            </View>
            <Switch
              value={isEventMode}
              onValueChange={toggleEventMode}
              trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
              thumbColor="#FFFFFF"
              ios_backgroundColor={theme.colors.border}
              style={styles.preferenceSwitch}
            />
          </View>
        </View>

        <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Account Management</Text>
          <Text style={[styles.sectionNote, { color: theme.colors.textSecondary }]}>
            Upgrade users from Viewer to Scouter, Drive Team, or Scouting Lead.
          </Text>
          {accountsLoading ? (
            <Text style={[styles.sectionNote, { color: theme.colors.textSecondary }]}>Loading accounts...</Text>
          ) : (
            allAccounts.map((account) => (
              <View key={account.id} style={[styles.accountRow, { borderColor: theme.colors.border }]}>
                <View style={styles.accountInfo}>
                  <Text style={[styles.accountName, { color: theme.colors.text }]}>
                    {[account.first_name, account.last_name].filter(Boolean).join(' ') || account.name || account.email || account.id}
                  </Text>
                  <Text style={[styles.accountMeta, { color: theme.colors.textSecondary }]}>
                    Current role: {(account.role || USER_ROLES.VIEWER).replace('_', ' ')}
                  </Text>
                </View>
                <View style={styles.accountRoleButtons}>
                  {upgradableRoleOptions.map((option) => (
                    <TouchableOpacity
                      key={`${account.id}-${option.key}`}
                      style={[
                        styles.accountRoleButton,
                        { borderColor: theme.colors.border },
                        account.role === option.key && { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
                      ]}
                      onPress={() => handleRoleUpgrade(account.id, option.key)}
                    >
                      <Text
                        style={[
                          styles.accountRoleButtonText,
                          { color: theme.colors.text },
                          account.role === option.key && { color: 'white' },
                        ]}
                      >
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 40 : 20,
    paddingBottom: 30,
    paddingHorizontal: 20,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 5,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#e3f2fd',
    opacity: 0.9,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
  },
  section: {
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
    ...platformUtils.getPlatformElevation(1),
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 10,
  },
  sectionNote: {
    marginTop: 4,
    fontSize: 12,
    textAlign: 'center',
  },
  preferenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
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
  accountRow: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginTop: 10,
  },
  accountInfo: {
    marginBottom: 8,
  },
  accountName: {
    fontSize: 14,
    fontWeight: '700',
  },
  accountMeta: {
    fontSize: 12,
    marginTop: 2,
  },
  accountRoleButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  accountRoleButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  accountRoleButtonText: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  restrictedCard: {
    margin: 20,
    padding: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  restrictedTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 16,
    textAlign: 'center',
  },
  restrictedText: {
    fontSize: 16,
    lineHeight: 24,
    marginTop: 10,
    textAlign: 'center',
  },
});
