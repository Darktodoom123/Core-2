#!/usr/bin/env bash
# Core-2 Isolated Queue Workers Runner
# Starts dedicated worker pools for Operations, AI, and Reporting.

set -euo pipefail

RUN_TARGET="${1:-all}"

case "$RUN_TARGET" in
  operational)
    echo "[core2] Starting Operational Queue Worker (default,high)..."
    exec php artisan queue:work --queue=default,high
    ;;
  ai)
    echo "[core2] Starting Internal AI Queue Worker (ai, timeout 120s, tries 3)..."
    exec php artisan queue:work --queue=ai --timeout=120 --tries=3
    ;;
  reports)
    echo "[core2] Starting Reporting Queue Worker (reports, timeout 360s, tries 2)..."
    exec php artisan queue:work --queue=reports --timeout=360 --tries=2
    ;;
  all)
    echo "[core2] Starting all 3 dedicated queue worker pools..."
    php artisan queue:work --queue=default,high &
    PID_OP=$!
    php artisan queue:work --queue=ai --timeout=120 --tries=3 &
    PID_AI=$!
    php artisan queue:work --queue=reports --timeout=360 --tries=2 &
    PID_REP=$!

    echo "[core2] Workers running: Operational (PID $PID_OP), AI (PID $PID_AI), Reporting (PID $PID_REP)."
    trap 'kill $PID_OP $PID_AI $PID_REP 2>/dev/null || true' SIGINT SIGTERM EXIT
    wait
    ;;
  *)
    echo "Usage: $0 [operational|ai|reports|all]"
    exit 1
    ;;
esac
