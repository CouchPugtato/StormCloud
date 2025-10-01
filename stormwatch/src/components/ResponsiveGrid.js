import React from 'react';
import {
  View,
  StyleSheet,
  Platform,
  Dimensions,
} from 'react-native';

const { width } = Dimensions.get('window');

const ResponsiveGrid = ({ 
  children, 
  spacing = 15, 
  minItemWidth = 280,
  style 
}) => {
  // calculate number of columns based on screen width
  const getColumns = () => {
    if (Platform.OS === 'web') {
      // web responsive breakpoints
      if (width >= 1200) return 3; // desktop
      if (width >= 768) return 2;  // tablet
      return 1; // mobile
    } else {
      if (width >= 768) return 2; // tablet
      return 1; // mobile
    }
  };

  const columns = getColumns();
  const itemWidth = columns === 1 
    ? '100%' 
    : `${(100 / columns) - (spacing * (columns - 1)) / columns}%`;

  const renderChildren = () => {
    if (!Array.isArray(children)) {
      return children;
    }

    return children.map((child, index) => {
      if (!child) return null;
      
      return (
        <View 
          key={index} 
          style={[
            styles.gridItem,
            {
              width: itemWidth,
              marginBottom: spacing,
              marginRight: (index + 1) % columns === 0 ? 0 : spacing,
            }
          ]}
        >
          {child}
        </View>
      );
    });
  };

  return (
    <View style={[styles.container, style]}>
      <View style={[styles.grid, { marginRight: -spacing }]}>
        {renderChildren()}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
  },
  gridItem: {
    // base styles for grid items
  },
});

export default ResponsiveGrid;