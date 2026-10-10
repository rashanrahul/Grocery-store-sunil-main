const fs = require('node:fs');
const path = require('node:path');

function createDataStore(filePath = path.join(process.cwd(), 'data-store.json')) {
  const resolved = path.resolve(filePath);

  function ensureFile() {
    const dir = path.dirname(resolved);
    fs.mkdirSync(dir, { recursive: true });
    if (!fs.existsSync(resolved)) {
      fs.writeFileSync(resolved, JSON.stringify({
        products: [],
        categories: [],
        orders: [],
        settings: {},
      }, null, 2));
    }
  }

  async function read(key) {
    ensureFile();
    const raw = fs.readFileSync(resolved, 'utf8');
    const data = JSON.parse(raw || '{}');
    return data[key] ?? [];
  }

  async function save(key, value) {
    ensureFile();
    const raw = fs.readFileSync(resolved, 'utf8');
    const data = JSON.parse(raw || '{}');
    data[key] = value;
    fs.writeFileSync(resolved, JSON.stringify(data, null, 2));
    return value;
  }

  return { read, save };
}

if (typeof module !== 'undefined') {
  module.exports = { createDataStore };
}
