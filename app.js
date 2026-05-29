// ============================================================
// DUDE, WHERE'S MY STUFF? — app.js
// Author: Dylan Smith
// Date:   2026-05-23 (extracted from index.html)
//
// Depends on (loaded before this file in index.html):
//   - config.js  — optional baked-in Supabase URL + anon key
//   - utils.js   — escapeHtml, formatDate, daysSince, isOverdue,
//                  matchesSearch, resolveCategory, catPillClass
//   - db.js      — Supabase wrapper (db.init, db.auth, db.insert, ...)
// ============================================================


// ============================================================
// CONFIG
// Author: Dylan Smith | 2026-03-04
// ============================================================
// Supabase URL + publishable key are baked into config.js and
// loaded at page load. The anon key is browser-safe by design;
// RLS policies on each table are what protect user data.

// Set when the user opts to sign up from inside the demo. Persists
// across page loads so we can offer to migrate their demo items
// after they confirm their email and sign in for the first time.
const PENDING_MIGRATION_KEY = 'loanlist_pending_demo_migration';

// True while the user is exploring with seeded sample data and no
// real Supabase session.
let demoMode = false;

function getConfig() {
  return {
    url: window.LOAN_LIST_SUPABASE_URL || '',
    key: window.LOAN_LIST_SUPABASE_KEY || '',
  };
}

// ============================================================
// AUTH GATE UI
// Author: Dylan Smith | 2026-03-04 / 2026-05-23
// ============================================================
let currentTab = 'signin';

function switchTab(tab) {
  currentTab = tab;
  document.getElementById('tabSignIn').classList.toggle('auth-tab--active', tab === 'signin');
  document.getElementById('tabSignUp').classList.toggle('auth-tab--active', tab === 'signup');
  document.getElementById('authSubmitLabel').textContent = tab === 'signin' ? 'Sign In' : 'Create Account';
  document.getElementById('authPassword').autocomplete = tab === 'signin' ? 'current-password' : 'new-password';
  clearMsg('authMessage');
}

// Show the landing splash; hide the auth card.
function showLanding() {
  document.getElementById('landingCard').style.display = '';
  document.getElementById('authCard').style.display    = 'none';
  clearMsg('authMessage');
}

// Show the auth card with the form on the given tab. Called from
// the landing's CTA buttons. If Supabase didn't connect (a network
// blip or a misconfigured fork), bail out with a friendly notice
// rather than dropping the user on an unusable form.
function showAuthForm(tab) {
  if (!db.isConnected()) {
    alert("Couldn't reach the server right now. Try again in a moment, or use the demo to explore the app.");
    return;
  }
  document.getElementById('landingCard').style.display = 'none';
  document.getElementById('authCard').style.display    = '';
  switchTab(tab || 'signin');
  setTimeout(() => document.getElementById('authEmail').focus(), 50);
}

function showMsg(id, text, type = 'error') {
  const el = document.getElementById(id);
  el.textContent = text;
  el.className = `auth-message auth-message--visible auth-message--${type}`;
}

function clearMsg(id) {
  const el = document.getElementById(id);
  if (el) { el.className = 'auth-message'; el.textContent = ''; }
}

function setAuthLoading(loading) {
  const btn   = document.getElementById('authSubmitBtn');
  const label = document.getElementById('authSubmitLabel');
  btn.disabled = loading;
  label.innerHTML = loading
    ? '<span class="spinner"></span>'
    : (currentTab === 'signin' ? 'Sign In' : 'Create Account');
}

async function handleAuthSubmit() {
  const email    = document.getElementById('authEmail').value.trim();
  const password = document.getElementById('authPassword').value;
  if (!email || !password) {
    showMsg('authMessage', 'Please enter your email and password.', 'error');
    return;
  }
  clearMsg('authMessage');
  setAuthLoading(true);
  try {
    if (currentTab === 'signin') {
      await db.auth.signIn(email, password);
    } else {
      await db.auth.signUp(email, password);
      showMsg('authMessage', 'Account created! Check your email for a confirmation link, then sign in.', 'success');
    }
  } catch (err) {
    showMsg('authMessage', err.message, 'error');
  } finally {
    setAuthLoading(false);
  }
}

async function showApp(session) {
  // A real Supabase session always wins over demo mode (the user
  // signed in or up since startDemo() ran).
  const isRealSession = session.user.email !== 'Demo Visitor';
  if (isRealSession && demoMode) demoMode = false;

  document.getElementById('authGate').classList.add('auth-gate--hidden');
  document.getElementById('mainApp').style.display = '';
  document.getElementById('userEmail').textContent = session.user.email;
  document.getElementById('demoBanner').style.display = demoMode ? '' : 'none';
  _syncThemeButtons(localStorage.getItem(THEME_KEY) || 'system');
  await loadData();

  // If the user came to this real account via "Sign up to save your
  // data" inside the demo, offer to bring the seeded items along.
  if (isRealSession && localStorage.getItem(PENDING_MIGRATION_KEY) === 'true') {
    await maybeMigrateDemoData();
  }
}

