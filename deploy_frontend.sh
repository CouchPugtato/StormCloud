#!/usr/bin/env bash
set -euo pipefail
cd /home/stormcloud/StormCloud/stormwatch
npx expo export --platform web
sudo caddy reload
echo "Frontend deployed ✅"
