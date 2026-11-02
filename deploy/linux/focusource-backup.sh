#!/usr/bin/env bash
set -euo pipefail
umask 077
APP_DIR=/var/www/focusource
BACKUP_DIR=/var/backups/focusource
test "$(id -u)" -eq 0 || { echo 'Run as root.' >&2; exit 1; }
test -f "$APP_DIR/data/site.json"
test -f "$APP_DIR/data/inquiries.json"
test -d "$APP_DIR/public/uploads"
test -f /etc/focusource.env
mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"
archive="$BACKUP_DIR/focusource-$(date -u +%Y%m%dT%H%M%S)-$$.tar.gz"
staging=$(mktemp -d "$BACKUP_DIR/.snapshot-XXXXXX")
# Atomic JSON writes make each copied file a complete version.
install -m 600 "$APP_DIR/data/site.json" "$staging/site.json"
install -m 600 "$APP_DIR/data/inquiries.json" "$staging/inquiries.json"
tar -czf "$archive.partial" -C "$staging" site.json inquiries.json -C "$APP_DIR" public/uploads -C /etc focusource.env
tar -tzf "$archive.partial" >/dev/null
mv "$archive.partial" "$archive"
# Remove only the two snapshots we just created, then the now-empty directory.
rm -- "$staging/site.json" "$staging/inquiries.json"
rmdir -- "$staging"
echo "Backup ready: $archive"
echo 'Backups contain enquiry details and credentials. Copy to private off-server storage; monitor disk usage.'
