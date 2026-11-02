// Optional Resend delivery. Secrets stay in environment variables, never site.json.
const { request } = require('./http-request');
function createInquiryNotifier({ readInquiries, writeInquiries, env = process.env, fetchImpl = request, now = Date.now }) {
  const enabled = Boolean(env.RESEND_API_KEY && env.INQUIRY_EMAIL_FROM && env.INQUIRY_EMAIL_TO);
  let running = false;
  function initialState() {
    return { status: enabled ? 'pending' : 'not_configured', attempts: 0 };
  }
  async function flush() {
    if (!enabled || running) return;
    running = true;
    try {
      const pending = readInquiries().filter((item) => item.notification?.status === 'pending' &&
        (!item.notification.nextAttemptAt || Date.parse(item.notification.nextAttemptAt) <= now())).slice(0, 10);
      for (const item of pending) {
        const previous = item.notification;
        const firstAttemptAt = previous.firstAttemptAt || new Date(now()).toISOString();
        const attempts = previous.attempts + 1;
        let notification;
        // Keep retries inside the provider's 24-hour idempotency window.
        if (attempts > 8 || now() - Date.parse(firstAttemptAt) >= 23 * 60 * 60 * 1000) {
          notification = { ...previous, status: 'failed' };
        } else {
          // Persist the idempotency window before delivery, including across a crash.
          const beforeSend = readInquiries();
          const queued = beforeSend.find((entry) => entry.id === item.id);
          if (!queued) continue;
          queued.notification = { ...previous, attempts, firstAttemptAt };
          writeInquiries(beforeSend);
          try {
            const response = await fetchImpl('https://api.resend.com/emails', {
              method: 'POST',
              timeoutMs: 15000,
              headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json', 'Idempotency-Key': `inquiry-${item.id}` },
              body: JSON.stringify({
                from: env.INQUIRY_EMAIL_FROM,
                to: env.INQUIRY_EMAIL_TO.split(',').map((value) => value.trim()).filter(Boolean),
                reply_to: item.email,
                subject: 'New website enquiry | FOCUSOURCE',
                text: ['A new enquiry was saved in your website admin.', '',
                  `Reference: ${item.id}`, `Received: ${item.createdAt}`, `Name: ${item.name}`,
                  `Email: ${item.email}`, `Company: ${item.company}`, `Phone: ${item.phone}`,
                  `Product: ${item.product}`, `Quantity: ${item.quantity}`, '', item.message].join('\n')
              })
            });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            notification = { status: 'sent', attempts, firstAttemptAt, sentAt: new Date(now()).toISOString() };
          } catch {
            notification = { status: attempts >= 8 ? 'failed' : 'pending', attempts, firstAttemptAt,
              nextAttemptAt: new Date(now() + Math.min(2 ** attempts * 60000, 3600000)).toISOString() };
            console.error(`Enquiry email delivery failed; reference=${item.id}, attempt=${attempts}. Check mail configuration.`);
          }
        }
        // Re-read to preserve status edits or new enquiries received while awaiting email.
        const current = readInquiries();
        const saved = current.find((entry) => entry.id === item.id);
        if (saved) {
          saved.notification = notification;
          writeInquiries(current);
        }
      }
    } finally { running = false; }
  }
  return { enabled, initialState, flush };
}

module.exports = { createInquiryNotifier };
