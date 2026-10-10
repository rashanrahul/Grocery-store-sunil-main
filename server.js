const express = require('express');
const fs = require('node:fs');
const path = require('node:path');

if (typeof global.localStorage === 'undefined') {
  global.localStorage = {
    store: {},
    getItem(key) { return Object.prototype.hasOwnProperty.call(this.store, key) ? this.store[key] : null; },
    setItem(key, value) { this.store[key] = String(value); },
    removeItem(key) { delete this.store[key]; },
  };
}

const { DB } = require('./data.js');

const app = express();
const PORT = process.env.PORT || 3000;
const STORE_FILE = path.join(__dirname, 'store.json');

app.use(express.json());
app.use(express.static(__dirname));

function ensureStore() {
  const defaultStore = {
    categories: DB.defaultCategories,
    products: DB.defaultProducts,
    orders: [],
    cart: [],
    settings: {
      name: 'Sunil Store',
      tagline: 'Fresh Choices, Happy Homes.',
      phone: '0775163271',
      address: 'Udalamatta, Galle',
      mapUrl: 'https://www.google.com/maps/place/Sunil+Store/@6.1829866,80.2948983,17z/data=!3m1!4b1!4m6!3m5!1s0x3ae1650053d15c7b:0xb8600c6f5bb91ff!8m2!3d6.1829866!4d80.2948983!16s%2Fg%2F11xh5tx4py?entry=ttu&g_ep=EgoyMDI2MDkwMi4wIKXMDSoASAFQAw%3D%3D',
      openTime: '06:00',
      closeTime: '21:00',
      openDays: [0, 1, 2, 3, 4, 5, 6],
    },
  };

  if (!fs.existsSync(STORE_FILE)) {
    fs.writeFileSync(STORE_FILE, JSON.stringify(defaultStore, null, 2));
    return;
  }

  try {
    const store = JSON.parse(fs.readFileSync(STORE_FILE, 'utf8') || '{}');
    const needsSeed = !store || typeof store !== 'object' || (!Array.isArray(store.categories) || store.categories.length === 0) || (!Array.isArray(store.products) || store.products.length === 0);
    if (needsSeed) {
      fs.writeFileSync(STORE_FILE, JSON.stringify({ ...defaultStore, ...store, categories: store.categories && store.categories.length ? store.categories : defaultStore.categories, products: store.products && store.products.length ? store.products : defaultStore.products }, null, 2));
    }
  } catch (error) {
    console.warn('Store seed check failed, resetting to default catalog:', error.message || error);
    fs.writeFileSync(STORE_FILE, JSON.stringify(defaultStore, null, 2));
  }
}

function readStore() {
  ensureStore();
  return JSON.parse(fs.readFileSync(STORE_FILE, 'utf8'));
}

function writeStore(data) {
  ensureStore();
  fs.writeFileSync(STORE_FILE, JSON.stringify(data, null, 2));
}

app.get('/api/store', (req, res) => {
  const store = readStore();
  const key = req.query.key;
  if (!key) {
    return res.json(store);
  }
  res.json({ key, value: store[key] ?? [] });
});

app.post('/api/store', (req, res) => {
  const { key, value } = req.body || {};
  if (!key) {
    return res.status(400).json({ error: 'Missing key' });
  }

  const store = readStore();
  store[key] = value;
  writeStore(store);
  res.json({ ok: true, key, value });
});

app.get('/health', (req, res) => res.json({ ok: true }));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Sunil Store running on http://localhost:${PORT}`);
});
