export default async function handler(request, response) {
  if (request.method !== 'POST') return response.status(405).json({ error: 'Method not allowed' });
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return response.status(503).json({ error: 'Human verification is not configured.' });
  const token = typeof request.body?.token === 'string' ? request.body.token : '';
  if (!token || token.length > 2048) return response.status(400).json({ error: 'Complete the human check and try again.' });
  try {
    const body = new URLSearchParams({ secret, response: token });
    const ip = request.headers['x-forwarded-for']?.split(',')[0]?.trim();
    if (ip) body.set('remoteip', ip);
    const result = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body });
    if (!result.ok) return response.status(502).json({ error: 'Human verification is temporarily unavailable.' });
    const verification = await result.json();
    return response.status(verification.success ? 200 : 400).json({ success: verification.success === true, error: verification.success ? undefined : 'The human check expired or could not be verified.' });
  } catch {
    return response.status(502).json({ error: 'Human verification is temporarily unavailable.' });
  }
}
