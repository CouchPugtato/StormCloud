import React, { useEffect, useMemo, useRef, useState } from 'react';
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
  const [accountSearchQuery, setAccountSearchQuery] = useState('');
  const [openAccountDropdownID, setOpenAccountDropdownID] = useState('');
  const [scheduleEventKey, setScheduleEventKey] = useState('');
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleMatches, setScheduleMatches] = useState([]);
  const [scheduleAssignments, setScheduleAssignments] = useState({});
  const [scheduleSearchQueries, setScheduleSearchQueries] = useState({});
  const [scheduleGridLayouts, setScheduleGridLayouts] = useState({});
  const [scheduleSlotLayouts, setScheduleSlotLayouts] = useState({});
  const [bulkScheduleForm, setBulkScheduleForm] = useState({
    assignments: {},
    queries: {},
    start_match: '',
    end_match: '',
  });
  const [activeBulkSlotKey, setActiveBulkSlotKey] = useState('');
  const [bulkGridLayout, setBulkGridLayout] = useState(null);
  const [bulkSlotLayouts, setBulkSlotLayouts] = useState({});
  const [bulkScheduleSaving, setBulkScheduleSaving] = useState(false);
  const [bulkScheduleStatus, setBulkScheduleStatus] = useState(null);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const scheduleBlurTimeoutRef = useRef(null);
  const bulkBlurTimeoutRef = useRef(null);
  const [savingScheduleKey, setSavingScheduleKey] = useState('');
  const [openScheduleDropdownKey, setOpenScheduleDropdownKey] = useState('');
  const [twitchUrl, setTwitchUrl] = useState('');
  const [twitchUrlDraft, setTwitchUrlDraft] = useState('');
  const [savingTwitchUrl, setSavingTwitchUrl] = useState(false);
  const [showEventsModal, setShowEventsModal] = useState(false);
  const [managedEvents, setManagedEvents] = useState([]);
  const [managedEventsLoading, setManagedEventsLoading] = useState(false);
  const [addingEvent, setAddingEvent] = useState(false);
  const [addingMatch, setAddingMatch] = useState(false);
  const [selectedMatchEvent, setSelectedMatchEvent] = useState(null);
  const [manualMatchStatus, setManualMatchStatus] = useState(null);
  const [syncingEventKey, setSyncingEventKey] = useState('');
  const [deletingEventKey, setDeletingEventKey] = useState('');
  const [teamCatalog, setTeamCatalog] = useState([]);
  const [teamCatalogLoading, setTeamCatalogLoading] = useState(false);
  const [activeTeamField, setActiveTeamField] = useState(null);
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
  const [manualMatchForm, setManualMatchForm] = useState({
    comp_level: 'qm',
    number: '',
    red_score: '',
    blue_score: '',
  });
  const [manualMatchTeamQueries, setManualMatchTeamQueries] = useState({
    red1: '',
    red2: '',
    red3: '',
    blue1: '',
    blue2: '',
    blue3: '',
  });
  const [manualMatchTeamSelections, setManualMatchTeamSelections] = useState({
    red1: null,
    red2: null,
    red3: null,
    blue1: null,
    blue2: null,
    blue3: null,
  });

  const upgradableRoleOptions = [
    { key: USER_ROLES.VIEWER, label: 'Viewer' },
    { key: USER_ROLES.SCOUTER, label: 'Scouter' },
    { key: USER_ROLES.DRIVE_TEAM, label: 'Drive Team' },
    { key: USER_ROLES.SCOUTING_LEAD, label: 'Scouting Lead' },
  ];
  const accountRoleSections = [
    { key: USER_ROLES.SCOUTING_LEAD, label: 'Scouting Leads' },
    { key: USER_ROLES.DRIVE_TEAM, label: 'Drive Team' },
    { key: USER_ROLES.SCOUTER, label: 'Scouters' },
    { key: USER_ROLES.VIEWER, label: 'Viewers' },
  ];
  const scheduleSlotOptions = [
    { key: 'red_1', label: 'Red 1' },
    { key: 'red_2', label: 'Red 2' },
    { key: 'red_3', label: 'Red 3' },
    { key: 'blue_1', label: 'Blue 1' },
    { key: 'blue_2', label: 'Blue 2' },
    { key: 'blue_3', label: 'Blue 3' },
    { key: 'red_alliance', label: 'Red Alliance' },
    { key: 'blue_alliance', label: 'Blue Alliance' },
  ];
  const isScoutingLead = user?.role === USER_ROLES.SCOUTING_LEAD;

  const getAccountDisplayName = (account) =>
    [account.first_name, account.last_name].filter(Boolean).join(' ') || account.name || account.email || account.id;

  const getRoleLabel = (roleKey) =>
    upgradableRoleOptions.find((option) => option.key === roleKey)?.label || 'Viewer';

  const getScheduleSlotLabel = (match, slotKey) => {
    const redTeams = (match.red_teams || []).map((team) => String(team).replace('frc', ''));
    const blueTeams = (match.blue_teams || []).map((team) => String(team).replace('frc', ''));

    switch (slotKey) {
      case 'red_1':
        return `Red 1 | ${redTeams[0] || '-'}`;
      case 'red_2':
        return `Red 2 | ${redTeams[1] || '-'}`;
      case 'red_3':
        return `Red 3 | ${redTeams[2] || '-'}`;
      case 'blue_1':
        return `Blue 1 | ${blueTeams[0] || '-'}`;
      case 'blue_2':
        return `Blue 2 | ${blueTeams[1] || '-'}`;
      case 'blue_3':
        return `Blue 3 | ${blueTeams[2] || '-'}`;
      case 'red_alliance':
        return 'Red Alliance';
      case 'blue_alliance':
        return 'Blue Alliance';
      default:
        return slotKey;
    }
  };

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

  useEffect(() => {
    if (!isScoutingLead) {
      return;
    }
    loadManagedEvents();
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

  useEffect(() => {
    if (!managedEvents.length) {
      setScheduleEventKey('');
      setScheduleMatches([]);
      setScheduleAssignments({});
      return;
    }

    const hasSelectedEvent = managedEvents.some((event) => event.event_key === scheduleEventKey);
    if (!hasSelectedEvent) {
      setScheduleEventKey('');
      setScheduleMatches([]);
      setScheduleAssignments({});
    }
  }, [managedEvents, scheduleEventKey]);

  useEffect(() => {
    if (!scheduleEventKey) {
      return;
    }
    loadScheduleForEvent(scheduleEventKey);
  }, [scheduleEventKey]);

  const handleRoleUpgrade = async (targetUserID, targetRole) => {
    try {
      await updateUserRole(targetUserID, targetRole);
      setAllAccounts((prev) =>
        prev.map((account) => (account.id === targetUserID ? { ...account, role: targetRole } : account))
      );
      setOpenAccountDropdownID('');
      Alert.alert('Success', 'User role updated.');
    } catch (error) {
      Alert.alert('Error', error.message || 'Unable to update role.');
    }
  };

  const filteredAccounts = useMemo(() => {
    const query = accountSearchQuery.trim().toLowerCase();
    if (!query) {
      return allAccounts;
    }

    return allAccounts.filter((account) => {
      const displayName = getAccountDisplayName(account).toLowerCase();
      const email = String(account.email || '').toLowerCase();
      return displayName.includes(query) || email.includes(query);
    });
  }, [accountSearchQuery, allAccounts]);

  const groupedAccounts = useMemo(() => (
    accountRoleSections.map((section) => ({
      ...section,
      accounts: filteredAccounts.filter((account) => (account.role || USER_ROLES.VIEWER) === section.key),
    }))
  ), [filteredAccounts]);

  const selectedScheduleEvent = useMemo(
    () => managedEvents.find((event) => event.event_key === scheduleEventKey) || null,
    [managedEvents, scheduleEventKey]
  );

  const scouterAccounts = useMemo(
    () => allAccounts
      .filter((account) => {
        const role = account.role || USER_ROLES.VIEWER;
        return role === USER_ROLES.SCOUTER || role === USER_ROLES.SCOUTING_LEAD;
      })
      .sort((a, b) => getAccountDisplayName(a).localeCompare(getAccountDisplayName(b))),
    [allAccounts]
  );

  const getScheduleSuggestions = (assignmentKey) => {
    const query = String(scheduleSearchQueries[assignmentKey] || '').trim().toLowerCase();
    if (!query) {
      return scouterAccounts.slice(0, 8);
    }

    return scouterAccounts
      .filter((account) => {
        const displayName = getAccountDisplayName(account).toLowerCase();
        const email = String(account.email || '').toLowerCase();
        return displayName.includes(query) || email.includes(query);
      })
      .slice(0, 8);
  };

  const getBulkScheduleSuggestions = (slotKey) => {
    const query = String(bulkScheduleForm.queries?.[slotKey] || '').trim().toLowerCase();
    if (!query) {
      return scouterAccounts.slice(0, 8);
    }

    return scouterAccounts
      .filter((account) => {
        const displayName = getAccountDisplayName(account).toLowerCase();
        const email = String(account.email || '').toLowerCase();
        return displayName.includes(query) || email.includes(query);
      })
      .slice(0, 8);
  };

  const resetBulkScheduleForm = () => {
    setBulkScheduleForm({
      assignments: {},
      queries: {},
      start_match: '',
      end_match: '',
    });
    setActiveBulkSlotKey('');
    setBulkGridLayout(null);
    setBulkScheduleStatus(null);
  };

  const handleBulkScheduleApply = async () => {
    if (bulkScheduleSaving || !scheduleEventKey) {
      return;
    }

    setBulkScheduleStatus(null);
    const startMatch = Number.parseInt(String(bulkScheduleForm.start_match).trim(), 10);
    const endMatch = Number.parseInt(String(bulkScheduleForm.end_match).trim(), 10);
    const validMatchNumbers = new Set(
      scheduleMatches.map((match) => Number.parseInt(String(match.match_number || 0), 10)).filter(Number.isFinite)
    );
    const filledSlots = scheduleSlotOptions
      .map((slot) => ({
        slot_key: slot.key,
        user_id: bulkScheduleForm.assignments?.[slot.key] || '',
      }))
      .filter((item) => item.user_id);

    if (filledSlots.length === 0) {
      setBulkScheduleStatus({ type: 'error', message: 'Assign at least one slot before applying.' });
      return;
    }

    if (!Number.isFinite(startMatch) || !Number.isFinite(endMatch)) {
      setBulkScheduleStatus({ type: 'error', message: 'Enter valid start and end match numbers.' });
      return;
    }

    if (startMatch > endMatch) {
      setBulkScheduleStatus({ type: 'error', message: 'Start match must be before end match.' });
      return;
    }

    if (!validMatchNumbers.has(startMatch) || !validMatchNumbers.has(endMatch)) {
      setBulkScheduleStatus({ type: 'error', message: 'Start and end matches must exist in this event.' });
      return;
    }

    const targetMatches = scheduleMatches.filter((match) => {
      const matchNumber = Number.parseInt(String(match.match_number || 0), 10);
      return matchNumber >= startMatch && matchNumber <= endMatch;
    });

    if (targetMatches.length === 0) {
      setBulkScheduleStatus({ type: 'error', message: 'No qualification matches were found in that range.' });
      return;
    }

    const previousAssignments = { ...scheduleAssignments };
    const previousQueries = { ...scheduleSearchQueries };
    const optimisticQueries = { ...scheduleSearchQueries };
    const optimisticAssignments = { ...scheduleAssignments };

    targetMatches.forEach((match) => {
      filledSlots.forEach((item) => {
        optimisticAssignments[`${match.match_key}:${item.slot_key}`] = item.user_id;
        const account = scouterAccounts.find((entry) => entry.id === item.user_id);
        optimisticQueries[`${match.match_key}:${item.slot_key}`] = account ? getAccountDisplayName(account) : '';
      });
    });

    setScheduleAssignments(optimisticAssignments);
    setScheduleSearchQueries(optimisticQueries);
    setBulkScheduleSaving(true);
    try {
      for (const match of targetMatches) {
        for (const item of filledSlots) {
          await apiService.saveScoutingScheduleAssignment({
            event_key: scheduleEventKey,
            match_key: match.match_key,
            slot_key: item.slot_key,
            user_id: item.user_id,
          });
        }
      }

      setBulkScheduleForm({
        assignments: {},
        queries: {},
        start_match: '',
        end_match: '',
      });
      setBulkScheduleStatus({
        type: 'success',
        message: `Applied assignments to qualification matches ${startMatch}-${endMatch}.`,
      });
      setActiveBulkSlotKey('');
    } catch (error) {
      setScheduleAssignments(previousAssignments);
      setScheduleSearchQueries(previousQueries);
      setBulkScheduleStatus({
        type: 'error',
        message: error.message || 'Unable to apply bulk scheduling.',
      });
    } finally {
      setBulkScheduleSaving(false);
    }
  };

  const renderBulkScheduleCard = () => {
    if (scheduleLoading || scheduleMatches.length === 0) {
      return null;
    }
    const activeBulkSuggestions = activeBulkSlotKey ? getBulkScheduleSuggestions(activeBulkSlotKey) : [];
    const activeBulkLayout = activeBulkSlotKey ? bulkSlotLayouts[activeBulkSlotKey] : null;

    return (
      <View style={[styles.bulkScheduleCard, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
        <Text style={[styles.bulkScheduleTitle, { color: theme.colors.text }]}>Bulk Scheduling</Text>
        <Text style={[styles.bulkScheduleSubtitle, { color: theme.colors.textSecondary }]}>
          Fill any slots you want, then apply them across a qualification match range.
        </Text>

        <View
          style={styles.scheduleSlotsGrid}
          onLayout={(event) => {
            const { x, y, width, height } = event.nativeEvent.layout;
            setBulkGridLayout({ x, y, width, height });
          }}
        >
          {scheduleSlotOptions.map((slot) => (
            (() => {
              const isOpen = activeBulkSlotKey === slot.key;
              const selectedUserID = bulkScheduleForm.assignments?.[slot.key] || '';
              const selectedScouter = scouterAccounts.find((account) => account.id === selectedUserID);
              const inputValue =
                bulkScheduleForm.queries?.[slot.key] ??
                (selectedScouter ? getAccountDisplayName(selectedScouter) : '');

              return (
                <View
                  key={`bulk-${slot.key}`}
                  style={[
                    styles.scheduleSlotCard,
                    isOpen && styles.scheduleSlotCardOpen,
                    Platform.OS === 'web' ? styles.scheduleSlotCardWeb : styles.scheduleSlotCardMobile,
                  ]}
                  onLayout={(event) => {
                    const { x, y, width, height } = event.nativeEvent.layout;
                    setBulkSlotLayouts((prev) => ({ ...prev, [slot.key]: { x, y, width, height } }));
                  }}
                >
                  <Text style={[styles.scheduleSlotLabel, { color: theme.colors.textSecondary }]}>
                    {slot.label}
                  </Text>
                  <View>
                    <TextInput
                      style={[
                        styles.scheduleSearchInput,
                        {
                          borderColor: theme.colors.border,
                          backgroundColor: theme.colors.background,
                          color: theme.colors.text,
                        },
                        isOpen && { borderColor: theme.colors.primary },
                      ]}
                      value={bulkScheduleSaving ? 'Applying...' : inputValue}
                      onFocus={() => {
                        if (bulkBlurTimeoutRef.current) {
                          clearTimeout(bulkBlurTimeoutRef.current);
                          bulkBlurTimeoutRef.current = null;
                        }
                        setActiveBulkSlotKey(slot.key);
                      }}
                      onBlur={() => {
                        bulkBlurTimeoutRef.current = setTimeout(() => {
                          setActiveBulkSlotKey((current) => (current === slot.key ? '' : current));
                          bulkBlurTimeoutRef.current = null;
                        }, 120);
                      }}
                      onChangeText={(text) => {
                        setBulkScheduleStatus(null);
                        setBulkScheduleForm((prev) => ({
                          ...prev,
                          queries: { ...(prev.queries || {}), [slot.key]: text },
                          assignments: { ...(prev.assignments || {}), [slot.key]: '' },
                        }));
                      }}
                      placeholder="Search member"
                      placeholderTextColor={theme.colors.textSecondary}
                      autoCorrect={false}
                      autoCapitalize="words"
                      editable={!bulkScheduleSaving}
                    />
                  </View>
                </View>
              );
            })()
          ))}
        </View>

        {activeBulkSlotKey && activeBulkLayout && bulkGridLayout ? (
          <View
            style={[
              styles.bulkOverlayMenu,
              {
                borderColor: theme.colors.border,
                backgroundColor: theme.colors.surface,
                left: bulkGridLayout.x + activeBulkLayout.x,
                top: bulkGridLayout.y + activeBulkLayout.y + activeBulkLayout.height + 6,
                width: activeBulkLayout.width,
                shadowColor: '#000',
              },
            ]}
          >
            <TouchableOpacity
              style={[
                styles.scheduleDropdownOption,
                {
                  backgroundColor: theme.colors.surface,
                  borderBottomColor: theme.colors.borderLight,
                },
              ]}
              onPress={() => {
                setBulkScheduleStatus(null);
                setBulkScheduleForm((prev) => ({
                  ...prev,
                  assignments: { ...(prev.assignments || {}), [activeBulkSlotKey]: '' },
                  queries: { ...(prev.queries || {}), [activeBulkSlotKey]: '' },
                }));
                setActiveBulkSlotKey('');
              }}
            >
              <Text style={[styles.scheduleDropdownOptionText, { color: theme.colors.textSecondary }]}>
                Unassigned
              </Text>
            </TouchableOpacity>
            {activeBulkSuggestions.map((account) => {
              const selectedUserID = bulkScheduleForm.assignments?.[activeBulkSlotKey] || '';
              return (
                <TouchableOpacity
                  key={`bulk-panel-${activeBulkSlotKey}-${account.id}`}
                  style={[
                    styles.scheduleDropdownOption,
                    {
                      backgroundColor:
                        account.id === selectedUserID ? `${theme.colors.primary}22` : theme.colors.surface,
                      borderBottomColor: theme.colors.borderLight,
                    },
                  ]}
                  onPress={() => {
                    setBulkScheduleStatus(null);
                    setBulkScheduleForm((prev) => ({
                      ...prev,
                      assignments: { ...(prev.assignments || {}), [activeBulkSlotKey]: account.id },
                      queries: { ...(prev.queries || {}), [activeBulkSlotKey]: getAccountDisplayName(account) },
                    }));
                    setActiveBulkSlotKey('');
                  }}
                >
                  <Text
                    style={[
                      styles.scheduleDropdownOptionText,
                      {
                        color:
                          account.id === selectedUserID ? theme.colors.primary : theme.colors.text,
                      },
                    ]}
                  >
                    {getAccountDisplayName(account)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ) : null}

        <View style={styles.scheduleSlotsGrid}>
          <View
            style={[
              styles.scheduleSlotCard,
              Platform.OS === 'web' ? styles.scheduleSlotCardWeb : styles.scheduleSlotCardMobile,
            ]}
          >
            <Text style={[styles.scheduleSlotLabel, { color: theme.colors.textSecondary }]}>Start Match</Text>
            <TextInput
              style={[
                styles.scheduleSearchInput,
                { backgroundColor: theme.colors.background, borderColor: theme.colors.border, color: theme.colors.text },
              ]}
              value={bulkScheduleForm.start_match}
              onChangeText={(text) => {
                setBulkScheduleStatus(null);
                setBulkScheduleForm((prev) => ({ ...prev, start_match: text.replace(/[^0-9]/g, '') }));
              }}
              placeholder="Qual number"
              placeholderTextColor={theme.colors.textSecondary}
              keyboardType="numeric"
            />
          </View>

          <View
            style={[
              styles.scheduleSlotCard,
              Platform.OS === 'web' ? styles.scheduleSlotCardWeb : styles.scheduleSlotCardMobile,
            ]}
          >
            <Text style={[styles.scheduleSlotLabel, { color: theme.colors.textSecondary }]}>End Match</Text>
            <TextInput
              style={[
                styles.scheduleSearchInput,
                { backgroundColor: theme.colors.background, borderColor: theme.colors.border, color: theme.colors.text },
              ]}
              value={bulkScheduleForm.end_match}
              onChangeText={(text) => {
                setBulkScheduleStatus(null);
                setBulkScheduleForm((prev) => ({ ...prev, end_match: text.replace(/[^0-9]/g, '') }));
              }}
              placeholder="Qual number"
              placeholderTextColor={theme.colors.textSecondary}
              keyboardType="numeric"
            />
          </View>
        </View>

        <Text style={[styles.sectionNote, styles.leftAlignedNote, { color: theme.colors.textSecondary }]}>
          Only qualification match numbers already loaded for this event can be used.
        </Text>

        {bulkScheduleStatus ? (
          <View
            style={[
              styles.inlineStatus,
              bulkScheduleStatus.type === 'error' && styles.inlineStatusError,
              bulkScheduleStatus.type === 'success' && styles.inlineStatusSuccess,
            ]}
          >
            <Text
              style={[
                styles.inlineStatusText,
                bulkScheduleStatus.type === 'error' && styles.inlineStatusTextError,
                bulkScheduleStatus.type === 'success' && styles.inlineStatusTextSuccess,
              ]}
            >
              {bulkScheduleStatus.message}
            </Text>
          </View>
        ) : null}

        <TouchableOpacity
          style={[
            styles.modalPrimaryButton,
            { backgroundColor: theme.colors.primary },
            bulkScheduleSaving && styles.disabledButton,
          ]}
          onPress={handleBulkScheduleApply}
          disabled={bulkScheduleSaving}
        >
          <Text style={styles.modalPrimaryButtonText}>{bulkScheduleSaving ? 'Applying...' : 'Apply Range'}</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderScheduleEventDetail = () => {
    if (scheduleLoading) {
      return (
        <Text style={[styles.sectionNote, { color: theme.colors.textSecondary }]}>
          Loading qualification matches...
        </Text>
      );
    }

    if (scheduleMatches.length === 0) {
      return (
        <Text style={[styles.sectionNote, { color: theme.colors.textSecondary }]}>
          No qualification matches are loaded for this event yet.
        </Text>
      );
    }

    return (
      <>
        {renderBulkScheduleCard()}
        {scheduleMatches.map((match) => (
          (() => {
            const activeMatchSlotKey = openScheduleDropdownKey.startsWith(`${match.match_key}:`)
              ? openScheduleDropdownKey
              : '';
            const activeMatchAssignmentKey = activeMatchSlotKey;
            const activeMatchSuggestions = activeMatchAssignmentKey ? getScheduleSuggestions(activeMatchAssignmentKey) : [];
            const activeMatchSlotLayout = activeMatchAssignmentKey ? scheduleSlotLayouts[activeMatchAssignmentKey] : null;
            const activeMatchGridLayout = scheduleGridLayouts[match.match_key] || null;

            return (
              <View
                key={match.match_key}
                style={[
                  styles.scheduleMatchCard,
                  activeMatchAssignmentKey && styles.scheduleMatchCardActive,
                  { borderColor: theme.colors.border, backgroundColor: theme.colors.surface },
                ]}
              >
        <View style={styles.scheduleMatchHeader}>
          <View style={styles.scheduleMatchHeaderText}>
            <Text style={[styles.scheduleMatchTitle, { color: theme.colors.text }]}>
              Qual {match.match_number}
            </Text>
            <Text style={[styles.scheduleMatchMeta, { color: theme.colors.textSecondary }]}>
              Red: {(match.red_teams || []).map((team) => team.replace('frc', '')).join(', ')} | Blue: {(match.blue_teams || []).map((team) => team.replace('frc', '')).join(', ')}
            </Text>
          </View>
        </View>

        <View
          style={styles.scheduleSlotsGrid}
          onLayout={(event) => {
            const { x, y, width, height } = event.nativeEvent.layout;
            setScheduleGridLayouts((prev) => ({ ...prev, [match.match_key]: { x, y, width, height } }));
          }}
        >
          {scheduleSlotOptions.map((slot) => {
            const assignmentKey = `${match.match_key}:${slot.key}`;
            const selectedUserID = scheduleAssignments[assignmentKey] || '';
            const selectedScouter = scouterAccounts.find((account) => account.id === selectedUserID);
            const isOpen = activeMatchAssignmentKey === assignmentKey;
            const isSaving = savingScheduleKey === assignmentKey;
            const inputValue =
              scheduleSearchQueries[assignmentKey] ??
              (selectedScouter ? getAccountDisplayName(selectedScouter) : '');
            const suggestions = isOpen ? getScheduleSuggestions(assignmentKey) : [];

            return (
              <View
                key={assignmentKey}
                style={[
                  styles.scheduleSlotCard,
                  isOpen && styles.scheduleSlotCardOpen,
                  Platform.OS === 'web' ? styles.scheduleSlotCardWeb : styles.scheduleSlotCardMobile,
                ]}
                onLayout={(event) => {
                  const { x, y, width, height } = event.nativeEvent.layout;
                  setScheduleSlotLayouts((prev) => ({ ...prev, [assignmentKey]: { x, y, width, height } }));
                }}
              >
                <Text style={[styles.scheduleSlotLabel, { color: theme.colors.textSecondary }]}>
                  {getScheduleSlotLabel(match, slot.key)}
                </Text>
                <TextInput
                  style={[
                    styles.scheduleSearchInput,
                    {
                      borderColor: theme.colors.border,
                      backgroundColor: theme.colors.background,
                      color: theme.colors.text,
                    },
                    isOpen && { borderColor: theme.colors.primary },
                  ]}
                  value={isSaving ? 'Saving...' : inputValue}
                  onFocus={() => {
                    if (scheduleBlurTimeoutRef.current) {
                      clearTimeout(scheduleBlurTimeoutRef.current);
                      scheduleBlurTimeoutRef.current = null;
                    }
                    setOpenScheduleDropdownKey(assignmentKey);
                  }}
                  onBlur={() => {
                    scheduleBlurTimeoutRef.current = setTimeout(() => {
                      setOpenScheduleDropdownKey((current) => (current === assignmentKey ? '' : current));
                      scheduleBlurTimeoutRef.current = null;
                    }, 120);
                  }}
                  onChangeText={(text) => {
                    setScheduleSearchQueries((prev) => ({ ...prev, [assignmentKey]: text }));
                    setOpenScheduleDropdownKey(assignmentKey);
                  }}
                  placeholder="Search member"
                  placeholderTextColor={theme.colors.textSecondary}
                  autoCorrect={false}
                  autoCapitalize="words"
                  editable={!isSaving}
                />
              </View>
            );
          })}
        </View>

        {activeMatchAssignmentKey ? (
          <View
            style={[
              styles.bulkOverlayMenu,
              {
                borderColor: theme.colors.border,
                backgroundColor: theme.colors.surface,
                left: activeMatchGridLayout && activeMatchSlotLayout ? activeMatchGridLayout.x + activeMatchSlotLayout.x : 12,
                top:
                  activeMatchGridLayout && activeMatchSlotLayout
                    ? activeMatchGridLayout.y + activeMatchSlotLayout.y + activeMatchSlotLayout.height + 6
                    : 88,
                width: activeMatchSlotLayout ? activeMatchSlotLayout.width : undefined,
                shadowColor: '#000',
              },
            ]}
          >
            <TouchableOpacity
              style={[
                styles.scheduleDropdownOption,
                {
                  backgroundColor: theme.colors.surface,
                  borderBottomColor: theme.colors.borderLight,
                },
              ]}
              onPress={() => {
                const slotKey = activeMatchAssignmentKey.split(':')[1];
                handleScheduleAssignmentChange(scheduleEventKey, match.match_key, slotKey, '');
              }}
            >
              <Text style={[styles.scheduleDropdownOptionText, { color: theme.colors.textSecondary }]}>
                Unassigned
              </Text>
            </TouchableOpacity>
            {activeMatchSuggestions.map((account) => {
              const selectedUserID = scheduleAssignments[activeMatchAssignmentKey] || '';
              return (
                <TouchableOpacity
                  key={`${activeMatchAssignmentKey}-${account.id}`}
                  style={[
                    styles.scheduleDropdownOption,
                    {
                      backgroundColor:
                        account.id === selectedUserID ? `${theme.colors.primary}22` : theme.colors.surface,
                      borderBottomColor: theme.colors.borderLight,
                    },
                  ]}
                  onPress={() => {
                    const slotKey = activeMatchAssignmentKey.split(':')[1];
                    handleScheduleAssignmentChange(scheduleEventKey, match.match_key, slotKey, account.id);
                  }}
                >
                  <Text
                    style={[
                      styles.scheduleDropdownOptionText,
                      { color: account.id === selectedUserID ? theme.colors.primary : theme.colors.text },
                    ]}
                    numberOfLines={1}
                  >
                    {getAccountDisplayName(account)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ) : null}
              </View>
            );
          })()
        ))}
      </>
    );
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

  const loadScheduleForEvent = async (eventKey) => {
    if (!eventKey) {
      setScheduleMatches([]);
      setScheduleAssignments({});
      setScheduleGridLayouts({});
      setScheduleSlotLayouts({});
      resetBulkScheduleForm();
      return;
    }

    setScheduleLoading(true);
    try {
      const [matches, assignments] = await Promise.all([
        apiService.getEventMatches(eventKey),
        apiService.getScoutingSchedule(eventKey),
      ]);

      const qualificationMatches = (matches || [])
        .filter((match) => String(match.comp_level || '').toLowerCase() === 'qm')
        .sort((a, b) => Number(a.match_number || 0) - Number(b.match_number || 0));

      const assignmentMap = {};
      (assignments || []).forEach((item) => {
        assignmentMap[`${item.match_key}:${item.slot_key}`] = item.user_id || '';
      });

      setScheduleMatches(qualificationMatches);
      setScheduleAssignments(assignmentMap);
      setScheduleSearchQueries({});
      setScheduleGridLayouts({});
      setScheduleSlotLayouts({});
      resetBulkScheduleForm();
    } catch (error) {
      Alert.alert('Error', error.message || 'Unable to load scouting schedule.');
    } finally {
      setScheduleLoading(false);
    }
  };

  const handleScheduleAssignmentChange = async (eventKey, matchKey, slotKey, userID) => {
    const scheduleKey = `${matchKey}:${slotKey}`;
    setSavingScheduleKey(scheduleKey);
    try {
      await apiService.saveScoutingScheduleAssignment({
        event_key: eventKey,
        match_key: matchKey,
        slot_key: slotKey,
        user_id: userID,
      });
      setScheduleAssignments((prev) => ({
        ...prev,
        [scheduleKey]: userID,
      }));
      setScheduleSearchQueries((prev) => ({
        ...prev,
        [scheduleKey]: userID
          ? getAccountDisplayName(scouterAccounts.find((account) => account.id === userID) || {}) || ''
          : '',
      }));
      setOpenScheduleDropdownKey('');
    } catch (error) {
      Alert.alert('Error', error.message || 'Unable to update scouting schedule.');
    } finally {
      setSavingScheduleKey('');
    }
  };

  const openScheduleModal = (eventKey) => {
    setOpenScheduleDropdownKey('');
    setScheduleSearchQueries({});
    resetBulkScheduleForm();
    setScheduleEventKey(eventKey);
    setShowScheduleModal(true);
  };

  const closeScheduleModal = () => {
    setOpenScheduleDropdownKey('');
    setScheduleSearchQueries({});
    resetBulkScheduleForm();
    setScheduleEventKey('');
    setShowScheduleModal(false);
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

  const resetManualMatchForm = () => {
    setManualMatchForm({
      comp_level: 'qm',
      number: '',
      red_score: '',
      blue_score: '',
    });
    setManualMatchTeamQueries({
      red1: '',
      red2: '',
      red3: '',
      blue1: '',
      blue2: '',
      blue3: '',
    });
    setManualMatchTeamSelections({
      red1: null,
      red2: null,
      red3: null,
      blue1: null,
      blue2: null,
      blue3: null,
    });
    setActiveTeamField(null);
  };

  const ensureTeamCatalogLoaded = async () => {
    if (teamCatalogLoading || teamCatalog.length > 0) {
      return;
    }

    setTeamCatalogLoading(true);
    try {
      const teams = await apiService.getAllTeams();
      setTeamCatalog(teams || []);
    } catch (error) {
      setManualMatchStatus({
        type: 'error',
        message: 'Unable to load teams from the database.',
      });
    } finally {
      setTeamCatalogLoading(false);
    }
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

  const openMatchModal = (event) => {
    setSelectedMatchEvent(event);
    resetManualMatchForm();
    setManualMatchStatus(null);
    ensureTeamCatalogLoaded();
  };

  const handleAddManualMatch = async () => {
    if (!selectedMatchEvent || addingMatch) {
      return;
    }

    const redTeams = ['red1', 'red2', 'red3'].map((field) => manualMatchTeamSelections[field]?.team_num);
    const blueTeams = ['blue1', 'blue2', 'blue3'].map((field) => manualMatchTeamSelections[field]?.team_num);
    const numberValue = Number(manualMatchForm.number);
    const isPlayoffs = manualMatchForm.comp_level === 'sf';
    const matchNumber = isPlayoffs ? 1 : numberValue;
    const setNumber = isPlayoffs ? numberValue : 1;

    if (
      !Number.isInteger(numberValue) ||
      numberValue <= 0 ||
      redTeams.some((teamNum) => !Number.isInteger(teamNum) || teamNum <= 0) ||
      blueTeams.some((teamNum) => !Number.isInteger(teamNum) || teamNum <= 0)
    ) {
      setManualMatchStatus({
        type: 'error',
        message: 'Select six teams from the database and enter a valid match number.',
      });
      return;
    }

    const uniqueTeams = new Set([...redTeams, ...blueTeams]);
    if (uniqueTeams.size !== 6) {
      setManualMatchStatus({
        type: 'error',
        message: 'Each alliance slot must use a different team.',
      });
      return;
    }

    if (
      (manualMatchForm.red_score.trim() !== '' && Number.isNaN(Number(manualMatchForm.red_score))) ||
      (manualMatchForm.blue_score.trim() !== '' && Number.isNaN(Number(manualMatchForm.blue_score)))
    ) {
      setManualMatchStatus({
        type: 'error',
        message: 'Scores must be blank or numeric.',
      });
      return;
    }

    setAddingMatch(true);
    setManualMatchStatus({
      type: 'info',
      message: 'Saving match...',
    });
    try {
      const result = await apiService.addManagedEventMatch({
        event_key: selectedMatchEvent.event_key,
        comp_level: manualMatchForm.comp_level,
        set_number: setNumber,
        match_number: matchNumber,
        red_teams: redTeams,
        blue_teams: blueTeams,
        red_score: manualMatchForm.red_score.trim() === '' ? null : Number(manualMatchForm.red_score),
        blue_score: manualMatchForm.blue_score.trim() === '' ? null : Number(manualMatchForm.blue_score),
      });
      setManualMatchForm((prev) => ({
        ...prev,
        number: String(numberValue + 1),
        red_score: '',
        blue_score: '',
      }));
      setManualMatchTeamQueries({
        red1: '',
        red2: '',
        red3: '',
        blue1: '',
        blue2: '',
        blue3: '',
      });
      setManualMatchTeamSelections({
        red1: null,
        red2: null,
        red3: null,
        blue1: null,
        blue2: null,
        blue3: null,
      });
      setActiveTeamField(null);
      setManualMatchStatus({
        type: 'success',
        message: `Saved ${result?.match_key || 'match'} to ${selectedMatchEvent.event_key}.`,
      });
    } catch (error) {
      setManualMatchStatus({
        type: 'error',
        message: error.message || 'Unable to add manual match.',
      });
    } finally {
      setAddingMatch(false);
    }
  };

  const getManualMatchSuggestions = (field) => {
    const query = (manualMatchTeamQueries[field] || '').trim().toLowerCase();
    if (!query) {
      return [];
    }

    return teamCatalog
      .filter((team) => {
        const teamNum = String(team.team_num || '');
        const teamName = String(team.name || '').toLowerCase();
        return teamNum.includes(query) || teamName.includes(query);
      })
      .slice(0, 8);
  };

  const renderManualMatchTeamField = (field, label) => {
    const suggestions = activeTeamField === field ? getManualMatchSuggestions(field) : [];

    return (
      <View key={field} style={styles.teamPickerField}>
        <TextInput
          style={[
            styles.modalInput,
            {
              backgroundColor: theme.colors.background,
              borderColor: activeTeamField === field ? theme.colors.primary : theme.colors.border,
              color: theme.colors.text,
            },
          ]}
          value={manualMatchTeamQueries[field]}
          onFocus={() => {
            setActiveTeamField(field);
            ensureTeamCatalogLoaded();
          }}
          onChangeText={(text) => {
            setManualMatchTeamQueries((prev) => ({ ...prev, [field]: text }));
            setManualMatchTeamSelections((prev) => ({ ...prev, [field]: null }));
            setActiveTeamField(field);
            setManualMatchStatus(null);
          }}
          placeholder={label}
          placeholderTextColor={theme.colors.textSecondary}
          autoCorrect={false}
          autoCapitalize="none"
        />
        {suggestions.length > 0 && (
          <View style={[styles.teamSuggestionList, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            {suggestions.map((team) => (
              <TouchableOpacity
                key={`${field}-${team.team_key}`}
                style={[
                  styles.teamSuggestionItem,
                  {
                    backgroundColor: theme.colors.surface,
                    borderBottomColor: theme.colors.borderLight,
                  },
                ]}
                onPress={() => {
                  setManualMatchTeamSelections((prev) => ({ ...prev, [field]: team }));
                  setManualMatchTeamQueries((prev) => ({ ...prev, [field]: `${team.team_num} - ${team.name || `Team ${team.team_num}`}` }));
                  setActiveTeamField(null);
                  setManualMatchStatus(null);
                }}
              >
                <Text style={[styles.teamSuggestionTitle, { color: theme.colors.text }]}>
                  {team.team_num} - {team.name || `Team ${team.team_num}`}
                </Text>
                <Text style={[styles.teamSuggestionMeta, { color: theme.colors.textSecondary }]} numberOfLines={1}>
                  {[team.city, team.state].filter(Boolean).join(', ') || 'Team in local database'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    );
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

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
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
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Scouting Schedule</Text>
          <Text style={[styles.sectionNote, { color: theme.colors.textSecondary }]}>
            Assign scouters to each qualification match for team and alliance scouting.
          </Text>
          {scouterAccounts.length === 0 ? (
            <Text style={[styles.sectionNote, { color: theme.colors.textSecondary }]}>
              No scouter or scouting lead accounts are available to schedule yet.
            </Text>
          ) : (
            <>
              {managedEvents.length === 0 ? (
                <Text style={[styles.sectionNote, { color: theme.colors.textSecondary }]}>
                  Add an event to start scheduling.
                </Text>
              ) : (
                <View style={styles.scheduleEventGrid}>
                  {managedEvents.map((event) => (
                    <TouchableOpacity
                      key={event.event_key}
                      style={[styles.scheduleEventCard, { borderColor: theme.colors.border, backgroundColor: theme.colors.background }]}
                      onPress={() => openScheduleModal(event.event_key)}
                    >
                      <Text style={[styles.scheduleEventCardTitle, { color: theme.colors.text }]} numberOfLines={2}>
                        {event.name || event.event_key}
                      </Text>
                      <Text style={[styles.scheduleEventCardMeta, { color: theme.colors.textSecondary }]} numberOfLines={1}>
                        {event.event_key}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </>
          )}
        </View>

        <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Account Management</Text>
          <Text style={[styles.sectionNote, { color: theme.colors.textSecondary }]}>
            Search accounts and manage roles by account type.
          </Text>
          <View style={[styles.accountSearchRow, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
            <Ionicons name="search" size={18} color={theme.colors.textSecondary} />
            <TextInput
              style={[styles.accountSearchInput, { color: theme.colors.text }]}
              value={accountSearchQuery}
              onChangeText={setAccountSearchQuery}
              placeholder="Search accounts by name or email"
              placeholderTextColor={theme.colors.textSecondary}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
          {accountsLoading ? (
            <Text style={[styles.sectionNote, { color: theme.colors.textSecondary }]}>Loading accounts...</Text>
          ) : filteredAccounts.length === 0 ? (
            <Text style={[styles.accountEmptyText, { color: theme.colors.textSecondary }]}>
              No matching accounts found.
            </Text>
          ) : (
            groupedAccounts.map((section) => (
              <View key={section.key} style={styles.accountRoleSection}>
                <View style={styles.accountRoleSectionHeader}>
                  <Text style={[styles.accountRoleSectionTitle, { color: theme.colors.text }]}>{section.label}</Text>
                  <Text style={[styles.accountRoleSectionCount, { color: theme.colors.textSecondary }]}>
                    {section.accounts.length}
                  </Text>
                </View>
                {section.accounts.length === 0 ? null : (
                  <View style={styles.accountGrid}>
                    {section.accounts.map((account) => {
                      const isDropdownOpen = openAccountDropdownID === account.id;
                      const isCurrentUser = account.id === user?.id;
                      return (
                        <View
                          key={account.id}
                          style={[
                            styles.accountCard,
                            Platform.OS === 'web' && styles.accountCardWeb,
                            { backgroundColor: theme.colors.background, borderColor: theme.colors.border },
                          ]}
                        >
                          <View style={styles.accountCardTopRow}>
                            <View style={styles.accountIdentity}>
                              <View
                                style={[
                                  styles.accountIconBadge,
                                  Platform.OS === 'web' && styles.accountIconBadgeWeb,
                                  { backgroundColor: `${theme.colors.primary}18` },
                                ]}
                              >
                                <Ionicons
                                  name="person"
                                  size={Platform.OS === 'web' ? 12 : 14}
                                  color={theme.colors.primary}
                                />
                              </View>
                              <View style={styles.accountInfo}>
                                <Text
                                  style={[
                                    styles.accountName,
                                    Platform.OS === 'web' && styles.accountNameWeb,
                                    { color: theme.colors.text },
                                  ]}
                                  numberOfLines={1}
                                >
                                  {getAccountDisplayName(account)}
                                </Text>
                                <Text
                                  style={[
                                    styles.accountMeta,
                                    Platform.OS === 'web' && styles.accountMetaWeb,
                                    { color: theme.colors.textSecondary },
                                  ]}
                                  numberOfLines={1}
                                >
                                  {account.email || account.id}
                                </Text>
                              </View>
                            </View>
                            <TouchableOpacity
                              style={[
                                styles.accountDropdownButton,
                                Platform.OS === 'web' && styles.accountDropdownButtonWeb,
                                isCurrentUser && styles.disabledButton,
                                { borderColor: theme.colors.border },
                              ]}
                              onPress={() => {
                                if (isCurrentUser) {
                                  return;
                                }
                                setOpenAccountDropdownID(isDropdownOpen ? '' : account.id);
                              }}
                              disabled={isCurrentUser}
                            >
                              <Text
                                style={[
                                  styles.accountDropdownText,
                                  Platform.OS === 'web' && styles.accountDropdownTextWeb,
                                  { color: theme.colors.text },
                                ]}
                              >
                                {getRoleLabel(account.role || USER_ROLES.VIEWER)}
                              </Text>
                              <Ionicons
                                name={isDropdownOpen ? 'chevron-up' : 'chevron-down'}
                                size={13}
                                color={theme.colors.textSecondary}
                              />
                            </TouchableOpacity>
                            {isCurrentUser ? (
                              <Text style={[styles.accountLockedText, { color: theme.colors.textSecondary }]}>
                                You can't change your own role
                              </Text>
                            ) : null}
                          </View>
                          {isDropdownOpen ? (
                            <View style={[styles.accountDropdownMenu, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
                              {upgradableRoleOptions.map((option) => (
                                <TouchableOpacity
                                  key={`${account.id}-${option.key}`}
                                  style={[
                                    styles.accountDropdownOption,
                                    option.key === (account.role || USER_ROLES.VIEWER) && {
                                      backgroundColor: `${theme.colors.primary}22`,
                                    },
                                  ]}
                                  onPress={() => handleRoleUpgrade(account.id, option.key)}
                                >
                                  <Text
                                    style={[
                                      styles.accountDropdownOptionText,
                                      { color: theme.colors.text },
                                      option.key === (account.role || USER_ROLES.VIEWER) && { color: theme.colors.primary },
                                    ]}
                                  >
                                    {option.label}
                                  </Text>
                                </TouchableOpacity>
                              ))}
                            </View>
                          ) : null}
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            ))
          )}
        </View>
      </ScrollView>

      <Modal visible={showEventsModal} animationType="slide" presentationStyle="pageSheet">
        <View style={[styles.modalContainer, { backgroundColor: theme.colors.background }]}>
          <View style={[styles.modalHeader, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Manage Events</Text>
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => {
                setShowEventsModal(false);
                setSelectedMatchEvent(null);
              }}
            >
              <Ionicons name="close" size={24} color={theme.colors.text} />
            </TouchableOpacity>
          </View>

            <ScrollView contentContainerStyle={styles.modalContent} showsVerticalScrollIndicator={false}>
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

            {selectedMatchEvent && (
              <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
                <View style={styles.inlineSectionHeader}>
                  <View>
                    <Text style={[styles.sectionTitle, { color: theme.colors.text, marginBottom: 2 }]}>Add Manual Match</Text>
                    <Text style={[styles.modalSubtitle, { color: theme.colors.textSecondary }]}>
                      {selectedMatchEvent.name || selectedMatchEvent.event_key}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.eventRowButton, { borderColor: theme.colors.border }]}
                    onPress={() => setSelectedMatchEvent(null)}
                  >
                    <Text style={[styles.eventRowButtonText, { color: theme.colors.text }]}>Close</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.formModeRow}>
                  {[
                    { key: 'qm', label: 'Quals' },
                    { key: 'sf', label: 'Playoffs' },
                    { key: 'f', label: 'Finals' },
                  ].map((option) => (
                    <TouchableOpacity
                      key={option.key}
                      style={[styles.formModeButton, manualMatchForm.comp_level === option.key && { backgroundColor: theme.colors.primary }]}
                      onPress={() => setManualMatchForm((prev) => ({ ...prev, comp_level: option.key }))}
                    >
                      <Text
                        style={[
                          styles.formModeButtonText,
                          { color: theme.colors.text },
                          manualMatchForm.comp_level === option.key && styles.formModeButtonTextActive,
                        ]}
                      >
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <View style={styles.modalTwoColumn}>
                  <TextInput
                    style={[styles.modalInput, { backgroundColor: theme.colors.background, borderColor: theme.colors.border, color: theme.colors.text }]}
                    value={manualMatchForm.number}
                    onChangeText={(text) => setManualMatchForm((prev) => ({ ...prev, number: text }))}
                    placeholder={
                      manualMatchForm.comp_level === 'qm'
                        ? 'Quals number'
                        : manualMatchForm.comp_level === 'f'
                          ? 'Finals number'
                          : 'Playoffs number'
                    }
                    placeholderTextColor={theme.colors.textSecondary}
                    keyboardType="numeric"
                  />
                </View>

                <Text style={[styles.modalSectionLabel, { color: theme.colors.textSecondary }]}>Red Alliance</Text>
                <Text style={[styles.sectionNote, styles.leftAlignedNote, { color: theme.colors.textSecondary }]}>
                  Search by team number or name. Only teams already in your local database can be used.
                </Text>
                <View style={styles.modalThreeColumn}>
                  {['red1', 'red2', 'red3'].map((field, index) => (
                    <View key={field} style={styles.modalThirdInput}>
                      {renderManualMatchTeamField(field, `Red ${index + 1}`)}
                    </View>
                  ))}
                </View>

                <Text style={[styles.modalSectionLabel, { color: theme.colors.textSecondary }]}>Blue Alliance</Text>
                <View style={styles.modalThreeColumn}>
                  {['blue1', 'blue2', 'blue3'].map((field, index) => (
                    <View key={field} style={styles.modalThirdInput}>
                      {renderManualMatchTeamField(field, `Blue ${index + 1}`)}
                    </View>
                  ))}
                </View>

                {teamCatalogLoading && (
                  <Text style={[styles.sectionNote, styles.leftAlignedNote, { color: theme.colors.textSecondary }]}>
                    Loading teams...
                  </Text>
                )}

                <Text style={[styles.modalSectionLabel, { color: theme.colors.textSecondary }]}>Scores</Text>
                <View style={styles.modalTwoColumn}>
                  <TextInput
                    style={[styles.modalInput, styles.modalHalfInput, { backgroundColor: theme.colors.background, borderColor: theme.colors.border, color: theme.colors.text }]}
                    value={manualMatchForm.red_score}
                    onChangeText={(text) => setManualMatchForm((prev) => ({ ...prev, red_score: text }))}
                    placeholder="Red score"
                    placeholderTextColor={theme.colors.textSecondary}
                    keyboardType="numeric"
                  />
                  <TextInput
                    style={[styles.modalInput, styles.modalHalfInput, { backgroundColor: theme.colors.background, borderColor: theme.colors.border, color: theme.colors.text }]}
                    value={manualMatchForm.blue_score}
                    onChangeText={(text) => setManualMatchForm((prev) => ({ ...prev, blue_score: text }))}
                    placeholder="Blue score"
                    placeholderTextColor={theme.colors.textSecondary}
                    keyboardType="numeric"
                  />
                </View>
                <Text style={[styles.sectionNote, styles.leftAlignedNote, { color: theme.colors.textSecondary }]}>
                  Leave scores blank if the match has not been played yet.
                </Text>

                {manualMatchStatus && (
                  <View
                    style={[
                      styles.inlineStatus,
                      manualMatchStatus.type === 'error' && styles.inlineStatusError,
                      manualMatchStatus.type === 'success' && styles.inlineStatusSuccess,
                    ]}
                  >
                    <Text
                      style={[
                        styles.inlineStatusText,
                        { color: theme.colors.text },
                        manualMatchStatus.type === 'error' && styles.inlineStatusTextError,
                        manualMatchStatus.type === 'success' && styles.inlineStatusTextSuccess,
                      ]}
                    >
                      {manualMatchStatus.message}
                    </Text>
                  </View>
                )}

                <TouchableOpacity
                  style={[styles.modalPrimaryButton, { backgroundColor: theme.colors.primary }, addingMatch && styles.disabledButton]}
                  onPress={handleAddManualMatch}
                  disabled={addingMatch}
                >
                  <Text style={styles.modalPrimaryButtonText}>{addingMatch ? 'Saving...' : 'Add Match'}</Text>
                </TouchableOpacity>
              </View>
            )}

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
                        style={[styles.eventRowButton, { borderColor: theme.colors.border }]}
                        onPress={() => openMatchModal(event)}
                      >
                        <Text style={[styles.eventRowButtonText, { color: theme.colors.text }]}>
                          Add Match
                        </Text>
                      </TouchableOpacity>
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

      <Modal
        visible={showScheduleModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeScheduleModal}
      >
        <View style={[styles.modalContainer, { backgroundColor: theme.colors.background }]}>
          <View style={[styles.modalHeader, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
            <View style={styles.scheduleModalHeaderText}>
              <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
                {selectedScheduleEvent?.name || scheduleEventKey || 'Scouting Schedule'}
              </Text>
              <Text style={[styles.modalSubtitle, { color: theme.colors.textSecondary }]}>
                Qualification match scheduling
              </Text>
            </View>
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={closeScheduleModal}
            >
              <Ionicons name="close" size={24} color={theme.colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.modalContent} showsVerticalScrollIndicator={false}>
            {renderScheduleEventDetail()}
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
  modalSubtitle: {
    fontSize: 13,
    marginTop: 4,
  },
  modalCloseButton: {
    padding: 8,
  },
  modalContent: {
    padding: 20,
    overflow: 'visible',
  },
  scheduleModalHeaderText: {
    flex: 1,
    paddingRight: 12,
  },
  bulkScheduleCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    position: 'relative',
    overflow: 'visible',
    zIndex: 60,
    elevation: 25,
  },
  bulkScheduleTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  bulkScheduleSubtitle: {
    fontSize: 12,
    marginTop: 4,
    marginBottom: 12,
    lineHeight: 18,
  },
  bulkOverlayMenu: {
    position: 'absolute',
    borderWidth: 1,
    borderRadius: 10,
    overflow: 'hidden',
    zIndex: 5000,
    elevation: 100,
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    maxHeight: 220,
  },
  inlineSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 14,
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
  leftAlignedNote: {
    textAlign: 'left',
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
  modalThreeColumn: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
    overflow: 'visible',
  },
  modalHalfInput: {
    flex: 1,
  },
  modalThirdInput: {
    flex: 1,
    overflow: 'visible',
  },
  modalSectionLabel: {
    marginTop: 14,
    marginBottom: 8,
    fontSize: 13,
    fontWeight: '700',
  },
  inlineStatus: {
    marginTop: 10,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: 'rgba(128, 128, 128, 0.12)',
  },
  inlineStatusError: {
    backgroundColor: 'rgba(220, 38, 38, 0.14)',
  },
  inlineStatusSuccess: {
    backgroundColor: 'rgba(22, 163, 74, 0.14)',
  },
  inlineStatusText: {
    fontSize: 13,
    fontWeight: '600',
  },
  inlineStatusTextError: {
    color: '#dc2626',
  },
  inlineStatusTextSuccess: {
    color: '#15803d',
  },
  teamPickerField: {
    position: 'relative',
    zIndex: 20,
  },
  teamSuggestionList: {
    position: 'absolute',
    top: 52,
    left: 0,
    right: 0,
    borderWidth: 1,
    borderRadius: 10,
    overflow: 'hidden',
    maxHeight: 220,
    zIndex: 30,
    elevation: 6,
  },
  teamSuggestionItem: {
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  teamSuggestionTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  teamSuggestionMeta: {
    fontSize: 12,
    marginTop: 2,
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
  scheduleEventSelector: {
    gap: 10,
    paddingBottom: 10,
    marginTop: 10,
  },
  scheduleEventGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 12,
  },
  scheduleEventCard: {
    width: Platform.OS === 'web' ? '24%' : '48%',
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    minHeight: 96,
    justifyContent: 'space-between',
  },
  scheduleEventCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
  scheduleEventCardMeta: {
    fontSize: 12,
    marginTop: 10,
  },
  scheduleEventChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  scheduleEventChipText: {
    fontSize: 13,
    fontWeight: '700',
  },
  scheduleEventChipTextActive: {
    color: 'white',
  },
  scheduleMatchCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
    overflow: 'visible',
  },
  scheduleMatchCardActive: {
    zIndex: 3000,
    elevation: 80,
  },
  scheduleMatchHeader: {
    marginBottom: 12,
  },
  scheduleSelectedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    marginTop: 12,
    marginBottom: 8,
  },
  scheduleSelectedTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  scheduleSelectedMeta: {
    fontSize: 12,
    marginTop: 4,
  },
  scheduleMatchHeaderText: {
    flex: 1,
  },
  scheduleMatchTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  scheduleMatchMeta: {
    fontSize: 12,
    marginTop: 4,
    lineHeight: 18,
  },
  scheduleSlotsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    overflow: 'visible',
    zIndex: 1,
  },
  scheduleSlotCard: {
    position: 'relative',
    zIndex: 2,
    overflow: 'visible',
  },
  scheduleSlotCardOpen: {
    zIndex: 50,
    elevation: 20,
  },
  scheduleSlotCardWeb: {
    width: '24%',
    minWidth: 170,
  },
  scheduleSlotCardMobile: {
    width: '48%',
  },
  scheduleSlotLabel: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
  },
  scheduleSearchInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
    fontSize: 13,
    fontWeight: '600',
    outlineWidth: 0,
  },
  scheduleDropdownMenu: {
    position: 'absolute',
    top: 58,
    left: 0,
    right: 0,
    borderWidth: 1,
    borderRadius: 10,
    overflow: 'hidden',
    zIndex: 500,
    maxHeight: 220,
    elevation: 40,
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    opacity: 1,
  },
  scheduleDropdownMenuUp: {
    top: 'auto',
    bottom: 58,
  },
  scheduleDropdownOption: {
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    opacity: 1,
  },
  scheduleDropdownOptionText: {
    fontSize: 13,
    fontWeight: '600',
  },
  accountSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    marginTop: 12,
    marginBottom: 16,
  },
  accountSearchInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 10,
    marginLeft: 8,
    outlineWidth: 0,
  },
  accountRoleSection: {
    marginTop: 14,
  },
  accountRoleSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  accountRoleSectionTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  accountRoleSectionCount: {
    fontSize: 12,
    fontWeight: '700',
  },
  accountGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  accountCard: {
    width: '48%',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  accountCardWeb: {
    width: '24%',
    padding: 8,
  },
  accountCardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  accountIdentity: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
  },
  accountIconBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  accountIconBadgeWeb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    marginRight: 5,
  },
  accountInfo: {
    flex: 1,
    minWidth: 0,
  },
  accountName: {
    fontSize: 14,
    fontWeight: '700',
  },
  accountNameWeb: {
    fontSize: 12,
  },
  accountMeta: {
    fontSize: 12,
    marginTop: 2,
  },
  accountMetaWeb: {
    fontSize: 11,
    marginTop: 1,
  },
  accountDropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    minWidth: 118,
    marginLeft: 8,
  },
  accountDropdownText: {
    fontSize: 12,
    fontWeight: '700',
  },
  accountDropdownButtonWeb: {
    minWidth: 100,
    paddingHorizontal: 8,
    paddingVertical: 7,
  },
  accountDropdownTextWeb: {
    fontSize: 11,
  },
  accountLockedText: {
    fontSize: 11,
    marginTop: 6,
    textAlign: 'right',
  },
  accountDropdownMenu: {
    borderWidth: 1,
    borderRadius: 10,
    marginTop: 8,
    overflow: 'hidden',
  },
  accountDropdownOption: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  accountDropdownOptionText: {
    fontSize: 13,
    fontWeight: '600',
  },
  accountEmptyText: {
    fontSize: 13,
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
