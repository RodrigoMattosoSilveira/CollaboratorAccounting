#!/usr/bin/env bash
set -euo pipefail
(cd backend && go mod tidy && go run ./cmd/server) &
BACKEND_PID=$!
(cd frontend && npm install && npm run dev) &
FRONTEND_PID=$!
trap 'kill $BACKEND_PID $FRONTEND_PID 2>/dev/null || true' EXIT
wait
