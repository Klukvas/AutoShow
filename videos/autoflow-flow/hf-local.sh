#!/bin/sh
set -eu
hf_project_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
mkdir -p "$hf_project_dir/.hyperframes/font-cache" "$hf_project_dir/.hyperframes/tmp"
export HYPERFRAMES_NO_TELEMETRY=1 DO_NOT_TRACK=1 HYPERFRAMES_NO_UPDATE_CHECK=1 HYPERFRAMES_NO_AUTO_INSTALL=1 HF_NO_BROWSER=1
export HYPERFRAMES_RUN_ID=autoflow-preview-20261015
export HYPERFRAMES_FONT_CACHE_DIR="$hf_project_dir/.hyperframes/font-cache"
export XDG_STATE_HOME="$hf_project_dir/.hyperframes/state"
export TMPDIR="$hf_project_dir/.hyperframes/tmp"
export HYPERFRAMES_BROWSER_PATH=/Users/andreypavlenko/Library/Caches/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-mac-arm64/chrome-headless-shell
cd "$hf_project_dir/animation"
exec node /Users/andreypavlenko/.npm/_npx/329cd6bfc4591090/node_modules/hyperframes/bin/hyperframes.mjs "$@"
