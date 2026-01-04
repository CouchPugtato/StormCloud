#!/usr/bin/env bash
set -euo pipefail

echo "=== Rebuilding backend ==="
cd ~/StormCloud/stormcloud
go build -o stormcloud-api ./cmd/server/main.go
sudo systemctl restart stormcloud
sudo systemctl --no-pager --lines=10 status stormcloud || true

echo
echo "=== Rebuilding frontend  ==="
cd ~/StormCloud/stormwatch
npx expo export --platform web
sudo caddy validate --config /etc/caddy/Caddyfile
sudo caddy reload --config /etc/caddy/Caddyfile

echo
echo "=== Health checks ==="
echo -n "Backend (local): "
curl -s http://127.0.0.1:8080/api/health || echo "failed"
echo -n "Backend (public): "
curl -s https://redstormcloud.com/api/health || echo "failed"
echo -n "Frontend root (public): "
curl -I https://redstormcloud.com | head -n 1
