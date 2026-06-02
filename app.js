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
const CONFIG_URL_KEY = 'loanlist_supabase_url';
const CONFIG_KEY_KEY = 'loanlist_supabase_key';

function getConfig() {
  return {
    url: window.LOAN_LIST_SUPABASE_URL || localStorage.getItem(CONFIG_URL_KEY) || '',
    key: window.LOAN_LIST_SUPABASE_KEY || localStorage.getItem(CONFIG_KEY_KEY) || '',
  };
}

async function saveConfig() {
  const url = document.getElementById('cfgUrl').value.trim();
  const key = document.getElementById('cfgKey').value.trim();
  if (!url || !key) {
    showMsg('configMessage', 'Please enter both fields.', 'error');
    return;
  }
  localStorage.setItem(CONFIG_URL_KEY, url);
  localStorage.setItem(CONFIG_KEY_KEY, key);
  await initSupabase(url, key);
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

// Show the auth card with the form section visible on the given tab.
// Called from the landing's CTA buttons.
function showAuthForm(tab) {
  document.getElementById('landingCard').style.display = 'none';
  document.getElementById('authCard').style.display    = '';
  document.getElementById('authConfigSection').style.display = 'none';
  document.getElementById('authFormSection').style.display   = '';
  document.getElementById('backToLandingBtn').parentElement.style.display = '';
  switchTab(tab || 'signin');
  setTimeout(() => document.getElementById('authEmail').focus(), 50);
}

// Show the auth card with the Supabase config section visible.
// Used when no project credentials are available yet. The back-to-
// landing button is hidden here because clicking a landing CTA
// would just bounce the user right back to this screen.
function showAuthConfig() {
  document.getElementById('landingCard').style.display = 'none';
  document.getElementById('authCard').style.display    = '';
  document.getElementById('authConfigSection').style.display = '';
  document.getElementById('authFormSection').style.display   = 'none';
  document.getElementById('backToLandingBtn').parentElement.style.display = 'none';
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

function showApp(session) {
  document.getElementById('authGate').classList.add('auth-gate--hidden');
  document.getElementById('mainApp').style.display = '';
  document.getElementById('userEmail').textContent = session.user.email;
  _syncThemeButtons(localStorage.getItem(THEME_KEY) || 'system');
  loadData();
}

function showAuthGate() {
  document.getElementById('authGate').classList.remove('auth-gate--hidden');
  document.getElementById('mainApp').style.display = 'none';
  // Default to the landing splash when the gate (re)appears.
  showLanding();
  loans = [];
  borrows = [];
  renderLoans();
  renderBorrows();
}

async function signOut() {
  try {
    await db.auth.signOut();
  } catch (e) { /* onAuthStateChange fires regardless */ }
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
    showAuthConfig();
    showMsg('configMessage', `Could not connect: ${err.message}`, 'error');
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

let pendingEditId   = null;
let pendingEditMode = 'loan';

let showReturned       = false;
let showWrittenOff     = false;
let showBorrowReturned = false;
let showBorrowWrittenOff = false;

// Add Loan / Add Borrow forms: initial state is decided after data
// loads (see loadData) — open for new/light users (≤3 items in that
// mode), collapsed once the list grows past 3.
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
    // Open the Add form by default while the list is still light
    // (see shouldShowAddForm), collapse it once the user is past
    // the new-user phase. Runs only on initial load — the user can
    // toggle freely after.
    setLoanForm(shouldShowAddForm(loans.length));
    setBorrowForm(shouldShowAddForm(borrows.length));
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

// Apply form-open state to the DOM without any focus side effects.
// Used by both the user-driven toggle and the initial state set in
// loadData (where stealing focus on app load would be jarring).
function setLoanForm(open) {
  showLoanForm = open;
  const form   = document.getElementById('loanForm');
  const toggle = document.getElementById('loanFormToggle');
  form.style.display = open ? '' : 'none';
  toggle.classList.toggle('form-toggle--open', open);
  toggle.setAttribute('aria-expanded', open);
  document.getElementById('loanFormToggleIcon').textContent  = open ? '−' : '+';
  document.getElementById('loanFormToggleLabel').textContent = open ? 'Close Form' : 'Add a New Loan';
}

function setBorrowForm(open) {
  showBorrowForm = open;
  const form   = document.getElementById('borrowForm');
  const toggle = document.getElementById('borrowFormToggle');
  form.style.display = open ? '' : 'none';
  toggle.classList.toggle('form-toggle--open', open);
  toggle.setAttribute('aria-expanded', open);
  document.getElementById('borrowFormToggleIcon').textContent  = open ? '−' : '+';
  document.getElementById('borrowFormToggleLabel').textContent = open ? 'Close Form' : 'Add a New Borrow';
}

// Expand/collapse the "Add a New Loan" form. When opening, jump
// focus to the first field so the user can start typing right away.
function toggleLoanForm() {
  setLoanForm(!showLoanForm);
  if (showLoanForm) setTimeout(() => document.getElementById('fItem').focus(), 50);
}

function toggleBorrowForm() {
  setBorrowForm(!showBorrowForm);
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
// MODALS — EDIT
// Author: Dylan Smith | 2026-06-02
// Lets the user fix typos / wrong dates / wrong person on an
// existing active loan or borrow. Returned/written-off cards
// don't expose an Edit button — those flows have their own
// dedicated modals (return / writeoff).
// ============================================================
function openEditModal(id, mode = 'loan') {
  const arr    = mode === 'loan' ? loans : borrows;
  const record = arr.find(r => r.id === id);
  if (!record) return;
  pendingEditId   = id;
  pendingEditMode = mode;

  document.getElementById('editModalTitle').textContent = mode === 'loan' ? 'Edit Loan' : 'Edit Borrow';
  document.getElementById('editPersonLabel').textContent = mode === 'loan' ? 'Loaned To' : 'Borrowed From';
  document.getElementById('editDateLabel').textContent   = mode === 'loan' ? 'Date Loaned' : 'Date Borrowed';
  document.getElementById('editDeleteBtn').textContent   = mode === 'loan' ? 'Delete this loan' : 'Delete this borrow';

  const catSelect = document.getElementById('editCategory');
  catSelect.innerHTML = categories
    .map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`)
    .join('');
  catSelect.value = record.categoryId;

  document.getElementById('editItem').value   = record.item   || '';
  document.getElementById('editPerson').value = record.person || '';
  document.getElementById('editDate').value   = record.date   || '';
  document.getElementById('editDue').value    = record.due    || '';
  document.getElementById('editNotes').value  = record.notes  || '';

  document.getElementById('editOverlay').classList.add('overlay--open');
  setTimeout(() => document.getElementById('editItem').focus(), 50);
}

function closeEditModal() {
  document.getElementById('editOverlay').classList.remove('overlay--open');
  pendingEditId = null;
}

// Bridge from Edit → Delete. We close the edit modal and hand off
// to the existing delete-confirmation modal so the user always sees
// the "This can't be undone" gate before anything is actually
// removed.
function deleteFromEditModal() {
  const id   = pendingEditId;
  const mode = pendingEditMode;
  if (id == null) return;
  closeEditModal();
  openDeleteModal(id, mode);
}

async function confirmEdit() {
  if (pendingEditId == null) return;

  const itemEl   = document.getElementById('editItem');
  const personEl = document.getElementById('editPerson');
  const dateEl   = document.getElementById('editDate');

  const item       = itemEl.value.trim();
  const person     = personEl.value.trim();
  const date       = dateEl.value;
  const due        = document.getElementById('editDue').value;
  const categoryId = parseInt(document.getElementById('editCategory').value, 10);
  const notes      = document.getElementById('editNotes').value.trim();

  const errors = [!item && itemEl, !person && personEl, !date && dateEl].filter(Boolean);
  if (errors.length) { errors.forEach(flashError); return; }

  const changes   = { item, person, date, due, categoryId, notes };
  const db_update = pendingEditMode === 'loan' ? db.update : db.borrows.update;
  const arr       = pendingEditMode === 'loan' ? loans : borrows;

  try {
    await db_update(pendingEditId, changes);
    const idx = arr.findIndex(r => r.id === pendingEditId);
    if (idx !== -1) arr[idx] = { ...arr[idx], ...changes };
    closeEditModal();
    if (pendingEditMode === 'loan') renderLoans();
    else                            renderBorrows();
  } catch (err) {
    alert(`Couldn't save: ${err.message}`);
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

  // Every card carries an Edit button — that's the single entry
  // point for changing fields OR deleting. The per-card delete
  // affordance was removed; Delete now lives inside the Edit
  // modal (gated by the same confirmation dialog as before).
  const editBtn = `<button class="btn btn--edit" onclick="openEditModal(${record.id}, '${mode}')">Edit</button>`;

  let actions;
  if (record.writtenOff) {
    actions = `<span class="loan-card__writeoff-badge">&#10005; ${escapeHtml(record.writeoffReason)} &middot; ${formatDate(record.writtenOffDate)}</span>
               ${editBtn}`;
  } else if (record.returned) {
    actions = `<span class="loan-card__returned-badge">&#10003; back ${formatDate(record.returnedDate)}</span>
               ${editBtn}`;
  } else {
    actions = `${editBtn}
               <button class="btn btn--positive" onclick="openModal(${record.id}, '${mode}')">Mark Returned</button>
               <button class="btn btn--danger-ghost" onclick="openWriteoffModal(${record.id}, '${mode}')">Write Off</button>`;
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
    if (['cfgUrl','cfgKey'].includes(document.activeElement.id)) saveConfig();
  }
  if (e.key === 'Escape') {
    closeModal(); closeWriteoffModal(); closeDeleteModal(); closeEditModal(); closeSettings();
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
document.getElementById('editOverlay').addEventListener('click', e => {
  if (e.target === document.getElementById('editOverlay')) closeEditModal();
});

// Default form dates to today
document.getElementById('fDate').value       = new Date().toISOString().split('T')[0];
document.getElementById('fBorrowDate').value = new Date().toISOString().split('T')[0];

// Auto-init from baked or saved credentials
(async () => {
  const { url, key } = getConfig();
  if (url && key) {
    document.getElementById('cfgUrl').value = url;
    document.getElementById('cfgKey').value = key;
    await initSupabase(url, key);
  } else {
    // No Supabase credentials — skip the landing splash and go
    // straight to the one-time setup panel.
    showAuthConfig();
  }
})();
