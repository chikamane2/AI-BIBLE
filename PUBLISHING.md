# Publishing to Google Play Store

This is the path from "web app working locally" → "live on Play Store." It requires actions only you can take (Google account, signing keys, payments) — I can't run any of these for you.

## 1. Make sure the web app works locally

```powershell
node scripts/build_web.mjs       # copies data into web/
node scripts/dev_server.mjs      # opens http://localhost:8080
```

Open `http://localhost:8080` in a browser. Test every tab — Daily, Topics, Lookup, Search.

## 2. One-time install: Capacitor + Android tooling

You'll need:

- **Node.js** ≥ 18 (you already have it)
- **Java JDK 17** — install from https://adoptium.net (Temurin)
- **Android Studio** — install from https://developer.android.com/studio
  - On first launch it installs the Android SDK; accept the defaults
- **Set environment variables** (PowerShell, persistent):
  ```powershell
  [Environment]::SetEnvironmentVariable("JAVA_HOME", "C:\Program Files\Eclipse Adoptium\jdk-17", "User")
  [Environment]::SetEnvironmentVariable("ANDROID_HOME", "$env:LOCALAPPDATA\Android\Sdk", "User")
  ```
  Restart your terminal after.

Then in this project:

```powershell
npm install --save @capacitor/core @capacitor/cli @capacitor/android
npx cap init                # accepts capacitor.config.json
npx cap add android         # creates the android/ folder
```

## 3. Generate proper PNG icons

Capacitor needs PNG icons for Android. Easiest path:

1. Use https://capacitorjs.com/docs/guides/splash-screens-and-icons (or **@capacitor/assets**)
2. Run:
   ```powershell
   npm install --save-dev @capacitor/assets
   # put a 1024x1024 icon.png and 2732x2732 splash.png in resources/
   npx capacitor-assets generate
   ```
3. The included `web/icons/icon.svg` is a placeholder — replace `resources/icon.png` with a real designed icon (1024x1024 PNG) before publishing.

## 4. Build the APK / AAB

```powershell
npm run build:web                # refresh web/data/
npx cap sync android             # copy web/ into android/app/src/main/assets
npx cap open android             # opens Android Studio
```

In Android Studio:
- **Build → Generate Signed Bundle / APK → Android App Bundle**
- Create a new keystore (save it somewhere safe — you'll need it for every future update)
- Build the release `.aab`

## 5. Submit to Play Store

1. Pay the **one-time $25** at https://play.google.com/console
2. Create a new app, fill in:
   - Title: Hope — Bible Study & Encouragement
   - Short description, full description (use README content)
   - Screenshots (take from web app and Android emulator)
   - Privacy policy URL — you'll need to host one (see below)
3. Upload the `.aab` to a release track (Internal testing → Closed → Production)
4. Fill out the content rating and target audience forms
5. Submit for review (typically 1-7 days)

## 6. Privacy policy

Required by Google Play. Minimum content:
- What data the app collects (probably none — KJV/BSB are bundled)
- Whether it uses any analytics or tracking
- Contact info

Host it free on GitHub Pages, Netlify, or Notion-public.

## 7. NIV — separate licensing

NIV is **not** included in the Starter plan of API.Bible and **cannot be bundled**.

To add NIV later:
1. Log in to https://api.bible
2. Go to your application → "Bibles" tab
3. Click "Add" → search "NIV" → "Request Access"
4. Biblica reviews each application individually (days to weeks). They want to see:
   - Your published app (so do this AFTER step 5)
   - Use case (evangelism is a strong one)
   - Expected user volume
5. If approved, NIV will appear in your application's allowed Bibles
6. To use it in production, you'll need a small backend proxy (so the API key isn't exposed in the Android bundle):
   - Cloudflare Workers (free), Vercel functions (free), or a simple Node server
   - Frontend calls `https://your-backend/verse?ref=JHN.3.16&v=NIV`
   - Backend adds the `api-key` header and proxies to api.bible

Same pattern would work for NKJV in production — bundling the api-key in the Android app is leakable.

## What's bundled vs runtime

| Translation | Source | Shippable in Android bundle? |
|---|---|---|
| KJV | public domain | Yes |
| BSB | public domain | Yes |
| NKJV | API.Bible (licensed) | No — runtime only via backend proxy |
| NIV | API.Bible (licensed, requires Biblica approval) | No — runtime only via backend proxy |
