# Building Android App

This guide explains how to build the Tracearr Android app using GitHub Actions.

## Quick Start

1. **Set up GitHub Secrets** (one-time setup)
2. **Trigger the workflow** from GitHub Actions
3. **Download the APK** from workflow artifacts

## Required GitHub Secrets

### 1. EXPO_TOKEN (Required)

This is needed for EAS CLI to work. Get it from Expo:

1. Go to https://expo.dev/accounts/[your-account]/settings/access-tokens
2. Create a new access token (or use an existing one)
3. Copy the token
4. Add it to your GitHub repository:
   - Go to: `Settings` → `Secrets and variables` → `Actions`
   - Click `New repository secret`
   - Name: `EXPO_TOKEN`
   - Value: Paste your Expo token
   - Click `Add secret`

**Note**: Even though we're building locally (not on Expo's servers), EAS CLI still requires authentication.

### 2. EAS_PROJECT_ID (Required for forks)

The app is linked to the **original** Tracearr Expo project. Your `EXPO_TOKEN` cannot access it, so builds fail with "Entity not authorized". Use your own Expo project:

1. Go to https://expo.dev and sign in (same account as your access token).
2. Click **Create a project** (or use an existing one).
3. Choose **Blank** or any template; we only need the project ID.
4. Open the project → **Project settings** (or the project dashboard).
5. Copy the **Project ID** (e.g. `a1b2c3d4-e5f6-7890-abcd-ef1234567890`).
6. Add it to GitHub:
   - **Settings** → **Secrets and variables** → **Actions**
   - **New repository secret** → Name: `EAS_PROJECT_ID`, Value: the Project ID

7. Add your **Expo username** (same account that owns the project):
   - In Expo, your username is in the URL: `https://expo.dev/@your-username` or in the top-right profile.
   - **New repository secret** → Name: `EAS_OWNER`, Value: your Expo username (e.g. `milindpatel63`). No `@` symbol.

The build checks that the app’s `owner` matches the project owner; `EAS_OWNER` sets that when using your own project.

If you omit these, the workflow uses the upstream project and will fail unless you have access to it.

### 3. GOOGLE_MAPS_API_KEY (Optional)

Only needed if you want maps functionality in the app. If you don't have one, the build will still work but maps won't function.

#### Getting a Google Maps API Key

1. **Go to Google Cloud Console**: https://console.cloud.google.com/
2. **Create or select a project** (or use an existing one)
3. **Enable the required API**:
   - Go to **APIs & Services** → **Library**
   - Search for **"Maps SDK for Android"**
   - Click on it and click **Enable**
   - That's it! This is the only API you need for basic map display

4. **Create an API Key**:
   - Go to **APIs & Services** → **Credentials**
   - Click **Create Credentials** → **API Key**
   - Copy the API key

5. **Restrict the API Key (Recommended for security)**:
   - Click on the API key you just created
   - Under **Application restrictions**, select **Android apps**
   - Click **Add an item**
   - Enter your package name: `com.tracearr.mobile`
   - Get your SHA-1 certificate fingerprint (see below)
   - Under **API restrictions**, select **Restrict key**
   - Choose **Maps SDK for Android** from the list
   - Click **Save**

6. **Get SHA-1 fingerprint** (for API key restriction):
   ```bash
   # For debug builds (testing)
   keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android
   
   # For release builds (if you're signing)
   keytool -list -v -keystore your-release-key.keystore -alias your-key-alias
   ```
   Copy the SHA-1 value (looks like: `AA:BB:CC:DD:...`)

7. **Add to GitHub**:
   - Go to your repo → **Settings** → **Secrets and variables** → **Actions**
   - Click **New repository secret**
   - Name: `GOOGLE_MAPS_API_KEY` (same place as other secrets)
   - Value: Paste your API key
   - Click **Add secret**

**Note**: The app only uses basic map display with markers, so you only need **Maps SDK for Android**. No other APIs (Geocoding, Directions, Places, etc.) are required.

## Building the App

### Option 1: Simple Workflow (Recommended)

1. Go to your repository on GitHub
2. Click on `Actions` tab
3. Select `Android Build (Simple)` workflow
4. Click `Run workflow`
5. Fill in:
   - **Branch or tag**: `main` (or any branch/tag you want to build)
   - **Profile**: 
     - `preview-apk` - APK file (easiest to install, recommended)
     - `preview` - AAB file (for Play Store)
     - `development` - Development APK
6. Click `Run workflow`
7. Wait for the build to complete (usually 10-20 minutes)
8. Download the APK/AAB from the workflow artifacts

### Option 2: Original Workflow (Advanced)

The original `Mobile Build (Local)` workflow has more features but requires a git tag:

1. Go to `Actions` → `Mobile Build (Local)`
2. Click `Run workflow`
3. Provide:
   - **Tag**: A git tag (e.g., `v1.2.3` or create one from a commit)
   - **Platform**: `android`
   - **Distribution**: `internal` (for APK) or `store` (for AAB)
   - **Profile**: `preview` or `production`
4. Wait for build and download artifact

## Installing the APK

After downloading the APK:

1. Transfer it to your Android device
2. Enable "Install from Unknown Sources" in Android settings
3. Open the APK file and install

## Build Profiles Explained

| Profile | Output | Use Case |
|---------|--------|----------|
| `preview-apk` | APK | Personal use, easy to install |
| `preview` | AAB | Testing before Play Store release |
| `development` | APK | Development builds with dev client |
| `production` | AAB | Play Store release (requires signing) |

## Troubleshooting

### Build fails with "EXPO_TOKEN not found"
- Make sure you've added the `EXPO_TOKEN` secret to your repository
- Check that the secret name is exactly `EXPO_TOKEN` (case-sensitive)

### Build fails with authentication error
- Verify your Expo token is valid and not expired
- Try creating a new token from Expo dashboard

### Build takes too long
- First build is slower due to dependency downloads
- Subsequent builds are faster due to caching
- Typical build time: 10-20 minutes

### Maps not working
- Add `GOOGLE_MAPS_API_KEY` secret if you want maps functionality
- Maps will work without it, but some features may be limited

## Building Locally (Alternative)

If you prefer to build locally without GitHub Actions:

```bash
# Install dependencies
pnpm install

# Build shared package
pnpm --filter @tracearr/shared build

# Navigate to mobile app
cd apps/mobile

# Install EAS CLI (if not already installed)
npm install -g eas-cli

# Login to Expo
eas login

# Build Android APK
eas build --platform android --profile preview-apk --local
```

**Note**: Local builds require Android SDK, NDK, and other Android development tools (~10GB+).

## Need Help?

- Check workflow logs in GitHub Actions for detailed error messages
- Ensure all secrets are properly configured
- Verify the branch/tag exists in your repository
