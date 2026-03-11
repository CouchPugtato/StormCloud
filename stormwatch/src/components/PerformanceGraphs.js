import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { useTheme } from '../contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';

const { width: screenWidth } = Dimensions.get('window');

export default function PerformanceGraphs({ matchScoutingData }) {
  const { theme } = useTheme();
  const [selectedMetric, setSelectedMetric] = useState('cycles');

  const processedData = useMemo(() => {
    if (!matchScoutingData || matchScoutingData.length === 0) {
      return null;
    }

    const sortedData = [...matchScoutingData].sort((a, b) => {
      const matchNumA = parseInt(String(a.match_key || '').replace(/\D/g, ''), 10) || 0;
      const matchNumB = parseInt(String(b.match_key || '').replace(/\D/g, ''), 10) || 0;
      return matchNumA - matchNumB;
    });

    return sortedData.map((match, index) => ({
      matchNumber: index + 1,
      matchKey: match.match_key,
      cycles: match.cycles || 0,
      percentContributed: match.percent_contributed || 0,
      autoPointsContributed: match.auto_points_contributed || 0,
      bpsRating: match.bps_rating || 0,
      intakeSpeed: match.intake_speed || 0,
      accuracyPercentage: match.accuracy_successful ? 100 : (match.accuracy_attempted ? 0 : 0),
      disabled: match.got_disabled ? 1 : 0,
      autoRan: match.was_auto ? 1 : 0,
    }));
  }, [matchScoutingData]);

  const metrics = [
    { key: 'cycles', label: 'Cycles', icon: 'repeat-outline' },
    { key: 'percentContributed', label: '% Contributed', icon: 'pie-chart-outline' },
    { key: 'autoPointsContributed', label: 'Auto Points', icon: 'flash-outline' },
    { key: 'bpsRating', label: 'BPS Rating', icon: 'speedometer-outline' },
    { key: 'intakeSpeed', label: 'Intake Speed', icon: 'download-outline' },
    { key: 'accuracyPercentage', label: 'Accuracy %', icon: 'checkmark-circle-outline' },
  ];

  if (!processedData || processedData.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.surface }]}>
        <View style={styles.noDataContainer}>
          <Ionicons name="analytics-outline" size={48} color={theme.colors.textSecondary} />
          <Text style={[styles.noDataText, { color: theme.colors.text }]}>No Match Data Available</Text>
          <Text style={[styles.noDataSubtext, { color: theme.colors.textSecondary }]}>Complete 2026 match scouting forms to see trends.</Text>
        </View>
      </View>
    );
  }

  const chartData = {
    labels: processedData.map((match) => `M${match.matchNumber}`),
    datasets: [
      {
        data: processedData.map((match) => match[selectedMetric] || 0),
        color: (opacity = 1) => `rgba(33, 150, 243, ${opacity})`,
        strokeWidth: 2,
      },
    ],
  };

  const chartConfig = {
    backgroundColor: theme.colors.surface,
    backgroundGradientFrom: theme.colors.surface,
    backgroundGradientTo: theme.colors.surface,
    decimalPlaces: 1,
    color: (opacity = 1) => `rgba(33, 150, 243, ${opacity})`,
    labelColor: () => theme.colors.text,
    style: { borderRadius: 16 },
    propsForDots: { r: '4', strokeWidth: '2', stroke: theme.colors.primary },
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.surface }]}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.metricsContainer} contentContainerStyle={styles.metricsContent}>
        {metrics.map((metric) => {
          const selected = selectedMetric === metric.key;
          return (
            <TouchableOpacity
              key={metric.key}
              style={[styles.metricChip, { backgroundColor: selected ? theme.colors.primary : theme.colors.background }]}
              onPress={() => setSelectedMetric(metric.key)}
            >
              <Ionicons name={metric.icon} size={16} color={selected ? '#fff' : theme.colors.text} />
              <Text style={[styles.metricChipText, { color: selected ? '#fff' : theme.colors.text }]}>{metric.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <LineChart
          data={chartData}
          width={Math.max(screenWidth - 40, processedData.length * 60)}
          height={220}
          chartConfig={chartConfig}
          bezier
          style={styles.chart}
          fromZero
        />
      </ScrollView>

      <View style={styles.summaryContainer}>
        <Text style={[styles.summaryTitle, { color: theme.colors.text }]}>Performance Summary</Text>
        <View style={styles.summaryGrid}>
          <View style={[styles.summaryItem, { backgroundColor: theme.colors.background }]}>
            <Text style={[styles.summaryLabel, { color: theme.colors.textSecondary }]}>Matches</Text>
            <Text style={[styles.summaryValue, { color: theme.colors.text }]}>{processedData.length}</Text>
          </View>
          <View style={[styles.summaryItem, { backgroundColor: theme.colors.background }]}>
            <Text style={[styles.summaryLabel, { color: theme.colors.textSecondary }]}>Avg Cycles</Text>
            <Text style={[styles.summaryValue, { color: theme.colors.text }]}>{(processedData.reduce((sum, match) => sum + match.cycles, 0) / processedData.length).toFixed(1)}</Text>
          </View>
          <View style={[styles.summaryItem, { backgroundColor: theme.colors.background }]}>
            <Text style={[styles.summaryLabel, { color: theme.colors.textSecondary }]}>Avg Accuracy</Text>
            <Text style={[styles.summaryValue, { color: theme.colors.text }]}>{(processedData.reduce((sum, match) => sum + match.accuracyPercentage, 0) / processedData.length).toFixed(0)}%</Text>
          </View>
          <View style={[styles.summaryItem, { backgroundColor: theme.colors.background }]}>
            <Text style={[styles.summaryLabel, { color: theme.colors.textSecondary }]}>Avg BPS</Text>
            <Text style={[styles.summaryValue, { color: theme.colors.text }]}>{(processedData.reduce((sum, match) => sum + match.bpsRating, 0) / processedData.length).toFixed(1)}</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, borderRadius: 12 },
  noDataContainer: { alignItems: 'center', paddingVertical: 40 },
  noDataText: { fontSize: 18, fontWeight: '600', marginTop: 16 },
  noDataSubtext: { fontSize: 14, textAlign: 'center', marginTop: 8 },
  metricsContainer: { marginBottom: 16 },
  metricsContent: { paddingRight: 16 },
  metricChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, marginRight: 8 },
  metricChipText: { fontSize: 12, fontWeight: '500', marginLeft: 4 },
  chart: { marginVertical: 8, borderRadius: 16 },
  summaryContainer: { marginTop: 16 },
  summaryTitle: { fontSize: 16, fontWeight: '600', marginBottom: 12 },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  summaryItem: { flex: 1, minWidth: '45%', padding: 12, borderRadius: 8, alignItems: 'center' },
  summaryLabel: { fontSize: 12, fontWeight: '500', textAlign: 'center' },
  summaryValue: { fontSize: 18, fontWeight: '700', marginTop: 4 },
});
