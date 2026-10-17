#!/bin/sh
# Run once in each local checkout, including Claude's.
set -eu
cd "$(dirname "$0")/../.."
if [ ! -d .git ] && [ ! -f .git ]; then
  echo 'Not a Git working tree' >&2
  exit 1
fi
chmod +x .githooks/pre-commit
git config --local core.hooksPath .githooks
printf '%s\n' 'Enabled local pre-commit secret scanning (.githooks/pre-commit).'
