# 🚀 Quick Guide: Building Android App

## What You Need

**One-time setup** - Add these GitHub secrets:

1. **EXPO_TOKEN** (Required)
   - Get it from: https://expo.dev/accounts/[your-account]/settings/access-tokens
   - Add to GitHub: `Settings` → `Secrets and variables` → `Actions` → `New repository secret`

2. **EAS_PROJECT_ID** and **EAS_OWNER** (Required for your fork)
   - Create a project at https://expo.dev → copy its **Project ID** → secret `EAS_PROJECT_ID`
   - Your Expo username (e.g. `milindpatel63`, no `@`) → secret `EAS_OWNER`
   - Without both you get "Entity not authorized" or "owner does not match".

3. **GOOGLE_MAPS_API_KEY** (Optional - only if you want maps)
   - Enable **"Maps SDK for Android"** in Google Cloud Console
   - Create an API key
   - Add as GitHub secret (same location as above)
   - See [docs/ANDROID_BUILD.md](docs/ANDROID_BUILD.md) for detailed steps

## How to Build

1. Go to **Actions** tab in your GitHub repo
2. Select **"Android Build (Simple)"** workflow
3. Click **"Run workflow"**
4. Enter:
   - Branch: `main` (or any branch/tag)
   - Profile: `preview-apk` (recommended for easy install)
5. Click **"Run workflow"**
6. Wait ~10-20 minutes
7. Download APK from **Artifacts** section

## That's It! 🎉

The APK will be available in the workflow artifacts. Download and install on your Android device.

For detailed instructions, see [docs/ANDROID_BUILD.md](docs/ANDROID_BUILD.md)
