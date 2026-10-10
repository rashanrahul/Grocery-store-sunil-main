const { Redis } = require('@upstash/redis');

const redis = Redis.fromEnv();

const allowedKeys = new Set(['categories', 'products', 'orders', 'cart', 'settings']);

module.exports = async function handler(request, response) {
  const key = request.query.key;

  if (key && !allowedKeys.has(key)) {
    return response.status(400).json({ error: 'Invalid store key' });
  }

  if (request.method === 'GET') {
    if (!key) {
      const entries = await Promise.all([...allowedKeys].map(async (name) => [name, await redis.get(name)]));
      return response.status(200).json(Object.fromEntries(entries));
    }

    const value = await redis.get(key);
    return response.status(200).json({ key, value: value ?? null });
  }

  if (request.method === 'POST') {
    if (!key || !allowedKeys.has(key)) {
      return response.status(400).json({ error: 'A valid key is required' });
    }

    await redis.set(key, request.body?.value ?? null);
    return response.status(200).json({ ok: true, key, value: request.body?.value ?? null });
  }

  response.setHeader('Allow', ['GET', 'POST']);
  return response.status(405).json({ error: 'Method not allowed' });
};
