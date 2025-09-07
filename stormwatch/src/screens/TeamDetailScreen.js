import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Dimensions,
  Image,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';

const { width } = Dimensions.get('window');

export default function TeamDetailScreen({ navigation, route }) {
  const { theme, isDarkMode } = useTheme();
  const { teamNumber } = route.params || { teamNumber: '0000' };
  
  // mock data
  const teamData = {
    number: teamNumber,
    name: `Team ${teamNumber}`,
    location: 'City, State, Country',
    icon: null, // should be team logo URL
    epa: {
      overall: 85.2,
      auto: 22.5,
      teleop: 45.8,
      endgame: 16.9
    },
    pitScouting: {
      weight: '',
      dimensions: '',
      drivebase: '',
      notes: ''
    }
  };
  
  const [pitData, setPitData] = useState(teamData.pitScouting);
  const [notes, setNotes] = useState('');

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <StatusBar style={theme.colors.statusBar} />
      
      <ScrollView 
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <LinearGradient
          colors={isDarkMode ? [theme.colors.primary, '#FF6B6B'] : ['#2196F3', '#1976D2']}
          style={styles.header}
        >
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Team {teamNumber}</Text>
          <Text style={styles.headerSubtitle}>
            Detailed Team Analysis & Performance
          </Text>
        </LinearGradient>
        {/* Team Summary Section */}
        <View style={[styles.summarySection, { backgroundColor: theme.colors.surface }]}>
          <View style={styles.teamHeader}>
            <View style={[styles.teamIcon, { backgroundColor: theme.colors.primary }]}>
              <Text style={styles.teamIconText}>{teamNumber}</Text>
            </View>
            <View style={styles.teamInfo}>
              <Text style={[styles.teamName, { color: theme.colors.text }]}>{teamData.name}</Text>
              <Text style={[styles.teamLocation, { color: theme.colors.textSecondary }]}>
                <Ionicons name="location-outline" size={16} color={theme.colors.textSecondary} />
                {' '}{teamData.location}
              </Text>
            </View>
          </View>
        </View>

        {/* EPA Metrics Section */}
        <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>EPA Metrics (Statbotics)</Text>
          <View style={styles.metricsGrid}>
            <View style={[styles.metricCard, { backgroundColor: theme.colors.background }]}>
              <Text style={[styles.metricValue, { color: theme.colors.primary }]}>{teamData.epa.overall}</Text>
              <Text style={[styles.metricLabel, { color: theme.colors.textSecondary }]}>Overall EPA</Text>
            </View>
            <View style={[styles.metricCard, { backgroundColor: theme.colors.background }]}>
              <Text style={[styles.metricValue, { color: '#4CAF50' }]}>{teamData.epa.auto}</Text>
              <Text style={[styles.metricLabel, { color: theme.colors.textSecondary }]}>Auto EPA</Text>
            </View>
            <View style={[styles.metricCard, { backgroundColor: theme.colors.background }]}>
              <Text style={[styles.metricValue, { color: '#FF9800' }]}>{teamData.epa.teleop}</Text>
              <Text style={[styles.metricLabel, { color: theme.colors.textSecondary }]}>Teleop EPA</Text>
            </View>
            <View style={[styles.metricCard, { backgroundColor: theme.colors.background }]}>
              <Text style={[styles.metricValue, { color: '#9C27B0' }]}>{teamData.epa.endgame}</Text>
              <Text style={[styles.metricLabel, { color: theme.colors.textSecondary }]}>Endgame EPA</Text>
            </View>
          </View>
        </View>

        {/* Performance Graphs Section */}
        <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Performance Graphs</Text>
          <View style={[styles.graphPlaceholder, { backgroundColor: theme.colors.background }]}>
            <Ionicons name="bar-chart-outline" size={48} color={theme.colors.textSecondary} />
            <Text style={[styles.graphText, { color: theme.colors.textSecondary }]}>
              EPA Trend Analysis
            </Text>
            <Text style={[styles.graphSubtext, { color: theme.colors.textSecondary }]}>
              Historical performance data visualization
            </Text>
          </View>
          <View style={[styles.graphPlaceholder, { backgroundColor: theme.colors.background }]}>
            <Ionicons name="analytics-outline" size={48} color={theme.colors.textSecondary} />
            <Text style={[styles.graphText, { color: theme.colors.textSecondary }]}>
              Match Performance Breakdown
            </Text>
            <Text style={[styles.graphSubtext, { color: theme.colors.textSecondary }]}>
              Auto, Teleop, and Endgame contributions
            </Text>
          </View>
        </View>

        {/* Pit Scouting Section */}
        <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Pit Scouting Summary</Text>
          <View style={styles.formRow}>
            <Text style={[styles.formLabel, { color: theme.colors.text }]}>Robot Weight (lbs):</Text>
            <TextInput
              style={[styles.formInput, { backgroundColor: theme.colors.background, color: theme.colors.text, borderColor: theme.colors.border }]}
              value={pitData.weight}
              onChangeText={(text) => setPitData({...pitData, weight: text})}
              placeholder="Enter weight"
              placeholderTextColor={theme.colors.textSecondary}
              keyboardType="numeric"
            />
          </View>
          <View style={styles.formRow}>
            <Text style={[styles.formLabel, { color: theme.colors.text }]}>Dimensions (L×W×H):</Text>
            <TextInput
              style={[styles.formInput, { backgroundColor: theme.colors.background, color: theme.colors.text, borderColor: theme.colors.border }]}
              value={pitData.dimensions}
              onChangeText={(text) => setPitData({...pitData, dimensions: text})}
              placeholder="e.g., 28×32×48 inches"
              placeholderTextColor={theme.colors.textSecondary}
            />
          </View>
          <View style={styles.formRow}>
            <Text style={[styles.formLabel, { color: theme.colors.text }]}>Drivebase Type:</Text>
            <TextInput
              style={[styles.formInput, { backgroundColor: theme.colors.background, color: theme.colors.text, borderColor: theme.colors.border }]}
              value={pitData.drivebase}
              onChangeText={(text) => setPitData({...pitData, drivebase: text})}
              placeholder="e.g., Tank, Mecanum, Swerve"
              placeholderTextColor={theme.colors.textSecondary}
            />
          </View>
          <View style={styles.formRow}>
            <Text style={[styles.formLabel, { color: theme.colors.text }]}>Additional Notes:</Text>
            <TextInput
              style={[styles.formTextArea, { backgroundColor: theme.colors.background, color: theme.colors.text, borderColor: theme.colors.border }]}
              value={pitData.notes}
              onChangeText={(text) => setPitData({...pitData, notes: text})}
              placeholder="Robot capabilities, special features, etc."
              placeholderTextColor={theme.colors.textSecondary}
              multiline
              numberOfLines={3}
            />
          </View>
        </View>

        {/* Notes Section */}
        <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Scouting Notes</Text>
          <TextInput
            style={[styles.notesTextArea, { backgroundColor: theme.colors.background, color: theme.colors.text, borderColor: theme.colors.border }]}
            value={notes}
            onChangeText={setNotes}
            placeholder="Add your observations, strategies, and notes about this team..."
            placeholderTextColor={theme.colors.textSecondary}
            multiline
            numberOfLines={6}
          />
        </View>

        <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Performance Metrics</Text>
          <Text style={[styles.sectionText, { color: theme.colors.textSecondary }]}>
            Match statistics, scoring averages, ranking points, and performance trends 
            will be displayed here for detailed team analysis.
          </Text>
        </View>

        <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Match History</Text>
          <Text style={[styles.sectionText, { color: theme.colors.textSecondary }]}>
            Complete match history with alliance partners, opponents, scores, 
            and performance breakdown for each qualification and elimination match.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: 60,
    paddingBottom: 30,
    paddingHorizontal: 20,
    alignItems: 'center',
    position: 'relative',
    marginBottom: 20,
  },
  backButton: {
    position: 'absolute',
    left: 20,
    top: 60,
    padding: 8,
  },
  headerTitle: {
    fontSize: 28,
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
  teamHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  teamIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  teamIconText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  teamInfo: {
    flex: 1,
  },
  teamName: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  teamLocation: {
    fontSize: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  section: {
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
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  metricCard: {
    width: (width - 80) / 2,
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  metricValue: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  metricLabel: {
    fontSize: 12,
    textAlign: 'center',
  },
  graphPlaceholder: {
    height: 120,
    borderRadius: 8,
    marginBottom: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
    borderStyle: 'dashed',
  },
  graphText: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 8,
  },
  graphSubtext: {
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
  },
  formRow: {
    marginBottom: 16,
  },
  formLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  formInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  formTextArea: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  notesTextArea: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    minHeight: 120,
    textAlignVertical: 'top',
  },
  sectionText: {
    fontSize: 16,
    lineHeight: 24,
  },
});