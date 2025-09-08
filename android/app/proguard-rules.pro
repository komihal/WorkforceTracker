# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# Add any project specific keep options here:

# TSLocationManager / BGGeo
-keep class com.transistorsoft.** { *; }
-keep class com.google.android.gms.location.** { *; }

# react-native-config
-keep class com.lugg.ReactNativeConfig.** { *; }
-dontwarn com.lugg.ReactNativeConfig.**
