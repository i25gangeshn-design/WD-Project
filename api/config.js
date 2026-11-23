export default function handler(_request, response) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return response.status(503).json({ error: 'Application configuration is incomplete.' });
  response.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300');
  return response.status(200).json({ supabaseUrl: url, supabaseAnonKey: key, turnstileSiteKey: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || '' });
}
