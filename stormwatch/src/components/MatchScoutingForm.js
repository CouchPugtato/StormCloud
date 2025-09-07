import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';

export default function MatchScoutingForm({ route, navigation }) {
  const { theme } = useTheme();
  const { teamNumber, matchData } = route.params;
  
  // scouting form state
  const [scoutingData, setScoutingData] = useState({
    // auto period
    autoMobility: false,
    autoSpeakerNotes: 0,
    autoAmpNotes: 0,
    autoMissed: 0,
    
    // teleop period
    teleopSpeakerNotes: 0,
    teleopAmpNotes: 0,
    teleopMissed: 0,
    teleopTrap: 0,
    
    // endgame
    climbAttempted: false,
    climbSuccessful: false,
    climbTime: '',
    harmony: false,
    
    // defense and penalties
    defenseRating: 0, // 0-5 scale
    penaltiesReceived: 0,
    
    // general notes
    robotBroke: false,
    driverSkill: 0, // 0-5 scale
    generalNotes: '',
  });

  const updateField = (field, value) => {
    setScoutingData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const incrementCounter = (field) => {
    setScoutingData(prev => ({
      ...prev,
      [field]: prev[field] + 1
    }));
  };

  const decrementCounter = (field) => {
    setScoutingData(prev => ({
      ...prev,
      [field]: Math.max(0, prev[field] - 1)
    }));
  };

  const saveScoutingData = () => {
    // TODO: save to database/storage
    Alert.alert(
      'Scouting Data Saved',
      `Data for Team ${teamNumber} in ${matchData.matchNumber} has been saved.`,
      [
        { text: 'Continue Scouting', style: 'default' },
        { text: 'Back to Matches', onPress: () => navigation.goBack() }
      ]
    );
  };

  const renderCounter = (label, field, color = theme.colors.primary) => (
    <View style={styles.counterContainer}>
      <Text style={[styles.counterLabel, { color: theme.colors.text }]}>{label}</Text>
      <View style={styles.counterControls}>
        <TouchableOpacity
          style={[styles.counterButton, { backgroundColor: color }]}
          onPress={() => decrementCounter(field)}
        >
          <Ionicons name="remove" size={20} color="white" />
        </TouchableOpacity>
        <Text style={[styles.counterValue, { color: theme.colors.text }]}>
          {scoutingData[field]}
        </Text>
        <TouchableOpacity
          style={[styles.counterButton, { backgroundColor: color }]}
          onPress={() => incrementCounter(field)}
        >
          <Ionicons name="add" size={20} color="white" />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderRatingSelector = (label, field, maxRating = 5) => (
    <View style={styles.ratingContainer}>
      <Text style={[styles.ratingLabel, { color: theme.colors.text }]}>{label}</Text>
      <View style={styles.ratingButtons}>
        {[...Array(maxRating + 1)].map((_, index) => (
          <TouchableOpacity
            key={index}
            style={[
              styles.ratingButton,
              {
                backgroundColor: scoutingData[field] === index 
                  ? theme.colors.primary 
                  : theme.colors.surface,
                borderColor: theme.colors.border
              }
            ]}
            onPress={() => updateField(field, index)}
          >
            <Text style={[
              styles.ratingButtonText,
              {
                color: scoutingData[field] === index 
                  ? 'white' 
                  : theme.colors.text
              }
            ]}>
              {index}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.header, { backgroundColor: theme.colors.surface }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
          Scout Team {teamNumber}
        </Text>
        <Text style={[styles.headerSubtitle, { color: theme.colors.textSecondary }]}>
          {matchData.matchNumber}
        </Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Autonomous Period */}
        <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Autonomous Period</Text>
          
          <View style={styles.switchContainer}>
            <Text style={[styles.switchLabel, { color: theme.colors.text }]}>Mobility</Text>
            <Switch
              value={scoutingData.autoMobility}
              onValueChange={(value) => updateField('autoMobility', value)}
              trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
            />
          </View>

          {renderCounter('Speaker Notes', 'autoSpeakerNotes', '#4CAF50')}
          {renderCounter('Amp Notes', 'autoAmpNotes', '#FF9800')}
          {renderCounter('Missed Shots', 'autoMissed', '#F44336')}
        </View>

        {/* Teleop Period */}
        <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Teleop Period</Text>
          
          {renderCounter('Speaker Notes', 'teleopSpeakerNotes', '#4CAF50')}
          {renderCounter('Amp Notes', 'teleopAmpNotes', '#FF9800')}
          {renderCounter('Missed Shots', 'teleopMissed', '#F44336')}
          {renderCounter('Trap Notes', 'teleopTrap', '#9C27B0')}
        </View>

        {/* Endgame */}
        <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Endgame</Text>
          
          <View style={styles.switchContainer}>
            <Text style={[styles.switchLabel, { color: theme.colors.text }]}>Climb Attempted</Text>
            <Switch
              value={scoutingData.climbAttempted}
              onValueChange={(value) => updateField('climbAttempted', value)}
              trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
            />
          </View>

          <View style={styles.switchContainer}>
            <Text style={[styles.switchLabel, { color: theme.colors.text }]}>Climb Successful</Text>
            <Switch
              value={scoutingData.climbSuccessful}
              onValueChange={(value) => updateField('climbSuccessful', value)}
              trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
            />
          </View>

          <View style={styles.switchContainer}>
            <Text style={[styles.switchLabel, { color: theme.colors.text }]}>Harmony</Text>
            <Switch
              value={scoutingData.harmony}
              onValueChange={(value) => updateField('harmony', value)}
              trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Climb Time (seconds)</Text>
            <TextInput
              style={[styles.textInput, { 
                backgroundColor: theme.colors.background,
                color: theme.colors.text,
                borderColor: theme.colors.border
              }]}
              placeholder="e.g., 15"
              placeholderTextColor={theme.colors.textSecondary}
              value={scoutingData.climbTime}
              onChangeText={(value) => updateField('climbTime', value)}
              keyboardType="numeric"
            />
          </View>
        </View>

        {/* Performance Ratings */}
        <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Performance Ratings</Text>
          
          {renderRatingSelector('Defense Rating (0-5)', 'defenseRating')}
          {renderRatingSelector('Driver Skill (0-5)', 'driverSkill')}
          {renderCounter('Penalties Received', 'penaltiesReceived', '#F44336')}
          
          <View style={styles.switchContainer}>
            <Text style={[styles.switchLabel, { color: theme.colors.text }]}>Robot Broke Down</Text>
            <Switch
              value={scoutingData.robotBroke}
              onValueChange={(value) => updateField('robotBroke', value)}
              trackColor={{ false: theme.colors.border, true: '#F44336' }}
            />
          </View>
        </View>

        {/* General Notes */}
        <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>General Notes</Text>
          
          <TextInput
            style={[styles.notesInput, { 
              backgroundColor: theme.colors.background,
              color: theme.colors.text,
              borderColor: theme.colors.border
            }]}
            placeholder="Enter any additional observations about this team's performance..."
            placeholderTextColor={theme.colors.textSecondary}
            value={scoutingData.generalNotes}
            onChangeText={(value) => updateField('generalNotes', value)}
            multiline
            numberOfLines={4}
          />
        </View>

        {/* Save Button */}
        <TouchableOpacity
          style={[styles.saveButton, { backgroundColor: theme.colors.primary }]}
          onPress={saveScoutingData}
        >
          <Text style={styles.saveButtonText}>Save Scouting Data</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
    gap: 15,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    flex: 1,
  },
  headerSubtitle: {
    fontSize: 16,
    fontWeight: '500',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  section: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  counterContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  counterLabel: {
    fontSize: 16,
    flex: 1,
  },
  counterControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  counterButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  counterValue: {
    fontSize: 18,
    fontWeight: 'bold',
    minWidth: 30,
    textAlign: 'center',
  },
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  switchLabel: {
    fontSize: 16,
  },
  ratingContainer: {
    marginBottom: 16,
  },
  ratingLabel: {
    fontSize: 16,
    marginBottom: 8,
  },
  ratingButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  ratingButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ratingButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  inputContainer: {
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 16,
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  notesInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    textAlignVertical: 'top',
    minHeight: 100,
  },
  saveButton: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 30,
  },
  saveButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
});