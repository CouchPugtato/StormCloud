import React, { useState } from 'react';
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
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';

const { width, height } = Dimensions.get('window');
const isMobile = height > width; // mobile devices have height > width

export default function HomeScreen({ navigation }) {
  const { theme, isDarkMode } = useTheme();
  const { user } = useAuth();
  const [selectedEvent, setSelectedEvent] = useState('2024week1');
  const [expandedMatch, setExpandedMatch] = useState(null);
  const [matchNotes, setMatchNotes] = useState({});
  const [currentNote, setCurrentNote] = useState('');

  // mock events data
  const events = [
    { key: '2024week1', name: '2024 Week 1 - Regional' },
    { key: '2024week2', name: '2024 Week 2 - District' },
    { key: '2024week3', name: '2024 Week 3 - Championship' },
    { key: '2024regional', name: '2024 Regional Finals' },
  ];

  const [currentMatchId, setCurrentMatchId] = useState(3); // Quals 3 is current

  const allMatches = {
    '2024week1': [
      {
        id: 1,
        matchNumber: 'Quals 1',
        redAlliance: [1234, 5678, 9012],
        blueAlliance: [509, 3456, 7890],
        scoutAssignments: { 1234: 'mock1', 3456: 'mock2' },
        redScore: 142,
        blueScore: 158,
        status: 'completed', // completed, current, upcoming
      },
      {
        id: 2,
        matchNumber: 'Quals 2',
        redAlliance: [2468, 1357, 8642],
        blueAlliance: [509, 1111, 2222],
        scoutAssignments: { 2468: 'mock1', 1111: 'mock3' },
        redScore: 176,
        blueScore: 134,
        status: 'completed',
       },
       {
         id: 3,
         matchNumber: 'Quals 3',
         redAlliance: [509, 3333, 4444],
         blueAlliance: [5555, 6666, 7777],
         scoutAssignments: { 3333: 'mock2', 5555: 'mock1' },
         redScore: null,
         blueScore: null,
         status: 'current',
       },
       {
         id: 4,
         matchNumber: 'Quals 4',
         redAlliance: [8888, 9999, 1010],
         blueAlliance: [1212, 1313, 509],
         scoutAssignments: { 8888: 'mock3', 1212: 'mock1' },
         redScore: null,
         blueScore: null,
         status: 'upcoming',
       },
       {
         id: 5,
         matchNumber: 'Quals 5',
         redAlliance: [1515, 1616, 1717],
         blueAlliance: [1818, 509, 1919],
         scoutAssignments: { 1515: 'mock1', 1818: 'mock2' },
         redScore: null,
         blueScore: null,
         status: 'upcoming',
      },
    ],
    '2024week2': [
      {
        id: 6,
        matchNumber: 'Quals 1',
        redAlliance: [509, 2020, 2121],
        blueAlliance: [2222, 2323, 2424],
        scoutAssignments: { 2020: 'mock1', 2222: 'mock3' },
        redScore: 189,
        blueScore: 145,
        status: 'completed',
       },
       {
         id: 7,
         matchNumber: 'Quals 2',
         redAlliance: [2525, 2626, 2727],
         blueAlliance: [509, 2828, 2929],
         scoutAssignments: { 2525: 'mock2', 2828: 'mock1' },
         redScore: null,
         blueScore: null,
         status: 'current',
      },
    ],
    '2024week3': [
      {
        id: 8,
        matchNumber: 'Quals 1',
        redAlliance: [3030, 3131, 509],
        blueAlliance: [3232, 3333, 3434],
        scoutAssignments: { 3030: 'mock1', 3232: 'mock2' },
        redScore: null,
        blueScore: null,
        status: 'upcoming',
       },
     ],
     '2024regional': [
       {
         id: 9,
         matchNumber: 'Quals 1',
         redAlliance: [509, 4040, 4141],
         blueAlliance: [4242, 4343, 4444],
         scoutAssignments: { 4040: 'mock1', 4242: 'mock3' },
         redScore: null,
         blueScore: null,
         status: 'upcoming',
      },
    ],
  };

  const currentMatches = allMatches[selectedEvent] || [];

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
        
        {/* Red Alliance - Individual Columns */}
        <View style={styles.teamColumn}>
          {renderTeam(item.redAlliance[0])}
        </View>
        <View style={styles.teamColumn}>
          {renderTeam(item.redAlliance[1])}
        </View>
        <View style={styles.teamColumn}>
          {renderTeam(item.redAlliance[2])}
        </View>
        
        {/* Blue Alliance - Individual Columns */}
        <View style={styles.teamColumn}>
          {renderTeam(item.blueAlliance[0])}
        </View>
        <View style={styles.teamColumn}>
          {renderTeam(item.blueAlliance[1])}
        </View>
        <View style={styles.teamColumn}>
          {renderTeam(item.blueAlliance[2])}
        </View>
        
        {/* Scores at the end */}
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
        
        {/* Expandable Notes Section */}
        {isExpanded && (
          <View style={[styles.notesSection, { backgroundColor: theme.colors.surface }]}>
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
          FRC Scouting & Match Analysis Platform
        </Text>
      </LinearGradient>
      {/* Service Summary */}
      <View style={[styles.summarySection, { backgroundColor: theme.colors.surface }]}>
        <Text style={[styles.summaryTitle, { color: theme.colors.text }]}>About StormWatch</Text>
        <Text style={[styles.summaryText, { color: theme.colors.textSecondary }]}>
          StormWatch is a comprehensive FRC scouting platform that helps teams analyze match data, 
          track performance metrics, and make strategic decisions. Scout teams, view match schedules, 
          and access detailed analytics to give your team the competitive edge.
        </Text>
      </View>

      {/* Event Selection */}
      <View style={styles.eventDropdownContainer}>
        <Text style={[styles.eventsLabel, { color: theme.colors.text }]}>Events</Text>
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
      </View>

      {/* Table Header */}
      <View style={styles.matchesSection}>
        <View style={[styles.tableHeader, { backgroundColor: theme.colors.surface }]}>
          <View style={styles.matchColumn}>
            <Text style={[styles.tableHeaderText, { color: theme.colors.text }]}>Match</Text>
          </View>
          
          {/* Red Alliance Headers */}
          <View style={styles.teamColumn}>
            <Text style={[styles.tableHeaderText, { color: '#FF4444' }]}>Red 1</Text>
          </View>
          <View style={styles.teamColumn}>
            <Text style={[styles.tableHeaderText, { color: '#FF4444' }]}>Red 2</Text>
          </View>
          <View style={styles.teamColumn}>
            <Text style={[styles.tableHeaderText, { color: '#FF4444' }]}>Red 3</Text>
          </View>
          
          {/* Blue Alliance Headers */}
          <View style={styles.teamColumn}>
            <Text style={[styles.tableHeaderText, { color: '#4444FF' }]}>Blue 1</Text>
          </View>
          <View style={styles.teamColumn}>
            <Text style={[styles.tableHeaderText, { color: '#4444FF' }]}>Blue 2</Text>
          </View>
          <View style={styles.teamColumn}>
            <Text style={[styles.tableHeaderText, { color: '#4444FF' }]}>Blue 3</Text>
          </View>
          
          {/* Score Headers at the end */}
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
});