# BG Geolocation Test Suite - Implementation Summary

## ✅ Completed Implementation

### 1. Core Components Created

#### A) BG Test Screen (`src/screens/BgGeoTestScreen.tsx`)
- **Permissions Section**: Shows Android/iOS permission status with request buttons
- **Test Scenarios**: Individual buttons for scenarios A-E plus "Run All"
- **Results Display**: Real-time test results with PASS/FAIL status
- **Tools Section**: Export reports and copy ADB commands
- **Instructions**: Built-in guidance for each test scenario

#### B) Test Scenarios (`src/services/bgGeo/testScenarios.ts`)
- **Scenario A**: Revoke Background → Move (tests "while in use" vs "always" permission)
- **Scenario B**: Kill App → Move (tests headless mode functionality)
- **Scenario C**: Doze → Move (tests Android doze mode and batch upload)
- **Scenario D**: Airplane → Online (tests offline accumulation and batch upload)
- **Scenario E**: Reboot → Move (tests startOnBoot functionality)
- **Smoke Test**: Basic getCurrentPosition and HTTP functionality

#### C) Enhanced Location Service (`src/services/bgGeo/location.ts`)
- **exportLogs()**: Comprehensive diagnostic report generation
- **Event Logging**: Captures location, motion, provider, and HTTP events
- **Diagnostic Mode**: BG_DIAG=1 enables VERBOSE logging
- **Permission Utilities**: getPermissionStatus() and requestAllPermissions()
- **State Management**: Enhanced state tracking and reporting

#### D) Report Template (`docs/bg-geo-test-template.md`)
- **Structured Format**: Device info, config, permissions, test results
- **Comprehensive Data**: Recent locations, event logs, BG logs
- **Recommendations**: Automated suggestions based on test results
- **Platform-Specific**: Android/iOS specific notes and commands

