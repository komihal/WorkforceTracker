#!/bin/bash
# Build Android Release APK
# Usage: ./scripts/build_android_release.sh
#
# Prerequisites:
#   - Node.js 18+
#   - Android SDK with build-tools 35.0.0
#   - JDK 17+
#   - ANDROID_HOME environment variable set
#
# Output: android/app/build/outputs/apk/release/app-release.apk

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "=== WorkforceTracker Release APK Build ==="
echo ""

# Check prerequisites
if ! command -v node &>/dev/null; then
    echo "ERROR: Node.js is not installed"
    exit 1
fi

if [ -z "${ANDROID_HOME:-}" ]; then
    echo "ERROR: ANDROID_HOME is not set"
    echo "  export ANDROID_HOME=\$HOME/Library/Android/sdk  # macOS"
    echo "  export ANDROID_HOME=\$HOME/Android/Sdk          # Linux"
    exit 1
fi

echo "[1/4] Installing npm dependencies..."
cd "$PROJECT_DIR"
npm install

echo ""
echo "[2/4] Generating release keystore (if not exists)..."
KEYSTORE_PATH="$PROJECT_DIR/android/app/workforce-release.keystore"
if [ ! -f "$KEYSTORE_PATH" ]; then
    keytool -genkeypair -v \
        -storetype PKCS12 \
        -keystore "$KEYSTORE_PATH" \
        -alias workforce \
        -keyalg RSA \
        -keysize 2048 \
        -validity 10000 \
        -storepass workforce_release_password \
        -keypass workforce_release_password \
        -dname "CN=WorkforceTracker, OU=Mobile, O=WorkforceTracker, L=Moscow, ST=Moscow, C=RU"
    echo "  Keystore created: $KEYSTORE_PATH"
else
    echo "  Keystore already exists: $KEYSTORE_PATH"
fi

echo ""
echo "[3/4] Building release APK..."
cd "$PROJECT_DIR/android"
./gradlew assembleRelease

echo ""
echo "[4/4] Done!"
APK_PATH="$PROJECT_DIR/android/app/build/outputs/apk/release/app-release.apk"
if [ -f "$APK_PATH" ]; then
    APK_SIZE=$(du -h "$APK_PATH" | cut -f1)
    echo "  Release APK: $APK_PATH ($APK_SIZE)"
    echo ""
    echo "  To install on device: adb install $APK_PATH"
else
    echo "  WARNING: APK not found at expected path."
    echo "  Check: android/app/build/outputs/apk/release/"
    ls -la "$PROJECT_DIR/android/app/build/outputs/apk/release/" 2>/dev/null || true
fi
