import { Platform, Dimensions } from 'react-native';

export const getDeviceDimensions = () => {
  const { width, height } = Dimensions.get('window');
  return { width, height };
};

export const isTablet = () => {
  const { width, height } = getDeviceDimensions();
  const aspectRatio = width / height;
  return Math.min(width, height) >= 600 && (aspectRatio > 1.2 || aspectRatio < 0.9);
};

export const isLandscape = () => {
  const { width, height } = getDeviceDimensions();
  return width > height;
};

export const platformSelect = (values) => {
  return Platform.select(values);
};

export const platformStyles = {
  shadow: Platform.select({
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
  
  headerHeight: Platform.select({
    ios: 44,
    android: 56,
    web: 60,
  }),
  
  statusBarHeight: Platform.select({
    ios: 20,
    android: 0,
    web: 0,
  }),
  
  borderRadius: Platform.select({
    ios: 12,
    android: 8,
    web: 8,
  }),
};

export const breakpoints = {
  mobile: 0,
  tablet: 768,
  desktop: 1024,
  largeDesktop: 1440,
};

export const getResponsiveValue = (values) => {
  const { width } = getDeviceDimensions();
  
  if (width >= breakpoints.largeDesktop && values.largeDesktop !== undefined) {
    return values.largeDesktop;
  }
  if (width >= breakpoints.desktop && values.desktop !== undefined) {
    return values.desktop;
  }
  if (width >= breakpoints.tablet && values.tablet !== undefined) {
    return values.tablet;
  }
  return values.mobile || values.default;
};

export const getNavigationOptions = () => {
  return {
    headerStyle: {
      backgroundColor: platformSelect({
        ios: '#f8f9fa',
        android: '#2196F3',
        web: '#ffffff',
      }),
      height: platformStyles.headerHeight,
    },
    headerTintColor: platformSelect({
      ios: '#000',
      android: '#fff',
      web: '#333',
    }),
    headerTitleStyle: {
      fontWeight: 'bold',
      fontSize: platformSelect({
        ios: 17,
        android: 20,
        web: 18,
      }),
    },
  };
};

export const getButtonStyles = (variant = 'primary') => {
  const baseStyles = {
    paddingVertical: platformSelect({
      ios: 12,
      android: 14,
      web: 12,
    }),
    paddingHorizontal: 20,
    borderRadius: platformStyles.borderRadius,
    alignItems: 'center',
    justifyContent: 'center',
  };

  const variants = {
    primary: {
      backgroundColor: platformSelect({
        ios: '#007AFF',
        android: '#2196F3',
        web: '#4CAF50',
      }),
    },
    secondary: {
      backgroundColor: platformSelect({
        ios: '#8E8E93',
        android: '#757575',
        web: '#6c757d',
      }),
    },
    danger: {
      backgroundColor: platformSelect({
        ios: '#FF3B30',
        android: '#F44336',
        web: '#dc3545',
      }),
    },
  };

  return {
    ...baseStyles,
    ...variants[variant],
    ...platformStyles.shadow,
  };
};

export const getTextStyles = (variant = 'body') => {
  const variants = {
    title: {
      fontSize: platformSelect({
        ios: 28,
        android: 24,
        web: 32,
      }),
      fontWeight: 'bold',
    },
    subtitle: {
      fontSize: platformSelect({
        ios: 20,
        android: 18,
        web: 24,
      }),
      fontWeight: '600',
    },
    body: {
      fontSize: platformSelect({
        ios: 16,
        android: 16,
        web: 16,
      }),
      lineHeight: platformSelect({
        ios: 22,
        android: 24,
        web: 24,
      }),
    },
    caption: {
      fontSize: platformSelect({
        ios: 12,
        android: 12,
        web: 14,
      }),
      color: '#666',
    },
  };

  return variants[variant];
};

export const isIOS = Platform.OS === 'ios';
export const isAndroid = Platform.OS === 'android';
export const isWeb = Platform.OS === 'web';

export const getSafeAreaInsets = () => {
  return {
    top: platformSelect({
      ios: 44,
      android: 0,
      web: 0,
    }),
    bottom: platformSelect({
      ios: 34,
      android: 0,
      web: 0,
    }),
  };
};

export const getStatusBarHeight = () => {
  return platformStyles.statusBarHeight;
};

export const getPlatformShadow = (elevation = 1) => {
  if (Platform.OS === 'ios') {
    return {
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: elevation,
      },
      shadowOpacity: 0.1 * elevation,
      shadowRadius: 2 * elevation,
    };
  } else if (Platform.OS === 'android') {
    return {
      elevation: elevation * 2,
    };
  } else {
    return {
      boxShadow: `0 ${elevation}px ${elevation * 4}px rgba(0,0,0,${0.1 * elevation})`,
    };
  }
};

export const getPlatformElevation = (level = 1) => {
  return getPlatformShadow(level);
};

export const hapticFeedback = (type = 'light') => {
  if (Platform.OS === 'ios') {
    // TODO: iOS haptic feedback here
    console.log(`iOS Haptic feedback: ${type}`);
  } else if (Platform.OS === 'android') {
    // TODO: android haptic feedback here
    console.log(`Android Haptic feedback: ${type}`);
  }
};

export const platformUtils = {
  getDeviceDimensions,
  isTablet,
  isLandscape,
  platformSelect,
  platformStyles,
  breakpoints,
  getResponsiveValue,
  getNavigationOptions,
  getButtonStyles,
  getTextStyles,
  isIOS,
  isAndroid,
  isWeb,
  getSafeAreaInsets,
  getStatusBarHeight,
  getPlatformShadow,
  getPlatformElevation,
  hapticFeedback,
};

export default platformUtils;