### 2. Navigation Integration
- **BG Test Suite Button**: Added to MainScreen with green color (#4CAF50)
- **Screen Routing**: Proper navigation with back button
- **Dev Access**: Available in development builds

### 3. Codebase Audit & Fixes
- **Duplicate postLocation**: Fixed naming conflict in `src/api.js`
- **Single Initialization**: Confirmed only one BG Geo init in `src/services/bgGeo/location.ts`
- **No Manual Network Calls**: Verified no postLocation calls in listeners
- **Legitimate Timers**: Confirmed setInterval in shiftStatusService is for WebSocket fallback

### 4. Dependencies & Configuration
- **react-native-fs**: Installed for file operations
- **BG_DIAG Flag**: Added to env.template for diagnostic mode
- **Permission Handling**: Cross-platform permission utilities

## 🔧 ADB Commands Available

The test screen provides these ADB commands via "Copy ADB Cheats":

```bash
# Android Logs
adb logcat -c && adb logcat -v time -s TSLocationManager ReactNativeJS

# Force Stop App (Scenario B)
adb shell am force-stop com.workforcetracker

# Doze Control (Scenario C)
adb shell dumpsys deviceidle enable
adb shell dumpsys deviceidle force-idle
adb shell dumpsys deviceidle disable

# Check Background Location Permission
adb shell cmd appops get com.workforcetracker ACCESS_BACKGROUND_LOCATION
adb shell cmd appops set com.workforcetracker ACCESS_BACKGROUND_LOCATION allow
```

## 📋 Test Scenarios Explained

### Scenario A: Revoke Background → Move
**Purpose**: Test that "while in use" permission prevents background location tracking
**Steps**: 
1. Change location permission from "Allow all the time" to "Allow only while in use"
2. Lock phone and walk 100-200m
3. Check that no HTTP events are received

**Expected Result**: PASS if no HTTP events with "while in use" permission

### Scenario B: Kill App → Move  
**Purpose**: Test headless mode functionality
**Steps**:
1. Force-stop the app
2. Walk 200-500m
3. Reopen app and check for accumulated locations

**Expected Result**: PASS if headless mode is enabled and locations are tracked

### Scenario C: Doze → Move
**Purpose**: Test Android doze mode and batch upload
**Steps**:
1. Enable doze mode via ADB
2. Walk around for 2-3 minutes
3. Disable doze mode
4. Check for batch upload

**Expected Result**: PASS if locations accumulate during doze and batch upload occurs

### Scenario D: Airplane → Online
**Purpose**: Test offline accumulation and batch upload
**Steps**:
1. Enable airplane mode
2. Wait 5-10 minutes (walk around)
3. Disable airplane mode
4. Check for batch upload

**Expected Result**: PASS if locations accumulate offline and batch upload occurs

### Scenario E: Reboot → Move
**Purpose**: Test startOnBoot functionality
**Steps**:
1. Restart device
2. Walk around for 2-3 minutes
3. Check if tracking started automatically

**Expected Result**: PASS if startOnBoot is enabled and tracking resumes

## 🚀 How to Use

### 1. Access the Test Suite
- Open the app and log in
- Tap the green "🔬 BG Test Suite" button on the main screen

### 2. Run Individual Tests
- Check permissions first using "Request All" button
- Run individual scenarios A-E using their respective buttons
- Each scenario provides step-by-step instructions

### 3. Run All Tests
- Use "Run All" button to execute all scenarios sequentially
- Results are displayed in real-time

### 4. Export Reports
- Use "Export Report" to generate comprehensive diagnostic JSON
- Reports are saved to `Documents/BGTest/` directory
- Can be shared via system share dialog

### 5. Use ADB Commands
- Copy ADB commands for Android-specific testing
- Use commands for doze mode, permission checks, and app control

## 🔍 Diagnostic Features

### Event Logging
- Captures last 1000 events (location, motion, provider, HTTP)
- Timestamped with detailed data
- Included in exported reports

### State Snapshots
- Current BG Geo configuration
- Permission status
- Recent locations (last 50)
- BG Geo internal logs

### Configuration Validation
- Checks for required environment variables
- Validates license keys
- Reports missing configurations

## ⚠️ Important Notes

### Testing Requirements
- **Real Device**: Test on actual devices, not simulators
- **Permissions**: Ensure proper location permissions are granted
- **Background**: Test background scenarios thoroughly
- **Network**: Test with various network conditions

### Platform Differences
- **Android**: Doze mode, battery optimization, background location permission
- **iOS**: Low Power Mode, Always vs When In Use permissions
- **Headless**: Android-only feature

### Common Issues & Solutions

#### Scenario A FAIL (Background permission still active)
- Check Android AppOps: `adb shell cmd appops get com.workforcetracker ACCESS_BACKGROUND_LOCATION`
- Ensure user actually changed to "Allow only while in use"

#### Scenario B FAIL (No headless tracking)
- Verify `enableHeadless: true` in config
- Check `stopOnTerminate: false`
- Request battery optimization exemption
- Check OEM-specific app killers

#### Scenario C/D FAIL (No batch upload)
- Verify `autoSync: true` and `batchSync: true`
- Check `maxRecordsToPersist` setting
- Verify webhook URL and API token
- Check network connectivity and TLS

#### Scenario E FAIL (No startOnBoot)
- Verify `startOnBoot: true` in config
- Check AndroidManifest.xml for RECEIVE_BOOT_COMPLETED
- Ensure background location permission

## 📊 Next Steps

1. **Build and Test**: Compile the app and run the test suite
2. **Run Scenarios**: Execute scenarios A-E on real devices
3. **Analyze Results**: Review test results and exported reports
4. **Fix Issues**: Address any FAIL scenarios using the diagnostic data
5. **Optimize**: Fine-tune configuration based on test results

## 🎯 Success Criteria

All scenarios should show **PASS** status:
- ✅ Scenario A: No HTTP events with "while in use" permission
- ✅ Scenario B: Headless tracking works after app kill
- ✅ Scenario C: Batch upload after doze mode disable
- ✅ Scenario D: Batch upload after airplane mode disable  
- ✅ Scenario E: Automatic tracking after device reboot
- ✅ Smoke Test: Basic location and HTTP functionality

The implementation is complete and ready for testing!
