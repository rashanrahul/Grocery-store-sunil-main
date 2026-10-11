const { Redis } = require('@upstash/redis');

const allowedKeys = new Set(['categories', 'products', 'orders', 'cart', 'settings']);

// In-memory fallback for when Redis is not configured (local dev, testing)
const memoryStore = {
  categories: [],
  products: [],
  orders: [],
  cart: [],
  settings: {},
};

// Check if Redis is properly configured via environment variables
const hasRedisConfig = process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN;

let redis = null;
if (hasRedisConfig) {
  try {
    redis = Redis.fromEnv();
  } catch (e) {
    console.warn('Upstash Redis initialization failed, using in-memory fallback:', e.message);
  }
} else {
  console.warn('Upstash Redis not configured (missing KV_REST_API_URL/KV_REST_API_TOKEN), using in-memory fallback');
}

async function getValue(key) {
  if (redis) {
    return await redis.get(key);
  }
  return memoryStore[key];
}

async function setValue(key, value) {
  if (redis) {
    await redis.set(key, value);
  } else {
    memoryStore[key] = value;
  }
}

module.exports = async function handler(request, response) {
  const key = request.query.key;

  if (key && !allowedKeys.has(key)) {
    return response.status(400).json({ error: 'Invalid store key' });
  }

  if (request.method === 'GET') {
    if (!key) {
      const entries = await Promise.all([...allowedKeys].map(async (name) => [name, await getValue(name)]));
      return response.status(200).json(Object.fromEntries(entries));
    }

    const value = await getValue(key);
    return response.status(200).json({ key, value: value ?? null });
  }

  if (request.method === 'POST') {
    if (!key || !allowedKeys.has(key)) {
      return response.status(400).json({ error: 'A valid key is required' });
    }

    await setValue(key, request.body?.value ?? null);
    return response.status(200).json({ ok: true, key, value: request.body?.value ?? null });
  }

  response.setHeader('Allow', ['GET', 'POST']);
  return response.status(405).json({ error: 'Method not allowed' });
};
