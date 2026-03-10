import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  TextInput,
  TouchableOpacity,
  Alert,
  FlatList,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth, USER_ROLES } from '../contexts/AuthContext';
import { platformUtils } from '../utils/platformUtils';
import apiService from '../utils/apiService';

const COOLDOWN_MS = 30 * 60 * 1000;

const formatDateTime = (timestamp) => {
  if (!timestamp) return 'Not recorded';
  return new Date(timestamp).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

const formatRemaining = (remainingMs) => {
  if (remainingMs <= 0) return 'Ready';
  const totalSeconds = Math.ceil(remainingMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
};

export default function BatteryTrackerScreen() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const canViewBatteryTracker = user?.role === USER_ROLES.DRIVE_TEAM;
  const [inventory, setInventory] = useState([]);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingInventory, setSavingInventory] = useState(false);
  const [showUseModal, setShowUseModal] = useState(false);
  const [showManageModal, setShowManageModal] = useState(false);
  const [showAddSection, setShowAddSection] = useState(false);
  const [showRemoveSection, setShowRemoveSection] = useState(false);
  const [showClearLogModal, setShowClearLogModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBatteryId, setSelectedBatteryId] = useState(null);
  const [batteryNote, setBatteryNote] = useState('');
  const [newBatteryName, setNewBatteryName] = useState('');
  const [now, setNow] = useState(Date.now());

  const loadData = async () => {
    try {
      setLoading(true);
      const [inventoryResponse, entriesResponse] = await Promise.all([
        apiService.getBatteryInventory(),
        apiService.getBatteryTrackerEntries(),
      ]);
      setInventory(Array.isArray(inventoryResponse) ? inventoryResponse : []);
      setEntries(Array.isArray(entriesResponse) ? entriesResponse : []);
    } catch (error) {
      console.error('Failed to load battery tracker data:', error);
      Alert.alert('Error', error.message || 'Unable to load battery tracker.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const hasActiveTimers = entries.some((entry) => entry.safe_to_plug_at && entry.safe_to_plug_at > now);
    if (!hasActiveTimers) {
      return undefined;
    }

    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [entries, now]);

  const persistInventory = async (nextInventory) => {
    const rankedInventory = nextInventory.map((item, index) => ({
      ...item,
      rank: index + 1,
    }));
    setInventory(rankedInventory);
    setSavingInventory(true);
    try {
      await apiService.saveBatteryInventory(
        rankedInventory.map((item, index) => ({
          id: item.id,
          name: item.name,
          rank: index + 1,
        }))
      );
    } catch (error) {
      console.error('Failed to save battery inventory:', error);
      Alert.alert('Error', error.message || 'Unable to save battery order.');
      await loadData();
    } finally {
      setSavingInventory(false);
    }
  };

  const sortedInventory = useMemo(
    () => [...inventory].sort((a, b) => (a.rank || 0) - (b.rank || 0)),
    [inventory]
  );

  const sortedEntries = useMemo(
    () => [...entries].sort((a, b) => (b.created_at || 0) - (a.created_at || 0)),
    [entries]
  );

  const filteredInventory = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return sortedInventory;
    return sortedInventory.filter((item) => item.name.toLowerCase().includes(query));
  }, [searchQuery, sortedInventory]);

  const selectedBattery = sortedInventory.find((item) => item.id === selectedBatteryId) || null;

  const openUseModal = () => {
    if (sortedInventory.length === 0) {
      Alert.alert('No Batteries', 'Add batteries to the inventory first.');
      return;
    }
    setSelectedBatteryId(sortedInventory[0]?.id || null);
    setBatteryNote('');
    setSearchQuery('');
    setShowUseModal(true);
  };

  const openManageModal = () => {
    setNewBatteryName('');
    setShowAddSection(false);
    setShowRemoveSection(false);
    setShowManageModal(true);
  };

  const handleAddBatteryUse = async () => {
    if (!selectedBattery) {
      Alert.alert('Select Battery', 'Choose a battery from the inventory.');
      return;
    }

    try {
      const created = await apiService.createBatteryTrackerEntry({
        battery_name: selectedBattery.name,
        note: batteryNote.trim(),
      });
      setEntries((prev) => [created, ...prev]);
      setBatteryNote('');
      setShowUseModal(false);
    } catch (error) {
      console.error('Failed to save battery use:', error);
      Alert.alert('Error', error.message || 'Unable to log battery use.');
    }
  };

  const handleStartTimer = async (entryId) => {
    try {
      const response = await apiService.startBatteryTrackerTimer(entryId);
      setEntries((prev) =>
        prev.map((entry) =>
          entry.id === entryId
            ? {
                ...entry,
                unplugged_at: response.unplugged_at,
                safe_to_plug_at: response.safe_to_plug_at,
              }
            : entry
        )
      );
      setNow(Date.now());
    } catch (error) {
      console.error('Failed to start battery timer:', error);
      Alert.alert('Error', error.message || 'Unable to start timer.');
    }
  };

  const handleMoveBattery = async (index, direction) => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= sortedInventory.length) return;

    const nextInventory = [...sortedInventory];
    [nextInventory[index], nextInventory[targetIndex]] = [nextInventory[targetIndex], nextInventory[index]];
    await persistInventory(nextInventory);
  };

  const handleAddBattery = async () => {
    const trimmedName = newBatteryName.trim();
    if (!trimmedName) {
      Alert.alert('Battery Name Required', 'Enter a battery name to add.');
      return;
    }
    if (sortedInventory.some((item) => item.name.toLowerCase() === trimmedName.toLowerCase())) {
      Alert.alert('Duplicate Battery', 'That battery already exists.');
      return;
    }

    const nextInventory = [
      ...sortedInventory,
      {
        id: `battery_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        name: trimmedName,
        rank: sortedInventory.length + 1,
        created_at: Date.now(),
      },
    ];
    setNewBatteryName('');
    await persistInventory(nextInventory);
  };

  const handleRemoveBattery = async (batteryId) => {
    const confirmed = Platform.OS === 'web'
      ? (typeof window !== 'undefined' ? window.confirm('Remove this battery from the shared list?') : true)
      : true;
    if (!confirmed) return;

    const nextInventory = sortedInventory.filter((item) => item.id !== batteryId);
    await persistInventory(nextInventory);
  };

  const handleClearLog = async () => {
    try {
      await apiService.clearBatteryTrackerEntries();
      setEntries([]);
      setShowClearLogModal(false);
    } catch (error) {
      console.error('Failed to clear battery log:', error);
      Alert.alert('Error', error.message || 'Unable to clear battery log.');
    }
  };

  if (!canViewBatteryTracker) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={[styles.restrictedCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <Ionicons name="flash-off-outline" size={56} color={theme.colors.textSecondary} />
          <Text style={[styles.restrictedTitle, { color: theme.colors.text }]}>Battery Tracker unavailable</Text>
          <Text style={[styles.restrictedText, { color: theme.colors.textSecondary }]}>
            Only drive team accounts can access the battery tracker.
          </Text>
        </View>
      </View>
    );
  }

  const renderHeader = () => (
    <View>
      <View style={[styles.header, { backgroundColor: theme.colors.primary }]}>
        <Text style={styles.headerTitle}>Battery Tracker</Text>
        <Text style={styles.headerSubtitle}>
          Battery usage history
        </Text>
        <TouchableOpacity style={styles.manageButton} onPress={openManageModal}>
          <Ionicons name="options-outline" size={20} color="white" />
          <Text style={styles.useButtonText}>Manage</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.useButton} onPress={openUseModal}>
          <Ionicons name="add" size={20} color="white" />
          <Text style={styles.useButtonText}>Battery Used</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <StatusBar style={theme.colors.statusBar} />

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>Loading batteries...</Text>
        </View>
      ) : (
        <FlatList
          data={sortedEntries}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => {
            const remainingMs = (item.safe_to_plug_at || 0) - now;
            const timerStarted = Boolean(item.unplugged_at);
            const ready = timerStarted && remainingMs <= 0;
            const buttonLabel = ready ? 'Plugged In' : timerStarted ? formatRemaining(remainingMs) : 'Start 30m';

            return (
              <View style={[styles.sectionCard, styles.usageCard, { backgroundColor: theme.colors.surface }]}>
                <View style={[styles.usageRow, { borderBottomColor: 'transparent' }]}>
                  <View style={styles.usageInfo}>
                    <Text style={[styles.usageTitle, { color: theme.colors.text }]}>{item.battery_name}</Text>
                    <Text style={[styles.usageNote, { color: theme.colors.textSecondary }]} numberOfLines={1}>
                      {item.note || 'No note'}
                    </Text>
                  </View>
                  <Text style={[styles.usageMeta, { color: theme.colors.textSecondary }]}>
                    {formatDateTime(item.created_at)}
                  </Text>
                  <TouchableOpacity
                    style={[
                      styles.timerButton,
                      {
                        backgroundColor: ready ? theme.colors.primary : '#dc2626',
                        borderColor: ready ? theme.colors.primary : '#dc2626',
                        opacity: ready ? 0.8 : 1,
                      },
                    ]}
                    onPress={() => handleStartTimer(item.id)}
                    disabled={ready}
                  >
                    <Text style={[styles.timerButtonText, { color: 'white' }]}>
                      {buttonLabel}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          }}
          ListHeaderComponent={renderHeader}
          ListFooterComponent={
            sortedEntries.length > 0 ? (
              <View style={styles.logFooter}>
                <TouchableOpacity
                  style={[styles.clearLogButton, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
                  onPress={() => setShowClearLogModal(true)}
                >
                  <Text style={styles.clearLogButtonText}>Clear Log</Text>
                </TouchableOpacity>
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View style={[styles.emptyState, { backgroundColor: theme.colors.surface }]}>
              <Ionicons name="flash-outline" size={56} color={theme.colors.textSecondary} />
              <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>No battery uses yet</Text>
              <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
                Use `Add Battery` to build the shared list, then log battery uses from `Battery Used`.
              </Text>
            </View>
          }
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        />
      )}

      <Modal visible={showUseModal} animationType="slide" presentationStyle="pageSheet">
        <View style={[styles.modalContainer, { backgroundColor: theme.colors.background }]}>
          <View style={[styles.modalHeader, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Log Battery Used</Text>
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => {
                setShowUseModal(false);
                setSearchQuery('');
                setBatteryNote('');
              }}
            >
              <Ionicons name="close" size={24} color={theme.colors.text} />
            </TouchableOpacity>
          </View>

          <View style={styles.modalContent}>
            <View style={[styles.searchInputContainer, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
              <Ionicons name="search" size={20} color={theme.colors.textSecondary} style={styles.searchIcon} />
              <TextInput
                style={[styles.searchInput, { color: theme.colors.text, outlineStyle: 'none' }]}
                placeholder="Search batteries..."
                placeholderTextColor={theme.colors.textSecondary}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoFocus
              />
            </View>

            <FlatList
              data={filteredInventory}
              keyExtractor={(item) => item.id}
              style={styles.selectionList}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.selectionItem,
                    {
                      backgroundColor: item.id === selectedBatteryId ? `${theme.colors.primary}22` : theme.colors.surface,
                      borderColor: item.id === selectedBatteryId ? theme.colors.primary : theme.colors.border,
                    },
                  ]}
                  onPress={() => setSelectedBatteryId(item.id)}
                >
                  <Text style={[styles.selectionTitle, { color: theme.colors.text }]}>#{item.rank} {item.name}</Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <View style={styles.emptySearchState}>
                  <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>No batteries match your search.</Text>
                </View>
              }
            />

            <TextInput
              style={[
                styles.textArea,
                  {
                    backgroundColor: theme.colors.surface,
                    borderColor: theme.colors.border,
                    color: theme.colors.text,
                    outlineStyle: 'none',
                  },
                ]}
              value={batteryNote}
              onChangeText={setBatteryNote}
              placeholder="Match used, practice, or note"
              placeholderTextColor={theme.colors.textSecondary}
              multiline
            />

            <TouchableOpacity style={[styles.primaryAction, { backgroundColor: theme.colors.primary }]} onPress={handleAddBatteryUse}>
              <Ionicons name="checkmark" size={18} color="white" />
              <Text style={styles.primaryActionText}>Log Battery Use</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showManageModal} animationType="slide" presentationStyle="pageSheet">
        <View style={[styles.modalContainer, { backgroundColor: theme.colors.background }]}>
          <View style={[styles.modalHeader, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Manage Batteries</Text>
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => {
                setShowManageModal(false);
                setNewBatteryName('');
                setShowAddSection(false);
                setShowRemoveSection(false);
              }}
            >
              <Ionicons name="close" size={24} color={theme.colors.text} />
            </TouchableOpacity>
          </View>

          <View style={styles.modalContent}>
            {savingInventory && (
              <Text style={[styles.savingText, { color: theme.colors.textSecondary }]}>Saving battery order...</Text>
            )}
            <FlatList
              data={sortedInventory}
              keyExtractor={(item) => `manage-${item.id}`}
              style={styles.manageList}
              renderItem={({ item, index }) => (
                <View style={[styles.batteryItem, styles.manageBatteryItem, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                  <View style={styles.batteryRank}>
                    <Text style={[styles.rankNumber, { color: theme.colors.primary }]}>#{index + 1}</Text>
                  </View>
                  <View style={styles.batteryInfo}>
                    <Text style={[styles.batteryName, { color: theme.colors.text }]}>{item.name}</Text>
                  </View>
                  <View style={styles.reorderButtons}>
                    <TouchableOpacity
                      style={[
                        styles.moveButton,
                        {
                          opacity: index === 0 ? 0.3 : 1,
                          borderColor: theme.colors.border,
                          backgroundColor: theme.colors.background,
                        },
                      ]}
                      onPress={() => handleMoveBattery(index, 'up')}
                      disabled={index === 0}
                    >
                      <Ionicons name="chevron-up" size={18} color={theme.colors.textSecondary} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.moveButton,
                        {
                          opacity: index === sortedInventory.length - 1 ? 0.3 : 1,
                          borderColor: theme.colors.border,
                          backgroundColor: theme.colors.background,
                        },
                      ]}
                      onPress={() => handleMoveBattery(index, 'down')}
                      disabled={index === sortedInventory.length - 1}
                    >
                      <Ionicons name="chevron-down" size={18} color={theme.colors.textSecondary} />
                    </TouchableOpacity>
                  </View>
                  {showRemoveSection ? (
                    <TouchableOpacity
                      style={[styles.inlineRemoveButton, { borderColor: theme.colors.border, backgroundColor: theme.colors.background }]}
                      onPress={() => handleRemoveBattery(item.id)}
                    >
                      <Ionicons name="add" size={16} color="#dc2626" style={styles.removeIcon} />
                      <Text style={styles.inlineRemoveText}>Remove</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              )}
              ListEmptyComponent={
                <View style={styles.emptySearchState}>
                  <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>No batteries in the list yet.</Text>
                </View>
              }
            />

            {showAddSection ? (
              <View style={styles.bottomActionSection}>
                <TextInput
                  style={[
                    styles.input,
                      {
                        backgroundColor: theme.colors.surface,
                        borderColor: theme.colors.border,
                        color: theme.colors.text,
                        outlineStyle: 'none',
                      },
                    ]}
                  value={newBatteryName}
                  onChangeText={setNewBatteryName}
                  placeholder="Battery name"
                  placeholderTextColor={theme.colors.textSecondary}
                />
                <TouchableOpacity
                  style={[styles.primaryAction, { backgroundColor: theme.colors.primary }]}
                  onPress={handleAddBattery}
                >
                  <Ionicons name="add" size={18} color="white" />
                  <Text style={styles.primaryActionText}>Save Battery</Text>
                </TouchableOpacity>
              </View>
            ) : null}

            <View style={styles.bottomActionRow}>
              <TouchableOpacity
                style={[styles.secondaryAction, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
                onPress={() => {
                  setShowAddSection((prev) => !prev);
                  setShowRemoveSection(false);
                }}
              >
                <Ionicons name="add" size={18} color={theme.colors.text} />
                <Text style={[styles.secondaryActionText, { color: theme.colors.text }]}>
                  {showAddSection ? 'Close Add' : 'Add Battery'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.secondaryAction, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
                onPress={() => {
                  setShowRemoveSection((prev) => !prev);
                  setShowAddSection(false);
                }}
              >
                <Ionicons name="remove" size={18} color={theme.colors.text} />
                <Text style={[styles.secondaryActionText, { color: theme.colors.text }]}>
                  {showRemoveSection ? 'Done Removing' : 'Remove Batteries'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showClearLogModal} animationType="fade" transparent>
        <View style={styles.confirmOverlay}>
          <View style={[styles.confirmCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <Text style={[styles.confirmTitle, { color: theme.colors.text }]}>Clear Battery Log?</Text>
            <Text style={[styles.confirmText, { color: theme.colors.textSecondary }]}>
              This removes every battery usage entry for the whole drive team.
            </Text>
            <View style={styles.confirmActions}>
              <TouchableOpacity
                style={[styles.confirmButton, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}
                onPress={() => setShowClearLogModal(false)}
              >
                <Text style={[styles.confirmButtonText, { color: theme.colors.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmButton, styles.confirmDestructiveButton]}
                onPress={handleClearLog}
              >
                <Text style={styles.confirmDestructiveText}>Clear Log</Text>
              </TouchableOpacity>
            </View>
          </View>
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
    marginBottom: 12,
    position: 'relative',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: 'white',
  },
  headerSubtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 8,
  },
  useButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 40 : 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  manageButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 40 : 20,
    right: 174,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  useButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '700',
  },
  contentContainer: {
    paddingBottom: 40,
  },
  sectionCard: {
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 12,
    padding: 16,
    ...platformUtils.getPlatformElevation(1),
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  sectionSubtitle: {
    fontSize: 13,
    marginTop: 6,
    marginBottom: 10,
  },
  savingText: {
    fontSize: 12,
    marginBottom: 10,
  },
  usageCard: {
    marginBottom: 10,
  },
  batteryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 10,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  batteryRank: {
    width: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankNumber: {
    fontSize: 16,
    fontWeight: '700',
  },
  batteryInfo: {
    flex: 1,
    paddingRight: 12,
  },
  batteryName: {
    fontSize: 15,
    fontWeight: '700',
  },
  reorderButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  moveButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  usageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  usageInfo: {
    flex: 1.2,
    paddingRight: 10,
  },
  usageTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  usageNote: {
    fontSize: 12,
    marginTop: 2,
  },
  usageMeta: {
    width: 96,
    fontSize: 11,
    textAlign: 'right',
    marginRight: 10,
  },
  timerButton: {
    minWidth: 90,
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerButtonText: {
    fontSize: 12,
    fontWeight: '700',
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 14,
    marginBottom: 10,
    outlineWidth: 0,
    outlineStyle: 'none',
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 14,
    minHeight: 84,
    textAlignVertical: 'top',
    marginTop: 12,
    outlineWidth: 0,
    outlineStyle: 'none',
  },
  primaryAction: {
    marginTop: 12,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  primaryActionText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '700',
  },
  bottomActionSection: {
    marginTop: 16,
  },
  bottomActionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  logFooter: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 20,
  },
  clearLogButton: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearLogButtonText: {
    color: '#dc2626',
    fontSize: 14,
    fontWeight: '700',
  },
  secondaryAction: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  secondaryActionText: {
    fontSize: 14,
    fontWeight: '700',
  },
  manageList: {
    flex: 1,
  },
  manageBatteryItem: {
    marginHorizontal: 0,
  },
  inlineRemoveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginLeft: 10,
    gap: 4,
  },
  inlineRemoveText: {
    color: '#dc2626',
    fontSize: 13,
    fontWeight: '700',
  },
  removeIcon: {
    transform: [{ rotate: '45deg' }],
  },
  emptyState: {
    marginHorizontal: 20,
    marginTop: 8,
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 10,
  },
  emptyText: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
    textAlign: 'center',
  },
  modalContainer: {
    flex: 1,
  },
  confirmOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  confirmCard: {
    width: '100%',
    maxWidth: 420,
    borderWidth: 1,
    borderRadius: 16,
    padding: 20,
  },
  confirmTitle: {
    fontSize: 22,
    fontWeight: '700',
  },
  confirmText: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 10,
  },
  confirmActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 20,
  },
  confirmButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  confirmDestructiveButton: {
    backgroundColor: '#dc2626',
    borderColor: '#dc2626',
  },
  confirmDestructiveText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '700',
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
    flex: 1,
    padding: 20,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    marginBottom: 14,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    height: 48,
    fontSize: 15,
    outlineWidth: 0,
    outlineStyle: 'none',
  },
  selectionList: {
    flexGrow: 0,
    maxHeight: 320,
  },
  selectionItem: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
  },
  selectionTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  emptySearchState: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
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
