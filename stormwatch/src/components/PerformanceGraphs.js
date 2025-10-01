import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions } from 'react-native';
import { LineChart, BarChart } from 'react-native-chart-kit';
import { useTheme } from '../contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';

const { width: screenWidth } = Dimensions.get('window');

export default function PerformanceGraphs({ matchScoutingData }) {
  const { theme } = useTheme();
  const [selectedMetric, setSelectedMetric] = useState('totalScored');
  const [selectedPeriod, setSelectedPeriod] = useState('all'); // 'auto', 'teleop', 'all'

  const processedData = useMemo(() => {
    if (!matchScoutingData || matchScoutingData.length === 0) {
      return null;
    }

    // sort data by match number 
    const sortedData = [...matchScoutingData].sort((a, b) => {
      const matchNumA = parseInt(a.match_key.replace(/\D/g, '')) || 0;
      const matchNumB = parseInt(b.match_key.replace(/\D/g, '')) || 0;
      return matchNumA - matchNumB;
    });

    return sortedData.map((match, index) => {
      const autoCoralScored = (match.auto_coral_l1 || 0) + (match.auto_coral_l2 || 0) + 
                             (match.auto_coral_l3 || 0) + (match.auto_coral_l4 || 0);
      const teleopCoralScored = (match.teleop_coral_l1 || 0) + (match.teleop_coral_l2 || 0) + 
                               (match.teleop_coral_l3 || 0) + (match.teleop_coral_l4 || 0);
      const totalCoralScored = autoCoralScored + teleopCoralScored;

      const autoAlgaeScored = (match.auto_algae_net || 0) + (match.auto_algae_processor || 0);
      const teleopAlgaeScored = (match.teleop_algae_net || 0) + (match.teleop_algae_processor || 0);
      const totalAlgaeScored = autoAlgaeScored + teleopAlgaeScored;

      const autoTotalScored = autoCoralScored + autoAlgaeScored + (match.auto_reef || 0);
      const teleopTotalScored = teleopCoralScored + teleopAlgaeScored + (match.teleop_reef || 0);
      const totalScored = autoTotalScored + teleopTotalScored;

      const avgPerformanceRating = ((match.defense_rating || 0) + (match.speed_rating || 0) + 
                                   (match.stability_rating || 0)) / 3;

      return {
        matchNumber: index + 1,
        matchKey: match.match_key,
        autoCoralScored,
        teleopCoralScored,
        totalCoralScored,
        autoAlgaeScored,
        teleopAlgaeScored,
        totalAlgaeScored,
        autoTotalScored,
        teleopTotalScored,
        totalScored,
        reefScored: (match.auto_reef || 0) + (match.teleop_reef || 0),
        climbTime: match.climb_time || 0,
        defenseRating: match.defense_rating || 0,
        speedRating: match.speed_rating || 0,
        stabilityRating: match.stability_rating || 0,
        avgPerformanceRating,
        autoMobility: match.auto_mobility ? 1 : 0,
        robotBroke: match.robot_broke ? 1 : 0,
        createdAt: match.created_at
      };
    });
  }, [matchScoutingData]);

  const chartConfig = {
    backgroundColor: theme.colors.surface,
    backgroundGradientFrom: theme.colors.surface,
    backgroundGradientTo: theme.colors.surface,
    decimalPlaces: 1,
    color: (opacity = 1) => `rgba(33, 150, 243, ${opacity})`,
    labelColor: (opacity = 1) => theme.colors.text,
    style: {
      borderRadius: 16,
    },
    propsForDots: {
      r: '4',
      strokeWidth: '2',
      stroke: theme.colors.primary,
    },
  };

  const getChartData = () => {
    if (!processedData) return null;

    let dataKey = selectedMetric;
    if (selectedPeriod === 'auto' && selectedMetric.includes('total')) {
      dataKey = selectedMetric.replace('total', 'auto');
    } else if (selectedPeriod === 'teleop' && selectedMetric.includes('total')) {
      dataKey = selectedMetric.replace('total', 'teleop');
    }

    const data = processedData.map(match => match[dataKey] || 0);
    const labels = processedData.map(match => `M${match.matchNumber}`);

    return {
      labels,
      datasets: [
        {
          data,
          color: (opacity = 1) => `rgba(33, 150, 243, ${opacity})`,
          strokeWidth: 2,
        },
      ],
    };
  };

  const metrics = [
    { key: 'totalScored', label: 'Total Scored', icon: 'trophy-outline' },
    { key: 'totalCoralScored', label: 'Coral Scored', icon: 'flower-outline' },
    { key: 'totalAlgaeScored', label: 'Algae Scored', icon: 'leaf-outline' },
    { key: 'reefScored', label: 'Reef Scored', icon: 'water-outline' },
    { key: 'avgPerformanceRating', label: 'Performance Rating', icon: 'star-outline' },
    { key: 'climbTime', label: 'Climb Time', icon: 'time-outline' },
  ];

  const periods = [
    { key: 'all', label: 'All Game' },
    { key: 'auto', label: 'Autonomous' },
    { key: 'teleop', label: 'Teleop' },
  ];

  if (!processedData || processedData.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.surface }]}>
        <View style={styles.noDataContainer}>
          <Ionicons name="analytics-outline" size={48} color={theme.colors.textSecondary} />
          <Text style={[styles.noDataText, { color: theme.colors.text }]}>
            No Match Data Available
          </Text>
          <Text style={[styles.noDataSubtext, { color: theme.colors.textSecondary }]}>
            Complete match scouting forms to see performance trends
          </Text>
        </View>
      </View>
    );
  }

  const chartData = getChartData();

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.surface }]}>
      {/* Metric Selection */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false} 
        style={styles.metricsContainer}
        contentContainerStyle={styles.metricsContent}
      >
        {metrics.map((metric) => (
          <TouchableOpacity
            key={metric.key}
            style={[
              styles.metricChip,
              { 
                backgroundColor: selectedMetric === metric.key 
                  ? theme.colors.primary 
                  : theme.colors.background 
              }
            ]}
            onPress={() => setSelectedMetric(metric.key)}
          >
            <Ionicons 
              name={metric.icon} 
              size={16} 
              color={selectedMetric === metric.key ? '#fff' : theme.colors.text} 
            />
            <Text style={[
              styles.metricChipText,
              { 
                color: selectedMetric === metric.key ? '#fff' : theme.colors.text 
              }
            ]}>
              {metric.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Period Selection (only show for scoring metrics) */}
      {selectedMetric.includes('Scored') && (
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false} 
          style={styles.periodsContainer}
          contentContainerStyle={styles.periodsContent}
        >
          {periods.map((period) => (
            <TouchableOpacity
              key={period.key}
              style={[
                styles.periodChip,
                { 
                  backgroundColor: selectedPeriod === period.key 
                    ? theme.colors.accent 
                    : theme.colors.background 
                }
              ]}
              onPress={() => setSelectedPeriod(period.key)}
            >
              <Text style={[
                styles.periodChipText,
                { 
                  color: selectedPeriod === period.key ? '#fff' : theme.colors.text 
                }
              ]}>
                {period.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Chart */}
      {chartData && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <LineChart
            data={chartData}
            width={Math.max(screenWidth - 40, processedData.length * 60)}
            height={220}
            chartConfig={chartConfig}
            bezier
            style={styles.chart}
            withInnerLines={false}
            withOuterLines={true}
            withVerticalLines={true}
            withHorizontalLines={true}
            fromZero={true}
          />
        </ScrollView>
      )}

      {/* Statistics Summary */}
      <View style={styles.summaryContainer}>
        <Text style={[styles.summaryTitle, { color: theme.colors.text }]}>
          Performance Summary
        </Text>
        <View style={styles.summaryGrid}>
          <View style={[styles.summaryItem, { backgroundColor: theme.colors.background }]}>
            <Text style={[styles.summaryLabel, { color: theme.colors.textSecondary }]}>
              Matches Played
            </Text>
            <Text style={[styles.summaryValue, { color: theme.colors.text }]}>
              {processedData.length}
            </Text>
          </View>
          <View style={[styles.summaryItem, { backgroundColor: theme.colors.background }]}>
            <Text style={[styles.summaryLabel, { color: theme.colors.textSecondary }]}>
              Avg Total Scored
            </Text>
            <Text style={[styles.summaryValue, { color: theme.colors.text }]}>
              {(processedData.reduce((sum, match) => sum + match.totalScored, 0) / processedData.length).toFixed(1)}
            </Text>
          </View>
          <View style={[styles.summaryItem, { backgroundColor: theme.colors.background }]}>
            <Text style={[styles.summaryLabel, { color: theme.colors.textSecondary }]}>
              Avg Coral Scored
            </Text>
            <Text style={[styles.summaryValue, { color: theme.colors.text }]}>
              {(processedData.reduce((sum, match) => sum + match.totalCoralScored, 0) / processedData.length).toFixed(1)}
            </Text>
          </View>
          <View style={[styles.summaryItem, { backgroundColor: theme.colors.background }]}>
            <Text style={[styles.summaryLabel, { color: theme.colors.textSecondary }]}>
              Avg Algae Scored
            </Text>
            <Text style={[styles.summaryValue, { color: theme.colors.text }]}>
              {(processedData.reduce((sum, match) => sum + match.totalAlgaeScored, 0) / processedData.length).toFixed(1)}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    borderRadius: 12,
  },
  noDataContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  noDataText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
  },
  noDataSubtext: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
  },
  metricsContainer: {
    marginBottom: 16,
  },
  metricsContent: {
    paddingRight: 16,
  },
  metricChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
  },
  metricChipText: {
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 4,
  },
  periodsContainer: {
    marginBottom: 16,
  },
  periodsContent: {
    paddingRight: 16,
  },
  periodChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
  },
  periodChipText: {
    fontSize: 12,
    fontWeight: '500',
  },
  chart: {
    marginVertical: 8,
    borderRadius: 16,
  },
  summaryContainer: {
    marginTop: 16,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  summaryItem: {
    flex: 1,
    minWidth: '45%',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 4,
  },
});