function showAuthGate() {
  document.getElementById('authGate').classList.remove('auth-gate--hidden');
  document.getElementById('mainApp').style.display = 'none';
  document.getElementById('demoBanner').style.display = 'none';
  // Default to the landing splash when the gate (re)appears.
  showLanding();
  loans = [];
  borrows = [];
  renderLoans();
  renderBorrows();
}

async function signOut() {
  // Demo mode has no real Supabase session — just tear down the
  // seeded data and bounce back to the landing.
  if (demoMode) {
    db.endDemo();
    demoMode = false;
    showAuthGate();
    return;
  }
  try {
    await db.auth.signOut();
  } catch (e) { /* onAuthStateChange fires regardless */ }
}

// ============================================================
// DEMO MODE
// Author: Dylan Smith | 2026-05-28
// ============================================================

// Entry point from the landing's "Try a demo" button. Seeds the
// demo store, fakes a session, and drops the visitor into the
// main app so they can play with the seeded items.
function startDemo() {
  // Clear any stale pending-migration flag from a previous aborted
  // demo so the fresh demo starts clean.
  localStorage.removeItem(PENDING_MIGRATION_KEY);
  db.startDemo(window.buildDemoSeed());
  demoMode = true;
  showApp({ user: { email: 'Demo Visitor' } });
}

// Triggered by the banner's "Sign up to save your data" CTA.
// Keeps demoMode true and the demo data intact so migration can
// happen after the new account is verified and signed in.
function signUpFromDemo() {
  localStorage.setItem(PENDING_MIGRATION_KEY, 'true');
  document.getElementById('authGate').classList.remove('auth-gate--hidden');
  document.getElementById('mainApp').style.display = 'none';
  showAuthForm('signup');
}

// Runs once, the first time a real session reaches showApp() after
// the user opted to sign up from the demo. Snapshots the demo
// store, asks the user whether to keep the items, and either
// re-inserts them through the cloud path or discards them.
async function maybeMigrateDemoData() {
  const snapshot = await db.getDemoData();
  const total = snapshot.loans.length + snapshot.borrows.length;

  // No demo data left to migrate — just clear the flag and exit.
  if (total === 0) {
    db.endDemo();
    localStorage.removeItem(PENDING_MIGRATION_KEY);
    return;
  }

  const keep = window.confirm(
    `Bring your ${total} demo item${total === 1 ? '' : 's'} into your new account?\n\n` +
    `OK — keep them\nCancel — start fresh`
  );

  // Either path ends with the demo store cleared and the flag
  // removed so we never prompt twice.
  db.endDemo();
  localStorage.removeItem(PENDING_MIGRATION_KEY);

  if (!keep) return;

  // Re-insert each demo item via the cloud path. db.endDemo()
  // already flipped _demoMode off, so db.insert / db.borrows.insert
  // now route to Supabase.
  try {
    for (const loan of snapshot.loans) {
      // Strip the demo store's local id so the DB assigns a fresh one.
      const { id: _id, ...payload } = loan;
      await db.insert(payload);
    }
    for (const borrow of snapshot.borrows) {
      const { id: _id, ...payload } = borrow;
      await db.borrows.insert(payload);
    }
    await loadData();
  } catch (err) {
    console.error('Demo migration failed:', err);
    alert(`Couldn't bring all demo items across: ${err.message}`);
  }
}

// ============================================================
// SUPABASE INIT
// Author: Dylan Smith | 2026-03-04
// ============================================================
async function initSupabase(url, key) {
  try {
    await db.init(url, key);

    db.auth.onAuthStateChange((_event, session) => {
      if (session) showApp(session);
      else         showAuthGate();
    });

    const session = await db.auth.getSession();
    if (session) {
      showApp(session);
    } else {
      // Supabase ready, no session yet — show the landing splash.
      showLanding();
    }

  } catch (err) {
    // Connection failed — stay on the landing so the demo button
    // still works, and surface the error in the console for devs.
    console.error('Supabase init failed:', err);
  }
}

// ============================================================
// SETTINGS — theme preference
// Author: Dylan Smith | 2026-03-04
// ============================================================
const THEME_KEY = 'loanlist_theme';

function applyTheme(theme) {
  if (theme === 'dark')       document.documentElement.setAttribute('data-theme', 'dark');
  else if (theme === 'light') document.documentElement.setAttribute('data-theme', 'light');
  else                        document.documentElement.removeAttribute('data-theme');
}

function _syncThemeButtons(theme) {
  document.getElementById('themeLight').classList.toggle('theme-toggle__btn--active',  theme === 'light');
  document.getElementById('themeSystem').classList.toggle('theme-toggle__btn--active', theme === 'system');
  document.getElementById('themeDark').classList.toggle('theme-toggle__btn--active',   theme === 'dark');
}

