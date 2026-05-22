// Minimal localStorage shim so db.js can run in Node.js
let _store = {};
global.localStorage = {
  getItem:    key      => _store[key] ?? null,
  setItem:    (key, v) => { _store[key] = String(v); },
  removeItem: key      => { delete _store[key]; },
};

const db = require('../db.js');

beforeEach(() => { _store = {}; });

const BASE = { item: 'Drill', person: 'Bob', categoryId: 3, date: '2026-01-01', due: '', notes: '', returned: false, returnedDate: null };

describe('local storage CRUD', () => {
  it('insert returns a record with a numeric id', async () => {
    const record = await db.insert(BASE);
    expect(typeof record.id).toBe('number');
    expect(record.item).toBe('Drill');
  });

  it('getAll returns all inserted records', async () => {
    await db.insert({ ...BASE, item: 'A' });
    await db.insert({ ...BASE, item: 'B' });
    const all = await db.getAll();
    expect(all.length).toBe(2);
  });

  it('inserts are returned newest-first', async () => {
    await db.insert({ ...BASE, item: 'First' });
    await db.insert({ ...BASE, item: 'Second' });
    const all = await db.getAll();
    expect(all[0].item).toBe('Second');
  });

  it('update modifies specific fields', async () => {
    const record = await db.insert(BASE);
    const updated = await db.update(record.id, { returned: true, returnedDate: '2026-02-01' });
    expect(updated.returned).toBe(true);
    expect(updated.returnedDate).toBe('2026-02-01');
    expect(updated.item).toBe('Drill'); // untouched fields survive
  });

  it('remove deletes the record', async () => {
    const record = await db.insert(BASE);
    await db.remove(record.id);
    const all = await db.getAll();
    expect(all.find(l => l.id === record.id)).toBeUndefined();
  });

  it('successive inserts get unique ids', async () => {
    const a = await db.insert({ ...BASE, item: 'A' });
    const b = await db.insert({ ...BASE, item: 'B' });
    expect(a.id).not.toBe(b.id);
  });

  it('update rejects a non-existent id', async () => {
    await expect(db.update(9999, { returned: true })).rejects.toThrow('Not found');
  });
});
