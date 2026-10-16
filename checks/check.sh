#!/bin/bash
# Check one feature on a Mac with no Node or Python:   bash checks/check.sh <id>
# Runs checks/run.js through osascript (JavaScript for Automation). Exit code: 0 ok, 1 a check failed, 2 STOP.
# Written for bash 3.2 and BSD tools.

stop() {
  echo "STOP: $1"
  exit 2
}

id="$1"
case "$id" in
  '') stop 'Give the feature id, for example: bash checks/check.sh sites' ;;
esac
# Same rule as the shell and run.js: letters a-z, with single hyphens between words.
if ! printf '%s\n' "$id" | grep -E '^[a-z]+(-[a-z]+)*$' >/dev/null 2>&1; then
  stop 'The feature id must use only the letters a-z and hyphens, for example "my-notes".'
fi

# Go to the folder above checks/, so paths work from anywhere.
here=$(dirname "$0")
cd "$here/.." || stop 'I cannot open the app folder.'

if [ "$id" = "example" ]; then
  feature=docs/example-feature.js
  checkfile=docs/example-feature.check.js
else
  feature="features/$id.js"
  checkfile="checks/$id.check.js"
fi
[ -f "$feature" ] || stop "I cannot find $feature."
[ -f "$checkfile" ] || stop "I cannot find $checkfile. Write it first."
[ -f checks/run.js ] || stop 'I cannot find checks/run.js.'

if ! command -v osascript >/dev/null 2>&1; then
  stop 'This needs osascript, which only a Mac has. Elsewhere, run: node checks/run.js '"$id"
fi

# Keep the output so a failure still counts if osascript's exit code is lost.
out=$(osascript -l JavaScript checks/run.js "$id" 2>&1)
rc=$?
printf '%s\n' "$out"
if [ "$rc" -ne 0 ]; then
  exit "$rc"
fi
if printf '%s\n' "$out" | grep -E '^STOP: ' >/dev/null; then exit 2; fi
if printf '%s\n' "$out" | grep -E '^FAILED ' >/dev/null; then exit 1; fi
exit 0
