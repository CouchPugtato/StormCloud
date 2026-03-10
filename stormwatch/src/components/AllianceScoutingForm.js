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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import apiService from '../utils/apiService';

export default function AllianceScoutingForm({ route, navigation }) {
  const { theme } = useTheme();
  const { matchData, allianceColor } = route.params;
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    scoutName: '',
    generalInfo: '',
    notes: '',
  });

  const allianceLabel = allianceColor === 'red' ? 'Red Alliance' : 'Blue Alliance';

  const updateField = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const saveAllianceScouting = async () => {
    try {
      setSaving(true);
      await apiService.submitAllianceScoutingData({
        match_key: matchData.matchKey,
        alliance_color: allianceColor,
        scout_name: formData.scoutName,
        general_info: formData.generalInfo,
        notes: formData.notes,
      });

      Alert.alert(
        'Saved',
        `${allianceLabel} notes for ${matchData.matchNumber} were saved.`,
        [
          { text: 'Keep Editing', style: 'cancel' },
          { text: 'Back', onPress: () => navigation.goBack() },
        ]
      );
    } catch (error) {
      Alert.alert('Error', error.message || 'Unable to save alliance scouting.');
    } finally {
      setSaving(false);
    }
  };

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
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>General Info</Text>
          <TextInput
            style={[
              styles.textInput,
              {
                backgroundColor: theme.colors.background,
                color: theme.colors.text,
                borderColor: theme.colors.border,
              },
            ]}
            placeholder="Scout name"
            placeholderTextColor={theme.colors.textSecondary}
            value={formData.scoutName}
            onChangeText={(value) => updateField('scoutName', value)}
          />
          <TextInput
            style={[
              styles.notesInput,
              {
                backgroundColor: theme.colors.background,
                color: theme.colors.text,
                borderColor: theme.colors.border,
              },
            ]}
            placeholder="General alliance info, tendencies, and quick takeaways"
            placeholderTextColor={theme.colors.textSecondary}
            value={formData.generalInfo}
            onChangeText={(value) => updateField('generalInfo', value)}
            multiline
          />
        </View>

        <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Notes</Text>
          <TextInput
            style={[
              styles.notesInput,
              {
                backgroundColor: theme.colors.background,
                color: theme.colors.text,
                borderColor: theme.colors.border,
              },
            ]}
            placeholder="Alliance-specific notes, plans, strengths, weaknesses, and anything drive team should know"
            placeholderTextColor={theme.colors.textSecondary}
            value={formData.notes}
            onChangeText={(value) => updateField('notes', value)}
            multiline
          />
        </View>

        <TouchableOpacity
          style={[
            styles.saveButton,
            { backgroundColor: theme.colors.primary, opacity: saving ? 0.6 : 1 },
          ]}
          onPress={saveAllianceScouting}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <Ionicons name="save-outline" size={20} color="white" />
          )}
          <Text style={[styles.saveButtonText, { marginLeft: saving ? 0 : 8 }]}>
            {saving ? 'Saving...' : 'Save Alliance Scouting'}
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
  headerText: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    fontSize: 15,
    marginTop: 4,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 20,
    paddingBottom: 30,
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
  textInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 12,
  },
  notesInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    textAlignVertical: 'top',
    minHeight: 120,
  },
  saveButton: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  saveButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
