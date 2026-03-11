import React, { useMemo, useState } from 'react';
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

const PATH_OPTIONS = ['Trench', 'Bump', 'Both'];
const CLIMB_LEVELS = ['None', 'Low', 'Mid', 'High'];
const SHOOTER_RANGE_OPTIONS = ['Close', 'Mid', 'Far'];

export default function MatchScoutingForm({ route, navigation }) {
  const { theme } = useTheme();
  const { teamNumber, matchData } = route.params;
  const [saving, setSaving] = useState(false);
  const [scoutingData, setScoutingData] = useState({
    wasAuto: false,
    conflictedOwnAlliance: false,
    conflictedOpposingAlliance: false,
    usedOutpost: false,
    usedDepot: false,
    cycles: '0',
    percentContributed: '0',
    gotDisabled: false,
    bpsRating: 0,
    obviousPenalties: '',
    primaryPath: '',
    indexViaIntake: false,
    intakeSpeed: 0,
    notes: '',
    shooterRange: '',
    climbLevel: '',
    climbLocation: '',
    accuracyAttempted: false,
    accuracySuccessful: false,
  });

  const matchKey = useMemo(
    () => matchData?.matchKey || matchData?.match_key || matchData?.matchNumber || '',
    [matchData]
  );

  const updateField = (field, value) => {
    setScoutingData((prev) => ({ ...prev, [field]: value }));
  };

  const saveScoutingData = async () => {
    try {
      setSaving(true);
      await apiService.submitMatchScoutingData({
        match_key: matchKey,
        team_key: `frc${teamNumber}`,
        was_auto: scoutingData.wasAuto,
        conflicted_own_alliance: scoutingData.conflictedOwnAlliance,
        conflicted_opposing_alliance: scoutingData.conflictedOpposingAlliance,
        used_outpost: scoutingData.usedOutpost,
        used_depot: scoutingData.usedDepot,
        cycles: Number(scoutingData.cycles || 0),
        percent_contributed: Number(scoutingData.percentContributed || 0),
        auto_points_contributed: 0,
        got_disabled: scoutingData.gotDisabled,
        bps_rating: scoutingData.bpsRating,
        obvious_penalties: scoutingData.obviousPenalties.trim(),
        primary_path: scoutingData.primaryPath.toLowerCase(),
        index_via_intake: scoutingData.indexViaIntake,
        intake_speed: scoutingData.intakeSpeed,
        notes: scoutingData.notes.trim(),
        shooter_range_close: scoutingData.shooterRange === 'Close',
        shooter_range_mid: scoutingData.shooterRange === 'Mid',
        shooter_range_far: scoutingData.shooterRange === 'Far',
        climb: scoutingData.climbLevel && scoutingData.climbLevel !== 'None',
        climb_level: scoutingData.climbLevel,
        climb_location: scoutingData.climbLocation.trim(),
        accuracy_successful: scoutingData.accuracySuccessful,
        accuracy_attempted: scoutingData.accuracyAttempted,
      });

      Alert.alert('Saved', `Scouting data for Team ${teamNumber} was saved.`, [
        { text: 'Keep Scouting', style: 'cancel' },
        { text: 'Back', onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      Alert.alert('Error', error.message || 'Unable to save scouting data.');
    } finally {
      setSaving(false);
    }
  };

  const renderToggle = (label, field) => (
    <View style={styles.switchRow} key={field}>
      <Text style={[styles.inputLabel, { color: theme.colors.text }]}>{label}</Text>
      <Switch
        value={Boolean(scoutingData[field])}
        onValueChange={(value) => updateField(field, value)}
        trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
        thumbColor="#FFFFFF"
      />
    </View>
  );

  const renderNumberInput = (label, field, placeholder = '0') => (
    <View style={styles.inputContainer} key={field}>
      <Text style={[styles.inputLabel, { color: theme.colors.text }]}>{label}</Text>
      <TextInput
        style={[
          styles.textInput,
          {
            backgroundColor: theme.colors.background,
            borderColor: theme.colors.border,
            color: theme.colors.text,
          },
        ]}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.textSecondary}
        keyboardType="numeric"
        value={String(scoutingData[field])}
        onChangeText={(value) => updateField(field, value.replace(/[^0-9]/g, ''))}
      />
    </View>
  );

  const renderTextInput = (label, field, options = {}) => (
    <View style={styles.inputContainer} key={field}>
      <Text style={[styles.inputLabel, { color: theme.colors.text }]}>{label}</Text>
      <TextInput
        style={[
          options.multiline ? styles.notesInput : styles.textInput,
          {
            backgroundColor: theme.colors.background,
            borderColor: theme.colors.border,
            color: theme.colors.text,
          },
        ]}
        placeholder={options.placeholder || ''}
        placeholderTextColor={theme.colors.textSecondary}
        value={scoutingData[field]}
        onChangeText={(value) => updateField(field, value)}
        multiline={Boolean(options.multiline)}
        numberOfLines={options.multiline ? 4 : 1}
      />
    </View>
  );

  const renderChoiceRow = (label, field, options) => (
    <View style={styles.inputContainer} key={field}>
      <Text style={[styles.inputLabel, { color: theme.colors.text }]}>{label}</Text>
      <View style={styles.chipRow}>
        {options.map((option) => {
          const selected = scoutingData[field] === option;
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

  const renderRatingRow = (label, field) => (
    <View style={styles.inputContainer} key={field}>
      <Text style={[styles.inputLabel, { color: theme.colors.text }]}>{label}</Text>
      <View style={styles.ratingRow}>
        {[1, 2, 3, 4, 5].map((value) => {
          const selected = scoutingData[field] === value;
          return (
            <TouchableOpacity
              key={value}
              style={[
                styles.ratingButton,
                {
                  backgroundColor: selected ? theme.colors.primary : theme.colors.background,
                  borderColor: selected ? theme.colors.primary : theme.colors.border,
                },
              ]}
              onPress={() => updateField(field, value)}
            >
              <Text style={[styles.ratingButtonText, { color: selected ? '#fff' : theme.colors.text }]}>{value}</Text>
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
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Scout Team {teamNumber}</Text>
        <Text style={[styles.headerSubtitle, { color: theme.colors.textSecondary }]}>{matchData?.matchNumber}</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Auto</Text>
          {renderToggle('Was there an auto?', 'wasAuto')}
          {renderToggle('Conflicted with own alliance?', 'conflictedOwnAlliance')}
          {renderToggle('Conflicted with opposing alliance?', 'conflictedOpposingAlliance')}
          {renderToggle('Used outpost', 'usedOutpost')}
          {renderToggle('Used depot', 'usedDepot')}
          {renderNumberInput('# cycles?', 'cycles')}
          {renderNumberInput('Percent contributed', 'percentContributed')}
        </View>

        <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Robot Performance</Text>
          {renderToggle('Got disabled?', 'gotDisabled')}
          {renderRatingRow('Balls Per Second rating', 'bpsRating')}
          {renderChoiceRow('Primarily trench or bump?', 'primaryPath', PATH_OPTIONS)}
          {renderToggle('Index via intake?', 'indexViaIntake')}
          {renderRatingRow('Intake speed', 'intakeSpeed')}
          {renderChoiceRow('Shooter range', 'shooterRange', SHOOTER_RANGE_OPTIONS)}
          {renderTextInput('Obvious Penalties', 'obviousPenalties', { multiline: true, placeholder: 'Penalties, fouls, repeated issues...' })}
          {renderTextInput('Notes', 'notes', { multiline: true, placeholder: 'Anything else to remember...' })}
        </View>

        <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Climb</Text>
          {renderChoiceRow('Level', 'climbLevel', CLIMB_LEVELS)}
          {renderTextInput('Location', 'climbLocation', { placeholder: 'Center, side, buddy, etc.' })}
          {renderToggle('Attempted', 'accuracyAttempted')}
          {renderToggle('Successful', 'accuracySuccessful')}
        </View>

        <TouchableOpacity
          style={[styles.saveButton, { backgroundColor: theme.colors.primary, opacity: saving ? 0.6 : 1 }]}
          onPress={saveScoutingData}
          disabled={saving}
        >
          {saving ? <ActivityIndicator size="small" color="white" /> : <Ionicons name="save-outline" size={20} color="white" />}
          <Text style={styles.saveButtonText}>{saving ? 'Saving...' : 'Save Scouting Data'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingTop: 50, paddingBottom: 20, paddingHorizontal: 20, gap: 15 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', flex: 1 },
  headerSubtitle: { fontSize: 15, fontWeight: '500' },
  content: { flex: 1, paddingHorizontal: 20 },
  section: { padding: 16, borderRadius: 12, marginBottom: 16 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 16 },
  inputContainer: { marginBottom: 14 },
  inputLabel: { fontSize: 15, fontWeight: '600', marginBottom: 8 },
  textInput: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12, fontSize: 15 },
  notesInput: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12, fontSize: 15, minHeight: 96, textAlignVertical: 'top' },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, gap: 12 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choiceChip: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 18, borderWidth: 1 },
  choiceChipText: { fontSize: 14, fontWeight: '600' },
  ratingRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  ratingButton: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  ratingButtonText: { fontSize: 15, fontWeight: '700' },
  saveButton: { paddingVertical: 16, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, marginBottom: 30 },
  saveButtonText: { color: 'white', fontSize: 17, fontWeight: '700' },
});
