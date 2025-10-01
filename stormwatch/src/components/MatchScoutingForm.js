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

export default function MatchScoutingForm({ route, navigation }) {
  const { theme } = useTheme();
  const { teamNumber, matchData } = route.params;
  const [saving, setSaving] = useState(false);
  
  // scouting form state - 2025 FRC game fields
  const [scoutingData, setScoutingData] = useState({
    // scout info
    scoutName: '',
    
    // auto period - coral scoring
    autoCoralL1: 0,
    autoCoralL2: 0,
    autoCoralL3: 0,
    autoCoralL4: 0,
    autoAlgaeNet: 0,
    autoAlgaeProcessor: 0,
    autoReef: 0,
    autoMobility: false,
    
    // teleop period
    teleopCoralL1: 0,
    teleopCoralL2: 0,
    teleopCoralL3: 0,
    teleopCoralL4: 0,
    teleopAlgaeNet: 0,
    teleopAlgaeProcessor: 0,
    teleopReef: 0,
    
    // endgame
    climbLevel: 'None', // None, Low, High
    climbTime: 0,
    
    // performance ratings
    defenseRating: 0, // 0-5 scale
    speedRating: 0, // 0-5 scale
    stabilityRating: 0, // 0-5 scale
    
    // general notes
    robotBroke: false,
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

  const saveScoutingData = async () => {
    try {
      setSaving(true);
      
      const scoutingPayload = {
        match_key: `${matchData.matchNumber}`,
        team_key: `frc${teamNumber}`,
        scout_name: scoutingData.scoutName,
        
        auto_coral_l1: scoutingData.autoCoralL1,
        auto_coral_l2: scoutingData.autoCoralL2,
        auto_coral_l3: scoutingData.autoCoralL3,
        auto_coral_l4: scoutingData.autoCoralL4,
        auto_algae_net: scoutingData.autoAlgaeNet,
        auto_algae_processor: scoutingData.autoAlgaeProcessor,
        auto_reef: scoutingData.autoReef,
        auto_mobility: scoutingData.autoMobility,
        
        teleop_coral_l1: scoutingData.teleopCoralL1,
        teleop_coral_l2: scoutingData.teleopCoralL2,
        teleop_coral_l3: scoutingData.teleopCoralL3,
        teleop_coral_l4: scoutingData.teleopCoralL4,
        teleop_algae_net: scoutingData.teleopAlgaeNet,
        teleop_algae_processor: scoutingData.teleopAlgaeProcessor,
        teleop_reef: scoutingData.teleopReef,
        
        climb_level: scoutingData.climbLevel,
        climb_time: scoutingData.climbTime,
        
        defense_rating: scoutingData.defenseRating,
        speed_rating: scoutingData.speedRating,
        stability_rating: scoutingData.stabilityRating,
        
        robot_broke: scoutingData.robotBroke,
        general_notes: scoutingData.generalNotes,
      };
      
      await apiService.submitMatchScoutingData(scoutingPayload);
      
      Alert.alert(
        'Success!',
        `Scouting data for Team ${teamNumber} in ${matchData.matchNumber} has been saved to the database.`,
        [
          { text: 'Continue Scouting', style: 'default' },
          { text: 'Back to Matches', onPress: () => navigation.goBack() }
        ]
      );
    } catch (error) {
      console.error('Failed to save scouting data:', error);
      Alert.alert(
        'Error',
        'Failed to save scouting data. Please check your connection and try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setSaving(false);
    }
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
              value={scoutingData.scoutName}
              onChangeText={(value) => updateField('scoutName', value)}
            />
          </View>
        </View>

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

          {renderCounter('Coral Level 1', 'autoCoralL1', '#4CAF50')}
          {renderCounter('Coral Level 2', 'autoCoralL2', '#8BC34A')}
          {renderCounter('Coral Level 3', 'autoCoralL3', '#CDDC39')}
          {renderCounter('Coral Level 4', 'autoCoralL4', '#FFEB3B')}
          {renderCounter('Algae Net', 'autoAlgaeNet', '#FF9800')}
          {renderCounter('Algae Processor', 'autoAlgaeProcessor', '#FF5722')}
          {renderCounter('Reef', 'autoReef', '#9C27B0')}
        </View>

        {/* Teleop Period */}
        <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Teleop Period</Text>
          
          {renderCounter('Coral Level 1', 'teleopCoralL1', '#4CAF50')}
          {renderCounter('Coral Level 2', 'teleopCoralL2', '#8BC34A')}
          {renderCounter('Coral Level 3', 'teleopCoralL3', '#CDDC39')}
          {renderCounter('Coral Level 4', 'teleopCoralL4', '#FFEB3B')}
          {renderCounter('Algae Net', 'teleopAlgaeNet', '#FF9800')}
          {renderCounter('Algae Processor', 'teleopAlgaeProcessor', '#FF5722')}
          {renderCounter('Reef', 'teleopReef', '#9C27B0')}
        </View>

        {/* Endgame */}
        <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Endgame</Text>
          
          <View style={styles.ratingContainer}>
            <Text style={[styles.ratingLabel, { color: theme.colors.text }]}>Climb Level</Text>
            <View style={styles.ratingButtons}>
              {['None', 'Low', 'High'].map((level) => (
                <TouchableOpacity
                  key={level}
                  style={[
                    styles.ratingButton,
                    {
                      backgroundColor: scoutingData.climbLevel === level 
                        ? theme.colors.primary 
                        : 'transparent',
                      borderColor: theme.colors.primary
                    }
                  ]}
                  onPress={() => updateField('climbLevel', level)}
                >
                  <Text style={[
                    styles.ratingButtonText,
                    {
                      color: scoutingData.climbLevel === level 
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

          {renderCounter('Climb Time (seconds)', 'climbTime', '#9C27B0')}
        </View>

        {/* Performance Ratings */}
        <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Performance Ratings</Text>
          
          {renderRatingSelector('Defense Rating (0-5)', 'defenseRating')}
          {renderRatingSelector('Speed Rating (0-5)', 'speedRating')}
          {renderRatingSelector('Stability Rating (0-5)', 'stabilityRating')}
          
          <View style={styles.switchContainer}>
            <Text style={[styles.switchLabel, { color: theme.colors.text }]}>Robot Broke</Text>
            <Switch
              value={scoutingData.robotBroke}
              onValueChange={(value) => updateField('robotBroke', value)}
              trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
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
          style={[styles.saveButton, { 
            backgroundColor: theme.colors.primary,
            opacity: saving ? 0.6 : 1
          }]}
          onPress={saveScoutingData}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <Ionicons name="save-outline" size={20} color="white" />
          )}
          <Text style={[styles.saveButtonText, { marginLeft: saving ? 0 : 8 }]}>
            {saving ? 'Saving...' : 'Save Scouting Data'}
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