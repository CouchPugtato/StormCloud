# StormWatch - Cross-Platform React Native Demo

![StormWatch Logo](./assets/icon.png)

A comprehensive React Native demonstration project showcasing cross-platform compatibility for iOS, Android, and web deployment. This project demonstrates modern mobile development practices, responsive design, and platform-specific adaptations.

## 🚀 Features

- **Cross-Platform Compatibility**: Runs natively on iOS, Android, and web browsers
- **Responsive Design**: Adaptive layouts that work across all screen sizes
- **Platform-Specific Adaptations**: Tailored UI/UX for each platform
- **Modern Navigation**: Tab and stack navigation with React Navigation
- **Component Architecture**: Reusable, well-structured components
- **Platform Detection**: Dynamic feature adaptation based on the running platform
- **Progressive Web App (PWA)**: Web version with offline capabilities

## 📱 Supported Platforms

| Platform | Status | Notes |
|----------|--------|---------|
| iOS | ✅ | Requires macOS for development |
| Android | ✅ | Works on Windows, macOS, Linux |
| Web | ✅ | Runs in all modern browsers |

## 🛠 Prerequisites

Before running this project, ensure you have the following installed:

### General Requirements
- [Node.js](https://nodejs.org/) (v16 or later)
- [npm](https://www.npmjs.com/) or [Yarn](https://yarnpkg.com/)
- [Expo CLI](https://docs.expo.dev/get-started/installation/)

### Platform-Specific Requirements

#### iOS Development
- macOS (required)
- [Xcode](https://developer.apple.com/xcode/) (latest version)
- iOS Simulator (included with Xcode)
- Apple Developer Account (for device testing)

#### Android Development
- [Android Studio](https://developer.android.com/studio)
- Android SDK (API level 21 or higher)
- Android Emulator or physical device
- Java Development Kit (JDK 11 or later)

#### Web Development
- Modern web browser (Chrome, Firefox, Safari, Edge)
- No additional requirements

## 📦 Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd stormwatch
   ```

2. **Install dependencies**
   ```bash
   npm install
   # or
   yarn install
   ```

3. **Install Expo CLI globally** (if not already installed)
   ```bash
   npm install -g @expo/cli
   ```

## 🚀 Running the Application

### Development Mode

#### Start the Development Server
```bash
npm start
# or
yarn start
# or
expo start
```

This will start the Expo development server and open the Expo DevTools in your browser.

#### Platform-Specific Commands

**iOS Simulator**
```bash
npm run ios
# or
yarn ios
# or
expo start --ios
```

**Android Emulator/Device**
```bash
npm run android
# or
yarn android
# or
expo start --android
```

**Web Browser**
```bash
npm run web
# or
yarn web
# or
expo start --web
```

### Using Expo Go App

1. Install [Expo Go](https://expo.dev/client) on your mobile device
2. Start the development server: `expo start`
3. Scan the QR code with:
   - **iOS**: Camera app or Expo Go
   - **Android**: Expo Go app

## 🏗 Building for Production

### Web Build
```bash
# Build for web
expo build:web

# The built files will be in the 'web-build' directory
# Deploy these files to any static hosting service
```

### iOS Build
```bash
# Build for iOS (requires macOS)
expo build:ios

# For App Store submission
expo build:ios --type archive
```

### Android Build
```bash
# Build APK for testing
expo build:android --type apk

# Build AAB for Google Play Store
expo build:android --type app-bundle
```

## 📁 Project Structure

```
stormwatch/
├── src/
│   ├── components/          # Reusable UI components
│   │   ├── PlatformCard.js  # Platform-aware card component
│   │   └── ResponsiveGrid.js # Responsive grid layout
│   ├── navigation/          # Navigation configuration
│   │   └── AppNavigator.js  # Main navigation setup
│   ├── screens/            # Screen components
│   │   ├── HomeScreen.js   # Main dashboard
│   │   ├── PlatformDemoScreen.js # Platform features demo
│   │   ├── ProfileScreen.js # User profile
│   │   └── SettingsScreen.js # App settings
│   ├── styles/             # Global styles and themes
│   │   └── globalStyles.js # Shared styling constants
│   └── utils/              # Utility functions
│       └── platformUtils.js # Platform detection utilities
├── assets/                 # Static assets (images, icons)
├── web-build/             # Web build output
├── App.js                 # Main app component
├── app.json              # Expo configuration
├── package.json          # Dependencies and scripts
└── README.md            # This file
```

## 🎨 Key Components

### Navigation
- **Bottom Tab Navigation**: Main app navigation
- **Stack Navigation**: Screen transitions within tabs
- **Platform-specific styling**: Adaptive navigation appearance

### Screens
1. **Home Screen**: Welcome dashboard with feature overview
2. **Platform Demo**: Showcases platform-specific features
3. **Profile Screen**: User profile with responsive design
4. **Settings Screen**: App configuration and information

### Components
- **PlatformCard**: Adaptive card component with platform indicators
- **ResponsiveGrid**: Flexible grid layout for different screen sizes

## 🔧 Configuration

### Expo Configuration (app.json)
The `app.json` file contains platform-specific configurations:

```json
{
  "expo": {
    "name": "StormWatch",
    "slug": "stormwatch",
    "platforms": ["ios", "android", "web"],
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "splash": {
      "image": "./assets/splash-icon.png",
      "resizeMode": "contain",
      "backgroundColor": "#ffffff"
    },
    "updates": {
      "fallbackToCacheTimeout": 0
    },
    "assetBundlePatterns": ["**/*"],
    "ios": {
      "supportsTablet": true
    },
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#FFFFFF"
      }
    },
    "web": {
      "favicon": "./assets/favicon.png"
    }
  }
}
```

## 🌐 Deployment

### Web Deployment

**Netlify**
1. Build the project: `expo build:web`
2. Deploy the `web-build` folder to Netlify

**Vercel**
1. Build the project: `expo build:web`
2. Deploy the `web-build` folder to Vercel

**GitHub Pages**
1. Build the project: `expo build:web`
2. Push the `web-build` contents to a `gh-pages` branch

### Mobile App Stores

**iOS App Store**
1. Build: `expo build:ios --type archive`
2. Download the `.ipa` file
3. Upload to App Store Connect using Xcode or Application Loader

**Google Play Store**
1. Build: `expo build:android --type app-bundle`
2. Download the `.aab` file
3. Upload to Google Play Console

## 🧪 Testing

### Manual Testing Checklist
- [ ] App launches successfully on all platforms
- [ ] Navigation works correctly
- [ ] Responsive design adapts to different screen sizes
- [ ] Platform-specific features work as expected
- [ ] Performance is acceptable on target devices

### Automated Testing
```bash
# Run tests (when implemented)
npm test
# or
yarn test
```

## 🔍 Troubleshooting

### Common Issues

**Metro bundler issues**
```bash
# Clear cache and restart
expo start --clear
```

**iOS Simulator not opening**
- Ensure Xcode is installed and updated
- Check that iOS Simulator is available
- Try: `expo start --ios --simulator="iPhone 14"`

**Android emulator issues**
- Ensure Android Studio is installed
- Check that an Android Virtual Device (AVD) is created
- Verify Android SDK is properly configured

**Web build issues**
- Clear node_modules: `rm -rf node_modules && npm install`
- Clear Expo cache: `expo start --clear`

### Performance Optimization

1. **Bundle Size**: Use `expo bundle-size` to analyze bundle size
2. **Images**: Optimize images for different screen densities
3. **Code Splitting**: Implement lazy loading for screens
4. **Memory**: Monitor memory usage on lower-end devices

## 📚 Learning Resources

- [React Native Documentation](https://reactnative.dev/docs/getting-started)
- [Expo Documentation](https://docs.expo.dev/)
- [React Navigation](https://reactnavigation.org/docs/getting-started)
- [Platform-specific Code](https://reactnative.dev/docs/platform-specific-code)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/new-feature`
3. Commit changes: `git commit -am 'Add new feature'`
4. Push to branch: `git push origin feature/new-feature`
5. Submit a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- React Native team for the amazing framework
- Expo team for simplifying cross-platform development
- React Navigation for excellent navigation solutions
- The open-source community for inspiration and resources

## 📞 Support

If you encounter any issues or have questions:

1. Check the [troubleshooting section](#-troubleshooting)
2. Search existing [GitHub issues](https://github.com/your-repo/issues)
3. Create a new issue with detailed information
4. Join the [React Native Community](https://reactnative.dev/help)

---

**Happy coding! 🚀**

*StormWatch demonstrates the power of React Native for building truly cross-platform applications that provide native experiences on mobile devices and excellent web experiences in browsers.*