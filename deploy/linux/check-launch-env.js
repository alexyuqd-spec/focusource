// Preflight only: parse simple systemd EnvironmentFile values without executing them.
const fs = require('node:fs');
const values = {};
for (const line of fs.readFileSync('/etc/focusource.env', 'utf8').split(/\r?\n/)) {
  const match = /^([A-Z_]+)=(.*)$/.exec(line);
  if (!match) continue;
  let value = match[2].trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
  values[match[1]] = value;
}
const password = values.ADMIN_PASSWORD || '';
if (password.length < 16 || password.length > 200 || ['ChangeMe123!', 'replace-with-a-long-unique-password'].includes(password)) {
  throw new Error('Set a unique ADMIN_PASSWORD of 16 to 200 characters in /etc/focusource.env first.');
}
if ((values.NODE_ENV && values.NODE_ENV !== 'production') || (values.TRUST_PROXY && values.TRUST_PROXY !== '1') ||
    (values.HOST && values.HOST !== '127.0.0.1') || (values.PORT && values.PORT !== '4173')) {
  throw new Error('This upgrade requires production, TRUST_PROXY=1 and 127.0.0.1:4173. Check the existing service configuration first.');
}
