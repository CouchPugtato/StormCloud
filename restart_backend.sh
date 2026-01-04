#!/usr/bin/env bash
set -euo pipefail
sudo systemctl restart stormcloud
sudo systemctl --no-pager --lines=20 status stormcloud
echo "Backend restarted ✅"
