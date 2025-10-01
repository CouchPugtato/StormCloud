import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  Dimensions,
  FlatList,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import apiService from '../utils/apiService';
import { calculateWinProbability, formatEPA, formatWinProbability } from '../utils/epaCalculations';

const { width, height } = Dimensions.get('window');
const isMobile = height > width; // mobile devices have height > width

export default function HomeScreen({ navigation }) {
  const { theme, isDarkMode } = useTheme();
  const { user } = useAuth();
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [expandedMatch, setExpandedMatch] = useState(null);
  const [matchNotes, setMatchNotes] = useState({});
  const [currentNote, setCurrentNote] = useState('');
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [matchesLoading, setMatchesLoading] = useState(false);
  const [epaData, setEpaData] = useState({});
  const [winProbabilities, setWinProbabilities] = useState({});

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        setLoading(true);
        const eventsData = await apiService.getEvents();
        const transformedEvents = eventsData.map(event => ({
          key: event.event_key,
          name: event.name
        }));
        setEvents(transformedEvents);
        
        if (transformedEvents.length > 0) {
          setSelectedEvent(transformedEvents[0].key);
        }
      } catch (error) {
        console.error('Failed to fetch events:', error);
        Alert.alert('Error', 'Failed to load events. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
  }, []);

  const [currentMatches, setCurrentMatches] = useState([]);

  useEffect(() => {
    const fetchMatches = async () => {
      if (!selectedEvent) return;
      
      try {
        setMatchesLoading(true);
        const matchesData = await apiService.getEventMatches(selectedEvent);
        
        const transformedMatches = matchesData.map((match, index) => ({
          id: index + 1,
          matchNumber: `${match.comp_level === 'qm' ? 'Quals' : match.comp_level.toUpperCase()} ${match.match_number}`,
          matchKey: match.match_key,
          redAlliance: match.red_teams.map(team => parseInt(team.replace('frc', ''))),
          blueAlliance: match.blue_teams.map(team => parseInt(team.replace('frc', ''))),
          scoutAssignments: {}, // TODO: implement scout assignments from backend
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
            blue: blueWinProb
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

    fetchMatches();
  }, [selectedEvent]);

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

  const renderMatch = ({ item }) => {
    const userScoutTeam = user ? Object.keys(item.scoutAssignments).find(team => 
      item.scoutAssignments[team] === user.id
    ) : null;

    const renderTeam = (teamNumber) => {
      const isTeam509 = teamNumber === 509;
      const isScoutTeam = userScoutTeam && parseInt(userScoutTeam) === teamNumber;
      
      return (
        <TouchableOpacity onPress={() => navigateToScoutingForm(teamNumber, item)}>
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
        </TouchableOpacity>
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
                        <Text style={[styles.teamEpaNumber, { color: '#FFFFFF' }]}>
                          {team}
                        </Text>
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
                        <Text style={[styles.teamEpaNumber, { color: '#FFFFFF' }]}>
                          {team}
                        </Text>
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
      <LinearGradient
        colors={isDarkMode ? [theme.colors.primary, '#FF6B6B'] : ['#2196F3', '#1976D2']}
        style={styles.header}
      >
        <Text style={styles.headerTitle}>StormWatch</Text>
        <Text style={styles.headerSubtitle}>
          FRC Scouting & Match Analysis Platform by Team 509
        </Text>
      </LinearGradient>
       <View style={styles.eventDropdownContainer}>
         <Text style={[styles.eventsLabel, { color: theme.colors.text }]}>Events</Text>
         {loading ? (
           <ActivityIndicator size="small" color={theme.colors.primary} />
         ) : (
           <View style={styles.compactPickerContainer}>
             <Picker
               selectedValue={selectedEvent}
               onValueChange={(itemValue) => setSelectedEvent(itemValue)}
               style={styles.compactPicker}
             >
               {events.map(event => (
                 <Picker.Item key={event.key} label={event.name} value={event.key} color="#000000" />
               ))}
             </Picker>
           </View>
         )}
       </View>

       <View style={styles.matchesSection}>
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
      
      {matchesLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={[styles.loadingText, { color: theme.colors.text }]}>Loading matches...</Text>
        </View>
      ) : (
        <FlatList
          data={currentMatches}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderMatch}
          ListHeaderComponent={renderHeader}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={styles.tableSeparator} />}
          contentContainerStyle={styles.contentContainer}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 30,
    alignItems: 'center',
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: Platform.OS === 'web' ? 32 : 28,
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
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  eventsLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginRight: 12,
  },
  compactPickerContainer: {
    backgroundColor: '#f5f5f5',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#d0d0d0',
    borderTopColor: '#e8e8e8',
    borderLeftColor: '#e8e8e8',
    borderBottomColor: '#b8b8b8',
    borderRightColor: '#b8b8b8',
    shadowColor: '#000',
    shadowOffset: {
      width: 1,
      height: 1,
    },
    shadowOpacity: 0.2,
    shadowRadius: 1,
    elevation: 2,
    minWidth: 120,
  },
  compactPicker: {
    height: 35,
    color: '#000000',
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 50,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
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
  teamEpaValue: {
    fontSize: 12,
    marginBottom: 1,
  },
  teamWinProb: {
    fontSize: 12,
    fontWeight: '500',
  },
});