#!/bin/sh
# Snapshot the entire application state (all organizations' databases and
# uploads) into a dated tarball. Run from the repository root, e.g. nightly
# via cron:  0 3 * * * /path/to/repo/scripts/backup.sh
set -eu
cd "$(dirname "$0")/.."
DATA_DIR="${DATA_DIR:-./data}"
mkdir -p backups
STAMP="$(date +%Y%m%d-%H%M%S)"
tar -czf "backups/sjc-vite-data-$STAMP.tar.gz" -C "$(dirname "$DATA_DIR")" "$(basename "$DATA_DIR")"
echo "Backup written: backups/sjc-vite-data-$STAMP.tar.gz"
# Keep the most recent 30 backups.
ls -1t backups/sjc-vite-data-*.tar.gz 2>/dev/null | tail -n +31 | xargs -I{} rm -f {}
