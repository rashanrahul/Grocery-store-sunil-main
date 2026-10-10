const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createDataStore } = require('./data-store');

const tempDir = path.join(__dirname, '.tmp-test-store');
const tempFile = path.join(tempDir, 'store.json');

test('central data store persists shared records across writes', async () => {
  fs.mkdirSync(tempDir, { recursive: true });
  fs.writeFileSync(tempFile, JSON.stringify({ orders: [], products: [], categories: [], settings: {} }, null, 2));

  const store = createDataStore(tempFile);
  await store.save('orders', [{ id: 'FM-10025', status: 'Pending' }]);
  await store.save('settings', { name: 'Sunil Store' });

  const orders = await store.read('orders');
  const settings = await store.read('settings');

  assert.deepEqual(orders, [{ id: 'FM-10025', status: 'Pending' }]);
  assert.deepEqual(settings, { name: 'Sunil Store' });

  fs.rmSync(tempDir, { recursive: true, force: true });
});
