# Interpark Mobile

A comprehensive React Native mobile application built with Expo for the Interpark platform. This application provides a cross-platform mobile experience for iOS, Android, and web.

## 📱 Overview

The Interpark Mobile application is a feature-rich mobile solution built on modern React Native technologies. It leverages Expo for streamlined development and deployment, offering a seamless user experience across multiple platforms.

### Key Features

- **Cross-Platform Development**: Single codebase for iOS, Android, and web
- **Navigation System**: Advanced routing with React Navigation (stack, bottom tabs, material top tabs)
- **Real-time Communication**: Socket.IO integration for live updates
- **Rich UI Components**: Custom components with smooth animations and gestures
- **Authentication**: Built-in auth session handling with secure token storage
- **Local Storage**: Persistent data management with async storage
- **Maps Integration**: React Native Maps for location-based features
- **Media Handling**: Image picking and media management
- **Form Management**: React Hook Form for robust form handling
- **Push Notifications**: Expo notifications for real-time alerts

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ and npm/yarn
- Expo CLI (`npm install -g expo-cli`)
- iOS/Android development environment (optional for native builds)
- Git

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/interparkenterprises/interpark_mobile.git
   cd interpark_mobile
   ```

2. **Install dependencies**
   ```bash
   npm install
   # or
   yarn install
   ```

3. **Configure environment variables**
   Create a `.env` file in the root directory and add required configuration:
   ```
   API_BASE_URL=your_api_url
   AUTH_TOKEN=your_auth_token
   # Add other environment variables as needed
   ```

### Running the Application

#### Development Mode

```bash
# Start Expo development server
npm start

# Run on Android
npm run android

# Run on iOS
npm run ios

# Run on web
npm run web
```

#### Production Build

For production builds, use Expo Application Services (EAS):

```bash
# Build for Android
eas build --platform android

# Build for iOS
eas build --platform ios

# Build for web
npm run web
```

## 📁 Project Structure

```
interpark_mobile/
├── assets/              # Images, icons, and static assets
├── src/                 # Source code directory
├── App.js               # Main application entry point
├── app.json            # Expo configuration
├── package.json        # Project dependencies and scripts
├── babel.config.js     # Babel configuration
├── eas.json           # Expo Application Services configuration
├── .env               # Environment variables (not in git)
└── README.md          # This file
```

## 🛠️ Technology Stack

### Core Technologies
- **React Native** (v0.81.5) - Cross-platform mobile framework
- **React** (v19.1.0) - UI library
- **Expo** (v54.0.0) - Development platform and services

### Navigation & Routing
- React Navigation with stack, bottom tabs, and material top tabs
- Expo Router for advanced navigation patterns

### State Management & Forms
- React Hook Form for efficient form state management
- Async Storage for local persistence

### UI & Animation
- React Native Reanimated for smooth animations
- React Native Gesture Handler for touch interactions
- React Native Modal for modal dialogs
- Linear Gradient for gradient backgrounds
- Vector Icons for consistent iconography

### APIs & Communication
- Axios for HTTP requests
- Socket.IO Client for real-time bidirectional communication
- Expo Auth Session for OAuth flows
- Expo Web Browser for browser-based auth flows

### Maps & Location
- React Native Maps for map integration
- Location and geolocation features

### Media & Files
- Expo Image Picker for photo/video selection
- React Native Image Picker as fallback
- Gifted Chat for chat interface

### Security & Storage
- Expo Secure Store for sensitive data
- Expo Crypto for cryptographic operations
- Base64 encoding/decoding utilities

### Development Tools
- Babel with Expo preset
- React Native Dotenv for environment variable management

## 📋 Available Scripts

### Development
```bash
npm start          # Start Expo development server
npm run android    # Run on Android device/emulator
npm run ios        # Run on iOS simulator/device
npm run web        # Run in web browser
```

### Build & Deploy
```bash
eas build          # Build with Expo Application Services
```

## 🔧 Configuration

### Expo Configuration (`app.json`)
The `app.json` file contains Expo-specific configuration including:
- App metadata (name, version, slug)
- Platform-specific settings (iOS, Android)
- Plugins and build properties
- Asset configuration

### Babel Configuration (`babel.config.js`)
Configured to use Expo's Babel preset with support for:
- JSX transformation
- Module resolution
- Asset processing

### EAS Configuration (`eas.json`)
Defines build profiles and deployment settings for Expo Application Services.

## 🔐 Security Considerations

- Use Expo Secure Store for storing authentication tokens
- Never commit `.env` files or sensitive credentials
- Implement proper authentication flows with OAuth/OIDC
- Validate all user inputs and API responses
- Use HTTPS for all API communications
- Keep dependencies up to date with `npm audit`

## 🧪 Testing & Quality

- Ensure code follows React Native best practices
- Test on both iOS and Android platforms
- Validate responsive design across different screen sizes
- Test performance using Expo DevTools

## 📚 Additional Resources

- [Expo Documentation](https://docs.expo.dev/)
- [React Native Documentation](https://reactnative.dev/)
- [React Navigation Documentation](https://reactnavigation.org/)
- [Socket.IO Documentation](https://socket.io/docs/)

## 🐛 Troubleshooting

### Common Issues

**Issue**: Dependencies installation fails
```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
```

**Issue**: Expo CLI not found
```bash
npm install -g expo-cli
expo --version
```

**Issue**: Build fails on native code
- Ensure you have the necessary native development environment
- Try clearing Expo cache: `expo doctor`
- Run `eas build` for managed builds

## 📝 License

Please refer to the LICENSE file in the repository for licensing information.

## 🤝 Contributing

1. Create a feature branch (`git checkout -b feature/feature-name`)
2. Commit your changes (`git commit -m 'Add feature'`)
3. Push to the branch (`git push origin feature/feature-name`)
4. Create a Pull Request

## 📞 Support

For issues, feature requests, or questions, please open an issue in the GitHub repository.

---

**Last Updated**: August 2026
**Repository**: [interparkenterprises/interpark_mobile](https://github.com/interparkenterprises/interpark_mobile)
