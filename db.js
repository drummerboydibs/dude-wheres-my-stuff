// ============================================================
// db.js — Database & Auth Abstraction Layer
// Author: Dylan Smith
// Date:   2026-03-04
//
// All storage and auth operations route through this module.
// UI code never talks to Supabase directly — only through
// these methods. Swapping backends = changing this file only.
// ============================================================

const db = (() => {
  let _client = null;
  const TABLE = 'loans';
  const REASONS_TABLE    = 'writeoff_reasons';
  const CATEGORIES_TABLE = 'item_categories';

  // ----------------------------------------------------------
  // INIT — called once on app load
  // Dynamically loads the Supabase SDK, then smoke-tests the
  // connection via the auth health endpoint before proceeding.
  // ----------------------------------------------------------
  async function init(url, key) {
    await _loadSDK();
    _client = window.supabase.createClient(url, key);
    // Smoke test: use the SDK's auth.getSession() — a CORS-safe way to
    // verify the project is reachable. A direct fetch to /auth/v1/health
    // is blocked by CORS in browsers, but the SDK handles headers correctly.
    // getSession() is safe before login; it returns null if no session exists.
    const { error: _smokeErr } = await _client.auth.getSession();
    if (_smokeErr) throw new Error("Could not reach Supabase project. Check your URL.");
  }

  async function _loadSDK() {
    const SRC = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';
    if (window.supabase) return;
    await new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = SRC;
      s.onload = resolve;
      s.onerror = () => reject(new Error('Failed to load Supabase SDK'));
      document.head.appendChild(s);
    });
  }

  function isCloud() { return !!_client; }

  // ----------------------------------------------------------
  // AUTH
  // Author: Dylan Smith | 2026-03-04
  // ----------------------------------------------------------
  const auth = {
    async signUp(email, password) {
      _requireCloud();
      const { data, error } = await _client.auth.signUp({ email, password });
      if (error) throw new Error(error.message);
      return data;
    },

    async signIn(email, password) {
      _requireCloud();
      const { data, error } = await _client.auth.signInWithPassword({ email, password });
      if (error) throw new Error(error.message);
      return data;
    },

    async signOut() {
      _requireCloud();
      const { error } = await _client.auth.signOut();
      if (error) throw new Error(error.message);
    },

    async getSession() {
      if (!_client) return null;
      const { data } = await _client.auth.getSession();
      return data?.session ?? null;
    },

    onAuthStateChange(callback) {
      if (!_client) return { data: { subscription: { unsubscribe: () => {} } } };
      return _client.auth.onAuthStateChange(callback);
    },
  };

  // ----------------------------------------------------------
  // LOANS CRUD
  // Author: Dylan Smith | 2026-03-04
  // ----------------------------------------------------------
  async function getAll() {
    if (_client) {
      const { data, error } = await _client
        .from(TABLE)
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw new Error(error.message);
      return data.map(_fromDb);
    }
    return _local.getAll();
  }

  async function insert(loan) {
    if (_client) {
      const { data: { user } } = await _client.auth.getUser();
      const { data, error } = await _client
        .from(TABLE)
        .insert([{ ..._toDb(loan), user_id: user.id }])
        .select()
        .single();
      if (error) throw new Error(error.message);
      return _fromDb(data);
    }
    return _local.insert(loan);
  }

  async function update(id, changes) {
    if (_client) {
      const { data, error } = await _client
        .from(TABLE)
        .update(_toDb(changes))
        .eq('id', id)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return _fromDb(data);
    }
    return _local.update(id, changes);
  }

  async function remove(id) {
    if (_client) {
      const { error } = await _client.from(TABLE).delete().eq('id', id);
      if (error) throw new Error(error.message);
      return true;
    }
    return _local.remove(id);
  }

  async function getCategories() {
    if (_client) {
      const { data, error } = await _client
        .from(CATEGORIES_TABLE)
        .select('id, name, slug')
        .order('display_order', { ascending: true });
      if (error) throw new Error(error.message);
      return data;
    }
    return [
      { id: 1, name: 'Other',    slug: 'other'    },
      { id: 2, name: 'Book',     slug: 'book'     },
      { id: 3, name: 'Tool',     slug: 'tool'     },
      { id: 4, name: 'Clothing', slug: 'clothing' },
      { id: 5, name: 'Media',    slug: 'media'    },
    ];
  }

  async function getWriteoffReasons() {
    if (_client) {
      const { data, error } = await _client
        .from(REASONS_TABLE)
        .select('id, name')
        .order('display_order', { ascending: true });
      if (error) throw new Error(error.message);
      return data;
    }
    return [
      { id: 1, name: 'Lost' },
      { id: 2, name: 'Stolen' },
      { id: 3, name: 'Broken' },
      { id: 4, name: 'Given as Gift' },
    ];
  }

  // ----------------------------------------------------------
  // FIELD MAPPING  (JS camelCase <-> Postgres snake_case)
  // Author: Dylan Smith | 2026-03-04
  // ----------------------------------------------------------
  function _toDb(loan) {
    const out = {};
    if (loan.item         !== undefined) out.item        = loan.item;
    if (loan.person       !== undefined) out.loaned_to   = loan.person;
    if (loan.categoryId   !== undefined) out.category_id = loan.categoryId;
    if (loan.date         !== undefined) out.loaned_on   = loan.date;
    if (loan.due          !== undefined) out.due_date    = loan.due || null;
    if (loan.notes        !== undefined) out.notes       = loan.notes || null;
    if (loan.returned       !== undefined) out.returned        = loan.returned;
    if (loan.returnedDate   !== undefined) out.returned_on     = loan.returnedDate   || null;
    if (loan.writtenOff     !== undefined) out.written_off     = loan.writtenOff;
    if (loan.writeoffReason !== undefined) out.writeoff_reason = loan.writeoffReason || null;
    if (loan.writtenOffDate !== undefined) out.written_off_on  = loan.writtenOffDate || null;
    return out;
  }

  function _fromDb(row) {
    return {
      id:           row.id,
      item:         row.item,
      person:       row.loaned_to,
      categoryId:   row.category_id,
      date:         row.loaned_on,
      due:          row.due_date    || '',
      notes:        row.notes       || '',
      returned:       row.returned,
      returnedDate:   row.returned_on    || null,
      writtenOff:     row.written_off    || false,
      writeoffReason: row.writeoff_reason || null,
      writtenOffDate: row.written_off_on  || null,
    };
  }

  // ----------------------------------------------------------
  // LOCAL STORAGE FALLBACK
  // Author: Dylan Smith | 2026-03-04
  // ----------------------------------------------------------
  const _local = {
    _key: 'loanlist_v2',
    _load()  { return JSON.parse(localStorage.getItem(this._key) || '[]'); },
    _save(d) { localStorage.setItem(this._key, JSON.stringify(d)); },
    _newId(loans) { return loans.length ? Math.max(...loans.map(l => l.id)) + 1 : 1; },

    getAll()  { return Promise.resolve(this._load()); },

    insert(loan) {
      const loans = this._load();
      const record = { ...loan, id: this._newId(loans) };
      loans.unshift(record);
      this._save(loans);
      return Promise.resolve(record);
    },

    update(id, changes) {
      const loans = this._load();
      const idx = loans.findIndex(l => l.id === id);
      if (idx === -1) return Promise.reject(new Error('Not found'));
      loans[idx] = { ...loans[idx], ...changes };
      this._save(loans);
      return Promise.resolve(loans[idx]);
    },

    remove(id) {
      this._save(this._load().filter(l => l.id !== id));
      return Promise.resolve(true);
    },
  };

  function _requireCloud() {
    if (!_client) throw new Error('Supabase not connected');
  }

  // ----------------------------------------------------------
  // PUBLIC API
  // Author: Dylan Smith | 2026-03-04
  // ----------------------------------------------------------
  return { init, isCloud, auth, getAll, insert, update, remove, getCategories, getWriteoffReasons };
})();
