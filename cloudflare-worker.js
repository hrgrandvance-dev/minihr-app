/**
 * Cloudflare Worker — LINE Webhook proxy with signature verification
 * Deploy this to https://your-domain/webhook
 *
 * Setup:
 * 1. Create Cloudflare Worker
 * 2. Add LINE_CHANNEL_SECRET to environment secrets
 * 3. Update your LINE Bot webhook URL to: https://your-domain/webhook
 */

async function handleRequest(request) {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const signature = request.headers.get('x-line-signature');
  const body = await request.text();

  // Verify LINE signature
  const secret = LINE_CHANNEL_SECRET;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const hash = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
  const expectedSignature = btoa(String.fromCharCode(...new Uint8Array(hash)));

  if (signature !== expectedSignature) {
    console.error('Invalid LINE signature');
    return new Response(JSON.stringify({ ok: false, error: 'invalid_signature' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Forward to Google Apps Script
  const appsScriptUrl = 'https://script.google.com/macros/s/AKfycbxBkocmZN1yPzozv74oJAq3-qbKky0-KM9a1ZTUrajg6Qh5eaJIikrB4vJcttXr_UWS/exec';
  const response = await fetch(appsScriptUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body
  });

  return response;
}

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});
