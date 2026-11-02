#!/usr/bin/env bash
set -euo pipefail
umask 077
APP_DIR=/var/www/focusource
SOURCE_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)
test "$(id -u)" -eq 0 || { echo 'Run this script with sudo.' >&2; exit 1; }
test "$SOURCE_DIR" != "$APP_DIR" || { echo 'Extract the upgrade in a separate directory first.' >&2; exit 1; }
test -f "$APP_DIR/server.js" && test -f "$APP_DIR/data/site.json" && test -f "$APP_DIR/data/inquiries.json"
test -f /etc/focusource.env
test -x /usr/bin/node
/usr/bin/node -e 'const [major, minor, patch] = process.versions.node.split(".").map(Number); if (major < 16 || (major === 16 && (minor < 20 || (minor === 20 && patch < 2)))) { console.error("This package requires Node 16.20.2 or newer; no runtime installation was attempted."); process.exit(1); }'
SYSTEMD_VERSION=$(systemctl --version | awk 'NR==1 {print $2}')
[[ "$SYSTEMD_VERSION" =~ ^[0-9]+$ ]] && test "$SYSTEMD_VERSION" -ge 219 || { echo 'systemd 219 or newer is required.' >&2; exit 1; }
UNIT_TEMPLATE=focusource.service
if test "$SYSTEMD_VERSION" -lt 232; then UNIT_TEMPLATE=focusource-legacy.service; fi
systemctl cat focusource.service >/dev/null
test "$(systemctl show -p WorkingDirectory focusource.service | sed -n 's/^WorkingDirectory=//p')" = "$APP_DIR" || { echo 'This upgrade requires the standard /var/www/focusource systemd deployment.' >&2; exit 1; }
test "$(systemctl show -p FragmentPath focusource.service | sed -n 's/^FragmentPath=//p')" = /etc/systemd/system/focusource.service || { echo 'Review the nonstandard service file before upgrading.' >&2; exit 1; }
test -z "$(systemctl show -p DropInPaths focusource.service | sed -n 's/^DropInPaths=//p')" || { echo 'Custom service drop-ins require manual review before upgrading.' >&2; exit 1; }
# Preserve the current account on CentOS and Debian-family systems alike.
# Moving a root service to a dedicated account needs a separate permissions review.
SERVICE_USER=$(systemctl show -p User focusource.service | sed -n 's/^User=//p')
SERVICE_USER=${SERVICE_USER:-root}
id "$SERVICE_USER" >/dev/null
SERVICE_GROUP=$(systemctl show -p Group focusource.service | sed -n 's/^Group=//p')
SERVICE_GROUP=${SERVICE_GROUP:-$(id -gn "$SERVICE_USER")}
[[ "$SERVICE_USER" =~ ^[a-z_][a-z0-9_-]*[$]?$ ]] && [[ "$SERVICE_GROUP" =~ ^[a-z_][a-z0-9_-]*[$]?$ ]] || { echo 'Unsupported service account name; review manually.' >&2; exit 1; }
getent group "$SERVICE_GROUP" >/dev/null
echo "Keeping existing service account: $SERVICE_USER:$SERVICE_GROUP"
test -f "$SOURCE_DIR/inquiry-notifications.js"
for file in server.js applications.js company-pages.js international-search.js vietnam-search.js search-translations.json seo-guides.js brand-catalogue.js media-library.js inquiry-notifications.js http-request.js package.json public/index.html public/app.js public/admin.html public/admin.js public/tracking.js public/tracking.css public/guides.css public/brand-catalogue.css public/favicon.ico scripts/audit-site.js deploy/linux/focusource.service deploy/linux/focusource-legacy.service deploy/linux/focusource-backup.sh deploy/linux/focusource-backup.service deploy/linux/focusource-backup.timer deploy/linux/apply-launch-settings.js deploy/linux/check-launch-env.js; do test -f "$SOURCE_DIR/$file"; done
for file in server.js applications.js company-pages.js international-search.js vietnam-search.js seo-guides.js brand-catalogue.js media-library.js inquiry-notifications.js http-request.js scripts/audit-site.js deploy/linux/check-launch-env.js deploy/linux/apply-launch-settings.js; do /usr/bin/node --check "$SOURCE_DIR/$file"; done
# Validate the existing secret without printing it. Never generate or replace a password here.
/usr/bin/node "$SOURCE_DIR/deploy/linux/check-launch-env.js"
if test "${1:-}" = --check; then
  echo "Preflight passed. Node $(/usr/bin/node --version), systemd $SYSTEMD_VERSION, template $UNIT_TEMPLATE. No changes made."
  exit 0
