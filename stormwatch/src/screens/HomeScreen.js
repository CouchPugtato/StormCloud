import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Dimensions,
  FlatList,
  TextInput,
  Alert,
  ActivityIndicator,
  Modal,
  Pressable,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { useEventMode } from '../contexts/EventModeContext';
import apiService from '../utils/apiService';
import { calculateWinProbability, formatEPA, formatWinProbability } from '../utils/epaCalculations';
import TwitchStream from '../components/TwitchStream';

const { width, height } = Dimensions.get('window');
const isMobile = height > width; // mobile devices have height > width

export default function HomeScreen({ navigation }) {
  const { theme } = useTheme();
  const { user } = useAuth();
  const { isEventMode } = useEventMode();
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [expandedMatch, setExpandedMatch] = useState(null);
  const [matchNotes, setMatchNotes] = useState({});
  const [currentNote, setCurrentNote] = useState('');
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [matchesLoading, setMatchesLoading] = useState(false);
  const [epaData, setEpaData] = useState({});
  const [winProbabilities, setWinProbabilities] = useState({});
  const [eventDropdownOpen, setEventDropdownOpen] = useState(false);
  const [currentMatches, setCurrentMatches] = useState([]);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const eventsData = await apiService.getEvents();
      const transformedEvents = eventsData.map(event => ({
        key: event.event_key,
        name: event.name,
      }));
      setEvents(transformedEvents);

      if (transformedEvents.length === 0) {
        setSelectedEvent(null);
        setCurrentMatches([]);
        setEpaData({});
        setWinProbabilities({});
        return;
      }

      const activeEventStillExists = transformedEvents.some((event) => event.key === selectedEvent);
      const nextEventKey = activeEventStillExists ? selectedEvent : transformedEvents[0].key;
      if (nextEventKey !== selectedEvent) {
        setSelectedEvent(nextEventKey);
      } else {
        await fetchMatchesForEvent(nextEventKey);
      }
    } catch (error) {
      console.error('Failed to fetch events:', error);
      Alert.alert('Error', 'Failed to load events. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const fetchMatchesForEvent = async (eventKey) => {
    if (!eventKey) {
      setCurrentMatches([]);
      setEpaData({});
      setWinProbabilities({});
      return;
    }

    try {
      setMatchesLoading(true);
      setCurrentMatches([]);
      setEpaData({});
      setWinProbabilities({});
      const matchesData = await apiService.getEventMatches(eventKey);

      const getCompLevelRank = (level) => {
        switch ((level || '').toLowerCase()) {
          case 'qm':
            return 1;
          case 'ef':
            return 2;
          case 'qf':
            return 3;
          case 'sf':
            return 4;
          case 'f':
            return 99; // force finals to bottom
          default:
            return 50;
        }
      };

      const usesDoubleElimination = matchesData.some((match) => {
        const level = (match.comp_level || '').toLowerCase();
        const setNum = Number(match.set_number || 0);
        return level === 'sf' && setNum > 2;
      });

      const getMatchDisplayLabel = (match) => {
        const level = (match.comp_level || '').toLowerCase();
        const setNum = Number(match.set_number || 0);
        const matchNum = Number(match.match_number || 0);

        if (level === 'qm') {
          return `Quals ${matchNum}`;
        }
        if (level === 'sf') {
          if (usesDoubleElimination) {
            return `Round ${setNum}`;
          }
          return `Semis ${setNum}`;
        }
        if (level === 'qf') {
          return `QF${setNum}`;
        }
        if (level === 'f') {
          return `Finals ${matchNum}`;
        }
        if (level === 'ef') {
          return `EF${setNum}`;
        }
        return `${(match.comp_level || '').toUpperCase()} ${matchNum}`;
      };

      const getSortTime = (m) => Number(m.time_real || m.time_pred || 0);

      const sortedMatches = [...matchesData].sort((a, b) => {
        const rankA = getCompLevelRank(a.comp_level);
        const rankB = getCompLevelRank(b.comp_level);
        if (rankA !== rankB) return rankA - rankB;

        const timeA = getSortTime(a);
        const timeB = getSortTime(b);
        if (timeA !== 0 && timeB !== 0 && timeA !== timeB) {
          return timeA - timeB;
        }

        const setA = Number(a.set_number || 0);
        const setB = Number(b.set_number || 0);
        if (setA !== setB) return setA - setB;

        const matchA = Number(a.match_number || 0);
        const matchB = Number(b.match_number || 0);
        return matchA - matchB;
      });

      const transformedMatches = sortedMatches.map((match, index) => ({
        id: index + 1,
        matchNumber: getMatchDisplayLabel(match),
        matchKey: match.match_key,
        redAlliance: match.red_teams.map(team => parseInt(team.replace('frc', ''))),
        blueAlliance: match.blue_teams.map(team => parseInt(team.replace('frc', ''))),
        scoutAssignments: {},
        redScore: match.red_score,
        blueScore: match.blue_score,
        status: match.red_score !== null && match.blue_score !== null ? 'completed' : 'upcoming',
        time: match.time_real ? new Date(match.time_real * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'TBD',
      }));

      setCurrentMatches(transformedMatches);

      const allTeamKeys = new Set();
      transformedMatches.forEach(match => {
        match.redAlliance.forEach(team => allTeamKeys.add(`frc${team}`));
        match.blueAlliance.forEach(team => allTeamKeys.add(`frc${team}`));
      });

      const teamKeysArray = Array.from(allTeamKeys);
      const epaResults = await apiService.getTeamsEPA(teamKeysArray);
      setEpaData(epaResults);

      const matchProbabilities = {};
      transformedMatches.forEach(match => {
        const redTotalEPA = match.redAlliance.reduce((sum, team) => {
          const teamEPA = epaResults[`frc${team}`] || 0;
          return sum + (typeof teamEPA === 'number' ? teamEPA : 0);
        }, 0);

        const blueTotalEPA = match.blueAlliance.reduce((sum, team) => {
          const teamEPA = epaResults[`frc${team}`] || 0;
          return sum + (typeof teamEPA === 'number' ? teamEPA : 0);
        }, 0);

        const redWinProb = calculateWinProbability(redTotalEPA, blueTotalEPA);
        const blueWinProb = 100 - redWinProb;

        matchProbabilities[match.matchKey] = {
          red: redWinProb,
          blue: blueWinProb,
        };
      });

      setWinProbabilities(matchProbabilities);
    } catch (error) {
      console.error('Failed to fetch matches:', error);
      Alert.alert('Error', 'Failed to load matches. Please try again.');
    } finally {
      setMatchesLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      fetchEvents();
    }, [selectedEvent])
  );

  useEffect(() => {
    if (!selectedEvent || loading) {
      return;
    }
    fetchMatchesForEvent(selectedEvent);
  }, [selectedEvent, loading]);

  // handle match expansion for notes
  const toggleMatchExpansion = (matchId) => {
    if (expandedMatch === matchId) {
      setExpandedMatch(null);
      setCurrentNote('');
    } else {
      setExpandedMatch(matchId);
      setCurrentNote(matchNotes[matchId] || '');
    }
  };

  // save notes of a match
  const saveMatchNotes = (matchId) => {
    setMatchNotes(prev => ({
      ...prev,
      [matchId]: currentNote
    }));
    Alert.alert('Success', 'Notes saved successfully!');
    setExpandedMatch(null);
    setCurrentNote('');
  };

  // open match scouting form
  const navigateToScoutingForm = (teamNumber, matchData) => {
    navigation.navigate('MatchScoutingForm', {
      teamNumber,
      matchData
    });
  };

  const navigateToAllianceScoutingForm = (allianceColor, matchData) => {
    navigation.navigate('AllianceScoutingForm', {
      allianceColor,
      matchData,
    });
  };

  const renderMatch = ({ item }) => {
    const userScoutTeam = user ? Object.keys(item.scoutAssignments).find(team => 
      item.scoutAssignments[team] === user.id
    ) : null;

    const renderTeam = (teamNumber) => {
      const isTeam509 = teamNumber === 509;
      const isScoutTeam = userScoutTeam && parseInt(userScoutTeam) === teamNumber;
      
      return (
        <Text 
          style={[
            styles.tableTeamText,
            { color: theme.colors.text },
            isTeam509 && styles.team509Text,
            isScoutTeam && styles.scoutTeamText,
          ]}
        >
          {teamNumber}
        </Text>
      );
    };

    const getRowBackgroundColor = () => {
      if (item.status === 'completed') {
        return 'rgba(128, 128, 128, 0.3)'; // darker gray for completed
      } else if (item.status === 'current') {
        return 'rgba(76, 175, 80, 0.25)'; // soft green highlight for current match
      }
      return theme.colors.surface; // default for upcoming
    };

    const isExpanded = expandedMatch === item.id;

    return (
      <View>
        <TouchableOpacity 
          style={[styles.tableRow, { backgroundColor: getRowBackgroundColor() }]}
          onPress={() => toggleMatchExpansion(item.id)}
        >
          <View style={styles.matchColumn}>
            <Text style={[styles.tableMatchText, { color: theme.colors.text }]}>
              {item.matchNumber}
            </Text>
          </View>
        
        <View style={styles.teamColumn}>
          {renderTeam(item.redAlliance[0])}
        </View>
        <View style={styles.teamColumn}>
          {renderTeam(item.redAlliance[1])}
        </View>
        <View style={styles.teamColumn}>
          {renderTeam(item.redAlliance[2])}
        </View>
        
        <View style={styles.teamColumn}>
          {renderTeam(item.blueAlliance[0])}
        </View>
        <View style={styles.teamColumn}>
          {renderTeam(item.blueAlliance[1])}
        </View>
        <View style={styles.teamColumn}>
          {renderTeam(item.blueAlliance[2])}
        </View>
        
        <View style={styles.scoreColumn}>
          <Text style={[styles.scoreText, { color: '#FF4444' }]}>
            {item.redScore !== null ? item.redScore : '-'}
          </Text>
        </View>
        
        <View style={styles.scoreColumn}>
          <Text style={[styles.scoreText, { color: '#4444FF' }]}>
            {item.blueScore !== null ? item.blueScore : '-'}
          </Text>
        </View>
        </TouchableOpacity>
        
        {isExpanded && (
          <View style={[styles.notesSection, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.epaSection}>
              <Text style={[styles.epaSectionTitle, { color: theme.colors.text }]}>
                Match Analytics for {item.matchNumber}
              </Text>
              
              <View style={[styles.allianceEpaContainer, styles.redAllianceContainer]}>
                <View style={styles.allianceHeader}>
                  <Text style={[styles.allianceTitle, { color: '#FFFFFF' }]}>Red Alliance</Text>
                  <View style={styles.allianceStats}>
                    <Text style={[styles.allianceTotalEPA, { color: '#FFFFFF' }]}>
                      Total EPA: {formatEPA(
                        item.redAlliance.reduce((sum, team) => {
                          const teamKey = `frc${team}`;
                          const teamEPA = epaData[teamKey] || 0;
                          return sum + (typeof teamEPA === 'number' ? teamEPA : 0);
                        }, 0)
                      )}
                    </Text>
                    <Text style={[styles.allianceWinProb, { color: '#FFFFFF' }]}>
                      Win: {formatWinProbability(winProbabilities[item.matchKey]?.red || 0)}
                    </Text>
                  </View>
                </View>
                <View style={styles.teamsEpaContainer}>
                  {item.redAlliance.map((team, index) => {
                    const teamKey = `frc${team}`;
                    const teamEPA = epaData[teamKey] || 0;
                    
                    return (
                      <View key={index} style={styles.teamEpaRow}>
                        <TouchableOpacity onPress={() => navigateToScoutingForm(team, item)}>
                          <Text style={[styles.teamEpaNumber, styles.clickableTeamEpaNumber, { color: '#FFFFFF' }]}>
                            {team}
                          </Text>
                        </TouchableOpacity>
                        <Text style={[styles.teamEpaValue, { color: '#FFE6E6' }]}>
                          EPA: {formatEPA(teamEPA)}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </View>
              
              <View style={[styles.allianceEpaContainer, styles.blueAllianceContainer]}>
                <View style={styles.allianceHeader}>
                  <Text style={[styles.allianceTitle, { color: '#FFFFFF' }]}>Blue Alliance</Text>
                  <View style={styles.allianceStats}>
                    <Text style={[styles.allianceTotalEPA, { color: '#FFFFFF' }]}>
                      Total EPA: {formatEPA(
                        item.blueAlliance.reduce((sum, team) => {
                          const teamKey = `frc${team}`;
                          const teamEPA = epaData[teamKey] || 0;
                          return sum + (typeof teamEPA === 'number' ? teamEPA : 0);
                        }, 0)
                      )}
                    </Text>
                    <Text style={[styles.allianceWinProb, { color: '#FFFFFF' }]}>
                      Win: {formatWinProbability(winProbabilities[item.matchKey]?.blue || 0)}
                    </Text>
                  </View>
                </View>
                <View style={styles.teamsEpaContainer}>
                  {item.blueAlliance.map((team, index) => {
                    const teamKey = `frc${team}`;
                    const teamEPA = epaData[teamKey] || 0;
                    
                    return (
                      <View key={index} style={styles.teamEpaRow}>
                        <TouchableOpacity onPress={() => navigateToScoutingForm(team, item)}>
                          <Text style={[styles.teamEpaNumber, styles.clickableTeamEpaNumber, { color: '#FFFFFF' }]}>
                            {team}
                          </Text>
                        </TouchableOpacity>
                        <Text style={[styles.teamEpaValue, { color: '#E6E6FF' }]}>
                          EPA: {formatEPA(teamEPA)}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            </View>
            
            <Text style={[styles.notesTitle, { color: theme.colors.text }]}>
              Notes for {item.matchNumber}
            </Text>
            <View style={styles.allianceScoutingButtons}>
              <TouchableOpacity
                style={[styles.allianceScoutingButton, { backgroundColor: '#DC3545' }]}
                onPress={() => navigateToAllianceScoutingForm('red', item)}
              >
                <Text style={styles.allianceScoutingButtonText}>Scout Red Alliance</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.allianceScoutingButton, { backgroundColor: '#007BFF' }]}
                onPress={() => navigateToAllianceScoutingForm('blue', item)}
              >
                <Text style={styles.allianceScoutingButtonText}>Scout Blue Alliance</Text>
              </TouchableOpacity>
            </View>
            <TextInput
              style={[styles.notesInput, { 
                backgroundColor: theme.colors.background,
                color: theme.colors.text,
                borderColor: theme.colors.border
              }]}
              placeholder="Enter your notes for this match..."
              placeholderTextColor={theme.colors.textSecondary}
              value={currentNote}
              onChangeText={setCurrentNote}
              multiline
              numberOfLines={4}
            />
            <View style={styles.notesButtons}>
              <TouchableOpacity 
                style={[styles.saveButton, { backgroundColor: theme.colors.primary }]}
                onPress={() => saveMatchNotes(item.id)}
              >
                <Text style={styles.saveButtonText}>Save Notes</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.cancelButton, { borderColor: theme.colors.border }]}
                onPress={() => toggleMatchExpansion(item.id)}
              >
                <Text style={[styles.cancelButtonText, { color: theme.colors.text }]}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    );
  };

  const renderHeader = () => (
    <View>
      <View style={[styles.header, { backgroundColor: theme.colors.primary }]}>
        <Text style={styles.headerTitle}>StormCloud</Text>
        <Text style={styles.headerSubtitle}>
          FRC Scouting & Match Analysis Platform by Team 509
        </Text>
      </View>
      
      {isEventMode && <TwitchStream />}
      
      <View style={styles.eventDropdownContainer}>
        {loading ? (
          <ActivityIndicator size="small" color={theme.colors.primary} />
        ) : Platform.OS === 'web' ? (
          <>
            <TouchableOpacity
              style={[
                styles.compactPickerContainer,
                styles.webSelectorButton,
                {
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.border,
                  shadowColor: theme.colors.shadow,
                },
              ]}
              onPress={() => setEventDropdownOpen(true)}
              activeOpacity={0.85}
            >
              <Text
                style={[styles.webSelectorText, { color: theme.colors.text }]}
                numberOfLines={1}
              >
                {events.find(event => event.key === selectedEvent)?.name || 'Select event'}
              </Text>
              <Ionicons
                name="chevron-expand-outline"
                size={22}
                color={theme.colors.textSecondary}
                style={styles.webSelectorChevron}
              />
            </TouchableOpacity>

            <Modal
              visible={eventDropdownOpen}
              transparent
              animationType="fade"
              onRequestClose={() => setEventDropdownOpen(false)}
            >
              <Pressable
                style={styles.dropdownBackdrop}
                onPress={() => setEventDropdownOpen(false)}
              >
                <Pressable
                  style={[
                    styles.dropdownMenu,
                    {
                      backgroundColor: theme.colors.surface,
                      borderColor: theme.colors.border,
                      shadowColor: theme.colors.shadow,
                    },
                  ]}
                  onPress={() => {}}
                >
                  <FlatList
                    data={events}
                    keyExtractor={(item) => item.key}
                    renderItem={({ item }) => {
                      const isSelected = item.key === selectedEvent;
                      return (
                        <TouchableOpacity
                          style={[
                            styles.dropdownOption,
                            isSelected && {
                              backgroundColor: theme.colors.filterChip,
                            },
                          ]}
                          onPress={() => {
                            setSelectedEvent(item.key);
                            setEventDropdownOpen(false);
                          }}
                        >
                          <Text
                            style={[
                              styles.dropdownOptionText,
                              {
                                color: isSelected ? theme.colors.primary : theme.colors.text,
                              },
                            ]}
                            numberOfLines={1}
                          >
                            {item.name}
                          </Text>
                        </TouchableOpacity>
                      );
                    }}
                  />
                </Pressable>
              </Pressable>
            </Modal>
          </>
        ) : (
          <View
            style={[
              styles.compactPickerContainer,
              {
                backgroundColor: theme.colors.card || theme.colors.surface,
                borderColor: theme.colors.border,
                shadowColor: theme.colors.shadow,
              },
            ]}
          >
            <Picker
              selectedValue={selectedEvent}
              onValueChange={(itemValue) => setSelectedEvent(itemValue)}
              dropdownIconColor={theme.colors.text}
              style={[styles.compactPicker, { color: theme.colors.text }]}
            >
              {events.map(event => (
                <Picker.Item key={event.key} label={event.name} value={event.key} color={theme.colors.text} />
              ))}
            </Picker>
          </View>
        )}
      </View>

       <View style={styles.matchesSection}>
        {matchesLoading && (
          <View style={[styles.inlineLoadingRow, { borderBottomColor: theme.colors.border }]}>
            <ActivityIndicator size="small" color={theme.colors.primary} />
            <Text style={[styles.inlineLoadingText, { color: theme.colors.textSecondary }]}>Loading matches...</Text>
          </View>
        )}
        <View style={[styles.tableHeader, { backgroundColor: theme.colors.surface }]}>
          <View style={styles.matchColumn}>
            <Text style={[styles.tableHeaderText, { color: theme.colors.text }]}>Match</Text>
          </View>
          
          <View style={styles.teamColumn}>
            <Text style={[styles.tableHeaderText, { color: '#FF4444' }]}>Red 1</Text>
          </View>
          <View style={styles.teamColumn}>
            <Text style={[styles.tableHeaderText, { color: '#FF4444' }]}>Red 2</Text>
          </View>
          <View style={styles.teamColumn}>
            <Text style={[styles.tableHeaderText, { color: '#FF4444' }]}>Red 3</Text>
          </View>
          
          <View style={styles.teamColumn}>
            <Text style={[styles.tableHeaderText, { color: '#4444FF' }]}>Blue 1</Text>
          </View>
          <View style={styles.teamColumn}>
            <Text style={[styles.tableHeaderText, { color: '#4444FF' }]}>Blue 2</Text>
          </View>
          <View style={styles.teamColumn}>
            <Text style={[styles.tableHeaderText, { color: '#4444FF' }]}>Blue 3</Text>
          </View>
          
          <View style={styles.scoreColumn}>
            <Text style={[styles.tableHeaderText, { color: '#FF4444' }]}>Red Score</Text>
          </View>
          
          <View style={styles.scoreColumn}>
            <Text style={[styles.tableHeaderText, { color: '#4444FF' }]}>Blue Score</Text>
          </View>
        </View>
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <StatusBar style={theme.colors.statusBar} />

      <FlatList
        data={currentMatches}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderMatch}
        ListHeaderComponent={renderHeader}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={styles.tableSeparator} />}
        contentContainerStyle={styles.contentContainer}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 40 : 20,
    paddingBottom: 30,
    alignItems: 'center',
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: 'white',
    textAlign: 'center',
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 20,
  },
  summarySection: {
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
    marginHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  summaryTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  summaryText: {
    fontSize: 16,
    lineHeight: 24,
  },
  eventSection: {
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
    marginHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  eventDropdownContainer: {
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  compactPickerContainer: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.16,
    shadowRadius: 8,
    elevation: 3,
  },
  compactPicker: {
    height: 50,
    backgroundColor: 'transparent',
  },
  webSelectorButton: {
    minHeight: 50,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  webSelectorText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
  },
  webSelectorChevron: {
    marginLeft: 12,
  },
  dropdownBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  dropdownMenu: {
    borderWidth: 1,
    borderRadius: 16,
    maxHeight: 360,
    overflow: 'hidden',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.22,
    shadowRadius: 18,
    elevation: 6,
  },
  dropdownOption: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(128, 128, 128, 0.12)',
  },
  dropdownOptionText: {
    fontSize: 15,
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  pickerContainer: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
  },
  picker: {
    height: 50,
  },
  matchesSection: {
    marginBottom: 20,
    marginHorizontal: 20,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
  },
  tableHeader: {
    flexDirection: 'row',
    paddingVertical: isMobile ? 8 : 12,
    paddingHorizontal: isMobile ? 4 : 8,
    borderBottomWidth: 2,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  tableHeaderText: {
    fontSize: isMobile ? 7 : 9,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: isMobile ? 6 : 8,
    paddingHorizontal: isMobile ? 4 : 8,
    minHeight: isMobile ? 32 : 40,
    alignItems: 'center',
  },
  matchColumn: {
    flex: 1.2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  teamColumn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: isMobile ? 2 : 4,
  },
  scoreColumn: {
    flex: 1.2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: isMobile ? 2 : 4,
  },
  tableMatchText: {
    fontSize: isMobile ? 7 : 9,
    fontWeight: '600',
    textAlign: 'center',
  },
  tableTeamText: {
    fontSize: isMobile ? 7 : 9,
    fontWeight: '500',
    textAlign: 'center',
  },
  scoreText: {
    fontSize: isMobile ? 7 : 9,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  team509Text: {
    color: '#FF4444',
    fontWeight: 'bold',
  },
  scoutTeamText: {
    color: '#FFD700',
    fontWeight: 'bold',
  },
  tableSeparator: {
    height: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  notesSection: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.1)',
  },
  notesTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  notesInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    textAlignVertical: 'top',
    minHeight: 80,
    marginBottom: 12,
  },
  allianceScoutingButtons: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  allianceScoutingButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  allianceScoutingButtonText: {
    color: 'white',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  notesButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  saveButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  inlineLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  inlineLoadingText: {
    fontSize: 13,
    fontWeight: '600',
  },
  epaSection: {
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  epaSectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  allianceEpaContainer: {
    marginBottom: 12,
    borderRadius: 12,
    padding: 12,
    borderWidth: 2,
  },
  redAllianceContainer: {
    backgroundColor: '#DC3545',
    borderColor: '#B02A37',
  },
  blueAllianceContainer: {
    backgroundColor: '#007BFF',
    borderColor: '#0056B3',
  },
  allianceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.3)',
  },
  allianceTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  allianceStats: {
    alignItems: 'flex-end',
  },
  allianceTotalEPA: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  allianceWinProb: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  teamsEpaContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 8,
  },
  teamEpaRow: {
    alignItems: 'center',
    flex: 1,
    paddingHorizontal: 4,
  },
  teamEpaNumber: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  clickableTeamEpaNumber: {
    fontWeight: '800',
  },
  teamEpaValue: {
    fontSize: 12,
    marginBottom: 1,
  },
  teamWinProb: {
    fontSize: 12,
    fontWeight: '500',
  },
});
