import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

const PlatformCard = ({ 
  title, 
  description, 
  icon, 
  color = '#2196F3', 
  onPress,
  style,
  disabled = false 
}) => {
  const cardWidth = Platform.OS === 'web' && width > 768 ? '48%' : '100%';
  
  const platformSpecificStyles = {
    card: {
      ...styles.card,
      width: cardWidth,
      backgroundColor: color,
      // platform specific shadows
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: {
            width: 0,
            height: 2,
          },
          shadowOpacity: 0.25,
          shadowRadius: 3.84,
        },
        android: {
          elevation: 5,
        },
        web: {
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        },
      }),
    },
    pressable: {
      // platform specific press behavior
      ...Platform.select({
        ios: {
          transform: [{ scale: 0.98 }],
        },
        android: {
          opacity: 0.8,
        },
        web: {
          transform: [{ scale: 0.98 }],
          cursor: disabled ? 'not-allowed' : 'pointer',
        },
      }),
    },
  };

  const CardContent = () => (
    <View style={[platformSpecificStyles.card, style, disabled && styles.disabled]}>
      <View style={styles.iconContainer}>
        <Ionicons 
          name={icon} 
          size={Platform.OS === 'web' ? 28 : 32} 
          color="white" 
        />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
      
      {/* Platform indicator */}
      <View style={styles.platformIndicator}>
        <Text style={styles.platformText}>
          {Platform.OS.charAt(0).toUpperCase() + Platform.OS.slice(1)}
        </Text>
      </View>
    </View>
  );

  if (onPress && !disabled) {
    return (
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={Platform.OS === 'ios' ? 0.8 : 0.7}
        style={styles.touchable}
      >
        <CardContent />
      </TouchableOpacity>
    );
  }

  return <CardContent />;
};

const styles = StyleSheet.create({
  touchable: {
    marginBottom: 15,
  },
  card: {
    padding: 20,
    borderRadius: Platform.OS === 'ios' ? 12 : 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 160,
    marginBottom: 15,
  },
  disabled: {
    opacity: 0.6,
  },
  iconContainer: {
    marginBottom: 12,
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  title: {
    fontSize: Platform.OS === 'web' ? 20 : 18,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 8,
    textAlign: 'center',
  },
  description: {
    fontSize: Platform.OS === 'web' ? 16 : 14,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    lineHeight: Platform.OS === 'web' ? 22 : 20,
    marginBottom: 12,
  },
  platformIndicator: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  platformText: {
    fontSize: 10,
    color: 'white',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
});

export default PlatformCard;