fi
test "$#" -eq 0 || { echo 'Usage: bash upgrade-launch.sh [--check]' >&2; exit 1; }
install -d -o "$SERVICE_USER" -g "$SERVICE_GROUP" "$APP_DIR/public/uploads"
install -m 700 "$SOURCE_DIR/deploy/linux/focusource-backup.sh" /usr/local/sbin/focusource-backup
systemctl stop focusource
code_backup=''
finish_upgrade() {
  status=$?
  trap - EXIT
  if test "$status" -ne 0 && test -n "$code_backup" && test -f "$code_backup" && test -f "${code_backup%.tar.gz}.service"; then
    echo 'Upgrade failed; attempting to restore previous code and service. Current data/uploads are retained.' >&2
    systemctl stop focusource || true
    tar -xzf "$code_backup" -C "$APP_DIR" || echo 'Code rollback failed; manual recovery required.' >&2
    cp -- "${code_backup%.tar.gz}.service" /etc/systemd/system/focusource.service || echo 'Service rollback failed.' >&2
    systemctl daemon-reload || true
  fi
  systemctl start focusource || echo 'Service start failed; check journalctl -u focusource.' >&2
  exit "$status"
}
trap finish_upgrade EXIT
/usr/local/sbin/focusource-backup
# Preserve code for rollback separately from the daily data backup.
backup_target="/var/backups/focusource/code-before-launch-$(date -u +%Y%m%dT%H%M%S)-$$.tar.gz"
cp -- /etc/systemd/system/focusource.service "${backup_target%.tar.gz}.service"
tar -czf "$backup_target.partial" --exclude='./data' --exclude='./public/uploads' --exclude='./node_modules' --exclude='./.git' -C "$APP_DIR" .
tar -tzf "$backup_target.partial" >/dev/null
mv -- "$backup_target.partial" "$backup_target"
code_backup=$backup_target
for file in server.js applications.js company-pages.js international-search.js vietnam-search.js search-translations.json seo-guides.js brand-catalogue.js media-library.js inquiry-notifications.js http-request.js package.json; do install -m 644 "$SOURCE_DIR/$file" "$APP_DIR/$file"; done
for file in index.html app.js admin.html admin.js tracking.js tracking.css guides.css brand-catalogue.css; do install -m 644 "$SOURCE_DIR/public/$file" "$APP_DIR/public/$file"; done
install -d "$APP_DIR/public/assets/brand" "$APP_DIR/public/downloads"
cp -R "$SOURCE_DIR/public/assets/brand/." "$APP_DIR/public/assets/brand/"
install -m 644 "$SOURCE_DIR/public/favicon.ico" "$APP_DIR/public/favicon.ico"
install -m 644 "$SOURCE_DIR/public/downloads/FOCUSOURCE-Strapping-Systems-Catalogue.pdf" "$APP_DIR/public/downloads/FOCUSOURCE-Strapping-Systems-Catalogue.pdf"
install -d "$APP_DIR/public/assets/guides"
cp -R "$SOURCE_DIR/public/assets/guides/." "$APP_DIR/public/assets/guides/"
install -d "$APP_DIR/deploy/linux" "$APP_DIR/scripts"
cp "$SOURCE_DIR/deploy/linux/"* "$APP_DIR/deploy/linux/"
install -m 644 "$SOURCE_DIR/scripts/audit-site.js" "$APP_DIR/scripts/audit-site.js"
/usr/bin/node "$SOURCE_DIR/deploy/linux/apply-launch-settings.js" "$APP_DIR/data/site.json"
chown "$SERVICE_USER:$SERVICE_GROUP" "$APP_DIR/data/site.json"
chmod 600 /etc/focusource.env
unit_temp=$(mktemp /etc/systemd/system/.focusource-upgrade-XXXXXX)
sed -e "s/^User=.*/User=$SERVICE_USER/" -e "s/^Group=.*/Group=$SERVICE_GROUP/" "$SOURCE_DIR/deploy/linux/$UNIT_TEMPLATE" > "$unit_temp"
install -m 644 "$unit_temp" /etc/systemd/system/focusource.service
rm -- "$unit_temp"
install -m 644 "$SOURCE_DIR/deploy/linux/focusource-backup.service" /etc/systemd/system/focusource-backup.service
install -m 644 "$SOURCE_DIR/deploy/linux/focusource-backup.timer" /etc/systemd/system/focusource-backup.timer
systemctl daemon-reload
systemctl enable focusource
systemctl enable focusource-backup.timer
systemctl start focusource-backup.timer
systemctl start focusource
healthy=0
for attempt in {1..10}; do
  if curl --fail --silent --show-error --max-time 3 http://127.0.0.1:4173/healthz; then healthy=1; break; fi
  sleep 1
done
test "$healthy" -eq 1 || { echo 'Health check failed.' >&2; exit 1; }
trap - EXIT
echo
echo "Upgrade complete. Previous code: $code_backup"
echo 'Next: run the public URL audit and configure optional email/Google accounts.'
