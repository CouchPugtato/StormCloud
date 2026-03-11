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

const SHOOTER_ARCHETYPES = ['turret', 'double turret', 'barrel', 'single fixed', 'double fixed', 'other'];
const CLIMB_LEVELS = ['None', 'Low', 'Mid', 'High', 'Traversal'];

export default function PitScoutingForm({ route, navigation }) {
  const { theme } = useTheme();
  const { teamNumber, eventKey = '' } = route.params || {};
  const [saving, setSaving] = useState(false);
  const [pitData, setPitData] = useState({
    scoutName: '',
    estimatedBps: '',
    shooterArchetype: '',
    canTrench: false,
    canBump: false,
    climbLevel: '',
    autoClimb: false,
    climbLocation: '',
    weight: '',
    height: '',
    visionCapabilities: '',
    dimensions: '',
    autoPicture: '',
    batteryCount: '0',
    autoCount: '0',
    indexViaIntake: false,
    intakeAlwaysOut: false,
    feeding: '',
    fullField: false,
    halfField: false,
    pushFuel: false,
    drivetrain: '',
    swerveLevel: '',
    programmingLanguage: '',
    yearsUsedProgrammingLanguage: '',
    indexerType: '',
    hasSpindexer: false,
    hasRollers: false,
    hasBelts: false,
    indexerOther: '',
    notes: '',
    mustPointAtHub: false,
    motorsBesidesDrivetrain: '0',
    drivetrainMotors: '0',
  });

  const updateField = (field, value) => setPitData((prev) => ({ ...prev, [field]: value }));

  const savePitData = async () => {
    try {
      if (!teamNumber) {
        Alert.alert('Error', 'Team number is required.');
        return;
      }
      setSaving(true);
      await apiService.submitPitScoutingData({
        team_key: `frc${teamNumber}`,
        event_key: eventKey,
        scout_name: pitData.scoutName.trim(),
        estimated_bps: pitData.estimatedBps.trim(),
        shooter_archetype: pitData.shooterArchetype,
        can_trench: pitData.canTrench,
        can_bump: pitData.canBump,
        climb_level: pitData.climbLevel,
        auto_climb: pitData.autoClimb,
        climb_location: pitData.climbLocation.trim(),
        weight: pitData.weight.trim(),
        height: pitData.height.trim(),
        vision_capabilities: pitData.visionCapabilities.trim(),
        dimensions: pitData.dimensions.trim(),
        auto_picture: pitData.autoPicture.trim(),
        battery_count: Number(pitData.batteryCount || 0),
        auto_count: Number(pitData.autoCount || 0),
        index_via_intake: pitData.indexViaIntake,
        intake_always_out: pitData.intakeAlwaysOut,
        feeding: pitData.feeding.trim(),
        full_field: pitData.fullField,
        half_field: pitData.halfField,
        push_fuel: pitData.pushFuel,
        drivetrain: pitData.drivetrain.trim(),
        swerve_level: pitData.swerveLevel.trim(),
        programming_language: pitData.programmingLanguage.trim(),
        years_used_programming_language: pitData.yearsUsedProgrammingLanguage.trim(),
        indexer_type: pitData.indexerType.trim(),
        has_spindexer: pitData.hasSpindexer,
        has_rollers: pitData.hasRollers,
        has_belts: pitData.hasBelts,
        indexer_other: pitData.indexerOther.trim(),
        notes: pitData.notes.trim(),
        must_point_at_hub: pitData.mustPointAtHub,
        motors_besides_drivetrain: Number(pitData.motorsBesidesDrivetrain || 0),
        drivetrain_motors: Number(pitData.drivetrainMotors || 0),
      });

      Alert.alert('Saved', `Pit scouting for Team ${teamNumber} was saved.`, [
        { text: 'Keep Editing', style: 'cancel' },
        { text: 'Back', onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      Alert.alert('Error', error.message || 'Unable to save pit scouting data.');
    } finally {
      setSaving(false);
    }
  };

  const renderTextInput = (label, field, options = {}) => (
    <View style={styles.inputContainer} key={field}>
      <Text style={[styles.inputLabel, { color: theme.colors.text }]}>{label}</Text>
      <TextInput
        style={[
          options.multiline ? styles.notesInput : styles.textInput,
          { backgroundColor: theme.colors.background, borderColor: theme.colors.border, color: theme.colors.text },
        ]}
        placeholder={options.placeholder || ''}
        placeholderTextColor={theme.colors.textSecondary}
        keyboardType={options.keyboardType || 'default'}
        value={pitData[field]}
        onChangeText={(value) => updateField(field, options.numeric ? value.replace(/[^0-9.]/g, '') : value)}
        multiline={Boolean(options.multiline)}
      />
    </View>
  );

  const renderToggle = (label, field) => (
    <View style={styles.switchRow} key={field}>
      <Text style={[styles.inputLabel, { color: theme.colors.text }]}>{label}</Text>
      <Switch
        value={Boolean(pitData[field])}
        onValueChange={(value) => updateField(field, value)}
        trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
        thumbColor="#FFFFFF"
      />
    </View>
  );

  const renderChoiceRow = (label, field, options) => (
    <View style={styles.inputContainer} key={field}>
      <Text style={[styles.inputLabel, { color: theme.colors.text }]}>{label}</Text>
      <View style={styles.chipRow}>
        {options.map((option) => {
          const selected = pitData[field] === option;
          return (
            <TouchableOpacity
              key={option}
              style={[
                styles.choiceChip,
                {
                  backgroundColor: selected ? theme.colors.primary : theme.colors.background,
                  borderColor: selected ? theme.colors.primary : theme.colors.border,
                },
              ]}
              onPress={() => updateField(field, option)}
            >
              <Text style={[styles.choiceChipText, { color: selected ? '#fff' : theme.colors.text }]}>{option}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.header, { backgroundColor: theme.colors.surface }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Pit Scout Team {teamNumber}</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Scout Information</Text>
          {renderTextInput('Scout Name', 'scoutName', { placeholder: 'Enter your name' })}
          {renderTextInput('Estimated BPS', 'estimatedBps', { keyboardType: 'numeric', numeric: true, placeholder: '0.0' })}
          {renderChoiceRow('Shooter Archetype', 'shooterArchetype', SHOOTER_ARCHETYPES)}
        </View>

        <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Drive & Field Access</Text>
          {renderToggle('Yes or no trench', 'canTrench')}
          {renderToggle('Yes or no bump', 'canBump')}
          {renderToggle('Index via intake', 'indexViaIntake')}
          {renderToggle('Intake always out', 'intakeAlwaysOut')}
          {renderToggle('Full field', 'fullField')}
          {renderToggle('Half field', 'halfField')}
          {renderToggle('Push fuel', 'pushFuel')}
          {renderTextInput('Feeding', 'feeding', { placeholder: 'Feeder station, lane notes, etc.' })}
          {renderTextInput('Drivetrain', 'drivetrain', { placeholder: 'Tank, swerve, west coast...' })}
          {renderTextInput('Swerve level', 'swerveLevel', { placeholder: 'Practice, elite, average...' })}
        </View>

        <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Climb & Auto</Text>
          {renderChoiceRow('Climb level', 'climbLevel', CLIMB_LEVELS)}
          {renderToggle('Yes or No auto climb', 'autoClimb')}
          {renderTextInput('Climb location', 'climbLocation', { placeholder: 'Side, center, bar, etc.' })}
          {renderTextInput('Describe autospicture', 'autoPicture', { multiline: true, placeholder: 'Describe their auto path and shot picture...' })}
          {renderTextInput('Auto count', 'autoCount', { keyboardType: 'numeric', numeric: true, placeholder: '0' })}
        </View>

        <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Robot Specs</Text>
          {renderTextInput('Weight', 'weight', { placeholder: 'lbs' })}
          {renderTextInput('Height', 'height', { placeholder: 'inches' })}
          {renderTextInput('Dimensions', 'dimensions', { placeholder: 'L x W x H' })}
          {renderTextInput('Describe vision capabilities', 'visionCapabilities', { multiline: true, placeholder: 'Tracking, target lock, cameras, etc.' })}
          {renderToggle('Do you/your vision have to be pointed at the hub to score', 'mustPointAtHub')}
          {renderTextInput('# of batteries', 'batteryCount', { keyboardType: 'numeric', numeric: true, placeholder: '0' })}
          {renderTextInput('# of motors besides drivetrain', 'motorsBesidesDrivetrain', { keyboardType: 'numeric', numeric: true, placeholder: '0' })}
          {renderTextInput('Motors in the drivetrain', 'drivetrainMotors', { keyboardType: 'numeric', numeric: true, placeholder: '0' })}
        </View>

        <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Programming & Indexer</Text>
          {renderTextInput('Programming language', 'programmingLanguage', { placeholder: 'Java, C++, Kotlin...' })}
          {renderTextInput('Years used programming language', 'yearsUsedProgrammingLanguage', { placeholder: 'How long?' })}
          {renderTextInput('Type of indexer', 'indexerType', { placeholder: 'Linear, carousel, etc.' })}
          {renderToggle('Spindexer', 'hasSpindexer')}
          {renderToggle('Rollers', 'hasRollers')}
          {renderToggle('Belts', 'hasBelts')}
          {renderTextInput('Other', 'indexerOther', { placeholder: 'Other indexer details' })}
        </View>

        <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Notes</Text>
          {renderTextInput('Notes', 'notes', { multiline: true, placeholder: 'Anything else worth noting...' })}
        </View>

        <TouchableOpacity
          style={[styles.saveButton, { backgroundColor: theme.colors.primary, opacity: saving ? 0.6 : 1 }]}
          onPress={savePitData}
          disabled={saving}
        >
          {saving ? <ActivityIndicator size="small" color="white" /> : <Ionicons name="save-outline" size={20} color="white" />}
          <Text style={styles.saveButtonText}>{saving ? 'Saving...' : 'Save Pit Scouting Data'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingTop: 50, paddingBottom: 20, paddingHorizontal: 20, gap: 15 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', flex: 1 },
  content: { flex: 1, paddingHorizontal: 20 },
  section: { padding: 16, borderRadius: 12, marginBottom: 16 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 16 },
  inputContainer: { marginBottom: 14 },
  inputLabel: { fontSize: 15, fontWeight: '600', marginBottom: 8, flex: 1 },
  textInput: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12, fontSize: 15 },
  notesInput: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12, fontSize: 15, minHeight: 96, textAlignVertical: 'top' },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, gap: 12 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choiceChip: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 18, borderWidth: 1 },
  choiceChipText: { fontSize: 14, fontWeight: '600' },
  saveButton: { paddingVertical: 16, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, marginBottom: 30 },
  saveButtonText: { color: 'white', fontSize: 17, fontWeight: '700' },
});
