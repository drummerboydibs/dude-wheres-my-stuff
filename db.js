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

  // ----------------------------------------------------------
  // INIT — called once on app load
  // Dynamically loads the Supabase SDK, then smoke-tests the
  // connection via the auth health endpoint before proceeding.
  // ----------------------------------------------------------
  async function init(url, key) {
    await _loadSDK();
    _client = window.supabase.createClient(url, key);
    // Smoke test: verify the URL is a reachable Supabase project by
    // hitting the auth health endpoint — avoids querying the table
    // before the user is logged in (which RLS would reject).
    const res = await fetch(`${url}/auth/v1/health`).catch(() => null);
    if (!res || !res.ok) throw new Error('Could not reach Supabase project. Check your URL.');
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

  // ----------------------------------------------------------
  // FIELD MAPPING  (JS camelCase <-> Postgres snake_case)
  // Author: Dylan Smith | 2026-03-04
  // ----------------------------------------------------------
  function _toDb(loan) {
    const out = {};
    if (loan.item         !== undefined) out.item        = loan.item;
    if (loan.person       !== undefined) out.loaned_to   = loan.person;
    if (loan.category     !== undefined) out.category    = loan.category;
    if (loan.date         !== undefined) out.loaned_on   = loan.date;
    if (loan.due          !== undefined) out.due_date    = loan.due || null;
    if (loan.notes        !== undefined) out.notes       = loan.notes || null;
    if (loan.returned     !== undefined) out.returned    = loan.returned;
    if (loan.returnedDate !== undefined) out.returned_on = loan.returnedDate || null;
    return out;
  }

  function _fromDb(row) {
    return {
      id:           row.id,
      item:         row.item,
      person:       row.loaned_to,
      category:     row.category,
      date:         row.loaned_on,
      due:          row.due_date    || '',
      notes:        row.notes       || '',
      returned:     row.returned,
      returnedDate: row.returned_on || null,
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
  return { init, isCloud, auth, getAll, insert, update, remove };
})();
