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
  TextInput,
  Modal,
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
  const [twitchUrl, setTwitchUrl] = useState('');
  const [twitchUrlDraft, setTwitchUrlDraft] = useState('');
  const [savingTwitchUrl, setSavingTwitchUrl] = useState(false);
  const [showEventsModal, setShowEventsModal] = useState(false);
  const [managedEvents, setManagedEvents] = useState([]);
  const [managedEventsLoading, setManagedEventsLoading] = useState(false);
  const [addingEvent, setAddingEvent] = useState(false);
  const [syncingEventKey, setSyncingEventKey] = useState('');
  const [deletingEventKey, setDeletingEventKey] = useState('');
  const [eventModeForm, setEventModeForm] = useState('tba');
  const [tbaEventKey, setTbaEventKey] = useState('');
  const [manualEventForm, setManualEventForm] = useState({
    event_key: '',
    year: '',
    name: '',
    city: '',
    state: '',
    country: '',
    start_date: '',
    end_date: '',
  });

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

  useEffect(() => {
    const loadAppSettings = async () => {
      if (!isScoutingLead) {
        return;
      }
      try {
        const settings = await apiService.getAppSettings();
        const nextUrl = settings.twitch_channel_url || '';
        setTwitchUrl(nextUrl);
        setTwitchUrlDraft(nextUrl);
      } catch (error) {
        console.error('Unable to load app settings:', error);
      }
    };

    loadAppSettings();
  }, [isScoutingLead]);

  const loadManagedEvents = async () => {
    if (!isScoutingLead) {
      return;
    }

    setManagedEventsLoading(true);
    try {
      const events = await apiService.getManagedEvents();
      setManagedEvents(events || []);
    } catch (error) {
      Alert.alert('Error', error.message || 'Unable to load events.');
    } finally {
      setManagedEventsLoading(false);
    }
  };

  useEffect(() => {
    if (showEventsModal) {
      loadManagedEvents();
    }
  }, [showEventsModal]);

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

  const handleSaveTwitchURL = async () => {
    if (savingTwitchUrl) {
      return;
    }

    setSavingTwitchUrl(true);
    try {
      const result = await apiService.updateAppSettings({
        twitch_channel_url: twitchUrlDraft.trim(),
      });
      const nextUrl = result.twitch_channel_url || '';
      setTwitchUrl(nextUrl);
      setTwitchUrlDraft(nextUrl);
      Alert.alert('Success', 'Stream link updated.');
    } catch (error) {
      Alert.alert('Error', error.message || 'Unable to update stream link.');
    } finally {
      setSavingTwitchUrl(false);
    }
  };

  const resetManualEventForm = () => {
    setManualEventForm({
      event_key: '',
      year: '',
      name: '',
      city: '',
      state: '',
      country: '',
      start_date: '',
      end_date: '',
    });
  };

  const handleAddManagedEvent = async () => {
    if (addingEvent) {
      return;
    }

    setAddingEvent(true);
    try {
      if (eventModeForm === 'tba') {
        await apiService.addManagedEventFromTBA(tbaEventKey.trim());
        setTbaEventKey('');
      } else {
        await apiService.addManagedEventManual({
          ...manualEventForm,
          event_key: manualEventForm.event_key.trim(),
          year: Number(manualEventForm.year || 0),
          name: manualEventForm.name.trim(),
          city: manualEventForm.city.trim(),
          state: manualEventForm.state.trim(),
          country: manualEventForm.country.trim(),
          start_date: manualEventForm.start_date.trim(),
          end_date: manualEventForm.end_date.trim(),
        });
        resetManualEventForm();
      }
      await loadManagedEvents();
    } catch (error) {
      Alert.alert('Error', error.message || 'Unable to add event.');
    } finally {
      setAddingEvent(false);
    }
  };

  const handleSyncManagedEvent = async (eventKey) => {
    setSyncingEventKey(eventKey);
    try {
      await apiService.syncManagedEventMatches(eventKey);
      await loadManagedEvents();
    } catch (error) {
      Alert.alert('Error', error.message || 'Unable to sync matches.');
    } finally {
      setSyncingEventKey('');
    }
  };

  const handleDeleteManagedEvent = async (eventKey) => {
    const confirmed = Platform.OS === 'web'
      ? (typeof window !== 'undefined' ? window.confirm(`Remove ${eventKey} and its matches?`) : true)
      : true;
    if (!confirmed) {
      return;
    }

    setDeletingEventKey(eventKey);
    try {
      await apiService.deleteManagedEvent(eventKey);
      await loadManagedEvents();
    } catch (error) {
      Alert.alert('Error', error.message || 'Unable to remove event.');
    } finally {
      setDeletingEventKey('');
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
          <View style={[styles.preferenceRow, styles.preferenceRowWithBorder, { borderBottomColor: theme.colors.borderLight }]}>
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

          <View style={styles.streamSettings}>
            <View style={styles.streamRow}>
              <View style={styles.preferenceTextBlock}>
                <Text style={[styles.preferenceTitle, { color: theme.colors.text }]}>Stream Link</Text>
                <Text style={[styles.preferenceSubtitle, { color: theme.colors.textSecondary }]}>
                  Set the Twitch or stream URL shown in event mode.
                </Text>
              </View>
              <TextInput
                style={[
                  styles.streamInput,
                  {
                    backgroundColor: theme.colors.background,
                    borderColor: theme.colors.border,
                    color: theme.colors.text,
                  },
                ]}
                value={twitchUrlDraft}
                onChangeText={setTwitchUrlDraft}
                placeholder="https://www.twitch.tv/yourchannel"
                placeholderTextColor={theme.colors.textSecondary}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <View style={styles.streamActions}>
                <TouchableOpacity
                  style={[styles.streamButton, { backgroundColor: theme.colors.primary }, (savingTwitchUrl || twitchUrlDraft.trim() === twitchUrl.trim()) && styles.disabledButton]}
                  onPress={handleSaveTwitchURL}
                  disabled={savingTwitchUrl || twitchUrlDraft.trim() === twitchUrl.trim()}
                >
                  <Text style={styles.streamButtonText}>{savingTwitchUrl ? '...' : 'Save'}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.streamButtonSecondary, { borderColor: theme.colors.border }, savingTwitchUrl && styles.disabledButton]}
                  onPress={() => setTwitchUrlDraft(twitchUrl)}
                  disabled={savingTwitchUrl}
                >
                  <Text style={[styles.streamButtonSecondaryText, { color: theme.colors.text }]}>Reset</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          <View style={[styles.preferenceRow, styles.preferenceRowWithBorder, { borderBottomColor: theme.colors.borderLight, marginTop: 14, marginBottom: 0, paddingBottom: 0, borderBottomWidth: 0 }]}>
            <View style={styles.preferenceTextBlock}>
              <Text style={[styles.preferenceTitle, { color: theme.colors.text }]}>Events</Text>
              <Text style={[styles.preferenceSubtitle, { color: theme.colors.textSecondary }]}>
                Add, remove, and sync event schedules.
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.manageEventsButton, { backgroundColor: theme.colors.primary }]}
              onPress={() => setShowEventsModal(true)}
            >
              <Text style={styles.manageEventsButtonText}>Manage</Text>
            </TouchableOpacity>
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

      <Modal visible={showEventsModal} animationType="slide" presentationStyle="pageSheet">
        <View style={[styles.modalContainer, { backgroundColor: theme.colors.background }]}>
          <View style={[styles.modalHeader, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Manage Events</Text>
            <TouchableOpacity style={styles.modalCloseButton} onPress={() => setShowEventsModal(false)}>
              <Ionicons name="close" size={24} color={theme.colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.modalContent}>
            <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
              <View style={styles.formModeRow}>
                <TouchableOpacity
                  style={[styles.formModeButton, eventModeForm === 'tba' && { backgroundColor: theme.colors.primary }]}
                  onPress={() => setEventModeForm('tba')}
                >
                  <Text
                    style={[
                      styles.formModeButtonText,
                      { color: theme.colors.text },
                      eventModeForm === 'tba' && styles.formModeButtonTextActive,
                    ]}
                  >
                    Add From TBA
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.formModeButton, eventModeForm === 'manual' && { backgroundColor: theme.colors.primary }]}
                  onPress={() => setEventModeForm('manual')}
                >
                  <Text
                    style={[
                      styles.formModeButtonText,
                      { color: theme.colors.text },
                      eventModeForm === 'manual' && styles.formModeButtonTextActive,
                    ]}
                  >
                    Add Manual
                  </Text>
                </TouchableOpacity>
              </View>

              {eventModeForm === 'tba' ? (
                <View style={styles.modalFormBlock}>
                  <Text style={[styles.preferenceSubtitle, { color: theme.colors.textSecondary }]}>Enter a TBA event key like `2026nhdur`.</Text>
                  <TextInput
                    style={[styles.modalInput, { backgroundColor: theme.colors.background, borderColor: theme.colors.border, color: theme.colors.text }]}
                    value={tbaEventKey}
                    onChangeText={setTbaEventKey}
                    placeholder="2026nhdur"
                    placeholderTextColor={theme.colors.textSecondary}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
              ) : (
                <View style={styles.modalFormBlock}>
                  <TextInput
                    style={[styles.modalInput, { backgroundColor: theme.colors.background, borderColor: theme.colors.border, color: theme.colors.text }]}
                    value={manualEventForm.event_key}
                    onChangeText={(text) => setManualEventForm((prev) => ({ ...prev, event_key: text }))}
                    placeholder="Event key"
                    placeholderTextColor={theme.colors.textSecondary}
                    autoCapitalize="none"
                  />
                  <TextInput
                    style={[styles.modalInput, { backgroundColor: theme.colors.background, borderColor: theme.colors.border, color: theme.colors.text }]}
                    value={manualEventForm.name}
                    onChangeText={(text) => setManualEventForm((prev) => ({ ...prev, name: text }))}
                    placeholder="Event name"
                    placeholderTextColor={theme.colors.textSecondary}
                  />
                  <View style={styles.modalTwoColumn}>
                    <TextInput
                      style={[styles.modalInput, styles.modalHalfInput, { backgroundColor: theme.colors.background, borderColor: theme.colors.border, color: theme.colors.text }]}
                      value={manualEventForm.year}
                      onChangeText={(text) => setManualEventForm((prev) => ({ ...prev, year: text }))}
                      placeholder="Year"
                      placeholderTextColor={theme.colors.textSecondary}
                      keyboardType="numeric"
                    />
                    <TextInput
                      style={[styles.modalInput, styles.modalHalfInput, { backgroundColor: theme.colors.background, borderColor: theme.colors.border, color: theme.colors.text }]}
                      value={manualEventForm.city}
                      onChangeText={(text) => setManualEventForm((prev) => ({ ...prev, city: text }))}
                      placeholder="City"
                      placeholderTextColor={theme.colors.textSecondary}
                    />
                  </View>
                  <View style={styles.modalTwoColumn}>
                    <TextInput
                      style={[styles.modalInput, styles.modalHalfInput, { backgroundColor: theme.colors.background, borderColor: theme.colors.border, color: theme.colors.text }]}
                      value={manualEventForm.state}
                      onChangeText={(text) => setManualEventForm((prev) => ({ ...prev, state: text }))}
                      placeholder="State"
                      placeholderTextColor={theme.colors.textSecondary}
                    />
                    <TextInput
                      style={[styles.modalInput, styles.modalHalfInput, { backgroundColor: theme.colors.background, borderColor: theme.colors.border, color: theme.colors.text }]}
                      value={manualEventForm.country}
                      onChangeText={(text) => setManualEventForm((prev) => ({ ...prev, country: text }))}
                      placeholder="Country"
                      placeholderTextColor={theme.colors.textSecondary}
                    />
                  </View>
                  <View style={styles.modalTwoColumn}>
                    <TextInput
                      style={[styles.modalInput, styles.modalHalfInput, { backgroundColor: theme.colors.background, borderColor: theme.colors.border, color: theme.colors.text }]}
                      value={manualEventForm.start_date}
                      onChangeText={(text) => setManualEventForm((prev) => ({ ...prev, start_date: text }))}
                      placeholder="Start date YYYY-MM-DD"
                      placeholderTextColor={theme.colors.textSecondary}
                    />
                    <TextInput
                      style={[styles.modalInput, styles.modalHalfInput, { backgroundColor: theme.colors.background, borderColor: theme.colors.border, color: theme.colors.text }]}
                      value={manualEventForm.end_date}
                      onChangeText={(text) => setManualEventForm((prev) => ({ ...prev, end_date: text }))}
                      placeholder="End date YYYY-MM-DD"
                      placeholderTextColor={theme.colors.textSecondary}
                    />
                  </View>
                </View>
              )}

              <TouchableOpacity
                style={[styles.modalPrimaryButton, { backgroundColor: theme.colors.primary }, addingEvent && styles.disabledButton]}
                onPress={handleAddManagedEvent}
                disabled={addingEvent}
              >
                <Text style={styles.modalPrimaryButtonText}>{addingEvent ? 'Saving...' : 'Add Event'}</Text>
              </TouchableOpacity>
            </View>

            <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Current Events</Text>
              {managedEventsLoading ? (
                <Text style={[styles.sectionNote, { color: theme.colors.textSecondary }]}>Loading events...</Text>
              ) : (
                managedEvents.map((event) => (
                  <View key={event.event_key} style={[styles.eventRowCard, { borderColor: theme.colors.border }]}>
                    <View style={styles.eventRowInfo}>
                      <Text style={[styles.eventRowTitle, { color: theme.colors.text }]} numberOfLines={1}>
                        {event.name || event.event_key}
                      </Text>
                      <Text style={[styles.eventRowMeta, { color: theme.colors.textSecondary }]} numberOfLines={1}>
                        {event.event_key} · {event.source}
                      </Text>
                    </View>
                    <View style={styles.eventRowActions}>
                      {event.source === 'tba' && (
                        <TouchableOpacity
                          style={[styles.eventRowButton, { borderColor: theme.colors.border }]}
                          onPress={() => handleSyncManagedEvent(event.event_key)}
                          disabled={syncingEventKey === event.event_key}
                        >
                          <Text style={[styles.eventRowButtonText, { color: theme.colors.text }]}>
                            {syncingEventKey === event.event_key ? '...' : 'Sync'}
                          </Text>
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity
                        style={[styles.eventRowDeleteButton, deletingEventKey === event.event_key && styles.disabledButton]}
                        onPress={() => handleDeleteManagedEvent(event.event_key)}
                        disabled={deletingEventKey === event.event_key}
                      >
                        <Text style={styles.eventRowDeleteText}>{deletingEventKey === event.event_key ? '...' : 'Remove'}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              )}
            </View>
          </ScrollView>
        </View>
      </Modal>
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
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingTop: Platform.OS === 'ios' ? 40 : 20,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '700',
  },
  modalCloseButton: {
    padding: 8,
  },
  modalContent: {
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
  preferenceRowWithBorder: {
    borderBottomWidth: 1,
    paddingBottom: 14,
    marginBottom: 14,
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
  streamSettings: {
    paddingTop: 2,
  },
  streamRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  streamInput: {
    flex: 1.2,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  streamActions: {
    flexDirection: 'row',
    gap: 10,
  },
  streamButton: {
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  streamButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '700',
  },
  streamButtonSecondary: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  streamButtonSecondaryText: {
    fontSize: 14,
    fontWeight: '700',
  },
  disabledButton: {
    opacity: 0.6,
  },
  manageEventsButton: {
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  manageEventsButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '700',
  },
  formModeRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  formModeButton: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: 'rgba(128,128,128,0.12)',
  },
  formModeButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  formModeButtonTextActive: {
    color: 'white',
  },
  modalFormBlock: {
    gap: 10,
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  modalTwoColumn: {
    flexDirection: 'row',
    gap: 10,
  },
  modalHalfInput: {
    flex: 1,
  },
  modalPrimaryButton: {
    marginTop: 14,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalPrimaryButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '700',
  },
  eventRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginTop: 10,
  },
  eventRowInfo: {
    flex: 1,
    paddingRight: 12,
  },
  eventRowTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  eventRowMeta: {
    fontSize: 12,
    marginTop: 3,
  },
  eventRowActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  eventRowButton: {
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  eventRowButtonText: {
    fontSize: 13,
    fontWeight: '700',
  },
  eventRowDeleteButton: {
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(220, 38, 38, 0.12)',
  },
  eventRowDeleteText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#dc2626',
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
