import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Switch,
  Alert,
  StyleSheet,
  Platform,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useNavigation, useRoute } from '@react-navigation/native';
import apiService from '../utils/apiService';

const PitScoutingForm = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { teamKey, eventKey } = route.params || {};

  const [formData, setFormData] = useState({
    team_key: teamKey || '',
    event_key: eventKey || '',
    scout_name: '',
    robot_weight: '',
    robot_dimensions: '',
    drivebase_type: 'Swerve',
    max_coral_level: 0,
    can_climb: false,
    max_climb_level: '',
    climb_time_estimate: 0,
    auto_mobility: false,
    auto_scoring_capability: '',
    preferred_starting_position: 'Center',
    strategy_notes: '',
    strengths: '',
    weaknesses: '',
    general_notes: '',
    programming_language: 'Java',
    vision_system: false,
    autonomous_reliability: 3,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  const updateField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    if (!formData.team_key || !formData.scout_name) {
      Alert.alert('Error', 'Please fill in required fields (Team and Scout Name)');
      return;
    }

    setIsSubmitting(true);
    try {
      await apiService.submitPitScoutingData(formData);
      Alert.alert('Success', 'Pit scouting data submitted successfully!', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
      // close the form immediately after successful submission
      navigation.goBack();
    } catch (error) {
      console.error('Pit scouting submission error:', error);
      Alert.alert('Error', `Failed to save pit scouting data: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Pit Scouting Form</Text>
        <Text style={styles.subtitle}>
          Team {formData.team_key.replace('frc', '')} - {formData.event_key}
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Scout Information</Text>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Scout Name *</Text>
          <TextInput
            style={styles.textInput}
            value={formData.scout_name}
            onChangeText={(value) => updateField('scout_name', value)}
            placeholder="Enter your name"
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Robot Specifications</Text>
        
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Robot Weight</Text>
          <TextInput
            style={styles.textInput}
            value={formData.robot_weight}
            onChangeText={(value) => updateField('robot_weight', value)}
            placeholder="e.g., 125.5 lbs"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Robot Dimensions</Text>
          <TextInput
            style={styles.textInput}
            value={formData.robot_dimensions}
            onChangeText={(value) => updateField('robot_dimensions', value)}
            placeholder="e.g., 32x28x48 inches (LxWxH)"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Drivebase Type</Text>
          <Picker
            selectedValue={formData.drivebase_type}
            style={styles.picker}
            onValueChange={(value) => updateField('drivebase_type', value)}
          >
            <Picker.Item label="Swerve" value="Swerve" />
            <Picker.Item label="Tank Drive" value="Tank Drive" />
            <Picker.Item label="Mecanum" value="Mecanum" />
            <Picker.Item label="West Coast" value="West Coast" />
            <Picker.Item label="Other" value="Other" />
          </Picker>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Game Piece Capabilities</Text>
        
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Max Coral Level (0-4)</Text>
          <Picker
            selectedValue={formData.max_coral_level}
            style={styles.picker}
            onValueChange={(value) => updateField('max_coral_level', parseInt(value))}
          >
            <Picker.Item label="Ground Only (0)" value={0} />
            <Picker.Item label="Level 1" value={1} />
            <Picker.Item label="Level 2" value={2} />
            <Picker.Item label="Level 3" value={3} />
            <Picker.Item label="Level 4" value={4} />
          </Picker>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Climbing Capabilities</Text>
        
        <View style={styles.switchGroup}>
          <Text style={styles.label}>Can Climb</Text>
          <Switch
            value={formData.can_climb}
            onValueChange={(value) => updateField('can_climb', value)}
          />
        </View>

        {formData.can_climb && (
          <>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Max Climb Level</Text>
              <TextInput
                style={styles.textInput}
                value={formData.max_climb_level}
                onChangeText={(value) => updateField('max_climb_level', value)}
                placeholder="e.g., Level 3, Harmony"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Climb Time Estimate (seconds)</Text>
              <TextInput
                style={styles.textInput}
                value={formData.climb_time_estimate.toString()}
                onChangeText={(value) => updateField('climb_time_estimate', parseInt(value) || 0)}
                placeholder="e.g., 15"
                keyboardType="numeric"
              />
            </View>
          </>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Autonomous Capabilities</Text>
        
        <View style={styles.switchGroup}>
          <Text style={styles.label}>Auto Mobility</Text>
          <Switch
            value={formData.auto_mobility}
            onValueChange={(value) => updateField('auto_mobility', value)}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Auto Scoring Capability</Text>
          <TextInput
            style={styles.textArea}
            value={formData.auto_scoring_capability}
            onChangeText={(value) => updateField('auto_scoring_capability', value)}
            placeholder="Describe autonomous scoring abilities"
            multiline
            numberOfLines={3}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Preferred Starting Position</Text>
          <Picker
            selectedValue={formData.preferred_starting_position}
            style={styles.picker}
            onValueChange={(value) => updateField('preferred_starting_position', value)}
          >
            <Picker.Item label="Left" value="Left" />
            <Picker.Item label="Center" value="Center" />
            <Picker.Item label="Right" value="Right" />
            <Picker.Item label="Flexible" value="Flexible" />
          </Picker>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Programming & Vision</Text>
        
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Programming Language</Text>
          <Picker
            selectedValue={formData.programming_language}
            style={styles.picker}
            onValueChange={(value) => updateField('programming_language', value)}
          >
            <Picker.Item label="Java" value="Java" />
            <Picker.Item label="C++" value="C++" />
            <Picker.Item label="Python" value="Python" />
            <Picker.Item label="LabVIEW" value="LabVIEW" />
            <Picker.Item label="Other" value="Other" />
          </Picker>
        </View>

        <View style={styles.switchGroup}>
          <Text style={styles.label}>Vision System</Text>
          <Switch
            value={formData.vision_system}
            onValueChange={(value) => updateField('vision_system', value)}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Autonomous Reliability (0-5)</Text>
          <Picker
            selectedValue={formData.autonomous_reliability}
            style={styles.picker}
            onValueChange={(value) => updateField('autonomous_reliability', parseInt(value))}
          >
            {[0,1,2,3,4,5].map(num => (
              <Picker.Item key={num} label={num.toString()} value={num} />
            ))}
          </Picker>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Strategy & Notes</Text>
        
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Strategy Notes</Text>
          <TextInput
            style={styles.textArea}
            value={formData.strategy_notes}
            onChangeText={(value) => updateField('strategy_notes', value)}
            placeholder="Team strategy, preferred roles, etc."
            multiline
            numberOfLines={3}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Strengths</Text>
          <TextInput
            style={styles.textArea}
            value={formData.strengths}
            onChangeText={(value) => updateField('strengths', value)}
            placeholder="What does this robot do well?"
            multiline
            numberOfLines={3}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Weaknesses</Text>
          <TextInput
            style={styles.textArea}
            value={formData.weaknesses}
            onChangeText={(value) => updateField('weaknesses', value)}
            placeholder="Areas for improvement or limitations"
            multiline
            numberOfLines={3}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>General Notes</Text>
          <TextInput
            style={styles.textArea}
            value={formData.general_notes}
            onChangeText={(value) => updateField('general_notes', value)}
            placeholder="Additional observations or comments"
            multiline
            numberOfLines={4}
          />
        </View>
      </View>

      <TouchableOpacity
        style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
        onPress={handleSubmit}
        disabled={isSubmitting}
      >
        <Text style={styles.submitButtonText}>
          {isSubmitting ? 'Submitting...' : 'Submit Pit Scouting'}
        </Text>
      </TouchableOpacity>

      <View style={styles.bottomPadding} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#2196F3',
    paddingTop: Platform.OS === 'ios' ? 40 : 20,
    paddingBottom: 30,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 16,
    color: 'white',
    opacity: 0.9,
  },
  section: {
    backgroundColor: 'white',
    margin: 10,
    padding: 15,
    borderRadius: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingBottom: 5,
  },
  inputGroup: {
    marginBottom: 15,
  },
  switchGroup: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 5,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    padding: 10,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  textArea: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    padding: 10,
    fontSize: 16,
    backgroundColor: '#fff',
    textAlignVertical: 'top',
  },
  picker: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    backgroundColor: '#fff',
  },
  submitButton: {
    backgroundColor: '#4CAF50',
    margin: 20,
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: '#ccc',
  },
  submitButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  bottomPadding: {
    height: 20,
  },
});

export default PitScoutingForm;
