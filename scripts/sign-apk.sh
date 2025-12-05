#!/bin/bash
set -e
UNSIGNED_APK="$1"
KEYSTORE="$2"
KEYPASS="$3"
ALIAS="$4"
OUT_APK="$5"

if [ -z "$UNSIGNED_APK" ] || [ -z "$KEYSTORE" ] || [ -z "$KEYPASS" ] || [ -z "$ALIAS" ] || [ -z "$OUT_APK" ]; then
  echo "Usage: sign-apk.sh unsigned.apk keystore keystorepass alias out.apk"
  exit 2
fi

# jarsigner (sign)
jarsigner -verbose -sigalg SHA256withRSA -digestalg SHA-256 -keystore "$KEYSTORE" \
  -storepass "$KEYPASS" -keypass "$KEYPASS" "$UNSIGNED_APK" "$ALIAS"

# find zipalign (assume android build-tools in PATH)
ZIPALIGN=$(which zipalign || echo "/sdk/build-tools/34.0.0/zipalign")
if [ ! -f "$ZIPALIGN" ]; then
  echo "zipalign not found at $ZIPALIGN. Ensure Android build-tools installed and zipalign in PATH."
  exit 3
fi

# aligned signed apk
$ZIPALIGN -v 4 "$UNSIGNED_APK" "$OUT_APK"
