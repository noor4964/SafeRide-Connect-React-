# SafeRide Connect

A secure ridesharing app designed specifically for university students, built with React Native, Expo, and Firebase.

## 🚗 Features

### Current Features (MVP)
- ✅ **Student Authentication**: Firebase Auth with university email validation
- ✅ **Post & Find Rides**: Create and search for rides with location-based filtering
- ✅ **Safety Features**: Student verification badges, location sharing, emergency contacts
- ✅ **Real-time Updates**: Live ride availability and status updates
- ✅ **Campus Focus**: Geofenced to campus areas for student safety

### Planned Features
- 🚧 **Student Verification**: Integration with university systems (.edu email validation)
- 🚧 **Emergency SOS**: One-tap emergency alerts with location sharing
- 🚧 **In-app Chat**: Secure messaging between riders and drivers
- 🚧 **Live Tracking**: Real-time location sharing during rides
- 🚧 **Rating System**: User ratings and reviews for safety
- 🚧 **Push Notifications**: Ride requests, updates, and safety alerts

## 🛠 Tech Stack

- **Frontend**: React Native with Expo (TypeScript)
- **Navigation**: React Navigation (Stack + Bottom Tabs)
- **Backend**: Firebase (Auth, Firestore, Storage)
- **Data Fetching**: React Query (TanStack Query)
- **Forms**: React Hook Form + Zod validation
- **Maps**: Expo Location + React Native Maps
- **Geospatial**: Geofire for location-based queries

## 📁 Project Structure

```
src/
├── config/
│   └── firebaseConfig.ts          # Firebase configuration
├── features/
│   ├── auth/
│   │   ├── context/AuthContext.tsx
│   │   ├── hooks/useUser.ts
│   │   ├── screens/LoginScreen.tsx
│   │   └── services/userService.ts
│   ├── rides/
│   │   ├── hooks/useRides.ts
│   │   ├── screens/PostRideScreen.tsx
│   │   └── services/ridesService.ts
│   └── safety/
│       └── screens/               # TODO: Emergency features
├── navigation/
│   ├── AppNavigator.tsx
│   └── index.ts
├── screens/
│   └── HomeScreen.tsx
├── types/
│   └── index.ts                   # TypeScript interfaces & Zod schemas
├── utils/
│   └── locationUtils.ts           # Geohash & location helpers
└── components/
    └── common/                    # Reusable UI components
```

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- Expo CLI (`npm install -g @expo/cli`)
- Firebase project with Auth, Firestore, and Storage enabled
- iOS Simulator or Android emulator (or physical device with Expo Go)

### Installation

1. **Clone and install dependencies:**
   ```bash
   cd "c:\\Users\\Noor\\Uni Ride  Connect"
   npm install
   ```

2. **Configure Firebase:**
   - Create a Firebase project at https://console.firebase.google.com
   - Enable Authentication (Email/Password)
   - Enable Firestore Database
   - Enable Storage
   - Copy your Firebase config and update `src/config/firebaseConfig.ts`

3. **Start the development server:**
   ```bash
   npm start
   ```

4. **Run on device:**
   - iOS: `npm run ios` or scan QR code with Camera app
   - Android: `npm run android` or scan QR code with Expo Go app

### Firebase Setup

1. **Firestore Security Rules:**
   ```javascript
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       // Users can read/write their own data
       match /users/{userId} {
         allow read, write: if request.auth != null && request.auth.uid == userId;
       }
       
       // Anyone can read active rides, only owners can write
       match /rides/{rideId} {
         allow read: if request.auth != null;
         allow write: if request.auth != null && 
           (resource == null || resource.data.driverId == request.auth.uid);
       }
       
       // Ride requests
       match /ride_requests/{requestId} {
         allow read: if request.auth != null;
         allow write: if request.auth != null && 
           request.auth.uid == resource.data.passengerId;
       }
     }
   }
   ```

