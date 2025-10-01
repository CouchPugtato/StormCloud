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
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import apiService from '../utils/apiService';

export default function PitScoutingForm({ route, navigation }) {
  const { theme } = useTheme();
  const { teamNumber, eventKey } = route.params || {};
  const [saving, setSaving] = useState(false);

  if (!teamNumber) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={[styles.header, { backgroundColor: theme.surface }]}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={theme.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Error</Text>
        </View>
        <View style={styles.content}>
          <Text style={[{ color: theme.text, textAlign: 'center', marginTop: 50 }]}>
            Team number is required to access pit scouting form.
          </Text>
        </View>
      </View>
    );
  }
  
  // pit scouting form state
  const [pitData, setPitData] = useState({
    // scout info
    scoutName: '',
    
    // robot specifications
    robotWeight: '',
    robotDimensions: '',
    drivebaseType: '', // swerve, tank, mecanum, etc.
    
    // robot capabilities
    maxCoralLevel: 1, // 1-4 levels
    canClimb: false,
    maxClimbLevel: 'None', // None, Low, Mid, High
    climbTimeEstimate: 0,
    
    // vision and autonomous
    visionSystem: false,
    autoMobility: false,
    autoScoringCapability: '',
    autonomousReliability: 0, // 0-5 scale
    
    // strategy and notes
    preferredStartingPosition: '',
    programmingLanguage: '',
    strengths: '',
    weaknesses: '',
    generalNotes: '',
  });

  const updateField = (field, value) => {
    setPitData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const savePitData = async () => {
    try {
      setSaving(true);
      
      if (!teamNumber) {
        Alert.alert('Error', 'Team number is required');
        return;
      }
      
      if (!pitData.scoutName || pitData.scoutName.trim() === '') {
        Alert.alert('Error', 'Scout name is required');
        return;
      }
      
      const pitPayload = {
        team_key: `frc${teamNumber}`,
        event_key: eventKey || '',
        scout_name: pitData.scoutName.trim(),
        
        robot_weight: pitData.robotWeight,
        robot_dimensions: pitData.robotDimensions,
        drivebase_type: pitData.drivebaseType,
        
        max_coral_level: pitData.maxCoralLevel,
        can_climb: pitData.canClimb,
        max_climb_level: pitData.maxClimbLevel,
        climb_time_estimate: pitData.climbTimeEstimate,
        
        auto_mobility: pitData.autoMobility,
        auto_scoring_capability: pitData.autoScoringCapability,
        
        preferred_starting_position: pitData.preferredStartingPosition,
        strategy_notes: '',
        strengths: pitData.strengths,
        weaknesses: pitData.weaknesses,
        general_notes: pitData.generalNotes,
        
        programming_language: pitData.programmingLanguage,
        vision_system: pitData.visionSystem,
        autonomous_reliability: pitData.autonomousReliability,
      };
      
      await apiService.submitPitScoutingData(pitPayload);
      
      Alert.alert(
        'Success!',
        `Pit scouting data for Team ${teamNumber} has been saved to the database.`,
        [
          { text: 'Continue Scouting', style: 'default' },
          { text: 'Back to Team', onPress: () => navigation.goBack() }
        ]
      );
    } catch (error) {
      console.error('Failed to save pit scouting data:', error);
      Alert.alert(
        'Error',
        'Failed to save pit scouting data. Please check your connection and try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setSaving(false);
    }
  };

  const renderRatingSelector = (label, field, maxRating = 5) => {
    return (
      <View style={styles.ratingContainer}>
        <Text style={[styles.ratingLabel, { color: theme.colors.text }]}>{label}</Text>
        <View style={styles.ratingButtons}>
          {Array.from({ length: maxRating + 1 }, (_, index) => (
            <TouchableOpacity
              key={index}
              style={[
                styles.ratingButton,
                {
                  backgroundColor: pitData[field] === index 
                    ? theme.colors.primary 
                    : 'transparent',
                  borderColor: theme.colors.primary
                }
              ]}
              onPress={() => updateField(field, index)}
            >
              <Text style={[
                styles.ratingButtonText,
                {
                  color: pitData[field] === index 
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
  };

  const renderLevelSelector = (label, field, levels) => {
    return (
      <View style={styles.ratingContainer}>
        <Text style={[styles.ratingLabel, { color: theme.colors.text }]}>{label}</Text>
        <View style={styles.ratingButtons}>
          {levels.map((level) => (
            <TouchableOpacity
              key={level}
              style={[
                styles.levelButton,
                {
                  backgroundColor: pitData[field] === level 
                    ? theme.colors.primary 
                    : 'transparent',
                  borderColor: theme.colors.primary
                }
              ]}
              onPress={() => updateField(field, level)}
            >
              <Text style={[
                styles.ratingButtonText,
                {
                  color: pitData[field] === level 
                    ? 'white' 
                    : theme.colors.text
                }
              ]}>
                {level}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.header, { backgroundColor: theme.colors.surface }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
          Pit Scout Team {teamNumber}
        </Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Scout Information */}
        <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Scout Information</Text>
          
          <View style={styles.inputContainer}>
            <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Scout Name</Text>
            <TextInput
              style={[styles.textInput, { 
                backgroundColor: theme.colors.background,
                color: theme.colors.text,
                borderColor: theme.colors.border
              }]}
              placeholder="Enter your name"
              placeholderTextColor={theme.colors.textSecondary}
              value={pitData.scoutName}
              onChangeText={(value) => updateField('scoutName', value)}
            />
          </View>
        </View>

        {/* Robot Specifications */}
        <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Robot Specifications</Text>
          
          <View style={styles.inputContainer}>
            <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Robot Weight</Text>
            <TextInput
              style={[styles.textInput, { 
                backgroundColor: theme.colors.background,
                color: theme.colors.text,
                borderColor: theme.colors.border
              }]}
              placeholder="e.g., 125 lbs"
              placeholderTextColor={theme.colors.textSecondary}
              value={pitData.robotWeight}
              onChangeText={(value) => updateField('robotWeight', value)}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Robot Dimensions</Text>
            <TextInput
              style={[styles.textInput, { 
                backgroundColor: theme.colors.background,
                color: theme.colors.text,
                borderColor: theme.colors.border
              }]}
              placeholder="e.g., 28x32x42 inches"
              placeholderTextColor={theme.colors.textSecondary}
              value={pitData.robotDimensions}
              onChangeText={(value) => updateField('robotDimensions', value)}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Swerve Base Type / Drivetrain</Text>
            <TextInput
              style={[styles.textInput, { 
                backgroundColor: theme.colors.background,
                color: theme.colors.text,
                borderColor: theme.colors.border
              }]}
              placeholder="e.g., Swerve, Tank, Mecanum"
              placeholderTextColor={theme.colors.textSecondary}
              value={pitData.drivebaseType}
              onChangeText={(value) => updateField('drivebaseType', value)}
            />
          </View>
        </View>

        {/* Robot Capabilities */}
        <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Robot Capabilities</Text>
          
          {renderLevelSelector('Max Coral Level', 'maxCoralLevel', [1, 2, 3, 4])}
          
          <View style={styles.switchContainer}>
            <Text style={[styles.switchLabel, { color: theme.colors.text }]}>Can Climb</Text>
            <Switch
              value={pitData.canClimb}
              onValueChange={(value) => updateField('canClimb', value)}
              trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
            />
          </View>

          {pitData.canClimb && (
            <>
              {renderLevelSelector('Max Climb Level', 'maxClimbLevel', ['None', 'Low', 'Mid', 'High'])}
              
              <View style={styles.inputContainer}>
                <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Climb Time Estimate (seconds)</Text>
                <TextInput
                  style={[styles.textInput, { 
                    backgroundColor: theme.colors.background,
                    color: theme.colors.text,
                    borderColor: theme.colors.border
                  }]}
                  placeholder="e.g., 15"
                  placeholderTextColor={theme.colors.textSecondary}
                  value={pitData.climbTimeEstimate.toString()}
                  onChangeText={(value) => updateField('climbTimeEstimate', parseInt(value) || 0)}
                  keyboardType="numeric"
                />
              </View>
            </>
          )}
        </View>

        {/* Vision and Autonomous */}
        <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Vision & Autonomous</Text>
          
          <View style={styles.switchContainer}>
            <Text style={[styles.switchLabel, { color: theme.colors.text }]}>Vision Capabilities/Alignment</Text>
            <Switch
              value={pitData.visionSystem}
              onValueChange={(value) => updateField('visionSystem', value)}
              trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
            />
          </View>

          <View style={styles.switchContainer}>
            <Text style={[styles.switchLabel, { color: theme.colors.text }]}>Auto Mobility</Text>
            <Switch
              value={pitData.autoMobility}
              onValueChange={(value) => updateField('autoMobility', value)}
              trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Autonomous Description</Text>
            <TextInput
              style={[styles.notesInput, { 
                backgroundColor: theme.colors.background,
                color: theme.colors.text,
                borderColor: theme.colors.border
              }]}
              placeholder="Describe autonomous capabilities and strategy..."
              placeholderTextColor={theme.colors.textSecondary}
              value={pitData.autoScoringCapability}
              onChangeText={(value) => updateField('autoScoringCapability', value)}
              multiline
              numberOfLines={3}
            />
          </View>

          {renderRatingSelector('Autonomous Reliability (0-5)', 'autonomousReliability')}
        </View>

        {/* Programming and Strategy */}
        <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Programming & Strategy</Text>
          
          <View style={styles.inputContainer}>
            <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Programming Language</Text>
            <TextInput
              style={[styles.textInput, { 
                backgroundColor: theme.colors.background,
                color: theme.colors.text,
                borderColor: theme.colors.border
              }]}
              placeholder="e.g., Java, Python, C++"
              placeholderTextColor={theme.colors.textSecondary}
              value={pitData.programmingLanguage}
              onChangeText={(value) => updateField('programmingLanguage', value)}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Preferred Starting Position</Text>
            <TextInput
              style={[styles.textInput, { 
                backgroundColor: theme.colors.background,
                color: theme.colors.text,
                borderColor: theme.colors.border
              }]}
              placeholder="e.g., Center, Left, Right"
              placeholderTextColor={theme.colors.textSecondary}
              value={pitData.preferredStartingPosition}
              onChangeText={(value) => updateField('preferredStartingPosition', value)}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Team Strengths</Text>
            <TextInput
              style={[styles.notesInput, { 
                backgroundColor: theme.colors.background,
                color: theme.colors.text,
                borderColor: theme.colors.border
              }]}
              placeholder="What does this team do well?"
              placeholderTextColor={theme.colors.textSecondary}
              value={pitData.strengths}
              onChangeText={(value) => updateField('strengths', value)}
              multiline
              numberOfLines={3}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Team Weaknesses</Text>
            <TextInput
              style={[styles.notesInput, { 
                backgroundColor: theme.colors.background,
                color: theme.colors.text,
                borderColor: theme.colors.border
              }]}
              placeholder="Areas for improvement or limitations..."
              placeholderTextColor={theme.colors.textSecondary}
              value={pitData.weaknesses}
              onChangeText={(value) => updateField('weaknesses', value)}
              multiline
              numberOfLines={3}
            />
          </View>
        </View>

        {/* General Comments */}
        <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>General Comments</Text>
          
          <TextInput
            style={[styles.notesInput, { 
              backgroundColor: theme.colors.background,
              color: theme.colors.text,
              borderColor: theme.colors.border
            }]}
            placeholder="Any additional observations, notes, or comments about this team..."
            placeholderTextColor={theme.colors.textSecondary}
            value={pitData.generalNotes}
            onChangeText={(value) => updateField('generalNotes', value)}
            multiline
            numberOfLines={4}
          />
        </View>

        {/* Save Button */}
        <TouchableOpacity
          style={[styles.saveButton, { 
            backgroundColor: theme.colors.primary,
            opacity: saving ? 0.6 : 1
          }]}
          onPress={savePitData}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <Ionicons name="save-outline" size={20} color="white" />
          )}
          <Text style={[styles.saveButtonText, { marginLeft: saving ? 0 : 8 }]}>
            {saving ? 'Saving...' : 'Save Pit Scouting Data'}
          </Text>
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
    minHeight: 80,
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
    flexWrap: 'wrap',
  },
  ratingButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  levelButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 60,
  },
  ratingButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  saveButton: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 30,
  },
  saveButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
});