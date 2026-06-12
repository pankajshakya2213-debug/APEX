# APEX v1.1.5

## What's New
- New APEX app icon added for Windows installer/build assets.
- Settings now includes a Check Update button for GitHub release updates.
- Update popup now shows release changes from GitHub release notes.
- Gmail connection panel added in Settings with OAuth save/connect/disconnect.
- Phone link supports USB debugging direct mode and cable-free ADB handoff when network is reachable.
- Dashboard blob color can be changed from the Dashboard nav color picker.

## Improved
- Chat History panel redesigned with cleaner message bubbles and command input.
- ADB uses bundled `resources/adb/adb.exe` in development/builds instead of requiring system PATH.
- App visible name and branding updated to APEX.

## Fixed
- Fixed Settings crash caused by update listener cleanup.
- Removed dashboard Gemini stalled warning pill.
- Fixed USB ADB command targeting so phone actions work over serial or wireless bridge.
