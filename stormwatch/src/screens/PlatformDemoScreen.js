import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Platform,
  Dimensions,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');

export default function PlatformDemoScreen() {
  const [deviceInfo, setDeviceInfo] = useState({});
  const [orientation, setOrientation] = useState('portrait');

  useEffect(() => {
    const updateDeviceInfo = () => {
      const { width, height } = Dimensions.get('window');
      setDeviceInfo({
        platform: Platform.OS,
        version: Platform.Version,
        width: Math.round(width),
        height: Math.round(height),
        isTablet: width > 768,
        pixelRatio: Platform.OS !== 'web' ? require('react-native').PixelRatio.get() : 1,
      });
      setOrientation(width > height ? 'landscape' : 'portrait');
    };

    updateDeviceInfo();

    const subscription = Dimensions.addEventListener('change', updateDeviceInfo);
    return () => subscription?.remove();
  }, []);

  const showPlatformAlert = () => {
    if (Platform.OS === 'web') {
      window.alert('This is a web alert!');
    } else {
      Alert.alert(
        'Platform Alert',
        `This alert is shown on ${Platform.OS}`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'OK', style: 'default' },
        ]
      );
    }
  };

  const platformFeatures = [
    {
      title: 'Platform Detection',
      value: Platform.OS,
      icon: 'phone-portrait',
      color: '#FF6B6B',
    },
    {
      title: 'Platform Version',
      value: Platform.Version?.toString() || 'N/A',
      icon: 'information-circle',
      color: '#4ECDC4',
    },
    {
      title: 'Screen Dimensions',
      value: `${deviceInfo.width} x ${deviceInfo.height}`,
      icon: 'resize',
      color: '#45B7D1',
    },
    {
      title: 'Device Type',
      value: deviceInfo.isTablet ? 'Tablet' : 'Phone',
      icon: deviceInfo.isTablet ? 'tablet-portrait' : 'phone-portrait',
      color: '#96CEB4',
    },
    {
      title: 'Orientation',
      value: orientation,
      icon: orientation === 'landscape' ? 'phone-landscape' : 'phone-portrait',
      color: '#FECA57',
    },
    {
      title: 'Pixel Ratio',
      value: deviceInfo.pixelRatio?.toString() || 'N/A',
      icon: 'grid',
      color: '#FF9FF3',
    },
  ];

  const renderFeatureCard = (feature, index) => (
    <View key={index} style={[styles.featureCard, { borderLeftColor: feature.color }]}>
      <View style={styles.featureHeader}>
        <Ionicons name={feature.icon} size={24} color={feature.color} />
        <Text style={styles.featureTitle}>{feature.title}</Text>
      </View>
      <Text style={styles.featureValue}>{feature.value}</Text>
    </View>
  );

  const platformSpecificStyles = {
    ...styles,
    container: {
      ...styles.container,
      paddingTop: Platform.OS === 'ios' ? 0 : Platform.OS === 'android' ? 0 : 20,
    },
    button: {
      ...styles.button,
      backgroundColor: Platform.select({
        ios: '#007AFF',
        android: '#2196F3',
        web: '#4CAF50',
        default: '#2196F3',
      }),
    },
  };

  return (
    <View style={platformSpecificStyles.container}>
      {/* <StatusBar style="auto" /> */}
      
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Platform Demonstration</Text>
          <Text style={styles.headerSubtitle}>
            Showcasing platform-specific features and adaptations
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Device Information</Text>
          <View style={styles.featuresContainer}>
            {platformFeatures.map(renderFeatureCard)}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Platform-Specific Features</Text>
          
          <TouchableOpacity 
            style={platformSpecificStyles.button}
            onPress={showPlatformAlert}
            activeOpacity={0.8}
          >
            <Ionicons name="notifications" size={20} color="white" style={styles.buttonIcon} />
            <Text style={styles.buttonText}>Show Platform Alert</Text>
          </TouchableOpacity>

          <View style={styles.platformNote}>
            <Ionicons name="information-circle" size={20} color="#666" />
            <Text style={styles.platformNoteText}>
              {Platform.OS === 'web' 
                ? 'Web platform: Using browser alert'
                : Platform.OS === 'ios'
                ? 'iOS platform: Using native Alert API'
                : 'Android platform: Using native Alert API'
              }
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Responsive Design</Text>
          <View style={styles.responsiveDemo}>
            <Text style={styles.responsiveDemoText}>
              This layout adapts to different screen sizes:
            </Text>
            <Text style={styles.responsiveDemoDetail}>
              • Mobile: Single column layout
            </Text>
            <Text style={styles.responsiveDemoDetail}>
              • Tablet: Multi-column layout
            </Text>
            <Text style={styles.responsiveDemoDetail}>
              • Web: Optimized for desktop interaction
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
  },
  header: {
    marginBottom: 30,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  section: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  featuresContainer: {
    gap: 12,
  },
  featureCard: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 8,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.22,
    shadowRadius: 2.22,
    elevation: 3,
  },
  featureHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginLeft: 10,
  },
  featureValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    borderRadius: 8,
    marginBottom: 15,
  },
  buttonIcon: {
    marginRight: 8,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  platformNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#e3f2fd',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#2196F3',
  },
  platformNoteText: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  responsiveDemo: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.22,
    shadowRadius: 2.22,
    elevation: 3,
  },
  responsiveDemoText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },
  responsiveDemoDetail: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
    lineHeight: 20,
  },
});