function setTheme(theme) {
  localStorage.setItem(THEME_KEY, theme);
  applyTheme(theme);
  _syncThemeButtons(theme);
}

function toggleSettings() {
  const open = document.getElementById('settingsPopover').classList.toggle('settings-popover--open');
  document.getElementById('settingsBtn').classList.toggle('site-header__settings--open', open);
  document.getElementById('settingsBtn').setAttribute('aria-expanded', open);
}

function closeSettings() {
  document.getElementById('settingsPopover').classList.remove('settings-popover--open');
  document.getElementById('settingsBtn').classList.remove('site-header__settings--open');
  document.getElementById('settingsBtn').setAttribute('aria-expanded', 'false');
}

(function () {
  const saved = localStorage.getItem(THEME_KEY) || 'system';
  applyTheme(saved);
})();

// ============================================================
// MODE
// Author: Dylan Smith | 2026-05-22
// ============================================================
let currentMode = 'loan';

function setMode(mode) {
  currentMode = mode;
  document.body.classList.toggle('borrow-mode', mode === 'borrow');

  document.getElementById('modeTabLoan').classList.toggle('mode-tab--active', mode === 'loan');
  document.getElementById('modeTabLoan').setAttribute('aria-selected', mode === 'loan');
  document.getElementById('modeTabBorrow').classList.toggle('mode-tab--active', mode === 'borrow');
  document.getElementById('modeTabBorrow').setAttribute('aria-selected', mode === 'borrow');

  // Clear search when switching to avoid cross-mode confusion
  if (mode === 'loan') {
    document.getElementById('searchInput').value = '';
  } else {
    document.getElementById('searchBorrowInput').value = '';
  }

  // Re-render active mode (updates section header + stats)
  if (mode === 'loan') renderLoans();
  else                 renderBorrows();
}

// ============================================================
// HELPERS
// Author: Dylan Smith | 2026-03-04 / 2026-05-22 / 2026-05-23
// ============================================================
// Pure helpers (getInitials, sortActiveRecords) live in utils.js
// so they can be unit-tested in Node without the DOM. They're
// available here as globals because utils.js loads first.
function flashError(el) {
  el.classList.add('form-field__input--error');
  setTimeout(() => el.classList.remove('form-field__input--error'), 1400);
}

// ============================================================
// STATE
// Author: Dylan Smith | 2026-03-04 / 2026-05-22
// ============================================================
let loans          = [];
let borrows        = [];
let categories     = [];
let writeoffReasons = [];

let currentFilter       = 'out';
let currentBorrowFilter = 'out';

let pendingReturnId   = null;
let pendingReturnMode = 'loan';

let pendingWriteoffId   = null;
let pendingWriteoffMode = 'loan';

let pendingDeleteId   = null;
let pendingDeleteMode = 'loan';

let showReturned       = false;
let showWrittenOff     = false;
let showBorrowReturned = false;
let showBorrowWrittenOff = false;

// Add Loan / Add Borrow forms default collapsed — the list is the
// primary view; the form expands only when the user wants to add.
let showLoanForm   = false;
let showBorrowForm = false;

// ============================================================
// DATA LOAD
// Author: Dylan Smith | 2026-03-04 / 2026-05-22
// ============================================================
async function loadData() {
  try {
    [loans, borrows, categories, writeoffReasons] = await Promise.all([
      db.getAll(),
      db.borrows.getAll(),
      db.getCategories(),
      db.getWriteoffReasons(),
    ]);
    populateCategorySelects();
    populateWriteoffReasonSelect();
    // Render inactive mode first, then active mode last so the
    // shared section header always reflects the current mode.
    if (currentMode === 'loan') { renderBorrows(); renderLoans(); }
    else                        { renderLoans();   renderBorrows(); }
  } catch (err) {
    console.error('Load failed:', err);
  }
}

function populateCategorySelects() {
  const options = categories
    .map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`)
    .join('');
  document.getElementById('fCategory').innerHTML       = options;
  document.getElementById('fBorrowCategory').innerHTML = options;
}

function populateWriteoffReasonSelect() {
  document.getElementById('writeoffReason').innerHTML =
    '<option value="">Select a reason...</option>' +
    writeoffReasons.map(r => `<option value="${escapeHtml(r.name)}">${escapeHtml(r.name)}</option>`).join('');
}

// ============================================================
// ADD LOAN
// Author: Dylan Smith | 2026-03-04
// ============================================================
async function addLoan() {
  const item       = document.getElementById('fItem').value.trim();
  const person     = document.getElementById('fPerson').value.trim();
  const date       = document.getElementById('fDate').value;
  const due        = document.getElementById('fDue').value;
  const categoryId = parseInt(document.getElementById('fCategory').value, 10);
  const notes      = document.getElementById('fNotes').value.trim();

  const errors = [!item && 'fItem', !person && 'fPerson', !date && 'fDate'].filter(Boolean);
  if (errors.length) { errors.forEach(id => flashError(document.getElementById(id))); return; }

  try {
    const record = await db.insert({ item, person, categoryId, date, due, notes, returned: false, returnedDate: null });
    loans.unshift(record);
    ['fItem','fPerson','fDue','fNotes'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('fDate').value = new Date().toISOString().split('T')[0];
    renderLoans();
  } catch (err) {
    alert(`Couldn't save: ${err.message}`);
  }
}

