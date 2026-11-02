#!/usr/bin/env bash
set -euo pipefail
SOURCE_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
APP_DIR=/var/www/focusource
test "$(systemctl show -p WorkingDirectory focusource.service)" = "WorkingDirectory=$APP_DIR" || { echo 'Unexpected service directory. Nothing changed.' >&2; exit 1; }
test -f "$APP_DIR/server.js"
test -f "$APP_DIR/data/site.json"
test -f "$APP_DIR/data/inquiries.json"
/usr/bin/node --check "$SOURCE_DIR/install.js"
systemctl stop focusource
if ! backup=$(/usr/bin/node "$SOURCE_DIR/install.js" "$APP_DIR"); then
  systemctl start focusource
  exit 1
fi
if systemctl restart focusource; then
  for attempt in 1 2 3 4 5; do
    if curl --fail --silent --max-time 3 http://127.0.0.1:4173/healthz >/dev/null && curl --fail --silent --max-time 3 http://127.0.0.1:4173/catalogue >/dev/null; then
      echo "Published successfully. Backup: $backup"
      echo 'Next: check public /catalogue, download the PDF and refresh the favicon.'
      exit 0
    fi
    sleep 1
  done
fi
echo 'Startup check failed. Restoring previous files.' >&2
systemctl stop focusource || true
/usr/bin/node "$SOURCE_DIR/install.js" --rollback "$backup"
systemctl start focusource
exit 1
