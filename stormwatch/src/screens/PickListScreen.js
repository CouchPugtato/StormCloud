import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Modal,
  FlatList,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth, USER_ROLES } from '../contexts/AuthContext';
import apiService from '../utils/apiService';

const LIST_TYPE = {
  FIRST: 'first',
  SECOND: 'second',
};

const LIST_EVENT_KEY = {
  [LIST_TYPE.FIRST]: 'pick_list_first',
  [LIST_TYPE.SECOND]: 'pick_list_second',
};

const EMPTY_LISTS = {
  [LIST_TYPE.FIRST]: [],
  [LIST_TYPE.SECOND]: [],
};

const EMPTY_NOTES = {
  [LIST_TYPE.FIRST]: {},
  [LIST_TYPE.SECOND]: {},
};

const EMPTY_STRUCK = {
  [LIST_TYPE.FIRST]: new Set(),
  [LIST_TYPE.SECOND]: new Set(),
};

const listTitle = (listType) => (listType === LIST_TYPE.FIRST ? 'First Pick' : 'Second Pick');

const mapItemsFromServer = (items = []) => {
  const list = items.map((it) => ({
    id: it.team_num,
    name: it.name || it.TeamName || `Team ${it.team_num}`,
    location: it.city && it.state ? `${it.city}, ${it.state}` : '',
    teamKey: it.team_key,
  }));

  const notes = {};
  const struck = new Set();
  items.forEach((it) => {
    notes[it.team_num] = it.notes || '';
    if (it.struck_through) struck.add(it.team_num);
  });

  return { list, notes, struck };
};

