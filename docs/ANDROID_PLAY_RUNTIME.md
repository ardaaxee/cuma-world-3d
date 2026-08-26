# CUMA WORLD — Android Play Runtime

This branch is the engine migration path for the Google Play version of CUMA WORLD.

## Runtime

- Babylon.js 9 + TypeScript
- Vite production bundle
- Capacitor 8 Android native container
- Android target SDK 36
- Google Play release artifact: Android App Bundle (`.aab`)

No Godot editor or Godot export is used by the Android Play workflow on this branch.

## Current playable vertical slice

The first migrated loop is intentionally small but real:

1. Cinematic CUMA WORLD boot screen.
2. Mobile dual-touch controls with independent joystick/look pointer ownership.
3. Smooth first-person movement, collision-enabled camera and subtle dynamic FOV.
4. RECON LENS observation mode.
5. Timed analysis of mission-relevant in-world objects.
6. Intel discoveries that unlock approach selection.
7. Main/side route planning.
8. Mission-object interaction.
9. Extraction and measured GHOST / SHADOW / OPERATIVE result.
10. Local versioned mission persistence with corrupt-save fallback.

This is a migration foundation, not a claim that the entire legacy game has already been ported. Legacy assets and systems remain in the repository only as migration references until equivalent Android-runtime systems are validated.

## Build

```bash
npm install
npm run build
npx cap add android
npx cap sync android
cd android
./gradlew bundleRelease
```

Capacitor 8 generates Android configuration targeting API 36. CI verifies that value before the AAB is built.

## Signing

The workflow can sign the Play upload bundle when these GitHub Actions secrets exist:

- `ANDROID_KEYSTORE_BASE64`
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`

Never commit a release keystore or password to the repository.

## Migration order

1. Controls/camera/save and one full mission loop.
2. High-detail character + animation bridge.
3. Existing CUMA WORLD environment/assets and material pipeline.
4. Audio and haptics.
5. NPC awareness/stealth and fictional CCTV gameplay.
6. Phone, missions and intelligence UI.
7. Multiplayer authority/synchronization.
8. World/vehicle/NPC expansion only after mobile performance gates pass.

The target is a stable, mobile-first game; visual features are not considered complete until measured on real Android hardware.
