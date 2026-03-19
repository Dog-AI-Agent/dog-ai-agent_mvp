const BACKEND = process.env.BACKEND_URL || 'https://brotherly-impeachable-alyce.ngrok-free.dev';

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // /api/backend?path=/api/v1/breeds -> BACKEND/api/v1/breeds
  const targetPath = req.query.path || '/';
  // Remove 'path' from query, keep the rest as query string
  const { path: _, ...restQuery } = req.query;
  const qs = new URLSearchParams(restQuery).toString();
  const targetUrl = `${BACKEND}${targetPath}${qs ? '?' + qs : ''}`;

  const forwardHeaders = { ...req.headers, 'ngrok-skip-browser-warning': 'true' };
  delete forwardHeaders['host'];

  try {
    const fetchOptions = {
      method: req.method,
      headers: forwardHeaders,
    };

    if (!['GET', 'HEAD'].includes(req.method)) {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      fetchOptions.body = Buffer.concat(chunks);
    }

    const response = await fetch(targetUrl, fetchOptions);
    const data = await response.arrayBuffer();

    const ct = response.headers.get('content-type');
    if (ct) res.setHeader('content-type', ct);
    res.status(response.status).send(Buffer.from(data));
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
};
