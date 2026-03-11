import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import apiService from '../utils/apiService';

const STRATEGY_OPTIONS = [
  '3 Offense',
  '2 Offense 1 Defense',
  '2 Offense 1 Feeder',
  '1 Offense 2 Feeders',
  '1,1,1',
  '3 Defense',
];
const AUTO_RESULTS = ['Won', 'Lost', 'Tied'];
const DEFENSE_QUALITY = ['Good', 'Bad'];

export default function AllianceScoutingForm({ route, navigation }) {
  const { theme } = useTheme();
  const { matchData, allianceColor } = route.params;
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    defensePlayed: false,
    defenseQuality: '',
    generalStrategy: [],
    notes: '',
    feedingDistance: '',
    autoPointsScored: '0',
    autoResult: '',
  });

  const allianceLabel = allianceColor === 'red' ? 'Red Alliance' : 'Blue Alliance';

  const updateField = (field, value) => setFormData((prev) => ({ ...prev, [field]: value }));
  const toggleStrategy = (option) => {
    setFormData((prev) => ({
      ...prev,
      generalStrategy: prev.generalStrategy.includes(option)
        ? prev.generalStrategy.filter((item) => item !== option)
        : [...prev.generalStrategy, option],
    }));
  };

  const saveAllianceScouting = async () => {
    try {
      setSaving(true);
      await apiService.submitAllianceScoutingData({
        match_key: matchData.matchKey || matchData.match_key,
        alliance_color: allianceColor,
        defense_played: formData.defensePlayed,
        defense_quality: formData.defenseQuality.toLowerCase(),
        general_strategy: formData.generalStrategy,
        notes: formData.notes.trim(),
        feeding_distance: formData.feedingDistance.trim(),
        auto_points_scored: Number(formData.autoPointsScored || 0),
        auto_result: formData.autoResult.toLowerCase(),
      });

      Alert.alert('Saved', `${allianceLabel} scouting for ${matchData.matchNumber} was saved.`, [
        { text: 'Keep Editing', style: 'cancel' },
        { text: 'Back', onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      Alert.alert('Error', error.message || 'Unable to save alliance scouting.');
    } finally {
      setSaving(false);
    }
  };

  const renderChoiceRow = (label, field, options) => (
    <View style={styles.inputContainer}>
      <Text style={[styles.inputLabel, { color: theme.colors.text }]}>{label}</Text>
      <View style={styles.chipRow}>
        {options.map((option) => {
          const selected = formData[field] === option;
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
        <View style={styles.headerText}>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Alliance Scouting</Text>
          <Text style={[styles.headerSubtitle, { color: theme.colors.textSecondary }]}>
            {matchData.matchNumber} · {allianceLabel}
          </Text>
        </View>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Alliance Summary</Text>
          {renderChoiceRow('Won or lost auto', 'autoResult', AUTO_RESULTS)}
          <View style={styles.switchRow}>
            <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Defense</Text>
            <Switch
              value={formData.defensePlayed}
              onValueChange={(value) => updateField('defensePlayed', value)}
              trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
              thumbColor="#FFFFFF"
            />
          </View>
          {renderChoiceRow('Good or bad defense', 'defenseQuality', DEFENSE_QUALITY)}
          <View style={styles.inputContainer}>
            <Text style={[styles.inputLabel, { color: theme.colors.text }]}>General strategy</Text>
            <View style={styles.chipRow}>
              {STRATEGY_OPTIONS.map((option) => {
                const selected = formData.generalStrategy.includes(option);
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
                    onPress={() => toggleStrategy(option)}
                  >
                    <Text style={[styles.choiceChipText, { color: selected ? '#fff' : theme.colors.text }]}>{option}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
          <View style={styles.inputContainer}>
            <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Feeding distance</Text>
            <TextInput
              style={[styles.textInput, { backgroundColor: theme.colors.background, borderColor: theme.colors.border, color: theme.colors.text }]}
              placeholder="Close, half field, full field..."
              placeholderTextColor={theme.colors.textSecondary}
              value={formData.feedingDistance}
              onChangeText={(value) => updateField('feedingDistance', value)}
            />
          </View>
          <View style={styles.inputContainer}>
            <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Auto points scored</Text>
            <TextInput
              style={[styles.textInput, { backgroundColor: theme.colors.background, borderColor: theme.colors.border, color: theme.colors.text }]}
              placeholder="0"
              placeholderTextColor={theme.colors.textSecondary}
              keyboardType="numeric"
              value={String(formData.autoPointsScored)}
              onChangeText={(value) => updateField('autoPointsScored', value.replace(/[^0-9]/g, ''))}
            />
          </View>
        </View>

        <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Notes</Text>
          <TextInput
            style={[styles.notesInput, { backgroundColor: theme.colors.background, borderColor: theme.colors.border, color: theme.colors.text }]}
            placeholder="Alliance tendencies, match plan, things drive team should know"
            placeholderTextColor={theme.colors.textSecondary}
            value={formData.notes}
            onChangeText={(value) => updateField('notes', value)}
            multiline
          />
        </View>

        <TouchableOpacity
          style={[styles.saveButton, { backgroundColor: theme.colors.primary, opacity: saving ? 0.6 : 1 }]}
          onPress={saveAllianceScouting}
          disabled={saving}
        >
          {saving ? <ActivityIndicator size="small" color="white" /> : <Ionicons name="save-outline" size={20} color="white" />}
          <Text style={styles.saveButtonText}>{saving ? 'Saving...' : 'Save Alliance Scouting'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingTop: 50, paddingBottom: 20, paddingHorizontal: 20, gap: 15 },
  headerText: { flex: 1 },
  headerTitle: { fontSize: 20, fontWeight: 'bold' },
  headerSubtitle: { fontSize: 15, marginTop: 4 },
  content: { flex: 1 },
  contentContainer: { paddingHorizontal: 20, paddingBottom: 30 },
  section: { padding: 16, borderRadius: 12, marginBottom: 16 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 16 },
  inputContainer: { marginBottom: 14 },
  inputLabel: { fontSize: 15, fontWeight: '600', marginBottom: 8 },
  textInput: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12, fontSize: 15 },
  notesInput: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12, fontSize: 15, minHeight: 120, textAlignVertical: 'top' },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choiceChip: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 18, borderWidth: 1 },
  choiceChipText: { fontSize: 14, fontWeight: '600' },
  saveButton: { paddingVertical: 16, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  saveButtonText: { color: 'white', fontSize: 17, fontWeight: '700' },
});
