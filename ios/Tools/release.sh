#!/usr/bin/env bash
set -euo pipefail
umask 077
keychain="$RUNNER_TEMP/bananza-ios-signing.keychain-db"
password="$(openssl rand -hex 32)"
certificate="$RUNNER_TEMP/bananza-signing.p12"
profile="$RUNNER_TEMP/bananza.mobileprovision"
profile_plist="$RUNNER_TEMP/bananza-profile.plist"
asc_dir="$HOME/.appstoreconnect/private_keys"
asc_key="$asc_dir/AuthKey_${ASC_KEY_ID}.p8"
profile_install=''
cleanup() {
  security delete-keychain "$keychain" >/dev/null 2>&1 || true
  rm -f "$certificate" "$profile" "$profile_plist" "$asc_key"
  if [[ -n "$profile_install" ]]; then rm -f "$profile_install"; fi
}
trap cleanup EXIT
printf '%s' "$IOS_CERTIFICATE_P12_BASE64" | base64 --decode > "$certificate"
printf '%s' "$IOS_PROVISION_PROFILE_BASE64" | base64 --decode > "$profile"
security cms -D -i "$profile" > "$profile_plist"
profile_uuid=$(/usr/libexec/PlistBuddy -c 'Print UUID' "$profile_plist")
profile_team=$(/usr/libexec/PlistBuddy -c 'Print TeamIdentifier:0' "$profile_plist")
application_id=$(/usr/libexec/PlistBuddy -c 'Print Entitlements:application-identifier' "$profile_plist")
push_environment=$(/usr/libexec/PlistBuddy -c 'Print Entitlements:aps-environment' "$profile_plist")
[[ "$profile_team" == "$IOS_TEAM_ID" && "$application_id" == "$IOS_TEAM_ID.app.bananza.ios" && "$push_environment" == 'production' ]] || { echo '::error::Profile does not match the team, bundle ID or production APNs'; exit 1; }
profile_install="$HOME/Library/MobileDevice/Provisioning Profiles/$profile_uuid.mobileprovision"
mkdir -p "$(dirname "$profile_install")" "$asc_dir"
cp "$profile" "$profile_install"
printf '%s' "$ASC_PRIVATE_KEY_BASE64" | base64 --decode > "$asc_key"
security create-keychain -p "$password" "$keychain"
security set-keychain-settings -lut 21600 "$keychain"
security unlock-keychain -p "$password" "$keychain"
security import "$certificate" -P "$IOS_CERTIFICATE_PASSWORD" -A -t cert -f pkcs12 -k "$keychain" >/dev/null
security set-key-partition-list -S apple-tool:,apple: -k "$password" "$keychain" >/dev/null
security list-keychains -d user -s "$keychain" "$HOME/Library/Keychains/login.keychain-db"
export PROFILE_UUID="$profile_uuid"
python3 - <<'PY'
import os, plistlib
with open('build/ExportOptions.plist', 'wb') as f:
    plistlib.dump({'method':'app-store-connect','teamID':os.environ['IOS_TEAM_ID'],
      'signingStyle':'manual','signingCertificate':'Apple Distribution',
      'provisioningProfiles':{'app.bananza.ios':os.environ['PROFILE_UUID']},
      'uploadSymbols':True,'manageAppVersionAndBuildNumber':False}, f)
PY
build_number="${GITHUB_RUN_NUMBER}.${GITHUB_RUN_ATTEMPT}"
xcodebuild archive -project BananZa.xcodeproj -scheme BananZa -configuration Release \
  -destination 'generic/platform=iOS' -archivePath build/BananZa.xcarchive \
  CURRENT_PROJECT_VERSION="$build_number" DEVELOPMENT_TEAM="$IOS_TEAM_ID" \
  CODE_SIGN_STYLE=Manual CODE_SIGN_IDENTITY='Apple Distribution' \
  PROVISIONING_PROFILE_SPECIFIER="$profile_uuid" | tee build/archive.log
xcodebuild -exportArchive -archivePath build/BananZa.xcarchive -exportPath build/export \
  -exportOptionsPlist build/ExportOptions.plist | tee build/export.log
xcrun altool --upload-app --type ios --file build/export/BananZa.ipa \
  --apiKey "$ASC_KEY_ID" --apiIssuer "$ASC_ISSUER_ID"