2. **Firestore Indexes:**
   Create these composite indexes in Firebase Console:
   - `rides`: `status` (Ascending) + `departureTime` (Ascending)
   - `rides`: `origin.geohash` (Ascending) + `departureTime` (Ascending)
   - `rides`: `driverId` (Ascending) + `status` (Ascending)

## 📱 App Architecture

### Authentication Flow
1. User enters university email (.edu domain validation)
2. Firebase Auth creates account with email verification
3. User profile created in Firestore with student verification status
4. AuthContext provides user state throughout app

### Ride Management
1. **Post Ride**: Driver enters route, time, preferences → Firestore with geohash
2. **Find Rides**: Location-based queries using geohash for efficiency
3. **Request Ride**: Passengers send requests → Real-time notifications
4. **Safety**: Emergency contacts, location sharing, student verification

### Data Models

```typescript
User {
  id: string
  email: string (university email)
  firstName: string
  lastName: string
  phoneNumber: string
  university: string
  isStudentVerified: boolean
  emergencyContacts: EmergencyContact[]
  rating: number
  totalRides: number
}

Ride {
  id: string
  driverId: string
  title: string
  origin: LocationWithAddress (includes geohash)
  destination: LocationWithAddress
  departureTime: Date
  availableSeats: number
  pricePerSeat: number
  safetyFeatures: SafetyFeatures
  preferences: RidePreferences
  status: 'active' | 'completed' | 'cancelled'
  passengerIds: string[]
}
```

## 🛡️ Safety Features

### Current Implementation
- **Student Verification**: .edu email requirement + verification badges
- **Location Sharing**: Optional sharing with emergency contacts
- **Campus Geofencing**: Rides restricted to campus areas
- **User Ratings**: Driver and passenger rating system

### TODO: Advanced Safety Features
```typescript
// Emergency SOS system
const triggerEmergencySOS = async () => {
  // 1. Get current location
  // 2. Send alerts to emergency contacts
  // 3. Notify campus security (if integrated)
  // 4. Share live location for 2 hours
  // 5. Log incident for safety review
};

// Live ride tracking
const startRideTracking = async (rideId: string) => {
  // 1. Enable background location
  // 2. Share location with passengers
  // 3. Monitor route deviation
  // 4. Auto-complete ride at destination
};
```

## 🔧 Development

### Key Commands
```bash
npm start              # Start Expo development server
npm run ios            # Run on iOS simulator
npm run android        # Run on Android emulator
npm run web            # Run in web browser
npm test              # Run test suite
npm run build         # Build for production
```

### Code Quality
- **TypeScript**: Full type safety with Zod validation
- **ESLint**: Code linting for consistency
- **Prettier**: Code formatting (TODO: Add prettier config)

### Testing (TODO)
- Unit tests with Jest
- Component tests with React Native Testing Library
- E2E tests with Detox

## 🚀 Deployment

### Building for Production
```bash
# iOS
expo build:ios --type archive

# Android  
expo build:android --type apk
```

### App Store Requirements
- Privacy Policy (required for location usage)
- Terms of Service
- App Store screenshots and descriptions
- University partnership agreements (recommended)

## 🤝 Contributing

### Adding New Features
1. Create feature branch: `git checkout -b feature/ride-requests`
2. Add types to `src/types/index.ts`
3. Create services in `src/features/{feature}/services/`
4. Add React Query hooks in `src/features/{feature}/hooks/`
5. Build UI components and screens
6. Update navigation if needed
7. Add safety considerations

### Code Style
- Use TypeScript for all new files
- Validate data with Zod schemas
- Follow React Native best practices
- Add safety features for student protection

## 📝 License

MIT License - see LICENSE file for details.

## 🆘 Support

- **Technical Issues**: Create GitHub issue
- **Safety Concerns**: Contact your university's transportation office
- **Emergency**: Call your local emergency services (911, campus security)

---

**Note**: This app is designed for university students and prioritizes safety above convenience. Always verify rider identity and trust your instincts when using any rideshare service.