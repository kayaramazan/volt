#!/usr/bin/env bash
# Builds the native macOS widget extension (VoltWidget.appex) and the
# timeline-reload helper into native/VoltWidget/build/out. The afterSign hook
# (scripts/embed-widget.cjs) embeds and signs them inside Volt.app.
# Requires Xcode. Skipped (exit 0) on non-macOS hosts.
set -euo pipefail
[[ "$(uname)" == "Darwin" ]] || { echo "build-widget: not macOS, skipping"; exit 0; }

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/native/VoltWidget"
OUT="$SRC/build/out"
rm -rf "$OUT" && mkdir -p "$OUT"

xcodebuild -quiet -project "$SRC/VoltWidget.xcodeproj" -target VoltWidget -configuration Release \
  SYMROOT="$SRC/build" OBJROOT="$SRC/build/obj" build
cp -R "$SRC/build/Release/VoltWidget.appex" "$OUT/"

for arch in arm64 x86_64; do
  xcrun swiftc -O -target "$arch-apple-macos15.0" -framework WidgetKit \
    "$SRC/ReloadHelper/main.swift" -o "$OUT/volt-widget-reload-$arch"
done
lipo -create "$OUT"/volt-widget-reload-arm64 "$OUT"/volt-widget-reload-x86_64 -output "$OUT/volt-widget-reload"
rm "$OUT"/volt-widget-reload-arm64 "$OUT"/volt-widget-reload-x86_64
echo "build-widget: $OUT"