export default function PickListScreen() {
  const { theme } = useTheme();
  const { user } = useAuth();

  const [activeListType, setActiveListType] = useState(LIST_TYPE.FIRST);
  const [lists, setLists] = useState(EMPTY_LISTS);
  const [teamNotes, setTeamNotes] = useState(EMPTY_NOTES);
  const [unsavedNotes, setUnsavedNotes] = useState(EMPTY_NOTES);
  const [struckThroughTeams, setStruckThroughTeams] = useState(EMPTY_STRUCK);

  const [showAddModal, setShowAddModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [availableTeams, setAvailableTeams] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState(null);

  const currentList = lists[activeListType];
  const currentNotes = teamNotes[activeListType];
  const currentUnsavedNotes = unsavedNotes[activeListType];
  const currentStruck = struckThroughTeams[activeListType];
  const canViewPickList = user?.role && user.role !== USER_ROLES.VIEWER;

  const persistList = async (listType, listData, notesData, struckData) => {
    try {
      const items = listData.map((team, index) => ({
        team_key: team.teamKey || `frc${team.id}`,
        team_num: team.id,
        rank: index + 1,
        notes: notesData[team.id] || '',
        struck_through: struckData.has(team.id),
      }));

      await apiService.savePickList(LIST_EVENT_KEY[listType], items);
    } catch (err) {
      console.error(`Failed to save ${listTitle(listType)} list:`, err);
      Alert.alert('Save Failed', `Could not save ${listTitle(listType)} list to server.`);
    }
  };

  useEffect(() => {
    const loadPickLists = async () => {
      try {
        const [firstItems, secondItems] = await Promise.all([
          apiService.getPickList(LIST_EVENT_KEY[LIST_TYPE.FIRST]),
          apiService.getPickList(LIST_EVENT_KEY[LIST_TYPE.SECOND]),
        ]);

        const first = mapItemsFromServer(firstItems);
        const second = mapItemsFromServer(secondItems);

        setLists({
          [LIST_TYPE.FIRST]: first.list,
          [LIST_TYPE.SECOND]: second.list,
        });

        setTeamNotes({
          [LIST_TYPE.FIRST]: first.notes,
          [LIST_TYPE.SECOND]: second.notes,
        });

        setUnsavedNotes(EMPTY_NOTES);

        setStruckThroughTeams({
          [LIST_TYPE.FIRST]: first.struck,
          [LIST_TYPE.SECOND]: second.struck,
        });
      } catch (err) {
        console.error('Failed to load pick lists:', err);
      }
    };

    loadPickLists();
  }, []);

  useEffect(() => {
    if (showAddModal && availableTeams.length === 0) {
      fetchTeams();
    }
  }, [showAddModal]);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setSearchResults([]);
      setSearching(false);
      return;
    }

    const searchTeams = async () => {
      try {
        setSearching(true);
        setError(null);
        const results = await apiService.searchTeams(searchQuery);
        setSearchResults(results || []);
      } catch (err) {
        console.error('Search failed:', err);
        setError('Search failed. Please try again.');
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    };

    const timeoutId = setTimeout(searchTeams, 300);
    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  const fetchTeams = async () => {
    try {
      setLoading(true);
      setError(null);
      const teams = await apiService.getAllTeams();
      setAvailableTeams(teams || []);
    } catch (err) {
      console.error('Failed to fetch teams:', err);
      setError('Failed to load teams. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const filteredTeams = useMemo(() => {
    const sourceTeams = searchQuery.trim() !== '' ? searchResults : availableTeams;
    return sourceTeams || [];
  }, [searchQuery, searchResults, availableTeams]);

  const isInList = (teamId, listType) => lists[listType].some((team) => team.id === teamId);

  const addTeamToPickList = (rawTeam, listType) => {
    const teamNumber = rawTeam.team_num || rawTeam.id;
    if (!teamNumber || isInList(teamNumber, listType)) return;

    const teamName = rawTeam.name || `Team ${teamNumber}`;
    const teamLocation = rawTeam.city && rawTeam.state
      ? `${rawTeam.city}, ${rawTeam.state}`
      : rawTeam.location || '';

    const team = {
      id: teamNumber,
      name: teamName,
      location: teamLocation,
      teamKey: rawTeam.team_key || `frc${teamNumber}`,
    };

    const updatedList = [...lists[listType], team];
    const updatedLists = { ...lists, [listType]: updatedList };
    setLists(updatedLists);

    persistList(listType, updatedList, teamNotes[listType], struckThroughTeams[listType]);
  };

  const removeTeamFromPickList = (teamId, listType) => {
    const updatedList = lists[listType].filter((team) => team.id !== teamId);

    const updatedNotes = { ...teamNotes[listType] };
    delete updatedNotes[teamId];

    const updatedUnsavedNotes = { ...unsavedNotes[listType] };
    delete updatedUnsavedNotes[teamId];

    const updatedStruck = new Set(struckThroughTeams[listType]);
    updatedStruck.delete(teamId);

    setLists((prev) => ({ ...prev, [listType]: updatedList }));
    setTeamNotes((prev) => ({ ...prev, [listType]: updatedNotes }));
    setUnsavedNotes((prev) => ({ ...prev, [listType]: updatedUnsavedNotes }));
    setStruckThroughTeams((prev) => ({ ...prev, [listType]: updatedStruck }));

    persistList(listType, updatedList, updatedNotes, updatedStruck);
  };

  const updateTeamNotes = (teamId, notes, listType) => {
    setUnsavedNotes((prev) => ({
      ...prev,
      [listType]: { ...prev[listType], [teamId]: notes },
    }));
  };

  const saveTeamNotes = (teamId, listType) => {
    const notes = unsavedNotes[listType][teamId];
    if (notes === undefined) return;

    const updatedNotes = { ...teamNotes[listType], [teamId]: notes };
    const updatedUnsaved = { ...unsavedNotes[listType] };
    delete updatedUnsaved[teamId];

    setTeamNotes((prev) => ({ ...prev, [listType]: updatedNotes }));
    setUnsavedNotes((prev) => ({ ...prev, [listType]: updatedUnsaved }));

    persistList(listType, lists[listType], updatedNotes, struckThroughTeams[listType]);
  };

  const toggleStrikethrough = (teamId, listType) => {
    const updatedStruck = new Set(struckThroughTeams[listType]);
    if (updatedStruck.has(teamId)) {
      updatedStruck.delete(teamId);
    } else {
      updatedStruck.add(teamId);
    }

    setStruckThroughTeams((prev) => ({ ...prev, [listType]: updatedStruck }));
    persistList(listType, lists[listType], teamNotes[listType], updatedStruck);
  };

  const getHighlightedTeamIndex = (listType) => lists[listType].findIndex((team) => !struckThroughTeams[listType].has(team.id));

  const moveTeam = (index, direction, listType) => {
    const list = lists[listType];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= list.length) return;

    const updatedList = [...list];
    [updatedList[index], updatedList[targetIndex]] = [updatedList[targetIndex], updatedList[index]];

    setLists((prev) => ({ ...prev, [listType]: updatedList }));
    persistList(listType, updatedList, teamNotes[listType], struckThroughTeams[listType]);
  };

  const renderHeader = () => (
    <View>
      <View style={[styles.header, { backgroundColor: theme.colors.primary }]}>
        <Text style={styles.headerTitle}>Pick List</Text>
        <Text style={styles.headerSubtitle}>
          {currentList.length} teams being considered
        </Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setShowAddModal(true)}
        >
          <Ionicons name="add" size={24} color="white" />
          <Text style={styles.addButtonText}>Add Teams</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.listTypeTabs, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity
          style={[
            styles.listTypeTab,
            activeListType === LIST_TYPE.FIRST && { backgroundColor: theme.colors.primary },
          ]}
          onPress={() => setActiveListType(LIST_TYPE.FIRST)}
        >
          <Text
            style={[
              styles.listTypeTabText,
              { color: activeListType === LIST_TYPE.FIRST ? 'white' : theme.colors.text },
            ]}
          >
            First Pick
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.listTypeTab,
            activeListType === LIST_TYPE.SECOND && { backgroundColor: theme.colors.primary },
          ]}
          onPress={() => setActiveListType(LIST_TYPE.SECOND)}
        >
          <Text
            style={[
              styles.listTypeTabText,
              { color: activeListType === LIST_TYPE.SECOND ? 'white' : theme.colors.text },
            ]}
          >
            Second Pick
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderPickListItem = ({ item: team, index }) => {
    const isHighlighted = index === getHighlightedTeamIndex(activeListType);
    const isStruck = currentStruck.has(team.id);
    const unsavedValue = currentUnsavedNotes[team.id];
    const savedValue = currentNotes[team.id] || '';

    return (
      <View
        style={[
          styles.pickListItem,
          {
            backgroundColor: isHighlighted ? `${theme.colors.primary}25` : (isStruck ? `${theme.colors.textSecondary}10` : theme.colors.surface),
            borderColor: isHighlighted ? theme.colors.primary : theme.colors.border,
            borderWidth: isHighlighted ? 3 : 1,
            opacity: isStruck ? 0.6 : 1,
          },
        ]}
      >
        <View style={styles.pickListHeader}>
          <View style={styles.pickListRank}>
            <Text style={[styles.rankNumber, { color: isHighlighted ? theme.colors.primary : theme.colors.text }]}>#{index + 1}</Text>
          </View>

          <View style={styles.teamInfo}>
            <Text style={[styles.teamNumber, { color: theme.colors.text, textDecorationLine: isStruck ? 'line-through' : 'none' }]}>
              {team.id} - {team.name}
            </Text>
          </View>

          <View style={styles.reorderButtons}>
            <TouchableOpacity
              style={[styles.moveButton, { opacity: index === 0 ? 0.3 : 1 }]}
              onPress={() => moveTeam(index, 'up', activeListType)}
              disabled={index === 0}
            >
              <Ionicons name="chevron-up" size={18} color={theme.colors.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.moveButton, { opacity: index === currentList.length - 1 ? 0.3 : 1 }]}
              onPress={() => moveTeam(index, 'down', activeListType)}
              disabled={index === currentList.length - 1}
            >
              <Ionicons name="chevron-down" size={18} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.strikethroughButton}
            onPress={() => toggleStrikethrough(team.id, activeListType)}
          >
            <Ionicons
              name={isStruck ? 'remove' : 'remove-outline'}
              size={20}
              color={isStruck ? theme.colors.primary : theme.colors.textSecondary}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.removeButton}
            onPress={() => removeTeamFromPickList(team.id, activeListType)}
          >
            <Ionicons name="close" size={20} color="#ff4444" />
          </TouchableOpacity>
        </View>

        <View style={styles.notesSection}>
          <Text style={[styles.notesLabel, { color: theme.colors.text }]}>Notes ({listTitle(activeListType)}):</Text>
          <TextInput
            style={[
              styles.notesInput,
              {
                backgroundColor: theme.colors.background,
                borderColor: theme.colors.border,
                color: theme.colors.text,
              },
            ]}
            placeholder="Add strategic notes about this team..."
            placeholderTextColor={theme.colors.textSecondary}
            value={unsavedValue !== undefined ? unsavedValue : savedValue}
            onChangeText={(text) => updateTeamNotes(team.id, text, activeListType)}
            multiline
            numberOfLines={3}
            selectionColor={theme.colors.textSecondary}
          />

          {unsavedValue !== undefined && unsavedValue !== savedValue && (
            <TouchableOpacity
              style={[styles.saveButton, { backgroundColor: theme.colors.primary }]}
              onPress={() => saveTeamNotes(team.id, activeListType)}
            >
              <Ionicons name="checkmark" size={16} color="white" />
              <Text style={styles.saveButtonText}>Save Notes</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  const renderEmptyState = () => (
    <View style={[styles.emptyState, { backgroundColor: theme.colors.surface }]}>
      <Ionicons name="list-outline" size={64} color={theme.colors.textSecondary} />
      <Text style={[styles.emptyStateTitle, { color: theme.colors.text }]}>{listTitle(activeListType)} list is empty</Text>
      <Text style={[styles.emptyStateText, { color: theme.colors.textSecondary }]}>Tap "Add Teams" to start ranking teams for this list.</Text>
    </View>
  );

  const renderTeamSearchItem = ({ item }) => {
    const teamNumber = item.team_num || item.id;
    const teamName = item.name || `Team ${teamNumber}`;
    const teamLocation = item.city && item.state ? `${item.city}, ${item.state}` : item.location || 'Location not available';
    const inActiveList = isInList(teamNumber, activeListType);

    return (
      <View style={[styles.teamItem, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
        <View style={styles.teamItemInfo}>
          <Text style={[styles.teamItemNumber, { color: theme.colors.text }]}>{teamNumber} - {teamName}</Text>
          <Text style={[styles.teamItemLocation, { color: theme.colors.textSecondary }]}>{teamLocation}</Text>
        </View>

        <TouchableOpacity
          style={[
            styles.addTeamButton,
            { backgroundColor: inActiveList ? theme.colors.border : theme.colors.primary },
          ]}
          disabled={inActiveList}
          onPress={() => addTeamToPickList(item, activeListType)}
        >
          <Ionicons
            name={inActiveList ? 'checkmark' : 'add'}
            size={20}
            color={inActiveList ? theme.colors.textSecondary : 'white'}
          />
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <StatusBar style={theme.colors.statusBar} />

      {!canViewPickList ? (
        <View style={[styles.restrictedState, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <Ionicons name="lock-closed-outline" size={56} color={theme.colors.textSecondary} />
          <Text style={[styles.restrictedTitle, { color: theme.colors.text }]}>Pick List unavailable</Text>
          <Text style={[styles.restrictedText, { color: theme.colors.textSecondary }]}>
            Viewers cannot access the pick list. A scouting lead can upgrade your account when needed.
          </Text>
        </View>
      ) : (
        <>

          <FlatList
            data={currentList}
            keyExtractor={(item) => `${activeListType}-${item.id}`}
            renderItem={renderPickListItem}
            ListHeaderComponent={renderHeader}
            ListEmptyComponent={renderEmptyState}
            contentContainerStyle={styles.contentContainer}
            style={styles.content}
            showsVerticalScrollIndicator={false}
          />

          <Modal
            visible={showAddModal}
            animationType="slide"
            presentationStyle="pageSheet"
          >
            <View style={[styles.modalContainer, { backgroundColor: theme.colors.background }]}>
              <View style={[styles.modalHeader, { backgroundColor: theme.colors.surface }]}> 
                <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Add Teams to {listTitle(activeListType)}</Text>
                <TouchableOpacity
                  style={styles.modalCloseButton}
                  onPress={() => {
                    setShowAddModal(false);
                    setSearchQuery('');
                    setSearchResults([]);
                    setError(null);
                    setSearching(false);
                  }}
                >
                  <Ionicons name="close" size={24} color={theme.colors.text} />
                </TouchableOpacity>
              </View>

              <View style={styles.searchContainer}>
                <View style={[styles.searchInputContainer, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}> 
                  <Ionicons name="search" size={20} color={theme.colors.textSecondary} style={styles.searchIcon} />
                  <TextInput
                    style={[styles.searchInput, { color: theme.colors.text }]}
                    placeholder="Search teams by name or number..."
                    placeholderTextColor={theme.colors.textSecondary}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    autoFocus
                    selectionColor={theme.colors.textSecondary}
                  />
                </View>
              </View>

              {loading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color={theme.colors.primary} />
                  <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>Loading teams...</Text>
                </View>
              ) : (
                <FlatList
                  data={filteredTeams}
                  keyExtractor={(item) => String(item.team_num || item.id)}
                  style={styles.teamsList}
                  renderItem={renderTeamSearchItem}
                  ListEmptyComponent={
                    <View style={styles.emptySearchState}>
                      {searching ? (
                        <>
                          <ActivityIndicator size="large" color={theme.colors.primary} />
                          <Text style={[styles.emptySearchText, { color: theme.colors.textSecondary }]}>Searching...</Text>
                        </>
                      ) : error ? (
                        <>
                          <Ionicons name="alert-circle-outline" size={48} color={theme.colors.textSecondary} />
                          <Text style={[styles.emptySearchText, { color: theme.colors.textSecondary }]}>{error}</Text>
                          <TouchableOpacity
                            style={[styles.retryButton, { backgroundColor: theme.colors.primary }]}
                            onPress={() => (searchQuery.trim() !== '' ? null : fetchTeams())}
                          >
                            <Text style={styles.retryButtonText}>Retry</Text>
                          </TouchableOpacity>
                        </>
                      ) : (
                        <>
                          <Ionicons name="search-outline" size={48} color={theme.colors.textSecondary} />
                          <Text style={[styles.emptySearchText, { color: theme.colors.textSecondary }]}>
                            {searchQuery ? 'No teams found matching your search' : 'Start typing to search for teams'}
                          </Text>
                        </>
                      )}
                    </View>
                  }
                />
              )}
            </View>
          </Modal>
        </>
      )}
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
    textAlign: 'left',
  },
  headerSubtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'left',
    marginTop: 8,
  },
  addButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 40 : 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  addButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
  },
  listTypeTabs: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 16,
    padding: 4,
    borderRadius: 10,
    borderWidth: 1,
  },
  listTypeTab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 8,
  },
  listTypeTabText: {
    fontSize: 14,
    fontWeight: '700',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 20,
  },
  restrictedState: {
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
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    borderRadius: 12,
    marginBottom: 20,
    marginHorizontal: 20,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyStateText: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
  pickListItem: {
    borderRadius: 12,
    marginBottom: 16,
    marginHorizontal: 20,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  pickListHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  pickListRank: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  rankNumber: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  teamInfo: {
    flex: 1,
  },
  teamNumber: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  reorderButtons: {
    flexDirection: 'column',
    marginRight: 8,
  },
  moveButton: {
    padding: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(128, 128, 128, 0.1)',
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 2,
  },
  strikethroughButton: {
    padding: 8,
    borderRadius: 14,
    backgroundColor: 'rgba(128, 128, 128, 0.15)',
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  removeButton: {
    padding: 8,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 68, 68, 0.1)',
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notesSection: {
    marginTop: 8,
  },
  notesLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  notesInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    textAlignVertical: 'top',
    minHeight: 80,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 8,
  },
  saveButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
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
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  modalCloseButton: {
    padding: 8,
  },
  searchContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
  },
  teamsList: {
    flex: 1,
    paddingHorizontal: 20,
  },
  teamItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
  },
  teamItemInfo: {
    flex: 1,
    marginRight: 10,
  },
  teamItemNumber: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  teamItemLocation: {
    fontSize: 12,
    marginTop: 4,
  },
  addTeamButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptySearchState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptySearchText: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    fontSize: 16,
    marginTop: 16,
    textAlign: 'center',
  },
  retryButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 16,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});
