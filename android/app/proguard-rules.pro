# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# react-native-reanimated
-keep class com.swmansion.reanimated.** { *; }
-keep class com.facebook.react.turbomodule.** { *; }

# Keep classes for react-native-maps
-keep class com.google.android.gms.maps.** { *; }
-keep public class * extends com.google.android.gms.maps.** { *; }
-dontwarn com.google.android.gms.maps.**

# If you are using other map libraries (e.g., OpenStreetMap), add rules to keep the relevant classes
# Example for OpenCageData and map handling libraries:
-keep class com.mapbox.** { *; }
-keep class com.reactnativecommunity.** { *; }
-keep class com.airbnb.android.react.maps.** { *; }

# Add any other project-specific keep options here
