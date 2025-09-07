import { StyleSheet, Platform } from 'react-native';
import { platformStyles, getTextStyles } from '../utils/platformUtils';

export const colors = {
  primary: '#2196F3',
  secondary: '#4CAF50',
  accent: '#FF6B6B',
  background: '#f8f9fa',
  surface: '#ffffff',
  text: {
    primary: '#333333',
    secondary: '#666666',
    light: '#999999',
    inverse: '#ffffff',
  },
  border: '#e0e0e0',
  shadow: 'rgba(0, 0, 0, 0.1)',
  success: '#4CAF50',
  warning: '#FF9800',
  error: '#F44336',
  info: '#2196F3',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const typography = {
  h1: {
    ...getTextStyles('title'),
    fontSize: Platform.select({ ios: 32, android: 28, web: 36 }),
    lineHeight: Platform.select({ ios: 38, android: 34, web: 42 }),
  },
  h2: {
    ...getTextStyles('subtitle'),
    fontSize: Platform.select({ ios: 24, android: 22, web: 28 }),
    lineHeight: Platform.select({ ios: 30, android: 28, web: 34 }),
  },
  h3: {
    ...getTextStyles('subtitle'),
    fontSize: Platform.select({ ios: 20, android: 18, web: 24 }),
    lineHeight: Platform.select({ ios: 26, android: 24, web: 30 }),
  },
  body: getTextStyles('body'),
  caption: getTextStyles('caption'),
  button: {
    fontSize: Platform.select({ ios: 16, android: 16, web: 16 }),
    fontWeight: '600',
    textAlign: 'center',
  },
};

export const globalStyles = StyleSheet.create({
  // layout
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  
  safeArea: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  
  column: {
    flexDirection: 'column',
  },
  
  spaceBetween: {
    justifyContent: 'space-between',
  },
  
  spaceAround: {
    justifyContent: 'space-around',
  },
  
  // spacing
  padding: {
    padding: spacing.md,
  },
  
  paddingHorizontal: {
    paddingHorizontal: spacing.md,
  },
  
  paddingVertical: {
    paddingVertical: spacing.md,
  },
  
  margin: {
    margin: spacing.md,
  },
  
  marginHorizontal: {
    marginHorizontal: spacing.md,
  },
  
  marginVertical: {
    marginVertical: spacing.md,
  },
  
  // cards and surfaces
  card: {
    backgroundColor: colors.surface,
    borderRadius: platformStyles.borderRadius,
    padding: spacing.md,
    ...platformStyles.shadow,
  },
  
  surface: {
    backgroundColor: colors.surface,
    borderRadius: platformStyles.borderRadius,
  },
  
  // buttons
  button: {
    paddingVertical: spacing.sm + 4,
    paddingHorizontal: spacing.lg,
    borderRadius: platformStyles.borderRadius,
    alignItems: 'center',
    justifyContent: 'center',
    ...platformStyles.shadow,
  },
  
  buttonPrimary: {
    backgroundColor: colors.primary,
  },
  
  buttonSecondary: {
    backgroundColor: colors.secondary,
  },
  
  buttonText: {
    ...typography.button,
    color: colors.text.inverse,
  },
  
  buttonTextSecondary: {
    ...typography.button,
    color: colors.text.primary,
  },
  
  // text styles
  textPrimary: {
    color: colors.text.primary,
  },
  
  textSecondary: {
    color: colors.text.secondary,
  },
  
  textLight: {
    color: colors.text.light,
  },
  
  textInverse: {
    color: colors.text.inverse,
  },
  
  textCenter: {
    textAlign: 'center',
  },
  
  textBold: {
    fontWeight: 'bold',
  },
  
  // borders
  border: {
    borderWidth: 1,
    borderColor: colors.border,
  },
  
  borderTop: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  
  borderBottom: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  
  // shadows
  shadow: platformStyles.shadow,
  
  shadowLight: Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: 1,
      },
      shadowOpacity: 0.18,
      shadowRadius: 1.0,
    },
    android: {
      elevation: 2,
    },
    web: {
      boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
    },
  }),
  
  shadowHeavy: Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: 4,
      },
      shadowOpacity: 0.30,
      shadowRadius: 4.65,
    },
    android: {
      elevation: 8,
    },
    web: {
      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
    },
  }),
  
  // status colors
  success: {
    backgroundColor: colors.success,
  },
  
  warning: {
    backgroundColor: colors.warning,
  },
  
  error: {
    backgroundColor: colors.error,
  },
  
  info: {
    backgroundColor: colors.info,
  },
  
  // utility
  hidden: {
    display: 'none',
  },
  
  absolute: {
    position: 'absolute',
  },
  
  relative: {
    position: 'relative',
  },
  
  fullWidth: {
    width: '100%',
  },
  
  fullHeight: {
    height: '100%',
  },
  
  flex1: {
    flex: 1,
  },
  
  // platform specific styles
  iosOnly: Platform.select({
    ios: {},
    default: { display: 'none' },
  }),
  
  androidOnly: Platform.select({
    android: {},
    default: { display: 'none' },
  }),
  
  webOnly: Platform.select({
    web: {},
    default: { display: 'none' },
  }),
});

export default {
  colors,
  spacing,
  typography,
  globalStyles,
};