// ============================================================
// ADD BORROW
// Author: Dylan Smith | 2026-05-22
// ============================================================
async function addBorrow() {
  const item       = document.getElementById('fBorrowItem').value.trim();
  const person     = document.getElementById('fBorrowPerson').value.trim();
  const date       = document.getElementById('fBorrowDate').value;
  const due        = document.getElementById('fBorrowDue').value;
  const categoryId = parseInt(document.getElementById('fBorrowCategory').value, 10);
  const notes      = document.getElementById('fBorrowNotes').value.trim();

  const errors = [!item && 'fBorrowItem', !person && 'fBorrowPerson', !date && 'fBorrowDate'].filter(Boolean);
  if (errors.length) { errors.forEach(id => flashError(document.getElementById(id))); return; }

  try {
    const record = await db.borrows.insert({ item, person, categoryId, date, due, notes, returned: false, returnedDate: null });
    borrows.unshift(record);
    ['fBorrowItem','fBorrowPerson','fBorrowDue','fBorrowNotes'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('fBorrowDate').value = new Date().toISOString().split('T')[0];
    renderBorrows();
  } catch (err) {
    alert(`Couldn't save: ${err.message}`);
  }
}

// ============================================================
// FILTERS
// Author: Dylan Smith | 2026-03-04 / 2026-05-22
// ============================================================
function setLoanFilter(f, btn) {
  currentFilter = f;
  document.querySelectorAll('[data-loan-only].filter-btn').forEach(b => b.classList.remove('filter-btn--active'));
  btn.classList.add('filter-btn--active');
  renderLoans();
}

function setBorrowFilter(f, btn) {
  currentBorrowFilter = f;
  document.querySelectorAll('[data-borrow-only].filter-btn').forEach(b => b.classList.remove('filter-btn--active'));
  btn.classList.add('filter-btn--active');
  renderBorrows();
}

// ============================================================
// TOGGLE SECTIONS
// Author: Dylan Smith | 2026-03-04 / 2026-05-22 / 2026-05-23
// ============================================================

// Expand/collapse the "Add a New Loan" form. When opening, jump
// focus to the first field so the user can start typing right away.
function toggleLoanForm() {
  showLoanForm = !showLoanForm;
  const form   = document.getElementById('loanForm');
  const toggle = document.getElementById('loanFormToggle');
  form.style.display = showLoanForm ? '' : 'none';
  toggle.classList.toggle('form-toggle--open', showLoanForm);
  toggle.setAttribute('aria-expanded', showLoanForm);
  document.getElementById('loanFormToggleIcon').textContent  = showLoanForm ? '−' : '+';
  document.getElementById('loanFormToggleLabel').textContent = showLoanForm ? 'Close Form' : 'Add a New Loan';
  if (showLoanForm) setTimeout(() => document.getElementById('fItem').focus(), 50);
}

function toggleBorrowForm() {
  showBorrowForm = !showBorrowForm;
  const form   = document.getElementById('borrowForm');
  const toggle = document.getElementById('borrowFormToggle');
  form.style.display = showBorrowForm ? '' : 'none';
  toggle.classList.toggle('form-toggle--open', showBorrowForm);
  toggle.setAttribute('aria-expanded', showBorrowForm);
  document.getElementById('borrowFormToggleIcon').textContent  = showBorrowForm ? '−' : '+';
  document.getElementById('borrowFormToggleLabel').textContent = showBorrowForm ? 'Close Form' : 'Add a New Borrow';
  if (showBorrowForm) setTimeout(() => document.getElementById('fBorrowItem').focus(), 50);
}

function toggleReturned() {
  showReturned = !showReturned;
  document.getElementById('returnedSection').style.display = showReturned ? 'block' : 'none';
  document.getElementById('returnedArrow').textContent     = showReturned ? '▼' : '►';
}

function toggleWrittenOff() {
  showWrittenOff = !showWrittenOff;
  document.getElementById('writtenOffSection').style.display = showWrittenOff ? 'block' : 'none';
  document.getElementById('writtenOffArrow').textContent     = showWrittenOff ? '▼' : '►';
}

function toggleBorrowReturned() {
  showBorrowReturned = !showBorrowReturned;
  document.getElementById('borrowReturnedSection').style.display = showBorrowReturned ? 'block' : 'none';
  document.getElementById('borrowReturnedArrow').textContent     = showBorrowReturned ? '▼' : '►';
}

function toggleBorrowWrittenOff() {
  showBorrowWrittenOff = !showBorrowWrittenOff;
  document.getElementById('borrowWrittenOffSection').style.display = showBorrowWrittenOff ? 'block' : 'none';
  document.getElementById('borrowWrittenOffArrow').textContent     = showBorrowWrittenOff ? '▼' : '►';
}

// ============================================================
// MODALS — RETURN
// Author: Dylan Smith | 2026-03-04 / 2026-05-22
// ============================================================
function openModal(id, mode = 'loan') {
  const arr    = mode === 'loan' ? loans : borrows;
  const record = arr.find(r => r.id === id);
  pendingReturnId   = id;
  pendingReturnMode = mode;

  document.getElementById('modalItem').textContent   = record.item;
  document.getElementById('modalPerson').textContent = record.person;

  if (mode === 'loan') {
    document.getElementById('modalTitle').textContent = 'Mark as Returned?';
    document.getElementById('modalBody').innerHTML =
      `Checking in <strong id="modalItem">${escapeHtml(record.item)}</strong> from <strong id="modalPerson">${escapeHtml(record.person)}</strong>.`;
  } else {
    document.getElementById('modalTitle').textContent = 'Return to Owner?';
    document.getElementById('modalBody').innerHTML =
      `Returning <strong id="modalItem">${escapeHtml(record.item)}</strong> to <strong id="modalPerson">${escapeHtml(record.person)}</strong>.`;
  }

  const today     = new Date().toISOString().split('T')[0];
  const dateInput = document.getElementById('modalReturnDate');
  dateInput.value = today;
  dateInput.max   = today;
  document.getElementById('overlay').classList.add('overlay--open');
  setTimeout(() => dateInput.focus(), 50);
}

function closeModal() {
  document.getElementById('overlay').classList.remove('overlay--open');
  pendingReturnId = null;
}

async function confirmReturn() {
  const dateEl       = document.getElementById('modalReturnDate');
  const returnedDate = dateEl.value;
  if (!returnedDate) { flashError(dateEl); return; }

  const changes = { returned: true, returnedDate };
  const db_update = pendingReturnMode === 'loan' ? db.update : db.borrows.update;
  const arr       = pendingReturnMode === 'loan' ? loans : borrows;

  try {
    await db_update(pendingReturnId, changes);
    const idx = arr.findIndex(r => r.id === pendingReturnId);
    if (idx !== -1) arr[idx] = { ...arr[idx], ...changes };
    closeModal();
    if (pendingReturnMode === 'loan') renderLoans();
    else                             renderBorrows();
  } catch (err) {
    alert(`Couldn't update: ${err.message}`);
    closeModal();
  }
}

// ============================================================
// MODALS — WRITE OFF
// Author: Dylan Smith | 2026-03-04 / 2026-05-22
// ============================================================
function openWriteoffModal(id, mode = 'loan') {
  const arr    = mode === 'loan' ? loans : borrows;
  const record = arr.find(r => r.id === id);
  pendingWriteoffId   = id;
  pendingWriteoffMode = mode;

  document.getElementById('writeoffModalItem').textContent   = record.item;
  document.getElementById('writeoffModalPerson').textContent = record.person;
  document.getElementById('writeoffModalPrep').textContent   = mode === 'loan' ? 'loaned to' : 'borrowed from';

  const select = document.getElementById('writeoffReason');
  select.value = '';

  const today     = new Date().toISOString().split('T')[0];
  const dateInput = document.getElementById('writeoffDate');
  dateInput.value = today;
  dateInput.max   = today;

  document.getElementById('writeoffOverlay').classList.add('overlay--open');
  setTimeout(() => select.focus(), 50);
}

function closeWriteoffModal() {
  document.getElementById('writeoffOverlay').classList.remove('overlay--open');
  pendingWriteoffId = null;
}

async function confirmWriteoff() {
  const reasonEl = document.getElementById('writeoffReason');
  const dateEl   = document.getElementById('writeoffDate');
  const reason   = reasonEl.value;
  const date     = dateEl.value;

  if (!reason) { flashError(reasonEl); return; }
  if (!date)   { flashError(dateEl);   return; }

  const changes   = { writtenOff: true, writeoffReason: reason, writtenOffDate: date };
  const db_update = pendingWriteoffMode === 'loan' ? db.update : db.borrows.update;
  const arr       = pendingWriteoffMode === 'loan' ? loans : borrows;

  try {
    await db_update(pendingWriteoffId, changes);
    const idx = arr.findIndex(r => r.id === pendingWriteoffId);
    if (idx !== -1) arr[idx] = { ...arr[idx], ...changes };
    closeWriteoffModal();
    if (pendingWriteoffMode === 'loan') renderLoans();
    else                               renderBorrows();
  } catch (err) {
    alert(`Couldn't update: ${err.message}`);
    closeWriteoffModal();
  }
}

// ============================================================
// MODALS — DELETE
// Author: Dylan Smith | 2026-03-04 / 2026-05-22
// ============================================================
function openDeleteModal(id, mode = 'loan') {
  const arr    = mode === 'loan' ? loans : borrows;
  const record = arr.find(r => r.id === id);
  if (!record) return;
  pendingDeleteId   = id;
  pendingDeleteMode = mode;

  document.getElementById('deleteModalItem').textContent   = record.item;
  document.getElementById('deleteModalPerson').textContent = record.person;
  document.getElementById('deleteModalPrep').textContent   = mode === 'loan' ? 'loaned to' : 'borrowed from';

  document.getElementById('deleteOverlay').classList.add('overlay--open');
  setTimeout(() => document.querySelector('#deleteOverlay .btn--cancel').focus(), 50);
}

function closeDeleteModal() {
  document.getElementById('deleteOverlay').classList.remove('overlay--open');
  pendingDeleteId = null;
}

async function confirmDelete() {
  if (pendingDeleteId == null) return;
  const id        = pendingDeleteId;
  const db_remove = pendingDeleteMode === 'loan' ? db.remove : db.borrows.remove;

  try {
    await db_remove(id);
    if (pendingDeleteMode === 'loan') {
      loans = loans.filter(r => r.id !== id);
      closeDeleteModal();
      renderLoans();
    } else {
      borrows = borrows.filter(r => r.id !== id);
      closeDeleteModal();
      renderBorrows();
    }
  } catch (err) {
    alert(`Couldn't delete: ${err.message}`);
    closeDeleteModal();
  }
}

// ============================================================
// RENDER — shared card builder
// Author: Dylan Smith | 2026-03-04 / 2026-05-22
// ============================================================
function buildCard(record, overdue, mode = 'loan') {
  const cat        = resolveCategory(record.categoryId, categories);
  const initials   = getInitials(record.person);
  const accentClass = mode === 'loan' ? 'loan-card--loan-accent' : 'loan-card--borrow-accent';

  const modifiers = [
    accentClass,
    record.returned   ? 'loan-card--returned'    : '',
    record.writtenOff ? 'loan-card--written-off' : '',
    overdue           ? 'loan-card--overdue'      : '',
  ].filter(Boolean).join(' ');

  const arrow    = mode === 'loan' ? '&#8594;' : '&#8592;';
  const sinceWord = mode === 'loan' ? 'loaned' : 'borrowed';
  const dueWord   = mode === 'loan' ? 'due'    : 'return by';

  const dueStr   = record.due
    ? `<span class="loan-card__meta-piece"><span class="loan-card__dot"></span> ${dueWord} ${formatDate(record.due)}</span>`
    : '';
  const notesStr = record.notes
    ? `<span class="loan-card__meta-piece"><span class="loan-card__dot"></span> ${escapeHtml(record.notes)}</span>`
    : '';

  let actions;
  if (record.writtenOff) {
    actions = `<span class="loan-card__writeoff-badge">&#10005; ${escapeHtml(record.writeoffReason)} &middot; ${formatDate(record.writtenOffDate)}</span>
               <button class="btn btn--icon" title="Delete record" onclick="openDeleteModal(${record.id}, '${mode}')">&times;</button>`;
  } else if (record.returned) {
    actions = `<span class="loan-card__returned-badge">&#10003; back ${formatDate(record.returnedDate)}</span>
               <button class="btn btn--icon" title="Delete record" onclick="openDeleteModal(${record.id}, '${mode}')">&times;</button>`;
  } else {
    actions = `<button class="btn btn--positive" onclick="openModal(${record.id}, '${mode}')">Mark Returned</button>
               <button class="btn btn--danger-ghost" onclick="openWriteoffModal(${record.id}, '${mode}')">Write Off</button>
               <button class="btn btn--icon" title="Remove" onclick="openDeleteModal(${record.id}, '${mode}')">&times;</button>`;
  }

  return `<div class="loan-card ${modifiers}">
    <div class="loan-card__avatar" aria-hidden="true">${escapeHtml(initials)}</div>
    <div class="loan-card__body">
      <div class="loan-card__item-name">${escapeHtml(record.item)}</div>
      <div class="loan-card__meta">
        <span class="loan-card__meta-piece">${arrow} <strong>${escapeHtml(record.person)}</strong></span>
        <span class="loan-card__meta-piece">${sinceWord} ${daysSince(record.date)}</span>
        ${dueStr}
        ${notesStr}
        <span class="${catPillClass(cat.slug)}">${escapeHtml(cat.name)}</span>
      </div>
    </div>
    <div class="loan-card__actions">${actions}</div>
  </div>`;
}

// Debounce so typing doesn't rebuild lists every keystroke
let _renderTimer = null;
function scheduleRender() {
  clearTimeout(_renderTimer);
  _renderTimer = setTimeout(() => {
    if (currentMode === 'loan') renderLoans();
    else                        renderBorrows();
  }, 120);
}

// ============================================================
// RENDER — LOANS
// Author: Dylan Smith | 2026-03-04 / 2026-05-22
// ============================================================
function renderLoans() {
  const q     = document.getElementById('searchInput').value.toLowerCase();
  const today = new Date().toISOString().split('T')[0];

  const activeRaw = [], returned = [], writtenOff = [];
  const overdueById = new Map();
  for (const l of loans) {
    if (l.writtenOff)    writtenOff.push(l);
    else if (l.returned) returned.push(l);
    else {
      activeRaw.push(l);
      overdueById.set(l.id, isOverdue(l, today));
    }
  }
  // Sort the active list (due date, then loan date, then item name).
  // Sort happens before deriving overdueActive so the overdue filter
  // view inherits the same ordering.
  const active = sortActiveRecords(activeRaw);
  const overdueActive = active.filter(l => overdueById.get(l.id));

  const matches  = l => matchesSearch(l, q, resolveCategory(l.categoryId, categories).name);
  const base     = currentFilter === 'overdue' ? overdueActive : active;
  const filtered = base.filter(matches);

  // Only update the shared section header when loans is the active mode
  if (currentMode === 'loan') {
    const titles = { out: 'Out on Loan', overdue: 'Overdue Items', all: 'All Active Loans' };
    document.getElementById('listTitle').textContent = titles[currentFilter];
    document.getElementById('listCount').textContent = filtered.length;
  }

  document.getElementById('loansList').innerHTML = filtered.length
    ? filtered.map(l => buildCard(l, overdueById.get(l.id) || false, 'loan')).join('')
    : `<div class="empty-state">
         <span class="empty-state__icon">&#128397;</span>
         ${currentFilter === 'overdue' ? 'No overdue items &#8212; nice!' : 'Nothing here yet. Add a loan above.'}
       </div>`;

  const filteredReturned = returned.filter(matches);
  document.getElementById('returnedCount').textContent = filteredReturned.length;
  document.getElementById('returnedList').innerHTML = filteredReturned.length
    ? filteredReturned.map(l => buildCard(l, false, 'loan')).join('')
    : `<div class="empty-state"><span class="empty-state__icon">&#128397;</span>No returned items yet.</div>`;

  const filteredWrittenOff = writtenOff.filter(matches);
  document.getElementById('writtenOffCount').textContent = filteredWrittenOff.length;
  document.getElementById('writtenOffList').innerHTML = filteredWrittenOff.length
    ? filteredWrittenOff.map(l => buildCard(l, false, 'loan')).join('')
    : `<div class="empty-state"><span class="empty-state__icon">&#128397;</span>Nothing written off yet.</div>`;

  document.getElementById('statOut').textContent        = active.length;
  document.getElementById('statOverdue').textContent    = overdueActive.length;
  document.getElementById('statReturned').textContent   = returned.length;
  document.getElementById('statWrittenOff').textContent = writtenOff.length;

  document.getElementById('modeTabLoanBadge').textContent = active.length + ' out';
}

// ============================================================
// RENDER — BORROWS
// Author: Dylan Smith | 2026-05-22
// ============================================================
function renderBorrows() {
  const q     = document.getElementById('searchBorrowInput').value.toLowerCase();
  const today = new Date().toISOString().split('T')[0];

  const activeRaw = [], returned = [], writtenOff = [];
  const overdueById = new Map();
  for (const b of borrows) {
    if (b.writtenOff)    writtenOff.push(b);
    else if (b.returned) returned.push(b);
    else {
      activeRaw.push(b);
      overdueById.set(b.id, isOverdue(b, today));
    }
  }
  // Sort the active list (due date, then borrow date, then item name).
  // Sort happens before deriving overdueActive so the overdue filter
  // view inherits the same ordering.
  const active = sortActiveRecords(activeRaw);
  const overdueActive = active.filter(b => overdueById.get(b.id));

  const matches  = b => matchesSearch(b, q, resolveCategory(b.categoryId, categories).name);
  const base     = currentBorrowFilter === 'overdue' ? overdueActive : active;
  const filtered = base.filter(matches);

  // Only update the shared section header when borrows is the active mode
  if (currentMode === 'borrow') {
    const titles = { out: 'Borrowing Now', overdue: 'Overdue Items', all: 'All Active Borrows' };
    document.getElementById('listTitle').textContent = titles[currentBorrowFilter];
    document.getElementById('listCount').textContent = filtered.length;
  }

  document.getElementById('borrowsList').innerHTML = filtered.length
    ? filtered.map(b => buildCard(b, overdueById.get(b.id) || false, 'borrow')).join('')
    : `<div class="empty-state">
         <span class="empty-state__icon">&#128397;</span>
         ${currentBorrowFilter === 'overdue' ? 'No overdue items &#8212; nice!' : 'Nothing here yet. Record a borrow above.'}
       </div>`;

  const filteredReturned = returned.filter(matches);
  document.getElementById('borrowReturnedCount').textContent = filteredReturned.length;
  document.getElementById('borrowReturnedList').innerHTML = filteredReturned.length
    ? filteredReturned.map(b => buildCard(b, false, 'borrow')).join('')
    : `<div class="empty-state"><span class="empty-state__icon">&#128397;</span>Nothing returned to owner yet.</div>`;

  const filteredWrittenOff = writtenOff.filter(matches);
  document.getElementById('borrowWrittenOffCount').textContent = filteredWrittenOff.length;
  document.getElementById('borrowWrittenOffList').innerHTML = filteredWrittenOff.length
    ? filteredWrittenOff.map(b => buildCard(b, false, 'borrow')).join('')
    : `<div class="empty-state"><span class="empty-state__icon">&#128397;</span>Nothing written off yet.</div>`;

  document.getElementById('statBorrowOut').textContent        = active.length;
  document.getElementById('statBorrowOverdue').textContent    = overdueActive.length;
  document.getElementById('statBorrowReturned').textContent   = returned.length;
  document.getElementById('statBorrowWrittenOff').textContent = writtenOff.length;

  document.getElementById('modeTabBorrowBadge').textContent = active.length + ' out';
}

// ============================================================
// JUMP TO SECTION
// Author: Dylan Smith | 2026-03-04 / 2026-05-22
// ============================================================
function jumpToSection(name) {
  if (name === 'out') {
    if (currentMode === 'loan') {
      setLoanFilter('out', document.getElementById('filterBtnOut'));
    } else {
      setBorrowFilter('out', document.getElementById('filterBorrowBtnOut'));
    }
    document.getElementById('listTitle').scrollIntoView({ behavior: 'smooth', block: 'start' });

  } else if (name === 'overdue') {
    if (currentMode === 'loan') {
      setLoanFilter('overdue', document.getElementById('filterBtnOverdue'));
    } else {
      setBorrowFilter('overdue', document.getElementById('filterBorrowBtnOverdue'));
    }
    document.getElementById('listTitle').scrollIntoView({ behavior: 'smooth', block: 'start' });

  } else if (name === 'returned') {
    if (currentMode === 'loan') {
      if (!showReturned) toggleReturned();
      document.getElementById('returnedToggle').scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      if (!showBorrowReturned) toggleBorrowReturned();
      document.getElementById('borrowReturnedToggle').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

  } else if (name === 'writtenoff') {
    if (currentMode === 'loan') {
      if (!showWrittenOff) toggleWrittenOff();
      document.getElementById('writtenOffToggle').scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      if (!showBorrowWrittenOff) toggleBorrowWrittenOff();
      document.getElementById('borrowWrittenOffToggle').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }
}

// ============================================================
// KEYBOARD + INIT
// Author: Dylan Smith | 2026-03-04 / 2026-05-22
// ============================================================
document.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    if (document.activeElement.closest('#loanForm'))   addLoan();
    if (document.activeElement.closest('#borrowForm')) addBorrow();
    if (document.activeElement.closest('.auth-form'))  handleAuthSubmit();
  }
  if (e.key === 'Escape') {
    closeModal(); closeWriteoffModal(); closeDeleteModal(); closeSettings();
  }
});

// Close settings popover when clicking outside it
document.addEventListener('click', e => {
  if (!document.getElementById('settingsWrap').contains(e.target)) closeSettings();
});

// Close modals on backdrop click
document.getElementById('overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('overlay')) closeModal();
});
document.getElementById('writeoffOverlay').addEventListener('click', e => {
  if (e.target === document.getElementById('writeoffOverlay')) closeWriteoffModal();
});
document.getElementById('deleteOverlay').addEventListener('click', e => {
  if (e.target === document.getElementById('deleteOverlay')) closeDeleteModal();
});

// Default form dates to today
document.getElementById('fDate').value       = new Date().toISOString().split('T')[0];
document.getElementById('fBorrowDate').value = new Date().toISOString().split('T')[0];

// Show the landing splash immediately so the "Try a demo" CTA is
// reachable even before Supabase is ready. Kick off Supabase init
// in parallel; if it finds an existing session it'll flip to the
// main app.
(async () => {
  showLanding();
  const { url, key } = getConfig();
  if (url && key) {
    await initSupabase(url, key);
  }
})();
