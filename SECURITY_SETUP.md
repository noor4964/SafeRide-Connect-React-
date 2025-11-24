# 🔐 Security & Setup Guide

## ⚠️ IMPORTANT: Protected Files

The following files contain sensitive information and are **NOT committed to Git**:

### 🚫 Never Commit These Files:
- ✅ **`src/config/firebaseConfig.ts`** - Contains your Firebase API keys
- ✅ **`.firebaserc`** - Contains your Firebase project ID
- ✅ **`.env`** files - Environment variables (if used)
- ✅ **`node_modules/`** - Dependencies folder

### ✅ What IS Committed:
- ✅ **`src/config/firebaseConfig.example.ts`** - Template without real credentials
- ✅ **`firestore.rules`** - Database security rules (safe to share)
- ✅ **`firestore.indexes.json`** - Database indexes (safe to share)
- ✅ **`firebase.json`** - Firebase configuration file (safe to share)
- ✅ All source code

## 🚀 Setup for New Developers

### Step 1: Clone and Install

```bash
git clone https://github.com/noor4964/SafeRide-Connect-React-.git
cd SafeRide-Connect-React-
npm install --legacy-peer-deps
```

### Step 2: Create Your Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project"
3. Name it (e.g., "saferide-connect-dev")
4. Enable Google Analytics (optional)
5. Create project

### Step 3: Set Up Firebase Services

#### Enable Authentication
1. In Firebase Console, go to **Authentication**
2. Click **Get Started**
3. Enable **Email/Password** provider
4. Click **Save**

#### Create Firestore Database
1. Go to **Firestore Database**
2. Click **Create database**
3. Start in **test mode** (for development)
4. Choose your closest location
5. Click **Enable**

#### Enable Storage
1. Go to **Storage**
2. Click **Get started**
3. Start in **test mode**
4. Choose same location as Firestore
5. Click **Done**

### Step 4: Get Your Firebase Config

1. In Firebase Console, click the **gear icon** → **Project settings**
2. Scroll down to "Your apps"
3. Click the **</>** icon to add a web app
4. Register app with a nickname (e.g., "SafeRide Connect")
5. **Copy the `firebaseConfig` object**

### Step 5: Configure Your Local Project

1. **Copy the example config:**
   ```bash
   cp src/config/firebaseConfig.example.ts src/config/firebaseConfig.ts
   ```

2. **Edit `src/config/firebaseConfig.ts`:**
   ```typescript
   const firebaseConfig = {
     apiKey: "AIza...",              // Paste your API key here
     authDomain: "your-project.firebaseapp.com",
     projectId: "your-project-id",
     storageBucket: "your-project.appspot.com",
     messagingSenderId: "123456789",
     appId: "1:123456789:web:abc123",
     measurementId: "G-ABC123"
   };
   ```

3. **⚠️ CRITICAL:** This file is in `.gitignore` and will **NEVER** be committed!

### Step 6: Deploy Firebase Rules and Indexes

```bash
# Install Firebase CLI globally
npm install -g firebase-tools

# Login to Firebase
firebase login

# Initialize Firebase in your project
firebase init firestore
# Choose: Use an existing project
# Select your project
# Accept default files (firestore.rules and firestore.indexes.json)
# Don't overwrite existing files

# Deploy rules and indexes
firebase deploy --only firestore
```

### Step 7: Run the App

```bash
# Start the development server
npm start

# Or use specific platforms
npm run ios      # iOS simulator
npm run android  # Android emulator
npm run web      # Web browser
```

## 📱 Testing

### Create Test Account
1. Open app in Expo Go
2. Click "Sign Up"
3. Use a valid email (can be personal for testing)
4. Check email for verification link
5. Verify email and login

### Test Features
- ✅ Register new account
- ✅ Login/Logout
- ✅ Post a ride
- ✅ Search for rides
- ✅ View user profile

## 🔒 Security Best Practices

### For Developers

1. **Never commit credentials:**
   ```bash
   # Always check before committing
   git status
   
   # If you accidentally staged firebaseConfig.ts
   git reset src/config/firebaseConfig.ts
   ```

2. **Use test/development projects:**
   - Create a separate Firebase project for development
   - Use different projects for dev/staging/production

3. **Review .gitignore:**
   ```bash
   # Verify sensitive files are ignored
   cat .gitignore | grep firebase
   ```

4. **Never share credentials:**
   - Don't share Firebase config in Slack/Discord
   - Don't paste in issues or pull requests
   - Don't commit to any branch

### For Production

1. **Environment variables:**
   ```typescript
   // Use expo-constants for environment config
   import Constants from 'expo-constants';
   
   const firebaseConfig = {
     apiKey: Constants.expoConfig?.extra?.firebaseApiKey,
     // ... other config from environment
   };
   ```

2. **Firestore Security Rules:**
   - Review and test all rules before production
   - Never use test mode in production
   - Implement rate limiting
   - Add field validation

3. **Firebase App Check:**
   ```typescript
   // Add App Check for abuse prevention
   import { initializeAppCheck } from 'firebase/app-check';
   
   if (!__DEV__) {
     initializeAppCheck(app, {
       provider: new ReCaptchaEnterpriseProvider('YOUR_SITE_KEY'),
     });
   }
   ```

## 🚨 Emergency: If Credentials Were Leaked

If you accidentally committed Firebase credentials:

1. **Immediately regenerate keys:**
   - Go to Firebase Console
   - Project Settings → Service accounts
   - Generate new private key
   - Delete old keys

2. **Remove from Git history:**
   ```bash
   # Use git-filter-branch or BFG Repo-Cleaner
   git filter-branch --force --index-filter \
     "git rm --cached --ignore-unmatch src/config/firebaseConfig.ts" \
     --prune-empty --tag-name-filter cat -- --all
   
   # Force push (only if repository is not shared)
   git push origin --force --all
   ```

3. **Notify team and users**
4. **Review Firebase audit logs**
5. **Consider rotating all credentials**

## 📞 Support

- **Security Issues:** Create a private security advisory on GitHub
- **Setup Problems:** Open an issue with error details (NO credentials!)
- **Feature Requests:** Open a public issue

---

**Remember:** When in doubt, **DON'T COMMIT IT!** You can always add files later, but you can't easily remove them from Git history.
