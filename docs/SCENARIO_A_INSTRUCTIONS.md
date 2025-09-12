# SCENARIO A: Revoke Background → Move

## Current Status
- **Device**: CPH2723 (OnePlus) running Android 15
- **App**: WorkforceTracker is running (PID: 3138)
- **Background Permission**: Currently GRANTED (full access)
- **Logs**: Being captured to `bggeo_A_revoke.log`

## Test Steps

### 1. Change Permission
1. Open **Android Settings**
2. Go to **Apps** → **WorkforceTracker** → **Permissions** → **Location**
3. Change from **"Allow all the time"** to **"Allow only while in use"**
4. Confirm the change

### 2. Test Background Behavior
1. **Return to the WorkforceTracker app**
2. **Walk around for 2-3 minutes** (app in foreground)
3. **Lock the phone** (press power button)
4. **Continue walking for another 2-3 minutes** (app in background)
5. **Unlock the phone**

### 3. Expected Results
- **PASS**: No HTTP events should be received while phone is locked (background)
- **FAIL**: HTTP events continue while phone is locked (permission not properly revoked)

## Monitoring
- Logs are being captured to `bggeo_A_revoke.log`
- Look for `[BG][http]` events in the logs
- Check for any permission-related errors

## Next Steps
After completing the test:
1. Check the log file for HTTP events during background period
2. Update the feedback report with results
3. Proceed to Scenario B

---
**Note**: This test verifies that the app respects the "while in use" permission and stops sending location data when the app is in the background.
