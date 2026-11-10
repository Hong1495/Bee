#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
mkdir -p src-tauri/icons/compiled
xcrun actool src-tauri/icons/Bee.icon --app-icon Bee --compile src-tauri/icons/compiled --output-partial-info-plist src-tauri/icons/compiled/partial.plist --platform macosx --minimum-deployment-target 12.0 --target-device mac --errors --warnings
cp src-tauri/icons/compiled/Bee.icns src-tauri/icons/icon.icns

# Export appearance previews from the system icon document (not runtime overrides).
ictool="$(xcode-select -p)/../Applications/Icon Composer.app/Contents/Executables/ictool"
for rendition in Default Dark ClearLight ClearDark; do
  case "$rendition" in
    Default) name=light ;;
    Dark) name=dark ;;
    ClearLight) name=clear-light ;;
    ClearDark) name=clear-dark ;;
  esac
  "$ictool" src-tauri/icons/Bee.icon --export-image \
    --output-file "src-tauri/icons/compiled/$name.png" --platform macOS \
    --rendition "$rendition" --width 1024 --height 1024 --scale 1
done
# Tauri's image decoder requires 8-bit RGBA; ictool may export 16-bit PNG.
swift scripts/normalize-icon-png.swift src-tauri/icons/compiled/light.png src-tauri/icons/compiled/dark.png src-tauri/icons/compiled/clear-light.png src-tauri/icons/compiled/clear-dark.png
cp src-tauri/icons/compiled/light.png src-tauri/icons/icon.png
cp src-tauri/icons/compiled/light.png public/icons/light.png
