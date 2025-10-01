import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  FlatList,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import apiService from '../utils/apiService';

export default function PickListScreen({ navigation }) {
  const { theme, isDarkMode } = useTheme();
  const [pickList, setPickList] = useState([]);
  const [teamNotes, setTeamNotes] = useState({});
  const [unsavedNotes, setUnsavedNotes] = useState({});
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [struckThroughTeams, setStruckThroughTeams] = useState(new Set());
  const [availableTeams, setAvailableTeams] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState(null);

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
        setSearchResults(results);
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
      setAvailableTeams(teams);
    } catch (err) {
      console.error('Failed to fetch teams:', err);
      setError('Failed to load teams. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // filter teams based on search query and exclude already picked teams
  const filteredTeams = (() => {
    const sourceTeams = searchQuery.trim() !== '' ? searchResults : availableTeams;
    return sourceTeams.filter(team => {
      const teamId = team.team_num || team.id;
      const notInPickList = !pickList.find(pickedTeam => {
        const pickedTeamId = pickedTeam.team_num || pickedTeam.id;
        return pickedTeamId === teamId;
      });
      return notInPickList;
    });
  })();

  // add team to pick list
  const addTeamToPickList = (team) => {
    setPickList(prev => [...prev, team]);
    setShowAddModal(false);
    setSearchQuery('');
  };

  // remove team from pick list
  const removeTeamFromPickList = (teamId) => {
    console.log('Removing team with ID:', teamId);
    setPickList(prev => {
      const newList = prev.filter(team => team.id !== teamId);
      console.log('New pick list:', newList);
      return newList;
    });
    setTeamNotes(prev => {
      const newNotes = { ...prev };
      delete newNotes[teamId];
      return newNotes;
    });
  };

  // update team notes (temporary storage)
  const updateTeamNotes = (teamId, notes) => {
    setUnsavedNotes(prev => ({ ...prev, [teamId]: notes }));
  };

  // save team notes
  const saveTeamNotes = (teamId) => {
    const notes = unsavedNotes[teamId];
    if (notes !== undefined) {
      setTeamNotes(prev => ({ ...prev, [teamId]: notes }));
      setUnsavedNotes(prev => {
        const newUnsaved = { ...prev };
        delete newUnsaved[teamId];
        return newUnsaved;
      });
    }
  };

  // toggle strikethrough
  const toggleStrikethrough = (teamId) => {
    setStruckThroughTeams(prev => {
      const newSet = new Set(prev);
      if (newSet.has(teamId)) {
        newSet.delete(teamId);
      } else {
        newSet.add(teamId);
      }
      return newSet;
    });
  };

  // top open team is highlighted
  const getHighlightedTeamIndex = () => {
    return pickList.findIndex(team => !struckThroughTeams.has(team.id));
  };

  const moveTeamUp = (index) => {
    if (index > 0) {
      setPickList(prev => {
        const newList = [...prev];
        [newList[index - 1], newList[index]] = [newList[index], newList[index - 1]];
        return newList;
      });
    }
  };

  const moveTeamDown = (index) => {
    if (index < pickList.length - 1) {
      setPickList(prev => {
        const newList = [...prev];
        [newList[index], newList[index + 1]] = [newList[index + 1], newList[index]];
        return newList;
      });
    }
  };

  const renderHeader = () => (
    <LinearGradient
      colors={isDarkMode ? [theme.colors.primary, '#FF6B6B'] : ['#2196F3', '#1976D2']}
      style={styles.header}
    >
      <Text style={styles.headerTitle}>Pick List</Text>
      <Text style={styles.headerSubtitle}>
        Strategic Team Selection & Rankings
      </Text>
      <TouchableOpacity
        style={styles.addButton}
        onPress={() => setShowAddModal(true)}
      >
        <Ionicons name="add" size={24} color="white" />
        <Text style={styles.addButtonText}>Add Teams</Text>
      </TouchableOpacity>
    </LinearGradient>
  );

  const renderPickListItem = ({ item: team, index }) => {
    const isHighlighted = index === getHighlightedTeamIndex();
    const isStruckThrough = struckThroughTeams.has(team.id);
    return (
      <View
        style={[
          styles.pickListItem,
          {
            backgroundColor: isHighlighted ? `${theme.colors.primary}25` : (isStruckThrough ? `${theme.colors.textSecondary}10` : theme.colors.surface),
            borderColor: isHighlighted ? theme.colors.primary : theme.colors.border,
            borderWidth: isHighlighted ? 3 : 1,
            opacity: isStruckThrough ? 0.6 : 1,
          }
        ]}
      >
        <View style={styles.pickListHeader}>
          <View style={styles.pickListRank}>
            <Text style={[styles.rankNumber, { color: isHighlighted ? theme.colors.primary : theme.colors.text }]}>
              #{index + 1}
            </Text>
          </View>
          <View style={styles.teamInfo}>
            <Text style={[styles.teamNumber, { color: theme.colors.text, textDecorationLine: isStruckThrough ? 'line-through' : 'none' }]}>{team.id} - {team.name}</Text>
          </View>
          <View style={styles.reorderButtons}>
            <TouchableOpacity
              style={[styles.moveButton, { opacity: index === 0 ? 0.3 : 1 }]}
              onPress={() => moveTeamUp(index)}
              activeOpacity={0.7}
              disabled={index === 0}
            >
              <Ionicons name="chevron-up" size={18} color={theme.colors.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.moveButton, { opacity: index === pickList.length - 1 ? 0.3 : 1 }]}
              onPress={() => moveTeamDown(index)}
              activeOpacity={0.7}
              disabled={index === pickList.length - 1}
            >
              <Ionicons name="chevron-down" size={18} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={styles.strikethroughButton}
            onPress={() => toggleStrikethrough(team.id)}
            activeOpacity={0.7}
          >
            <Ionicons name={isStruckThrough ? "remove" : "remove-outline"} size={20} color={isStruckThrough ? theme.colors.primary : theme.colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.removeButton}
            onPress={() => removeTeamFromPickList(team.id)}
            activeOpacity={0.7}
          >
            <Ionicons name="close" size={20} color="#ff4444" />
          </TouchableOpacity>
        </View>
        <View style={styles.notesSection}>
          <Text style={[styles.notesLabel, { color: theme.colors.text }]}>Notes:</Text>
          <TextInput
            style={[
              styles.notesInput,
              {
                backgroundColor: theme.colors.background,
                borderColor: theme.colors.border,
                color: theme.colors.text,
              }
            ]}
            placeholder="Add strategic notes about this team..."
            placeholderTextColor={theme.colors.textSecondary}
            value={unsavedNotes[team.id] !== undefined ? unsavedNotes[team.id] : (teamNotes[team.id] || '')}
            onChangeText={(text) => updateTeamNotes(team.id, text)}
            multiline
            numberOfLines={3}
            selectionColor={theme.colors.textSecondary}
          />
          {unsavedNotes[team.id] !== undefined && unsavedNotes[team.id] !== teamNotes[team.id] && (
            <TouchableOpacity
              style={[styles.saveButton, { backgroundColor: theme.colors.primary }]}
              onPress={() => saveTeamNotes(team.id)}
              activeOpacity={0.7}
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
      <Text style={[styles.emptyStateTitle, { color: theme.colors.text }]}>Your Pick List is Empty</Text>
      <Text style={[styles.emptyStateText, { color: theme.colors.textSecondary }]}>
        Tap the "Add Teams" button to start building your strategic pick list for alliance selection.
      </Text>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <StatusBar style={theme.colors.statusBar} />
      
      <FlatList
        data={pickList}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderPickListItem}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmptyState}
        contentContainerStyle={styles.contentContainer}
        style={styles.content}
        showsVerticalScrollIndicator={false}
      />

        {/* Add Teams Modal */}
        <Modal
          visible={showAddModal}
          animationType="slide"
          presentationStyle="pageSheet"
        >
          <View style={[styles.modalContainer, { backgroundColor: theme.colors.background }]}>
            <View style={[styles.modalHeader, { backgroundColor: theme.colors.surface }]}>
              <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Add Teams</Text>
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
                keyExtractor={(item) => (item.team_num || item.id).toString()}
                style={styles.teamsList}
                renderItem={({ item }) => {
                  const teamNumber = item.team_num || item.id;
                  const teamName = item.name;
                  const teamLocation = item.city && item.state 
                    ? `${item.city}, ${item.state}` 
                    : item.location || 'Location not available';
                  
                  return (
                    <View style={[styles.teamItem, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                      <View style={styles.teamItemInfo}>
                        <Text style={[styles.teamItemNumber, { color: theme.colors.text }]}>{teamNumber} - {teamName}</Text>
                        <Text style={[styles.teamItemLocation, { color: theme.colors.textSecondary }]}>{teamLocation}</Text>
                      </View>
                      <TouchableOpacity
                        style={[styles.addTeamButton, { backgroundColor: theme.colors.primary }]}
                        onPress={() => addTeamToPickList({
                          ...item,
                          id: teamNumber,
                          name: teamName,
                          location: teamLocation
                        })}
                      >
                        <Ionicons name="add" size={20} color="white" />
                      </TouchableOpacity>
                    </View>
                  );
                }}
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
                          onPress={() => searchQuery.trim() !== '' ? null : fetchTeams()}
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
      </View>
    );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: 20,
    paddingBottom: 20,
    paddingHorizontal: 20,
    marginBottom: 20,
    position: 'relative',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: 'white',
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    marginTop: 8,
  },
  addButton: {
    position: 'absolute',
    top: 20,
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
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 20,
  },
  pickListContainer: {
    flex: 1,
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
    shadowOffset: {
      width: 0,
      height: 2,
    },
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
  teamLocation: {
    fontSize: 14,
    marginTop: 4,
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
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingTop: 60,
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
        shadowColor: '#000',
        shadowOffset: {
          width: 0,
          height: 1,
        },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
      },
   saveButton: {
     flexDirection: 'row',
     alignItems: 'center',
     justifyContent: 'center',
     paddingHorizontal: 12,
     paddingVertical: 8,
     borderRadius: 8,
     marginTop: 8,
     shadowColor: '#000',
     shadowOffset: {
       width: 0,
       height: 1,
     },
     shadowOpacity: 0.1,
     shadowRadius: 2,
     elevation: 2,
   },
   saveButtonText: {
     color: 'white',
     fontSize: 14,
     fontWeight: '600',
     marginLeft: 4,
   },
});