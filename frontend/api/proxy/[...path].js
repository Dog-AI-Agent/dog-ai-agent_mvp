export const config = { runtime: 'edge' };

const BACKEND = process.env.BACKEND_URL || 'https://brotherly-impeachable-alyce.ngrok-free.dev';

export default async function handler(req) {
  const url = new URL(req.url);

  // Vercel catch-all [...path] passes matched segments as query param "...path"
  const pathParam = url.searchParams.get('...path') || '';
  // Remove ...path from query string, keep the rest
  url.searchParams.delete('...path');
  const qs = url.searchParams.toString();
  const targetUrl = `${BACKEND}/${pathParam}${qs ? '?' + qs : ''}`;

  const forwardHeaders = {};
  req.headers.forEach((value, key) => {
    if (key.toLowerCase() !== 'host') forwardHeaders[key] = value;
  });
  forwardHeaders['ngrok-skip-browser-warning'] = 'true';

  const isBodyMethod = !['GET', 'HEAD'].includes(req.method.toUpperCase());
  const body = isBodyMethod ? await req.arrayBuffer() : undefined;

  try {
    const response = await fetch(targetUrl, { method: req.method, headers: forwardHeaders, body });
    const resBody = await response.arrayBuffer();
    const ct = response.headers.get('content-type') || 'application/json';
    return new Response(resBody, {
      status: response.status,
      headers: {
        'content-type': ct,
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': '*',
        'Access-Control-Allow-Headers': '*',
      },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 502,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }
}
